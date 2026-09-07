import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { PDFDocument, degrees } from "pdf-lib";

import { finishPdfFiles, pdfPageViewport } from "../../src/features/pdf-editor/finish/engine.ts";
import { createPageSelection } from "../../src/features/pdf-editor/finish/selection.ts";

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
