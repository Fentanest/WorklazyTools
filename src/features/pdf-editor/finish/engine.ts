import { Encodings } from "@pdf-lib/standard-fonts";
import { PDFName, PDFNumber, type PDFPage } from "pdf-lib";

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
  | "font-asset";

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

export type PdfFinishWarningCode = "unknown-token" | "horizontal-overflow" | "vertical-overflow" | "embedded-font";

export type PdfFinishPreflightErrorCode =
  | "control-character"
  | "date-format"
  | "missing-glyph"
  | "narrow-region"
  | "invalid-margin"
  | "invalid-layout";

export interface PdfFinishPreflightError {
  code: PdfFinishPreflightErrorCode;
  field: "template" | "fontSize" | "margin";
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
  region: FinishRegion;
  fontSize: number;
  color: string;
  margin: number;
  startNumber: number;
  startPage: number;
  excludeCover: boolean;
  opacity?: number;
}

export interface PdfFinishInputFile {
  key: string;
  file: File;
  selection: PageSelectionState;
}

export interface PdfFinishOutput {
  key: string;
  fileName: string;
  buffer: ArrayBuffer;
  warnings: PdfFinishWarningCode[];
}

export interface PdfFinishProgress {
  phase: "reading" | "font" | "decorating" | "saving";
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
}

export class PdfFinishCanceledError extends DOMException {
  readonly partialResults: readonly PdfFinishOutput[];

  constructor(message: string, partialResults: readonly PdfFinishOutput[]) {
    super(message, "AbortError");
    this.partialResults = [...partialResults];
  }
}

interface PreparedPage {
  physicalPage: number;
  prepared: PreparedText;
}

interface PageDecorationPlan extends PreparedPage {
  page: PDFPage;
  font: PDFFont;
  runs: LayoutRun[];
  warnings: PdfFinishWarningCode[];
  textRotation: PdfPageRotation;
  viewport: PdfViewportGeometry;
}

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
  return pages.flatMap(({ physicalPage, prepared }) => prepared.errors.map((error) => {
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
  }));
}

function isProtectedLoadError(error: unknown) {
  return error instanceof Error && /encrypt|password|permission/iu.test(`${error.name} ${error.message}`);
}

async function loadDocument(file: File, signal?: AbortSignal) {
  try {
    throwIfAborted(signal);
    const bytes = await file.arrayBuffer();
    throwIfAborted(signal);
    const document = await loadPdfDocument(bytes);
    throwIfAborted(signal);
    return document;
  } catch (error) {
    throwIfAborted(signal);
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
  return { ...preparedPage, page, font, runs: layout.runs, warnings: layout.warnings, textRotation: anchor.textRotation, viewport };
}

async function analyzeDocument(
  input: PdfFinishEngineInput,
  source: PdfFinishInputFile,
  batchDate: Date,
  resources: BatchFontResources,
  fileIndex: number,
): Promise<{ document?: PDFDocument; plans: PageDecorationPlan[]; warnings: Set<PdfFinishWarningCode>; errors: PdfFinishPreflightError[] }> {
  const preparedPages = preparePages(source, input.options, input.locale, new Date(batchDate.getTime()));
  const warnings = new Set<PdfFinishWarningCode>();
  addTextWarnings(warnings, preparedPages);
  const textErrors = preparedTextErrors(source, input.options, preparedPages);
  if (textErrors.length > 0) return { plans: [], warnings, errors: textErrors };

  const document = await loadDocument(source.file, input.signal);
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

  const plans: PageDecorationPlan[] = [];
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

async function decorateDocument(input: PdfFinishEngineInput, plans: readonly PageDecorationPlan[], warnings: Set<PdfFinishWarningCode>, completed: { value: number }, total: number) {
  const color = colorComponents(input.options.color);
  for (const plan of plans) {
    throwIfAborted(input.signal);
    await yieldToEventLoop();
    throwIfAborted(input.signal);
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
  try {
    for (const [fileIndex, source] of input.files.entries()) {
      throwIfAborted(input.signal);
      await yieldToEventLoop();
      throwIfAborted(input.signal);
      report(input, "reading", fileIndex, input.files.length);
      throwIfAborted(input.signal);
      const analyzed = await analyzeDocument(input, source, batchDate, resources, fileIndex);
      if (analyzed.errors.length > 0) throw engineErrorForPreflight(analyzed.errors);
      const document = analyzed.document;
      if (!document) throw new PdfFinishEngineError("invalid-layout");
      await decorateDocument(input, analyzed.plans, analyzed.warnings, completed, total);
      throwIfAborted(input.signal);
      report(input, "saving", fileIndex, input.files.length);
      throwIfAborted(input.signal);
      const bytes = await document.save();
      throwIfAborted(input.signal);
      await yieldBeforeResultRegistration(input.signal);
      outputs.push({
        key: source.key,
        fileName: finishOutputName(source.file.name, input.locale, input.outputName),
        buffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        warnings: [...analyzed.warnings],
      });
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError" && outputs.length > 0) {
      throw new PdfFinishCanceledError(error.message, outputs);
    }
    throw error;
  }
  return outputs;
}
