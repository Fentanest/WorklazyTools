import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream, rgb } from "pdf-lib";
import { PNG } from "pngjs";

import { finishPdfFiles } from "../src/features/pdf-editor/finish/engine.ts";
import { createPageSelection } from "../src/features/pdf-editor/finish/selection.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactDirectory = path.resolve(process.env.PDF_COMBINED_ARTIFACTS || "/tmp/worklazy-u4-8/combined-golden");
await fs.mkdir(artifactDirectory, { recursive: true });

const image = new PNG({ width: 40, height: 20 });
for (let offset = 0; offset < image.data.length; offset += 4) {
  image.data[offset] = 220;
  image.data[offset + 1] = 30;
  image.data[offset + 2] = 45;
  image.data[offset + 3] = 255;
}
const imageFile = new File([PNG.sync.write(image)], "combined.png", { type: "image/png" });
const decorations = ["number", "header", "watermark", "stamp"];
const cases = [];
for (let left = 0; left < decorations.length; left += 1) {
  for (let right = left + 1; right < decorations.length; right += 1) {
    cases.push({ id: `${decorations[left]}-${decorations[right]}`, enabled: [decorations[left], decorations[right]], layer: "foreground" });
  }
}
cases.push(
  { id: "all-foreground", enabled: decorations, layer: "foreground" },
  { id: "all-background", enabled: decorations, layer: "background" },
);

const summary = {};
for (const testCase of cases) {
  const result = await createOutput(testCase);
  summary[testCase.id] = await auditOutput(result.bytes, testCase);
  await fs.writeFile(path.join(artifactDirectory, `${testCase.id}.pdf`), result.bytes);
  await result.dispose();
}

const expected = JSON.parse(await fs.readFile(path.join(root, "tests/fixtures/pdf-finish-combined-golden.json"), "utf8"));
assert.deepEqual(summary, expected, "combined decoration structure changed from the reviewed golden");

const mutantCase = { id: "all-foreground", enabled: decorations, layer: "foreground" };
const mutant = await createOutput(mutantCase, true);
await assert.rejects(() => auditOutput(mutant.bytes, mutantCase), /missing text decoration/u);
await mutant.dispose();

console.log(`PDF finish combined golden passed: ${cases.length} pairwise/all-on outputs and one omission mutant. Artifacts: ${artifactDirectory}`);

async function createOutput(testCase, omitText = false) {
  const document = await PDFDocument.create({ updateMetadata: false });
  const page = document.addPage([300, 240]);
  page.drawRectangle({ x: 40, y: 40, width: 220, height: 160, color: rgb(0.1, 0.2, 0.8) });
  const file = new File([await document.save()], "combined-source.pdf", { type: "application/pdf" });
  const selection = createPageSelection(1, "1", "all", { startPage: 1, excludeCover: false });
  assert.ok(!("error" in selection));
  const has = (name) => testCase.enabled.includes(name);
  const textDecorations = omitText ? [] : [
    ...(has("number") ? [textOption("PAGE-{page}", "bottom-center")] : []),
    ...(has("header") ? [textOption("HEADER-A", "top-center")] : []),
  ];
  const [output] = await finishPdfFiles({
    files: [{ key: testCase.id, file, selection }],
    options: {
      ...textOption("WATERMARK", "bottom-center"),
      region: "center",
      textDecorations,
      watermark: has("watermark") ? {
        content: "image",
        image: imageFile,
        layer: testCase.layer,
        pattern: "single",
        region: "center",
        rotation: -20,
        opacity: 0.55,
        sizePercent: 45,
        gap: 20,
        offsetX: 0,
        offsetY: 0,
      } : undefined,
      stamp: has("stamp") ? { image: imageFile, placement: { cx: 0.78, cy: 0.77, rw: 0.2, aspect: 2 } } : undefined,
    },
    locale: "en-US",
    clock: () => new Date("2026-09-09T00:00:00.000Z"),
  });
  return { bytes: new Uint8Array(await output.blob.arrayBuffer()), dispose: output.dispose };
}

function textOption(template, region) {
  return { template, region, fontSize: 10, color: "#202024", margin: 18, startNumber: 1, startPage: 1, excludeCover: false, opacity: 0.9 };
}

async function auditOutput(bytes, testCase) {
  const expectedText = [
    ...(testCase.enabled.includes("number") ? ["PAGE-1"] : []),
    ...(testCase.enabled.includes("header") ? ["HEADER-A"] : []),
  ];
  const loadingTask = (await import("pdfjs-dist/legacy/build/pdf.mjs")).getDocument({ data: bytes.slice() });
  let extracted;
  try {
    const pdfjs = await loadingTask.promise;
    extracted = (await (await pdfjs.getPage(1)).getTextContent()).items.map((item) => item.str).filter(Boolean);
  } finally {
    await loadingTask.destroy();
  }
  for (const text of expectedText) assert.ok(extracted.includes(text), `missing text decoration: ${text}`);

  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  const page = document.getPage(0);
  const contents = document.context.lookup(page.node.get(PDFName.of("Contents")));
  assert.ok(contents instanceof PDFArray);
  const rawOrder = contents.asArray().map((entry) => document.context.lookup(entry)).map((stream) => {
    assert.ok(stream instanceof PDFRawStream, `unexpected content object: ${stream?.constructor?.name ?? typeof stream}`);
    const body = Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
    if (/\/Stamp[^\s]*\s+Do/u.test(body)) return "stamp";
    if (/\/Watermark[^\s]*\s+Do/u.test(body)) return "watermark";
    if (/\bBT\b/u.test(body)) return "text";
    return "original";
  });
  const order = rawOrder.filter((kind, index) => kind !== "original" || rawOrder[index - 1] !== "original");
  const resources = document.context.lookup(page.node.get(PDFName.of("Resources")));
  assert.ok(resources instanceof PDFDict);
  const fonts = document.context.lookup(resources.get(PDFName.of("Font")));
  const xobjects = document.context.lookup(resources.get(PDFName.of("XObject")));
  const fontCount = fonts instanceof PDFDict ? new Set(fonts.entries().map(([, reference]) => reference.toString())).size : 0;
  const xobjectCount = xobjects instanceof PDFDict ? xobjects.entries().length : 0;
  assert.equal(fontCount, expectedText.length ? 1 : 0, "same-font decorations must share one Font resource");
  assert.equal(xobjectCount, Number(testCase.enabled.includes("watermark")) + Number(testCase.enabled.includes("stamp")));

  const expectedOrder = [
    ...(testCase.layer === "background" && testCase.enabled.includes("watermark") ? ["watermark"] : []),
    "original",
    ...(testCase.layer === "foreground" && testCase.enabled.includes("watermark") ? ["watermark"] : []),
    ...(expectedText.length ? ["text"] : []),
    ...(testCase.enabled.includes("stamp") ? ["stamp"] : []),
  ];
  assert.deepEqual(order, expectedOrder, "combined decorations are not in canonical order");
  return { text: extracted, order, fontCount, xobjectCount };
}
