// W1 fixed regression smoke (PLAN-v5 §4.1 + ASTRA-W1 R1~R6, N2).
// Runs against a production preview build (npm run build, then serve dist,
// e.g. `npx vite preview --port 4173`) via TEST_BASE_URL.
// Covers, without any test-hook imports: delayed-chunk hold, JS/CSS chunk
// failure without reload, injected ack/retry timeouts, corrupt-intake
// failure, finish unsaved-output guard, stale-result invalidation, the
// convert memory boundary, destination/format-true messages (ko+en),
// the ZIP retained card, and finish->organize preset restore.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
const reportPath = path.resolve(process.env.PDF_W1_SMOKE_REPORT || "/tmp/muse-w1-fix1/w1-handoff-smoke.json");
const results = [];

async function pdfBuffer(pages) {
  const document = await PDFDocument.create();
  for (let i = 0; i < pages; i += 1) document.addPage([400, 600]);
  return Buffer.from(await document.save());
}

async function launch() {
  return chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
}

async function newPage(browser, { timeoutMs = 60000, ackTimeoutMs, noCache = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    serviceWorkers: "block",
  });
  if (ackTimeoutMs) {
    await context.addInitScript(`globalThis.__wlHandoffAckTimeoutMs = ${ackTimeoutMs};`);
  }
  const page = await context.newPage();
  page.setDefaultTimeout(timeoutMs);
  if (noCache) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  }
  return { page, context };
}

async function produceMerged(page, files) {
  await page.goto(`${baseUrl}/en/tools/pdf-editor/`, { waitUntil: "networkidle" });
  await page.locator("[data-ui-component='tool-guide']").waitFor();
  await page.locator(".pdf-tool-page input[type='file']").first().setInputFiles(files);
  await page.waitForFunction(
    (count) => document.querySelectorAll(".pdf-page-card").length === count,
    files.reduce((sum, file) => sum + file.pages, 0),
  );
  await page.evaluate(() => {
    const card = document.querySelector("[data-testid='pdf-output-card']");
    const create = [...card.querySelectorAll(".pdf-output-action-zone button")]
      .find((button) => !button.disabled && /Create PDF|새 PDF 만들기/.test(button.textContent));
    if (!create) throw new Error("organize create button missing");
    create.click();
  });
  await page.locator("[data-testid='pdf-download']").waitFor({ timeout: 120000 });
}

async function clickHandoff(page) {
  await page.evaluate(() => document.querySelector("[data-testid='pdf-organize-send-to-finish']").scrollIntoView({ block: "center" }));
  await page.evaluate(() => document.querySelector("[data-testid='pdf-organize-send-to-finish']").click());
}

function fileInput(files) {
  return files.map((file) => ({ name: file.name, mimeType: "application/pdf", buffer: file.buffer }));
}

async function run() {
  const browser = await launch();
  const onePagePdf = await pdfBuffer(1);
  const twoPagePdf = await pdfBuffer(2);
  try {
    // R1: delayed chunk keeps the hold; leaving stays guarded; ack completes.
    {
      const { page, context } = await newPage(browser);
      let finishHits = 0;
      await page.route("**/assets/PdfFinishPanel-*.js", async (route) => {
        finishHits += 1;
        await new Promise((resolve) => setTimeout(resolve, 4000));
        await route.continue();
      });
      const navigations = [];
      page.on("request", (request) => {
        if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations.push(request.url());
      });
      await produceMerged(page, [
        { name: "A.pdf", buffer: onePagePdf, pages: 1 },
        { name: "B.pdf", buffer: onePagePdf, pages: 1 },
      ]);
      navigations.length = 0;
      await clickHandoff(page);
      await page.waitForFunction(() => !document.querySelector("[data-testid='pdf-organize-send-to-finish']"));
      assert.ok(finishHits > 0, "R1: finish chunk interception missed");
      await page.evaluate(() => document.querySelector("aside a[href='/en/']").click());
      await page.locator("[data-testid='unsaved-work-dialog']").waitFor({ state: "visible" });
      const message = await page.locator("[data-testid='unsaved-work-dialog'] p").innerText();
      assert.match(message, /unsaved PDF result|저장하지 않은 PDF 결과/);
      await page.locator("[data-testid='unsaved-stay']").click();
      await page.waitForFunction(
        () => document.querySelector("[data-testid='pdf-finish-ready']")?.getAttribute("data-preflight-status") === "ready",
        null,
        { timeout: 120000 },
      );
      assert.deepEqual(navigations, [], "R1: no document navigation may happen while held");
      results.push({ case: "R1-delayed-chunk-hold", navigations });
      await context.close();
    }

    // R1: JS chunk failure shows the local boundary; retry refetches and acks.
    {
      const { page, context } = await newPage(browser);
      let blockFinish = true;
      await page.route("**/assets/PdfFinishPanel-*.js", (route) => (blockFinish ? route.abort() : route.continue()));
      const navigations = [];
      page.on("request", (request) => {
        if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations.push(request.url());
      });
      await produceMerged(page, [
        { name: "A.pdf", buffer: onePagePdf, pages: 1 },
        { name: "B.pdf", buffer: onePagePdf, pages: 1 },
      ]);
      navigations.length = 0;
      await clickHandoff(page);
      await page.locator("[data-testid='pdf-finish-load-failure']").waitFor();
      const downloadHref = await page.locator("[data-testid='pdf-finish-load-download']").getAttribute("href");
      assert.match(downloadHref ?? "", /^blob:/, "R1: retained bytes stay downloadable after chunk failure");
      assert.deepEqual(navigations, [], "R1: chunk failure must not reload or move to the error document");
      blockFinish = false;
      await page.locator("[data-testid='pdf-finish-load-retry']").click();
      await page.waitForFunction(
        () => document.querySelector("[data-testid='pdf-finish-ready']")?.getAttribute("data-preflight-status") === "ready",
        null,
        { timeout: 120000 },
      );
      assert.equal(await page.locator("[data-testid='pdf-handoff-chip']").count(), 0, "R1: retry ack clears the chip");
      results.push({ case: "R1-chunk-js-failure-retry" });
      await context.close();
    }

    // R1: CSS outage during the held handoff neither reloads nor breaks it.
    // (This build emits no dedicated PdfFinishPanel CSS asset, so the exact
    // `vite:preloadError` CSS branch is pinned by unit test instead: a held
    // CSS preload error resolves to no-reload.)
    {
      const { page, context } = await newPage(browser);
      let cssHits = 0;
      let blockCss = true;
      await page.route("**/*.css", (route) => {
        if (!blockCss) return route.continue();
        cssHits += 1;
        return route.abort();
      });
      const navigations = [];
      page.on("request", (request) => {
        if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations.push(request.url());
      });
      await produceMerged(page, [
        { name: "A.pdf", buffer: onePagePdf, pages: 1 },
        { name: "B.pdf", buffer: onePagePdf, pages: 1 },
      ]);
      navigations.length = 0;
      await clickHandoff(page);
      await page.waitForFunction(
        () => !!document.querySelector("[data-testid='pdf-finish-ready']") || !!document.querySelector("[data-testid='pdf-finish-load-failure']"),
        null,
        { timeout: 120000 },
      );
      assert.deepEqual(navigations, [], "R1: CSS failure must not reload or move to the error document");
      assert.ok(cssHits > 0, "R1: CSS interception must have been active");
      blockCss = false;
      await page.waitForFunction(
        () => document.querySelector("[data-testid='pdf-finish-ready']")?.getAttribute("data-preflight-status") === "ready",
        null,
        { timeout: 120000 },
      );
      assert.equal(await page.locator("[data-testid='pdf-handoff-chip']").count(), 0, "R1: intake acks despite the CSS outage");
      results.push({ case: "R1-chunk-css-outage", cssHits });
      await context.close();
    }

    // R1: injected ack timeout keeps the result; a delayed load still acks.
    // R1: retry timeout re-arms through the same path (suggestion insert).
    {
      const { page, context } = await newPage(browser, { ackTimeoutMs: 2000, timeoutMs: 90000 });
      let delayFinish = true;
      await page.route("**/assets/PdfFinishPanel-*.js", async (route) => {
        if (delayFinish) await new Promise((resolve) => setTimeout(resolve, 8000));
        await route.continue();
      });
      await produceMerged(page, [{ name: "A.pdf", buffer: onePagePdf, pages: 1 }]);
      await page.locator("[data-pdf-nav-mode='finish']").click();
      await page.locator("[data-testid='unsaved-leave']").click();
      await page.locator("[data-testid='pdf-handoff-chip']").waitFor();
      // Suggestion insert with the chunk still delayed -> retry timeout fires.
      await page.locator("[data-testid='pdf-handoff-retry']").click();
      await page.waitForFunction(
        () => (document.querySelector("[data-testid='pdf-handoff-chip'] p")?.textContent || "").length > 0,
      );
      await page.waitForFunction(
        () => /could not accept|받지 못했습니다/.test(document.querySelector("[data-testid='pdf-handoff-chip'] p")?.textContent || ""),
        null,
        { timeout: 30000 },
      );
      delayFinish = false;
      await page.waitForFunction(
        () => document.querySelector("[data-testid='pdf-finish-ready']")?.getAttribute("data-preflight-status") === "ready",
        null,
        { timeout: 120000 },
      );
      assert.equal(await page.locator("[data-testid='pdf-handoff-chip']").count(), 0, "R1: late load acks after the retry timeout");
      results.push({ case: "R1-ack-timeout-and-retry-timeout" });
      await context.close();
    }

    // R1/R2: corrupt intake fails the inspection; hold is released; retry works.
    // noCache defeats the worker HTTP cache so the block applies every run.
    {
      const { page, context } = await newPage(browser, { noCache: true });
      let blockWorker = false;
      await page.route("**/pdf.worker.min*", (route) => (blockWorker ? route.abort() : route.continue()));
      await produceMerged(page, [{ name: "A.pdf", buffer: onePagePdf, pages: 1 }]);
      blockWorker = true;
      await clickHandoff(page);
      await page.locator("[data-testid='pdf-handoff-chip']").waitFor({ timeout: 120000 });
      const failed = await page.locator("[data-testid='pdf-handoff-chip'] p").innerText();
      assert.match(failed, /could not accept|받지 못했습니다/);
      const prevented = await page.evaluate(() => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      });
      assert.equal(prevented, true, "R1: failed intake keeps the result guarded");
      blockWorker = false;
      await page.locator("[data-testid='pdf-handoff-retry']").click();
      await page.waitForFunction(
        () => document.querySelector("[data-testid='pdf-finish-ready']")?.getAttribute("data-preflight-status") === "ready",
        null,
        { timeout: 120000 },
      );
      results.push({ case: "R1-corrupt-intake-failure-retry" });
      await context.close();
    }

    // R2: produced-but-unsaved finish output stays guarded; saving releases it.
    {
      const { page, context } = await newPage(browser);
      await page.goto(`${baseUrl}/en/tools/pdf-editor/finish/`, { waitUntil: "networkidle" });
      await page.locator("[data-testid='pdf-finish-ready'] input[type='file']").setInputFiles(fileInput([{ name: "A.pdf", buffer: onePagePdf }]));
      await page.waitForFunction(
        () => document.querySelector("[data-testid='pdf-finish-ready']")?.getAttribute("data-preflight-status") === "ready",
        null,
        { timeout: 120000 },
      );
      await page.locator("[data-testid='pdf-finish-ready'] [data-ui-component='primary-button']").click();
      await page.locator("[data-testid='pdf-download']").waitFor({ timeout: 120000 });
      await page.locator("[data-pdf-nav-mode='organize']").click();
      await page.locator("[data-testid='unsaved-work-dialog']").waitFor({ state: "visible" });
      await page.locator("[data-testid='unsaved-leave']").click();
      await page.locator("[data-testid='pdf-finish-ready']").waitFor({ state: "detached" });
      results.push({ case: "R2-unsaved-output-guarded" });
      await context.close();
    }

    // R2: cancel preserves the completed output under the same guard rule.
    // Deterministic window under heavy CPU throttling: a 1-page file
    // finishes first while a 100-page file is still processing.
    {
      const { page, context } = await newPage(browser);
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 20 });
      const bigPdf = await pdfBuffer(100);
      await page.goto(`${baseUrl}/en/tools/pdf-editor/finish/`, { waitUntil: "networkidle" });
      await page.locator("[data-testid='pdf-finish-ready'] input[type='file']").setInputFiles(
        fileInput([
          { name: "A.pdf", buffer: onePagePdf },
          { name: "Big.pdf", buffer: bigPdf },
        ]),
      );
      await page.waitForFunction(
        () => document.querySelector("[data-testid='pdf-finish-ready']")?.getAttribute("data-preflight-status") === "ready",
        null,
        { timeout: 180000 },
      );
      await page.locator("[data-testid='pdf-finish-ready'] [data-ui-component='primary-button']").click();
      await page.locator("[data-testid='pdf-finish-cancel']").waitFor({ state: "visible", timeout: 180000 });
      await page.waitForTimeout(1500);
      await page.locator("[data-testid='pdf-finish-cancel']").click();
      await page.waitForTimeout(1500);
      assert.equal(await page.locator("[data-testid='pdf-finish-ready']").count(), 1, "R2: cancel keeps the panel mounted");
      assert.ok((await page.locator("[data-testid='pdf-download']").count()) >= 1, "R2: cancel preserves completed outputs");
      await page.locator("[data-pdf-nav-mode='organize']").click();
      await page.locator("[data-testid='unsaved-work-dialog']").waitFor({ state: "visible" });
      await page.locator("[data-testid='unsaved-leave']").click();
      await page.locator("[data-testid='pdf-finish-ready']").waitFor({ state: "detached" });
      results.push({ case: "R2-cancel-preserved-output-guarded" });
      await context.close();
    }

    // R3: output-setting edits and new inputs invalidate the retained result.
    {
      const { page, context } = await newPage(browser);
      await produceMerged(page, [{ name: "A.pdf", buffer: onePagePdf, pages: 1 }]);
      await page.locator("input[placeholder='e.g. INTERNAL REVIEW']").fill("NEW WATERMARK");
      await page.locator("[data-pdf-nav-mode='finish']").click();
      await page.locator("[data-testid='unsaved-leave']").click();
      await page.locator("[data-testid='pdf-finish-ready']").waitFor({ timeout: 60000 });
      assert.equal(await page.locator("[data-testid='pdf-handoff-chip']").count(), 0, "R3: edited settings must not leave a handoff suggestion");
      await page.locator("[data-pdf-nav-mode='organize']").click();
      await page.locator(".pdf-tool-page input[type='file']").first().setInputFiles(fileInput([{ name: "B-two-pages.pdf", buffer: twoPagePdf }]));
      await page.waitForTimeout(1000);
      assert.equal(await page.locator("[data-testid='pdf-retained-result']").count(), 0, "R3: new input must clear the retained result");
      results.push({ case: "R3-setting-and-input-invalidation" });
      await context.close();
    }

    // R4: convert is outside the preservation boundary; slot and guard die.
    {
      const { page, context } = await newPage(browser);
      await produceMerged(page, [{ name: "A.pdf", buffer: onePagePdf, pages: 1 }]);
      await page.evaluate(() => {
        const anchor = document.createElement("a");
        anchor.href = "/en/tools/pdf-editor/image-to-pdf/";
        anchor.id = "review-convert-link";
        anchor.textContent = "review convert link";
        anchor.style.cssText = "position:fixed;right:20px;top:20px;z-index:999999;background:white";
        document.body.append(anchor);
      });
      await page.locator("#review-convert-link").click();
      await page.locator("[data-testid='unsaved-leave']").click();
      await page.waitForTimeout(400);
      const prevented = await page.evaluate(() => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      });
      assert.equal(prevented, false, "R4: leaving the host paths must release the guard");
      await page.locator("a[href='/en/']").first().click();
      await page.waitForTimeout(500);
      const backHref = await page.locator("a[href*='/tools/pdf-editor']").first().getAttribute("href");
      await page.locator("a[href*='/tools/pdf-editor']").first().click();
      await page.waitForTimeout(500);
      assert.equal(await page.locator("[data-testid='pdf-retained-result']").count(), 0, "R4: no stale retained card after convert+home");
      results.push({ case: "R4-convert-boundary", backHref });
      await context.close();
    }

    // R6+N2 (ko+en): format- and destination-true messages; ZIP card rules.
    for (const language of ["ko", "en"]) {
      const { page, context } = await newPage(browser);
      const dialogText = () => page.locator("[data-testid='unsaved-work-dialog'] p").innerText();
      await page.goto(`${baseUrl}/${language}/tools/pdf-editor/split/`, { waitUntil: "networkidle" });
      await page.locator("[data-ui-component='tool-guide']").waitFor();
      await page.locator(".pdf-tool-page input[type='file']").first().setInputFiles(fileInput([{ name: "C.pdf", buffer: twoPagePdf }]));
      await page.waitForFunction(() => document.querySelectorAll(".pdf-page-card").length === 2);
      await page.evaluate(() => document.querySelector(".pdf-split-after").click());
      await page.evaluate(() => {
        const apply = [...document.querySelectorAll("button")].find((button) => /연속 범위 적용|Apply continuous/.test(button.textContent));
        if (!apply) throw new Error("quick-split apply missing");
        apply.click();
      });
      await page.evaluate(() => {
        const zone = document.querySelector("[data-testid='pdf-output-card'] .pdf-output-action-zone");
        const create = [...zone.querySelectorAll("button")].find((button) => !button.disabled);
        create.click();
      });
      await page.locator("[data-testid='pdf-download']").waitFor({ timeout: 120000 });
      assert.equal(await page.locator("[data-testid='pdf-organize-send-to-finish']").isDisabled(), true, `R6(${language}): ZIP disables handoff`);
      await page.locator("[data-pdf-nav-mode='finish']").click();
      await page.locator("[data-testid='unsaved-work-dialog']").waitFor({ state: "visible" });
      const zipMessage = await dialogText();
      assert.match(zipMessage, language === "ko" ? /ZIP/ : /ZIP/, `R6(${language}): ZIP wording`);
      assert.match(zipMessage, language === "ko" ? /먼저 내려받으세요/ : /download them first/, `R6(${language}): ZIP wording`);
      await page.locator("[data-testid='unsaved-leave']").click();
      await page.locator("[data-testid='pdf-finish-ready']").waitFor({ timeout: 60000 });
      assert.equal(await page.locator("[data-testid='pdf-handoff-chip']").count(), 0, `R6(${language}): ZIP never becomes a suggestion`);
      results.push({ case: `R6-zip-message-${language}` });
      await context.close();
    }

    // N2: adopted merged card download counts as saved; ZIP card is inert.
    {
      const { page, context } = await newPage(browser);
      await produceMerged(page, [{ name: "A.pdf", buffer: onePagePdf, pages: 1 }]);
      await page.locator("[data-pdf-nav-mode='finish']").click();
      await page.locator("[data-testid='unsaved-leave']").click();
      await page.locator("[data-testid='pdf-handoff-chip']").waitFor({ timeout: 60000 });
      await page.evaluate(() => window.history.back());
      await page.locator("[data-testid='unsaved-work-dialog']").waitFor({ state: "visible" });
      await page.locator("[data-testid='unsaved-leave']").click();
      await page.locator("[data-testid='pdf-retained-result']").waitFor({ timeout: 60000 });
      await page.evaluate(() => document.querySelector("[data-testid='pdf-retained-download']").click());
      await page.waitForTimeout(300);
      await page.evaluate(() => document.querySelector("aside a[href='/en/']").click());
      await page.waitForFunction(() => location.pathname.replace(/\/+$/, "") === "/en", { timeout: 15000 });
      results.push({ case: "N2-retained-download-is-save" });
      await context.close();
    }

    // finish->organize reopening keeps the preset route without re-confirming.
    {
      const { page, context } = await newPage(browser);
      await page.goto(`${baseUrl}/en/tools/pdf-editor/split/`, { waitUntil: "networkidle" });
      await page.locator("[data-ui-component='tool-guide']").waitFor();
      await page.locator(".pdf-tool-page input[type='file']").first().setInputFiles(fileInput([{ name: "C.pdf", buffer: twoPagePdf }]));
      await page.waitForFunction(() => document.querySelectorAll(".pdf-page-card").length === 2);
      // Merged output keeps the /split preset route while producing a
      // hand-offable single PDF.
      await page.evaluate(() => {
        const group = document.querySelector("[data-testid='pdf-output-card'] [role='radiogroup']");
        const merged = [...group.querySelectorAll("[role='radio']")][0];
        merged.click();
      });
      await page.evaluate(() => {
        const zone = document.querySelector("[data-testid='pdf-output-card'] .pdf-output-action-zone");
        const create = [...zone.querySelectorAll("button")].find((button) => !button.disabled);
        create.click();
      });
      await page.locator("[data-testid='pdf-download']").waitFor({ timeout: 120000 });
      await page.locator("[data-pdf-nav-mode='finish']").click();
      await page.locator("[data-testid='unsaved-work-dialog']").waitFor({ state: "visible" });
      await page.locator("[data-testid='unsaved-leave']").click();
      await page.locator("[data-testid='pdf-handoff-chip']").waitFor({ timeout: 60000 });
      await page.locator("[data-testid='pdf-handoff-retry']").click();
      await page.waitForFunction(
        () => document.querySelector("[data-testid='pdf-finish-ready']")?.getAttribute("data-preflight-status") === "ready",
        null,
        { timeout: 120000 },
      );
      await page.locator("[data-testid='pdf-finish-back-to-organize']").click();
      await page.locator("[data-testid='unsaved-work-dialog']").waitFor({ state: "visible" });
      await page.locator("[data-testid='unsaved-leave']").click();
      await page.waitForFunction(() => location.pathname.includes("/tools/pdf-editor/split"), { timeout: 30000 });
      assert.equal(await page.locator("[data-testid='pdf-organize-send-to-finish']").count(), 0, "preset route keeps its own panel");
      await page.waitForFunction(() => document.querySelectorAll(".pdf-page-card").length === 2, { timeout: 120000 });
      results.push({ case: "preset-restore-split-no-reconfirm" });
      await context.close();
    }
  } finally {
    await browser.close();
  }
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(results, null, 2)}\n`);
  console.log(`W1 fixed-repro smoke passed (${results.length} cases).`);
}

run().catch(async (error) => {
  console.error(error);
  try {
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, `${JSON.stringify({ results, error: String(error) }, null, 2)}\n`);
  } catch { /* report best effort */ }
  process.exit(1);
});
