import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDirectory = path.join(repositoryRoot, "tests/fixtures/pdf-watermark-performance");
const manifest = JSON.parse(await fs.readFile(path.join(fixtureDirectory, "manifest.json"), "utf8"));
const port = Number(process.env.PDF_WATERMARK_PERFORMANCE_PORT ?? "4282");
const baseUrl = process.env.TEST_BASE_URL || `http://127.0.0.1:${port}`;
const reportPath = process.env.PDF_WATERMARK_PERFORMANCE_REPORT || "/tmp/worklazy-u4-4-fix2/performance.json";
const repeats = Number(process.env.PDF_WATERMARK_PERFORMANCE_REPEATS ?? "3");
const chromeExecutable = process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome";
const fixtureFilter = process.env.PDF_WATERMARK_PERFORMANCE_FILTER;
const selectedFixtures = fixtureFilter ? manifest.files.filter(({ id }) => id.includes(fixtureFilter)) : manifest.files;

assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.files.length, 12);
assert.ok(Number.isSafeInteger(repeats) && repeats >= 3);
for (const fixture of manifest.files) {
  const bytes = await fs.readFile(path.join(fixtureDirectory, fixture.file));
  assert.equal(bytes.length, fixture.inputBytes, fixture.id);
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), fixture.sha256, fixture.id);
}

let server;
let browser;
try {
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  if (!process.env.TEST_BASE_URL) server = await startPreview();
  browser = await chromium.launch({
    executablePath: chromeExecutable,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-device-scale-factor=1"],
  });
  const rows = [];
  for (const fixture of selectedFixtures) {
    for (let repeat = 0; repeat < repeats; repeat += 1) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 1,
        locale: "en-US",
        serviceWorkers: "block",
        colorScheme: "light",
      });
      await installMetrics(context);
      const page = await context.newPage();
      await page.goto(`${baseUrl}/en/tools/pdf-editor/watermark`, { waitUntil: "networkidle" });
      const started = performance.now();
      await page.locator("[data-testid='pdf-finish-ready'] input[accept*='application/pdf']").setInputFiles(path.join(fixtureDirectory, fixture.file));
      await page.waitForFunction(() => {
        const panel = document.querySelector("[data-testid='pdf-finish-ready']");
        const preview = panel?.querySelector("[data-testid='pdf-finish-preview']");
        return panel?.getAttribute("data-preflight-status") === "ready" && preview?.getAttribute("data-preview-status") === "ready";
      }, undefined, { timeout: 120_000 });
      await page.evaluate(() => { window.__pdfWatermarkPerformance.previewReadyAt = performance.now(); });
      let outputPreserved = false;
      if (fixture.curve) {
        await page.evaluate(() => { window.__pdfWatermarkPerformance.creationRequestedAt = performance.now(); });
        await page.locator("[data-testid='pdf-finish-ready'] [data-ui-component='primary-button']").click();
        await page.locator("[data-testid='pdf-download']").waitFor({ timeout: 120_000 });
        await page.evaluate(() => { window.__pdfWatermarkPerformance.downloadReadyAt = performance.now(); });
        outputPreserved = Boolean(await page.locator("[data-testid='pdf-download']").getAttribute("href"));
      }
      // Include delayed interval/long-task callbacks from the complete operation,
      // including the output serialization that follows the preview-ready state.
      await page.waitForTimeout(80);
      const measured = await page.evaluate(() => {
        const canvas = document.querySelector("[data-testid='pdf-finish-canvas-area'] canvas");
        if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Preview canvas is missing.");
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("Preview canvas context is missing.");
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let darkSamples = 0;
        for (let index = 0; index < pixels.length; index += 64) {
          if (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245) darkSamples += 1;
        }
        const metrics = window.__pdfWatermarkPerformance;
        const maxGap = (entries) => entries.reduce((largest, entry) => entry.duration > largest.duration ? entry : largest, { duration: 0, endedAt: 0 });
        const previewGaps = metrics.gaps.filter(({ endedAt }) => endedAt <= metrics.previewReadyAt);
        const creationGaps = metrics.creationRequestedAt === undefined ? [] : metrics.gaps.filter(({ endedAt, duration }) => {
          const startedAt = endedAt - duration;
          return endedAt >= metrics.creationRequestedAt && startedAt <= (metrics.downloadReadyAt ?? performance.now());
        });
        const fullMaximum = maxGap(metrics.gaps);
        const previewMaximum = maxGap(previewGaps);
        const creationMaximum = maxGap(creationGaps);
        const savingStartedAt = metrics.savingStartedAt;
        const maximumStartedAt = fullMaximum.endedAt - fullMaximum.duration;
        return {
          maxHeartbeatGapMs: fullMaximum.duration,
          previewMaxHeartbeatGapMs: previewMaximum.duration,
          creationMaxHeartbeatGapMs: creationMaximum.duration,
          maxHeartbeatPhase: metrics.creationRequestedAt !== undefined && fullMaximum.endedAt >= metrics.creationRequestedAt
            ? savingStartedAt !== undefined && fullMaximum.endedAt >= savingStartedAt && maximumStartedAt <= (metrics.downloadReadyAt ?? performance.now()) ? "saving" : "creation"
            : "inspection-preview",
          maxLongTaskMs: Math.max(0, ...metrics.longTasks.map(({ duration }) => duration)),
          heartbeatSamples: metrics.gaps.length,
          longTaskCount: metrics.longTasks.length,
          savingProgressVisible: metrics.savingStartedAt !== undefined,
          darkSamples,
          overlayPlacements: Number(document.querySelector("[data-testid='pdf-finish-overlay']")?.getAttribute("data-placement-count") ?? 0),
        };
      });
      const row = { ...fixture, repeat, totalMs: performance.now() - started, outputPreserved, ...measured };
      assert.ok(row.darkSamples > 0, `${fixture.id}/${repeat} rendered a blank source preview`);
      assert.ok(row.overlayPlacements > 0, `${fixture.id}/${repeat} lost the watermark preview`);
      if (fixture.curve) assert.equal(outputPreserved, true, `${fixture.id}/${repeat} lost its output`);
      if (fixture.curve) assert.equal(row.savingProgressVisible, true, `${fixture.id}/${repeat} did not paint saving progress before serialization`);
      rows.push(row);
      console.log(JSON.stringify(row));
      await context.close();
    }
  }

  const medians = Object.fromEntries(selectedFixtures.map((fixture) => {
    const samples = rows.filter(({ id }) => id === fixture.id);
    return [fixture.id, {
      totalMs: median(samples.map(({ totalMs }) => totalMs)),
      maxHeartbeatGapMs: median(samples.map(({ maxHeartbeatGapMs }) => maxHeartbeatGapMs)),
      previewMaxHeartbeatGapMs: median(samples.map(({ previewMaxHeartbeatGapMs }) => previewMaxHeartbeatGapMs)),
      creationMaxHeartbeatGapMs: median(samples.map(({ creationMaxHeartbeatGapMs }) => creationMaxHeartbeatGapMs)),
      maxLongTaskMs: median(samples.map(({ maxLongTaskMs }) => maxLongTaskMs)),
    }];
  }));
  const heartbeatLimitMs = 200;
  const heartbeatBreaches = rows.filter(({ maxHeartbeatGapMs }) => maxHeartbeatGapMs > heartbeatLimitMs)
    .map(({ id, repeat, maxHeartbeatGapMs, maxHeartbeatPhase }) => ({ id, repeat, maxHeartbeatGapMs, maxHeartbeatPhase }));
  const heartbeatTargetMet = heartbeatBreaches.length === 0;
  if (fixtureFilter) {
    const report = { diagnosticFilter: fixtureFilter, target: { heartbeatLimitMs, met: heartbeatTargetMet, breaches: heartbeatBreaches }, medians, rows };
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`PDF watermark performance measured: filter=${fixtureFilter}; heartbeat target ${heartbeatTargetMet ? "MET" : "NOT MET"}; report=${reportPath}`);
  } else {
    const curve = ["curve-16MiB-w8192", "curve-32MiB-w8192", "curve-64MiB-w8192", "curve-128MiB-w8192"]
      .map((id) => ({ id, ...medians[id] }));
    assert.ok(curve[3].totalMs / curve[0].totalMs <= 8, `16/32/64/128MiB total-time curve is not quasi-linear: ${JSON.stringify(curve)}`);

    const cancellation = await measureCancellation(browser);
    assert.ok(cancellation.uiResponseMs <= 250, `external cancellation UI response exceeded 250ms: ${JSON.stringify(cancellation)}`);
    assert.equal(cancellation.staleCanvas, false);
    assert.equal(cancellation.staleResult, false);
    assert.equal(cancellation.retrySucceeded, true);
    const fallback = await measureWorkerFallback(browser);
    assert.deepEqual(fallback, { previewReady: true, outputPreserved: true, routeError: false });
    const curve128Rows = rows.filter(({ id }) => id === "curve-128MiB-w8192");
    assert.ok(curve128Rows.length >= 3, "128MiB heartbeat must be measured at least three times");
    const progressFallbackGuaranteed = curve128Rows.every(({ savingProgressVisible }) => savingProgressVisible);
    if (!heartbeatTargetMet) assert.equal(progressFallbackGuaranteed, true, "heartbeat target miss requires visible saving progress on every 128MiB run");
    const report = {
      environment: { viewport: "1280x900", deviceScaleFactor: 1, cpuThrottling: false, repeats },
      target: { heartbeatLimitMs, met: heartbeatTargetMet, breaches: heartbeatBreaches },
      curve128HeartbeatRuns: curve128Rows.map(({ repeat, maxHeartbeatGapMs, previewMaxHeartbeatGapMs, creationMaxHeartbeatGapMs, maxHeartbeatPhase, maxLongTaskMs, savingProgressVisible }) => ({ repeat, maxHeartbeatGapMs, previewMaxHeartbeatGapMs, creationMaxHeartbeatGapMs, maxHeartbeatPhase, maxLongTaskMs, savingProgressVisible })),
      fallbackGuarantee: { visibleSavingProgressBeforeSerialization: progressFallbackGuaranteed, inspectionCancellationUiResponseMs: cancellation.uiResponseMs },
      medians, curve, cancellation, fallback, rows,
    };
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`PDF watermark performance measured: ${manifest.files.length} inputs x ${repeats} fresh contexts; heartbeat target ${heartbeatTargetMet ? "MET" : "NOT MET"}; report=${reportPath}`);
    console.log(`Performance targets: ${JSON.stringify({ maxMedianHeartbeatGapMs: Math.max(...Object.values(medians).map(({ maxHeartbeatGapMs }) => maxHeartbeatGapMs)), cancellationUiResponseMs: cancellation.uiResponseMs, curve })}`);
  }
} finally {
  await browser?.close();
  if (server) await stopServer(server);
}

async function installMetrics(context) {
  await context.addInitScript(() => {
    localStorage.setItem("worklazy_privacy_consent", "denied");
    window.__pdfWatermarkPerformance = { gaps: [], longTasks: [] };
    let last = performance.now();
    setInterval(() => {
      const now = performance.now();
      window.__pdfWatermarkPerformance.gaps.push({ duration: now - last, endedAt: now });
      last = now;
    }, 20);
    new PerformanceObserver((list) => {
      window.__pdfWatermarkPerformance.longTasks.push(...list.getEntries().map(({ startTime, duration }) => ({ startTime, duration })));
    }).observe({ type: "longtask", buffered: true });
    const observeProgress = () => {
      const observer = new MutationObserver(() => {
        const message = document.querySelector(".ui-operation-current-message")?.textContent || "";
        if (message.includes("Saving the finished PDF") && window.__pdfWatermarkPerformance.savingStartedAt === undefined) {
          window.__pdfWatermarkPerformance.savingStartedAt = performance.now();
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    };
    if (document.documentElement) observeProgress();
    else document.addEventListener("DOMContentLoaded", observeProgress, { once: true });
    document.addEventListener("change", (event) => {
      if (!(event.target instanceof HTMLInputElement) || event.target.type !== "file") return;
      window.__pdfWatermarkPerformance.gaps = [];
      window.__pdfWatermarkPerformance.longTasks = [];
      delete window.__pdfWatermarkPerformance.previewReadyAt;
      delete window.__pdfWatermarkPerformance.creationRequestedAt;
      delete window.__pdfWatermarkPerformance.savingStartedAt;
      delete window.__pdfWatermarkPerformance.downloadReadyAt;
      last = performance.now();
    }, true);
  });
}

async function measureCancellation(browserInstance) {
  const context = await browserInstance.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, locale: "en-US", serviceWorkers: "block" });
  await installMetrics(context);
  const page = await context.newPage();
  await page.goto(`${baseUrl}/en/tools/pdf-editor/watermark`, { waitUntil: "networkidle" });
  const input = page.locator("[data-testid='pdf-finish-ready'] input[accept*='application/pdf']");
  await input.setInputFiles(path.join(fixtureDirectory, "curve-64MiB-w8192.pdf"));
  const cancel = page.locator("[data-testid='pdf-finish-file-cancel']");
  await cancel.waitFor({ timeout: 30_000 });
  const requestedAt = performance.now();
  await cancel.click();
  await page.waitForFunction(() => !document.querySelector("[data-ui-component='file-list']") && !document.querySelector("[data-testid='pdf-finish-preview']"));
  const uiResponseMs = performance.now() - requestedAt;
  await page.waitForTimeout(250);
  const staleCanvas = await page.locator("[data-testid='pdf-finish-preview'] canvas").count() > 0;
  const staleResult = await page.locator("[data-testid='pdf-download']").count() > 0;
  await input.setInputFiles(path.join(fixtureDirectory, "flate-1MiB-w8192.pdf"));
  await page.waitForFunction(() => {
    const panel = document.querySelector("[data-testid='pdf-finish-ready']");
    return panel?.getAttribute("data-preflight-status") === "ready" && panel.querySelector("[data-testid='pdf-finish-preview']")?.getAttribute("data-preview-status") === "ready";
  }, undefined, { timeout: 30_000 });
  const retrySucceeded = await page.locator("[data-testid='pdf-finish-overlay']").count() === 1;
  await context.close();
  return { uiResponseMs, staleCanvas, staleResult, retrySucceeded };
}

async function measureWorkerFallback(browserInstance) {
  const context = await browserInstance.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, locale: "en-US", serviceWorkers: "block" });
  await context.addInitScript(() => {
    localStorage.setItem("worklazy_privacy_consent", "denied");
    Object.defineProperty(globalThis, "Worker", { configurable: true, value: undefined });
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/en/tools/pdf-editor/watermark`, { waitUntil: "networkidle" });
  await page.locator("[data-testid='pdf-finish-ready'] input[accept*='application/pdf']")
    .setInputFiles(path.join(fixtureDirectory, "flate-1MiB-w8192.pdf"));
  await page.waitForFunction(() => {
    const panel = document.querySelector("[data-testid='pdf-finish-ready']");
    return panel?.getAttribute("data-preflight-status") === "ready"
      && panel.querySelector("[data-testid='pdf-finish-preview']")?.getAttribute("data-preview-status") === "ready";
  }, undefined, { timeout: 30_000 });
  const previewReady = await page.locator("[data-testid='pdf-finish-canvas-area'] canvas").count() === 1;
  await page.locator("[data-testid='pdf-finish-ready'] [data-ui-component='primary-button']").click();
  const download = page.locator("[data-testid='pdf-download']");
  await download.waitFor({ timeout: 30_000 });
  const outputPreserved = Boolean(await download.getAttribute("href"));
  const routeError = await page.locator("[data-route-error]").count() > 0;
  await context.close();
  return { previewReady, outputPreserved, routeError };
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

async function startPreview() {
  const viteBin = path.join(repositoryRoot, "node_modules/vite/bin/vite.js");
  const child = spawn(process.execPath, [viteBin, "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: repositoryRoot,
    env: { ...process.env, BROWSER: "none" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = [];
  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Vite preview exited early (${child.exitCode}): ${output.join("")}`);
    try { if ((await fetch(baseUrl)).ok) return child; } catch { /* Preview is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill("SIGTERM");
  throw new Error(`Timed out waiting for ${baseUrl}: ${output.join("")}`);
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([new Promise((resolve) => child.once("exit", resolve)), new Promise((resolve) => setTimeout(resolve, 5_000))]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
