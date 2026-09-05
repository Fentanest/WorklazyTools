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
  critical: readInteger("A11Y_MAX_CRITICAL", 1),
  serious: readInteger("A11Y_MAX_SERIOUS", 5),
  total: readInteger("A11Y_MAX_TOTAL", 10),
};
const pages = [
  { id: "home", path: "/ko" },
  { id: "document-compare", path: "/ko/tools/document-compare" },
  { id: "tools", path: "/ko/tools" },
  { id: "excel-compare", path: "/ko/tools/excel-compare" },
  { id: "pdf-editor", path: "/ko/tools/pdf-editor" },
];

let server;
let browser;

try {
  if (!process.env.TEST_BASE_URL) server = await startPreview();
  browser = await chromium.launch({
    executablePath: chromeExecutable,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-device-scale-factor=1"],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  });
  await context.addInitScript(() => {
    localStorage.setItem("worklazy_privacy_consent", "granted");
    localStorage.setItem("worklazy_lang", "ko");
  });

  const results = [];
  const externalRequests = [];
  for (const target of pages) {
    const page = await context.newPage();
    page.on("request", (request) => {
      const requestUrl = new URL(request.url());
      const allowed = requestUrl.origin === new URL(baseUrl).origin || ["data:", "blob:"].includes(requestUrl.protocol);
      if (!allowed) externalRequests.push({ page: target.id, url: request.url() });
    });
    await page.goto(new URL(target.path, baseUrl).href, { waitUntil: "networkidle" });
    await page.addStyleTag({
      content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important;scroll-behavior:auto!important}",
    });
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const audit = await new AxeBuilder({ page }).analyze();
    results.push({
      id: target.id,
      path: target.path,
      passes: audit.passes.length,
      violations: audit.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.length,
        targets: violation.nodes.map((node) => node.target),
      })),
    });
    await page.close();
  }

  const severityCounts = results.flatMap((result) => result.violations).reduce((counts, violation) => {
    const severity = violation.impact || "unknown";
    counts[severity] = (counts[severity] || 0) + 1;
    return counts;
  }, {});
  const summary = {
    axeCore: "4.13.0",
    browserDriver: "playwright 1.63.0",
    viewport: { width: 1280, height: 800 },
    colorScheme: "light",
    pages: results.length,
    violations: results.reduce((total, result) => total + result.violations.length, 0),
    severityCounts,
    externalRequests: externalRequests.length,
    limits,
  };
  const report = { summary, results, externalRequests };
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  for (const result of results) {
    const detail = result.violations.map((violation) => `${violation.id}:${violation.impact}:${violation.nodes}`).join(", ") || "none";
    console.log(`${result.id}: passes=${result.passes}; violations=${result.violations.length}; ${detail}`);
  }
  console.log(`Accessibility audit summary: ${JSON.stringify(summary)}`);
  console.log(`Accessibility report: ${reportPath}`);

  if (externalRequests.length > 0) throw new Error(`Accessibility audit made ${externalRequests.length} external request(s).`);
  if ((severityCounts.critical || 0) > limits.critical
    || (severityCounts.serious || 0) > limits.serious
    || summary.violations > limits.total) {
    throw new Error(`Accessibility limits exceeded: ${JSON.stringify({ severityCounts, total: summary.violations, limits })}`);
  }
} finally {
  await browser?.close();
  if (server) await stopServer(server);
}

function readInteger(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
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
