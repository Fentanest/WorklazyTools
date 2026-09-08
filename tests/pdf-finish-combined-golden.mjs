import assert from "node:assert/strict";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createCanvas } from "@napi-rs/canvas";
import { chromium } from "playwright";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, StandardFonts, decodePDFRawStream, rgb } from "pdf-lib";
import { PNG } from "pngjs";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactDirectory = path.resolve(process.env.PDF_COMBINED_ARTIFACTS || "/tmp/worklazy-u4-8/combined-golden");
const specification = JSON.parse(await fs.readFile(path.join(root, "tests/fixtures/pdf-finish-combined-golden.json"), "utf8"));
const axes = {
  cleanup: ["remove", "preserve"],
  form: ["flatten", "preserve"],
  watermark: ["image", "text"],
  layer: ["background", "foreground"],
  text: ["number-header", "number"],
  stamp: ["on", "off"],
  raster: ["on", "off"],
};
assert.deepEqual(specification.axes, axes, "combined golden axes changed without an explicit contract update");
assertPairwiseCoverage(specification.combinations);
assert.deepEqual(specification.combinations[0], {
  id: "pair-1",
  cleanup: "remove",
  form: "flatten",
  watermark: "image",
  layer: "background",
  text: "number-header",
  stamp: "on",
  raster: "on",
}, "the required structure + decoration + final raster case must remain explicit");

await fs.mkdir(artifactDirectory, { recursive: true });
const sourceBytes = await createSourcePdf();
const imageBytes = createImageBytes();
const server = await startModuleServer();
let browser;
const summary = [];
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.goto(server.url, { waitUntil: "networkidle" });
  for (const testCase of specification.combinations) {
    const result = await createOutput(page, testCase, sourceBytes, imageBytes);
    const audited = await auditOutput(result, testCase);
    summary.push({ id: testCase.id, axes: testCase, ...audited });
    await fs.writeFile(path.join(artifactDirectory, `${testCase.id}-pre-raster.pdf`), result.preRaster);
    await fs.writeFile(path.join(artifactDirectory, `${testCase.id}.pdf`), result.final);
  }
} finally {
  await browser?.close();
  await server.close();
}

await fs.writeFile(path.join(artifactDirectory, "summary.json"), `${JSON.stringify({ axes, combinations: summary }, null, 2)}\n`);
console.log(`PDF finish combined golden passed: ${specification.combinations.length} actual pairwise outputs across ${Object.keys(axes).length} declared axes; ${summary.filter(({ finalRaster }) => finalRaster).length} include final raster. Artifacts: ${artifactDirectory}`);

function assertPairwiseCoverage(cases) {
  assert.equal(cases.length, 8, "the seven binary axes use an eight-row pairwise covering array");
  const names = Object.keys(axes);
  for (const [index, left] of names.entries()) {
    for (const right of names.slice(index + 1)) {
      const observed = new Map();
      for (const testCase of cases) {
        assert.ok(axes[left].includes(testCase[left]), `${testCase.id}: invalid ${left} value`);
        assert.ok(axes[right].includes(testCase[right]), `${testCase.id}: invalid ${right} value`);
        const pair = `${testCase[left]}|${testCase[right]}`;
        observed.set(pair, (observed.get(pair) ?? 0) + 1);
      }
      const expected = axes[left].flatMap((leftValue) => axes[right].map((rightValue) => `${leftValue}|${rightValue}`)).sort();
      assert.deepEqual([...observed.keys()].sort(), expected, `${left}/${right}: missing pairwise interaction`);
      assert.ok([...observed.values()].every((count) => count === 2), `${left}/${right}: the orthogonal pair count changed`);
    }
  }
}

async function createSourcePdf() {
  const document = await PDFDocument.create({ updateMetadata: false });
  document.setTitle("COMBINED-REMOVE-ME");
  await document.attach(new TextEncoder().encode("COMBINED-ATTACHMENT-REMOVE-ME"), "combined.txt", { mimeType: "text/plain" });
  const page = document.addPage([400, 600]);
  page.drawRectangle({ x: 32, y: 54, width: 336, height: 492, color: rgb(0.08, 0.2, 0.78) });
  const font = await document.embedFont(StandardFonts.Helvetica);
  const form = document.getForm();
  const field = form.createTextField("combined-field");
  field.setText("FORM-A");
  field.addToPage(page, { x: 148, y: 286, width: 104, height: 28, borderWidth: 0, font });
  form.updateFieldAppearances(font);
  return new Uint8Array(await document.save({ updateFieldAppearances: false }));
}

function createImageBytes() {
  const image = new PNG({ width: 40, height: 20 });
  for (let offset = 0; offset < image.data.length; offset += 4) {
    image.data[offset] = 225;
    image.data[offset + 1] = 28;
    image.data[offset + 2] = 42;
    image.data[offset + 3] = 255;
  }
  return PNG.sync.write(image);
}

async function startModuleServer() {
  const hostPath = "/__pdf_finish_combined_golden__";
  const port = await availablePort();
  const vite = await createServer({
    root,
    configFile: false,
    logLevel: "error",
    resolve: { alias: { "@": path.join(root, "src") } },
    server: { host: "127.0.0.1", port, strictPort: true },
    plugins: [{
      name: "pdf-finish-combined-golden-host",
      configureServer(devServer) {
        devServer.middlewares.use((request, response, next) => {
          if (request.url !== hostPath) return next();
          response.statusCode = 200;
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end("<!doctype html><html><body>PDF combined golden</body></html>");
        });
      },
    }],
  });
  await vite.listen();
  const address = vite.httpServer?.address();
  assert.ok(address && typeof address === "object", "Vite did not expose the combined golden port");
  return { url: `http://127.0.0.1:${address.port}${hostPath}`, close: () => vite.close() };
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      assert.ok(address && typeof address === "object");
      probe.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

async function createOutput(page, testCase, source, image) {
  const serialized = await page.evaluate(async ({ testCase: inputCase, sourceBytes, imageBytes }) => {
    const [{ finishPdfFiles }, { createPageSelection }, { validateWatermarkResult }] = await Promise.all([
      import("/src/features/pdf-editor/finish/engine.ts"),
      import("/src/features/pdf-editor/finish/selection.ts"),
      import("/src/features/pdf-editor/finish/watermark.ts"),
    ]);
    const selection = createPageSelection(1, "1", "all", { startPage: 1, excludeCover: false });
    if ("error" in selection) throw new Error(selection.error);
    const sourceFile = new File([Uint8Array.from(sourceBytes)], "combined-source.pdf", { type: "application/pdf" });
    const decorationImage = new File([Uint8Array.from(imageBytes)], "combined.png", { type: "image/png" });
    const textOption = (template, region) => ({ template, region, fontSize: 10, color: "#202024", margin: 18, startNumber: 1, startPage: 1, excludeCover: false, opacity: 0.9 });
    let preRaster;
    const [output] = await finishPdfFiles({
      files: [{ key: inputCase.id, file: sourceFile, selection }],
      options: {
        ...textOption("WATERMARK-A", "center"),
        textDecorations: [
          textOption("PAGE-{page}", "bottom-center"),
          ...(inputCase.text === "number-header" ? [textOption("HEADER-A", "top-center")] : []),
        ],
        watermark: {
          content: inputCase.watermark,
          image: inputCase.watermark === "image" ? decorationImage : undefined,
          layer: inputCase.layer,
          pattern: "single",
          region: "center",
          rotation: -20,
          opacity: 0.55,
          sizePercent: 45,
          gap: 20,
          offsetX: 0,
          offsetY: 0,
        },
        stamp: inputCase.stamp === "on" ? { image: decorationImage, placement: { cx: 0.8, cy: 0.78, rw: 0.18, aspect: 2 } } : undefined,
        structure: {
          removeMetadata: inputCase.cleanup === "remove",
          removeAnnotations: false,
          removeAttachments: inputCase.cleanup === "remove",
          formMode: inputCase.form,
        },
        raster: { enabled: inputCase.raster === "on", dpi: 150, format: "png" },
      },
      locale: "en-US",
      allowRiskyDocuments: true,
      clock: () => new Date("2026-09-09T00:00:00.000Z"),
      validateWatermarkOutput: async (bytes, ...argumentsAfterBytes) => {
        preRaster = bytes.slice();
        await validateWatermarkResult(bytes, ...argumentsAfterBytes);
      },
      resultStore: {
        mode: "memory",
        retainedBytes: 0,
        store: async (bytes, fileName) => ({
          mode: "memory",
          blob: new Blob([bytes], { type: "application/pdf" }),
          fileName,
          dispose: async () => undefined,
        }),
        dispose: async () => undefined,
      },
    });
    if (!preRaster) throw new Error("the actual pre-raster output was not captured");
    const final = new Uint8Array(await output.blob.arrayBuffer());
    await output.dispose();
    return { preRaster: Array.from(preRaster), final: Array.from(final) };
  }, { testCase, sourceBytes: Array.from(source), imageBytes: Array.from(image) });
  return { preRaster: Uint8Array.from(serialized.preRaster), final: Uint8Array.from(serialized.final) };
}

async function auditOutput(result, testCase) {
  const vector = await PDFDocument.load(result.preRaster, { updateMetadata: false });
  const page = vector.getPage(0);
  const order = contentOrder(vector, page);
  const expectedOrder = [
    ...(testCase.layer === "background" ? ["watermark"] : []),
    "original",
    ...(testCase.form === "flatten" ? ["form"] : []),
    ...(testCase.layer === "foreground" ? ["watermark"] : []),
    "text",
    ...(testCase.stamp === "on" ? ["stamp"] : []),
  ];
  assert.deepEqual(order, expectedOrder, `${testCase.id}: canonical structure/decorations call order changed`);

  const structure = inspectStructure(vector);
  assert.equal(structure.hasTitle, testCase.cleanup === "preserve", `${testCase.id}: metadata cleanup did not follow the selected structure axis`);
  assert.equal(structure.embeddedFiles, testCase.cleanup === "preserve" ? 1 : 0, `${testCase.id}: attachment cleanup did not follow the selected structure axis`);
  assert.equal(structure.hasAcroForm, testCase.form === "preserve", `${testCase.id}: AcroForm residue did not follow the selected form axis`);
  assert.equal(structure.widgets, testCase.form === "preserve" ? 1 : 0, `${testCase.id}: Widget residue did not follow the selected form axis`);
  assert.equal(order.includes("form"), testCase.form === "flatten", `${testCase.id}: the flattened form appearance call is missing`);

  const extracted = await extractText(result.preRaster);
  assert.ok(extracted.includes("PAGE-1"), `${testCase.id}: missing page-number decoration`);
  assert.equal(extracted.includes("HEADER-A"), testCase.text === "number-header", `${testCase.id}: header decoration axis changed`);
  assert.equal(extracted.includes("WATERMARK-A"), testCase.watermark === "text", `${testCase.id}: watermark content axis changed`);

  if (testCase.raster === "off") {
    assert.deepEqual(result.final, result.preRaster, `${testCase.id}: a non-raster case changed after output validation`);
    return { order, structure, extracted, finalRaster: false };
  }

  const finalDocument = await PDFDocument.load(result.final, { updateMetadata: false });
  const finalPage = finalDocument.getPage(0);
  const resources = finalDocument.context.lookup(finalPage.node.get(PDFName.of("Resources")));
  assert.ok(resources instanceof PDFDict, `${testCase.id}: raster output omitted page resources`);
  const fonts = finalDocument.context.lookup(resources.get(PDFName.of("Font")));
  const xobjects = finalDocument.context.lookup(resources.get(PDFName.of("XObject")));
  assert.equal(fonts instanceof PDFDict ? fonts.entries().length : 0, 0, `${testCase.id}: final raster retained vector fonts`);
  assert.ok(xobjects instanceof PDFDict, `${testCase.id}: final raster omitted its image XObject`);
  assert.equal(xobjects.entries().length, 1, `${testCase.id}: final raster must contain exactly one page image`);
  for (const [, reference] of xobjects.entries()) {
    const object = finalDocument.context.lookup(reference);
    assert.ok(object instanceof PDFRawStream && object.dict.get(PDFName.of("Subtype")) === PDFName.of("Image"), `${testCase.id}: final raster XObject is not an image`);
  }
  assert.equal(finalDocument.catalog.has(PDFName.of("AcroForm")), false, `${testCase.id}: final raster retained AcroForm structure`);
  const finalAnnotations = finalDocument.context.lookup(finalPage.node.get(PDFName.of("Annots")));
  assert.equal(finalAnnotations instanceof PDFArray ? finalAnnotations.size() : 0, 0, `${testCase.id}: final raster retained annotations`);
  const pixels = comparePixels(await renderPage(result.preRaster), await renderPage(result.final));
  assert.ok(pixels.changedRatio < 0.08, `${testCase.id}: final raster lost visible content (${pixels.changedRatio})`);
  assert.ok(pixels.meanChannelDifference < 8, `${testCase.id}: final raster diverged from decorated structure output (${pixels.meanChannelDifference})`);
  return { order, structure, extracted, finalRaster: true, pixels };
}

function contentOrder(document, page) {
  const contents = document.context.lookup(page.node.get(PDFName.of("Contents")));
  assert.ok(contents instanceof PDFArray, "combined output Contents must be an array");
  const raw = contents.asArray().map((entry) => document.context.lookup(entry)).map((stream) => {
    assert.ok(stream instanceof PDFRawStream, `unexpected content object: ${stream?.constructor?.name ?? typeof stream}`);
    const body = Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
    if (/\/Stamp[^\s]*\s+Do/u.test(body)) return "stamp";
    if (/\/Watermark[^\s]*\s+Do/u.test(body)) return "watermark";
    if (/\/FlatWidget[^\s]*\s+Do/u.test(body)) return "form";
    if (/\bBT\b/u.test(body)) return "text";
    if (/^\s*[qQ]\s*$/u.test(body)) return "wrapper";
    return "original";
  });
  const calls = raw.filter((kind) => kind !== "wrapper");
  return calls.filter((kind, index) => kind !== "original" || calls[index - 1] !== "original");
}

function inspectStructure(document) {
  let embeddedFiles = 0;
  for (const [, object] of document.context.enumerateIndirectObjects()) {
    if (object instanceof PDFRawStream && object.dict.get(PDFName.of("Type")) === PDFName.of("EmbeddedFile")) embeddedFiles += 1;
  }
  const widgets = document.getPages().flatMap((page) => {
    const annotations = document.context.lookup(page.node.get(PDFName.of("Annots")));
    if (!(annotations instanceof PDFArray)) return [];
    return annotations.asArray().filter((entry) => {
      const annotation = document.context.lookup(entry);
      return annotation instanceof PDFDict && annotation.get(PDFName.of("Subtype")) === PDFName.of("Widget");
    });
  }).length;
  return {
    hasTitle: document.getTitle() === "COMBINED-REMOVE-ME",
    embeddedFiles,
    hasAcroForm: document.catalog.has(PDFName.of("AcroForm")),
    widgets,
  };
}

async function extractText(bytes) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true });
  try {
    const document = await task.promise;
    const content = await (await document.getPage(1)).getTextContent();
    return content.items.map((item) => item.str ?? "").filter(Boolean);
  } finally {
    await task.destroy();
  }
}

async function renderPage(bytes) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true });
  try {
    const document = await task.promise;
    const page = await document.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const canvas = createCanvas(viewport.width, viewport.height);
    await page.render({ canvas, canvasContext: canvas.getContext("2d"), viewport, background: "#ffffff" }).promise;
    return PNG.sync.read(canvas.toBuffer("image/png"));
  } finally {
    await task.destroy();
  }
}

function comparePixels(left, right) {
  assert.equal(left.width, right.width, "raster comparison width changed");
  assert.equal(left.height, right.height, "raster comparison height changed");
  let changed = 0;
  let channelDifference = 0;
  for (let offset = 0; offset < left.data.length; offset += 4) {
    const red = Math.abs(left.data[offset] - right.data[offset]);
    const green = Math.abs(left.data[offset + 1] - right.data[offset + 1]);
    const blue = Math.abs(left.data[offset + 2] - right.data[offset + 2]);
    if (Math.max(red, green, blue) > 20) changed += 1;
    channelDifference += red + green + blue;
  }
  return {
    width: left.width,
    height: left.height,
    changedRatio: changed / (left.width * left.height),
    meanChannelDifference: channelDifference / (left.width * left.height * 3),
  };
}
