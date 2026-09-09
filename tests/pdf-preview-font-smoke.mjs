import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { PDFDocument, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

// Run against a tracking-free Vite dev server. The fixture is generated from
// public font assets, never from a user's document.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:4275";
const output = process.env.PDF_PREVIEW_FONT_OUTPUT || "/tmp/worklazy-pdf-preview-font";
await fs.mkdir(output, { recursive: true });
const pdf = await PDFDocument.create({ updateMetadata: false });
pdf.registerFontkit(fontkit);
const korean = await pdf.embedFont(await fs.readFile(path.join(root, "public/vendor/qr-label-font/noto-cjk-sans-2.004/NotoSansKR-Regular.otf")), { subset: false });
const latin = await pdf.embedFont(StandardFonts.Helvetica);
const fixturePage = pdf.addPage([500, 400]);
fixturePage.drawText("한글미리보기검증가나다", { x: 30, y: 300, font: korean, size: 24 });
fixturePage.drawText("Embedded Korean 123", { x: 30, y: 250, font: latin, size: 18 });
fixturePage.drawText("Standard Latin 456", { x: 30, y: 200, font: latin, size: 18 });
const bytes = Buffer.from(await pdf.save()).toString("base64");
await fs.writeFile(path.join(output, "synthetic.pdf"), Buffer.from(bytes, "base64"));
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
try {
  const context = await browser.newContext({ serviceWorkers: "block", deviceScaleFactor: 1 });
  const blocked = [];
  await context.route("**/*", route => {
    if (["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname)) return route.continue();
    blocked.push(route.request().url());
    return route.abort();
  });
  await context.addInitScript(() => localStorage.setItem("worklazy_privacy_consent", "granted"));
  const page = await context.newPage();
  await page.goto(`${base}/ko/tools/pdf-editor/finish/`);
  await page.locator("[data-testid='pdf-finish-ready']").waitFor();
  let workerLoads = 0;
  let removeFontOwner = false;
  let missingFontApi = false;
  await context.route("**/pdfThumbnailRender.worker.ts*", async route => {
    workerLoads += 1;
    const response = await route.fetch();
    let body = await response.text();
    if (removeFontOwner) {
      const replaced = body.replace(/ownerDocument:\s*\{\s*fonts:\s*worker.fonts\s*\},/, "");
      assert.notEqual(replaced, body, "Negative control must remove the actual font binding");
      body = replaced;
    }
    if (missingFontApi) {
      const replaced = body.replace('!worker.fonts || typeof FontFace === "undefined"', "true");
      assert.notEqual(replaced, body, "Missing API control must activate the actual compatibility guard");
      body = replaced;
    }
    await route.fulfill({ response, body });
  });
  const render = async (mainThread = false) => page.evaluate(async ({ bytes, mainThread }) => {
    const preview = await import("/src/features/pdf-editor/pdfPreview.ts");
    const file = new File([Uint8Array.fromBase64(bytes)], "synthetic.pdf", { type: "application/pdf" });
    const canvas = document.createElement("canvas");
    const originalWorker = globalThis.Worker;
    globalThis.__previewWorkerResults = [];
    globalThis.Worker = class extends originalWorker {
      constructor(...args) {
        super(...args);
        if (String(args[0]).includes("pdfThumbnailRender.worker")) {
          this.addEventListener("message", event => { if (["result", "error"].includes(event.data.type)) globalThis.__previewWorkerResults.push(event.data.type); });
        }
      }
    };
    if (mainThread) globalThis.Worker = undefined;
    try {
      await preview.renderPdfThumbnail(file, 0, canvas, 500);
      const document = await preview.getPdfDocument(file);
      const text = (await (await document.getPage(1)).getTextContent()).items.map(item => item.str).join(" ");
      return { png: canvas.toDataURL("image/png"), text };
    } finally {
      globalThis.Worker = originalWorker;
      await preview.releasePdf(file);
    }
  }, { bytes, mainThread });
  const workerResult = await render();
  assert.deepEqual(await page.evaluate(() => globalThis.__previewWorkerResults), ["result"], "Worker must render successfully without falling back");
  assert.ok(workerLoads > 0, "Exercise the actual dedicated thumbnail worker");
  const mainResult = await render(true);
  assert.match(workerResult.text, /한글미리보기검증가나다/);
  assert.deepEqual(workerResult, mainResult, "Worker glyph pixels and text must match the browser main renderer");
  removeFontOwner = true;
  const mutant = await render();
  assert.notEqual(mutant.png, mainResult.png, "Missing font owner must be detected by the pixel oracle");
  assert.equal(mutant.text, mainResult.text, "ToUnicode alone must not pass a corrupt visual preview");
  removeFontOwner = false;
  missingFontApi = true;
  const compatibility = await render();
  assert.deepEqual(await page.evaluate(() => globalThis.__previewWorkerResults), ["error"]);
  assert.deepEqual(compatibility, mainResult, "Missing worker font API must use the healthy main renderer");
  missingFontApi = false;
  const cancellation = await page.evaluate(async bytes => {
    const preview = await import("/src/features/pdf-editor/pdfPreview.ts");
    const file = new File([Uint8Array.fromBase64(bytes)], "cancel.pdf");
    const originalWorker = globalThis.Worker;
    let terminated = 0;
    globalThis.Worker = class extends originalWorker {
      terminate() { terminated += 1; super.terminate(); }
    };
    const controller = new AbortController();
    try {
      const pending = preview.renderPdfThumbnail(file, 0, document.createElement("canvas"), 500, "ko", controller.signal);
      controller.abort();
      try { await pending; return { error: "completed", terminated }; }
      catch (error) { return { error: error.name, terminated }; }
    } finally { globalThis.Worker = originalWorker; await preview.releasePdf(file); }
  }, bytes);
  assert.equal(cancellation.error, "AbortError");
  assert.equal(cancellation.terminated, 1, "Cancellation must terminate its owned thumbnail worker");
  const retried = await render();
  assert.deepEqual(retried, workerResult, "Fresh worker must retain font binding after teardown/retry");
  for (const [name, result] of [["worker", workerResult], ["main", mainResult], ["missing-owner", mutant]]) {
    await fs.writeFile(path.join(output, `${name}.png`), Buffer.from(result.png.split(",")[1], "base64"));
  }
  assert.deepEqual(blocked, [], "No nonlocal request may be issued");
  const report = { workerLoads, identicalWorkerMainPixels: true, negativeControlDetected: true, missingFontApiFallback: true, cancellation, text: workerResult.text, blocked };
  await fs.writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
