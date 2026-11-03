import { startOwnedPreview, stopOwnedPreview } from "./helpers/owned-preview.mjs";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PDF_FINISH_LIFECYCLE_PORT ?? "4184");
const baseUrl = `http://127.0.0.1:${port}`;
const reportPath = path.resolve(process.env.PDF_FINISH_LIFECYCLE_REPORT ?? "/tmp/worklazy-u4-8-fix1/lifecycle-smoke.json");
let server;
let browser;

try {
  server = await startDevServer();
  const document = await PDFDocument.create({ updateMetadata: false });
  document.addPage([400, 600]);
  const fixture = Buffer.from(await document.save({ updateFieldAppearances: false }));
  browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const results = [];
  const saveMessages = {
    en: "The result PDF could not be created. The file may be too large or memory may be low. Reduce the number of files or the page range and try again.",
    ko: "결과 PDF를 만들지 못했습니다. 파일이 크거나 메모리가 부족할 수 있습니다. 파일 수나 페이지 범위를 줄여 다시 시도해 주세요.",
  };
  const partialMessages = {
    en: "Results already completed can be downloaded below.",
    ko: "이미 완료된 결과는 아래에서 내려받을 수 있습니다.",
  };
  const processingMessages = {
    en: "A problem occurred while processing the PDF. Please try again.",
    ko: "PDF 처리 중 문제가 발생했습니다. 다시 시도해 주세요.",
  };
  const scenarios = [
    ...["navigate", "replace", "cancel"].map((action) => ({ action, language: "en", single: false })),
    ...["en", "ko"].flatMap((language) => [false, true].map((single) => ({ action: "save-error", language, single }))),
    ...["en", "ko"].flatMap((language) => [false, true].map((single) => ({ action: "processing-error", language, single }))),
    ...["en", "ko"].map((language) => ({ action: "zip-error", language, single: false })),
    { action: "zip-cancel", language: "en", single: false },
  ];
  for (const { action, language, single } of scenarios) {
    const context = await browser.newContext({ viewport: single ? { width: 390, height: 844 } : { width: 1280, height: 900 }, serviceWorkers: "block" });
    const page = await context.newPage();
    page.setDefaultTimeout(60_000);
    let replacements = 0;
    await context.route("**/src/features/pdf-editor/finish/engine.ts*", async (route) => {
      const response = await route.fetch();
      let body = await response.text();
      const boundary = 'report(input, "reading", fileIndex, input.files.length);';
      assert.ok(body.includes(boundary), "the lifecycle smoke no longer pauses at the second-file ownership boundary");
      body = body.replace(boundary, `if (fileIndex === 1 && globalThis.__finishLifecyclePause) await globalThis.__finishLifecyclePause();\n      ${boundary}`);
      if (action === "save-error") {
        const save = 'return await document.save({ updateFieldAppearances: false });';
        assert.ok(body.includes(save), "the lifecycle smoke no longer injects at the serialization boundary");
        body = body.replace(save, `if (++globalThis.__finishSaveCalls === ${single ? 1 : 2}) throw new RangeError("injected PDF serialization allocation failure");\n      ${save}`);
      }
      if (action === "processing-error") {
        const decorate = "await decorateDocument(input, analyzed.plans, analyzed.warnings, completed, total);";
        assert.ok(body.includes(decorate), "the lifecycle smoke no longer injects before decoration");
        body = body.replace(decorate, `if (fileIndex === ${single ? 0 : 1}) throw new RangeError("injected processing allocation failure");\n      ${decorate}`);
      }
      replacements += 1;
      await route.fulfill({ response, body });
    });
    if (action.startsWith("zip-")) {
      await context.route("**/src/utils/zipArchive.ts*", async (route) => {
        const response = await route.fetch();
        const body = await response.text();
        const boundary = "const zipWriter = createIncrementalZipArchiveWriter(writable, signal, options);";
        assert.ok(body.includes(boundary), "the lifecycle smoke no longer injects inside writeZipArchive");
        const failure = action === "zip-cancel" ? 'new DOMException("injected ZIP cancellation", "AbortError")' : 'new RangeError("injected ZIP allocation failure")';
        await route.fulfill({ response, body: body.replace(boundary, `globalThis.__finishZipInjected = true; throw ${failure};\n  ${boundary}`) });
      });
    }
    await context.addInitScript(() => {
      localStorage.setItem("worklazy_privacy_consent_v2", "granted");
      globalThis.__finishUrlEvents = [];
      globalThis.__finishSaveCalls = 0;
      globalThis.__finishLifecyclePause = () => new Promise((resolve) => {
        globalThis.__finishBatchPaused = true;
        globalThis.__finishReleaseBatch = resolve;
      });
      const createObjectURL = URL.createObjectURL;
      const revokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = function createTrackedObjectUrl(blob) {
        const url = createObjectURL.call(this, blob);
        globalThis.__finishUrlEvents.push({ action: "create", url, bytes: blob.size, type: blob.type });
        return url;
      };
      URL.revokeObjectURL = function revokeTrackedObjectUrl(url) {
        globalThis.__finishUrlEvents.push({ action: "revoke", url });
        return revokeObjectURL.call(this, url);
      };
    });

    await page.goto(`${baseUrl}/${language === "en" ? "en/" : ""}tools/pdf-editor/finish/`, { waitUntil: "networkidle" });
    await page.locator("[data-testid='pdf-finish-ready'] input[type='file']").setInputFiles([
      { name: "A.pdf", mimeType: "application/pdf", buffer: fixture },
      ...(single ? [] : [{ name: "B.pdf", mimeType: "application/pdf", buffer: fixture }]),
    ]);
    await page.waitForFunction(() => document.querySelector("[data-testid='pdf-finish-ready']")?.getAttribute("data-preflight-status") === "ready");
    await page.locator("[data-testid='pdf-finish-ready'] [data-ui-component='primary-button']").click();
    if (single) await page.locator("[data-testid='pdf-error']").waitFor({ state: "visible" });
    else await page.waitForFunction(() => globalThis.__finishBatchPaused === true);

    const before = await inspectPage(page);
    assert.equal(before.resultFiles.length, single ? 0 : 1, `${action}: the first completed output was not retained before the ownership transition`);
    if (action === "navigate") {
      await page.locator("[data-pdf-nav-mode='organize']").click();
      // W1: unsaved finish work must ask before leaving (pdf-finish guard).
      await page.locator("[data-testid='unsaved-work-dialog']").waitFor({ state: "visible" });
      await page.locator("[data-testid='unsaved-leave']").click();
      await page.locator("[data-testid='pdf-finish-ready']").waitFor({ state: "detached" });
    } else if (action === "replace") {
      await page.locator("[data-ui-component='file-list'] li").first().locator("button").click();
      await page.waitForFunction(() => document.querySelectorAll("[data-ui-component='file-list'] li").length === 1);
    } else if (action === "cancel") {
      await page.locator("[data-testid='pdf-finish-cancel']").click();
    }
    if (!single) await page.evaluate(() => globalThis.__finishReleaseBatch());
    await page.waitForTimeout(900);
    const after = await inspectPage(page);

    const failed = action.endsWith("-error") || action === "zip-cancel";
    const expectedCount = single ? 0 : action.startsWith("zip-") ? 2 : 1;
    const expectedMessage = action === "processing-error" ? processingMessages[language] : action === "zip-cancel" ? "The operation was canceled. Check the settings and start again." : saveMessages[language];
    if (action === "cancel" || failed) {
      let message;
      if (failed) {
        await page.locator("[data-testid='pdf-error']").waitFor({ state: "visible" });
        message = await page.locator("[data-testid='pdf-error'] span").innerText();
        assert.equal(message, expectedMessage);
        if (action.startsWith("zip-")) assert.equal(await page.evaluate(() => globalThis.__finishZipInjected), true);
        assert.equal(await page.locator("[data-testid='pdf-finish-partial-results']").count(), single ? 0 : 1);
        if (!single) assert.equal(await page.locator("[data-testid='pdf-finish-partial-results']").innerText(), partialMessages[language]);
        const capturePath = path.join(path.dirname(reportPath), `${action}-${language}-${single ? "single-mobile" : "batch-desktop"}.png`);
        await fs.mkdir(path.dirname(capturePath), { recursive: true });
        await page.screenshot({ path: capturePath, fullPage: true });
        assert.equal(await page.locator("[data-ui-component='operation-progress'].ui-status-error").count(), 1);
        assert.equal(await page.locator("[data-ui-component='operation-progress'].ui-status-success").count(), 0);
        if (!single) {
          for (let index = 0; index < expectedCount; index += 1) {
            const [download] = await Promise.all([
              page.waitForEvent("download"),
              page.locator("[data-testid='pdf-download']").nth(index).click(),
            ]);
            assert.equal(download.suggestedFilename(), `${index === 0 ? "A" : "B"}-${language === "en" ? "finished" : "마무리"}.pdf`);
            const saved = await fs.readFile(await download.path());
            assert.equal((await PDFDocument.load(saved)).getPageCount(), 1);
          }
        }
      }
      assert.equal(after.finishMounted, true, "partial result unexpectedly released the panel ownership");
      assert.equal(after.downloads, expectedCount, "partial result must preserve all completed PDFs without a failed ZIP");
      assert.equal(after.resultFiles.length, expectedCount, "partial result disposed a completed OPFS output");
      assert.equal(after.pdfUrls.length, expectedCount, "partial result did not register every completed PDF URL");
      assert.ok(after.pdfUrls.every(({ revoked }) => !revoked), "partial result revoked a visible PDF");
      await page.locator("[data-pdf-nav-mode='organize']").click();
      // Saved results do not block leaving; unsaved work would show the dialog.
      await page.waitForFunction(() => {
        if (!document.querySelector("[data-testid='pdf-finish-ready']")) return true;
        const dialog = document.querySelector("[data-testid='unsaved-work-dialog']");
        return !!dialog && dialog.open;
      });
      if (await page.locator("[data-testid='unsaved-work-dialog']").isVisible()) {
        await page.locator("[data-testid='unsaved-leave']").click();
      }
      await page.locator("[data-testid='pdf-finish-ready']").waitFor({ state: "detached" });
      await page.waitForTimeout(400);
      const afterLeave = await inspectPage(page);
      assert.deepEqual(afterLeave.resultFiles, [], "leaving after partial failure did not dispose the preserved OPFS output");
      assert.ok(afterLeave.pdfUrls.every(({ revoked }) => revoked), "leaving after partial failure did not revoke every PDF URL");
      results.push({ action, language, single, replacements, message, before, after, afterLeave });
    } else {
      assert.equal(after.downloads, 0, `${action}: an ownerless result reached the download UI`);
      assert.deepEqual(after.resultFiles, [], `${action}: an ownerless OPFS result was not disposed`);
      assert.equal(after.pdfUrls.length, 0, `${action}: an ownerless PDF Object URL was created`);
      results.push({ action, replacements, before, after });
    }
    assert.ok(replacements >= 1, `${action}: the engine pause injection was not applied`);
    await context.close();
  }

  for (const language of ["en", "ko"]) {
    const messages = results.filter((result) => result.action === "processing-error" && result.language === language).map(({ message }) => message);
    assert.deepEqual(messages, [processingMessages[language], processingMessages[language]], "the same unclassified failure must show the same message with and without results");
  }

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(results, null, 2)}\n`);
  console.log(`1..${results.length}`);
  console.log(`# tests ${results.length}`);
  results.forEach(({ action, language, single }, index) => console.log(`ok ${index + 1} - ${action} ${language ?? "en"} ${single ? "single" : "batch"}`));
  console.log("PDF finish ownership lifecycle passed: save/ZIP failures and cancellation preserve completed PDFs; unknown failures show the same neutral message with or without results.");
} finally {
  await browser?.close();
  await stopServer(server);
}

async function inspectPage(page) {
  return page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const files = [];
    async function walk(directory, prefix = "") {
      for await (const [name, entry] of directory.entries()) {
        if (entry.kind === "file") files.push(`${prefix}${name}`);
        else await walk(entry, `${prefix}${name}/`);
      }
    }
    await walk(root);
    const pdfUrls = globalThis.__finishUrlEvents
      .filter((event) => event.action === "create" && event.type === "application/pdf")
      .map((event) => ({
        ...event,
        revoked: globalThis.__finishUrlEvents.some((candidate) => candidate.action === "revoke" && candidate.url === event.url),
      }));
    return {
      finishMounted: !!document.querySelector("[data-testid='pdf-finish-ready']"),
      downloads: document.querySelectorAll("[data-testid='pdf-download']").length,
      resultFiles: files.filter((file) => /result-\d+\.pdf$/u.test(file)),
      pdfUrls,
    };
  });
}

async function startDevServer() {
  return startOwnedPreview({ repositoryRoot, port, mode: "dev", timeoutMs: 30_000, env: { VITE_LOCAL_QA: "1" } });
}

async function stopServer(child) {
  await stopOwnedPreview(child);
}
