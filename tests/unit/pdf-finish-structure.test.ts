import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFStream,
  decodePDFRawStream,
} from "pdf-lib";

import { PdfStructureError, rebuildPdfStructure, type PdfStructureOptions } from "../../src/features/pdf-editor/finish/structure.ts";

const fixtureRoot = path.resolve(import.meta.dirname, "../fixtures/pdf-finish");
const removalPath = path.join(fixtureRoot, "removal/removal-structures.pdf");
const removeEverything: PdfStructureOptions = {
  removeMetadata: true,
  removeAnnotations: true,
  removeAttachments: true,
  formMode: "remove",
};
const key = (name: string) => PDFName.of(name);
const lookup = (document: PDFDocument, dictionary: PDFDict, name: string) => document.context.lookup(dictionary.get(key(name)));
const nameOf = (value: unknown) => value?.toString();

function inspectEveryIndirectObject(document: PDFDocument) {
  const seen = new Set<unknown>();
  const rows: Array<{ reference: string; type?: string; subtype?: string; keys: string[]; decoded: Buffer }> = [];
  const visit = (value: unknown, reference: string) => {
    const object = document.context.lookup(value as never);
    if (!object || seen.has(object)) return;
    seen.add(object);
    if (object instanceof PDFArray) {
      for (const child of object.asArray()) visit(child, reference);
      return;
    }
    const dictionary = object instanceof PDFStream ? object.dict : object;
    if (!(dictionary instanceof PDFDict)) return;
    let decoded = Buffer.alloc(0);
    if (object instanceof PDFRawStream) {
      try { decoded = Buffer.from(decodePDFRawStream(object).decode()); } catch { /* A malformed stream is still inspected by dictionary. */ }
    }
    rows.push({
      reference,
      type: nameOf(lookup(document, dictionary, "Type")),
      subtype: nameOf(lookup(document, dictionary, "Subtype")),
      keys: dictionary.keys().map((entry) => entry.decodeText()).sort(),
      decoded,
    });
    for (const [, child] of dictionary.entries()) visit(child, reference);
  };
  for (const [reference, object] of document.context.enumerateIndirectObjects()) visit(object, reference.toString());
  return rows;
}

function pageAnnotationSubtypes(document: PDFDocument) {
  return document.getPages().flatMap((page) => {
    const annotations = document.context.lookup(page.node.get(key("Annots")));
    if (!(annotations instanceof PDFArray)) return [];
    return annotations.asArray().map((value) => {
      const annotation = document.context.lookup(value);
      assert.ok(annotation instanceof PDFDict);
      return nameOf(lookup(document, annotation, "Subtype"));
    });
  });
}

test("structure removal rebuilds a reachable-only document, preserves all three link kinds, and leaves no decoded orphan", async () => {
  const sourceBytes = await fs.readFile(removalPath);
  const source = await PDFDocument.load(sourceBytes, { updateMetadata: false });
  const sourcePageGeometry = source.getPages().map((page) => ({
    media: page.getMediaBox(), crop: page.getCropBox(), rotation: page.getRotation().angle,
  }));
  const rebuilt = await rebuildPdfStructure(sourceBytes, removeEverything);
  assert.equal(rebuilt.expectedLinks, 3);
  const outputBytes = Buffer.from(await rebuilt.document.save({ updateFieldAppearances: false }));
  const output = await PDFDocument.load(outputBytes, { updateMetadata: false });

  assert.deepEqual(output.getPages().map((page) => ({
    media: page.getMediaBox(), crop: page.getCropBox(), rotation: page.getRotation().angle,
  })), sourcePageGeometry);
  assert.ok(output.catalog.has(key("Outlines")));
  assert.ok(output.catalog.has(key("Names")));
  assert.ok(output.catalog.has(key("Dests")));
  assert.ok(output.catalog.has(key("PageLabels")));
  assert.ok(output.catalog.has(key("ViewerPreferences")));
  assert.equal(output.catalog.has(key("Metadata")), false);
  assert.equal(output.catalog.has(key("AcroForm")), false);
  assert.equal(output.catalog.has(key("AF")), false);
  assert.equal(output.context.trailerInfo.Info, undefined);
  const names = lookup(output, output.catalog, "Names");
  assert.ok(names instanceof PDFDict);
  assert.deepEqual(names.keys().map((entry) => entry.decodeText()), ["Dests"]);

  const annotations = output.context.lookup(output.getPage(0).node.get(key("Annots")));
  assert.ok(annotations instanceof PDFArray);
  const linkKinds = annotations.asArray().map((value) => {
    const annotation = output.context.lookup(value);
    assert.ok(annotation instanceof PDFDict);
    assert.equal(nameOf(lookup(output, annotation, "Subtype")), "/Link");
    const destination = output.context.lookup(annotation.get(key("Dest")));
    const action = output.context.lookup(annotation.get(key("A")));
    if (action instanceof PDFDict && nameOf(lookup(output, action, "S")) === "/URI") return "URI";
    if (destination instanceof PDFArray) return "direct-destination";
    return "named-destination";
  }).sort();
  assert.deepEqual(linkKinds, ["URI", "direct-destination", "named-destination"]);
  assert.deepEqual(pageAnnotationSubtypes(output), ["/Link", "/Link", "/Link"]);

  const rows = inspectEveryIndirectObject(output);
  const forbiddenKeys = new Set(["AF", "EmbeddedFiles", "Metadata", "AcroForm", "StructTreeRoot", "StructParents", "StructParent", "ParentTree", "MCID", "MarkInfo", "OCProperties", "OC"]);
  const forbiddenTypes = new Set(["/Filespec", "/EmbeddedFile", "/Metadata", "/OCG", "/OCMD"]);
  const forbiddenSubtypes = new Set(["/Widget", "/FileAttachment", "/Text", "/FreeText", "/Highlight", "/Ink", "/Stamp", "/Square", "/Circle", "/Popup", "/Line", "/Polygon", "/Caret", "/Redact"]);
  for (const row of rows) {
    assert.equal(forbiddenTypes.has(row.type ?? ""), false, `${row.reference}:${row.type}`);
    assert.equal(forbiddenSubtypes.has(row.subtype ?? ""), false, `${row.reference}:${row.subtype}`);
    assert.deepEqual(row.keys.filter((entry) => forbiddenKeys.has(entry)), [], `${row.reference}:${row.keys.join(",")}`);
    assert.equal(row.decoded.includes(Buffer.from("PDF finish embedded attachment sentinel")), false, `${row.reference}: attachment payload orphan`);
    assert.equal(row.decoded.includes(Buffer.from("<pdf:Keywords>remove-me</pdf:Keywords>")), false, `${row.reference}: XMP payload orphan`);
  }
  assert.equal(outputBytes.includes(Buffer.from("PDF finish embedded attachment sentinel")), false);
  assert.equal(outputBytes.includes(Buffer.from("<pdf:Keywords>remove-me</pdf:Keywords>")), false);

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: Uint8Array.from(outputBytes), useSystemFonts: true });
  try {
    const parsed = await task.promise;
    const highLevelAnnotations = (await Promise.all(Array.from({ length: parsed.numPages }, async (_, index) => (
      (await parsed.getPage(index + 1)).getAnnotations()
    )))).flat();
    assert.equal(highLevelAnnotations.length, 3);
    assert.equal(highLevelAnnotations.filter((annotation) => annotation.url).length, 1);
    assert.equal(highLevelAnnotations.filter((annotation) => Array.isArray(annotation.dest)).length, 1);
    assert.equal(highLevelAnnotations.filter((annotation) => typeof annotation.dest === "string").length, 1);
    assert.equal(await parsed.getAttachments(), null);
    assert.equal((await parsed.getOutline())?.length, 1);
    assert.deepEqual(await parsed.getPageLabels(), ["i", "A-1"]);
    const viewerPreferences = Object.fromEntries(await parsed.getViewerPreferences());
    assert.equal(viewerPreferences.HideToolbar, true);
    assert.equal(viewerPreferences.Duplex, "DuplexFlipLongEdge");
    const metadata = await parsed.getMetadata();
    assert.equal(metadata.metadata, null);
    assert.equal("Title" in metadata.info, false);
    assert.equal("Producer" in metadata.info, false);
  } finally {
    await task.destroy();
  }
});

test("form preserve, remove, and flatten are mutually exclusive and flatten keeps page appearances without fields", async () => {
  const bytes = await fs.readFile(removalPath);
  const outputs = new Map<string, PDFDocument>();
  for (const formMode of ["preserve", "remove", "flatten"] as const) {
    const rebuilt = await rebuildPdfStructure(bytes, { ...removeEverything, formMode });
    const reopened = await PDFDocument.load(await rebuilt.document.save({ updateFieldAppearances: false }), { updateMetadata: false });
    outputs.set(formMode, reopened);
    const subtypes = pageAnnotationSubtypes(reopened);
    assert.equal(reopened.catalog.has(key("AcroForm")), formMode === "preserve");
    assert.equal(subtypes.includes("/Widget"), formMode === "preserve");
  }
  const removeContents = outputs.get("remove")?.getPage(0).node.get(key("Contents"))?.toString();
  const flattenContents = outputs.get("flatten")?.getPage(0).node.get(key("Contents"))?.toString();
  assert.notEqual(flattenContents, removeContents, "flatten must add the existing field appearance to page content");
});

test("flatten blocks XFA, signatures, and missing or malformed appearances, and structure cleanup blocks an excluded OCG fixture", async () => {
  const bytes = await fs.readFile(removalPath);
  const xfa = await PDFDocument.load(bytes, { updateMetadata: false });
  const acroForm = lookup(xfa, xfa.catalog, "AcroForm");
  assert.ok(acroForm instanceof PDFDict);
  acroForm.set(key("XFA"), xfa.context.obj(["template", "unsupported"]));
  await assert.rejects(
    rebuildPdfStructure(await xfa.save({ updateFieldAppearances: false }), { ...removeEverything, formMode: "flatten" }),
    (error: unknown) => error instanceof PdfStructureError && error.reason === "unsupported-form",
  );

  const missingAppearance = await PDFDocument.load(bytes, { updateMetadata: false });
  for (const [, object] of missingAppearance.context.enumerateIndirectObjects()) {
    if (object instanceof PDFDict && nameOf(lookup(missingAppearance, object, "Subtype")) === "/Widget") object.delete(key("AP"));
  }
  await assert.rejects(
    rebuildPdfStructure(await missingAppearance.save({ updateFieldAppearances: false }), { ...removeEverything, formMode: "flatten" }),
    (error: unknown) => error instanceof PdfStructureError && error.reason === "unsupported-form",
  );

  const signature = await PDFDocument.load(bytes, { updateMetadata: false });
  for (const [, object] of signature.context.enumerateIndirectObjects()) {
    if (object instanceof PDFDict && nameOf(lookup(signature, object, "Subtype")) === "/Widget") object.set(key("FT"), key("Sig"));
  }
  await assert.rejects(
    rebuildPdfStructure(await signature.save({ updateFieldAppearances: false }), { ...removeEverything, formMode: "flatten" }),
    (error: unknown) => error instanceof PdfStructureError && error.reason === "unsupported-form",
  );

  const malformedAppearance = await PDFDocument.load(bytes, { updateMetadata: false });
  for (const [, object] of malformedAppearance.context.enumerateIndirectObjects()) {
    if (object instanceof PDFDict && nameOf(lookup(malformedAppearance, object, "Subtype")) === "/Widget") {
      const appearance = lookup(malformedAppearance, object, "AP");
      if (appearance instanceof PDFDict) appearance.set(key("N"), key("BrokenAppearance"));
    }
  }
  await assert.rejects(
    rebuildPdfStructure(await malformedAppearance.save({ updateFieldAppearances: false }), { ...removeEverything, formMode: "flatten" }),
    (error: unknown) => error instanceof PdfStructureError && error.reason === "unsupported-form",
  );

  const manifest = JSON.parse(await fs.readFile(path.join(fixtureRoot, "manifest.json"), "utf8"));
  const excluded = manifest.ocg.files.find((fixture: { preflight: { allowed: boolean } }) => !fixture.preflight.allowed);
  await assert.rejects(
    rebuildPdfStructure(await fs.readFile(path.join(fixtureRoot, excluded.file)), removeEverything),
    (error: unknown) => error instanceof PdfStructureError && error.reason === "unsupported-structure",
  );
});
