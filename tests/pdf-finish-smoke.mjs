import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";

const execFileAsync = promisify(execFile);
const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");
const port = Number(process.env.PDF_FINISH_TEST_PORT ?? "4183");
const baseUrl = process.env.TEST_BASE_URL || `http://127.0.0.1:${port}`;
const shots = path.resolve(process.env.PDF_FINISH_SHOTS || "/tmp/worklazy-u4-3/shots");
const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "worklazy-pdf-finish-"));
let server;
let browser;

try {
  await fs.mkdir(shots, { recursive: true });
  const fixture = await createFixture();
  if (!process.env.TEST_BASE_URL) server = await startPreview();
  browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-device-scale-factor=1"],
  });
  const directEntries = [];
  for (const language of ["ko", "en"]) {
    for (const route of ["finish", "page-numbers", "header-footer"]) {
      for (const viewport of [{ id: "desktop", width: 1365, height: 900 }, { id: "mobile", width: 390, height: 844 }]) {
        const context = await browser.newContext({ viewport, locale: language === "ko" ? "ko-KR" : "en-US", serviceWorkers: "block" });
        await context.addInitScript(() => {
          localStorage.setItem("worklazy_privacy_consent", "granted");
          if (!location.pathname.includes("/tools/pdf-editor/")) return;
          const pathname = location.pathname.replace(/\/+$/, "") || "/";
          const target = `${pathname}${location.search}`;
          sessionStorage.setItem(`worklazy_tool_reload:${JSON.stringify([pathname, target])}`, "pending");
        });
        const page = await context.newPage();
        const documentNavigations = [];
        page.on("framenavigated", (frame) => { if (frame === page.mainFrame()) documentNavigations.push(frame.url()); });
        await page.goto(`${baseUrl}/${language}/tools/pdf-editor/${route}/`, { waitUntil: "networkidle" });
        const expectedTab = route === "header-footer" ? "header-footer" : "page-numbers";
        await page.locator(`[data-testid='pdf-finish-ready'][data-pdf-finish-tab='${expectedTab}']`).waitFor();
        await page.waitForFunction(() => !document.querySelector(".tool-route-loading") && !Object.keys(sessionStorage).some((key) => key.startsWith("worklazy_tool_reload:")));
        assert.equal(await page.locator(".pdf-tool-navigation [data-pdf-nav-mode]").count(), 5);
        assert.equal(await page.locator(".pdf-tool-navigation [data-pdf-nav-mode='finish'][data-active='true']").count(), 1);
        assert.ok(documentNavigations.filter((url) => url.startsWith(baseUrl)).length <= 2, `${language}/${route}/${viewport.id} exceeded the one-reload recovery budget`);
        assert.equal(await page.locator("[data-route-error]").count(), 0);
        await page.screenshot({ path: path.join(shots, `${language}-${route}-${viewport.id}.png`), fullPage: false });
        directEntries.push(`${language}:${route}:${viewport.id}`);
        await context.close();
      }
    }
  }
  assert.equal(directEntries.length, 12);

  await testChunkRecovery(browser);
  await testNavigation(browser);
  await testFinishWorkflow(browser, fixture);
  await assertLazyChunks();
  console.log(`PDF finish smoke passed: ${directEntries.length} direct entries, one-reload chunk recovery, SPA tabs/navigation, selection sync, output, cancel and retry.`);
  console.log(`PDF finish screenshots: ${shots}`);
} finally {
  await browser?.close();
  if (server) await stopServer(server);
  await fs.rm(tempDirectory, { recursive: true, force: true });
}

async function testChunkRecovery(browserInstance) {
  const context = await browserInstance.newContext({ viewport: { width: 1280, height: 900 }, locale: "en-US", serviceWorkers: "block" });
  await context.addInitScript(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
  const page = await context.newPage();
  const documentRequests = [];
  let injectedFailures = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame() && request.url().startsWith(baseUrl)) documentRequests.push(request.url());
  });
  await page.route("**/assets/PdfFinishPanel-*.js", async (route) => {
    if (injectedFailures === 0) {
      injectedFailures += 1;
      await route.fulfill({ status: 404, contentType: "text/javascript", headers: { "cache-control": "no-store" }, body: "Unavailable" });
      return;
    }
    await route.continue();
  });
  try {
    await page.goto(`${baseUrl}/en/tools/pdf-editor/finish`, { waitUntil: "domcontentloaded" });
  } catch (reason) {
    if (!(reason instanceof Error) || !/ERR_ABORTED/u.test(reason.message)) throw reason;
  }
  await page.locator("[data-testid='pdf-finish-ready']").waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => !Object.keys(sessionStorage).some((key) => key.startsWith("worklazy_tool_reload:")));
  assert.equal(injectedFailures, 1, "finish recovery must inject exactly one chunk failure");
  assert.equal(documentRequests.length, 2, `finish chunk failure must spend exactly one automatic reload: ${JSON.stringify(documentRequests)}`);
  assert.equal(await page.locator("[data-route-error]").count(), 0);
  await context.close();
}

async function testNavigation(browserInstance) {
  for (const width of [320, 390, 820, 821]) {
    const context = await browserInstance.newContext({ viewport: { width, height: 844 }, locale: "en-US", serviceWorkers: "block" });
    await context.addInitScript(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
    const page = await context.newPage();
    await page.goto(`${baseUrl}/en/tools/pdf-editor/finish/`, { waitUntil: "networkidle" });
    await page.locator("[data-testid='pdf-finish-ready']").waitFor();
    const metrics = await page.locator(".pdf-tool-navigation").evaluate((navigation) => {
      const active = navigation.querySelector("[data-pdf-nav-mode='finish']");
      const navRect = navigation.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      return {
        count: navigation.querySelectorAll("[data-pdf-nav-mode]").length,
        overflow: navigation.scrollWidth > navigation.clientWidth,
        activeVisible: activeRect.left >= navRect.left - 1 && activeRect.right <= navRect.right + 1,
        cue: navigation.parentElement?.getAttribute("data-scroll-cue"),
      };
    });
    assert.equal(metrics.count, 5);
    assert.ok(metrics.activeVisible, `active finish navigation is clipped at ${width}px`);
    if (width <= 390) {
      assert.equal(metrics.overflow, true);
      assert.notEqual(metrics.cue, "none");
    }
    await context.close();
  }

  const context = await browserInstance.newContext({ viewport: { width: 1280, height: 900 }, locale: "en-US", serviceWorkers: "block" });
  await context.addInitScript(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
  const page = await context.newPage();
  await page.goto(`${baseUrl}/en/tools/pdf-editor/`, { waitUntil: "networkidle" });
  await page.locator(".pdf-tool-navigation [data-pdf-nav-mode='finish']").click();
  await page.locator("[data-testid='pdf-finish-ready'][data-pdf-finish-tab='page-numbers']").waitFor();
  assert.equal(new URL(page.url()).pathname, "/en/tools/pdf-editor/finish");
  const pathBeforeTab = new URL(page.url()).pathname;
  await page.locator("[data-finish-tab='header-footer']").click();
  await page.locator("[data-testid='pdf-finish-ready'][data-pdf-finish-tab='header-footer']").waitFor();
  assert.equal(new URL(page.url()).pathname, pathBeforeTab, "finish tab switches must not mutate the route");
  await context.close();
}

async function testFinishWorkflow(browserInstance, fixture) {
  const context = await browserInstance.newContext({ viewport: { width: 1280, height: 900 }, locale: "en-US", serviceWorkers: "block", acceptDownloads: false });
  await context.addInitScript(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  await page.goto(`${baseUrl}/en/tools/pdf-editor/page-numbers/`, { waitUntil: "networkidle" });
  await page.locator("[data-testid='pdf-finish-ready'] input[type='file']").setInputFiles({ name: "finish-browser.pdf", mimeType: "application/pdf", buffer: fixture });
  await page.locator("[data-testid='pdf-finish-overlay']").waitFor();
  assert.equal(await page.locator("[data-testid='pdf-finish-thumbnails'] .pdf-page-card").count(), 3);

  const action = page.locator("[data-testid='pdf-finish-ready'] [data-ui-component='primary-button']");
  await page.locator("[data-testid='pdf-finish-font-size']").fill("2");
  assert.equal(await action.isDisabled(), true, "invalid font size must disable execution");
  assert.match(await page.locator("[role='alert']").last().innerText(), /6|font size/iu);
  await page.locator("[data-testid='pdf-finish-font-size']").fill("10");

  const range = page.locator("[data-testid='pdf-finish-range']");
  await range.fill("1");
  await range.blur();
  await page.waitForFunction(() => document.querySelectorAll("[data-testid='pdf-finish-thumbnails'] input[type='checkbox']:checked").length === 1);
  const checks = page.locator("[data-testid='pdf-finish-thumbnails'] input[type='checkbox']");
  await checks.nth(1).click();
  assert.equal(await range.inputValue(), "1-2");
  assert.equal(await page.locator("[data-testid='pdf-finish-parity']").inputValue(), "all");
  await checks.nth(0).click();
  assert.equal(await range.inputValue(), "2");

  await page.locator("[data-testid='pdf-finish-start-page']").fill("2");
  assert.equal(await checks.nth(0).isDisabled(), true, "pages below the numbering anchor must be disabled");
  await page.locator("[data-testid='pdf-finish-start-page']").fill("1");
  await range.fill("");
  assert.equal(await action.isDisabled(), true, "an empty exact page set must disable execution");

  await range.fill("2");
  await page.locator("[data-testid='pdf-finish-start-page']").fill("2");
  await page.locator("[data-testid='pdf-finish-start-number']").fill("5");
  await page.locator("[data-testid='pdf-finish-template']").fill("P{page}/{pages} {date:YYYY-MM-DD}");
  await page.locator("[data-finish-region='bottom-right']").click();
  await action.click();
  const download = page.locator("[data-testid='pdf-download']");
  await download.waitFor({ timeout: 120_000 });
  const output = Buffer.from(await download.evaluate(async (link) => Array.from(new Uint8Array(await (await fetch(link.href)).arrayBuffer()))));
  const outputPath = path.join(tempDirectory, "finished.pdf");
  await fs.writeFile(outputPath, output);
  const document = await PDFDocument.load(output);
  assert.equal(document.getPageCount(), 3);
  assert.equal(document.getPage(1).getRotation().angle, 90);
  assert.deepEqual(document.getPage(1).getCropBox(), { x: 20, y: 30, width: 300, height: 400 });
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(output) });
  try {
    const parsed = await loadingTask.promise;
    const pageText = [];
    for (let index = 1; index <= parsed.numPages; index += 1) {
      const content = await (await parsed.getPage(index)).getTextContent();
      pageText.push(content.items.map((item) => item.str ?? "").join(" "));
    }
    assert.equal(pageText.filter((text) => /P5\/3/u.test(text)).length, 1);
    assert.match(pageText[1], /P5\/3/u);
  } finally {
    await loadingTask.destroy();
  }
  const { stdout } = await execFileAsync("pdftotext", [outputPath, "-"]);
  assert.match(stdout, /P5\/3/u, "Poppler text oracle did not find the decoration");

  await range.fill("1-3");
  await page.locator("[data-testid='pdf-finish-start-page']").fill("1");
  await page.locator("[data-testid='pdf-finish-template']").fill("취소 확인 {page}");
  const cancelWhenRendered = page.evaluate(() => new Promise((resolve) => {
    const clickCancel = () => {
      const button = document.querySelector("[data-testid='pdf-finish-cancel']");
      if (!(button instanceof HTMLButtonElement)) return false;
      button.click();
      resolve(true);
      return true;
    };
    if (clickCancel()) return;
    const observer = new MutationObserver(() => { if (clickCancel()) observer.disconnect(); });
    observer.observe(document.body, { childList: true, subtree: true });
  }));
  await action.click();
  await cancelWhenRendered;
  await page.waitForFunction(() => document.querySelector("[data-testid='pdf-error']")?.textContent?.match(/cancel|취소/i));
  assert.equal(await page.locator("[data-testid='pdf-download']").count(), 0, "canceled work must not register a stale result");
  await page.locator("[data-testid='pdf-finish-template']").fill("Retry {page}");
  await action.click();
  await page.locator("[data-testid='pdf-download']").waitFor({ timeout: 120_000 });
  assert.equal(await page.locator("[data-route-error]").count(), 0);
  await context.close();
}

async function createFixture() {
  const document = await PDFDocument.create({ updateMetadata: false });
  const font = await document.embedFont(StandardFonts.Helvetica);
  const first = document.addPage([400, 600]);
  first.drawText("Original first page", { x: 40, y: 520, size: 14, font });
  const second = document.addPage([500, 700]);
  second.setCropBox(20, 30, 300, 400);
  second.setRotation(degrees(90));
  second.drawText("Original second page", { x: 60, y: 350, size: 14, font });
  const third = document.addPage([400, 600]);
  third.drawText("Original third page", { x: 40, y: 520, size: 14, font });
  return Buffer.from(await document.save());
}

async function assertLazyChunks() {
  const assets = await fs.readdir(path.join(repositoryRoot, "dist/assets"));
  assert.ok(assets.some((name) => /^PdfFinishPanel-.+\.js$/u.test(name)), "PdfFinishPanel must be a distinct lazy chunk");
  assert.ok(assets.some((name) => /^pdfFontEmbed-.+\.js$/u.test(name)), "finish and QR must share the pdfFontEmbed lazy chunk");
}

async function startPreview() {
  const { spawn } = await import("node:child_process");
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
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
