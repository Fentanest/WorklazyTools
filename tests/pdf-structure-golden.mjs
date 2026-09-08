import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createCanvas } from "@napi-rs/canvas";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFRef, PDFStream, decodePDFRawStream } from "pdf-lib";
import { PNG } from "pngjs";

import { PdfStructureError, rebuildPdfStructure } from "../src/features/pdf-editor/finish/structure.ts";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testsDirectory, "..");
const fixtureRoot = path.join(testsDirectory, "fixtures", "pdf-finish");
const manifest = JSON.parse(await fs.readFile(path.join(fixtureRoot, "manifest.json"), "utf8"));
const pdfjs = await import(path.join(repositoryRoot, "node_modules", "pdfjs-dist", "legacy", "build", "pdf.mjs"));
const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "worklazy-pdf-structure-golden-"));
const reportPath = path.resolve(process.env.PDF_STRUCTURE_GOLDEN_OUTPUT || path.join(temporaryRoot, "results.json"));
const key = (name) => PDFName.of(name);
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

function pixelStats(pngBytes) {
  const image = PNG.sync.read(pngBytes);
  let count = 0;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < image.height; y += 1) for (let x = 0; x < image.width; x += 1) {
    const index = (y * image.width + x) * 4;
    if (image.data[index] < 30 && image.data[index + 1] < 30 && image.data[index + 2] > 220) {
      count += 1;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  return { width: image.width, height: image.height, sha256: sha256(image.data), bluePixels: count, blueBox: [x0, y0, x1, y1] };
}

async function renderBoth(bytes, label) {
  const directory = path.join(temporaryRoot, label);
  await fs.mkdir(directory, { recursive: true });
  const pdfPath = path.join(directory, "input.pdf");
  await fs.writeFile(pdfPath, bytes);
  const task = pdfjs.getDocument({ data: Uint8Array.from(bytes), useSystemFonts: true });
  let pdfjsStats;
  try {
    const document = await task.promise;
    const page = await document.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const canvas = createCanvas(viewport.width, viewport.height);
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    pdfjsStats = pixelStats(canvas.toBuffer("image/png"));
  } finally {
    await task.destroy();
  }
  const prefix = path.join(directory, "poppler");
  const process = spawnSync("pdftoppm", ["-r", "72", "-singlefile", "-png", pdfPath, prefix], { encoding: "utf8" });
  assert.equal(process.status, 0, process.stderr);
  return { pdfjs: pdfjsStats, poppler: pixelStats(await fs.readFile(`${prefix}.png`)) };
}

function expectedPixelStats(oracle, renderer) {
  return {
    width: oracle.width,
    height: oracle.height,
    sha256: oracle[`${renderer}Sha256`],
    bluePixels: oracle.bluePixels,
    blueBox: oracle.blueBox,
  };
}

function inspectRelationships(document, sentinel) {
  const missingReferences = [];
  const brokenRelations = [];
  const parentlessPopups = [];
  const decodedSentinels = [];
  const visited = new Set();
  const visit = (value, where) => {
    if (value instanceof PDFRef) {
      const resolved = document.context.lookup(value);
      if (!resolved) {
        missingReferences.push({ where, reference: value.toString() });
        return;
      }
      value = resolved;
    }
    if (!value || visited.has(value)) return;
    visited.add(value);
    if (value instanceof PDFArray) {
      value.asArray().forEach((child, index) => visit(child, `${where}[${index}]`));
      return;
    }
    const dictionary = value instanceof PDFStream ? value.dict : value;
    if (!(dictionary instanceof PDFDict)) return;
    const subtype = document.context.lookup(dictionary.get(key("Subtype")))?.toString();
    if (subtype === "/Popup") {
      const parent = document.context.lookup(dictionary.get(key("Parent")));
      if (!(parent instanceof PDFDict)) parentlessPopups.push(where);
    }
    if (document.context.lookup(dictionary.get(key("Type")))?.toString() === "/Annot") {
      for (const relation of ["Popup", "IRT", "Parent"]) {
        const raw = dictionary.get(key(relation));
        if (raw && !(document.context.lookup(raw) instanceof PDFDict)) brokenRelations.push({ where, relation });
      }
    }
    for (const [entry, child] of dictionary.entries()) visit(child, `${where}.${entry.decodeText()}`);
  };
  for (const [reference, object] of document.context.enumerateIndirectObjects()) {
    visit(object, reference.toString());
    if (object instanceof PDFRawStream) {
      try {
        if (Buffer.from(decodePDFRawStream(object).decode()).includes(Buffer.from(sentinel))) decodedSentinels.push(reference.toString());
      } catch { /* Other validators own malformed stream rejection. */ }
    }
  }
  const annotationSubtypes = document.getPages().flatMap((page) => {
    const annotations = document.context.lookup(page.node.get(key("Annots")));
    if (!(annotations instanceof PDFArray)) return [];
    return annotations.asArray().map((raw) => {
      const annotation = document.context.lookup(raw);
      assert.ok(annotation instanceof PDFDict);
      return document.context.lookup(annotation.get(key("Subtype")))?.toString();
    });
  });
  return { annotationSubtypes, missingReferences, brokenRelations, parentlessPopups, decodedSentinels };
}

async function pdfjsAnnotationAudit(bytes) {
  const warnings = [];
  const originalWarning = console.warn;
  console.warn = (...values) => warnings.push(values.join(" "));
  const task = pdfjs.getDocument({ data: Uint8Array.from(bytes), useSystemFonts: true });
  try {
    const document = await task.promise;
    const annotations = (await Promise.all(Array.from({ length: document.numPages }, async (_, index) => (
      (await document.getPage(index + 1)).getAnnotations()
    )))).flat();
    return {
      annotationSubtypes: annotations.map(({ subtype }) => subtype),
      attachmentCount: (await document.getAttachments())?.size ?? 0,
      missingParentWarnings: warnings.filter((warning) => warning.includes("missing or invalid parent annotation")).length,
    };
  } finally {
    console.warn = originalWarning;
    await task.destroy();
  }
}

const appearanceResults = [];
for (const fixture of manifest.fixtures.filter(({ category, expectation }) => category === "appearance" && expectation.supported)) {
  const sourceBytes = await fs.readFile(path.join(fixtureRoot, fixture.file));
  const source = await renderBoth(sourceBytes, `${path.basename(fixture.file, ".pdf")}-source`);
  assert.deepEqual(source.pdfjs, expectedPixelStats(fixture.expectation.pixelOracle, "pdfjs"), `${fixture.file}: PDF.js source golden`);
  assert.deepEqual(source.poppler, expectedPixelStats(fixture.expectation.pixelOracle, "poppler"), `${fixture.file}: Poppler source golden`);
  const rebuilt = await rebuildPdfStructure(sourceBytes, {
    removeMetadata: false,
    removeAnnotations: false,
    removeAttachments: false,
    formMode: "flatten",
  });
  const outputBytes = Buffer.from(await rebuilt.document.save({ updateFieldAppearances: false }));
  const output = await renderBoth(outputBytes, `${path.basename(fixture.file, ".pdf")}-output`);
  assert.deepEqual(output.pdfjs, source.pdfjs, `${fixture.file}: PDF.js flatten changed pixels`);
  assert.deepEqual(output.poppler, source.poppler, `${fixture.file}: Poppler flatten changed pixels`);
  appearanceResults.push({ file: fixture.file, bbox: fixture.expectation.bbox, matrix: fixture.expectation.matrix, source, output });
}
assert.equal(appearanceResults.length, 5, "all five normal appearance variants must be checked");

const unsupportedAppearance = manifest.fixtures.find(({ category, expectation }) => category === "appearance" && !expectation.supported);
assert.ok(unsupportedAppearance);
await assert.rejects(
  rebuildPdfStructure(await fs.readFile(path.join(fixtureRoot, unsupportedAppearance.file)), {
    removeMetadata: false,
    removeAnnotations: false,
    removeAttachments: false,
    formMode: "flatten",
  }),
  (error) => error instanceof PdfStructureError && error.reason === "unsupported-form",
);

const relationshipFixture = manifest.fixtures.find(({ category }) => category === "relationships");
assert.ok(relationshipFixture);
const relationshipBytes = await fs.readFile(path.join(fixtureRoot, relationshipFixture.file));
const relationshipResults = [];
for (const specification of [
  { name: "preserve", removeAttachments: false, removeAnnotations: false, subtypes: ["/FileAttachment", "/Popup", "/Text", "/Popup", "/FreeText"], payloads: 1, attachments: 1 },
  { name: "attachments-only", removeAttachments: true, removeAnnotations: false, subtypes: ["/Text", "/Popup", "/FreeText"], payloads: 0, attachments: 0 },
  { name: "annotations-only", removeAttachments: false, removeAnnotations: true, subtypes: ["/FileAttachment"], payloads: 1, attachments: 1 },
  { name: "attachments-and-annotations", removeAttachments: true, removeAnnotations: true, subtypes: [], payloads: 0, attachments: 0 },
]) {
  const rebuilt = await rebuildPdfStructure(relationshipBytes, {
    removeMetadata: false,
    removeAnnotations: specification.removeAnnotations,
    removeAttachments: specification.removeAttachments,
    formMode: "preserve",
  });
  const outputBytes = Buffer.from(await rebuilt.document.save({ updateFieldAppearances: false }));
  const output = await PDFDocument.load(outputBytes, { updateMetadata: false });
  const audit = inspectRelationships(output, relationshipFixture.expectation.attachmentSentinel);
  const highLevel = await pdfjsAnnotationAudit(outputBytes);
  assert.deepEqual(audit.annotationSubtypes, specification.subtypes, specification.name);
  assert.equal(audit.decodedSentinels.length, specification.payloads, specification.name);
  assert.deepEqual(audit.missingReferences, [], specification.name);
  assert.deepEqual(audit.brokenRelations, [], specification.name);
  assert.deepEqual(audit.parentlessPopups, [], specification.name);
  assert.equal(highLevel.attachmentCount, specification.attachments, specification.name);
  assert.equal(highLevel.missingParentWarnings, 0, specification.name);
  relationshipResults.push({ name: specification.name, bytes: outputBytes.length, audit, highLevel });
}

const report = { appearanceResults, unsupportedAppearance: unsupportedAppearance.file, relationshipResults };
await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(`PDF structure golden passed: ${appearanceResults.length} appearance variants × 2 renderers; ${relationshipResults.length} attachment/annotation combinations; 0 parentless popups.`);
