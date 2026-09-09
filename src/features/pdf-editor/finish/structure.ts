import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFObjectCopier,
  PDFPage,
  PDFRawStream,
  PDFRef,
  PDFStream,
  PDFString,
  concatTransformationMatrix,
  drawObject,
  popGraphicsState,
  pushGraphicsState,
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
  const annotationArrays: PDFArray[] = [];
  let expectedLinks = 0;
  for (const page of document.getPages()) {
    if (options.removeAttachments) page.node.delete(key("AF"));
    if (options.removeMetadata) page.node.delete(key("Metadata"));
    page.node.delete(key("StructParents"));
    const annotations = lookup(document, page.node, "Annots");
    if (!(annotations instanceof PDFArray)) continue;
    annotationArrays.push(annotations);
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

  let changed = true;
  while (changed) {
    changed = false;
    for (const annotations of annotationArrays) {
      for (let index = annotations.size() - 1; index >= 0; index -= 1) {
        const raw = annotations.get(index);
        const annotation = document.context.lookup(raw);
        if (!(annotation instanceof PDFDict)) continue;
        const parent = annotation.get(key("Parent"));
        const parentRemoved = removed.has(parent) || removed.has(document.context.lookup(parent));
        const subtype = nameOf(lookup(document, annotation, "Subtype"));
        const referencedByRemovedParent = [...removed].some((value) => {
          const owner = document.context.lookup(value);
          if (!(owner instanceof PDFDict)) return false;
          const popup = owner.get(key("Popup"));
          return popup === raw || document.context.lookup(popup) === annotation;
        });
        if (subtype !== "/Popup" || !parentRemoved && !referencedByRemovedParent) continue;
        removed.add(raw);
        removed.add(annotation);
        annotations.remove(index);
        changed = true;
      }
    }
  }

  for (const annotations of annotationArrays) {
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

function numericArray(document: PDFDocument, value: PdfValue, size: number) {
  const array = document.context.lookup(value);
  if (!(array instanceof PDFArray) || array.size() !== size) return undefined;
  const numbers = array.asArray().map((entry) => document.context.lookup(entry));
  if (numbers.some((entry) => !(entry instanceof PDFNumber) || !Number.isFinite(entry.asNumber()))) return undefined;
  return numbers.map((entry) => (entry as PDFNumber).asNumber());
}

function inheritedValue(document: PDFDocument, dictionary: PDFDict, name: string) {
  const seen = new Set<PdfValue>();
  let current: PdfValue = dictionary;
  while (current instanceof PDFDict && !seen.has(current)) {
    seen.add(current);
    const value = current.get(key(name));
    if (value) return document.context.lookup(value);
    current = lookup(document, current, "Parent");
  }
  return undefined;
}

function selectedNormalAppearance(document: PDFDocument, widget: PDFDict) {
  const appearance = lookup(document, widget, "AP");
  const normalRaw = appearance instanceof PDFDict ? appearance.get(key("N")) : undefined;
  const normal = document.context.lookup(normalRaw);
  let selectedRaw = normalRaw;
  let selected = normal;
  if (normal instanceof PDFDict && !(normal instanceof PDFStream)) {
    const state = inheritedValue(document, widget, "AS") ?? inheritedValue(document, widget, "V");
    if (!(state instanceof PDFName)) return undefined;
    selectedRaw = normal.get(state);
    selected = document.context.lookup(selectedRaw);
  }
  if (!(selectedRaw instanceof PDFRef) || !(selected instanceof PDFRawStream)) return undefined;
  return { reference: selectedRaw, stream: selected };
}

function normalizedRectangle(values: readonly number[]) {
  const x0 = Math.min(values[0], values[2]);
  const y0 = Math.min(values[1], values[3]);
  const x1 = Math.max(values[0], values[2]);
  const y1 = Math.max(values[1], values[3]);
  return x1 > x0 && y1 > y0 ? [x0, y0, x1, y1] as const : undefined;
}

function transformedBounds(bbox: readonly number[], matrix: readonly number[]) {
  const points = [
    [bbox[0], bbox[1]], [bbox[0], bbox[3]], [bbox[2], bbox[1]], [bbox[2], bbox[3]],
  ].map(([x, y]) => [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]]);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const bounds = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as const;
  return bounds.every(Number.isFinite) && bounds[2] > bounds[0] && bounds[3] > bounds[1] ? bounds : undefined;
}

function appearanceTransform(document: PDFDocument, widget: PDFDict, stream: PDFRawStream) {
  const rect = normalizedRectangle(numericArray(document, widget.get(key("Rect")), 4) ?? []);
  const bbox = normalizedRectangle(numericArray(document, stream.dict.get(key("BBox")), 4) ?? []);
  const matrix = stream.dict.has(key("Matrix"))
    ? numericArray(document, stream.dict.get(key("Matrix")), 6)
    : [1, 0, 0, 1, 0, 0];
  if (!rect || !bbox || !matrix) return undefined;
  const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2];
  if (!Number.isFinite(determinant) || determinant === 0) return undefined;
  const bounds = transformedBounds(bbox, matrix);
  if (!bounds) return undefined;
  const xScale = (rect[2] - rect[0]) / (bounds[2] - bounds[0]);
  const yScale = (rect[3] - rect[1]) / (bounds[3] - bounds[1]);
  const transform = [
    xScale,
    0,
    0,
    yScale,
    rect[0] - bounds[0] * xScale,
    rect[1] - bounds[1] * yScale,
  ] as const;
  return transform.every(Number.isFinite) ? transform : undefined;
}

function flattenFormAppearances(document: PDFDocument) {
  const plans: Array<{ page: PDFPage; reference: PDFRef; transform: readonly [number, number, number, number, number, number] }> = [];
  for (const page of document.getPages()) {
    const annotations = lookup(document, page.node, "Annots");
    if (!(annotations instanceof PDFArray)) continue;
    for (const raw of annotations.asArray()) {
      const widget = document.context.lookup(raw);
      if (!(widget instanceof PDFDict) || nameOf(lookup(document, widget, "Subtype")) !== "/Widget") continue;
      const appearance = selectedNormalAppearance(document, widget);
      const transform = appearance && appearanceTransform(document, widget, appearance.stream);
      if (!appearance || !transform) throw new PdfStructureError("unsupported-form");
      plans.push({ page, reference: appearance.reference, transform });
    }
  }
  for (const { page, reference, transform } of plans) {
    const xObject = page.node.newXObject("FlatWidget", reference);
    page.pushOperators(
      pushGraphicsState(),
      concatTransformationMatrix(...transform),
      drawObject(xObject),
      popGraphicsState(),
    );
  }
}

function applyFormMode(document: PDFDocument, mode: PdfFormMode) {
  const acroForm = lookup(document, document.catalog, "AcroForm");
  if (!(acroForm instanceof PDFDict) || mode === "preserve") return;
  if (mode === "flatten") {
    if (acroForm.has(key("XFA"))) throw new PdfStructureError("unsupported-form");
    for (const [, object] of document.context.enumerateIndirectObjects()) if (object instanceof PDFDict) {
      if (formFieldType(document, object) === "/Sig") throw new PdfStructureError("unsupported-form");
    }
    try { flattenFormAppearances(document); }
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
    if (subtype === "/Popup") {
      const parent = document.context.lookup(dictionary.get(key("Parent")));
      if (!(parent instanceof PDFDict)) throw new PdfStructureError("validation");
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
