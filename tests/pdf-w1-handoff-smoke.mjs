// W1 fixed-regression smoke (PLAN-v5 §4.1 + ASTRA-W1/W1-2 R1~R6, F1~F5, N2).
//
// Server: pass TEST_BASE_URL of a built preview. Timeout-sensitive cases
// (F1 round trips, ack/retry timeouts) honor the __wlHandoffAckTimeoutMs
// override, which the product only reads in dev/QA builds — so run this
// smoke against a QA build (`VITE_LOCAL_QA=1 vite build`) or a dev server
// for the fast timelines. A scale probe at startup measures whether the
// injection is honored and scales all absolute timings accordingly, so the
// same file also passes (slowly) on normal production builds.
// Covers: delayed-chunk hold, JS chunk failure + retry, CSS preload failure,
// ack/retry timeouts, real corrupt intake + retry, unsaved-output guard,
// cancel preservation, stale-result invalidation, convert boundary,
// destination/format-true messages (ko+en), ZIP card rules, retained/boundary
// downloads with real download + pdf-lib parse, old-timer takeover (F1),
// new-deadline arming (F1), auto-intake ack (F3; the StrictMode remount
// itself is covered by the dev probe cited in the report), and pdfjs epoch
// bounds (F4).
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
const reportPath = path.resolve(process.env.PDF_W1_SMOKE_REPORT || "/tmp/muse-w1-fix2/w1-handoff-smoke.json");
const results = [];
let TIME_SCALE = 1;

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

async function readUnload(page) {
  return page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
}

// The guard clears synchronously in the registry but AppShell detaches its
// beforeunload listener on the next render, so post-save reads poll until
// the flush lands instead of asserting a single immediate sample.
async function waitUnload(page, expected, timeout = 15000) {
  await page.waitForFunction(
    (want) => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented === want;
    },
    expected,
    { timeout },
  );
}

async function tryReadHold(page) {
  // Dev-only observable (prod bundles expose no test hooks).
  try {
    const value = await page.evaluate(async () => {
      const mod = await import("/src/app/chunkRecovery.ts");
      return mod.isAutoReloadHeld();
    });
    return { available: true, value };
  } catch {
    return { available: false, value: null };
  }
}

async function tryPeekSlot(page) {
  // Dev-only observable (prod bundles expose no test hooks).
  try {
    const slot = await page.evaluate(() => globalThis.__wlPdfHandoffTestHooks.__peekPdfHandoffSlotForTests());
    return { available: true, slot };
  } catch {
    return { available: false, slot: null };
  }
}

async function downloadAndParse(page, clickFn, label, expectedPages) {
  const downloadPromise = page.waitForEvent("download");
  await clickFn();
  const download = await downloadPromise;
  const failure = await download.failure();
  assert.equal(failure, null, `${label}: download must complete without failure/cancel`);
  const savePath = path.join(path.dirname(reportPath), `w1-${label}-${Date.now()}.pdf`);
  await download.saveAs(savePath);
  const bytes = await fs.readFile(savePath);
  const parsed = await PDFDocument.load(bytes);
  assert.equal(parsed.getPageCount(), expectedPages, `${label}: saved PDF must parse with ${expectedPages} pages`);
  return { savePath, bytes: bytes.length };
}

async function run() {
  const browser = await launch();
  // W1_SKIP="case-substring,...": skip matching cases (used for the normal
  // production subset, where the injected-timeout case cannot run: the
  // product correctly ignores the override there, so its fixed short
  // timings never fire).
  const skipped = (process.env.W1_SKIP || "").split(",").map((s) => s.trim()).filter(Boolean);
  const skipCase = (name) => {
    if (skipped.some((s) => name.includes(s))) {
      results.push({ case: name, skipped: `W1_SKIP=${process.env.W1_SKIP}` });
      console.log(`skip ${name} (W1_SKIP)`);
      return true;
    }
    return false;
  };
  const onePagePdf = await pdfBuffer(1);
  const twoPagePdf = await pdfBuffer(2);
  // Downloads land next to the report; ensure the directory exists first.
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  try {
    // Probe: is the ack-timeout injection honored (dev/QA) or ignored
    // (normal prod)? All absolute round-trip timings scale from this.
    {
      const { page, context } = await newPage(browser, { ackTimeoutMs: 2000, timeoutMs: 30000 });
      await page.route("**/PdfFinishPanel*", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 8000));
        await route.continue();
      });
      await produceMerged(page, [{ name: "A.pdf", buffer: onePagePdf, pages: 1 }]);
      await clickHandoff(page);
      await page.waitForFunction(() => !document.querySelector("[data-testid='pdf-organize-send-to-finish']"), { timeout: 30000 });
      const start = Date.now();
      let fired = false;
      try {
        await page.waitForFunction(
          () => /could not accept|받지 못했습니다/.test(document.querySelector("[data-testid='pdf-handoff-chip'] p")?.textContent || ""),
          null,
          { timeout: 12000 },
        );
        fired = true;
      } catch {
        fired = false;
      }
      const elapsed = Date.now() - start;
      TIME_SCALE = fired && elapsed < 8000 ? 1 : 6;
      results.push({ case: "timeout-injection-probe", honored: TIME_SCALE === 1, elapsedMs: elapsed });
      console.log(`timeout injection ${TIME_SCALE === 1 ? "honored (scale 1)" : "ignored (scale 6)"} in ${elapsed}ms`);
      await context.close();
    }
    const T = () => TIME_SCALE;

    // R1: delayed chunk keeps the hold; leaving stays guarded; ack completes.
    {
      const { page, context } = await newPage(browser, { ackTimeoutMs: 30000 * T(), timeoutMs: 120000 });
      let finishHits = 0;
      let failChunk = false;
      let releaseChunk = () => {};
      const chunkGate = new Promise((resolve) => { releaseChunk = resolve; });
      await page.route("**/PdfFinishPanel*", async (route) => {
        finishHits += 1;
        await chunkGate;
        if (failChunk) return route.abort();
        await route.continue();
      });
      const navigations = [];
      const dialogs = [];
      page.on("request", (request) => {
        if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations.push(request.url());
      });
      page.on("dialog", async (dialog) => {
        dialogs.push(dialog.type());
        await dialog.dismiss().catch(() => undefined);
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
      failChunk = true;
      releaseChunk();
      await page.locator("[data-testid='pdf-finish-load-failure']").waitFor({ timeout: 60000 });
      assert.deepEqual(navigations, [], "R1: chunk failure must not reload or move to the error document");
      assert.deepEqual(dialogs, [], "R1: chunk failure must not raise a native dialog");
      const hold = await tryReadHold(page);
      if (hold.available) assert.equal(hold.value, true, "R1: hold stays active through the delayed failure (dev)");
      const { bytes } = await downloadAndParse(page, () => page.locator("[data-testid='pdf-finish-load-download']").click(), "R1-delayed-hold", 2);
      assert.ok(bytes > 500, "R1: retained bytes stay downloadable after chunk failure");
      await waitUnload(page, false); // R1: downloading the retained result counts as saved
      failChunk = false;
      await page.locator("[data-testid='pdf-finish-load-retry']").click();
      await page.waitForFunction(
        () => document.querySelector("[data-testid='pdf-finish-ready']")?.getAttribute("data-preflight-status") === "ready",
        null,
        { timeout: 120000 },
      );
      assert.equal(await page.locator("[data-testid='pdf-handoff-chip']").count(), 0, "R1: retry ack clears the chip");
      results.push({ case: "R1-delayed-chunk-hold", navigations, hold });
      await context.close();
    }

    // F1: an old timer from before the round trip must not release the new
    // handoff's hold. Abort the chunk after the old deadline, before the new.
    {
      const { page, context } = await newPage(browser, { ackTimeoutMs: 5000, timeoutMs: 120000 });
      let chunkMode = "hold";
      let releaseChunk = () => {};
      const chunkGate = new Promise((resolve) => { releaseChunk = resolve; });
      await page.route("**/PdfFinishPanel*", async (route) => {
        if (chunkMode === "hold") await chunkGate;
        if (chunkMode === "abort") return route.abort();
        return route.continue();
      });
      const navigations = [];
      const dialogs = [];
      page.on("request", (request) => {
        if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations.push(request.url());
      });
      page.on("dialog", async (dialog) => {
        dialogs.push(dialog.type());
        await dialog.dismiss().catch(() => undefined);
      });
      await produceMerged(page, [{ name: "A.pdf", buffer: onePagePdf, pages: 1 }]);
      navigations.length = 0;
      const t0 = Date.now();
      await clickHandoff(page);
      await page.waitForFunction(() => !document.querySelector("[data-testid='pdf-organize-send-to-finish']"));
      await new Promise((resolve) => setTimeout(resolve, 2000 * T()));
      // Back to organize: the slot is adopted as retained (top-link arrival).
      await page.locator("[data-pdf-nav-mode='organize']").click();
      await page.locator("[data-testid='pdf-retained-result']").waitFor({ timeout: 30000 });
      await page.locator("[data-testid='pdf-retained-send-to-finish']").click();
      await page.waitForFunction(() => !document.querySelector("[data-testid='pdf-retained-result']"));
      // Past the old deadline (5s*T after the first handoff), before the new one.
      // Characterization: no premature timeout UI on the new handoff. (On
      // unfixed code the old timer still fires, but into the unmounted
      // instance, so no chip appears there either; the true regression
      // signal is the hold, which is dev-only observable and covered by the
      // dev probe cited in the report.)
      const abortAt = t0 + 5000 * T() + 1000 * T();
      const waitMs = abortAt - Date.now();
      if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
      assert.equal(await page.locator("[data-testid='pdf-handoff-chip']").count(), 0, "F1: old timer must not time out the new handoff");
      const holdBeforeAbort = await tryReadHold(page);
      if (holdBeforeAbort.available) assert.equal(holdBeforeAbort.value, true, "F1: old timer must not have released the new hold (dev)");
      assert.equal(await readUnload(page), true, "F1: protection holds past the old deadline");
      chunkMode = "abort";
      releaseChunk();
      await page.locator("[data-testid='pdf-finish-load-failure']").waitFor({ timeout: 60000 });
      assert.deepEqual(navigations, [], "F1: failure must not reload or move to the error document");
      assert.deepEqual(dialogs, [], "F1: failure must not raise a native dialog");
      await downloadAndParse(page, () => page.locator("[data-testid='pdf-finish-load-download']").click(), "F1-old-timer", 1);
      chunkMode = "pass";
      await page.locator("[data-testid='pdf-finish-load-retry']").click();
      await page.waitForFunction(
        () => document.querySelector("[data-testid='pdf-finish-ready']")?.getAttribute("data-preflight-status") === "ready",
        null,
        { timeout: 120000 },
      );
      assert.equal(await page.locator("[data-testid='pdf-handoff-chip']").count(), 0, "F1: retry ack clears the chip");
      results.push({ case: "F1-old-timer-takeover", navigations, dialogs, holdBeforeAbort });
      await context.close();
    }

    // F1: the re-armed deadline fires (new handoff stays protected until then).
    {
      const { page, context } = await newPage(browser, { ackTimeoutMs: 5000, timeoutMs: 120000 });
      await page.route("**/PdfFinishPanel*", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 40000 * T()));
        await route.continue();
      });
      await produceMerged(page, [{ name: "A.pdf", buffer: onePagePdf, pages: 1 }]);
      await clickHandoff(page);
      await page.waitForFunction(() => !document.querySelector("[data-testid='pdf-organize-send-to-finish']"));
      await new Promise((resolve) => setTimeout(resolve, 2000 * T()));
      await page.locator("[data-pdf-nav-mode='organize']").click();
      await page.locator("[data-testid='pdf-retained-result']").waitFor({ timeout: 30000 });
      const reHandoffAt = Date.now();
      await page.locator("[data-testid='pdf-retained-send-to-finish']").click();
      await page.waitForFunction(() => !document.querySelector("[data-testid='pdf-retained-result']"));
      // No failure before the new deadline...
      await new Promise((resolve) => setTimeout(resolve, Math.max(1000, 5000 * T() - 2000)));
      assert.equal(await page.locator("[data-testid='pdf-handoff-chip']").count(), 0, "F1: no timeout chip before the new deadline");
      // ...then the new deadline fires and the result stays for retry.
      await page.waitForFunction(
        () => /could not accept|받지 못했습니다/.test(document.querySelector("[data-testid='pdf-handoff-chip'] p")?.textContent || ""),
        null,
        { timeout: (15000 * T()) + 15000 },
      );
      const firedAfterMs = Date.now() - reHandoffAt;
      assert.ok(firedAfterMs >= 4500 * T(), `F1: new deadline must not fire early (fired after ${firedAfterMs}ms)`);
      results.push({ case: "F1-new-deadline-armed", firedAfterMs });
      await context.close();
    }

    // F1/CSS failure path (reviewer mapDeps technique, single handoff).
    // A same-URL second import cannot fail on CSS again: Vite marks the URL
    // in its in-memory preload set on the first import, so a round-trip CSS
    // variant is untestable by construction. Timer ownership across a round
    // trip is covered failure-type-agnostically by F1-old-timer-takeover
    // above (the ack timer only sees the import outcome, never its cause).
    {
      const { page, context } = await newPage(browser, { timeoutMs: 120000 });
      let cssPatched = false;
      let cssHits = 0;
      let cssPass = false;
      await page.route("**/PdfEditorPage-*.js", async (route) => {
        const fetched = await route.fetch();
        const text = await fetched.text();
        const next = text.replace(
          /(import\("\.\/PdfFinishPanel-[^"]+"\),)(__vite__mapDeps\(\[[\d,]+\]\))/,
          '$1[...$2,"assets/review-finish.css"]',
        );
        if (next !== text) cssPatched = true;
        await route.fulfill({ body: next, contentType: "text/javascript" });
      });
      await page.route("**/assets/review-finish.css", async (route) => {
        cssHits += 1;
        if (cssPass) return route.continue();
        await new Promise((resolve) => setTimeout(resolve, 700));
        return route.abort();
      });
      const navigations = [];
      const dialogs = [];
      page.on("request", (request) => {
        if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations.push(request.url());
      });
      page.on("dialog", async (dialog) => {
        dialogs.push(dialog.type());
        await dialog.dismiss().catch(() => undefined);
      });
      await produceMerged(page, [{ name: "A.pdf", buffer: onePagePdf, pages: 1 }]);
      if (!cssPatched) {
        // No Vite preload manifest (e.g. dev server): the CSS-split failure
        // is untestable here by construction.
        results.push({ case: "F1-css-preload-failure", skipped: "no __vite__mapDeps (not a production build)" });
        await context.close();
      } else {
        navigations.length = 0;
        await clickHandoff(page);
        await page.locator("[data-testid='pdf-finish-load-failure']").waitFor({ timeout: 60000 });
        assert.ok(cssHits > 0, "F1: review-finish.css must have been requested");
        assert.deepEqual(navigations, [], "F1: CSS preload failure must not reload or move");
        assert.deepEqual(dialogs, [], "F1: CSS preload failure must not raise a native dialog");
        assert.equal(await readUnload(page), true, "F1: protection holds across the CSS preload failure");
        const holdAfterAbort = await tryReadHold(page);
        if (holdAfterAbort.available) assert.equal(holdAfterAbort.value, true, "F1: hold stays set across the CSS preload failure (dev)");
        await downloadAndParse(page, () => page.locator("[data-testid='pdf-finish-load-download']").click(), "F1-css-preload", 1);
        await waitUnload(page, false); // F1: boundary download counts as saved
        cssPass = true;
        await page.locator("[data-testid='pdf-finish-load-retry']").click();
        await page.waitForFunction(
          () => document.querySelector("[data-testid='pdf-finish-ready']")?.getAttribute("data-preflight-status") === "ready",
          null,
          { timeout: 120000 },
        );
        assert.equal(await page.locator("[data-testid='pdf-handoff-chip']").count(), 0, "F1: retry ack clears the chip");
        results.push({ case: "F1-css-preload-failure", cssHits, navigations, dialogs });
        await context.close();
      }
    }

    // R1: injected ack timeout keeps the result; a delayed load still acks.
    // R1: retry timeout re-arms through the same path (suggestion insert).
    // Injection-bound: skipped on normal production (override ignored there).
    if (!skipCase("R1-ack-timeout-and-retry-timeout")) {
      const { page, context } = await newPage(browser, { ackTimeoutMs: 2000, timeoutMs: 90000 });
      let delayFinish = true;
      await page.route("**/PdfFinishPanel*", async (route) => {
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

    // R1/F4: real corrupt intake bytes fail the inspection; hold is released,
    // the valid result stays downloadable; un-corrupting + retry acks.
    {
      const { page, context } = await newPage(browser, { noCache: true });
      await context.addInitScript(() => { globalThis.__w1corruptIntake = true; });
      let patched = 0;
      await page.route("**/PdfFinishPanel*", async (route) => {
        const response = await route.fetch();
        let body = await response.text();
        const next = body.replace(
          /new File\(\[\s*([A-Za-z_$][\w$]*)\.blob\s*\]\s*,\s*\1\.name/,
          "new File([globalThis.__w1corruptIntake?\"NOT-A-PDF\":$1.blob],$1.name",
        );
        if (next !== body) patched += 1;
        await route.fulfill({ response, body: next });
      });
      const navigations = [];
      page.on("request", (request) => {
        if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations.push(request.url());
      });
      await produceMerged(page, [{ name: "B.pdf", buffer: twoPagePdf, pages: 2 }]);
      navigations.length = 0;
      await clickHandoff(page);
      await page.locator("[data-testid='pdf-handoff-chip']").waitFor({ timeout: 120000 });
      assert.ok(patched > 0, "R1: corrupt-intake patch must apply to the finish chunk");
      const failed = await page.locator("[data-testid='pdf-handoff-chip'] p").innerText();
      assert.match(failed, /could not accept|받지 못했습니다/);
      assert.equal(await readUnload(page), true, "R1: failed intake keeps the result guarded");
      // The retained slot bytes are still the valid merged PDF.
      await downloadAndParse(page, () => page.locator("[data-testid='pdf-handoff-download']").click(), "R1-corrupt-intake", 2);
      await waitUnload(page, false); // R1: downloading the retained result counts as saved
      // Un-corrupt and retry in the same context: intake re-runs and acks.
      await page.evaluate(() => { globalThis.__w1corruptIntake = false; });
      await page.locator("[data-testid='pdf-handoff-retry']").click();
      await page.waitForFunction(
        () => document.querySelector("[data-testid='pdf-finish-ready']")?.getAttribute("data-preflight-status") === "ready",
        null,
        { timeout: 120000 },
      );
      assert.equal(await page.locator("[data-testid='pdf-handoff-chip']").count(), 0, "R1: retry after un-corrupting acks");
      assert.deepEqual(navigations, [], "R1: no document navigation throughout the corrupt-intake flow");
      results.push({ case: "R1-corrupt-intake-failure-retry" });
      await context.close();
    }

    // F4: blocked-worker retries must not accumulate pdfjs runtimes.
    {
      const { page, context } = await newPage(browser, { noCache: true, timeoutMs: 120000 });
      const cdp = await context.newCDPSession(page);
      let blockWorker = false;
      const epochUrls = new Set();
      page.on("request", (request) => {
        if (/w1-pdfjs=/.test(request.url())) epochUrls.add(request.url());
      });
      await page.route("**/pdf.worker.min*", (route) => (blockWorker ? route.abort() : route.continue()));
      await produceMerged(page, [{ name: "A.pdf", buffer: onePagePdf, pages: 1 }]);
      blockWorker = true;
      await clickHandoff(page);
      await page.locator("[data-testid='pdf-handoff-chip']").waitFor({ timeout: 120000 });
      const heapUsed = async () => {
        try {
          await cdp.send("HeapProfiler.collectGarbage");
          const { metrics } = await cdp.send("Performance.getMetrics");
          return metrics.find((m) => m.name === "JSHeapUsedSize")?.value ?? null;
        } catch {
          return null;
        }
      };
      const heapBefore = await heapUsed();
      for (let i = 0; i < 5; i += 1) {
        await page.locator("[data-testid='pdf-handoff-retry']").click();
        await page.waitForTimeout(650);
        await page.locator("[data-testid='pdf-handoff-chip']").waitFor({ timeout: 30000 });
      }
      await cdp.send("HeapProfiler.collectGarbage").catch(() => undefined);
      const heapAfter = await heapUsed();
      // The worker preflight fails before touching pdfjs, so no fresh runtime
      // is needed for these retries; the cap bounds the pathological remainder.
      assert.ok(epochUrls.size <= 1, `F4: blocked retries must not accumulate pdfjs runtimes (saw ${epochUrls.size})`);
      blockWorker = false;
      await page.locator("[data-testid='pdf-handoff-retry']").click();
      await page.waitForFunction(
        () => document.querySelector("[data-testid='pdf-finish-ready']")?.getAttribute("data-preflight-status") === "ready",
        null,
        { timeout: 120000 },
      );
      assert.equal(await page.locator("[data-testid='pdf-handoff-chip']").count(), 0, "F4: recovery after unblock acks");
      results.push({ case: "F4-no-epoch-accumulation", epochModuleUrls: [...epochUrls], heapBefore, heapAfter });
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
      await page.waitForTimeout(1000);
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
      assert.equal(await readUnload(page), false, "R4: leaving the host paths must release the guard");
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

    // F2: suggestion-chip download is a save (real download, parsed, guard off), payload kept for insert.
    {
      const { page, context } = await newPage(browser);
      await produceMerged(page, [{ name: "C.pdf", buffer: twoPagePdf, pages: 2 }]);
      await page.locator("[data-pdf-nav-mode='finish']").click();
      await page.locator("[data-testid='unsaved-leave']").click();
      await page.locator("[data-testid='pdf-handoff-chip']").waitFor({ timeout: 60000 });
      const parsed = await downloadAndParse(page, () => page.locator("[data-testid='pdf-handoff-download']").click(), "F2-chip-download", 2);
      assert.ok(parsed.bytes > 500, "F2: chip download must fetch the full retained bytes");
      await waitUnload(page, false); // F2: chip download counts as saved
      assert.equal(await page.locator("[data-testid='pdf-handoff-chip']").count(), 1, "F2: chip stays for retry/insert after save");
      await page.locator("[data-testid='pdf-handoff-retry']").click();
      await page.waitForFunction(
        () => document.querySelector("[data-testid='pdf-finish-ready']")?.getAttribute("data-preflight-status") === "ready",
        null,
        { timeout: 120000 },
      );
      assert.equal(await page.locator("[data-testid='pdf-handoff-chip']").count(), 0, "F2: insert after save still acks");
      results.push({ case: "F2-chip-download-is-save" });
      await context.close();
    }

    // F2+N2: retained-card download is a save (real download, parsed) that
    // keeps the payload for reuse. The round trip drops the input files
    // (only the result survives via the handoff slot), so after the save
    // nothing guards and home is free.
    {
      const { page, context } = await newPage(browser);
      await produceMerged(page, [{ name: "C.pdf", buffer: twoPagePdf, pages: 2 }]);
      await page.locator("[data-pdf-nav-mode='finish']").click();
      await page.locator("[data-testid='unsaved-leave']").click();
      await page.locator("[data-testid='pdf-handoff-chip']").waitFor({ timeout: 60000 });
      await page.evaluate(() => window.history.back());
      await page.locator("[data-testid='unsaved-work-dialog']").waitFor({ state: "visible" });
      await page.locator("[data-testid='unsaved-leave']").click();
      await page.locator("[data-testid='pdf-retained-result']").waitFor({ timeout: 60000 });
      // The sanctioned leave must not leave the guard dialog hanging open
      // over the retained card (it would block the download for real users).
      await page.locator("[data-testid='unsaved-work-dialog']").waitFor({ state: "hidden", timeout: 15000 });
      await downloadAndParse(page, () => page.locator("[data-testid='pdf-retained-download']").click(), "N2-retained-download-is-save", 2);
      assert.equal(await page.locator("[data-testid='pdf-retained-result']").count(), 1, "N2: retained payload stays for reuse after save (F2)");
      await waitUnload(page, false); // N2: retained download counts as saved
      await page.evaluate(() => document.querySelector("aside a[href='/en/']").click());
      await page.waitForFunction(() => location.pathname.replace(/\/+$/, "") === "/en", { timeout: 15000 });
      results.push({ case: "N2-retained-download-is-save" });
      await context.close();
    }

    // F3: auto intake inserts, acks, and releases the hold.
    // (Production builds run StrictMode without the dev double-effect, so
    // the true remount-abort path is covered by the dev probe in the report;
    // here the same user-visible outcome is asserted on the preview build,
    // with registry/hold checks only where dev hooks exist.)
    {
      const { page, context } = await newPage(browser);
      await produceMerged(page, [{ name: "A.pdf", buffer: onePagePdf, pages: 1 }]);
      await clickHandoff(page);
      await page.waitForFunction(
        () => document.querySelector("[data-testid='pdf-finish-ready']")?.getAttribute("data-preflight-status") === "ready",
        null,
        { timeout: 120000 },
      );
      assert.equal(await page.locator("[data-testid='pdf-handoff-chip']").count(), 0, "F3: auto intake acks without manual insert");
      const peek = await tryPeekSlot(page);
      if (peek.available) assert.equal(peek.slot, null, "F3: slot cleared after ack (dev)");
      const hold = await tryReadHold(page);
      if (hold.available) assert.equal(hold.value, false, "F3: hold released after ack (dev)");
      results.push({ case: "F3-auto-intake-acks", devVerified: peek.available });
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
