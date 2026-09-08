import { Encodings } from "@pdf-lib/standard-fonts";
import { PDFName, PDFNumber, degrees as pdfDegrees, drawText as drawTextOperator, rgb as pdfRgb, type PDFImage, type PDFPage } from "pdf-lib";

import { QR_LABEL_FONT_PATH } from "../../qr-studio/qrBulk.ts";
import { throwIfAborted, yieldBeforeResultRegistration, yieldToEventLoop } from "../../../utils/cooperativeCancel.ts";
import { finishOutputName } from "../outputName.ts";
import {
  createFinishAnchors,
  viewportPointToPdf,
  type FinishRegion,
  type PdfPageRotation,
  type PdfViewportGeometry,
} from "./geometry.ts";
import {
  displayNumber,
  tokenPageCount,
  type PageSelectionState,
} from "./selection.ts";
import { filenameBaseName } from "./tokens.ts";
import {
  createSixTextRegions,
  decideDocumentFont,
  layoutTextLines,
  preprocessText,
  type LayoutRun,
  type PreparedText,
  type TextFontProbe,
} from "./text.ts";
import {
  addImageXObjectAtPdfCorners,
  addWatermarkXObject,
  assertBackgroundPlacementSupported,
  createTextWatermarkXObject,
  createWatermarkPlacements,
  embedWatermarkImage,
  inspectWatermarkRisksCooperatively,
  measureTextWatermarkBox,
  textWatermarkFontName,
  validateWatermarkResult,
  type PdfWatermarkSettings,
  type WatermarkPlacement,
  type WatermarkRiskCode,
} from "./watermark.ts";
import { applyNormalizedStamp, stampPdfCorners, type PdfStampSettings, type StampPdfCorners } from "./stamp.ts";
import {
  hasStructureChanges,
  rebuildPdfStructure,
  PdfStructureError,
  type PdfStructureOptions,
} from "./structure.ts";
import {
  PdfRasterError,
  preflightRasterPages,
  rasterizePdf,
  type PdfRasterOptions,
} from "./raster.ts";
import { estimateRasterOutputWarning } from "./canvasPolicy.ts";
import {
  createPdfFinishResultStore,
  PdfFinishStorageError,
  type PdfFinishResultStore,
  type PdfFinishStorageMode,
} from "./resultStorage.ts";
import {
  degrees,
  embedCustomPdfFont,
  embedHelvetica,
  getPdfFontCharacterSet,
  loadPdfDocument,
  rgb,
  type PDFFont,
  type PDFDocument,
} from "../../../utils/pdfFontEmbed.ts";

const FULL_NOTO_SIZE = 4_644_748;
const FULL_NOTO_SHA256 = "69975a0ac8472717870aefeab0a4d52739308d90856b9955313b2ad5e0148d68";
export const PDF_FINISH_OUTPUT_OPACITY = 0.9;

export type PdfFinishEngineErrorCode =
  | "protected-document"
  | "unreadable-document"
  | "invalid-field"
  | "control-character"
  | "date-format"
  | "missing-glyph"
  | "narrow-region"
  | "invalid-margin"
  | "invalid-layout"
  | "font-asset"
  | "image-format"
  | "empty-text"
  | "empty-placement"
  | "tile-limit"
  | "background-placement"
  | "risk-confirmation-required"
  | "structure-unsupported"
  | "form-unsupported"
  | "raster-unsupported"
  | "raster-failed"
  | "result-memory-limit"
  | "result-storage"
  | "output-validation";

export class PdfFinishEngineError extends Error {
  readonly code: PdfFinishEngineErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: PdfFinishEngineErrorCode, details: Readonly<Record<string, unknown>> = {}, cause?: unknown) {
    super(`PDF_FINISH_${code.toUpperCase().replaceAll("-", "_")}`, cause === undefined ? undefined : { cause });
    this.name = "PdfFinishEngineError";
    this.code = code;
    this.details = details;
  }
}

export type PdfFinishWarningCode =
  | "unknown-token"
  | "horizontal-overflow"
  | "vertical-overflow"
  | "embedded-font"
  | "raster-dpi-lowered"
  | "raster-output-large"
  | WatermarkRiskCode;

export type PdfFinishPreflightErrorCode =
  | "control-character"
  | "date-format"
  | "missing-glyph"
  | "narrow-region"
  | "invalid-margin"
  | "invalid-layout"
  | "image-format"
  | "empty-text"
  | "empty-placement"
  | "tile-limit"
  | "background-placement"
  | "raster-unsupported";

export interface PdfFinishPreflightError {
  code: PdfFinishPreflightErrorCode;
  field: "template" | "fontSize" | "margin" | "watermark" | "image" | "raster";
  fileKey: string;
  physicalPage: number;
  line?: number;
  column?: number;
  codePoint?: number;
  token?: string;
}

export interface PdfFinishPreflightResult {
  errors: PdfFinishPreflightError[];
  warnings: PdfFinishWarningCode[];
}

export interface PdfFinishDecorationOptions {
  template: string;
  region: FinishRegion | "center";
  fontSize: number;
  color: string;
  margin: number;
  startNumber: number;
  startPage: number;
  excludeCover: boolean;
  opacity?: number;
  watermark?: PdfWatermarkSettings;
  stamp?: PdfStampSettings;
  structure?: PdfStructureOptions;
  raster?: PdfRasterOptions;
}

export interface PdfFinishInputFile {
  key: string;
  file: File;
  selection: PageSelectionState;
}

export interface PdfFinishOutput {
  key: string;
  fileName: string;
  blob: Blob;
  storage: PdfFinishStorageMode;
  dispose: () => Promise<void>;
  warnings: PdfFinishWarningCode[];
}

export interface PdfFinishProgress {
  phase: "reading" | "font" | "decorating" | "rasterizing" | "saving";
  completed: number;
  total: number;
  percent: number;
}

export interface PdfFinishEngineInput {
  files: readonly PdfFinishInputFile[];
  options: PdfFinishDecorationOptions;
  locale: string;
  signal?: AbortSignal;
  clock?: () => Date;
  onProgress?: (progress: PdfFinishProgress) => void;
  loadFontAsset?: (signal?: AbortSignal) => Promise<ArrayBuffer>;
  outputName?: { suffix: string; fallback: string };
  allowRiskyDocuments?: boolean;
  validateWatermarkOutput?: typeof validateWatermarkResult;
  resultStore?: PdfFinishResultStore;
}

export class PdfFinishCanceledError extends DOMException {
  readonly partialResults: readonly PdfFinishOutput[];

  constructor(message: string, partialResults: readonly PdfFinishOutput[]) {
    super(message, "AbortError");
    this.partialResults = [...partialResults];
  }
}

export class PdfFinishPartialError extends PdfFinishEngineError {
  readonly partialResults: readonly PdfFinishOutput[];

  constructor(code: PdfFinishEngineErrorCode, partialResults: readonly PdfFinishOutput[], cause?: unknown) {
    super(code, {}, cause);
    this.name = "PdfFinishPartialError";
    this.partialResults = [...partialResults];
  }
}

export async function pdfFinishOutputBytes(output: PdfFinishOutput) {
  return output.blob.arrayBuffer();
}

interface PreparedPage {
  physicalPage: number;
  prepared: PreparedText;
}

interface PageDecorationPlan extends PreparedPage {
  kind: "text-decoration" | "watermark-text";
  page: PDFPage;
  font: PDFFont;
  runs: LayoutRun[];
  warnings: PdfFinishWarningCode[];
  textRotation: PdfPageRotation;
  viewport: PdfViewportGeometry;
  watermarkPlacements?: WatermarkPlacement[];
  watermarkWidth?: number;
  watermarkHeight?: number;
  watermarkBBoxHeight?: number;
  watermarkBaselineOffset?: number;
}

interface ImageWatermarkPlan {
  kind: "watermark-image";
  physicalPage: number;
  page: PDFPage;
  image: PDFImage;
  viewport: PdfViewportGeometry;
  watermarkPlacements: WatermarkPlacement[];
}

interface ImageStampPlan {
  kind: "stamp-image";
  physicalPage: number;
  page: PDFPage;
  image: PDFImage;
  corners: StampPdfCorners;
}

type DecorationPlan = PageDecorationPlan | ImageWatermarkPlan | ImageStampPlan;

interface BatchFontResources {
  getFontAsset: () => Promise<ArrayBuffer>;
  getCharacterSet: () => Promise<number[]>;
}

function report(input: PdfFinishEngineInput, phase: PdfFinishProgress["phase"], completed: number, total: number) {
  input.onProgress?.({ phase, completed, total, percent: total ? Math.round(completed / total * 100) : 0 });
}

function validateOptions(options: PdfFinishDecorationOptions) {
  if (!Number.isFinite(options.fontSize) || options.fontSize < 6 || options.fontSize > 72) throw new PdfFinishEngineError("invalid-field", { field: "fontSize" });
  if (!Number.isFinite(options.margin) || options.margin < 0 || options.margin > 144) throw new PdfFinishEngineError("invalid-field", { field: "margin" });
  if (!Number.isSafeInteger(options.startNumber)) throw new PdfFinishEngineError("invalid-field", { field: "startNumber" });
  if (!Number.isSafeInteger(options.startPage) || options.startPage < 1) throw new PdfFinishEngineError("invalid-field", { field: "startPage" });
  if (!/^#[0-9a-f]{6}$/iu.test(options.color)) throw new PdfFinishEngineError("invalid-field", { field: "color" });
  if (options.opacity !== undefined && (!Number.isFinite(options.opacity) || options.opacity < 0 || options.opacity > 1)) {
    throw new PdfFinishEngineError("invalid-field", { field: "opacity" });
  }
  if (options.watermark && options.stamp) throw new PdfFinishEngineError("invalid-field", { field: "decoration" });
  if (options.structure && !(["preserve", "remove", "flatten"] as const).includes(options.structure.formMode)) {
    throw new PdfFinishEngineError("invalid-field", { field: "structure" });
  }
  if (options.raster && (typeof options.raster.enabled !== "boolean"
      || !([150, 200, 300] as const).includes(options.raster.dpi)
      || !(["png", "jpeg"] as const).includes(options.raster.format))) {
    throw new PdfFinishEngineError("invalid-field", { field: "raster" });
  }
  if (options.stamp) {
    const { placement } = options.stamp;
    if (!options.stamp.image
        || [placement.cx, placement.cy, placement.rw, placement.aspect].some((value) => !Number.isFinite(value))
        || placement.cx < 0 || placement.cx > 1
        || placement.cy < 0 || placement.cy > 1
        || placement.rw <= 0 || placement.rw > 1
        || placement.aspect <= 0) {
      throw new PdfFinishEngineError("invalid-field", { field: "stamp" });
    }
  }
  const watermark = options.watermark;
  if (!watermark) return;
  if (!(["text", "image"] as const).includes(watermark.content)
      || !(["background", "foreground"] as const).includes(watermark.layer)
      || !(["single", "tile"] as const).includes(watermark.pattern)
      || !(["top-left", "top-center", "top-right", "center", "bottom-left", "bottom-center", "bottom-right"] as const).includes(watermark.region)) {
    throw new PdfFinishEngineError("invalid-field", { field: "watermark" });
  }
  if (!Number.isFinite(watermark.rotation) || watermark.rotation < -180 || watermark.rotation > 180
      || !Number.isFinite(watermark.opacity) || watermark.opacity < 0.01 || watermark.opacity > 1
      || !Number.isFinite(watermark.sizePercent) || watermark.sizePercent < 1 || watermark.sizePercent > 100
      || !Number.isFinite(watermark.gap) || watermark.gap < 0 || watermark.gap > 2_000
      || !Number.isFinite(watermark.offsetX) || watermark.offsetX < -2_000 || watermark.offsetX > 2_000
      || !Number.isFinite(watermark.offsetY) || watermark.offsetY < -2_000 || watermark.offsetY > 2_000) {
    throw new PdfFinishEngineError("invalid-field", { field: "watermark" });
  }
  if (watermark.content === "image" && !watermark.image) throw new PdfFinishEngineError("image-format", { field: "image" });
}

function colorComponents(value: string) {
  return [1, 3, 5].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255) as [number, number, number];
}

function normalizeRotation(value: number): PdfPageRotation {
  const normalized = (Math.round(value / 90) * 90 % 360 + 360) % 360;
  if (normalized === 0 || normalized === 90 || normalized === 180 || normalized === 270) return normalized;
  return 0;
}

function pageUserUnit(page: PDFPage) {
  const raw = page.node.get(PDFName.of("UserUnit"));
  const resolved = raw ? page.doc.context.lookup(raw) : undefined;
  return resolved instanceof PDFNumber && resolved.asNumber() > 0 ? resolved.asNumber() : 1;
}

export function pdfPageViewport(page: PDFPage): PdfViewportGeometry {
  const crop = page.getCropBox();
  const media = page.getMediaBox();
  const rotation = normalizeRotation(page.getRotation().angle);
  const unit = pageUserUnit(page);
  const mediaXMin = Math.min(media.x, media.x + media.width);
  const mediaYMin = Math.min(media.y, media.y + media.height);
  const mediaXMax = Math.max(media.x, media.x + media.width);
  const mediaYMax = Math.max(media.y, media.y + media.height);
  const cropXMin = Math.min(crop.x, crop.x + crop.width);
  const cropYMin = Math.min(crop.y, crop.y + crop.height);
  const cropXMax = Math.max(crop.x, crop.x + crop.width);
  const cropYMax = Math.max(crop.y, crop.y + crop.height);
  const intersection = {
    xMin: Math.max(mediaXMin, cropXMin),
    yMin: Math.max(mediaYMin, cropYMin),
    xMax: Math.min(mediaXMax, cropXMax),
    yMax: Math.min(mediaYMax, cropYMax),
  };
  const visible = intersection.xMax > intersection.xMin && intersection.yMax > intersection.yMin
    ? intersection
    : { xMin: mediaXMin, yMin: mediaYMin, xMax: mediaXMax, yMax: mediaYMax };
  const width = visible.xMax - visible.xMin;
  const height = visible.yMax - visible.yMin;
  const negativeX = -visible.xMin * unit || 0;
  const negativeY = -visible.yMin * unit || 0;
  if (rotation === 90) return { width: height * unit, height: width * unit, rotation, transform: [0, unit, unit, 0, negativeY, negativeX] };
  if (rotation === 180) return { width: width * unit, height: height * unit, rotation, transform: [-unit, 0, 0, unit, visible.xMax * unit, negativeY] };
  if (rotation === 270) return { width: height * unit, height: width * unit, rotation, transform: [0, -unit, -unit, 0, visible.yMax * unit, visible.xMax * unit] };
  return { width: width * unit, height: height * unit, rotation, transform: [unit, 0, 0, -unit, negativeX, visible.yMax * unit] };
}

function helveticaProbe(): TextFontProbe {
  return {
    encodeText(text) {
      for (const character of text) Encodings.WinAnsi.encodeUnicodeCodePoint(character.codePointAt(0) ?? 0);
      return text;
    },
    widthOfTextAtSize() {
      return 0;
    },
  };
}

function fontNeedsNoto(pages: readonly PreparedPage[]) {
  const probe = helveticaProbe();
  try {
    for (const page of pages) for (const line of page.prepared.lines) if (line) probe.encodeText(line);
    return false;
  } catch {
    return true;
  }
}

async function defaultLoadFontAsset(signal?: AbortSignal) {
  throwIfAborted(signal);
  try {
    const response = await fetch(new URL(`${import.meta.env.BASE_URL}${QR_LABEL_FONT_PATH}`, window.location.origin), { signal });
    if (!response.ok) throw new Error("HTTP");
    const bytes = await response.arrayBuffer();
    throwIfAborted(signal);
    if (bytes.byteLength !== FULL_NOTO_SIZE) throw new Error("SIZE");
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    throwIfAborted(signal);
    const hash = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
    if (hash !== FULL_NOTO_SHA256) throw new Error("SHA");
    return bytes;
  } catch (error) {
    throwIfAborted(signal);
    throw new PdfFinishEngineError("font-asset", {}, error);
  }
}

function preparePages(file: PdfFinishInputFile, options: PdfFinishDecorationOptions, locale: string, batchDate: Date) {
  const totalPages = tokenPageCount(file.selection.totalPages);
  return file.selection.exactPages.map((physicalPage): PreparedPage => ({
    physicalPage,
    prepared: preprocessText(options.template, {
      page: displayNumber(physicalPage, options.startNumber, options),
      pages: totalPages,
      filename: filenameBaseName(file.file.name),
      date: batchDate,
      locale,
    }),
  }));
}

function templatePosition(template: string, offset: number) {
  const prefix = template.slice(0, offset).replace(/\r\n?/g, "\n");
  const lines = prefix.split("\n");
  return { line: lines.length, column: [...(lines.at(-1) ?? "")].length + 1 };
}

function preparedTextErrors(source: PdfFinishInputFile, options: PdfFinishDecorationOptions, pages: readonly PreparedPage[]): PdfFinishPreflightError[] {
  return pages.flatMap(({ physicalPage, prepared }): PdfFinishPreflightError[] => {
    if (!prepared.text.trim()) {
      return [{ code: "empty-text" as const, field: "template" as const, fileKey: source.key, physicalPage }];
    }
    return prepared.errors.map((error) => {
      if (error.code === "date-format") {
        return {
          code: "date-format" as const,
          field: "template" as const,
          fileKey: source.key,
          physicalPage,
          ...templatePosition(options.template, error.offset),
          token: error.token,
        };
      }
      return {
        code: "control-character" as const,
        field: "template" as const,
        fileKey: source.key,
        physicalPage,
        line: error.line,
        column: error.column,
        codePoint: error.codePoint,
      };
    });
  });
}

function isProtectedLoadError(error: unknown) {
  return error instanceof Error && /encrypt|password|permission/iu.test(`${error.name} ${error.message}`);
}

async function loadDocument(file: File, signal?: AbortSignal, structure?: PdfStructureOptions) {
  try {
    throwIfAborted(signal);
    const bytes = await file.arrayBuffer();
    throwIfAborted(signal);
    const rebuilt = hasStructureChanges(structure) ? await rebuildPdfStructure(bytes, structure!) : undefined;
    const document = rebuilt?.document ?? await loadPdfDocument(bytes);
    throwIfAborted(signal);
    return document;
  } catch (error) {
    throwIfAborted(signal);
    if (error instanceof PdfStructureError) {
      throw new PdfFinishEngineError(error.reason === "unsupported-form" ? "form-unsupported" : "structure-unsupported", {}, error);
    }
    throw new PdfFinishEngineError(isProtectedLoadError(error) ? "protected-document" : "unreadable-document", {}, error);
  }
}

function prepareFontDecision(preparedPages: readonly PreparedPage[], characterSet: readonly number[]) {
  return decideDocumentFont(
    preparedPages.map(({ physicalPage, prepared }) => ({ field: `page-${physicalPage}`, prepared })),
    helveticaProbe(),
    { encodeText: () => "", widthOfTextAtSize: () => 0, getCharacterSet: () => [...characterSet] },
  );
}

function addTextWarnings(target: Set<PdfFinishWarningCode>, preparedPages: readonly PreparedPage[]) {
  if (preparedPages.some(({ prepared }) => prepared.warnings.length > 0)) target.add("unknown-token");
}

function createBatchFontResources(input: PdfFinishEngineInput): BatchFontResources {
  let assetPromise: Promise<ArrayBuffer> | undefined;
  let characterSetPromise: Promise<number[]> | undefined;
  const getFontAsset = async () => {
    throwIfAborted(input.signal);
    assetPromise ??= (input.loadFontAsset ?? defaultLoadFontAsset)(input.signal);
    try {
      const bytes = await assetPromise;
      throwIfAborted(input.signal);
      return bytes;
    } catch (error) {
      throwIfAborted(input.signal);
      if (error instanceof PdfFinishEngineError) throw error;
      throw new PdfFinishEngineError("font-asset", {}, error);
    }
  };
  return {
    getFontAsset,
    getCharacterSet: async () => {
      characterSetPromise ??= getFontAsset().then((bytes) => getPdfFontCharacterSet(bytes));
      const characterSet = await characterSetPromise;
      throwIfAborted(input.signal);
      return characterSet;
    },
  };
}

function createPageDecorationPlan(
  document: PDFDocument,
  source: PdfFinishInputFile,
  preparedPage: PreparedPage,
  options: PdfFinishDecorationOptions,
  font: PDFFont,
): PageDecorationPlan | PdfFinishPreflightError {
  const { physicalPage, prepared } = preparedPage;
  const page = document.getPages()[physicalPage - 1];
  if (!page) throw new PdfFinishEngineError("invalid-field", { field: "selection" });
  const viewport = pdfPageViewport(page);
  const margins = { top: options.margin, right: options.margin, bottom: options.margin, left: options.margin };
  if (options.watermark) {
    const availableWidth = viewport.width - options.margin * 2;
    const availableHeight = viewport.height - options.margin * 2;
    if (availableWidth <= 0 || availableHeight <= 0) {
      return { code: "invalid-margin", field: "margin", fileKey: source.key, physicalPage };
    }
    let width = availableWidth * options.watermark.sizePercent / 100;
    let regionHeight = availableHeight;
    let alignment: "left" | "center" | "right" = "center";
    if (options.watermark.region !== "center") {
      let region;
      try {
        region = createSixTextRegions(viewport.width, viewport.height, margins).find(({ region: name }) => name === options.watermark?.region);
      } catch {
        return { code: "invalid-margin", field: "margin", fileKey: source.key, physicalPage };
      }
      if (!region) return { code: "invalid-layout", field: "watermark", fileKey: source.key, physicalPage };
      width = Math.min(width, region.box.width);
      regionHeight = region.box.height;
      alignment = region.alignment;
    }
    if (width <= 0) return { code: "invalid-layout", field: "watermark", fileKey: source.key, physicalPage };
    const layout = layoutTextLines({
      lines: prepared.lines,
      size: options.fontSize,
      region: { x: 0, y: 0, width, height: regionHeight },
      alignment,
      vertical: "bottom",
      font,
    });
    if (!layout.ok) {
      return {
        code: layout.error === "narrow-region" ? "narrow-region" : "invalid-layout",
        field: "fontSize",
        fileKey: source.key,
        physicalPage,
      };
    }
    if (layout.runs.length === 0) return { code: "empty-placement", field: "watermark", fileKey: source.key, physicalPage };
    const textBox = measureTextWatermarkBox(font, options.fontSize, layout.lineHeight, layout.runs.length);
    const height = textBox.height;
    const placement = createWatermarkPlacements({ viewport, width, height, settings: options.watermark, margin: options.margin });
    if (!placement.ok) {
      return {
        code: placement.error,
        field: "watermark",
        fileKey: source.key,
        physicalPage,
      };
    }
    try {
      if (options.watermark.layer === "background") assertBackgroundPlacementSupported(page);
    } catch {
      return { code: "background-placement", field: "watermark", fileKey: source.key, physicalPage };
    }
    return {
      ...preparedPage,
      kind: "watermark-text",
      page,
      font,
      runs: layout.runs,
      warnings: layout.warnings,
      textRotation: 0,
      viewport,
      watermarkPlacements: placement.placements,
      watermarkWidth: width,
      watermarkHeight: height,
      watermarkBBoxHeight: textBox.bboxHeight,
      watermarkBaselineOffset: textBox.baselineOffset,
    };
  }
  let regions;
  let anchor;
  try {
    regions = createSixTextRegions(viewport.width, viewport.height, margins);
    anchor = createFinishAnchors(viewport, margins).find(({ region }) => region === options.region);
  } catch {
    return { code: "invalid-margin", field: "margin", fileKey: source.key, physicalPage };
  }
  const region = regions.find((candidate) => candidate.region === options.region);
  if (!region || !anchor) return { code: "invalid-layout", field: "fontSize", fileKey: source.key, physicalPage };
  const layout = layoutTextLines({
    lines: prepared.lines,
    size: options.fontSize,
    region: region.box,
    alignment: region.alignment,
    vertical: region.vertical,
    font,
  });
  if (!layout.ok) {
    return {
      code: layout.error === "narrow-region" ? "narrow-region" : "invalid-layout",
      field: "fontSize",
      fileKey: source.key,
      physicalPage,
    };
  }
  return { ...preparedPage, kind: "text-decoration", page, font, runs: layout.runs, warnings: layout.warnings, textRotation: anchor.textRotation, viewport };
}

function imageWatermarkError(source: PdfFinishInputFile, physicalPage: number, code: "image-format" | "empty-placement" | "tile-limit" | "invalid-layout" | "background-placement"): PdfFinishPreflightError {
  return { code, field: code === "image-format" ? "image" : "watermark", fileKey: source.key, physicalPage };
}

async function analyzeImageWatermark(
  input: PdfFinishEngineInput,
  source: PdfFinishInputFile,
  document: PDFDocument,
  warnings: Set<PdfFinishWarningCode>,
): Promise<{ document: PDFDocument; plans: ImageWatermarkPlan[]; warnings: Set<PdfFinishWarningCode>; errors: PdfFinishPreflightError[] }> {
  const settings = input.options.watermark;
  if (!settings?.image) return { document, plans: [], warnings, errors: [imageWatermarkError(source, source.selection.exactPages[0] ?? 1, "image-format")] };
  let image: PDFImage;
  try {
    image = await embedWatermarkImage(document, settings.image, input.signal);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return { document, plans: [], warnings, errors: [imageWatermarkError(source, source.selection.exactPages[0] ?? 1, "image-format")] };
  }
  const plans: ImageWatermarkPlan[] = [];
  const errors: PdfFinishPreflightError[] = [];
  for (const physicalPage of source.selection.exactPages) {
    throwIfAborted(input.signal);
    await yieldToEventLoop();
    throwIfAborted(input.signal);
    const page = document.getPages()[physicalPage - 1];
    if (!page) throw new PdfFinishEngineError("invalid-field", { field: "selection" });
    const viewport = pdfPageViewport(page);
    const scale = Math.min(
      viewport.width * settings.sizePercent / 100 / image.width,
      viewport.height * settings.sizePercent / 100 / image.height,
    );
    const width = image.width * scale;
    const height = image.height * scale;
    const placement = createWatermarkPlacements({ viewport, width, height, settings, margin: input.options.margin });
    if (!placement.ok) {
      errors.push(imageWatermarkError(source, physicalPage, placement.error));
      continue;
    }
    try {
      if (settings.layer === "background") assertBackgroundPlacementSupported(page);
    } catch {
      errors.push(imageWatermarkError(source, physicalPage, "background-placement"));
      continue;
    }
    plans.push({ kind: "watermark-image", physicalPage, page, image, viewport, watermarkPlacements: placement.placements });
  }
  return { document, plans, warnings, errors };
}

async function analyzeStamp(
  input: PdfFinishEngineInput,
  source: PdfFinishInputFile,
  document: PDFDocument,
): Promise<{ document: PDFDocument; plans: ImageStampPlan[]; warnings: Set<PdfFinishWarningCode>; errors: PdfFinishPreflightError[] }> {
  const settings = input.options.stamp;
  const warnings = new Set<PdfFinishWarningCode>();
  if (!settings?.image) return { document, plans: [], warnings, errors: [imageWatermarkError(source, source.selection.exactPages[0] ?? 1, "image-format")] };
  let image: PDFImage;
  try {
    image = await embedWatermarkImage(document, settings.image, input.signal);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return { document, plans: [], warnings, errors: [imageWatermarkError(source, source.selection.exactPages[0] ?? 1, "image-format")] };
  }
  const intrinsicAspect = image.width / image.height;
  if (!Number.isFinite(intrinsicAspect) || intrinsicAspect <= 0
      || Math.abs(intrinsicAspect / settings.placement.aspect - 1) > 0.001) {
    return { document, plans: [], warnings, errors: [imageWatermarkError(source, source.selection.exactPages[0] ?? 1, "image-format")] };
  }
  const plans: ImageStampPlan[] = [];
  for (const physicalPage of source.selection.exactPages) {
    throwIfAborted(input.signal);
    await yieldToEventLoop();
    throwIfAborted(input.signal);
    const page = document.getPages()[physicalPage - 1];
    if (!page) throw new PdfFinishEngineError("invalid-field", { field: "selection" });
    const viewport = pdfPageViewport(page);
    const applied = applyNormalizedStamp(settings.placement, viewport);
    const corners = stampPdfCorners(applied, {
      width: viewport.width,
      height: viewport.height,
      convertToPdfPoint: (x, y) => {
        const point = viewportPointToPdf(viewport.transform, x, y);
        return [point.x, point.y];
      },
    });
    plans.push({ kind: "stamp-image", physicalPage, page, image, corners });
  }
  return { document, plans, warnings, errors: [] };
}

async function analyzeDocument(
  input: PdfFinishEngineInput,
  source: PdfFinishInputFile,
  batchDate: Date,
  resources: BatchFontResources,
  fileIndex: number,
): Promise<{ document?: PDFDocument; plans: DecorationPlan[]; warnings: Set<PdfFinishWarningCode>; errors: PdfFinishPreflightError[] }> {
  if (input.options.stamp) {
    const document = await loadDocument(source.file, input.signal, input.options.structure);
    return analyzeStamp(input, source, document);
  }
  const preparedPages = preparePages(source, input.options, input.locale, new Date(batchDate.getTime()));
  const warnings = new Set<PdfFinishWarningCode>();
  addTextWarnings(warnings, preparedPages);
  const textErrors = input.options.watermark?.content === "image" ? [] : preparedTextErrors(source, input.options, preparedPages);
  if (textErrors.length > 0) return { plans: [], warnings, errors: textErrors };

  const document = await loadDocument(source.file, input.signal, input.options.structure);
  if (input.options.watermark) {
    for (const warning of await inspectWatermarkRisksCooperatively(document, input.signal)) warnings.add(warning);
  }
  if (input.options.watermark?.content === "image") return analyzeImageWatermark(input, source, document, warnings);
  const needsNoto = fontNeedsNoto(preparedPages);
  let characterSet: number[] = [];
  if (needsNoto) {
    report(input, "font", fileIndex, input.files.length);
    characterSet = await resources.getCharacterSet();
  }
  const decision = prepareFontDecision(preparedPages, characterSet);
  if (decision.blocked) {
    const errors = decision.missing.map((missing) => ({
      code: "missing-glyph" as const,
      field: "template" as const,
      fileKey: source.key,
      physicalPage: Number.parseInt(missing.field.replace(/^page-/u, ""), 10),
      line: missing.line,
      column: missing.column,
      codePoint: missing.codePoint,
    }));
    return { document, plans: [], warnings, errors };
  }

  throwIfAborted(input.signal);
  const font = decision.font === "noto"
    ? await embedCustomPdfFont(document, await resources.getFontAsset())
    : await embedHelvetica(document);
  throwIfAborted(input.signal);
  if (decision.font === "noto") warnings.add("embedded-font");

  const plans: DecorationPlan[] = [];
  const errors: PdfFinishPreflightError[] = [];
  for (const preparedPage of preparedPages) {
    throwIfAborted(input.signal);
    await yieldToEventLoop();
    throwIfAborted(input.signal);
    const plan = createPageDecorationPlan(document, source, preparedPage, input.options, font);
    if ("code" in plan) errors.push(plan);
    else {
      plans.push(plan);
      for (const warning of plan.warnings) warnings.add(warning);
    }
  }
  return { document, plans, warnings, errors };
}

function engineErrorForPreflight(errors: readonly PdfFinishPreflightError[]) {
  const first = errors[0];
  if (!first) return new PdfFinishEngineError("invalid-layout");
  if (first.code === "missing-glyph") {
    return new PdfFinishEngineError("missing-glyph", {
      missing: errors.filter(({ code }) => code === "missing-glyph").map(({ fileKey, physicalPage, line, column, codePoint }) => ({
        field: fileKey,
        physicalPage,
        line,
        column,
        codePoint,
      })),
    });
  }
  return new PdfFinishEngineError(first.code, { ...first, errors });
}

function watermarkTextOperators(plan: PageDecorationPlan, input: PdfFinishEngineInput) {
  const color = colorComponents(input.options.color);
  const fontName = textWatermarkFontName();
  return plan.runs.flatMap((run) => drawTextOperator(plan.font.encodeText(run.text), {
    x: run.x,
    y: run.y + (plan.watermarkBaselineOffset ?? 0),
    size: input.options.fontSize,
    font: fontName,
    color: pdfRgb(...color),
    rotate: pdfDegrees(0),
    xSkew: pdfDegrees(0),
    ySkew: pdfDegrees(0),
  }));
}

function preflightRasterDocument(source: PdfFinishInputFile, document: PDFDocument, options: PdfRasterOptions) {
  const raster = preflightRasterPages(source.selection.exactPages.map((pageNumber) => {
    const page = document.getPages()[pageNumber - 1];
    if (!page) throw new PdfFinishEngineError("invalid-field", { field: "selection" });
    const viewport = pdfPageViewport(page);
    return { pageNumber, widthPoints: viewport.width, heightPoints: viewport.height };
  }), options.dpi);
  const outputWarning = raster.supported ? estimateRasterOutputWarning({
    pages: raster.plans.map(({ measurement, appliedDpi }) => ({ pixels: measurement.pixels, dpi: appliedDpi })),
    format: options.format,
    inputBytes: source.file.size,
  }) : undefined;
  return { raster, outputWarning };
}

async function decorateDocument(input: PdfFinishEngineInput, plans: readonly DecorationPlan[], warnings: Set<PdfFinishWarningCode>, completed: { value: number }, total: number) {
  const color = colorComponents(input.options.color);
  for (const plan of plans) {
    throwIfAborted(input.signal);
    await yieldToEventLoop();
    throwIfAborted(input.signal);
    const watermark = input.options.watermark;
    if (plan.kind === "stamp-image") {
      await addImageXObjectAtPdfCorners(plan.page, plan.image.ref, plan.corners, input.signal);
    } else if (plan.kind === "watermark-image") {
      if (!watermark) throw new PdfFinishEngineError("invalid-layout");
      await addWatermarkXObject(plan.page, plan.image.ref, 1, 1, plan.viewport, plan.watermarkPlacements, watermark.opacity, watermark.layer, input.signal);
    } else if (plan.kind === "watermark-text") {
      if (!watermark || !plan.watermarkPlacements || !plan.watermarkWidth || !plan.watermarkHeight || !plan.watermarkBBoxHeight) throw new PdfFinishEngineError("invalid-layout");
      const form = createTextWatermarkXObject(
        plan.page.doc,
        plan.font.ref,
        watermarkTextOperators(plan, input),
        plan.watermarkWidth,
        plan.watermarkBBoxHeight,
      );
      await addWatermarkXObject(plan.page, form.reference, plan.watermarkWidth, plan.watermarkHeight, plan.viewport, plan.watermarkPlacements, watermark.opacity, watermark.layer, input.signal);
    } else {
      const unit = pageUserUnit(plan.page);
      for (const run of plan.runs) {
        const point = viewportPointToPdf(plan.viewport.transform, run.x, plan.viewport.height - run.y);
        plan.page.drawText(run.text, {
          x: point.x,
          y: point.y,
          size: input.options.fontSize / unit,
          font: plan.font,
          color: rgb(...color),
          rotate: degrees(plan.textRotation),
          opacity: input.options.opacity ?? PDF_FINISH_OUTPUT_OPACITY,
        });
      }
    }
    completed.value += 1;
    report(input, "decorating", completed.value, total);
  }
}

export async function preflightPdfFiles(input: PdfFinishEngineInput): Promise<PdfFinishPreflightResult> {
  validateOptions(input.options);
  if (!input.files.length || input.files.some(({ selection }) => !selection.canExecute || selection.exactPages.length === 0)) {
    throw new PdfFinishEngineError("invalid-field", { field: "selection" });
  }
  const batchDate = (input.clock ?? (() => new Date()))();
  if (!(batchDate instanceof Date) || Number.isNaN(batchDate.getTime())) throw new PdfFinishEngineError("invalid-field", { field: "clock" });
  const resources = createBatchFontResources(input);
  const warnings = new Set<PdfFinishWarningCode>();
  const errors: PdfFinishPreflightError[] = [];
  for (const [fileIndex, source] of input.files.entries()) {
    throwIfAborted(input.signal);
    await yieldToEventLoop();
    throwIfAborted(input.signal);
    const analyzed = await analyzeDocument(input, source, batchDate, resources, fileIndex);
    for (const warning of analyzed.warnings) warnings.add(warning);
    errors.push(...analyzed.errors);
    if (input.options.raster?.enabled && analyzed.document) {
      const { raster, outputWarning } = preflightRasterDocument(source, analyzed.document, input.options.raster);
      if (!raster.supported) {
        errors.push({
          code: "raster-unsupported",
          field: "raster",
          fileKey: source.key,
          physicalPage: raster.unsupportedPage ?? source.selection.exactPages[0],
        });
      } else {
        if (raster.plans.some(({ downgraded }) => downgraded)) warnings.add("raster-dpi-lowered");
        if (outputWarning?.warn) warnings.add("raster-output-large");
      }
    }
  }
  return { errors, warnings: [...warnings] };
}

export async function finishPdfFiles(input: PdfFinishEngineInput): Promise<PdfFinishOutput[]> {
  validateOptions(input.options);
  if (!input.files.length || input.files.some(({ selection }) => !selection.canExecute || selection.exactPages.length === 0)) {
    throw new PdfFinishEngineError("invalid-field", { field: "selection" });
  }
  const batchDate = (input.clock ?? (() => new Date()))();
  if (!(batchDate instanceof Date) || Number.isNaN(batchDate.getTime())) throw new PdfFinishEngineError("invalid-field", { field: "clock" });
  const total = input.files.reduce((sum, { selection }) => sum + selection.exactPages.length, 0);
  const completed = { value: 0 };
  const resources = createBatchFontResources(input);
  const outputs: PdfFinishOutput[] = [];
  const resultStore = input.resultStore ?? await createPdfFinishResultStore();
  try {
    for (const [fileIndex, source] of input.files.entries()) {
      throwIfAborted(input.signal);
      await yieldToEventLoop();
      throwIfAborted(input.signal);
      report(input, "reading", fileIndex, input.files.length);
      throwIfAborted(input.signal);
      const analyzed = await analyzeDocument(input, source, batchDate, resources, fileIndex);
      if (analyzed.errors.length > 0) throw engineErrorForPreflight(analyzed.errors);
      if (input.options.watermark && [...analyzed.warnings].some((warning) => warning.startsWith("risky-")) && !input.allowRiskyDocuments) {
        throw new PdfFinishEngineError("risk-confirmation-required");
      }
      const document = analyzed.document;
      if (!document) throw new PdfFinishEngineError("invalid-layout");
      if (input.options.raster?.enabled) {
        const { raster, outputWarning } = preflightRasterDocument(source, document, input.options.raster);
        if (!raster.supported) throw new PdfFinishEngineError("raster-unsupported", { physicalPage: raster.unsupportedPage });
        if (raster.plans.some(({ downgraded }) => downgraded)) analyzed.warnings.add("raster-dpi-lowered");
        if (outputWarning?.warn) analyzed.warnings.add("raster-output-large");
      }
      await decorateDocument(input, analyzed.plans, analyzed.warnings, completed, total);
      throwIfAborted(input.signal);
      report(input, "saving", fileIndex, input.files.length);
      // Let the saving state paint before pdf-lib enters its indivisible
      // serialization step. That step cannot be interrupted synchronously, so a
      // large document must at least retain visible, truthful progress.
      await yieldToEventLoop();
      throwIfAborted(input.signal);
      let bytes = await document.save({ updateFieldAppearances: false });
      throwIfAborted(input.signal);
      if (input.options.watermark || input.options.stamp) {
        try {
          await (input.validateWatermarkOutput ?? validateWatermarkResult)(bytes, source.selection.totalPages, source.selection.exactPages, input.options.watermark?.layer ?? "foreground", input.signal);
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") throw error;
          throw new PdfFinishEngineError("output-validation", {}, error);
        }
        throwIfAborted(input.signal);
      }
      if (input.options.raster?.enabled) {
        try {
          const raster = await rasterizePdf({
            bytes,
            selectedPages: source.selection.exactPages,
            options: input.options.raster,
            language: input.locale.toLowerCase().startsWith("ko") ? "ko" : "en",
            signal: input.signal,
            onPage: (rasterCompleted, rasterTotal) => report(input, "rasterizing", rasterCompleted, rasterTotal),
          });
          bytes = raster.bytes;
          if (raster.downgradedPages.length) analyzed.warnings.add("raster-dpi-lowered");
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") throw error;
          if (error instanceof PdfRasterError && ["unsupported-page", "canvas"].includes(error.reason)) {
            throw new PdfFinishEngineError("raster-unsupported", { physicalPage: error.pageNumber }, error);
          }
          throw new PdfFinishEngineError("raster-failed", {}, error);
        }
      }
      await yieldBeforeResultRegistration(input.signal);
      let stored;
      try {
        stored = await resultStore.store(bytes, finishOutputName(source.file.name, input.locale, input.outputName), input.signal);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") throw error;
        if (error instanceof PdfFinishStorageError) {
          throw new PdfFinishPartialError(error.reason === "memory-limit" ? "result-memory-limit" : "result-storage", outputs, error);
        }
        throw error;
      }
      outputs.push({
        key: source.key,
        fileName: finishOutputName(source.file.name, input.locale, input.outputName),
        blob: stored.blob,
        storage: stored.mode,
        dispose: stored.dispose,
        warnings: [...analyzed.warnings],
      });
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError" && outputs.length > 0) {
      throw new PdfFinishCanceledError(error.message, outputs);
    }
    if (outputs.length > 0 && error instanceof PdfFinishEngineError && !(error instanceof PdfFinishPartialError)) {
      throw new PdfFinishPartialError(error.code, outputs, error);
    }
    if (outputs.length === 0) await resultStore.dispose();
    throw error;
  }
  return outputs;
}
