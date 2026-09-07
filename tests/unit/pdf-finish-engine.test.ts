import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PDFDict, PDFDocument, PDFName, PDFNumber, degrees } from "pdf-lib";

import {
  finishPdfFiles,
  pdfPageViewport,
  preflightPdfFiles,
  PdfFinishCanceledError,
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
