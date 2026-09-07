import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, decodePDFRawStream, degrees } from "pdf-lib";
import { PNG } from "pngjs";

import {
  finishPdfFiles,
  pdfPageViewport,
  preflightPdfFiles,
  PdfFinishCanceledError,
  PdfFinishEngineError,
} from "../../src/features/pdf-editor/finish/engine.ts";
import { createPageSelection } from "../../src/features/pdf-editor/finish/selection.ts";
import { finishOutputName } from "../../src/features/pdf-editor/outputName.ts";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function fixture(name = "sample.pdf") {
  const document = await PDFDocument.create({ updateMetadata: false });
  document.addPage([400, 600]);
  const second = document.addPage([500, 700]);
  second.setCropBox(20, 30, 300, 400);
  second.setRotation(degrees(90));
  document.addPage([400, 600]);
  return new File([await document.save()], name, { type: "application/pdf" });
}

function selection(totalPages: number, range: string) {
  const result = createPageSelection(totalPages, range, "all", { startPage: 1, excludeCover: false });
  assert.ok(!("error" in result));
  return result;
}

const watermarkOptions = (overrides: Record<string, unknown> = {}) => ({
  template: "CONFIDENTIAL",
  region: "center" as const,
  fontSize: 28,
  color: "#c02038",
  margin: 18,
  startNumber: 1,
  startPage: 1,
  excludeCover: false,
  watermark: {
    content: "text" as const,
    layer: "foreground" as const,
    pattern: "single" as const,
    region: "center" as const,
    rotation: -32,
    opacity: 0.35,
    sizePercent: 60,
    gap: 54,
    offsetX: 12,
    offsetY: 18,
  },
  ...overrides,
});

function decodedPageStreams(document: PDFDocument, pageIndex = 0) {
  const page = document.getPage(pageIndex);
  const raw = page.node.get(PDFName.of("Contents"));
  assert.ok(raw);
  const resolved = document.context.lookup(raw);
  const entries = resolved instanceof PDFArray ? resolved.asArray() : [raw];
  return entries.map((entry) => {
    const stream = document.context.lookup(entry);
    assert.ok(stream instanceof PDFRawStream);
    return Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
  });
}

test("finish engine decorates the exact page set with one batch clock and rotated crop geometry", async () => {
  const file = await fixture("quarterly.pdf");
  let clockCalls = 0;
  const source = await PDFDocument.load(await file.arrayBuffer());
  assert.deepEqual(pdfPageViewport(source.getPage(1)), {
    width: 400,
    height: 300,
    rotation: 90,
    transform: [0, 1, 1, 0, -30, -20],
  });
  const [output] = await finishPdfFiles({
    files: [{ key: "quarterly", file, selection: selection(3, "2") }],
    options: {
      template: "P{page}/{pages} {date:YYYY-MM-DD}",
      region: "bottom-right",
      fontSize: 10,
      color: "#112233",
      margin: 18,
      startNumber: 5,
      startPage: 2,
      excludeCover: false,
    },
    locale: "en-US",
    clock: () => { clockCalls += 1; return new Date(2026, 8, 7, 9); },
  });
  assert.equal(clockCalls, 1);
  assert.equal(output.fileName, "quarterly-finished.pdf");
  assert.deepEqual(output.warnings, []);
  const decorated = await PDFDocument.load(output.buffer, { updateMetadata: false });
  const extGState = decorated.getPage(1).node.Resources()?.lookup(PDFName.of("ExtGState"), PDFDict);
  assert.ok(extGState);
  const nonStrokingOpacities = extGState.keys().map((key) => (
    extGState.lookup(key, PDFDict).lookup(PDFName.of("ca"), PDFNumber).asNumber()
  ));
  assert.ok(nonStrokingOpacities.some((opacity) => Math.abs(opacity - 0.9) < Number.EPSILON));
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(output.buffer) });
  try {
    const document = await task.promise;
    assert.equal(document.numPages, 3);
    const firstText = await (await document.getPage(1)).getTextContent();
    const secondText = await (await document.getPage(2)).getTextContent();
    assert.equal(firstText.items.length, 0);
    assert.match(secondText.items.map((item: any) => item.str ?? "").join(" "), /P5\/3 2026-09-07/u);
  } finally {
    await task.destroy();
  }
});

test("finish engine loads the full Noto asset once per batch and cooperatively aborts", async () => {
  const fontBytes = await fs.readFile(path.join(repositoryRoot, "public/vendor/qr-label-font/noto-cjk-sans-2.004/NotoSansKR-Regular.otf"));
  const files = [await fixture("가.pdf"), await fixture("나.pdf")];
  let loads = 0;
  const outputs = await finishPdfFiles({
    files: files.map((file, index) => ({ key: `${index}`, file, selection: selection(3, "1") })),
    options: { template: "문서 {filename}", region: "top-left", fontSize: 10, color: "#000000", margin: 20, startNumber: 1, startPage: 1, excludeCover: false },
    locale: "ko-KR",
    loadFontAsset: async () => { loads += 1; return fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength) as ArrayBuffer; },
  });
  assert.equal(loads, 1);
  assert.equal(outputs.length, 2);
  assert.ok(outputs.every(({ warnings }) => warnings.includes("embedded-font")));

  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    finishPdfFiles({
      files: [{ key: "cancel", file: files[0], selection: selection(3, "1-3") }],
      options: { template: "{page}", region: "bottom-center", fontSize: 10, color: "#000000", margin: 20, startNumber: 1, startPage: 1, excludeCover: false },
      locale: "en-US",
      signal: controller.signal,
    }),
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
});

test("finish viewport intersects CropBox with MediaBox for every rotation and falls back on an empty intersection", async () => {
  const document = await PDFDocument.create({ updateMetadata: false });
  const page = document.addPage([400, 600]);
  page.setCropBox(-50, -80, 600, 850);
  const expected = new Map([
    [0, { width: 400, height: 600, rotation: 0, transform: [1, 0, 0, -1, 0, 600] }],
    [90, { width: 600, height: 400, rotation: 90, transform: [0, 1, 1, 0, 0, 0] }],
    [180, { width: 400, height: 600, rotation: 180, transform: [-1, 0, 0, 1, 400, 0] }],
    [270, { width: 600, height: 400, rotation: 270, transform: [0, -1, -1, 0, 600, 400] }],
  ] as const);
  for (const rotation of [0, 90, 180, 270] as const) {
    page.setRotation(degrees(rotation));
    assert.deepEqual(pdfPageViewport(page), expected.get(rotation));
  }
  page.setCropBox(500, 700, 100, 100);
  page.setRotation(degrees(0));
  assert.deepEqual(pdfPageViewport(page), expected.get(0));
});

test("finish preflight reports positioned text failures and layout/font warnings before drawing", async () => {
  const fontBytes = await fs.readFile(path.join(repositoryRoot, "public/vendor/qr-label-font/noto-cjk-sans-2.004/NotoSansKR-Regular.otf"));
  const file = await fixture("preflight.pdf");
  const run = (template: string, options: Partial<Parameters<typeof preflightPdfFiles>[0]["options"]> = {}) => preflightPdfFiles({
    files: [{ key: "preflight", file, selection: selection(3, "1-3") }],
    options: { template, region: "top-center", fontSize: 10, color: "#34343a", margin: 24, startNumber: 1, startPage: 1, excludeCover: false, ...options },
    locale: "en-US",
    clock: () => new Date(2026, 8, 7, 9),
    loadFontAsset: async () => fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength) as ArrayBuffer,
  });

  const control = await run("ok\nABC\u0001DEF");
  assert.deepEqual(control.errors[0], { code: "control-character", field: "template", fileKey: "preflight", physicalPage: 1, line: 2, column: 4, codePoint: 1 });
  const date = await run("line\n{date:foo}");
  assert.deepEqual(date.errors[0], { code: "date-format", field: "template", fileKey: "preflight", physicalPage: 1, line: 2, column: 1, token: "{date:foo}" });
  const missing = await run("A😀Z");
  assert.deepEqual(missing.errors[0], { code: "missing-glyph", field: "template", fileKey: "preflight", physicalPage: 1, line: 1, column: 2, codePoint: 128512 });
  assert.deepEqual((await run("{mystery}")).warnings, ["unknown-token"]);
  assert.ok((await run("W".repeat(200))).warnings.includes("horizontal-overflow"));
  assert.ok((await run(Array.from({ length: 75 }, (_, index) => `line ${index}`).join("\n"))).warnings.includes("vertical-overflow"));
  assert.ok((await run("Русский")).warnings.includes("embedded-font"));
  assert.equal((await run("W", { fontSize: 72, margin: 144 })).errors[0]?.code, "narrow-region");

  const smallDocument = await PDFDocument.create({ updateMetadata: false });
  smallDocument.addPage([200, 200]);
  const smallFile = new File([await smallDocument.save()], "small.pdf", { type: "application/pdf" });
  const invalidMargin = await preflightPdfFiles({
    files: [{ key: "small", file: smallFile, selection: selection(1, "1") }],
    options: { template: "A", region: "top-left", fontSize: 10, color: "#34343a", margin: 100, startNumber: 1, startPage: 1, excludeCover: false },
    locale: "en-US",
  });
  assert.equal(invalidMargin.errors[0]?.code, "invalid-margin");
});

test("finish cancellation preserves registered outputs and blocks the next file read", async () => {
  const first = await fixture("first.pdf");
  const source = Buffer.from(await (await fixture("second.pdf")).arrayBuffer());
  let secondReads = 0;
  const second = new File([source], "second.pdf", { type: "application/pdf" });
  second.arrayBuffer = async () => {
    secondReads += 1;
    return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength) as ArrayBuffer;
  };
  const controller = new AbortController();
  await assert.rejects(
    finishPdfFiles({
      files: [
        { key: "first", file: first, selection: selection(3, "1") },
        { key: "second", file: second, selection: selection(3, "1") },
      ],
      options: { template: "{page}", region: "bottom-center", fontSize: 10, color: "#34343a", margin: 24, startNumber: 1, startPage: 1, excludeCover: false },
      locale: "en-US",
      signal: controller.signal,
      onProgress: (progress) => {
        if (progress.phase === "reading" && progress.completed === 1) controller.abort();
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof PdfFinishCanceledError);
      assert.equal(error.partialResults.length, 1);
      assert.equal(error.partialResults[0].key, "first");
      return true;
    },
  );
  assert.equal(secondReads, 0);
});

test("finish output names are localized, sanitized, deduplicated, and have one extension", () => {
  const cases = [
    { source: "  report.pdf  ", base: "report" },
    { source: " .pdf ", base: "" },
    { source: "report.pdf.pdf", base: "report" },
    { source: ".pdf", base: "" },
    { source: "report.pdf", base: "report" },
    { source: "report", base: "report" },
    { source: "\u2003report.pdf\u00a0", base: "report" },
    { source: "quarterly-finished.pdf", base: "quarterly" },
  ];
  for (const { source, base } of cases) {
    assert.equal(finishOutputName(source, "ko-KR"), base ? `${base}-마무리.pdf` : "Worklazy-PDF-마무리.pdf");
    assert.equal(finishOutputName(source, "en-US"), base ? `${base}-finished.pdf` : "Worklazy-PDF-finished.pdf");
  }
  assert.equal(finishOutputName("보고서:1.pdf.pdf", "ko-KR"), "보고서-1-마무리.pdf");
});

test("watermark text uses an independent isolated stream in the requested layer", async () => {
  for (const fixtureName of ["empty-contents.pdf", "single-stream.pdf", "multiple-streams.pdf"]) {
    const bytes = await fs.readFile(path.join(repositoryRoot, "tests/fixtures/pdf-finish/background", fixtureName));
    for (const layer of ["background", "foreground"] as const) {
      const file = new File([bytes], fixtureName, { type: "application/pdf" });
      const [output] = await finishPdfFiles({
        files: [{ key: `${fixtureName}-${layer}`, file, selection: selection(1, "1") }],
        options: watermarkOptions({ watermark: { ...watermarkOptions().watermark, layer } }),
        locale: "en-US",
      });
      const result = await PDFDocument.load(output.buffer, { updateMetadata: false });
      const streams = decodedPageStreams(result);
      const watermarkIndex = layer === "background" ? 0 : streams.length - 1;
      assert.match(streams[watermarkIndex], /^q\n\/Artifact BMC/u, `${fixtureName}/${layer} did not isolate the watermark stream`);
      assert.match(streams[watermarkIndex], /EMC\nQ\n?$/u, `${fixtureName}/${layer} did not restore graphics state`);
      assert.equal(streams.filter((stream) => stream.includes("/Artifact BMC")).length, 1);
      if (fixtureName === "single-stream.pdf" && layer === "foreground") {
        const watermarkForms = result.context.enumerateIndirectObjects().map(([, object]) => object).filter((object): object is PDFRawStream => object instanceof PDFRawStream && object.dict.get(PDFName.of("Subtype")) === PDFName.of("Form"));
        assert.equal(watermarkForms.length, 1);
        const formFonts = watermarkForms[0].dict.lookup(PDFName.of("Resources"), PDFDict).lookup(PDFName.of("Font"), PDFDict);
        assert.equal(formFonts.keys().length, 1, "the vector text watermark form must expose one shared font resource");
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const task = pdfjs.getDocument({ data: new Uint8Array(output.buffer) });
        try {
          const content = await (await (await task.promise).getPage(1)).getTextContent();
          assert.match(content.items.map((item: any) => item.str ?? "").join(" "), /CON/u);
        } finally {
          await task.destroy();
        }
      }
    }
  }
});

test("watermark rejects malformed content placement without returning a partial result", async () => {
  const bytes = await fs.readFile(path.join(repositoryRoot, "tests/fixtures/pdf-finish/background/malformed-contents-type.pdf"));
  const file = new File([bytes], "malformed-contents-type.pdf", { type: "application/pdf" });
  const input = {
    files: [{ key: "malformed", file, selection: selection(1, "1") }],
    options: watermarkOptions({ watermark: { ...watermarkOptions().watermark, layer: "background" as const } }),
    locale: "en-US",
  };
  const preflight = await preflightPdfFiles(input);
  assert.equal(preflight.errors[0]?.code, "background-placement");
  await assert.rejects(finishPdfFiles(input), (error: unknown) => error instanceof PdfFinishEngineError && error.code === "background-placement");
});

test("watermark image tiles preserve one embedded image resource and repeated references", async (context) => {
  const source = await fixture("image-watermark.pdf");
  const png = new PNG({ width: 40, height: 20 });
  for (let index = 0; index < png.data.length; index += 4) {
    png.data[index] = 210; png.data[index + 1] = 20; png.data[index + 2] = 50; png.data[index + 3] = 255;
  }
  const image = new File([PNG.sync.write(png)], "mark.png", { type: "image/png" });
  const baseOptions = watermarkOptions({ watermark: { ...watermarkOptions().watermark, content: "image" as const, image, sizePercent: 24 } });
  const [singleOutput] = await finishPdfFiles({
    files: [{ key: "image-single", file: source, selection: selection(3, "1") }],
    options: baseOptions,
    locale: "en-US",
  });
  const [tileOutput] = await finishPdfFiles({
    files: [{ key: "image", file: source, selection: selection(3, "1") }],
    options: watermarkOptions({ watermark: { ...baseOptions.watermark, pattern: "tile" as const } }),
    locale: "en-US",
  });
  const result = await PDFDocument.load(tileOutput.buffer, { updateMetadata: false });
  const imageObjects = result.context.enumerateIndirectObjects().filter(([, object]) => object instanceof PDFRawStream && object.dict.get(PDFName.of("Subtype")) === PDFName.of("Image"));
  assert.equal(imageObjects.length, 1, "tile placement must embed the source image only once per document");
  const watermarkStream = decodedPageStreams(result).at(-1) ?? "";
  assert.ok((watermarkStream.match(/\/Watermark[^ ]* Do/gu) ?? []).length > 1, "tile placement must reference the shared image repeatedly");
  assert.ok(
    tileOutput.buffer.byteLength - singleOutput.buffer.byteLength < image.size * 2 + 4_096,
    "tile output growth must be limited to placement operators rather than duplicated image payloads",
  );
  context.diagnostic(`image watermark output bytes: single=${singleOutput.buffer.byteLength}; tile=${tileOutput.buffer.byteLength}; delta=${tileOutput.buffer.byteLength - singleOutput.buffer.byteLength}; source=${image.size}`);
});

test("watermark warns about risky structures and proceeds only with explicit consent", async () => {
  for (const [name, warning] of [
    ["risk/graphics-state-imbalance.pdf", "risky-graphics-state"],
    ["risk/tagged-structure.pdf", "risky-tagged-document"],
    ["ocg/on.pdf", "risky-optional-content"],
  ] as const) {
    const bytes = await fs.readFile(path.join(repositoryRoot, "tests/fixtures/pdf-finish", name));
    const file = new File([bytes], path.basename(name), { type: "application/pdf" });
    const input = {
      files: [{ key: warning, file, selection: selection(1, "1") }],
      options: watermarkOptions(),
      locale: "en-US",
    };
    const preflight = await preflightPdfFiles(input);
    assert.ok(preflight.warnings.includes(warning), `${name} did not report ${warning}`);
    await assert.rejects(finishPdfFiles(input), (error: unknown) => error instanceof PdfFinishEngineError && error.code === "risk-confirmation-required");
    const outputs = await finishPdfFiles({ ...input, allowRiskyDocuments: true });
    assert.equal(outputs.length, 1);
    assert.ok(outputs[0].warnings.includes(warning));
  }
});

test("watermark does not expose a result when reopen validation finds damage", async () => {
  let validations = 0;
  await assert.rejects(
    finishPdfFiles({
      files: [{ key: "invalid-result", file: await fixture("invalid-result.pdf"), selection: selection(3, "1") }],
      options: watermarkOptions(),
      locale: "en-US",
      validateWatermarkOutput: async () => { validations += 1; throw new Error("test-only-reopen-failure"); },
    }),
    (error: unknown) => error instanceof PdfFinishEngineError && error.code === "output-validation",
  );
  assert.equal(validations, 1);
});
