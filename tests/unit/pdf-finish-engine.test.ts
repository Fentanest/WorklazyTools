import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, decodePDFRawStream, degrees, type PDFFont } from "pdf-lib";
import { PNG } from "pngjs";

import {
  finishPdfFiles,
  pdfPageViewport,
  preflightPdfFiles,
  PdfFinishCanceledError,
  PdfFinishEngineError,
  PdfFinishPartialError,
} from "../../src/features/pdf-editor/finish/engine.ts";
import { createPdfFinishResultStore, PdfFinishStorageError, type PdfFinishResultStore } from "../../src/features/pdf-editor/finish/resultStorage.ts";
import { createPageSelection } from "../../src/features/pdf-editor/finish/selection.ts";
import { createWatermarkPlacements, inspectWatermarkRisksCooperatively, measureTextWatermarkBox, validateWatermarkResult } from "../../src/features/pdf-editor/finish/watermark.ts";
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
  const outputBytes = await output.blob.arrayBuffer();
  const decorated = await PDFDocument.load(outputBytes, { updateMetadata: false });
  const extGState = decorated.getPage(1).node.Resources()?.lookup(PDFName.of("ExtGState"), PDFDict);
  assert.ok(extGState);
  const nonStrokingOpacities = extGState.keys().map((key) => (
    extGState.lookup(key, PDFDict).lookup(PDFName.of("ca"), PDFNumber).asNumber()
  ));
  assert.ok(nonStrokingOpacities.some((opacity) => Math.abs(opacity - 0.9) < Number.EPSILON));
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(outputBytes) });
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
  assert.deepEqual((await run(" \n\t ")).errors[0], { code: "empty-text", field: "template", fileKey: "preflight", physicalPage: 1 });
  await assert.rejects(
    finishPdfFiles({
      files: [{ key: "empty-text", file, selection: selection(3, "1") }],
      options: watermarkOptions({ template: "\n  \n" }),
      locale: "en-US",
    }),
    (error: unknown) => error instanceof PdfFinishEngineError && error.code === "empty-text",
  );

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

test("finish storage failure preserves completed outputs, discards the current result, and never starts the next file", async () => {
  const first = await fixture("first.pdf");
  const second = await fixture("second.pdf");
  const thirdBytes = Buffer.from(await (await fixture("third.pdf")).arrayBuffer());
  let thirdReads = 0;
  const third = new File([thirdBytes], "third.pdf", { type: "application/pdf" });
  third.arrayBuffer = async () => {
    thirdReads += 1;
    return thirdBytes.buffer.slice(thirdBytes.byteOffset, thirdBytes.byteOffset + thirdBytes.byteLength) as ArrayBuffer;
  };
  let registrations = 0;
  const resultStore: PdfFinishResultStore = {
    mode: "opfs",
    async store(bytes) {
      registrations += 1;
      if (registrations === 2) throw new PdfFinishStorageError("opfs-write");
      return { blob: new Blob([bytes], { type: "application/pdf" }), mode: "opfs", dispose: async () => undefined };
    },
    dispose: async () => undefined,
  };
  await assert.rejects(
    finishPdfFiles({
      files: [first, second, third].map((file, index) => ({ key: `${index}`, file, selection: selection(3, "1") })),
      options: { template: "{page}", region: "bottom-center", fontSize: 10, color: "#34343a", margin: 24, startNumber: 1, startPage: 1, excludeCover: false },
      locale: "en-US",
      resultStore,
    }),
    (error: unknown) => {
      assert.ok(error instanceof PdfFinishPartialError);
      assert.equal(error.code, "result-storage");
      assert.equal(error.partialResults.length, 1);
      assert.equal(error.partialResults[0].key, "0");
      return true;
    },
  );
  assert.equal(registrations, 2);
  assert.equal(thirdReads, 0);
});

test("finish Blob allocation failure exposes completed outputs and never starts the next file", async () => {
  const files = await Promise.all(["first", "second", "third"].map((name) => fixture(`${name}.pdf`)));
  const originalThirdRead = files[2].arrayBuffer.bind(files[2]);
  let thirdReads = 0;
  files[2].arrayBuffer = async () => { thirdReads += 1; return originalThirdRead(); };
  const store = await createPdfFinishResultStore({ storage: {} });
  const OriginalBlob = globalThis.Blob;
  let blobAllocations = 0;
  globalThis.Blob = new Proxy(OriginalBlob, {
    construct(target, args, newTarget) {
      blobAllocations += 1;
      if (blobAllocations === 2) throw new RangeError("injected Blob allocation failure");
      return Reflect.construct(target, args, newTarget);
    },
  });
  let partial: PdfFinishPartialError | undefined;
  try {
    await assert.rejects(
      finishPdfFiles({
        files: files.map((file, index) => ({ key: `${index}`, file, selection: selection(3, "1") })),
        options: { template: "{page}", region: "bottom-center", fontSize: 10, color: "#34343a", margin: 24, startNumber: 1, startPage: 1, excludeCover: false },
        locale: "en-US",
        resultStore: store,
      }),
      (error: unknown) => {
        assert.ok(error instanceof PdfFinishPartialError);
        partial = error;
        assert.equal(error.code, "result-memory-limit");
        assert.deepEqual(error.partialResults.map(({ key }) => key), ["0"]);
        return true;
      },
    );
  } finally {
    globalThis.Blob = OriginalBlob;
  }
  assert.equal(blobAllocations, 2);
  assert.equal(thirdReads, 0);
  assert.ok(partial);
  assert.ok((await partial.partialResults[0].blob.arrayBuffer()).byteLength > 0);
  await partial.partialResults[0].dispose();
  await store.dispose();
});

test("finish file failure exposes completed outputs and never starts the next file", async () => {
  const first = await fixture("first.pdf");
  const broken = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "broken.pdf", { type: "application/pdf" });
  const thirdBytes = Buffer.from(await (await fixture("third.pdf")).arrayBuffer());
  let thirdReads = 0;
  const third = new File([thirdBytes], "third.pdf", { type: "application/pdf" });
  third.arrayBuffer = async () => {
    thirdReads += 1;
    return thirdBytes.buffer.slice(thirdBytes.byteOffset, thirdBytes.byteOffset + thirdBytes.byteLength) as ArrayBuffer;
  };
  await assert.rejects(
    finishPdfFiles({
      files: [
        { key: "first", file: first, selection: selection(3, "1") },
        { key: "broken", file: broken, selection: selection(1, "1") },
        { key: "third", file: third, selection: selection(3, "1") },
      ],
      options: { template: "{page}", region: "bottom-center", fontSize: 10, color: "#34343a", margin: 24, startNumber: 1, startPage: 1, excludeCover: false },
      locale: "en-US",
    }),
    (error: unknown) => {
      assert.ok(error instanceof PdfFinishPartialError);
      assert.equal(error.code, "unreadable-document");
      assert.equal(error.partialResults.length, 1);
      assert.equal(error.partialResults[0].key, "first");
      return true;
    },
  );
  assert.equal(thirdReads, 0);
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
      const outputBytes = await output.blob.arrayBuffer();
      const result = await PDFDocument.load(outputBytes, { updateMetadata: false });
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
        const task = pdfjs.getDocument({ data: new Uint8Array(outputBytes) });
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
  const singleOutputBytes = await singleOutput.blob.arrayBuffer();
  const tileOutputBytes = await tileOutput.blob.arrayBuffer();
  const result = await PDFDocument.load(tileOutputBytes, { updateMetadata: false });
  const imageObjects = result.context.enumerateIndirectObjects().filter(([, object]) => object instanceof PDFRawStream && object.dict.get(PDFName.of("Subtype")) === PDFName.of("Image"));
  assert.equal(imageObjects.length, 1, "tile placement must embed the source image only once per document");
  const watermarkStream = decodedPageStreams(result).at(-1) ?? "";
  assert.ok((watermarkStream.match(/\/Watermark[^ ]* Do/gu) ?? []).length > 1, "tile placement must reference the shared image repeatedly");
  assert.ok(
    tileOutputBytes.byteLength - singleOutputBytes.byteLength < image.size * 2 + 4_096,
    "tile output growth must be limited to placement operators rather than duplicated image payloads",
  );
  context.diagnostic(`image watermark output bytes: single=${singleOutputBytes.byteLength}; tile=${tileOutputBytes.byteLength}; delta=${tileOutputBytes.byteLength - singleOutputBytes.byteLength}; source=${image.size}`);
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

test("watermark risk scanning advances across inline image bytes and balances logical content streams", async () => {
  const inlinePayload = Buffer.alloc(597, 0x58);
  Buffer.from(" EI) Q q 0 0 0 0 re W n ", "latin1").copy(inlinePayload, 257);
  const exactInline = Buffer.concat([
    Buffer.from("q\nBI /W 597 /H 1 /BPC 8 /CS /G ID\n", "latin1"),
    inlinePayload,
    Buffer.from("\nEI\nQ", "latin1"),
  ]);
  const cases = [
    { name: "inline.pdf", streams: ["q\nBI /W 1 /H 1 /BPC 8 /CS /G ID\n)\nEI\nQ"], risky: false },
    { name: "inline-597.pdf", streams: [exactInline], risky: false },
    { name: "lexical.pdf", streams: ["q\n% Q ) q\n(escaped \\( q Q \\)) Tj\n<712951> Tj\nQ"], risky: false },
    { name: "split.pdf", streams: ["q", "Q"], risky: false },
    { name: "closing-paren.pdf", streams: ["q\n)\nQ"], risky: true },
  ];
  for (const testCase of cases) {
    const document = await PDFDocument.create({ updateMetadata: false });
    const page = document.addPage([200, 200]);
    const references = testCase.streams.map((content) => document.context.register(document.context.flateStream(content)));
    page.node.set(PDFName.of("Contents"), references.length === 1 ? references[0] : document.context.obj(references));
    const file = new File([await document.save()], testCase.name, { type: "application/pdf" });
    const input = {
      files: [{ key: testCase.name, file, selection: selection(1, "1") }],
      options: watermarkOptions(),
      locale: "en-US",
    };
    const preflight = await preflightPdfFiles(input);
    assert.equal(preflight.warnings.includes("risky-graphics-state"), testCase.risky, testCase.name);
    if (!testCase.risky) assert.equal((await finishPdfFiles(input)).length, 1);
  }
});

test("watermark tile visibility uses the rotated object instead of its axis-aligned bounds", () => {
  const viewport = { width: 200, height: 200, rotation: 0 as const, transform: [1, 0, 0, -1, 0, 200] as const };
  const outside = createWatermarkPlacements({
    viewport,
    width: 100,
    height: 100,
    settings: { pattern: "tile", region: "center", rotation: 45, gap: 0, offsetX: 180, offsetY: 180 },
    margin: 0,
  });
  assert.deepEqual(outside, { ok: false, error: "empty-placement" });

  const onePixel = createWatermarkPlacements({
    viewport,
    width: 100,
    height: 100,
    settings: { pattern: "tile", region: "center", rotation: 0, gap: 0, offsetX: 199, offsetY: 199 },
    margin: 0,
  });
  assert.ok(onePixel.ok && onePixel.placements.length === 1);
});

test("text watermark BBox adds top glyph room without shrinking or respacing the tile", () => {
  const font = {
    heightAtSize: (_size: number, options?: { descender?: boolean }) => options?.descender === false ? 26 : 36,
  } as PDFFont;
  assert.deepEqual(measureTextWatermarkBox(font, 36, 43.2, 2), {
    baselineOffset: 10,
    height: 79.2,
    bboxHeight: 80.325,
  });
});

test("uncertain inline image scans require consent but do not prove an empty inherited clip", async () => {
  const document = await PDFDocument.create({ updateMetadata: false });
  const page = document.addPage([200, 200]);
  const content = "q\nBI /W 1 /H 1 /BPC 8 /CS /G /F /Unknown ID\n0 0 0 0 re W n\nEI\nQ";
  page.node.set(PDFName.of("Contents"), document.context.register(document.context.flateStream(content)));
  const file = new File([await document.save()], "uncertain-inline.pdf", { type: "application/pdf" });
  const input = {
    files: [{ key: "uncertain-inline", file, selection: selection(1, "1") }],
    options: watermarkOptions(),
    locale: "en-US",
  };
  const preflight = await preflightPdfFiles(input);
  assert.ok(preflight.warnings.includes("risky-graphics-state"));
  assert.equal((await finishPdfFiles({ ...input, allowRiskyDocuments: true })).length, 1);
});

test("large stream inspection yields to external cancellation", async () => {
  const document = await PDFDocument.create({ updateMetadata: false });
  const page = document.addPage([200, 200]);
  const content = new Uint8Array(4 * 1024 * 1024);
  content.fill(0x20);
  content[0] = 0x71;
  content[content.length - 1] = 0x51;
  page.node.set(PDFName.of("Contents"), document.context.register(document.context.stream(content)));
  const controller = new AbortController();
  const inspection = inspectWatermarkRisksCooperatively(document, controller.signal);
  setTimeout(() => controller.abort(), 0);
  await assert.rejects(inspection, (error: unknown) => error instanceof DOMException && error.name === "AbortError");
});

test("watermark tile preflight rejects zero placements and canonical numeric boundaries remain aligned", async () => {
  const document = await PDFDocument.create({ updateMetadata: false });
  document.addPage([200, 200]);
  const file = new File([await document.save()], "tile-boundaries.pdf", { type: "application/pdf" });
  const emptyInput = {
    files: [{ key: "empty", file, selection: selection(1, "1") }],
    options: watermarkOptions({ margin: 0, watermark: { ...watermarkOptions().watermark, pattern: "tile" as const, rotation: 0, gap: 0, offsetX: 300, offsetY: 0 } }),
    locale: "en-US",
  };
  assert.equal((await preflightPdfFiles(emptyInput)).errors[0]?.code, "empty-placement");
  await assert.rejects(finishPdfFiles(emptyInput), (error: unknown) => error instanceof PdfFinishEngineError && error.code === "empty-placement");

  const boundaryInput = {
    files: [{ key: "boundary", file, selection: selection(1, "1") }],
    options: watermarkOptions({ watermark: { ...watermarkOptions().watermark, opacity: 0.01, sizePercent: 100, gap: 2_000, offsetX: -2_000, offsetY: 2_000 } }),
    locale: "en-US",
  };
  assert.deepEqual((await preflightPdfFiles(boundaryInput)).errors, []);
  await assert.rejects(
    preflightPdfFiles({ ...boundaryInput, options: watermarkOptions({ watermark: { ...watermarkOptions().watermark, opacity: 0.009 } }) }),
    (error: unknown) => error instanceof PdfFinishEngineError && error.code === "invalid-field",
  );
});

test("watermark text forms reserve descenders and use the six-region width contract outside center", async () => {
  const file = await fixture("text-contract.pdf");
  const [output] = await finishPdfFiles({
    files: [{ key: "text-contract", file, selection: selection(3, "1") }],
    options: watermarkOptions({ template: "gypqj\nsecond line", margin: 20, watermark: { ...watermarkOptions().watermark, region: "top-left" as const, rotation: 0, sizePercent: 100 } }),
    locale: "en-US",
  });
  assert.ok(output.warnings.includes("horizontal-overflow"));
  const document = await PDFDocument.load(await output.blob.arrayBuffer(), { updateMetadata: false });
  const form = document.context.enumerateIndirectObjects().map(([, object]) => object).find((object): object is PDFRawStream => object instanceof PDFRawStream && object.dict.get(PDFName.of("Subtype")) === PDFName.of("Form"));
  assert.ok(form);
  const box = form.dict.lookup(PDFName.of("BBox"), PDFArray).asArray().map((entry) => (entry as PDFNumber).asNumber());
  assert.equal(box[0], 0);
  assert.equal(box[1], 0);
  assert.ok(Math.abs(box[2] - 120) < 0.001, `unexpected six-region width: ${box[2]}`);
  assert.ok(box[3] > 28 * 1.2, `descender/multiline height was not reserved: ${box[3]}`);
  const content = Buffer.from(decodePDFRawStream(form).decode()).toString("latin1");
  const baselines = [...content.matchAll(/1 0 0 1 [^ ]+ ([^ ]+) Tm/gu)].map((match) => Number(match[1]));
  assert.ok(baselines.length >= 1 && baselines.every((baseline) => baseline > 0), `expected positive text baselines: ${baselines.join(",")}`);
});

test("watermark output validation rejects marker-only, missing XObject, and inherited empty clipping results", async () => {
  const source = await fixture("validation.pdf");
  const input = {
    files: [{ key: "validation", file: source, selection: selection(3, "1") }],
    options: watermarkOptions(),
    locale: "en-US",
  };
  const corrupt = async (kind: "marker" | "resource", bytes: Uint8Array, pageCount: number, selected: readonly number[], layer: "background" | "foreground") => {
    const document = await PDFDocument.load(bytes, { updateMetadata: false });
    const page = document.getPage(0);
    if (kind === "marker") {
      const contents = page.node.Contents();
      assert.ok(contents instanceof PDFArray);
      const references = contents.asArray();
      references[references.length - 1] = document.context.register(document.context.flateStream("q\n/Artifact BMC\nEMC\nQ"));
      page.node.set(PDFName.of("Contents"), document.context.obj(references));
    } else {
      const xObjects = page.node.Resources()?.lookup(PDFName.of("XObject"), PDFDict);
      assert.ok(xObjects);
      for (const key of xObjects.keys()) xObjects.delete(key);
    }
    return validateWatermarkResult(await document.save(), pageCount, selected, layer);
  };
  for (const kind of ["marker", "resource"] as const) {
    await assert.rejects(
      finishPdfFiles({ ...input, validateWatermarkOutput: (bytes, pageCount, selected, layer) => corrupt(kind, bytes, pageCount, selected, layer) }),
      (error: unknown) => error instanceof PdfFinishEngineError && error.code === "output-validation",
    );
  }

  for (const [name, content] of [["zero-rectangle", "Q\n0 0 0 0 re W n"], ["empty-path", "Q\nW n"]]) {
    const clipped = await PDFDocument.create({ updateMetadata: false });
    const page = clipped.addPage([200, 200]);
    page.node.set(PDFName.of("Contents"), clipped.context.register(clipped.context.flateStream(content)));
    const clippedFile = new File([await clipped.save()], `${name}.pdf`, { type: "application/pdf" });
    await assert.rejects(
      finishPdfFiles({
        files: [{ key: name, file: clippedFile, selection: selection(1, "1") }],
        options: watermarkOptions(),
        locale: "en-US",
        allowRiskyDocuments: true,
      }),
      (error: unknown) => error instanceof PdfFinishEngineError && error.code === "output-validation",
    );
  }
});

test("watermark tile cancellation interrupts placement generation and a retry succeeds", async () => {
  const source = await fixture("cancel-retry.pdf");
  const controller = new AbortController();
  const input = {
    files: [{ key: "cancel-retry", file: source, selection: selection(3, "1") }],
    options: watermarkOptions({ template: "A", fontSize: 6, margin: 0, watermark: { ...watermarkOptions().watermark, pattern: "tile" as const, rotation: 0, sizePercent: 10, gap: 10, offsetX: 0, offsetY: 0 } }),
    locale: "en-US",
  };
  await assert.rejects(
    finishPdfFiles({ ...input, signal: controller.signal, onProgress: (progress) => { if (progress.phase === "decorating") setTimeout(() => controller.abort(), 0); } }),
    (error: unknown) => error instanceof DOMException && error.name === "AbortError",
  );
  assert.equal((await finishPdfFiles(input)).length, 1);
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
