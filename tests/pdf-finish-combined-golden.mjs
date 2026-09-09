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
const visibilityCases = [
  { id: "visibility-image-foreground", cleanup: "preserve", form: "flatten", watermark: "image", layer: "foreground", text: "number", stamp: "off", raster: "on" },
  { id: "visibility-text-background", cleanup: "preserve", form: "flatten", watermark: "text", layer: "background", text: "number", stamp: "off", raster: "on" },
];
const sentinelRegions = {
  header: { x: 112, y: 0, width: 176, height: 48 },
  pageNumber: { x: 112, y: 552, width: 176, height: 48 },
  watermark: { x: 104, y: 232, width: 192, height: 136 },
  originalOverlap: { x: 120, y: 270, width: 72, height: 24 },
  formOverlap: { x: 210, y: 308, width: 72, height: 24 },
  stamp: { x: 288, y: 452, width: 80, height: 64 },
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
assert.deepEqual(visibilityCases.map(({ watermark, layer, raster }) => ({ watermark, layer, raster })), [
  { watermark: "image", layer: "foreground", raster: "on" },
  { watermark: "text", layer: "background", raster: "on" },
], "the two raster visibility cases must close the pairwise array's watermark/layer triple gap");

await fs.mkdir(artifactDirectory, { recursive: true });
const sourceBytes = await createSourcePdf();
const watermarkImageBytes = createImageBytes([208, 0, 208]);
const stampImageBytes = createImageBytes([255, 101, 0]);
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
  for (const testCase of [...specification.combinations, ...visibilityCases]) {
    const result = await createOutput(page, testCase, sourceBytes, watermarkImageBytes, stampImageBytes);
    const audited = await auditOutput(result, testCase);
    summary.push({ id: testCase.id, axes: testCase, ...audited });
    await fs.writeFile(path.join(artifactDirectory, `${testCase.id}-pre-raster.pdf`), result.preRaster);
    await fs.writeFile(path.join(artifactDirectory, `${testCase.id}.pdf`), result.final);
  }
} finally {
  await browser?.close();
  await server.close();
}

assert.deepEqual(
  [...new Set(summary.filter(({ finalRaster }) => finalRaster).map(({ axes: testCase }) => `${testCase.watermark}/${testCase.layer}`))].sort(),
  ["image/background", "image/foreground", "text/background", "text/foreground"],
  "final raster must visibly exercise image/text watermarks on both background and foreground layers",
);
await fs.writeFile(path.join(artifactDirectory, "summary.json"), `${JSON.stringify({ axes, combinations: summary }, null, 2)}\n`);
console.log(`PDF finish combined golden passed: ${specification.combinations.length} actual pairwise outputs across ${Object.keys(axes).length} declared axes plus ${visibilityCases.length} raster visibility controls; ${summary.filter(({ finalRaster }) => finalRaster).length} include final raster and cover image/text × background/foreground. Artifacts: ${artifactDirectory}`);

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
  for (const rectangle of [
    { x: 32, y: 54, width: 68, height: 492 },
    { x: 300, y: 54, width: 68, height: 492 },
    { x: 100, y: 54, width: 200, height: 176 },
    { x: 100, y: 370, width: 200, height: 176 },
  ]) page.drawRectangle({ ...rectangle, color: rgb(0.08, 0.2, 0.78) });
  page.drawRectangle({ x: 118, y: 304, width: 76, height: 28, color: rgb(0, 0.28, 0.92) });
  const font = await document.embedFont(StandardFonts.Helvetica);
  const form = document.getForm();
  const field = form.createTextField("combined-field");
  field.setText("FORM-A");
  field.addToPage(page, { x: 208, y: 266, width: 76, height: 28, borderWidth: 0, backgroundColor: rgb(1, 0.86, 0.05), font });
  form.updateFieldAppearances(font);
  return new Uint8Array(await document.save({ updateFieldAppearances: false }));
}

function createImageBytes([red, green, blue]) {
  const image = new PNG({ width: 60, height: 40 });
  for (let offset = 0; offset < image.data.length; offset += 4) {
    image.data[offset] = red;
    image.data[offset + 1] = green;
    image.data[offset + 2] = blue;
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

async function createOutput(page, testCase, source, watermarkImage, stampImage) {
  const serialized = await page.evaluate(async ({ testCase: inputCase, sourceBytes, watermarkImageBytes, stampImageBytes }) => {
    const [{ finishPdfFiles }, { createPageSelection }, { validateWatermarkResult }] = await Promise.all([
      import("/src/features/pdf-editor/finish/engine.ts"),
      import("/src/features/pdf-editor/finish/selection.ts"),
      import("/src/features/pdf-editor/finish/watermark.ts"),
    ]);
    const selection = createPageSelection(1, "1", "all", { startPage: 1, excludeCover: false });
    if ("error" in selection) throw new Error(selection.error);
    const sourceFile = new File([Uint8Array.from(sourceBytes)], "combined-source.pdf", { type: "application/pdf" });
    const watermarkImage = new File([Uint8Array.from(watermarkImageBytes)], "watermark-sentinel.png", { type: "image/png" });
    const stampImage = new File([Uint8Array.from(stampImageBytes)], "stamp-sentinel.png", { type: "image/png" });
    const textOption = (template, region, color, fontSize) => ({ template, region, fontSize, color, margin: 18, startNumber: 1, startPage: 1, excludeCover: false, opacity: 1 });
    let preRaster;
    const [output] = await finishPdfFiles({
      files: [{ key: inputCase.id, file: sourceFile, selection }],
      options: {
        ...textOption("WM-SRC\nWM-FRM", "center", "#d000d0", 26),
        textDecorations: [
          textOption("PAGE-{page}", "bottom-center", "#0010ff", 18),
          ...(inputCase.text === "number-header" ? [textOption("HEADER-A", "top-center", "#009b3a", 18)] : []),
        ],
        watermark: {
          content: inputCase.watermark,
          image: inputCase.watermark === "image" ? watermarkImage : undefined,
          layer: inputCase.layer,
          pattern: "single",
          region: "center",
          rotation: 0,
          opacity: 1,
          sizePercent: 45,
          gap: 20,
          offsetX: 0,
          offsetY: 0,
        },
        stamp: inputCase.stamp === "on" ? { image: stampImage, placement: { cx: 0.82, cy: 0.8, rw: 0.16, aspect: 1.5 } } : undefined,
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
  }, {
    testCase,
    sourceBytes: Array.from(source),
    watermarkImageBytes: Array.from(watermarkImage),
    stampImageBytes: Array.from(stampImage),
  });
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
  const extractedText = extracted.join("\n");
  assert.ok(extractedText.includes("PAGE-1"), `${testCase.id}: missing page-number decoration`);
  assert.equal(extractedText.includes("HEADER-A"), testCase.text === "number-header", `${testCase.id}: header decoration axis changed`);
  assert.equal(extractedText.includes("WM-SRC") && extractedText.includes("WM-FRM"), testCase.watermark === "text", `${testCase.id}: watermark content axis changed`);

  const preRasterPixels = await renderPage(result.preRaster);
  const preRasterSentinels = assertDecorationSentinels(preRasterPixels, testCase, "pre-raster");
  if (testCase.raster === "off") {
    assert.deepEqual(result.final, result.preRaster, `${testCase.id}: a non-raster case changed after output validation`);
    return { order, structure, extracted, finalRaster: false, sentinels: { preRaster: preRasterSentinels } };
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
  const finalPixels = await renderPage(result.final);
  const finalSentinels = assertDecorationSentinels(finalPixels, testCase, "final raster");
  const pixels = comparePixels(preRasterPixels, finalPixels);
  assert.ok(pixels.changedRatio < 0.08, `${testCase.id}: final raster lost visible content (${pixels.changedRatio})`);
  assert.ok(pixels.meanChannelDifference < 8, `${testCase.id}: final raster diverged from decorated structure output (${pixels.meanChannelDifference})`);
  return { order, structure, extracted, finalRaster: true, pixels, sentinels: { preRaster: preRasterSentinels, final: finalSentinels } };
}

function assertDecorationSentinels(image, testCase, stage) {
  const predicates = {
    pageNumber: (red, green, blue) => red < 80 && green < 130 && blue > 170,
    header: (red, green, blue) => red < 80 && green > 110 && blue < 120,
    watermark: (red, green, blue) => red > 140 && green < 120 && blue > 140,
    original: (red, green, blue) => red < 80 && green < 130 && blue > 170,
    form: (red, green, blue) => red > 170 && green > 140 && blue < 120,
    stamp: (red, green, blue) => red > 190 && green > 35 && green < 175 && blue < 100,
  };
  const counts = {
    pageNumber: countPixels(image, sentinelRegions.pageNumber, predicates.pageNumber),
    header: countPixels(image, sentinelRegions.header, predicates.header),
    watermark: countPixels(image, sentinelRegions.watermark, predicates.watermark, [sentinelRegions.originalOverlap, sentinelRegions.formOverlap]),
    watermarkOverOriginal: countPixels(image, sentinelRegions.originalOverlap, predicates.watermark),
    watermarkOverForm: countPixels(image, sentinelRegions.formOverlap, predicates.watermark),
    original: countPixels(image, sentinelRegions.originalOverlap, predicates.original),
    form: countPixels(image, sentinelRegions.formOverlap, predicates.form),
    stamp: countPixels(image, sentinelRegions.stamp, predicates.stamp),
  };
  assert.ok(counts.pageNumber >= 20, `${testCase.id}: ${stage} lost the page-number sentinel (${counts.pageNumber})`);
  if (testCase.text === "number-header") {
    assert.ok(counts.header >= 20, `${testCase.id}: ${stage} lost the header sentinel (${counts.header})`);
  } else {
    assert.equal(counts.header, 0, `${testCase.id}: ${stage} gained an unexpected header sentinel`);
  }
  const watermarkMinimum = testCase.watermark === "image" ? 4_000 : 80;
  assert.ok(counts.watermark >= watermarkMinimum, `${testCase.id}: ${stage} lost its ${testCase.watermark} ${testCase.layer} watermark sentinel (${counts.watermark})`);
  if (testCase.stamp === "on") {
    assert.ok(counts.stamp >= 1_500, `${testCase.id}: ${stage} lost the stamp sentinel (${counts.stamp})`);
  } else {
    assert.equal(counts.stamp, 0, `${testCase.id}: ${stage} gained an unexpected stamp sentinel`);
  }
  const overlapMinimum = testCase.watermark === "image" ? 400 : 50;
  if (testCase.layer === "background") {
    assert.equal(counts.watermarkOverOriginal, 0, `${testCase.id}: ${stage} background watermark painted in front of the original sentinel`);
    assert.ok(counts.original >= 1_500, `${testCase.id}: ${stage} background layering lost the original sentinel (${counts.original})`);
    if (testCase.form === "flatten") {
      assert.equal(counts.watermarkOverForm, 0, `${testCase.id}: ${stage} background watermark painted in front of the flattened-form sentinel`);
      assert.ok(counts.form >= 1_000, `${testCase.id}: ${stage} background layering lost the flattened-form sentinel (${counts.form})`);
    }
  } else {
    assert.ok(counts.watermarkOverOriginal >= overlapMinimum, `${testCase.id}: ${stage} foreground watermark did not paint over the original sentinel (${counts.watermarkOverOriginal})`);
    if (testCase.watermark === "image") assert.equal(counts.original, 0, `${testCase.id}: ${stage} opaque foreground image did not cover the original sentinel`);
    if (testCase.form === "flatten") {
      assert.ok(counts.watermarkOverForm >= overlapMinimum, `${testCase.id}: ${stage} foreground watermark did not paint over the flattened-form sentinel (${counts.watermarkOverForm})`);
      if (testCase.watermark === "image") assert.equal(counts.form, 0, `${testCase.id}: ${stage} opaque foreground image did not cover the flattened-form sentinel`);
    }
  }
  return counts;
}

function countPixels(image, region, predicate, excludedRegions = []) {
  assert.ok(region.x >= 0 && region.y >= 0 && region.x + region.width <= image.width && region.y + region.height <= image.height, "sentinel region escaped the rendered page");
  let count = 0;
  for (let y = region.y; y < region.y + region.height; y += 1) {
    for (let x = region.x; x < region.x + region.width; x += 1) {
      if (excludedRegions.some((excluded) => x >= excluded.x && x < excluded.x + excluded.width && y >= excluded.y && y < excluded.y + excluded.height)) continue;
      const offset = (y * image.width + x) * 4;
      if (predicate(image.data[offset], image.data[offset + 1], image.data[offset + 2])) count += 1;
    }
  }
  return count;
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
