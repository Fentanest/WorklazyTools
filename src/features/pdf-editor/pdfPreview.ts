import JSZip from "jszip";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import pdfDisplayUrl from "pdfjs-dist/build/pdf.mjs?url";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import type { PdfTextCell, PdfTextDocument, PdfTextLine, PdfTextPage, WorkerProgress } from "./types";
import type { AppLanguage } from "../../i18n/languages";
import { featureMessage } from "../../i18n/featureMessages";
import { throwIfAborted, yieldBeforeResultRegistration, yieldToEventLoop } from "../../utils/cooperativeCancel.ts";
import { waitForPdfRender } from "./pdfRenderLifecycle";

type PdfDisplayModule = typeof import("pdfjs-dist");

let pdfDisplayModulePromise: Promise<PdfDisplayModule> | undefined;
let passwordExceptionConstructor: PdfDisplayModule["PasswordException"] | undefined;

export class PdfDisplayLoadError extends Error {
  readonly code = "pdf-display-load";
}

export function isPdfDisplayLoadError(error: unknown): error is PdfDisplayLoadError {
  return error instanceof PdfDisplayLoadError;
}

function loadPdfDisplayModule() {
  pdfDisplayModulePromise ??= (import(/* @vite-ignore */ pdfDisplayUrl) as Promise<PdfDisplayModule>).then((module) => {
    module.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    passwordExceptionConstructor = module.PasswordException;
    return module;
  });
  return pdfDisplayModulePromise;
}

export async function openOwnedPdfDocument(
  bytes: Uint8Array | ArrayBuffer,
  language: AppLanguage = "ko",
  signal?: AbortSignal,
) {
  throwIfAborted(signal, "PDF loading cancelled");
  let pdfDisplayModule: PdfDisplayModule;
  try {
    pdfDisplayModule = await waitWithAbort(loadPdfDisplayModule(), signal);
  } catch (error) {
    if (signal?.aborted || error instanceof DOMException && error.name === "AbortError") throw error;
    throw new PdfDisplayLoadError(featureMessage(language, "pdf.messages.pdfPreview.displayFilesUnavailable"));
  }
  throwIfAborted(signal, "PDF loading cancelled");
  const source = bytes instanceof Uint8Array ? bytes.slice() : new Uint8Array(bytes.slice(0));
  const loadingTask = pdfDisplayModule.getDocument({
    data: source,
    password: "",
    enableXfa: true,
    useSystemFonts: true,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
  });
  try {
    const document = await waitWithAbort(loadingTask.promise, signal, "PDF loading cancelled");
    throwIfAborted(signal, "PDF loading cancelled");
    return { document, loadingTask };
  } catch (error) {
    try { await loadingTask.destroy(); } catch { /* A failed owned load has no reusable resources. */ }
    if (signal?.aborted || error instanceof DOMException && error.name === "AbortError") throw error;
    throw normalizePdfOpenError(error, language);
  }
}

interface CachedPdfDocument {
  loadingTask: PDFDocumentLoadingTask;
  promise: Promise<PDFDocumentProxy>;
}

export interface CachedPdfThumbnail {
  url: string;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
}

interface PdfThumbnailCacheEntry {
  promise: Promise<CachedPdfThumbnail>;
  url?: string;
  controller?: AbortController;
}

const documentCache = new Map<File, CachedPdfDocument>();
const thumbnailCache = new Map<File, Map<string, PdfThumbnailCacheEntry>>();
const thumbnailRenderQueue: Array<() => void> = [];
const THUMBNAIL_RENDER_CONCURRENCY = 3;
let activeThumbnailRenders = 0;
const TESSERACT_BASE_URL = new URL(
  "vendor/tesseract/7.0.0/",
  new URL(import.meta.env.BASE_URL, window.location.origin),
).href;

function waitWithAbort<T>(promise: Promise<T>, signal?: AbortSignal, canceledMessage = "PDF loading cancelled") {
  throwIfAborted(signal, canceledMessage);
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new DOMException(canceledMessage, "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (reason) => {
        signal.removeEventListener("abort", abort);
        reject(reason);
      },
    );
  });
}

export async function getPdfDocument(file: File, language: AppLanguage = "ko", signal?: AbortSignal) {
  throwIfAborted(signal, "PDF loading cancelled");
  const cached = documentCache.get(file);
  if (cached) return waitWithAbort(cached.promise, signal);
  let pdfDisplayModule: PdfDisplayModule;
  try {
    pdfDisplayModule = await waitWithAbort(loadPdfDisplayModule(), signal);
  } catch (error) {
    if (signal?.aborted || error instanceof DOMException && error.name === "AbortError") throw error;
    // A failed module import is cached by the browser for this document. Keep the
    // shared URL stable and ask for one explicit document reload instead of
    // misclassifying a healthy PDF or retrying an operation that cannot recover.
    throw new PdfDisplayLoadError(featureMessage(language, "pdf.messages.pdfPreview.displayFilesUnavailable"));
  }
  const { getDocument } = pdfDisplayModule;
  throwIfAborted(signal, "PDF loading cancelled");
  const buffer = await waitWithAbort(file.arrayBuffer(), signal);
  throwIfAborted(signal, "PDF loading cancelled");
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    password: "",
    enableXfa: true,
    useSystemFonts: true,
    // PDF.js의 내부 OffscreenCanvas/ImageDecoder 경로는 일부 Chromium·GPU 조합에서
    // 오류 없이 흰 캔버스를 돌려주는 경우가 있어 썸네일은 호환성 경로를 사용합니다.
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
  });
  const promise = loadingTask.promise.catch((error) => {
    documentCache.delete(file);
    throw normalizePdfOpenError(error, language);
  });
  documentCache.set(file, { loadingTask, promise });
  return waitWithAbort(promise, signal);
}

export async function inspectPdf(file: File, language: AppLanguage = "ko", options: { requirePdfLibCompatibility?: boolean; signal?: AbortSignal } = {}) {
  const document = await getPdfDocument(file, language, options.signal);
  const permissions = await waitWithAbort(document.getPermissions(), options.signal, "PDF inspection cancelled");
  throwIfAborted(options.signal, "PDF inspection cancelled");
  if (permissions !== null && options.requirePdfLibCompatibility) {
    await releasePdf(file);
    throw new Error(featureMessage(language, "pdf.messages.pdfPreview.encryptedOrPermissionRestrictedPdfsCannotBeEdited"));
  }
  return { pageCount: document.numPages, permissionRestricted: permissions !== null };
}

export async function releasePdf(file: File) {
  const cached = documentCache.get(file);
  const cachedThumbnails = thumbnailCache.get(file);
  documentCache.delete(file);
  thumbnailCache.delete(file);
  cachedThumbnails?.forEach((entry) => {
    entry.controller?.abort();
    if (entry.url) URL.revokeObjectURL(entry.url);
  });
  if (cached) {
    try { await cached.loadingTask.destroy(); } catch { /* 이미 종료된 문서는 무시합니다. */ }
  }
}

export function getCachedPdfThumbnail(file: File, pageIndex: number, targetWidth = 172, language: AppLanguage = "ko") {
  const outputScale = Math.min(window.devicePixelRatio || 1, 2);
  const cacheKey = `${pageIndex}:${targetWidth}:${outputScale}`;
  let fileCache = thumbnailCache.get(file);
  if (!fileCache) {
    fileCache = new Map();
    thumbnailCache.set(file, fileCache);
  }
  const cached = fileCache.get(cacheKey);
  if (cached) return cached.promise;

  const controller = new AbortController();
  const entry = { controller } as PdfThumbnailCacheEntry;
  fileCache.set(cacheKey, entry);
  entry.promise = queueThumbnailRender(async () => {
    if (thumbnailCache.get(file)?.get(cacheKey) !== entry) throw new DOMException("Thumbnail no longer needed", "AbortError");
    const canvas = document.createElement("canvas");
    try {
      const dimensions = await renderPdfThumbnail(file, pageIndex, canvas, targetWidth, language, controller.signal);
      const blob = await canvasToBlob(canvas, "image/webp", 0.86, language);
      const url = URL.createObjectURL(blob);
      if (thumbnailCache.get(file)?.get(cacheKey) !== entry) {
        URL.revokeObjectURL(url);
        throw new DOMException("Thumbnail no longer needed", "AbortError");
      }
      entry.url = url;
      return { url, ...dimensions };
    } finally {
      canvas.width = 1;
      canvas.height = 1;
    }
  }).catch((error) => {
    if (thumbnailCache.get(file)?.get(cacheKey) === entry) fileCache?.delete(cacheKey);
    throw error;
  });
  return entry.promise;
}

function queueThumbnailRender<T>(task: () => Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      activeThumbnailRenders += 1;
      void task().then(resolve, reject).finally(() => {
        activeThumbnailRenders -= 1;
        thumbnailRenderQueue.shift()?.();
      });
    };
    if (activeThumbnailRenders < THUMBNAIL_RENDER_CONCURRENCY) run();
    else thumbnailRenderQueue.push(run);
  });
}

async function renderPdfThumbnailOffMainThread(file: File, pageIndex: number, canvas: HTMLCanvasElement, targetWidth: number, signal?: AbortSignal) {
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined" || typeof ImageBitmap === "undefined") return undefined;
  throwIfAborted(signal, "Thumbnail rendering cancelled");
  const worker = new Worker(new URL("./pdfThumbnailRender.worker.ts", import.meta.url), { type: "module" });
  return new Promise<{ width: number; height: number; sourceWidth: number; sourceHeight: number }>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abort);
      worker.terminate();
      callback();
    };
    const abort = () => finish(() => reject(new DOMException("Thumbnail rendering cancelled", "AbortError")));
    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = (event: MessageEvent<{ type: "result"; bitmap: ImageBitmap; dimensions: { width: number; height: number; sourceWidth: number; sourceHeight: number } } | { type: "error"; message: string }>) => {
      const data = event.data;
      if (!data || !["result", "error"].includes(data.type)) return;
      if (data.type === "error") {
        finish(() => reject(new Error(data.message)));
        return;
      }
      const { bitmap, dimensions } = data;
      finish(() => {
        if (signal?.aborted) {
          bitmap.close();
          reject(new DOMException("Thumbnail rendering cancelled", "AbortError"));
          return;
        }
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.style.width = `${Math.floor(dimensions.width)}px`;
        canvas.style.height = `${Math.floor(dimensions.height)}px`;
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) {
          bitmap.close();
          reject(new Error("Preview canvas unavailable"));
          return;
        }
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0);
        bitmap.close();
        resolve(dimensions);
      });
    };
    worker.onerror = (event) => finish(() => reject(new Error(event.message || "Preview worker failed")));
    worker.postMessage({ file, pageIndex, targetWidth, outputScale: Math.min(window.devicePixelRatio || 1, 2) });
  });
}

export async function renderPdfThumbnail(file: File, pageIndex: number, canvas: HTMLCanvasElement, targetWidth = 172, language: AppLanguage = "ko", signal?: AbortSignal) {
  throwIfAborted(signal, "Thumbnail rendering cancelled");
  try {
    const workerResult = await renderPdfThumbnailOffMainThread(file, pageIndex, canvas, targetWidth, signal);
    if (workerResult) return workerResult;
  } catch (error) {
    if (signal?.aborted || error instanceof DOMException && error.name === "AbortError") throw error;
    // Browsers without a usable worker canvas retain the established compatibility renderer below.
  }
  const pdfDocument = await getPdfDocument(file, language, signal);
  throwIfAborted(signal, "Thumbnail rendering cancelled");
  const page = await waitWithAbort(pdfDocument.getPage(pageIndex + 1), signal, "Thumbnail rendering cancelled");
  throwIfAborted(signal, "Thumbnail rendering cancelled");
  const natural = page.getViewport({ scale: 1 });
  const cssScale = targetWidth / natural.width;
  const viewport = page.getViewport({ scale: cssScale });
  const outputScale = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(viewport.width * outputScale));
  const height = Math.max(1, Math.floor(viewport.height * outputScale));
  const renderCanvas = document.createElement("canvas");
  renderCanvas.width = width;
  renderCanvas.height = height;
  const renderContext = renderCanvas.getContext("2d", { alpha: false });
  if (!renderContext) throw new Error(featureMessage(language, "pdf.messages.pdfPreview.unableToRenderThePdfPreview"));
  const renderTask = page.render({
    canvas: renderCanvas,
    canvasContext: renderContext,
    viewport,
    transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
    background: "#ffffff",
  });
  try { await waitForPdfRender(renderTask, page, { signal, canceledMessage: "Thumbnail rendering cancelled" }); }
  catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === "RenderingCancelledException")) throw new DOMException("Thumbnail rendering cancelled", "AbortError");
    throw error;
  }
  if (signal?.aborted) throw new DOMException("Thumbnail rendering cancelled", "AbortError");
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error(featureMessage(language, "pdf.messages.pdfPreview.unableToDisplayThePdfPreview"));
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(renderCanvas, 0, 0);
  renderCanvas.width = 1;
  renderCanvas.height = 1;
  return { width: viewport.width, height: viewport.height, sourceWidth: natural.width, sourceHeight: natural.height };
}

export function parsePageRange(value: string, pageCount: number, language: AppLanguage = "ko") {
  if (!value.trim()) throw new Error(featureMessage(language, "pdf.messages.pdfPreview.enterAPageRange"));
  const result: number[] = [];
  const seen = new Set<number>();
  for (const rawPart of value.split(",")) {
    const part = rawPart.trim();
    if (!part) continue;
    const rangeMatch = part.match(/^(\d*)\s*-\s*(\d*)$/);
    const singleMatch = part.match(/^\d+$/);
    let numbers: number[];
    if (rangeMatch) {
      if (!rangeMatch[1] && !rangeMatch[2]) throw new Error(featureMessage(language, "pdf.messages.pdfPreview.checkTheFormatOfPageRange", { p0: part }));
      const start = rangeMatch[1] ? Number(rangeMatch[1]) : 1;
      const end = rangeMatch[2] ? Number(rangeMatch[2]) : pageCount;
      const direction = start <= end ? 1 : -1;
      numbers = Array.from({ length: Math.abs(end - start) + 1 }, (_, index) => start + index * direction);
    } else if (singleMatch) numbers = [Number(part)];
    else throw new Error(featureMessage(language, "pdf.messages.pdfPreview.checkTheFormatOfPageRange", { p0: part }));
    for (const pageNumber of numbers) {
      if (pageNumber < 1 || pageNumber > pageCount) throw new Error(featureMessage(language, "pdf.messages.pdfPreview.pageNumbersMustBeBetween1And", { p0: pageCount }));
      if (!seen.has(pageNumber)) {
        seen.add(pageNumber);
        result.push(pageNumber - 1);
      }
    }
  }
  if (!result.length) throw new Error(featureMessage(language, "pdf.messages.pdfPreview.noPagesWereSelected"));
  return result;
}

export async function pdfToImageArchive(
  file: File,
  format: "png" | "jpeg",
  dpi: 96 | 144 | 216,
  quality: number,
  onProgress?: WorkerProgress,
  language: AppLanguage = "ko",
  selectedPageIndexes?: number[],
  signal?: AbortSignal,
) {
  throwIfAborted(signal);
  const document = await getPdfDocument(file, language);
  throwIfAborted(signal);
  const zip = new JSZip();
  const scale = dpi / 72;
  const baseName = stripExtension(file.name);
  const pageNumbers = selectedPageIndexes?.length ? selectedPageIndexes.map((index) => index + 1) : Array.from({ length: document.numPages }, (_, index) => index + 1);
  for (let index = 0; index < pageNumbers.length; index += 1) {
    throwIfAborted(signal);
    const pageNumber = pageNumbers[index];
    onProgress?.(5 + (index / pageNumbers.length) * 78, featureMessage(language, "pdf.messages.pdfPreview.renderingPageAs", { p0: index + 1, p1: pageNumbers.length, p2: pageNumber, p3: format.toUpperCase() }));
    const canvas = await renderPageForExport(document, pageNumber, scale, language, signal);
    const blob = await canvasToBlob(canvas, format === "png" ? "image/png" : "image/jpeg", quality, language);
    throwIfAborted(signal);
    zip.file(`${baseName}-${String(pageNumber).padStart(3, "0")}.${format === "jpeg" ? "jpg" : "png"}`, blob);
    canvas.width = 1;
    canvas.height = 1;
    await yieldToEventLoop();
    throwIfAborted(signal);
  }
  throwIfAborted(signal);
  onProgress?.(88, featureMessage(language, "pdf.messages.pdfPreview.compressingConvertedImagesIntoAZipFile"));
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } }, (metadata) => {
    onProgress?.(88 + metadata.percent * 0.1, featureMessage(language, "pdf.messages.pdfPreview.compressingZip", { p0: Math.round(metadata.percent) }));
  });
  if (signal) await yieldBeforeResultRegistration(signal);
  return { blob, fileName: `${baseName}-${format === "jpeg" ? "jpg" : "png"}.zip` };
}

export async function renderPdfPageAsJpeg(file: File, pageIndex: number, additionalRotation: number, language: AppLanguage = "ko", signal?: AbortSignal) {
  throwIfAborted(signal);
  const pdfDocument = await getPdfDocument(file, language);
  throwIfAborted(signal);
  const page = await pdfDocument.getPage(pageIndex + 1);
  throwIfAborted(signal);
  const viewport = page.getViewport({ scale: 1.5, rotation: (page.rotate + additionalRotation) % 360 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error(featureMessage(language, "pdf.messages.pdfPreview.unableToCreateTheCompressedPdfPageImage"));
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const renderTask = page.render({ canvas, canvasContext: context, viewport });
  await waitForPdfRender(renderTask, page, { signal });
  const blob = await canvasToBlob(canvas, "image/jpeg", 0.78, language);
  throwIfAborted(signal);
  canvas.width = 1; canvas.height = 1;
  return new File([blob], `page-${String(pageIndex + 1).padStart(4, "0")}.jpg`, { type: "image/jpeg" });
}

export type PdfOcrMode = "off" | "auto" | "all";

export interface ExtractPdfTextResult {
  document: PdfTextDocument;
  ocrPdfBuffers: ArrayBuffer[];
  ocrPageCount: number;
}

export async function extractPdfText(
  file: File,
  ocrMode: PdfOcrMode,
  searchablePdf: boolean,
  onProgress?: WorkerProgress,
  selectedPageIndexes?: number[],
  language: AppLanguage = "ko",
): Promise<ExtractPdfTextResult> {
  const document = await getPdfDocument(file, language);
  const pages: PdfTextPage[] = [];
  const sourcePageIndexes = selectedPageIndexes?.length
    ? [...new Set(selectedPageIndexes)].filter((index) => index >= 0 && index < document.numPages)
    : Array.from({ length: document.numPages }, (_, index) => index);
  if (!sourcePageIndexes.length) throw new Error(featureMessage(language, "pdf.messages.pdfPreview.thereAreNoPdfPagesToProcess"));
  onProgress?.(2, featureMessage(language, "pdf.messages.pdfPreview.readingEmbeddedPdfTextAndCoordinates"));
  for (let index = 0; index < sourcePageIndexes.length; index += 1) {
    const pageNumber = sourcePageIndexes[index] + 1;
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(layoutPdfItems(pageNumber, (content.items as unknown[]).filter(isTextItem)));
    onProgress?.(2 + ((index + 1) / sourcePageIndexes.length) * 16, featureMessage(language, "pdf.messages.pdfPreview.embeddedTextAnalyzedForPage", { p0: index + 1, p1: sourcePageIndexes.length, p2: pageNumber }));
  }

  const ocrTargets = searchablePdf || ocrMode === "all"
    ? pages.map((_, index) => index)
    : ocrMode === "auto"
      ? pages.flatMap((page, index) => page.lines.reduce((sum, line) => sum + line.text.length, 0) < 8 ? [index] : [])
      : [];
  const ocrPdfBuffers: ArrayBuffer[] = [];

  if (ocrTargets.length) {
    const { createWorker } = await import("tesseract.js");
    let activePage = 0;
    onProgress?.(19, featureMessage(language, "pdf.messages.pdfPreview.preparingTheBundledKoreanAndEnglishOcrModels"));
    const ocrWorker = await createWorker(["kor", "eng"], undefined, {
      workerPath: `${TESSERACT_BASE_URL}worker.min.js`,
      corePath: `${TESSERACT_BASE_URL}core/`,
      langPath: `${TESSERACT_BASE_URL}lang/`,
      logger: (message) => {
        if (message.status === "recognizing text") {
          const value = 22 + ((activePage + message.progress) / ocrTargets.length) * 68;
          onProgress?.(value, featureMessage(language, "pdf.messages.pdfPreview.recognizingText", { p0: activePage + 1, p1: ocrTargets.length, p2: Math.round(message.progress * 100) }));
        } else {
          onProgress?.(19 + message.progress * 3, translateOcrStatus(message.status, language));
        }
      },
    });
    try {
      for (activePage = 0; activePage < ocrTargets.length; activePage += 1) {
        const pageIndex = ocrTargets[activePage];
        const sourcePageNumber = sourcePageIndexes[pageIndex] + 1;
        onProgress?.(22 + (activePage / ocrTargets.length) * 68, featureMessage(language, "pdf.messages.pdfPreview.renderingPageForOcr", { p0: activePage + 1, p1: ocrTargets.length, p2: sourcePageNumber }));
        const canvas = await renderPageForOcr(document, sourcePageNumber, language);
        const recognized = await ocrWorker.recognize(
          canvas,
          searchablePdf ? { pdfTitle: file.name, pdfTextOnly: false } : {},
          { text: true, blocks: true, pdf: searchablePdf },
        );
        pages[pageIndex] = layoutOcrPage(sourcePageNumber, recognized.data);
        if (searchablePdf && recognized.data.pdf) {
          const bytes = Uint8Array.from(recognized.data.pdf);
          ocrPdfBuffers.push(bytes.buffer);
        }
        canvas.width = 1;
        canvas.height = 1;
        await yieldToBrowser();
      }
    } finally {
      await ocrWorker.terminate();
    }
  }

  const characterCount = pages.reduce((total, page) => total + page.lines.reduce((sum, line) => sum + line.text.length, 0), 0);
  return {
    document: { sourceName: file.name, pages, characterCount },
    ocrPdfBuffers,
    ocrPageCount: ocrTargets.length,
  };
}

async function renderPageForOcr(document: PDFDocumentProxy, pageNumber: number, language: AppLanguage) {
  const page = await document.getPage(pageNumber);
  const natural = page.getViewport({ scale: 1 });
  const mobileDevice = window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 760;
  const requestedScale = mobileDevice ? 1.8 : 2.4;
  const pixelLimit = mobileDevice ? 8_000_000 : 12_000_000;
  const limitedScale = Math.min(requestedScale, Math.sqrt(pixelLimit / (natural.width * natural.height)));
  return renderPageForExport(document, pageNumber, limitedScale, language);
}

async function renderPageForExport(document: PDFDocumentProxy, pageNumber: number, scale: number, language: AppLanguage, signal?: AbortSignal) {
  throwIfAborted(signal);
  const page = await document.getPage(pageNumber);
  throwIfAborted(signal);
  const viewport = page.getViewport({ scale });
  const canvas = documentCanvas(viewport.width, viewport.height);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error(featureMessage(language, "pdf.messages.pdfPreview.unableToRenderThePdfPageImage"));
  const renderTask = page.render({ canvas, canvasContext: context, viewport, background: "#ffffff" });
  await waitForPdfRender(renderTask, page, { signal });
  return canvas;
}

interface PdfJsTextItem {
  str: string;
  transform: unknown[];
  width: number;
  height: number;
}

function layoutPdfItems(pageNumber: number, items: PdfJsTextItem[]): PdfTextPage {
  const sorted = items
    .filter((item) => item.str.trim())
    .map((item) => ({ text: item.str, x: item.transform[4] as number, y: item.transform[5] as number, width: item.width, height: Math.max(item.height, 8) }))
    .sort((left, right) => Math.abs(right.y - left.y) > Math.max(left.height, right.height) * 0.42 ? right.y - left.y : left.x - right.x);
  const groups: typeof sorted[] = [];
  for (const item of sorted) {
    const group = groups.find((candidate) => Math.abs(candidate[0].y - item.y) <= Math.max(candidate[0].height, item.height) * 0.45);
    if (group) group.push(item);
    else groups.push([item]);
  }
  groups.sort((left, right) => right[0].y - left[0].y);
  const lines = groups.map((group) => buildLine(group.sort((left, right) => left.x - right.x)));
  return { pageNumber, lines };
}

function buildLine(items: Array<{ text: string; x: number; width: number; height: number }>): PdfTextLine {
  const cells: PdfTextCell[] = [];
  let text = "";
  let currentCell = "";
  let previousEnd: number | undefined;
  let previousHeight = 10;
  let cellX = items[0]?.x ?? 0;
  for (const item of items) {
    const gap = previousEnd === undefined ? 0 : item.x - previousEnd;
    const wordGap = gap > Math.max(1.5, previousHeight * 0.18);
    const cellGap = gap > Math.max(18, previousHeight * 1.8);
    if (cellGap && currentCell.trim()) {
      cells.push({ text: currentCell.trim(), x: cellX });
      currentCell = "";
      cellX = item.x;
    }
    if (wordGap && text && !text.endsWith(" ")) text += " ";
    if (wordGap && currentCell && !currentCell.endsWith(" ")) currentCell += " ";
    text += item.text;
    currentCell += item.text;
    previousEnd = item.x + item.width;
    previousHeight = item.height;
  }
  if (currentCell.trim()) cells.push({ text: currentCell.trim(), x: cellX });
  return { text: text.trim(), cells };
}

function layoutOcrPage(pageNumber: number, data: {
  text: string;
  blocks: Array<{ paragraphs: Array<{ lines: Array<{ text: string; words: Array<{ text: string; bbox: { x0: number; x1: number } }> }> }> }> | null;
}) {
  const ocrLines = data.blocks?.flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines)) ?? [];
  const lines = ocrLines.length
    ? ocrLines.map((line) => buildLine(line.words.map((word) => ({ text: word.text, x: word.bbox.x0, width: word.bbox.x1 - word.bbox.x0, height: 12 }))))
    : data.text.split(/\r?\n/).map((text) => text.trim()).filter(Boolean).map((text) => ({ text, cells: [{ text, x: 0 }] }));
  return { pageNumber, lines };
}

function isTextItem(item: unknown): item is PdfJsTextItem {
  return typeof item === "object" && item !== null && "str" in item && typeof (item as { str: unknown }).str === "string";
}

function documentCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number | undefined, language: AppLanguage) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error(featureMessage(language, "pdf.messages.pdfPreview.unableToCreateTheImageFile"))), type, quality));
}

function yieldToBrowser() {
  return yieldToEventLoop();
}

function stripExtension(name: string) {
  return name.replace(/\.[^.]+$/, "") || "pdf";
}

function translateOcrStatus(status: string, language: AppLanguage) {
  const labels: Record<string, string> = {
    "loading tesseract core": "pdf.ocrStatus.loadingCore",
    "initializing tesseract": "pdf.ocrStatus.initializing",
    "loading language traineddata": "pdf.ocrStatus.loadingLanguage",
    "initializing api": "pdf.ocrStatus.initializingApi",
  };
  const label = labels[status];
  return label ? featureMessage(language, label) : featureMessage(language, "pdf.messages.pdfPreview.preparingOcr", { p0: status });
}

function normalizePdfOpenError(error: unknown, language: AppLanguage) {
  if ((passwordExceptionConstructor && error instanceof passwordExceptionConstructor)
      || (error instanceof Error && error.name === "PasswordException")) {
    return new Error(featureMessage(language, "pdf.messages.pdfPreview.thisPdfIsPasswordProtectedTryAgainWith"));
  }
  if (error instanceof Error && /password|encrypted/i.test(error.message)) {
    return new Error(featureMessage(language, "pdf.messages.pdfPreview.thisPdfIsPasswordProtectedTryAgainWith"));
  }
  return error instanceof Error ? error : new Error(featureMessage(language, "pdf.messages.pdfPreview.unableToOpenThePdfFile"));
}
