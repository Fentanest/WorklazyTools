import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer-core";
import pngjs from "pngjs";

import {
  assertCompleteRawBenchmark,
  createStoredHeapPeak,
  dpis,
  fixtureTypes,
  formats,
  formatDecision,
  median,
  pageCounts,
  summarizeBatches,
  summarizeCell,
  warningCoefficients,
} from "./pdf-raster-benchmark-validation.mjs";

const { PNG } = pngjs;
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = path.join(repositoryRoot, "tests/fixtures/pdf-raster-benchmark");
const outputRoot = path.resolve(process.env.PDF_RASTER_BENCH_OUTPUT || "/tmp/worklazy-u4-7/benchmark");
const port = Number(process.env.PDF_RASTER_BENCH_PORT || 4276);
const baseUrl = `http://127.0.0.1:${port}`;
const chromeExecutable = process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome";
const environments = [
  {
    id: "desktop",
    label: "Desktop host measurement",
    emulated: false,
    viewport: { width: 1440, height: 1000, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
    userAgent: undefined,
  },
  {
    id: "pixel7-emulation",
    label: "Pixel 7 emulation (not a physical device)",
    emulated: true,
    viewport: { width: 412, height: 839, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true },
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.8010.12 Mobile Safari/537.36",
  },
];

assert.ok(Number.isSafeInteger(port) && port >= 4270 && port <= 4279, "benchmark port must stay in 4270..4279");

function fixtureUrl(type, pageCount) {
  return `/@fs/${path.join(fixtureRoot, `${type}-${pageCount}.pdf`)}`;
}

function writeJson(name, value) {
  fs.writeFileSync(path.join(outputRoot, name), `${JSON.stringify(value, null, 2)}\n`);
}

async function waitForServer(child) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Vite exited before the benchmark started (${child.exitCode}).`);
    try {
      const response = await fetch(`${baseUrl}/en/tools/pdf-editor/finish`);
      if (response.ok) return;
    } catch { /* Server is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Vite did not become ready for the raster benchmark.");
}

async function createHeapSampler(browser, page) {
  const sessions = new Map();
  const main = await page.createCDPSession();
  sessions.set("main", main);
  let workerSequence = 0;
  const workerNames = new Map();
  const attach = (worker) => {
    if (workerNames.has(worker)) return;
    const name = `worker-${++workerSequence}`;
    workerNames.set(worker, name);
    sessions.set(name, worker.client);
  };
  const detach = (worker) => {
    const name = workerNames.get(worker);
    if (name) sessions.delete(name);
    workerNames.delete(worker);
  };
  page.on("workercreated", attach);
  page.on("workerdestroyed", detach);
  for (const worker of page.workers()) attach(worker);

  let activeBoundarySampler;
  await page.exposeFunction("__worklazyRasterBenchmarkStage", async (stage) => {
    await activeBoundarySampler?.(stage);
  });

  async function collectGarbage() {
    for (const session of sessions.values()) {
      try { await session.send("HeapProfiler.collectGarbage"); } catch { /* Target may have closed. */ }
    }
  }

  function start() {
    const samples = [];
    let sampling = false;
    const sample = async (boundary, force = false) => {
      if (sampling && !force) return;
      while (sampling) await new Promise((resolve) => setTimeout(resolve, 1));
      sampling = true;
      try {
        const byTarget = {};
        for (const [name, session] of sessions) {
          try {
            const usage = await session.send("Runtime.getHeapUsage");
            byTarget[name] = { usedSize: usage.usedSize, backingStorageSize: usage.backingStorageSize };
          } catch { /* Target may have closed between enumeration and sampling. */ }
        }
        const aggregate = Object.values(byTarget).reduce((total, usage) => ({
          usedSize: total.usedSize + usage.usedSize,
          backingStorageSize: total.backingStorageSize + usage.backingStorageSize,
        }), { usedSize: 0, backingStorageSize: 0 });
        samples.push({ atMs: performance.now(), boundary, byTarget, ...aggregate });
      } finally {
        sampling = false;
      }
    };
    const timer = setInterval(() => { void sample(); }, 50);
    activeBoundarySampler = (boundary) => sample(boundary, true);
    return async () => {
      clearInterval(timer);
      while (sampling) await new Promise((resolve) => setTimeout(resolve, 5));
      await sample({ name: "release", scope: "host" }, true);
      activeBoundarySampler = undefined;
      return { peak: createStoredHeapPeak(samples), samples };
    };
  }

  return { start, collectGarbage, dispose: async () => {
    page.off("workercreated", attach);
    page.off("workerdestroyed", detach);
    await main.detach().catch(() => undefined);
  } };
}

async function runRaster(page, sampler, cell, captureOutput = false) {
  await sampler.collectGarbage();
  const stop = sampler.start();
  const hostStartedAt = performance.now();
  try {
    const result = await page.evaluate(async ({ url, pageCount, dpi, format, capture }) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`fixture fetch failed: ${response.status}`);
      const bytes = await response.arrayBuffer();
      const module = await import("/src/features/pdf-editor/finish/raster.ts");
      const output = await module.rasterizePdf({
        bytes,
        selectedPages: Array.from({ length: pageCount }, (_, index) => index + 1),
        options: { enabled: true, dpi, format },
        language: "en",
        onStage: (stage) => globalThis.__worklazyRasterBenchmarkStage(stage),
      });
      let base64;
      if (capture) {
        let binary = "";
        for (let index = 0; index < output.bytes.length; index += 0x8000) {
          binary += String.fromCharCode(...output.bytes.subarray(index, index + 0x8000));
        }
        base64 = btoa(binary);
      }
      return {
        inputBytes: bytes.byteLength,
        finalPdfBytes: output.bytes.byteLength,
        metrics: output.metrics,
        downgradedPages: output.downgradedPages,
        base64,
      };
    }, { url: fixtureUrl(cell.fixtureType, cell.pageCount), pageCount: cell.pageCount, dpi: cell.dpi, format: cell.format, capture: captureOutput });
    return { ...result, hostWallMs: performance.now() - hostStartedAt, heap: await stop() };
  } catch (error) {
    await stop();
    throw error;
  }
}

async function runBatch(page, sampler, format) {
  await sampler.collectGarbage();
  const stop = sampler.start();
  const hostStartedAt = performance.now();
  try {
    const result = await page.evaluate(async ({ urls, format }) => {
      const module = await import("/src/features/pdf-editor/finish/raster.ts");
      const outputs = [];
      const retained = [];
      for (const entry of urls) {
        const bytes = await (await fetch(entry.url)).arrayBuffer();
        const output = await module.rasterizePdf({
          bytes,
          selectedPages: [1, 2, 3, 4],
          options: { enabled: true, dpi: 150, format },
          language: "en",
          onStage: (stage) => globalThis.__worklazyRasterBenchmarkStage(stage),
        });
        retained.push(output.bytes);
        outputs.push({ type: entry.type, finalPdfBytes: output.bytes.byteLength, metrics: output.metrics });
      }
      await globalThis.__worklazyRasterBenchmarkStage({ name: "retain", scope: "three-file-batch", retainedBytes: retained.reduce((sum, bytes) => sum + bytes.byteLength, 0) });
      return { outputs, retainedBytes: outputs.reduce((sum, output) => sum + output.finalPdfBytes, 0) };
    }, { urls: ["blank", "text-vector", "photo-scan"].map((type) => ({ type, url: fixtureUrl(type, 4) })), format });
    return { ...result, hostWallMs: performance.now() - hostStartedAt, heap: await stop() };
  } catch (error) {
    await stop();
    throw error;
  }
}

function bytes(value) {
  return value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(2)}MiB` : `${(value / 1024).toFixed(1)}KiB`;
}

function buildTable(summary) {
  const rows = [];
  for (const fixtureType of fixtureTypes) for (const pageCount of pageCounts) for (const format of formats) for (const environment of environments) {
    const columns = dpis.map((dpi) => summary.find((cell) => cell.fixtureType === fixtureType && cell.pageCount === pageCount && cell.dpi === dpi && cell.format === format && cell.environment === environment.id));
    rows.push(`| ${fixtureType} | ${pageCount} | ${format.toUpperCase()} | ${environment.label} | ${columns.map((cell) => `${bytes(cell.finalPdfBytesMedian)} / ${cell.totalMsMedian.toFixed(0)}ms / ${bytes(cell.peakHeapUsedSizeMax)}·${bytes(cell.peakHeapBackingStorageSizeMax)}`).join(" | ")} |`);
  }
  return [
    "| fixture | pages | format | environment | 150 DPI bytes / time / peak CDP used·backing | 200 DPI bytes / time / peak CDP used·backing | 300 DPI bytes / time / peak CDP used·backing |",
    "|---|---:|---|---|---:|---:|---:|",
    ...rows,
  ].join("\n");
}

const heapAggregationFormula = "For every run, each sample total must equal the sum of its target values; usedSize and backingStorageSize maxima are selected independently from raw samples, then the maximum recorded run is selected per cell.";

function rawSourceSha256() {
  return createHash("sha256").update(fs.readFileSync(path.join(outputRoot, "raw.json"))).digest("hex");
}

function summaryDocument(summary, batches) {
  return {
    schemaVersion: 2,
    sourceRawSha256: rawSourceSha256(),
    heapAggregationFormula,
    cells: summary,
    batches,
  };
}

function tableDocument(summary) {
  return `Raw source SHA-256: \`${rawSourceSha256()}\`\n\nHeap aggregation: ${heapAggregationFormula}\n\n${buildTable(summary)}\n`;
}

function readabilityOracle(files, manifest) {
  const results = [];
  const poppler = spawnSync("pdftoppm", ["-v"], { encoding: "utf8" });
  const popplerVersion = `${poppler.stderr || poppler.stdout}`.split("\n")[0];
  const roi = manifest.readability.roiPointsFromTop;
  for (const entry of files) {
    const prefix = path.join(outputRoot, `readability-${entry.dpi}-${entry.format}`);
    const rendered = spawnSync("pdftoppm", ["-f", "1", "-singlefile", "-r", String(entry.dpi), "-png", entry.file, prefix], { encoding: "utf8" });
    if (rendered.status !== 0) throw new Error(rendered.stderr || "Poppler readability render failed");
    const image = PNG.sync.read(fs.readFileSync(`${prefix}.png`));
    const x0 = Math.max(0, Math.floor(roi.x * entry.dpi / 72));
    const y0 = Math.max(0, Math.floor(roi.y * entry.dpi / 72));
    const x1 = Math.min(image.width, Math.ceil((roi.x + roi.width) * entry.dpi / 72));
    const y1 = Math.min(image.height, Math.ceil((roi.y + roi.height) * entry.dpi / 72));
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let inkPixels = 0;
    for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) {
      const offset = (y * image.width + x) * 4;
      if (image.data[offset] <= manifest.readability.inkThreshold
          && image.data[offset + 1] <= manifest.readability.inkThreshold
          && image.data[offset + 2] <= manifest.readability.inkThreshold) {
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        inkPixels += 1;
      }
    }
    const inkHeight = inkPixels ? maxY - minY + 1 : 0;
    const threshold = Math.floor(entry.dpi * 0.057);
    results.push({ dpi: entry.dpi, format: entry.format, roiPixels: { x0, y0, x1, y1 }, inkThreshold: manifest.readability.inkThreshold, inkPixels, inkHeight, threshold, passed: inkHeight >= threshold, renderedFile: `${prefix}.png`, sourceFile: entry.file });
  }
  assert.ok(results.every(({ passed }) => passed), `readability oracle failed: ${JSON.stringify(results)}`);
  return { popplerVersion, recipe: manifest.readability, results };
}

fs.mkdirSync(outputRoot, { recursive: true });
if (process.argv.includes("--report-only")) {
  const raw = JSON.parse(fs.readFileSync(path.join(outputRoot, "raw.json"), "utf8"));
  assertCompleteRawBenchmark(raw);
  const summary = raw.cells.map((cell) => ({ ...summarizeCell(cell), raw: cell }));
  const desktopDecision = formatDecision(summary, "desktop");
  const mobileDecision = formatDecision(summary, "pixel7-emulation");
  const chosenFormat = mobileDecision.format;
  const decisions = {
    ruleLockedBeforeBenchmark: true,
    format: {
      rule: "median of three paired photo-scan 300DPI 1-page PNG/JPEG final-byte ratios; >=2.0 JPEG q85, otherwise PNG; mobile wins disagreement",
      desktop: desktopDecision,
      mobile: mobileDecision,
      selected: chosenFormat,
    },
    dpi: {
      rule: "highest mobile DPI with peak heap <= 50% of a measured physical-device limit",
      physicalDeviceLimitMeasured: false,
      selected: 150,
      reason: "Pixel 7 was emulated, not measured on a physical device; the precommitted uncalibrated fallback is 150 DPI.",
      rejectedAsDeviceLimits: ["performance.memory.jsHeapSizeLimit", "navigator.deviceMemory", "fixed 256MiB"],
    },
    warningBytesPerPixel: warningCoefficients(summary),
  };
  const summaryWithoutRaw = summary.map(({ raw: _raw, ...cell }) => cell);
  writeJson("summary.json", summaryDocument(summaryWithoutRaw, summarizeBatches(raw.batches)));
  writeJson("decision.json", decisions);
  const table = tableDocument(summary);
  fs.writeFileSync(path.join(outputRoot, "table.md"), table);
  console.log(table);
  console.log(`FORMAT_DECISION ${JSON.stringify(decisions.format)}`);
  console.log(`DPI_DECISION ${JSON.stringify(decisions.dpi)}`);
  process.exit(0);
}
const manifest = JSON.parse(fs.readFileSync(path.join(fixtureRoot, "manifest.json"), "utf8"));
assert.equal(manifest.files.length, 12);
const viteLog = fs.openSync(path.join(outputRoot, "vite.log"), "w");
const server = spawn(process.execPath, [path.join(repositoryRoot, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: repositoryRoot,
  env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
  stdio: ["ignore", viteLog, viteLog],
});

let browser;
const rawCells = [];
const readabilityFiles = [];
const batchRaw = [];
try {
  await waitForServer(server);
  browser = await puppeteer.launch({
    headless: true,
    executablePath: chromeExecutable,
    protocolTimeout: 600_000,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--js-flags=--expose-gc", "--enable-precise-memory-info"],
  });
  for (const environment of environments) {
    const page = await browser.newPage();
    await page.setViewport(environment.viewport);
    if (environment.userAgent) await page.setUserAgent(environment.userAgent);
    await page.goto(`${baseUrl}/en/tools/pdf-editor/finish`, { waitUntil: "networkidle0", timeout: 120_000 });
    const environmentMetadata = await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      deviceMemory: navigator.deviceMemory ?? null,
      hardwareConcurrency: navigator.hardwareConcurrency,
      jsHeapSizeLimit: performance.memory?.jsHeapSizeLimit ?? null,
      viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
    }));
    const sampler = await createHeapSampler(browser, page);
    try {
      for (const fixtureType of fixtureTypes) for (const pageCount of pageCounts) for (const dpi of dpis) for (const format of formats) {
        const definition = { fixtureType, pageCount, dpi, format, environment: environment.id };
        const warmup = await runRaster(page, sampler, definition);
        const records = [];
        for (let repetition = 0; repetition < 3; repetition += 1) {
          const capture = environment.id === "desktop" && fixtureType === "text-vector" && pageCount === 1 && repetition === 0;
          const record = await runRaster(page, sampler, definition, capture);
          if (capture && record.base64) {
            const file = path.join(outputRoot, `readability-source-${dpi}-${format}.pdf`);
            fs.writeFileSync(file, Buffer.from(record.base64, "base64"));
            readabilityFiles.push({ dpi, format, file });
            delete record.base64;
          }
          records.push(record);
          process.stdout.write(`BENCH ${environment.id} ${fixtureType} ${pageCount}p ${dpi} ${format} run${repetition + 1} ${record.finalPdfBytes}B ${record.metrics.totalMs.toFixed(1)}ms\n`);
        }
        rawCells.push({ ...definition, environmentMetadata, warmup, records });
        writeJson("raw.json", { schemaVersion: 2, warmupRuns: 1, recordedRuns: 3, cells: rawCells, batches: batchRaw });
      }
    } finally {
      await sampler.dispose();
      await page.close();
    }
  }

  const preliminary = rawCells.map((cell) => ({ ...summarizeCell(cell), raw: cell }));
  const desktopDecision = formatDecision(preliminary, "desktop");
  const mobileDecision = formatDecision(preliminary, "pixel7-emulation");
  const chosenFormat = mobileDecision.format;

  for (const environment of environments) {
    const page = await browser.newPage();
    await page.setViewport(environment.viewport);
    if (environment.userAgent) await page.setUserAgent(environment.userAgent);
    await page.goto(`${baseUrl}/en/tools/pdf-editor/finish`, { waitUntil: "networkidle0", timeout: 120_000 });
    const sampler = await createHeapSampler(browser, page);
    try {
      const warmup = await runBatch(page, sampler, chosenFormat);
      const records = [];
      for (let repetition = 0; repetition < 3; repetition += 1) records.push(await runBatch(page, sampler, chosenFormat));
      batchRaw.push({ environment: environment.id, dpi: 150, format: chosenFormat, files: ["blank-4", "text-vector-4", "photo-scan-4"], warmup, records });
      writeJson("raw.json", { schemaVersion: 2, warmupRuns: 1, recordedRuns: 3, cells: rawCells, batches: batchRaw });
    } finally {
      await sampler.dispose();
      await page.close();
    }
  }

  const summary = rawCells.map((cell) => ({ ...summarizeCell(cell), raw: cell }));
  const table = buildTable(summary);
  const readability = readabilityOracle(readabilityFiles, manifest);
  const decisions = {
    ruleLockedBeforeBenchmark: true,
    format: {
      rule: "median of three paired photo-scan 300DPI 1-page PNG/JPEG final-byte ratios; >=2.0 JPEG q85, otherwise PNG; mobile wins disagreement",
      desktop: formatDecision(summary, "desktop"),
      mobile: formatDecision(summary, "pixel7-emulation"),
      selected: chosenFormat,
    },
    dpi: {
      rule: "highest mobile DPI with peak heap <= 50% of a measured physical-device limit",
      physicalDeviceLimitMeasured: false,
      selected: 150,
      reason: "Pixel 7 was emulated, not measured on a physical device; the precommitted uncalibrated fallback is 150 DPI.",
      rejectedAsDeviceLimits: ["performance.memory.jsHeapSizeLimit", "navigator.deviceMemory", "fixed 256MiB"],
    },
    warningBytesPerPixel: warningCoefficients(summary),
  };
  const summaryWithoutRaw = summary.map(({ raw, ...cell }) => cell);
  writeJson("summary.json", summaryDocument(summaryWithoutRaw, summarizeBatches(batchRaw)));
  writeJson("decision.json", decisions);
  writeJson("readability.json", readability);
  fs.writeFileSync(path.join(outputRoot, "table.md"), tableDocument(summary));
  console.log(table);
  console.log(`FORMAT_DECISION ${JSON.stringify(decisions.format)}`);
  console.log(`DPI_DECISION ${JSON.stringify(decisions.dpi)}`);
  console.log(`READABILITY ${readability.results.length}/${readability.results.length} PASS`);
} finally {
  if (browser) await browser.close().catch(() => undefined);
  server.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 200));
  if (server.exitCode === null) server.kill("SIGKILL");
  fs.closeSync(viteLog);
}
