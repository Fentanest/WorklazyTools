import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFStream,
  beginMarkedContent,
  concatTransformationMatrix,
  decodePDFRawStream,
  drawObject,
  endMarkedContent,
  popGraphicsState,
  pushGraphicsState,
  setGraphicsState,
  type PDFImage,
  type PDFOperator,
  type PDFPage,
  type PDFRef,
} from "pdf-lib";

import type { FinishRegion, PdfViewportGeometry } from "./geometry.ts";
import { createTilePlacements } from "./tiles.ts";

export type WatermarkContentKind = "text" | "image";
export type WatermarkLayer = "background" | "foreground";
export type WatermarkPattern = "single" | "tile";
export type WatermarkRegion = FinishRegion | "center";
export type WatermarkRiskCode = "risky-graphics-state" | "risky-optional-content" | "risky-tagged-document";

export interface PdfWatermarkSettings {
  content: WatermarkContentKind;
  image?: File;
  layer: WatermarkLayer;
  pattern: WatermarkPattern;
  region: WatermarkRegion;
  rotation: number;
  opacity: number;
  sizePercent: number;
  gap: number;
  offsetX: number;
  offsetY: number;
}

export interface WatermarkPlacement {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotation: number;
}

export type WatermarkPlacementResult =
  | { ok: true; placements: WatermarkPlacement[] }
  | { ok: false; error: "invalid-layout" | "tile-limit" };

function dictionaryHas(dictionary: PDFDict, name: string) {
  return dictionary.has(PDFName.of(name));
}

function decodedStreamText(stream: PDFRawStream) {
  const bytes = decodePDFRawStream(stream).decode();
  let text = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    text += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return text;
}

function graphicsStateLooksUnbalanced(source: string) {
  let depth = 0;
  let index = 0;
  const whitespace = (character: string | undefined) => !character || /[\x00\t\n\f\r ]/u.test(character);
  while (index < source.length) {
    const character = source[index];
    if (character === "%") {
      while (index < source.length && !/[\r\n]/u.test(source[index])) index += 1;
      continue;
    }
    if (character === "(") {
      index += 1;
      let nesting = 1;
      while (index < source.length && nesting > 0) {
        if (source[index] === "\\") index += 2;
        else {
          if (source[index] === "(") nesting += 1;
          if (source[index] === ")") nesting -= 1;
          index += 1;
        }
      }
      if (nesting > 0) return true;
      continue;
    }
    if (character === "<" && source[index + 1] !== "<") {
      index += 1;
      while (index < source.length && source[index] !== ">") index += 1;
      index += 1;
      continue;
    }
    if (whitespace(character) || "[]<>{}/".includes(character)) {
      index += 1;
      continue;
    }
    const start = index;
    while (index < source.length && !whitespace(source[index]) && !"[]<>{}/()%".includes(source[index])) index += 1;
    const token = source.slice(start, index);
    if (token === "q") depth += 1;
    if (token === "Q") {
      if (depth === 0) return true;
      depth -= 1;
    }
  }
  return depth !== 0;
}

function pageContentStreams(page: PDFPage): PDFRawStream[] {
  const raw = page.node.get(PDFName.of("Contents"));
  if (!raw) return [];
  const resolved = page.doc.context.lookup(raw);
  const entries = resolved instanceof PDFArray ? resolved.asArray() : [raw];
  return entries.map((entry) => {
    const stream = page.doc.context.lookup(entry);
    if (!(stream instanceof PDFRawStream)) throw new Error("invalid-content-stream");
    return stream;
  });
}

export function inspectWatermarkRisks(document: PDFDocument): WatermarkRiskCode[] {
  const risks = new Set<WatermarkRiskCode>();
  if (dictionaryHas(document.catalog, "OCProperties")) risks.add("risky-optional-content");
  if (dictionaryHas(document.catalog, "StructTreeRoot") || dictionaryHas(document.catalog, "MarkInfo")) risks.add("risky-tagged-document");
  for (const page of document.getPages()) {
    try {
      if (pageContentStreams(page).some((stream) => graphicsStateLooksUnbalanced(decodedStreamText(stream)))) {
        risks.add("risky-graphics-state");
      }
    } catch {
      risks.add("risky-graphics-state");
    }
  }
  return [...risks];
}

export function assertBackgroundPlacementSupported(page: PDFPage) {
  const raw = page.node.get(PDFName.of("Contents"));
  if (!raw) return;
  const resolved = page.doc.context.lookup(raw);
  if (resolved instanceof PDFStream) return;
  if (!(resolved instanceof PDFArray)) throw new Error("invalid-content-entry");
  for (const entry of resolved.asArray()) {
    if (!(page.doc.context.lookup(entry) instanceof PDFStream)) throw new Error("invalid-content-entry");
  }
}

function rotatedBounds(width: number, height: number, rotation: number) {
  const radians = rotation * Math.PI / 180;
  return {
    width: Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians)),
    height: Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians)),
  };
}

function singlePlacement(
  viewport: PdfViewportGeometry,
  width: number,
  height: number,
  rotation: number,
  region: WatermarkRegion,
  margin: number,
): WatermarkPlacementResult {
  const bounds = rotatedBounds(width, height, rotation);
  if (bounds.width > viewport.width - margin * 2 || bounds.height > viewport.height - margin * 2) {
    return { ok: false, error: "invalid-layout" };
  }
  const [vertical, horizontal] = region === "center" ? ["center", "center"] : region.split("-");
  const centerX = horizontal === "left" ? margin + bounds.width / 2 : horizontal === "right" ? viewport.width - margin - bounds.width / 2 : viewport.width / 2;
  const centerY = vertical === "top" ? margin + bounds.height / 2 : vertical === "bottom" ? viewport.height - margin - bounds.height / 2 : viewport.height / 2;
  return { ok: true, placements: [{ centerX, centerY, width, height, rotation }] };
}

export function createWatermarkPlacements(input: {
  viewport: PdfViewportGeometry;
  width: number;
  height: number;
  settings: Pick<PdfWatermarkSettings, "pattern" | "region" | "rotation" | "gap" | "offsetX" | "offsetY">;
  margin: number;
}): WatermarkPlacementResult {
  const { viewport, width, height, settings, margin } = input;
  if (![width, height, margin].every(Number.isFinite) || width <= 0 || height <= 0 || margin < 0) {
    return { ok: false, error: "invalid-layout" };
  }
  if (settings.pattern === "single") return singlePlacement(viewport, width, height, settings.rotation, settings.region, margin);
  const bounds = rotatedBounds(width, height, settings.rotation);
  const tiled = createTilePlacements({
    pageWidth: viewport.width,
    pageHeight: viewport.height,
    tileWidth: bounds.width,
    tileHeight: bounds.height,
    gap: settings.gap,
    offsetX: settings.offsetX,
    offsetY: settings.offsetY,
    rotation: settings.rotation,
  });
  if (!tiled.ok) return { ok: false, error: tiled.error === "tile-limit" ? "tile-limit" : "invalid-layout" };
  return {
    ok: true,
    placements: tiled.placements.map((placement) => ({
      centerX: placement.x + bounds.width / 2,
      centerY: placement.y + bounds.height / 2,
      width,
      height,
      rotation: placement.rotation,
    })),
  };
}

function inverseViewportTransform(transform: PdfViewportGeometry["transform"]) {
  const [a, b, c, d, e, f] = transform;
  const determinant = a * d - b * c;
  if (!Number.isFinite(determinant) || determinant === 0) throw new Error("invalid-viewport-transform");
  return [
    d / determinant,
    -b / determinant,
    -c / determinant,
    a / determinant,
    (c * f - d * e) / determinant,
    (b * e - a * f) / determinant,
  ] as const;
}

function placementTransform(viewport: PdfViewportGeometry, placement: WatermarkPlacement, objectWidth: number, objectHeight: number) {
  const radians = placement.rotation * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const scaleX = placement.width / objectWidth;
  const scaleY = placement.height / objectHeight;
  const x0 = placement.centerX - placement.width * cosine / 2 - placement.height * sine / 2;
  const y0 = placement.centerY - placement.width * sine / 2 + placement.height * cosine / 2;
  const local = [cosine * scaleX, sine * scaleX, sine * scaleY, -cosine * scaleY, x0, y0] as const;
  const inverse = inverseViewportTransform(viewport.transform);
  const [a, b, c, d, e, f] = inverse;
  const [la, lb, lc, ld, le, lf] = local;
  return [
    a * la + c * lb,
    b * la + d * lb,
    a * lc + c * ld,
    b * lc + d * ld,
    a * le + c * lf + e,
    b * le + d * lf + f,
  ] as const;
}

function watermarkOperators(name: PDFName, graphicsState: PDFName, viewport: PdfViewportGeometry, placements: readonly WatermarkPlacement[], objectWidth: number, objectHeight: number) {
  const operators: PDFOperator[] = [pushGraphicsState(), beginMarkedContent("Artifact")];
  for (const placement of placements) {
    operators.push(pushGraphicsState(), setGraphicsState(graphicsState), concatTransformationMatrix(...placementTransform(viewport, placement, objectWidth, objectHeight)), drawObject(name), popGraphicsState());
  }
  operators.push(endMarkedContent(), popGraphicsState());
  return operators;
}

function addIndependentContentStream(page: PDFPage, operators: PDFOperator[], layer: WatermarkLayer) {
  if (layer === "background") assertBackgroundPlacementSupported(page);
  const stream = page.doc.context.contentStream(operators);
  const reference = page.doc.context.register(stream);
  page.node.addContentStream(reference);
  const contents = page.node.normalizedEntries().Contents;
  if (!(contents instanceof PDFArray)) throw new Error("content-array-unavailable");
  const index = contents.indexOf(reference);
  if (index === undefined) throw new Error("content-stream-unregistered");
  if (layer === "background") {
    contents.remove(index);
    contents.insert(0, reference);
  }
  return reference;
}

export function textWatermarkFontName() {
  return PDFName.of("WatermarkFont");
}

export function createTextWatermarkXObject(document: PDFDocument, fontRef: PDFRef, operators: PDFOperator[], width: number, height: number) {
  const fontName = textWatermarkFontName();
  const resourceDictionary = document.context.obj({ Font: { WatermarkFont: fontRef } });
  const form = document.context.formXObject(
    [pushGraphicsState(), beginMarkedContent("Artifact"), ...operators, endMarkedContent(), popGraphicsState()],
    { BBox: [0, 0, width, height], Resources: resourceDictionary },
  );
  return { reference: document.context.register(form), fontName };
}

export function addWatermarkXObject(page: PDFPage, reference: PDFRef, objectWidth: number, objectHeight: number, viewport: PdfViewportGeometry, placements: readonly WatermarkPlacement[], opacity: number, layer: WatermarkLayer) {
  const name = page.node.newXObject("Watermark", reference);
  const graphicsState = page.node.newExtGState("WatermarkGS", page.doc.context.obj({ Type: "ExtGState", ca: opacity, CA: opacity }));
  return addIndependentContentStream(page, watermarkOperators(name, graphicsState, viewport, placements, objectWidth, objectHeight), layer);
}

export async function embedWatermarkImage(document: PDFDocument, file: File): Promise<PDFImage> {
  const bytes = await file.arrayBuffer();
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (type === "image/png" || name.endsWith(".png")) return document.embedPng(bytes);
  if (type === "image/jpeg" || name.endsWith(".jpg") || name.endsWith(".jpeg")) return document.embedJpg(bytes);
  throw new Error("unsupported-image-format");
}

export async function validateWatermarkResult(bytes: Uint8Array, pageCount: number, selectedPages: readonly number[], layer: WatermarkLayer) {
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  if (document.getPageCount() !== pageCount) throw new Error("page-count-changed");
  for (const physicalPage of selectedPages) {
    const streams = pageContentStreams(document.getPage(physicalPage - 1));
    if (streams.length === 0) throw new Error("watermark-stream-missing");
    const stream = streams[layer === "background" ? 0 : streams.length - 1];
    const content = decodedStreamText(stream).trim();
    if (!content.startsWith("q\n/Artifact BMC") || !content.endsWith("EMC\nQ")) throw new Error("watermark-stream-invalid");
  }
}
