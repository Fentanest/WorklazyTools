import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFObjectCopier,
  PDFPage,
  PDFRawStream,
  PDFRef,
  PDFStream,
  PDFString,
} from "pdf-lib";

import { classifyOcgPreflight, flattenSupportedDocumentStructure } from "./preflight.ts";

type PdfValue = any;

export type PdfFormMode = "preserve" | "remove" | "flatten";

export interface PdfStructureOptions {
  removeMetadata: boolean;
  removeAnnotations: boolean;
  removeAttachments: boolean;
  formMode: PdfFormMode;
}

export interface PdfStructureResult {
  document: PDFDocument;
  expectedLinks: number;
}

export class PdfStructureError extends Error {
  readonly reason: "unsupported-structure" | "unsupported-form" | "validation";

  constructor(reason: "unsupported-structure" | "unsupported-form" | "validation") {
    super(`PDF_STRUCTURE_${reason.toUpperCase().replaceAll("-", "_")}`);
    this.name = "PdfStructureError";
    this.reason = reason;
  }
}

const key = (name: string) => PDFName.of(name);
const lookup = (document: PDFDocument, dictionary: PdfValue, name: string): PdfValue => document.context.lookup(dictionary?.get(key(name)));
const nameOf = (value: PdfValue) => value?.toString();
const annotationMarkup = new Set([
  "/Text", "/FreeText", "/Line", "/Square", "/Circle", "/Polygon", "/PolyLine",
  "/Highlight", "/Underline", "/Squiggly", "/StrikeOut", "/Stamp", "/Caret", "/Ink",
  "/Popup", "/Redact",
]);
const actionTypes = new Set(["/URI", "/GoTo", "/GoToR", "/GoToE", "/Launch", "/Thread", "/Sound", "/Movie", "/Hide", "/Named", "/SubmitForm", "/ResetForm", "/ImportData", "/JavaScript", "/SetOCGState", "/Rendition", "/Trans"]);

export function hasStructureChanges(options?: PdfStructureOptions) {
  return !!options && (options.removeMetadata || options.removeAnnotations || options.removeAttachments || options.formMode !== "preserve");
}

function destinationSupported(document: PDFDocument, value: PdfValue, pageRefs: Set<string>) {
  const resolved = document.context.lookup(value);
  if (resolved instanceof PDFName || resolved instanceof PDFString || resolved instanceof PDFHexString) return true;
  if (!(resolved instanceof PDFArray) || !resolved.size()) return false;
  const first = resolved.get(0);
  return first instanceof PDFRef && pageRefs.has(first.toString());
}

function actionSupported(document: PDFDocument, value: PdfValue, pageRefs: Set<string>, allowUri: boolean) {
  const action = document.context.lookup(value);
  if (!(action instanceof PDFDict)) return false;
  action.delete(key("Next"));
  const type = nameOf(lookup(document, action, "S"));
  if (type === "/URI") return allowUri && !!action.get(key("URI"));
  return type === "/GoTo" && destinationSupported(document, action.get(key("D")), pageRefs);
}

function sanitizeLinksAndAnnotations(document: PDFDocument, options: PdfStructureOptions) {
  const pageRefs = new Set(document.getPages().map((page) => page.ref.toString()));
  const removed = new Set<PdfValue>();
  let expectedLinks = 0;
  for (const page of document.getPages()) {
    if (options.removeAttachments) page.node.delete(key("AF"));
    if (options.removeMetadata) page.node.delete(key("Metadata"));
    page.node.delete(key("StructParents"));
    const annotations = lookup(document, page.node, "Annots");
    if (!(annotations instanceof PDFArray)) continue;
    for (let index = annotations.size() - 1; index >= 0; index -= 1) {
      const raw = annotations.get(index);
      const annotation = document.context.lookup(raw);
      const subtype = annotation instanceof PDFDict ? nameOf(lookup(document, annotation, "Subtype")) : undefined;
      let keep = annotation instanceof PDFDict;
      if (subtype === "/Link" && annotation instanceof PDFDict) {
        const direct = annotation.get(key("Dest"));
        const action = annotation.get(key("A"));
        if (direct && !destinationSupported(document, direct, pageRefs)) annotation.delete(key("Dest"));
        if (action && !actionSupported(document, action, pageRefs, true)) annotation.delete(key("A"));
        keep = !!annotation.get(key("Dest")) || !!annotation.get(key("A"));
        if (keep) expectedLinks += 1;
      } else if (subtype === "/Widget") keep = options.formMode === "preserve";
      else if (subtype === "/FileAttachment") keep = !options.removeAttachments;
      else if (annotationMarkup.has(subtype ?? "")) keep = !options.removeAnnotations;
      else keep = false;
      if (annotation instanceof PDFDict) annotation.delete(key("StructParent"));
      if (!keep) {
        removed.add(raw);
        removed.add(annotation);
        annotations.remove(index);
      }
    }
  }
  for (const page of document.getPages()) {
    const annotations = lookup(document, page.node, "Annots");
    if (!(annotations instanceof PDFArray)) continue;
    for (const raw of annotations.asArray()) {
      const annotation = document.context.lookup(raw);
      if (!(annotation instanceof PDFDict) || nameOf(lookup(document, annotation, "Subtype")) === "/Widget") continue;
      for (const relation of ["Popup", "IRT", "Parent"]) {
        const value = annotation.get(key(relation));
        if (removed.has(value) || removed.has(document.context.lookup(value))) annotation.delete(key(relation));
      }
    }
  }
  return { expectedLinks, pageRefs };
}

function formFieldType(document: PDFDocument, field: PDFDict): string | undefined {
  const seen = new Set<PdfValue>();
  let current: PdfValue = field;
  while (current instanceof PDFDict && !seen.has(current)) {
    seen.add(current);
    const type = nameOf(lookup(document, current, "FT"));
    if (type) return type;
    current = lookup(document, current, "Parent");
  }
  return undefined;
}

function appearanceSupported(document: PDFDocument, widget: PDFDict) {
  const appearance = lookup(document, widget, "AP");
  const normal = appearance instanceof PDFDict ? document.context.lookup(appearance.get(key("N"))) : undefined;
  if (normal instanceof PDFRawStream) return true;
  return normal instanceof PDFDict && normal.entries().some(([, value]) => document.context.lookup(value) instanceof PDFRawStream);
}

function applyFormMode(document: PDFDocument, mode: PdfFormMode) {
  const acroForm = lookup(document, document.catalog, "AcroForm");
  if (!(acroForm instanceof PDFDict) || mode === "preserve") return;
  if (mode === "flatten") {
    if (acroForm.has(key("XFA"))) throw new PdfStructureError("unsupported-form");
    for (const [, object] of document.context.enumerateIndirectObjects()) if (object instanceof PDFDict) {
      if (formFieldType(document, object) === "/Sig") throw new PdfStructureError("unsupported-form");
      if (nameOf(lookup(document, object, "Subtype")) === "/Widget" && !appearanceSupported(document, object)) {
        throw new PdfStructureError("unsupported-form");
      }
    }
    try { document.getForm().flatten({ updateFieldAppearances: false }); }
    catch { throw new PdfStructureError("unsupported-form"); }
  }
  document.catalog.delete(key("AcroForm"));
}

function sanitizeCatalog(document: PDFDocument, options: PdfStructureOptions, pageRefs: Set<string>) {
  document.catalog.delete(key("OpenAction"));
  document.catalog.delete(key("AA"));
  document.catalog.delete(key("StructTreeRoot"));
  document.catalog.delete(key("MarkInfo"));
  if (options.removeMetadata) document.catalog.delete(key("Metadata"));
  if (options.removeAttachments) document.catalog.delete(key("AF"));
  const names = lookup(document, document.catalog, "Names");
  if (names instanceof PDFDict) for (const [entry] of names.entries()) {
    const name = entry.decodeText();
    if (name !== "Dests" && !(name === "EmbeddedFiles" && !options.removeAttachments)) names.delete(entry);
  }
  const outlines = lookup(document, document.catalog, "Outlines");
  const seen = new Set<PdfValue>();
  function sanitizeOutline(value: PdfValue) {
    const outline = document.context.lookup(value);
    if (!(outline instanceof PDFDict) || seen.has(outline)) return;
    seen.add(outline);
    const destination = outline.get(key("Dest"));
    if (destination && !destinationSupported(document, destination, pageRefs)) outline.delete(key("Dest"));
    const action = outline.get(key("A"));
    if (action && !actionSupported(document, action, pageRefs, false)) outline.delete(key("A"));
    sanitizeOutline(outline.get(key("First")));
    sanitizeOutline(outline.get(key("Next")));
  }
  sanitizeOutline(outlines?.get(key("First")));
}

function scrubObjectGraph(document: PDFDocument, options: PdfStructureOptions) {
  const forbidden = (value: PdfValue) => {
    const object = document.context.lookup(value);
    if (!(object instanceof PDFDict) && !(object instanceof PDFRawStream)) return false;
    const dictionary = object instanceof PDFRawStream ? object.dict : object;
    const type = nameOf(lookup(document, dictionary, "Type"));
    const subtype = nameOf(lookup(document, dictionary, "Subtype"));
    return options.removeAttachments && (type === "/Filespec" || type === "/EmbeddedFile" || subtype === "/FileAttachment")
      || options.formMode !== "preserve" && subtype === "/Widget"
      || options.removeAnnotations && annotationMarkup.has(subtype ?? "");
  };
  const seen = new Set<PdfValue>();
  const visit = (value: PdfValue) => {
    const object = document.context.lookup(value);
    if (!object || seen.has(object)) return;
    seen.add(object);
    if (object instanceof PDFArray) {
      for (let index = object.size() - 1; index >= 0; index -= 1) {
        if (forbidden(object.get(index))) object.remove(index);
        else visit(object.get(index));
      }
      return;
    }
    const dictionary = object instanceof PDFStream ? object.dict : object;
    if (!(dictionary instanceof PDFDict)) return;
    for (const [entry, child] of [...dictionary.entries()]) {
      const name = entry.decodeText();
      if (forbidden(child)
          || options.removeAttachments && (name === "AF" || name === "EmbeddedFiles")
          || options.removeMetadata && name === "Metadata") {
        dictionary.delete(entry);
        continue;
      }
      visit(child);
    }
    for (const name of ["StructTreeRoot", "StructParents", "StructParent", "ParentTree", "MCID", "MarkInfo", "AA"]) dictionary.delete(key(name));
    const action = dictionary.get(key("A"));
    if (action) {
      const resolved = document.context.lookup(action);
      if (!(resolved instanceof PDFDict) || !["/URI", "/GoTo"].includes(nameOf(lookup(document, resolved, "S")) ?? "")) dictionary.delete(key("A"));
      else resolved.delete(key("Next"));
    }
  };
  for (const [, object] of document.context.enumerateIndirectObjects()) visit(object);
}

async function copyReachableDocument(source: PDFDocument, options: PdfStructureOptions) {
  const destination = await PDFDocument.create({ updateMetadata: false });
  const copier = PDFObjectCopier.for(source.context, destination.context) as unknown as {
    copy: (value: PdfValue) => PdfValue;
    traversedObjects: Map<PdfValue, PdfValue>;
  };
  const pages = source.getPages();
  const destinationRefs = pages.map(() => destination.context.nextRef());
  pages.forEach((page, index) => copier.traversedObjects.set(page.ref, destinationRefs[index]));
  pages.forEach((page, index) => {
    const node = copier.copy(page.node);
    destination.context.assign(destinationRefs[index], node);
    destination.addPage(PDFPage.of(node, destinationRefs[index], destination));
  });
  const roots = ["Outlines", "PageLabels", "ViewerPreferences", "Dests", "Names"];
  if (!options.removeMetadata) roots.push("Metadata");
  if (options.formMode === "preserve") roots.push("AcroForm");
  if (!options.removeAttachments) roots.push("AF");
  for (const name of roots) {
    const value = source.catalog.get(key(name));
    if (value) destination.catalog.set(key(name), copier.copy(value));
  }
  if (!options.removeMetadata && source.context.trailerInfo.Info) {
    destination.context.trailerInfo.Info = copier.copy(source.context.trailerInfo.Info);
  }
  return destination;
}

function validateRebuiltDocument(document: PDFDocument, options: PdfStructureOptions, expectedLinks: number) {
  if (options.removeMetadata && document.context.trailerInfo.Info) throw new PdfStructureError("validation");
  const forbiddenStructureKeys = new Set(["StructTreeRoot", "StructParents", "StructParent", "ParentTree", "MCID", "MarkInfo", "OCProperties", "OC", "AA", "OpenAction"]);
  const seen = new Set<PdfValue>();
  const visit = (value: PdfValue) => {
    const object = document.context.lookup(value);
    if (!object || seen.has(object)) return;
    seen.add(object);
    if (object instanceof PDFArray) {
      for (const child of object.asArray()) visit(child);
      return;
    }
    const dictionary = object instanceof PDFStream ? object.dict : object;
    if (!(dictionary instanceof PDFDict)) return;
    const type = nameOf(lookup(document, dictionary, "Type"));
    const subtype = nameOf(lookup(document, dictionary, "Subtype"));
    if (type === "/OCG" || type === "/OCMD") throw new PdfStructureError("validation");
    if (options.removeMetadata && (type === "/Metadata" || dictionary.has(key("Metadata")))) throw new PdfStructureError("validation");
    if (options.removeAttachments && (type === "/Filespec" || type === "/EmbeddedFile" || subtype === "/FileAttachment")) throw new PdfStructureError("validation");
    if (options.formMode !== "preserve" && (subtype === "/Widget" || dictionary.has(key("FT")))) throw new PdfStructureError("validation");
    if (options.removeAnnotations && annotationMarkup.has(subtype ?? "")) throw new PdfStructureError("validation");
    if (type === "/Annot") {
      const allowed = subtype === "/Link"
        || subtype === "/Widget" && options.formMode === "preserve"
        || subtype === "/FileAttachment" && !options.removeAttachments
        || annotationMarkup.has(subtype ?? "") && !options.removeAnnotations;
      if (!allowed) throw new PdfStructureError("validation");
    }
    for (const [entry, child] of dictionary.entries()) {
      const name = entry.decodeText();
      if (forbiddenStructureKeys.has(name)
          || options.removeAttachments && (name === "AF" || name === "EmbeddedFiles")
          || options.removeMetadata && name === "Metadata") throw new PdfStructureError("validation");
      visit(child);
    }
    const actionType = nameOf(lookup(document, dictionary, "S"));
    if (actionType && actionTypes.has(actionType)) {
      if (!["/URI", "/GoTo"].includes(actionType) || dictionary.has(key("Next"))) throw new PdfStructureError("validation");
    }
  };
  for (const [, object] of document.context.enumerateIndirectObjects()) visit(object);

  const pageRefs = new Set(document.getPages().map((page) => page.ref.toString()));
  let links = 0;
  for (const page of document.getPages()) {
    const annotations = lookup(document, page.node, "Annots");
    if (!(annotations instanceof PDFArray)) continue;
    for (const value of annotations.asArray()) {
      const annotation = document.context.lookup(value);
      if (!(annotation instanceof PDFDict) || nameOf(lookup(document, annotation, "Subtype")) !== "/Link") continue;
      const direct = annotation.get(key("Dest"));
      const action = annotation.get(key("A"));
      if (direct && !destinationSupported(document, direct, pageRefs)) throw new PdfStructureError("validation");
      if (action && !actionSupported(document, action, pageRefs, true)) throw new PdfStructureError("validation");
      if (!direct && !action) throw new PdfStructureError("validation");
      links += 1;
    }
  }
  if (links !== expectedLinks) throw new PdfStructureError("validation");
}

export async function rebuildPdfStructure(bytes: ArrayBuffer | Uint8Array, options: PdfStructureOptions): Promise<PdfStructureResult> {
  const classified = await classifyOcgPreflight(bytes);
  if (!classified.allowed) throw new PdfStructureError("unsupported-structure");
  const source = await PDFDocument.load(bytes, { updateMetadata: false });
  flattenSupportedDocumentStructure(source);
  applyFormMode(source, options.formMode);
  const { expectedLinks, pageRefs } = sanitizeLinksAndAnnotations(source, options);
  sanitizeCatalog(source, options, pageRefs);
  scrubObjectGraph(source, options);
  if (options.removeMetadata) source.context.trailerInfo.Info = undefined;
  const document = await copyReachableDocument(source, options);
  validateRebuiltDocument(document, options, expectedLinks);
  return { document, expectedLinks };
}
