// PDF header/footer filename numeric limit — header-only browser smoke.
// Covers: preview transformed values, include-off invalid non-blocking,
// include-on blocking (including with another tab active), valid new value
// download. Uses the production dist via vite preview like pdf-finish-smoke.
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PDFDocument, StandardFonts } from "pdf-lib";
import { chromium } from "playwright";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");
const distDirectory = path.resolve(process.env.PDF_FINISH_DIST_DIR || path.join(repositoryRoot, "dist"));
const port = Number(process.env.PDF_FILENAME_TEST_PORT ?? "4187");
const baseUrl = process.env.TEST_BASE_URL || `http://127.0.0.1:${port}`;
let server;
let browser;

const LONG_NAME = "averylongfilenameindeed-for-smoke-check.pdf";
const LONG_BASE = "averylongfilenameindeed-for-smoke-check";

async function fixture() {
  const document = await PDFDocument.create({ updateMetadata: false });
  const font = await document.embedFont(StandardFonts.Helvetica);
  const first = document.addPage([400, 600]);
  first.drawText("Filename limit smoke page", { x: 40, y: 520, size: 14, font });
  return Buffer.from(await document.save());
}

try {
  const buffer = await fixture();
  if (!process.env.TEST_BASE_URL) server = await startPreview();
  browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-device-scale-factor=1"],
  });
  for (const language of ["ko", "en"]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: language === "ko" ? "ko-KR" : "en-US", serviceWorkers: "block" });
    await context.addInitScript(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
    const page = await context.newPage();
    page.setDefaultTimeout(60_000);
    await page.goto(`${baseUrl}/${language}/tools/pdf-editor/header-footer/`, { waitUntil: "networkidle" });
    await page.locator("[data-testid='pdf-finish-ready'][data-pdf-finish-tab='header-footer']").waitFor();
    await page.locator("[data-testid='pdf-finish-ready'] input[type='file']").setInputFiles({ name: LONG_NAME, mimeType: "application/pdf", buffer });
    await page.locator("[data-testid='pdf-finish-overlay']").waitFor();
    const action = page.locator("[data-testid='pdf-finish-ready'] [data-ui-component='primary-button']");
    const limit = page.locator("[data-testid='pdf-finish-filename-limit']");
    await limit.waitFor();

    // Empty limit draws the full filename in the preview.
    assert.ok((await page.locator("[data-testid='pdf-finish-overlay']").innerText()).includes(LONG_BASE), `${language}: empty limit keeps the full filename`);

    // Invalid limit blocks while header-footer is included.
    await limit.fill("1.5");
    await page.locator("[data-testid='pdf-finish-filename-limit-error']").waitFor();
    assert.equal(await action.isDisabled(), true, `${language}: invalid limit must disable execution`);

    // Enabling another tab keeps the block while header-footer stays included.
    await page.locator("[data-testid='pdf-finish-include-page-numbers']").check();
    assert.equal(await action.isDisabled(), true, `${language}: included header-footer invalid value blocks even with another tab active`);

    // Excluding header-footer keeps the inline error but unblocks the other option.
    await page.locator("[data-testid='pdf-finish-include-header-footer']").uncheck();
    assert.equal(await page.locator("[data-testid='pdf-finish-filename-limit-error']").count(), 1, `${language}: inline error stays visible while excluded`);
    await page.locator("[data-testid='pdf-finish-preflight-ready']").waitFor({ state: "attached" });
    assert.equal(await action.isDisabled(), false, `${language}: excluding header-footer must not block other options`);

    // A valid new limit truncates the preview and downloads.
    await page.locator("[data-testid='pdf-finish-include-header-footer']").check();
    await page.locator("[data-testid='pdf-finish-include-page-numbers']").uncheck();
    await limit.fill("8");
    await page.waitForFunction(() => !document.querySelector("[data-testid='pdf-finish-filename-limit-error']"));
    const overlay = await page.locator("[data-testid='pdf-finish-overlay']").innerText();
    assert.ok(overlay.includes("averylo"), `${language}: preview shows the truncated filename`);
    assert.ok(!overlay.includes(LONG_BASE), `${language}: preview hides the full filename under a numeric limit`);
    await page.locator("[data-testid='pdf-finish-preflight-ready']").waitFor({ state: "attached" });
    await action.click();
    const download = page.locator("[data-testid='pdf-download']");
    await download.waitFor({ timeout: 120_000 });
    assert.match(await download.getAttribute("download"), /\.pdf$/iu, `${language}: valid limit produces a PDF result`);
    await context.close();
  }
  console.log("PDF filename limit smoke passed: ko/en preview transform, include-off non-blocking, include-on blocking with another tab active, valid-limit download.");
} finally {
  await browser?.close();
  if (server) await stopServer(server);
}

async function startPreview() {
  const { spawn } = await import("node:child_process");
  const viteBin = path.join(repositoryRoot, "node_modules/vite/bin/vite.js");
  const child = spawn(process.execPath, [viteBin, "preview", "--outDir", distDirectory, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
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
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
