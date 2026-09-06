import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");
const port = readInteger("A11Y_TEST_PORT", 4178);
const baseUrl = process.env.TEST_BASE_URL || `http://127.0.0.1:${port}`;
const chromeExecutable = process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome";
const reportPath = process.env.A11Y_REPORT_PATH || "/tmp/worklazytools-a11y-report.json";
const limits = {
  critical: readInteger("A11Y_MAX_CRITICAL", 0),
  serious: readInteger("A11Y_MAX_SERIOUS", 0),
  total: readInteger("A11Y_MAX_TOTAL", 0),
};
export const pages = Object.freeze([
  { id: "home", path: "/" },
  { id: "document-compare", path: "/ko/tools/document-compare" },
  { id: "tools", path: "/ko/tools" },
  { id: "excel-compare", path: "/ko/tools/excel-compare" },
  { id: "pdf-editor", path: "/ko/tools/pdf-editor" },
  { id: "hwp-editor", path: "/ko/tools/hwp-editor", readySelector: 'iframe[title="rhwp HWP 문서 편집기"]' },
  { id: "home-mobile-ko", path: "/ko", viewport: { width: 412, height: 839 } },
  { id: "tools-mobile-ko", path: "/ko/tools", viewport: { width: 412, height: 839 } },
]);

// Minimal exception: rhwp Studio 0.8.6 upstream owns these vendor iframe nodes.
// See docs/backlog.md, "HWP 편집기 iframe 접근성 위반 4노드". The host page stays audited.
export const accessibilityExceptions = Object.freeze([
  Object.freeze({ pageId: "hwp-editor", selector: 'iframe[title="rhwp HWP 문서 편집기"]',
    owner: "rhwp Studio 0.8.6 upstream",
    reason: "Vendor iframe: four upstream accessibility nodes; docs/backlog.md — HWP 편집기 iframe 접근성 위반 4노드" }),
]);

export function summarizeAccessibility(results, registeredPages = pages) {
  const ids = results.map(({ id }) => id);
  if (new Set(ids).size !== ids.length || ids.length !== registeredPages.length
    || registeredPages.some(({ id }) => !ids.includes(id))) throw new Error("Accessibility page registration mismatch (missing, duplicate or unexpected result).");
  const severityCounts = {};
  let violations = 0;
  for (const result of results) {
    if (!Array.isArray(result.violations)) throw new Error(`Missing accessibility violations: ${result.id}.`);
    for (const violation of result.violations) {
      const severity = violation.impact || "unknown";
      severityCounts[severity] = (severityCounts[severity] || 0) + 1;
      violations += 1;
    }
  }
  return { pages: results.length, violations, severityCounts };
}

export function assertAccessibilityResults(report, { registeredPages = pages, limits = { critical: 0, serious: 0, total: 0 } } = {}) {
  const summary = summarizeAccessibility(report.results, registeredPages);
  for (const key of ["critical", "serious", "total"]) if (!Number.isSafeInteger(limits[key]) || limits[key] < 0) throw new Error(`Invalid accessibility limit: ${key}.`);
  if (report.externalRequests.length) throw new Error(`Accessibility audit made ${report.externalRequests.length} external request(s).`);
  const contrast = report.summary.placeholderContrast?.ratio;
  if (!Number.isFinite(contrast) || contrast < 4.5) throw new Error("Document placeholder contrast is below 4.5:1 or missing.");
  if ((summary.severityCounts.critical || 0) > limits.critical || (summary.severityCounts.serious || 0) > limits.serious
    || summary.violations > limits.total) throw new Error(`Accessibility limits exceeded: ${JSON.stringify({ ...summary, limits })}`);
  return summary;
}

export async function runAccessibilityAudit() {
  let server;
  let browser;

  try {
    if (!process.env.TEST_BASE_URL) server = await startPreview();
    browser = await chromium.launch({
      executablePath: chromeExecutable,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-device-scale-factor=1"],
    });
    const results = [];
    const externalRequests = [];
    let placeholderContrast;
    for (const target of pages) {
      const context = await browser.newContext({
        viewport: target.viewport ?? { width: 1280, height: 800 },
        isMobile: Boolean(target.viewport),
        hasTouch: Boolean(target.viewport),
        serviceWorkers: "block",
        deviceScaleFactor: 1,
        colorScheme: "light",
        reducedMotion: "reduce",
        locale: "ko-KR",
        timezoneId: "Asia/Seoul",
      });
      await context.addInitScript(() => {
        localStorage.setItem("worklazy_privacy_consent", "granted");
      });

      const page = await context.newPage();
      page.on("request", (request) => {
        const requestUrl = new URL(request.url());
        const allowed = requestUrl.origin === new URL(baseUrl).origin || ["data:", "blob:"].includes(requestUrl.protocol);
        if (!allowed) externalRequests.push({ page: target.id, url: request.url() });
      });
      await page.goto(new URL(target.path, baseUrl).href, { waitUntil: "networkidle" });
      if (target.readySelector) await page.locator(target.readySelector).waitFor({ state: "visible" });
      await page.addStyleTag({
        content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important;scroll-behavior:auto!important}",
      });
      await page.evaluate(async () => {
        if (document.fonts?.ready) await document.fonts.ready;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      const builder = new AxeBuilder({ page });
      const exceptions = accessibilityExceptions.filter(({ pageId }) => pageId === target.id);
      for (const exception of exceptions) {
        if (await page.locator(exception.selector).count() !== 1) throw new Error(`Accessibility exception must match exactly one iframe: ${exception.selector}`);
        builder.exclude(exception.selector);
      }
      const audit = await builder.analyze();
      if (target.id === "document-compare") {
        placeholderContrast = await page.locator('[data-testid="document-revision-author"] input[placeholder]').evaluate((input) => {
          const parseRgb = (color) => {
            const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
            if (!channels || channels.length !== 3) throw new Error(`Could not parse rendered color ${color}.`);
            return channels;
          };
          const luminance = (color) => parseRgb(color).map((channel) => {
            const normalized = channel / 255;
            return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
          }).reduce((value, channel, index) => value + channel * [0.2126, 0.7152, 0.0722][index], 0);
          const foreground = getComputedStyle(input, "::placeholder").color;
          const background = getComputedStyle(input).backgroundColor;
          const light = Math.max(luminance(foreground), luminance(background));
          const dark = Math.min(luminance(foreground), luminance(background));
          return { foreground, background, ratio: (light + 0.05) / (dark + 0.05) };
        });
      }
      results.push({
        id: target.id,
        path: target.path,
        viewport: page.viewportSize(),
        exceptions,
        passes: audit.passes.length,
        violations: audit.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          nodes: violation.nodes.length,
          targets: violation.nodes.map((node) => node.target),
        })),
      });
      await context.close();
    }

    const aggregation = summarizeAccessibility(results);
    const summary = {
      axeCore: "4.13.0",
      browserDriver: "playwright 1.63.0",
      ...aggregation,
      measuredAt: new Date().toISOString(),
      colorScheme: "light",
      externalRequests: externalRequests.length,
      placeholderContrast,
      limits,
    };
    const report = { summary, results, externalRequests };
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

    for (const result of results) {
      const detail = result.violations.map((violation) => `${violation.id}:${violation.impact}:${violation.nodes}`).join(", ") || "none";
      console.log(`${result.id}: passes=${result.passes}; violations=${result.violations.length}; ${detail}`);
    }
    console.log(`Accessibility audit summary: ${JSON.stringify(summary)}`);
    console.log(`Document placeholder contrast: ${placeholderContrast.ratio.toFixed(4)}:1 (${placeholderContrast.foreground} on ${placeholderContrast.background}).`);
    console.log(`Accessibility report: ${reportPath}`);

    assertAccessibilityResults(report, { limits });
  } finally {
    await browser?.close();
    if (server) await stopServer(server);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runAccessibilityAudit();

function readInteger(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a non-negative integer.`);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative integer.`);
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
