import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import puppeteer from "puppeteer-core";
import { createServer } from "vite";

const outputDirectory = path.resolve(argumentValue("--output-dir") || path.join(os.tmpdir(), "worklazy-excel-compare-alignment"));
const runs = Number(argumentValue("--runs") || 3);
const withinBudgetSize = 3_000;
const overBudgetSize = 3_465;
const budget = 12_000_000;
await fs.mkdir(outputDirectory, { recursive: true });

const server = await createServer({
  root: process.cwd(),
  logLevel: "error",
  plugins: [{
    name: "excel-compare-alignment-benchmark",
    configureServer(viteServer) {
      viteServer.middlewares.use("/__excel-compare-alignment", (_request, response) => {
        response.statusCode = 200;
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(`<!doctype html><meta charset="utf-8"><script type="module">
          import { alignSequenceWithBudget } from "/src/utils/sequenceAlignment.ts";
          window.alignSequenceWithBudget = alignSequenceWithBudget;
          window.benchmarkReady = true;
        </script>`);
      });
    },
  }],
  server: { host: "127.0.0.1", port: 0 },
});

await server.listen();
const address = server.httpServer?.address();
if (!address || typeof address === "string") throw new Error("Benchmark server did not bind a TCP port.");
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-precise-memory-info", "--js-flags=--max-old-space-size=512"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.emulateCPUThrottling(4);
  page.setDefaultTimeout(180_000);
  await page.goto(`http://127.0.0.1:${address.port}/__excel-compare-alignment`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.benchmarkReady === true);
  await runAlignment(page, 200, budget);
  const samples = [];
  for (let run = 0; run < runs; run += 1) samples.push(await runAlignment(page, withinBudgetSize, budget));
  const fallback = await runAlignment(page, overBudgetSize, budget);
  if (samples.some((sample) => sample.budgetFallback || sample.largestSegmentCells !== withinBudgetSize ** 2)) {
    throw new Error(`The validated within-budget case unexpectedly fell back: ${JSON.stringify(samples)}`);
  }
  if (!fallback.budgetFallback || fallback.largestSegmentCells !== overBudgetSize ** 2) {
    throw new Error(`The over-budget case did not use deterministic position fallback: ${JSON.stringify(fallback)}`);
  }
  if (new Set(samples.map((sample) => sample.checksum)).size !== 1) throw new Error("Alignment output changed across identical benchmark runs.");
  const timings = samples.map((sample) => sample.elapsedMs).sort((left, right) => left - right);
  const report = {
    name: "excel-compare-alignment-mobile-golden",
    generatedAt: new Date().toISOString(),
    browser: await browser.version(),
    emulation: { viewport: "390x844", deviceScaleFactor: 2, touch: true, cpuThrottlingRate: 4, maxOldSpaceMiB: 512 },
    budget,
    withinBudget: {
      rowsPerSide: withinBudgetSize,
      dpCells: withinBudgetSize ** 2,
      runs,
      samplesMs: samples.map((sample) => sample.elapsedMs),
      medianMs: timings[Math.floor(timings.length / 2)],
      peakObservedHeapBytes: Math.max(...samples.map((sample) => sample.usedHeapBytes)),
      deterministicChecksum: samples[0].checksum,
      fallback: false,
    },
    overBudget: {
      rowsPerSide: overBudgetSize,
      dpCells: overBudgetSize ** 2,
      elapsedMs: fallback.elapsedMs,
      positionPairs: fallback.pairCount,
      fallback: true,
      reason: "ALIGN_LIMIT_FALLBACK",
    },
  };
  const reportPath = path.join(outputDirectory, "excel-compare-alignment-mobile-golden.json");
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ...report, reportPath }, null, 2));
} finally {
  await browser.close();
  await server.close();
}

async function runAlignment(page, size, cellBudget) {
  return page.evaluate(({ size, cellBudget }) => {
    const left = Array.from({ length: size }, (_, index) => `L-${index}`);
    const right = Array.from({ length: size }, (_, index) => `R-${index}`);
    const started = performance.now();
    const result = window.alignSequenceWithBudget(left, right, {
      signature: () => "",
      equals: () => false,
      score: () => -4,
      acceptsPair: () => false,
      gapScore: -1,
      cellBudget,
    });
    const elapsedMs = Math.round((performance.now() - started) * 100) / 100;
    let checksum = 0;
    for (const pair of result.pairs) checksum = (checksum * 33 + (pair.beforeIndex ?? -1) * 3 + (pair.afterIndex ?? -1) * 7) >>> 0;
    return {
      elapsedMs,
      budgetFallback: result.budgetFallback,
      largestSegmentCells: result.largestSegmentCells,
      pairCount: result.pairs.length,
      checksum,
      usedHeapBytes: performance.memory?.usedJSHeapSize ?? 0,
    };
  }, { size, cellBudget });
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
