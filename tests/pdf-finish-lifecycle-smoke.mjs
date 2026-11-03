import assert from "node:assert/strict";
import { spawn } from "node:child_process";
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
  for (const action of ["navigate", "replace", "cancel", "save-error"]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
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
        const save = 'let bytes = await document.save({ updateFieldAppearances: false });';
        assert.ok(body.includes(save), "the lifecycle smoke no longer injects at the serialization boundary");
        body = body.replace(save, `if (fileIndex === 1) throw new RangeError("injected PDF serialization allocation failure");\n      ${save}`);
      }
      replacements += 1;
      await route.fulfill({ response, body });
    });
    await context.addInitScript(() => {
      localStorage.setItem("worklazy_privacy_consent_v2", "granted");
      globalThis.__finishUrlEvents = [];
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

    await page.goto(`${baseUrl}/en/tools/pdf-editor/finish/`, { waitUntil: "networkidle" });
    await page.locator("[data-testid='pdf-finish-ready'] input[type='file']").setInputFiles([
      { name: "A.pdf", mimeType: "application/pdf", buffer: fixture },
      { name: "B.pdf", mimeType: "application/pdf", buffer: fixture },
    ]);
    await page.waitForFunction(() => document.querySelector("[data-testid='pdf-finish-ready']")?.getAttribute("data-preflight-status") === "ready");
    await page.locator("[data-testid='pdf-finish-ready'] [data-ui-component='primary-button']").click();
    await page.waitForFunction(() => globalThis.__finishBatchPaused === true);

    const before = await inspectPage(page);
    assert.equal(before.resultFiles.length, 1, `${action}: the first completed output was not retained before the ownership transition`);
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
    await page.evaluate(() => globalThis.__finishReleaseBatch());
    await page.waitForTimeout(900);
    const after = await inspectPage(page);

    if (action === "cancel" || action === "save-error") {
      if (action === "save-error") {
        await page.locator("[data-testid='pdf-error']").waitFor({ state: "visible" });
        assert.equal(await page.locator("[data-testid='pdf-error'] span").innerText(), "The PDF could not be read. Check the file and choose it again.");
        assert.equal(await page.locator("[data-ui-component='operation-progress'].ui-status-error").count(), 1);
        assert.equal(await page.locator("[data-ui-component='operation-progress'].ui-status-success").count(), 0);
        const [download] = await Promise.all([
          page.waitForEvent("download"),
          page.locator("[data-testid='pdf-download']").click(),
        ]);
        assert.equal(download.suggestedFilename(), "A-finished.pdf");
        const saved = await fs.readFile(await download.path());
        assert.equal((await PDFDocument.load(saved)).getPageCount(), 1);
      }
      assert.equal(after.finishMounted, true, "partial result unexpectedly released the panel ownership");
      assert.equal(after.downloads, 1, "partial result must preserve the completed output");
      assert.equal(after.resultFiles.length, 1, "partial result disposed the completed OPFS output");
      assert.equal(after.pdfUrls.length, 1, "partial result did not register the completed PDF URL");
      assert.equal(after.pdfUrls[0].revoked, false, "partial result revoked the visible partial result");
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
      assert.equal(afterLeave.pdfUrls[0]?.revoked, true, "leaving after partial failure did not revoke the visible PDF URL");
      results.push({ action, replacements, before, after, afterLeave });
    } else {
      assert.equal(after.downloads, 0, `${action}: an ownerless result reached the download UI`);
      assert.deepEqual(after.resultFiles, [], `${action}: an ownerless OPFS result was not disposed`);
      assert.equal(after.pdfUrls.length, 0, `${action}: an ownerless PDF Object URL was created`);
      results.push({ action, replacements, before, after });
    }
    assert.ok(replacements >= 1, `${action}: the engine pause injection was not applied`);
    await context.close();
  }

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(results, null, 2)}\n`);
  console.log("PDF finish ownership lifecycle passed: navigation and file replacement dispose ownerless outputs; cancellation and save failure preserve one downloadable completed output.");
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
  const viteBin = path.join(repositoryRoot, "node_modules/vite/bin/vite.js");
  const child = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: repositoryRoot,
    env: { ...process.env, BROWSER: "none", VITE_LOCAL_QA: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const append = (chunk) => { output += chunk.toString(); };
  child.stdout.on("data", append);
  child.stderr.on("data", append);
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Vite dev server exited early (${child.exitCode}): ${output}`);
    if (/Local:/u.test(output)) {
      const response = await fetch(baseUrl);
      if (response.ok) return child;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await stopServer(child);
  throw new Error(`Timed out waiting for the owned Vite dev server: ${output}`);
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}
