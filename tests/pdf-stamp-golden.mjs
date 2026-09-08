import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { createCanvas } from "@napi-rs/canvas";
import { PDFDocument, PDFName, PDFNumber, degrees } from "pdf-lib";
import { chromium } from "playwright";
import { PNG } from "pngjs";

import { finishPdfFiles } from "../src/features/pdf-editor/finish/engine.ts";
import { createPageSelection } from "../src/features/pdf-editor/finish/selection.ts";
import { applyNormalizedStamp, createNormalizedStamp, cssPointToViewport } from "../src/features/pdf-editor/finish/stamp.ts";

const execFileAsync = promisify(execFile);
const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");
const browserPort = Number(process.env.PDF_STAMP_TEST_PORT ?? "4184");
const baseUrl = process.env.TEST_BASE_URL || `http://127.0.0.1:${browserPort}`;
const artifactDirectory = path.resolve(process.env.PDF_STAMP_ARTIFACTS || "/tmp/worklazy-u4-5/golden");
if (!Number.isInteger(browserPort) || browserPort < 1 || browserPort > 65_535) throw new Error(`PDF_STAMP_TEST_PORT is invalid: ${process.env.PDF_STAMP_TEST_PORT}.`);
await fs.mkdir(artifactDirectory, { recursive: true });

const stamp = new PNG({ width: 160, height: 80 });
for (let index = 0; index < stamp.data.length; index += 4) {
  stamp.data[index] = 214;
  stamp.data[index + 1] = 26;
  stamp.data[index + 2] = 45;
  stamp.data[index + 3] = 255;
}
const stampBytes = PNG.sync.write(stamp);
const stampImage = new File([stampBytes], "golden-stamp.png", { type: "image/png" });
const placement = Object.freeze({ cx: 0.7, cy: 0.66, rw: 0.25, aspect: 2 });
const source = await createFixture();
const [output] = await finishPdfFiles({
  files: [{ key: "stamp-golden", file: source, selection: selectedPages(4, "1-4") }],
  options: finishOptions(placement),
  locale: "en-US",
});
const outputPath = path.join(artifactDirectory, "stamp-all-pages.pdf");
await fs.writeFile(outputPath, Buffer.from(output.buffer));

const pdfjsPages = await renderPdfJs(output.buffer.slice(0), "stamp-all-pages");
const popplerPages = await renderPoppler(outputPath, "stamp-all-pages", 4);
assert.equal(pdfjsPages.length, 4);
assert.equal(popplerPages.length, 4);

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const loadingTask = pdfjs.getDocument({ data: new Uint8Array(output.buffer) });
const comparisons = [];
try {
  const document = await loadingTask.promise;
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const expected = applyNormalizedStamp(placement, viewport);
    for (const renderer of ["pdfjs", "poppler"]) {
      const actual = (renderer === "pdfjs" ? pdfjsPages : popplerPages)[pageNumber - 1];
      const rendererExpected = applyNormalizedStamp(placement, { width: actual.canvasWidth, height: actual.canvasHeight });
      assertBox(actual, rendererExpected, `${renderer}/rotation-${(pageNumber - 1) * 90}`);
    }

    for (const dpr of [1, 2]) {
      for (const shrink of [1, 0.5]) {
        const cssRect = { left: 17, top: 23, width: viewport.width * shrink, height: viewport.height * shrink };
        const topLeft = cssPointToViewport({
          clientX: cssRect.left + expected.x * shrink,
          clientY: cssRect.top + expected.y * shrink,
          rect: cssRect,
          viewport,
        });
        const bottomRight = cssPointToViewport({
          clientX: cssRect.left + (expected.x + expected.width) * shrink,
          clientY: cssRect.top + (expected.y + expected.height) * shrink,
          rect: cssRect,
          viewport,
        });
        const recovered = createNormalizedStamp({
          x: topLeft.x,
          y: topLeft.y,
          width: bottomRight.x - topLeft.x,
          height: bottomRight.y - topLeft.y,
          viewportWidth: viewport.width,
          viewportHeight: viewport.height,
          aspect: 2,
        });
        assertModel(recovered, placement, `rotation=${(pageNumber - 1) * 90},dpr=${dpr},shrink=${shrink}`);

        const bitmapViewport = page.getViewport({ scale: dpr });
        const cssPdf = viewport.convertToPdfPoint(topLeft.x, topLeft.y);
        const bitmapPdf = bitmapViewport.convertToPdfPoint(topLeft.x * dpr, topLeft.y * dpr);
        assertPoint(bitmapPdf, cssPdf, `DPR conversion rotation=${(pageNumber - 1) * 90},dpr=${dpr},shrink=${shrink}`);
        assertBox(pdfjsPages[pageNumber - 1], applyNormalizedStamp(recovered, viewport), `rendered rotation=${(pageNumber - 1) * 90},dpr=${dpr},shrink=${shrink}`);
        comparisons.push({ pageNumber, rotation: (pageNumber - 1) * 90, dpr, shrink, viewport: { width: viewport.width, height: viewport.height }, expected, pdfjs: pdfjsPages[pageNumber - 1], poppler: popplerPages[pageNumber - 1] });
      }
    }
  }
} finally {
  await loadingTask.destroy();
}
assert.equal(comparisons.length, 16);

const [selectedOutput] = await finishPdfFiles({
  files: [{ key: "stamp-selected", file: source, selection: selectedPages(4, "1,3") }],
  options: finishOptions(placement),
  locale: "en-US",
});
const selectedPath = path.join(artifactDirectory, "stamp-selected-pages.pdf");
await fs.writeFile(selectedPath, Buffer.from(selectedOutput.buffer));
const selectedPixels = await renderPdfJs(selectedOutput.buffer, "stamp-selected-pages");
assert.deepEqual(selectedPixels.map(({ count }) => count > 0), [true, false, true, false], "stamp must appear only on selected pages");

const browserComparisons = await runBrowserPreviewGolden(await createBrowserFixture(), stampBytes);
await fs.writeFile(path.join(artifactDirectory, "metrics.json"), `${JSON.stringify({ combinations: comparisons, selectedPages: selectedPixels, browserComparisons }, null, 2)}\n`);
console.log(`PDF stamp golden passed: 16 coordinate-model combinations, 16 actual browser-preview/output pixel combinations, 8 PDF.js/Poppler rendered pages, and selected-page placement. Artifacts: ${artifactDirectory}`);

function selectedPages(totalPages, range) {
  const result = createPageSelection(totalPages, range, "all", { startPage: 1, excludeCover: false });
  assert.ok(!("error" in result));
  return result;
}

function finishOptions(stampPlacement) {
  return {
    template: "",
    region: "center",
    fontSize: 10,
    color: "#111111",
    margin: 0,
    startNumber: 1,
    startPage: 1,
    excludeCover: false,
    stamp: { image: stampImage, placement: stampPlacement },
  };
}

async function createFixture() {
  const document = await PDFDocument.create({ updateMetadata: false });
  const crops = [
    { x: 20, y: 25, width: 200, height: 180, unit: 1 },
    { x: 25, y: 30, width: 190, height: 170, unit: 1.25 },
    { x: 30, y: 35, width: 180, height: 160, unit: 1.5 },
    { x: 35, y: 40, width: 170, height: 150, unit: 2 },
  ];
  for (const [index, crop] of crops.entries()) {
    const page = document.addPage([260, 240]);
    page.setCropBox(crop.x, crop.y, crop.width, crop.height);
    page.setRotation(degrees(index * 90));
    page.node.set(PDFName.of("UserUnit"), PDFNumber.of(crop.unit));
  }
  return new File([await document.save()], "stamp-rotated-crop-user-unit.pdf", { type: "application/pdf" });
}

async function createBrowserFixture() {
  const document = await PDFDocument.create({ updateMetadata: false });
  const specifications = [
    { width: 400, height: 600, crop: [20, 35, 350, 510], userUnit: 1 },
    { width: 800, height: 500, crop: [45, 30, 680, 410], userUnit: 1.25 },
    { width: 600, height: 400, crop: [30, 25, 520, 330], userUnit: 1.5 },
    { width: 500, height: 800, crop: [40, 55, 400, 680], userUnit: 2 },
  ];
  for (const [index, specification] of specifications.entries()) {
    const page = document.addPage([specification.width, specification.height]);
    page.setCropBox(...specification.crop);
    page.setRotation(degrees(index * 90));
    page.node.set(PDFName.of("UserUnit"), PDFNumber.of(specification.userUnit));
  }
  return { bytes: Buffer.from(await document.save()), specifications };
}

async function runBrowserPreviewGolden(sourceFixture, imageBytes) {
  let server;
  let browser;
  const rows = [];
  try {
    if (!process.env.TEST_BASE_URL) server = await startPreview();
    browser = await chromium.launch({
      executablePath: process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome",
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    for (const dpr of [1, 2]) {
      for (const shrink of [1, 0.5]) {
        const context = await browser.newContext({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: dpr, locale: "en-US", serviceWorkers: "block" });
        await context.addInitScript(() => localStorage.setItem("worklazy_privacy_consent", "denied"));
        const page = await context.newPage();
        page.setDefaultTimeout(60_000);
        await page.goto(`${baseUrl}/en/tools/pdf-editor/stamp/`, { waitUntil: "networkidle" });
        await page.locator("input[accept*='application/pdf']").setInputFiles({ name: "mixed-crop.pdf", mimeType: "application/pdf", buffer: sourceFixture.bytes });
        await page.locator("[data-testid='pdf-stamp-image']").setInputFiles({ name: "golden-stamp.png", mimeType: "image/png", buffer: imageBytes });
        await waitForStampReady(page);
        await page.addStyleTag({ content: `[data-testid="pdf-finish-canvas-area"]{width:${520 * shrink}px!important;}` });

        const area = page.locator("[data-testid='pdf-finish-canvas-area']");
        const overlay = page.locator("[data-testid='pdf-stamp-overlay']");
        for (let pageNumber = 1; pageNumber <= 4; pageNumber += 1) {
          await page.locator("[data-testid='pdf-finish-range']").fill(String(pageNumber));
          await waitForStampReady(page);
          await overlay.waitFor();
          await area.scrollIntoViewIfNeeded();
          await page.waitForTimeout(150);

          const original = await readBrowserPlacement(overlay);
          const overlayBox = await overlay.boundingBox();
          const areaBox = await area.boundingBox();
          assert.ok(overlayBox && areaBox, "actual stamp preview geometry is missing");
          await page.mouse.move(overlayBox.x + overlayBox.width / 2, overlayBox.y + overlayBox.height / 2);
          await page.mouse.down();
          await page.mouse.move(overlayBox.x + overlayBox.width / 2 - areaBox.width * 0.04, overlayBox.y + overlayBox.height / 2 - areaBox.height * 0.03, { steps: 4 });
          await page.mouse.up();
          const moved = await readBrowserPlacement(overlay);
          assert.ok(Math.abs(original.cx - 0.04 - moved.cx) < 0.006 && Math.abs(original.cy - 0.03 - moved.cy) < 0.006, "actual pointer movement changed normalized coordinates");

          const resizeHandle = page.locator("[data-testid='pdf-stamp-resize-handle']");
          const handleBox = await resizeHandle.boundingBox();
          assert.ok(handleBox, "actual stamp resize handle is missing");
          await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
          await page.mouse.down();
          await page.mouse.move(handleBox.x + handleBox.width / 2 + areaBox.width * 0.04, handleBox.y + handleBox.height / 2, { steps: 3 });
          await page.mouse.up();
          await waitForStampReady(page);
          const adjusted = await readBrowserPlacement(overlay);
          assert.ok(adjusted.rw > moved.rw, "actual pointer resize did not increase the stamp width");

          const id = `dpr-${dpr}-shrink-${shrink}-rotation-${(pageNumber - 1) * 90}`;
          const previewBytes = await area.screenshot({ path: path.join(artifactDirectory, `${id}-preview.png`), scale: "device" });
          const previewImage = PNG.sync.read(previewBytes);
          const preview = redBox(previewImage);
          const css = await area.boundingBox();
          assert.ok(css, "actual preview canvas area is missing");
          const dom = await overlay.evaluate((node) => {
            const overlayRect = node.getBoundingClientRect();
            const areaRect = node.parentElement.getBoundingClientRect();
            const imageRect = node.querySelector("img").getBoundingClientRect();
            const style = getComputedStyle(node);
            const canvas = node.parentElement.querySelector("canvas");
            return {
              x: overlayRect.x - areaRect.x,
              y: overlayRect.y - areaRect.y,
              width: overlayRect.width,
              height: overlayRect.height,
              borderWidth: style.borderWidth,
              outlineWidth: style.outlineWidth,
              image: { x: imageRect.x - areaRect.x, y: imageRect.y - areaRect.y, width: imageRect.width, height: imageRect.height },
              canvas: { width: canvas.width, height: canvas.height },
            };
          });
          assert.equal(dom.borderWidth, "0px", "the selection indicator must not consume the stamp model box");
          assert.ok(Number.parseFloat(dom.outlineWidth) >= 2, "the visible selection outline is missing");
          assert.ok(Math.abs(dom.image.x - dom.x) < 0.1 && Math.abs(dom.image.y - dom.y) < 0.1
            && Math.abs(dom.image.width - dom.width) < 0.1 && Math.abs(dom.image.height - dom.height) < 0.1,
          `the preview image does not occupy the complete model box: ${JSON.stringify(dom)}`);

          await page.locator("[data-testid='pdf-finish-ready'] [data-ui-component='primary-button']").click();
          const download = page.locator("[data-testid='pdf-download']");
          await download.waitFor();
          const outputBytes = Buffer.from(await download.evaluate(async (link) => Array.from(new Uint8Array(await (await fetch(link.href)).arrayBuffer()))));
          await fs.writeFile(path.join(artifactDirectory, `${id}.pdf`), outputBytes);
          const output = await renderDownloadedStampPage(outputBytes, pageNumber, css.width * dpr, previewImage.width, previewImage.height, id);
          assert.ok(preview.count > 100 && output.count > 100, `${id} lost actual stamp pixels`);
          const differencesCssPx = Object.fromEntries(["x", "y", "width", "height"].map((key) => [key, (preview[key] - output[key]) / dpr]));
          const maxAbsCssPx = Math.max(...Object.values(differencesCssPx).map(Math.abs));
          assert.ok(maxAbsCssPx <= 2, `${id} actual preview pixels differ from output by more than 2 CSS px: ${JSON.stringify(differencesCssPx)}`);
          const browserDpr = await page.evaluate(() => devicePixelRatio);
          assert.equal(browserDpr, dpr, `${id} did not use the requested devicePixelRatio`);
          rows.push({ id, dpr, shrink, rotation: (pageNumber - 1) * 90, pageNumber, specification: sourceFixture.specifications[pageNumber - 1], placement: adjusted, css, dom, preview, output, differencesCssPx, maxAbsCssPx, browserDpr });
        }
        await context.close();
      }
    }
  } finally {
    await browser?.close();
    if (server) await stopServer(server);
  }
  assert.equal(rows.length, 16, "actual browser preview golden did not cover all DPR/CSS-shrink/rotation combinations");
  return rows;
}

async function readBrowserPlacement(overlay) {
  return overlay.evaluate((node) => Object.fromEntries(["cx", "cy", "rw", "aspect"].map((key) => [key, Number(node.getAttribute(`data-stamp-${key}`))])));
}

async function waitForStampReady(page) {
  await page.waitForFunction(() => {
    const panel = document.querySelector("[data-testid='pdf-finish-ready']");
    return panel?.getAttribute("data-preflight-status") === "ready"
      && panel.querySelector("[data-testid='pdf-finish-preview']")?.getAttribute("data-preview-status") === "ready";
  });
}

async function renderDownloadedStampPage(bytes, pageNumber, renderedWidth, canvasWidth, canvasHeight, id) {
  const library = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = library.getDocument({ data: new Uint8Array(bytes) });
  try {
    const document = await task.promise;
    const page = await document.getPage(pageNumber);
    const unitViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: renderedWidth / unitViewport.width });
    const canvas = createCanvas(canvasWidth, canvasHeight);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    const imageBytes = canvas.toBuffer("image/png");
    await fs.writeFile(path.join(artifactDirectory, `${id}-output.png`), imageBytes);
    return redBox(PNG.sync.read(imageBytes));
  } finally {
    await task.destroy();
  }
}

async function renderPdfJs(buffer, id) {
  const library = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = library.getDocument({ data: new Uint8Array(buffer) });
  try {
    const document = await task.promise;
    const results = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      const bytes = canvas.toBuffer("image/png");
      await fs.writeFile(path.join(artifactDirectory, `${id}-pdfjs-${pageNumber}.png`), bytes);
      results.push(redBox(PNG.sync.read(bytes)));
    }
    return results;
  } finally {
    await task.destroy();
  }
}

async function renderPoppler(pdfPath, id, pageCount) {
  const prefix = path.join(artifactDirectory, `${id}-poppler`);
  await execFileAsync("pdftoppm", ["-cropbox", "-r", "72", "-png", pdfPath, prefix]);
  const results = [];
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    results.push(redBox(PNG.sync.read(await fs.readFile(`${prefix}-${pageNumber}.png`))));
  }
  return results;
}

function redBox(image) {
  let count = 0;
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = (y * image.width + x) * 4;
      if (image.data[offset] <= 160 || image.data[offset + 1] >= 105 || image.data[offset + 2] >= 110) continue;
      count += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { canvasWidth: image.width, canvasHeight: image.height, count, x: count ? minX : null, y: count ? minY : null, width: count ? maxX - minX + 1 : 0, height: count ? maxY - minY + 1 : 0 };
}

function assertBox(actual, expected, label) {
  assert.ok(actual.count > 100, `${label} lost the stamp: ${JSON.stringify(actual)}`);
  for (const [name, observed, target] of [
    ["x", actual.x, expected.x],
    ["y", actual.y, expected.y],
    ["width", actual.width, expected.width],
    ["height", actual.height, expected.height],
  ]) assert.ok(Math.abs(observed - target) <= 2, `${label} ${name} differs: ${JSON.stringify({ observed, target, actual, expected })}`);
  assert.ok(Math.abs(actual.width / actual.height - expected.width / expected.height) < 0.14, `${label} changed the fixed aspect ratio`);
}

function assertModel(actual, expected, label) {
  for (const key of ["cx", "cy", "rw", "aspect"]) assert.ok(Math.abs(actual[key] - expected[key]) < 1e-9, `${label} changed ${key}: ${actual[key]} vs ${expected[key]}`);
}

function assertPoint(actual, expected, label) {
  assert.ok(Math.abs(actual[0] - expected[0]) < 1e-8 && Math.abs(actual[1] - expected[1]) < 1e-8, `${label} double-corrected scale: ${JSON.stringify({ actual, expected })}`);
}

async function startPreview() {
  const viteBin = path.join(repositoryRoot, "node_modules", "vite", "bin", "vite.js");
  const child = spawn(process.execPath, [viteBin, "preview", "--host", "127.0.0.1", "--port", String(browserPort), "--strictPort"], {
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
