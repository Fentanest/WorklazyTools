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

interface ContentScan {
  tokens: string[];
  uncertain: boolean;
}

type ContentScanEvent = { type: "token"; value: string } | { type: "uncertain" } | { type: "checkpoint" };

const CONTENT_SCAN_CHECKPOINT_BYTES = 64 * 1024;
const MAXIMUM_TOKEN_BYTES = 256;

function isWhitespaceByte(value: number | undefined) {
  return value === undefined || value === 0 || value === 9 || value === 10 || value === 12 || value === 13 || value === 32;
}

function isDelimiterByte(value: number | undefined) {
  return value === undefined || value === 0x28 || value === 0x29 || value === 0x3c || value === 0x3e
    || value === 0x5b || value === 0x5d || value === 0x7b || value === 0x7d || value === 0x2f || value === 0x25;
}

function tokenFromBytes(source: Uint8Array, start: number, end: number) {
  if (end - start > MAXIMUM_TOKEN_BYTES) return undefined;
  let value = "";
  for (let index = start; index < end; index += 1) value += String.fromCharCode(source[index]);
  return value;
}

function inlineDictionaryValue(tokens: readonly string[], keys: readonly string[]) {
  for (let index = tokens.length - 2; index >= 0; index -= 1) {
    if (keys.includes(tokens[index])) return tokens[index + 1];
  }
  return undefined;
}

function inlineImagePayloadLength(tokens: readonly string[]) {
  if (inlineDictionaryValue(tokens, ["/F", "/Filter"]) !== undefined) return undefined;
  const width = Number(inlineDictionaryValue(tokens, ["/W", "/Width"]));
  const height = Number(inlineDictionaryValue(tokens, ["/H", "/Height"]));
  const imageMask = inlineDictionaryValue(tokens, ["/IM", "/ImageMask"]) === "true";
  const bits = imageMask ? 1 : Number(inlineDictionaryValue(tokens, ["/BPC", "/BitsPerComponent"]));
  const colorSpace = inlineDictionaryValue(tokens, ["/CS", "/ColorSpace"]);
  const components = imageMask || colorSpace === "/G" || colorSpace === "/DeviceGray" || colorSpace === "/I" || colorSpace === "/Indexed"
    ? 1
    : colorSpace === "/RGB" || colorSpace === "/DeviceRGB"
      ? 3
      : colorSpace === "/CMYK" || colorSpace === "/DeviceCMYK"
        ? 4
        : undefined;
  if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0
      || !Number.isSafeInteger(bits) || bits <= 0 || bits > 16 || components === undefined) return undefined;
  const rowBytes = Math.ceil(width * components * bits / 8);
  const length = rowBytes * height;
  return Number.isSafeInteger(length) ? length : undefined;
}

function inlineTerminatorEnd(source: Uint8Array, payloadEnd: number) {
  let index = payloadEnd;
  while (index < source.length && isWhitespaceByte(source[index])) index += 1;
  if (source[index] !== 0x45 || source[index + 1] !== 0x49 || !isWhitespaceByte(source[index + 2]) && !isDelimiterByte(source[index + 2])) return -1;
  return index + 2;
}

function* scanContentEvents(source: Uint8Array): Generator<ContentScanEvent> {
  let nextCheckpoint = CONTENT_SCAN_CHECKPOINT_BYTES;
  const checkpoint = function* (index: number): Generator<ContentScanEvent> {
    if (index >= nextCheckpoint) {
      nextCheckpoint = index + CONTENT_SCAN_CHECKPOINT_BYTES;
      yield { type: "checkpoint" };
    }
  };
  let index = 0;
  let inlineDictionary = false;
  let inlineTokens: string[] = [];
  while (index < source.length) {
    const character = source[index];
    const iterationStart = index;
    yield* checkpoint(index);
    if (isWhitespaceByte(character)) {
      index += 1;
      continue;
    }
    if (character === 0x25) {
      while (index < source.length && source[index] !== 0x0d && source[index] !== 0x0a) {
        index += 1;
        yield* checkpoint(index);
      }
      continue;
    }
    if (character === 0x28) {
      index += 1;
      let nesting = 1;
      while (index < source.length && nesting > 0) {
        if (source[index] === 0x5c) index += 2;
        else {
          if (source[index] === 0x28) nesting += 1;
          if (source[index] === 0x29) nesting -= 1;
          index += 1;
        }
        yield* checkpoint(index);
      }
      if (nesting > 0) yield { type: "uncertain" };
      continue;
    }
    if (character === 0x3c && source[index + 1] !== 0x3c) {
      index += 1;
      while (index < source.length && source[index] !== 0x3e) {
        index += 1;
        yield* checkpoint(index);
      }
      if (index < source.length) index += 1;
      else yield { type: "uncertain" };
      continue;
    }
    if (character === 0x3c && source[index + 1] === 0x3c || character === 0x3e && source[index + 1] === 0x3e) {
      const token = character === 0x3c ? "<<" : ">>";
      yield { type: "token", value: token };
      if (inlineDictionary) inlineTokens.push(token);
      index += 2;
      continue;
    }
    if (character === 0x2f) {
      const start = index;
      index += 1;
      while (index < source.length && !isWhitespaceByte(source[index]) && !isDelimiterByte(source[index])) {
        index += 1;
        yield* checkpoint(index);
      }
      const token = tokenFromBytes(source, start, index);
      if (token === undefined) yield { type: "uncertain" };
      else {
        yield { type: "token", value: token };
        if (inlineDictionary) inlineTokens.push(token);
      }
      continue;
    }
    if (character === 0x5b || character === 0x5d || character === 0x7b || character === 0x7d) {
      const token = String.fromCharCode(character);
      yield { type: "token", value: token };
      if (inlineDictionary) inlineTokens.push(token);
      index += 1;
      continue;
    }
    if (character === 0x29 || character === 0x3e) {
      yield { type: "uncertain" };
      index += 1;
      continue;
    }
    const start = index;
    while (index < source.length && !isWhitespaceByte(source[index]) && !isDelimiterByte(source[index])) {
      index += 1;
      yield* checkpoint(index);
    }
    if (index === start) {
      yield { type: "uncertain" };
      index += 1;
      continue;
    }
    const token = tokenFromBytes(source, start, index);
    if (token === undefined) {
      yield { type: "uncertain" };
      continue;
    }
    yield { type: "token", value: token };
    if (inlineDictionary) inlineTokens.push(token);
    if (!inlineDictionary && token === "BI") {
      inlineDictionary = true;
      inlineTokens = [];
    }
    else if (inlineDictionary && token === "ID") {
      if (!isWhitespaceByte(source[index])) {
        yield { type: "uncertain" };
        inlineDictionary = false;
        continue;
      }
      if (source[index] === 0x0d && source[index + 1] === 0x0a) index += 2;
      else index += 1;
      const payloadLength = inlineImagePayloadLength(inlineTokens);
      let end = -1;
      if (payloadLength !== undefined && index + payloadLength <= source.length) {
        end = inlineTerminatorEnd(source, index + payloadLength);
      }
      if (end < 0) {
        yield { type: "uncertain" };
        for (let cursor = index; cursor + 1 < source.length; cursor += 1) {
          yield* checkpoint(cursor);
          if (source[cursor] === 0x45 && source[cursor + 1] === 0x49
              && isWhitespaceByte(source[cursor - 1])
              && (isWhitespaceByte(source[cursor + 2]) || isDelimiterByte(source[cursor + 2]))) {
            end = cursor + 2;
            break;
          }
        }
      }
      if (end < 0) {
        index = source.length;
      } else {
        index = end;
        yield { type: "token", value: "EI" };
      }
      inlineDictionary = false;
      inlineTokens = [];
    }
    if (index <= iterationStart) {
      yield { type: "uncertain" };
      index = iterationStart + 1;
    }
  }
  if (inlineDictionary) yield { type: "uncertain" };
}

function collectContentScan(events: Iterable<ContentScanEvent>): ContentScan {
  const tokens: string[] = [];
  let uncertain = false;
  for (const event of events) {
    if (event.type === "token") tokens.push(event.value);
    if (event.type === "uncertain") uncertain = true;
  }
  return { tokens, uncertain };
}

function scanContent(source: Uint8Array): ContentScan {
  return collectContentScan(scanContentEvents(source));
}

async function scanContentCooperatively(source: Uint8Array, signal?: AbortSignal): Promise<ContentScan> {
  const tokens: string[] = [];
  let uncertain = false;
  for (const event of scanContentEvents(source)) {
    if (event.type === "checkpoint") {
      throwIfAborted(signal);
      await yieldToEventLoop();
      throwIfAborted(signal);
    } else if (event.type === "token") tokens.push(event.value);
    else uncertain = true;
  }
  return { tokens, uncertain };
}

function rawStreamFilterName(stream: PDFRawStream) {
  const filter = stream.dict.lookup(PDFName.of("Filter"));
  return filter instanceof PDFName ? filter.asString() : undefined;
}

async function inflateStreamCooperatively(stream: PDFRawStream, signal?: AbortSignal) {
  throwIfAborted(signal);
  const reader = new Blob([stream.contents.slice().buffer]).stream()
    .pipeThrough(new DecompressionStream("deflate"))
    .getReader();
  const abort = () => { void reader.cancel(); };
  signal?.addEventListener("abort", abort, { once: true });
  const chunks: Uint8Array[] = [];
  let length = 0;
  let nextYield = 1024 * 1024;
  try {
    while (true) {
      throwIfAborted(signal);
      const { done, value } = await reader.read();
      throwIfAborted(signal);
      if (done) break;
      chunks.push(value);
      length += value.length;
      if (length >= nextYield) {
        nextYield = length + 1024 * 1024;
        await yieldToEventLoop();
      }
    }
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
    if (offset % (1024 * 1024) < chunk.length) {
      throwIfAborted(signal);
      await yieldToEventLoop();
    }
  }
  throwIfAborted(signal);
  return result;
}

async function decodedStreamBytesCooperatively(stream: PDFRawStream, signal?: AbortSignal) {
  if ((rawStreamFilterName(stream) === "/FlateDecode" || rawStreamFilterName(stream) === "/Fl")
      && !stream.dict.get(PDFName.of("DecodeParms")) && typeof DecompressionStream !== "undefined") {
    return inflateStreamCooperatively(stream, signal);
  }
  throwIfAborted(signal);
  await yieldToEventLoop();
  throwIfAborted(signal);
  const decoded = decodePDFRawStream(stream).decode();
  throwIfAborted(signal);
  await yieldToEventLoop();
  throwIfAborted(signal);
  return decoded;
}

function graphicsStateTokensLookUnbalanced(scans: readonly ContentScan[]) {
  let uncertain = false;
  let depth = 0;
  for (const scan of scans) {
    uncertain ||= scan.uncertain;
    for (const token of scan.tokens) {
      if (token === "q") depth += 1;
      if (token === "Q") {
        if (depth === 0) return true;
        depth -= 1;
      }
    }
  }
  return uncertain || depth !== 0;
}

function graphicsStateLooksUnbalanced(streams: readonly PDFRawStream[]) {
  return graphicsStateTokensLookUnbalanced(streams.map((stream) => scanContent(decodePDFRawStream(stream).decode())));
}

async function graphicsStateLooksUnbalancedCooperatively(streams: readonly PDFRawStream[], signal?: AbortSignal) {
  const scans: ContentScan[] = [];
  for (const stream of streams) {
    throwIfAborted(signal);
    scans.push(await scanContentCooperatively(await decodedStreamBytesCooperatively(stream, signal), signal));
  }
  return graphicsStateTokensLookUnbalanced(scans);
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
      if (graphicsStateLooksUnbalanced(pageContentStreams(page))) {
        risks.add("risky-graphics-state");
      }
    } catch {
      risks.add("risky-graphics-state");
    }
  }
  return [...risks];
}

export async function inspectWatermarkRisksCooperatively(document: PDFDocument, signal?: AbortSignal): Promise<WatermarkRiskCode[]> {
  const risks = new Set<WatermarkRiskCode>();
  if (dictionaryHas(document.catalog, "OCProperties")) risks.add("risky-optional-content");
  if (dictionaryHas(document.catalog, "StructTreeRoot") || dictionaryHas(document.catalog, "MarkInfo")) risks.add("risky-tagged-document");
  for (const page of document.getPages()) {
    throwIfAborted(signal);
    try {
      if (await graphicsStateLooksUnbalancedCooperatively(pageContentStreams(page), signal)) risks.add("risky-graphics-state");
    } catch (error) {
      throwIfAborted(signal);
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      risks.add("risky-graphics-state");
    }
    await yieldToEventLoop();
  }
  throwIfAborted(signal);
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

interface Point {
  x: number;
  y: number;
}

function clipPolygon(points: readonly Point[], inside: (point: Point) => boolean, intersection: (start: Point, end: Point) => Point) {
  const clipped: Point[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    const startInside = inside(start);
    const endInside = inside(end);
    if (startInside && endInside) clipped.push(end);
    else if (startInside) clipped.push(intersection(start, end));
    else if (endInside) clipped.push(intersection(start, end), end);
  }
  return clipped;
}

function placementIntersectionArea(placement: WatermarkPlacement, viewport: PdfViewportGeometry) {
  const radians = placement.rotation * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  let polygon: Point[] = [
    { x: -placement.width / 2, y: -placement.height / 2 },
    { x: placement.width / 2, y: -placement.height / 2 },
    { x: placement.width / 2, y: placement.height / 2 },
    { x: -placement.width / 2, y: placement.height / 2 },
  ].map(({ x, y }) => ({
    x: placement.centerX + x * cosine - y * sine,
    y: placement.centerY + x * sine + y * cosine,
  }));
  const verticalIntersection = (x: number) => (start: Point, end: Point) => {
    const ratio = (x - start.x) / (end.x - start.x);
    return { x, y: start.y + (end.y - start.y) * ratio };
  };
  const horizontalIntersection = (y: number) => (start: Point, end: Point) => {
    const ratio = (y - start.y) / (end.y - start.y);
    return { x: start.x + (end.x - start.x) * ratio, y };
  };
  polygon = clipPolygon(polygon, ({ x }) => x >= 0, verticalIntersection(0));
  if (!polygon.length) return 0;
  polygon = clipPolygon(polygon, ({ x }) => x <= viewport.width, verticalIntersection(viewport.width));
  if (!polygon.length) return 0;
  polygon = clipPolygon(polygon, ({ y }) => y >= 0, horizontalIntersection(0));
  if (!polygon.length) return 0;
  polygon = clipPolygon(polygon, ({ y }) => y <= viewport.height, horizontalIntersection(viewport.height));
  if (polygon.length < 3) return 0;
  let doubledArea = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const point = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    doubledArea += point.x * next.y - next.x * point.y;
  }
  return Math.abs(doubledArea) / 2;
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
  const placements = tiled.placements.map((placement) => ({
      centerX: placement.x + bounds.width / 2,
      centerY: placement.y + bounds.height / 2,
      width,
      height,
      rotation: placement.rotation,
    })).filter((placement) => placementIntersectionArea(placement, viewport) > Number.EPSILON * 16);
  return placements.length > 0 ? { ok: true, placements } : { ok: false, error: "empty-placement" };
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
  const height = Math.max(lineHeight, glyphBlockHeight);
  const topEdgePadding = Math.max(1, size / 32);
  return { baselineOffset, height, bboxHeight: height + topEdgePadding };
}

export async function addWatermarkXObject(page: PDFPage, reference: PDFRef, objectWidth: number, objectHeight: number, viewport: PdfViewportGeometry, placements: readonly WatermarkPlacement[], opacity: number, layer: WatermarkLayer, signal?: AbortSignal) {
  const name = page.node.newXObject("Watermark", reference);
  const graphicsState = page.node.newExtGState("WatermarkGS", page.doc.context.obj({ Type: "ExtGState", ca: opacity, CA: opacity }));
  return addIndependentContentStream(page, await watermarkOperators(name, graphicsState, viewport, placements, objectWidth, objectHeight, signal), layer);
}

export async function addImageXObjectAtPdfCorners(
  page: PDFPage,
  reference: PDFRef,
  corners: readonly [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }],
  signal?: AbortSignal,
) {
  throwIfAborted(signal);
  await yieldToEventLoop();
  throwIfAborted(signal);
  const [topLeft, topRight, bottomLeft, bottomRight] = corners;
  const values = corners.flatMap(({ x, y }) => [x, y]);
  if (values.some((value) => !Number.isFinite(value))) throw new Error("invalid-image-corners");
  const horizontal = { x: bottomRight.x - bottomLeft.x, y: bottomRight.y - bottomLeft.y };
  const vertical = { x: topLeft.x - bottomLeft.x, y: topLeft.y - bottomLeft.y };
  const tolerance = 1e-7;
  if (Math.abs(topRight.x - bottomLeft.x - horizontal.x - vertical.x) > tolerance
      || Math.abs(topRight.y - bottomLeft.y - horizontal.y - vertical.y) > tolerance) {
    throw new Error("non-affine-image-corners");
  }
  const name = page.node.newXObject("Stamp", reference);
  return addIndependentContentStream(page, [
    pushGraphicsState(),
    beginMarkedContent("Artifact"),
    pushGraphicsState(),
    concatTransformationMatrix(horizontal.x, horizontal.y, vertical.x, vertical.y, bottomLeft.x, bottomLeft.y),
    drawObject(name),
    popGraphicsState(),
    endMarkedContent(),
    popGraphicsState(),
  ], "foreground");
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

function streamDrawnXObjects(page: PDFPage, tokens: readonly string[]) {
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

async function contentLeavesDefinitelyEmptyClip(streams: readonly PDFRawStream[], signal?: AbortSignal) {
  const tokens: string[] = [];
  for (const stream of streams) {
    const scan = await scanContentCooperatively(await decodedStreamBytesCooperatively(stream, signal), signal);
    if (scan.uncertain) return false;
    for (const token of scan.tokens) tokens.push(token);
  }
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

function latin1Text(source: Uint8Array) {
  let result = "";
  for (let index = 0; index < source.length; index += 0x8000) {
    result += String.fromCharCode(...source.subarray(index, index + 0x8000));
  }
  return result;
}

export async function validateWatermarkResult(bytes: Uint8Array, pageCount: number, selectedPages: readonly number[], layer: WatermarkLayer, signal?: AbortSignal) {
  throwIfAborted(signal);
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  throwIfAborted(signal);
  if (document.getPageCount() !== pageCount) throw new Error("page-count-changed");
  for (const physicalPage of selectedPages) {
    throwIfAborted(signal);
    const page = document.getPage(physicalPage - 1);
    const streams = pageContentStreams(page);
    if (streams.length === 0) throw new Error("watermark-stream-missing");
    const candidates = layer === "background"
      ? [[streams[0], 0] as const]
      : streams.map((stream, index) => [stream, index] as const).reverse();
    let validatedIndex = -1;
    for (const [stream, index] of candidates) {
      const decoded = await decodedStreamBytesCooperatively(stream, signal);
      const content = latin1Text(decoded).trim();
      if (!content.startsWith("q\n/Artifact BMC") || !content.endsWith("EMC\nQ")) continue;
      const scan = await scanContentCooperatively(decoded, signal);
      streamDrawnXObjects(page, scan.tokens);
      validatedIndex = index;
      break;
    }
    if (validatedIndex < 0) throw new Error("watermark-stream-invalid");
    if (layer === "foreground" && await contentLeavesDefinitelyEmptyClip(streams.slice(0, validatedIndex), signal)) throw new Error("watermark-clipped");
    await yieldToEventLoop();
  }
  throwIfAborted(signal);
}
