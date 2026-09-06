import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");
const port = readInteger("RENDER_TEST_PORT", 4179);
const baseUrl = process.env.TEST_BASE_URL || `http://127.0.0.1:${port}`;
const chromeExecutable = process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome";
const reportPath = process.env.RENDER_REPORT_PATH || "/tmp/worklazytools-rendering-baseline.json";
const runsPerPage = readInteger("RENDER_RUNS", 3);
const settleTimeMs = readInteger("RENDER_SETTLE_MS", 3_000);
export const targets = Object.freeze([
  { id: "home", path: "/ko", readySelector: ".home-page .hero" },
  { id: "document-compare", path: "/ko/tools/document-compare", readySelector: '[data-tool-page="document-compare"]' },
  { id: "pdf-editor", path: "/ko/tools/pdf-editor", readySelector: '[data-tool-page="pdf-editor"]' },
]);

// Self-contained so the browser runs exactly the observer exercised by unit tests.
export function installRenderingObservers() {
  localStorage.setItem("worklazy_privacy_consent", "granted");
  localStorage.setItem("worklazy_lang", "ko");
  const metrics = globalThis.__worklazyRenderingMetrics = { cls: 0, lcp: 0, longTasks: [], layoutShifts: [] };
  const rect = (value) => Object.fromEntries(["x", "y", "width", "height", "top", "right", "bottom", "left"].map((key) => [key, value[key]]));
  const element = (node) => node ? {
    tagName: node.tagName?.toLowerCase() ?? node.nodeName,
    id: node.id || null,
    className: typeof node.className === "string" ? node.className : null,
    toolPage: node.getAttribute?.("data-tool-page") ?? null,
  } : null;
  new PerformanceObserver((list) => {
    const latest = list.getEntries().at(-1);
    if (latest) metrics.lcp = latest.startTime;
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) metrics.cls += entry.value;
      metrics.layoutShifts.push({
        startTime: entry.startTime, value: entry.value, hadRecentInput: entry.hadRecentInput,
        sources: (entry.sources ?? []).map((source) => ({
          element: element(source.node), previousRect: rect(source.previousRect), currentRect: rect(source.currentRect),
        })),
      });
    }
  }).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) metrics.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
  }).observe({ type: "longtask", buffered: true });
}

export function assertRenderingResults(results, { registeredTargets = targets, maxCls = 0.1, expectedRuns = runsPerPage } = {}) {
  if (!Number.isFinite(maxCls) || maxCls < 0) throw new Error("RENDER_MAX_CLS must be a finite non-negative number.");
  const ids = results.map(({ id }) => id);
  if (new Set(ids).size !== ids.length || ids.length !== registeredTargets.length
    || registeredTargets.some(({ id }) => !ids.includes(id))) throw new Error("Rendering page registration mismatch (missing, duplicate or unexpected result).");
  const maxima = results.map((result) => {
    if (result.samples.length !== expectedRuns || new Set(result.samples.map(({ run }) => run)).size !== expectedRuns
      || result.samples.some(({ cls, run }) => !Number.isFinite(cls) || cls < 0 || !Number.isInteger(run) || run < 1 || run > expectedRuns)) {
      throw new Error(`Invalid or missing rendering samples: ${result.id}.`);
    }
    return { id: result.id, maxCls: Math.max(...result.samples.map(({ cls }) => cls)) };
  });
  const failures = maxima.filter((result) => result.maxCls > maxCls);
  if (failures.length) throw new Error(`CLS limit ${maxCls} exceeded: ${failures.map(({ id, maxCls }) => `${id}=${maxCls}`).join(", ")}.`);
  return maxima;
}

export async function runRenderingBaseline() {
  let server;
  let browser;

  try {
    if (!process.env.TEST_BASE_URL) server = await startPreview();
    browser = await chromium.launch({
      executablePath: chromeExecutable,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-device-scale-factor=1"],
    });
    const browserVersion = await browser.version();
    const results = [];
    const externalRequests = [];

    for (const target of targets) {
      const samples = [];
      for (let run = 1; run <= runsPerPage; run += 1) {
        const context = await browser.newContext({
          viewport: { width: 1280, height: 800 },
          deviceScaleFactor: 1,
          colorScheme: "light",
          reducedMotion: "reduce",
          locale: "ko-KR",
          timezoneId: "Asia/Seoul",
          serviceWorkers: "block",
        });
        await context.addInitScript(installRenderingObservers);
        const page = await context.newPage();
        page.on("request", (request) => {
          const url = new URL(request.url());
          if (url.origin !== new URL(baseUrl).origin && !["data:", "blob:"].includes(url.protocol)) {
            externalRequests.push({ page: target.id, run, url: request.url() });
          }
        });
        const session = await context.newCDPSession(page);
        await session.send("Network.setCacheDisabled", { cacheDisabled: true });
        await page.goto(new URL(target.path, baseUrl).href, { waitUntil: "networkidle" });
        await page.locator(target.readySelector).waitFor({ state: "visible" });
        await page.waitForTimeout(settleTimeMs);
        const sample = await page.evaluate(() => {
          const navigation = performance.getEntriesByType("navigation")[0];
          const firstContentfulPaint = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
          const measuredUntil = performance.now();
          const metrics = globalThis.__worklazyRenderingMetrics;
          const longTasks = metrics.longTasks.filter((entry) => entry.startTime >= firstContentfulPaint && entry.startTime <= measuredUntil);
          return {
            lcpMs: metrics.lcp,
            cls: metrics.cls,
            layoutShifts: metrics.layoutShifts,
            longTaskBlockingTimeMs: longTasks.reduce((total, entry) => total + Math.max(0, entry.duration - 50), 0),
            longTaskCount: longTasks.length,
            fcpMs: firstContentfulPaint,
            domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? 0,
            loadMs: navigation?.loadEventEnd ?? 0,
            measuredUntilMs: measuredUntil,
          };
        });
        samples.push({ run, ...roundMetrics(sample) });
        await context.close();
      }
      results.push({ id: target.id, path: target.path, median: medianMetrics(samples), samples });
    }

    const report = {
      schemaVersion: 2,
      measuredAt: new Date().toISOString(),
      conditions: {
        build: "VITE_LOCAL_QA=1 production build served by vite preview",
        browser: browserVersion,
        viewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
        colorScheme: "light",
        locale: "ko-KR",
        timezone: "Asia/Seoul",
        cache: "disabled per run",
        serviceWorker: "blocked",
        throttling: "none (local loopback; no CPU or network emulation)",
        runsPerPage,
        maxCls: Number(process.env.RENDER_MAX_CLS ?? "0.1"),
        settleTimeMs,
        blockingMetric: "Long-task blocking time equivalent: sum(max(0, duration - 50ms)) for long tasks starting after FCP through the measurement window.",
      },
      externalRequests: externalRequests.length,
      results,
    };
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    for (const result of results) console.log(`${result.id}: ${JSON.stringify(result.median)}`);
    console.log(`Rendering baseline summary: pages=${results.length}; runs=${runsPerPage}; externalRequests=${externalRequests.length}.`);
    console.log(`Rendering baseline report: ${reportPath}`);
    const maxima = assertRenderingResults(results, { maxCls: report.conditions.maxCls });
    console.log(`CLS gate passed (page maxima): ${JSON.stringify(maxima)}`);
    if (externalRequests.length) throw new Error(`Rendering baseline made ${externalRequests.length} external request(s).`);
  } finally {
    await browser?.close();
    if (server) await stopServer(server);
  }

}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runRenderingBaseline();

function medianMetrics(samples) {
  const metricNames = ["lcpMs", "cls", "longTaskBlockingTimeMs", "longTaskCount", "fcpMs", "domContentLoadedMs", "loadMs", "measuredUntilMs"];
  return Object.fromEntries(metricNames.map((metric) => [metric, median(samples.map((sample) => sample[metric]))]));
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function roundMetrics(metrics) {
  return Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, key === "cls" || key === "layoutShifts" ? value : Number(value.toFixed(2))]));
}

function readInteger(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

async function startPreview() {
  const viteBin = path.join(repositoryRoot, "node_modules", "vite", "bin", "vite.js");
  const child = spawn(process.execPath, [viteBin, "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: repositoryRoot,
    env: { ...process.env, BROWSER: "none" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = [];
  child.stdout.on("data", (chunk) => output.push(chunk.toString()));
  child.stderr.on("data", (chunk) => output.push(chunk.toString()));
  child.unref();
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Vite preview exited early (${child.exitCode}): ${output.join("")}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return child;
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill("SIGTERM");
  throw new Error(`Timed out waiting for ${baseUrl}: ${output.join("")}`);
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
