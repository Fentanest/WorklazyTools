import { Encodings } from "@pdf-lib/standard-fonts";
import { PDFName, PDFNumber, type PDFPage } from "pdf-lib";

import { QR_LABEL_FONT_PATH } from "../../qr-studio/qrBulk.ts";
import { throwIfAborted, yieldBeforeResultRegistration, yieldToEventLoop } from "../../../utils/cooperativeCancel.ts";
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

export type PdfFinishEngineErrorCode =
  | "protected-document"
  | "unreadable-document"
  | "invalid-field"
  | "invalid-text"
  | "missing-glyph"
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
}

interface PreparedPage {
  physicalPage: number;
  prepared: PreparedText;
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
  const rotation = normalizeRotation(page.getRotation().angle);
  const unit = pageUserUnit(page);
  const xMin = crop.x;
  const yMin = crop.y;
  const xMax = crop.x + crop.width;
  const yMax = crop.y + crop.height;
  if (rotation === 90) return { width: crop.height * unit, height: crop.width * unit, rotation, transform: [0, unit, unit, 0, -yMin * unit, -xMin * unit] };
  if (rotation === 180) return { width: crop.width * unit, height: crop.height * unit, rotation, transform: [-unit, 0, 0, unit, xMax * unit, -yMin * unit] };
  if (rotation === 270) return { width: crop.height * unit, height: crop.width * unit, rotation, transform: [0, -unit, -unit, 0, yMax * unit, xMax * unit] };
  return { width: crop.width * unit, height: crop.height * unit, rotation, transform: [unit, 0, 0, -unit, -xMin * unit, yMax * unit] };
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

function isProtectedLoadError(error: unknown) {
  return error instanceof Error && /encrypt|password|permission/iu.test(`${error.name} ${error.message}`);
}

async function loadDocument(file: File, signal?: AbortSignal) {
  try {
    const bytes = await file.arrayBuffer();
    throwIfAborted(signal);
    return await loadPdfDocument(bytes);
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

function addWarnings(target: Set<PdfFinishWarningCode>, preparedPages: readonly PreparedPage[]) {
  if (preparedPages.some(({ prepared }) => prepared.warnings.length > 0)) target.add("unknown-token");
}

async function decorateDocument(input: PdfFinishEngineInput, document: PDFDocument, source: PdfFinishInputFile, preparedPages: readonly PreparedPage[], font: PDFFont, warnings: Set<PdfFinishWarningCode>, completed: { value: number }, total: number) {
  const color = colorComponents(input.options.color);
  const pdfPages = document.getPages();
  for (const { physicalPage, prepared } of preparedPages) {
    throwIfAborted(input.signal);
    await yieldToEventLoop();
    throwIfAborted(input.signal);
    const page = pdfPages[physicalPage - 1];
    if (!page) throw new PdfFinishEngineError("invalid-field", { field: "selection" });
    const viewport = pdfPageViewport(page);
    const margins = { top: input.options.margin, right: input.options.margin, bottom: input.options.margin, left: input.options.margin };
    let regions;
    let anchor;
    try {
      regions = createSixTextRegions(viewport.width, viewport.height, margins);
      anchor = createFinishAnchors(viewport, margins).find(({ region }) => region === input.options.region);
    } catch (error) {
      throw new PdfFinishEngineError("invalid-layout", {}, error);
    }
    const region = regions.find((candidate) => candidate.region === input.options.region);
    if (!region || !anchor) throw new PdfFinishEngineError("invalid-layout");
    const layout = layoutTextLines({ lines: prepared.lines, size: input.options.fontSize, region: region.box, alignment: region.alignment, vertical: region.vertical, font });
    if (!layout.ok) throw new PdfFinishEngineError("invalid-layout", { reason: layout.error });
    for (const warning of layout.warnings) warnings.add(warning);
    const unit = pageUserUnit(page);
    for (const run of layout.runs) {
      const point = viewportPointToPdf(viewport.transform, run.x, viewport.height - run.y);
      page.drawText(run.text, {
        x: point.x,
        y: point.y,
        size: input.options.fontSize / unit,
        font,
        color: rgb(...color),
        rotate: degrees(anchor.textRotation),
        opacity: input.options.opacity ?? 0.9,
      });
    }
    completed.value += 1;
    report(input, "decorating", completed.value, total);
  }
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
  let fontAssetPromise: Promise<ArrayBuffer> | undefined;
  let characterSet: number[] | undefined;
  const getFontAsset = async () => {
    fontAssetPromise ??= (input.loadFontAsset ?? defaultLoadFontAsset)(input.signal);
    return fontAssetPromise;
  };
  const outputs: PdfFinishOutput[] = [];
  for (const [fileIndex, source] of input.files.entries()) {
    throwIfAborted(input.signal);
    await yieldToEventLoop();
    report(input, "reading", fileIndex, input.files.length);
    const preparedPages = preparePages(source, input.options, input.locale, new Date(batchDate.getTime()));
    if (preparedPages.some(({ prepared }) => prepared.errors.length > 0)) throw new PdfFinishEngineError("invalid-text");
    const document = await loadDocument(source.file, input.signal);
    const needsNoto = fontNeedsNoto(preparedPages);
    if (needsNoto) {
      report(input, "font", fileIndex, input.files.length);
      const bytes = await getFontAsset();
      characterSet ??= getPdfFontCharacterSet(bytes);
    }
    const decision = prepareFontDecision(preparedPages, characterSet ?? []);
    if (decision.blocked) throw new PdfFinishEngineError("missing-glyph", { missing: decision.missing });
    throwIfAborted(input.signal);
    const font = decision.font === "noto"
      ? await embedCustomPdfFont(document, await getFontAsset())
      : await embedHelvetica(document);
    const warnings = new Set<PdfFinishWarningCode>();
    addWarnings(warnings, preparedPages);
    if (decision.font === "noto") warnings.add("embedded-font");
    await decorateDocument(input, document, source, preparedPages, font, warnings, completed, total);
    throwIfAborted(input.signal);
    report(input, "saving", fileIndex, input.files.length);
    const bytes = await document.save();
    await yieldBeforeResultRegistration(input.signal);
    outputs.push({
      key: source.key,
      fileName: `${filenameBaseName(source.file.name)}-finished.pdf`,
      buffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      warnings: [...warnings],
    });
  }
  return outputs;
}
