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
  type PDFFont,
  type PDFRef,
} from "pdf-lib";

import { throwIfAborted, yieldToEventLoop } from "../../../utils/cooperativeCancel.ts";
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
  | { ok: false; error: "invalid-layout" | "empty-placement" | "tile-limit" };

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

interface ContentScan {
  tokens: string[];
  uncertain: boolean;
}

function isWhitespace(character: string | undefined) {
  return character === undefined || /[\x00\t\n\f\r ]/u.test(character);
}

function isDelimiter(character: string | undefined) {
  return character === undefined || "()<>[]{}/%".includes(character);
}

function scanContent(source: string): ContentScan {
  const tokens: string[] = [];
  let uncertain = false;
  let index = 0;
  let inlineDictionary = false;
  while (index < source.length) {
    const character = source[index];
    const iterationStart = index;
    if (isWhitespace(character)) {
      index += 1;
      continue;
    }
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
      if (nesting > 0) uncertain = true;
      continue;
    }
    if (character === "<" && source[index + 1] !== "<") {
      index += 1;
      while (index < source.length && source[index] !== ">") index += 1;
      if (index < source.length) index += 1;
      else uncertain = true;
      continue;
    }
    if ((character === "<" && source[index + 1] === "<") || (character === ">" && source[index + 1] === ">")) {
      tokens.push(source.slice(index, index + 2));
      index += 2;
      continue;
    }
    if (character === "/") {
      const start = index;
      index += 1;
      while (index < source.length && !isWhitespace(source[index]) && !isDelimiter(source[index])) index += 1;
      tokens.push(source.slice(start, index));
      continue;
    }
    if ("[]{}".includes(character)) {
      tokens.push(character);
      index += 1;
      continue;
    }
    if (character === ")" || character === ">") {
      uncertain = true;
      index += 1;
      continue;
    }
    const start = index;
    while (index < source.length && !isWhitespace(source[index]) && !isDelimiter(source[index])) index += 1;
    if (index === start) {
      uncertain = true;
      index += 1;
      continue;
    }
    const token = source.slice(start, index);
    tokens.push(token);
    if (!inlineDictionary && token === "BI") inlineDictionary = true;
    else if (inlineDictionary && token === "ID") {
      if (!isWhitespace(source[index])) {
        uncertain = true;
        inlineDictionary = false;
        continue;
      }
      if (source[index] === "\r" && source[index + 1] === "\n") index += 2;
      else index += 1;
      let end = -1;
      for (let cursor = index; cursor + 1 < source.length; cursor += 1) {
        if (source[cursor] === "E" && source[cursor + 1] === "I"
            && isWhitespace(source[cursor - 1])
            && (isWhitespace(source[cursor + 2]) || isDelimiter(source[cursor + 2]))) {
          end = cursor;
          break;
        }
      }
      if (end < 0) {
        uncertain = true;
        index = source.length;
      } else {
        index = end + 2;
        tokens.push("EI");
      }
      inlineDictionary = false;
    }
    if (index <= iterationStart) {
      uncertain = true;
      index = iterationStart + 1;
    }
  }
  if (inlineDictionary) uncertain = true;
  return { tokens, uncertain };
}

function graphicsStateLooksUnbalanced(source: string) {
  const scan = scanContent(source);
  if (scan.uncertain) return true;
  let depth = 0;
  for (const token of scan.tokens) {
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
      const logicalContent = pageContentStreams(page).map(decodedStreamText).join("\n");
      if (graphicsStateLooksUnbalanced(logicalContent)) {
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
  if (!tiled.ok) {
    if (tiled.error === "tile-limit" || tiled.error === "empty-placement") return { ok: false, error: tiled.error };
    return { ok: false, error: "invalid-layout" };
  }
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

async function watermarkOperators(name: PDFName, graphicsState: PDFName, viewport: PdfViewportGeometry, placements: readonly WatermarkPlacement[], objectWidth: number, objectHeight: number, signal?: AbortSignal) {
  const operators: PDFOperator[] = [pushGraphicsState(), beginMarkedContent("Artifact")];
  for (const placement of placements) {
    throwIfAborted(signal);
    await yieldToEventLoop();
    throwIfAborted(signal);
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

export function measureTextWatermarkBox(font: PDFFont, size: number, lineHeight: number, lineCount: number) {
  const fullHeight = font.heightAtSize(size);
  const ascenderHeight = font.heightAtSize(size, { descender: false });
  const baselineOffset = Math.max(0, fullHeight - ascenderHeight);
  const glyphBlockHeight = Math.max(0, lineCount - 1) * lineHeight + fullHeight;
  return { baselineOffset, height: Math.max(lineHeight, glyphBlockHeight) };
}

export async function addWatermarkXObject(page: PDFPage, reference: PDFRef, objectWidth: number, objectHeight: number, viewport: PdfViewportGeometry, placements: readonly WatermarkPlacement[], opacity: number, layer: WatermarkLayer, signal?: AbortSignal) {
  const name = page.node.newXObject("Watermark", reference);
  const graphicsState = page.node.newExtGState("WatermarkGS", page.doc.context.obj({ Type: "ExtGState", ca: opacity, CA: opacity }));
  return addIndependentContentStream(page, await watermarkOperators(name, graphicsState, viewport, placements, objectWidth, objectHeight, signal), layer);
}

export async function embedWatermarkImage(document: PDFDocument, file: File, signal?: AbortSignal): Promise<PDFImage> {
  throwIfAborted(signal);
  const bytes = await file.arrayBuffer();
  throwIfAborted(signal);
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (type === "image/png" || name.endsWith(".png")) return document.embedPng(bytes);
  if (type === "image/jpeg" || name.endsWith(".jpg") || name.endsWith(".jpeg")) return document.embedJpg(bytes);
  throw new Error("unsupported-image-format");
}

function streamDrawnXObjects(page: PDFPage, stream: PDFRawStream) {
  const tokens = scanContent(decodedStreamText(stream)).tokens;
  const names: string[] = [];
  for (let index = 1; index < tokens.length; index += 1) {
    if (tokens[index] === "Do" && tokens[index - 1].startsWith("/")) names.push(tokens[index - 1].slice(1));
  }
  if (names.length === 0) throw new Error("watermark-placement-missing");
  const resources = page.node.Resources();
  const rawXObjects = resources?.get(PDFName.of("XObject"));
  const xObjects = rawXObjects ? page.doc.context.lookup(rawXObjects) : undefined;
  if (!(xObjects instanceof PDFDict)) throw new Error("watermark-resource-missing");
  for (const name of names) {
    const raw = xObjects.get(PDFName.of(name));
    if (!raw || !(page.doc.context.lookup(raw) instanceof PDFStream)) throw new Error("watermark-resource-missing");
  }
}

function contentLeavesEmptyClip(streams: readonly PDFRawStream[]) {
  const { tokens } = scanContent(streams.map(decodedStreamText).join("\n"));
  const clipStack: boolean[] = [];
  let clipEmpty = false;
  let pathSeen = false;
  let pathMayHaveArea = false;
  let pendingClip = false;
  let operands: string[] = [];
  const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/u;
  const finishPath = () => {
    if (pendingClip && (!pathSeen || !pathMayHaveArea)) clipEmpty = true;
    pathSeen = false;
    pathMayHaveArea = false;
    pendingClip = false;
  };
  for (const token of tokens) {
    if (numeric.test(token)) {
      operands.push(token);
      continue;
    }
    if (token.startsWith("/") || ["[", "]", "<<", ">>"].includes(token)) {
      operands.push(token);
      continue;
    }
    if (token === "q") clipStack.push(clipEmpty);
    else if (token === "Q") {
      const restored = clipStack.pop();
      if (restored !== undefined) clipEmpty = restored;
    } else if (token === "re") {
      const rectangle = operands.slice(-4).map(Number);
      pathSeen = true;
      if (rectangle.length !== 4 || rectangle.some((value) => !Number.isFinite(value)) || (rectangle[2] !== 0 && rectangle[3] !== 0)) pathMayHaveArea = true;
    } else if (["m", "l", "c", "v", "y", "h"].includes(token)) {
      pathSeen = true;
      pathMayHaveArea = true;
    } else if (token === "W" || token === "W*") pendingClip = true;
    else if (["S", "s", "f", "F", "f*", "B", "B*", "b", "b*", "n"].includes(token)) finishPath();
    operands = [];
  }
  return clipEmpty;
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
    streamDrawnXObjects(document.getPage(physicalPage - 1), stream);
    if (layer === "foreground" && contentLeavesEmptyClip(streams.slice(0, -1))) throw new Error("watermark-clipped");
  }
}
