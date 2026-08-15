import JSZip from "jszip";
import {
  getDocument,
  GlobalWorkerOptions,
  PasswordException,
  type PDFDocumentProxy,
} from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import type { PdfTextCell, PdfTextDocument, PdfTextLine, PdfTextPage, WorkerProgress } from "./types";
import type { AppLanguage } from "../../i18n/languages";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface CachedPdfDocument {
  loadingTask: ReturnType<typeof getDocument>;
  promise: Promise<PDFDocumentProxy>;
}

const documentCache = new Map<File, CachedPdfDocument>();
const TESSERACT_BASE_URL = new URL(
  "vendor/tesseract/7.0.0/",
  new URL(import.meta.env.BASE_URL, window.location.origin),
).href;

const local = (language: AppLanguage, ko: string, en: string) => language === "ko" ? ko : en;

export async function getPdfDocument(file: File, language: AppLanguage = "ko") {
  const cached = documentCache.get(file);
  if (cached) return cached.promise;
  const buffer = await file.arrayBuffer();
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
  return promise;
}

export async function inspectPdf(file: File, language: AppLanguage = "ko") {
  const document = await getPdfDocument(file, language);
  const permissions = await document.getPermissions();
  if (permissions !== null) {
    await releasePdf(file);
    throw new Error(local(language, "암호화되거나 권한이 제한된 PDF는 편집할 수 없습니다. 보호가 해제된 사본으로 다시 시도해 주세요.", "Encrypted or permission-restricted PDFs cannot be edited. Try again with an unlocked copy."));
  }
  return { pageCount: document.numPages };
}

export async function releasePdf(file: File) {
  const cached = documentCache.get(file);
  documentCache.delete(file);
  if (cached) {
    try { await cached.loadingTask.destroy(); } catch { /* 이미 종료된 문서는 무시합니다. */ }
  }
}

export async function renderPdfThumbnail(file: File, pageIndex: number, canvas: HTMLCanvasElement, targetWidth = 172, language: AppLanguage = "ko", signal?: AbortSignal) {
  const pdfDocument = await getPdfDocument(file, language);
  const page = await pdfDocument.getPage(pageIndex + 1);
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
  if (!renderContext) throw new Error(local(language, "PDF 미리보기를 표시할 수 없습니다.", "Unable to render the PDF preview."));
  const renderTask = page.render({
    canvas: renderCanvas,
    canvasContext: renderContext,
    viewport,
    transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
    background: "#ffffff",
  });
  const abort = () => renderTask.cancel();
  signal?.addEventListener("abort", abort, { once: true });
  try { await renderTask.promise; }
  catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === "RenderingCancelledException")) throw new DOMException("Thumbnail rendering cancelled", "AbortError");
    throw error;
  } finally { signal?.removeEventListener("abort", abort); }
  if (signal?.aborted) throw new DOMException("Thumbnail rendering cancelled", "AbortError");
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error(local(language, "PDF 미리보기를 화면에 복사할 수 없습니다.", "Unable to display the PDF preview."));
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(renderCanvas, 0, 0);
  renderCanvas.width = 1;
  renderCanvas.height = 1;
  return { width: viewport.width, height: viewport.height };
}

export function parsePageRange(value: string, pageCount: number, language: AppLanguage = "ko") {
  if (!value.trim()) throw new Error(local(language, "페이지 범위를 입력해 주세요.", "Enter a page range."));
  const result: number[] = [];
  const seen = new Set<number>();
  for (const rawPart of value.split(",")) {
    const part = rawPart.trim();
    if (!part) continue;
    const rangeMatch = part.match(/^(\d*)\s*-\s*(\d*)$/);
    const singleMatch = part.match(/^\d+$/);
    let numbers: number[];
    if (rangeMatch) {
      if (!rangeMatch[1] && !rangeMatch[2]) throw new Error(local(language, `페이지 범위 '${part}'의 형식을 확인해 주세요.`, `Check the format of page range '${part}'.`));
      const start = rangeMatch[1] ? Number(rangeMatch[1]) : 1;
      const end = rangeMatch[2] ? Number(rangeMatch[2]) : pageCount;
      const direction = start <= end ? 1 : -1;
      numbers = Array.from({ length: Math.abs(end - start) + 1 }, (_, index) => start + index * direction);
    } else if (singleMatch) numbers = [Number(part)];
    else throw new Error(local(language, `페이지 범위 '${part}'의 형식을 확인해 주세요.`, `Check the format of page range '${part}'.`));
    for (const pageNumber of numbers) {
      if (pageNumber < 1 || pageNumber > pageCount) throw new Error(local(language, `페이지 번호는 1~${pageCount} 사이여야 합니다.`, `Page numbers must be between 1 and ${pageCount}.`));
      if (!seen.has(pageNumber)) {
        seen.add(pageNumber);
        result.push(pageNumber - 1);
      }
    }
  }
  if (!result.length) throw new Error(local(language, "추출할 페이지가 없습니다.", "No pages were selected."));
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
) {
  const document = await getPdfDocument(file, language);
  const zip = new JSZip();
  const scale = dpi / 72;
  const baseName = stripExtension(file.name);
  const pageNumbers = selectedPageIndexes?.length ? selectedPageIndexes.map((index) => index + 1) : Array.from({ length: document.numPages }, (_, index) => index + 1);
  for (let index = 0; index < pageNumbers.length; index += 1) {
    const pageNumber = pageNumbers[index];
    onProgress?.(5 + (index / pageNumbers.length) * 78, local(language, `[${index + 1}/${pageNumbers.length}] ${pageNumber}페이지를 ${format.toUpperCase()}로 렌더링하는 중…`, `[${index + 1}/${pageNumbers.length}] Rendering page ${pageNumber} as ${format.toUpperCase()}…`));
    const canvas = await renderPageForExport(document, pageNumber, scale, language);
    const blob = await canvasToBlob(canvas, format === "png" ? "image/png" : "image/jpeg", quality, language);
    zip.file(`${baseName}-${String(pageNumber).padStart(3, "0")}.${format === "jpeg" ? "jpg" : "png"}`, blob);
    canvas.width = 1;
    canvas.height = 1;
    await yieldToBrowser();
  }
  onProgress?.(88, local(language, "변환된 이미지를 ZIP 파일로 압축하는 중…", "Compressing converted images into a ZIP file…"));
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } }, (metadata) => {
    onProgress?.(88 + metadata.percent * 0.1, local(language, `ZIP 압축 중… ${Math.round(metadata.percent)}%`, `Compressing ZIP… ${Math.round(metadata.percent)}%`));
  });
  return { blob, fileName: `${baseName}-${format === "jpeg" ? "jpg" : "png"}.zip` };
}

export async function renderPdfPageAsJpeg(file: File, pageIndex: number, additionalRotation: number, language: AppLanguage = "ko") {
  const pdfDocument = await getPdfDocument(file, language);
  const page = await pdfDocument.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: 1.5, rotation: (page.rotate + additionalRotation) % 360 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error(local(language, "PDF 페이지 압축 화면을 만들 수 없습니다.", "Unable to create the compressed PDF page image."));
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  const blob = await canvasToBlob(canvas, "image/jpeg", 0.78, language);
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
  if (!sourcePageIndexes.length) throw new Error(local(language, "처리할 PDF 페이지가 없습니다.", "There are no PDF pages to process."));
  onProgress?.(2, local(language, "PDF의 내장 텍스트와 좌표를 확인하는 중…", "Reading embedded PDF text and coordinates…"));
  for (let index = 0; index < sourcePageIndexes.length; index += 1) {
    const pageNumber = sourcePageIndexes[index] + 1;
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(layoutPdfItems(pageNumber, (content.items as unknown[]).filter(isTextItem)));
    onProgress?.(2 + ((index + 1) / sourcePageIndexes.length) * 16, local(language, `[${index + 1}/${sourcePageIndexes.length}] ${pageNumber}페이지 내장 텍스트 분석 완료`, `[${index + 1}/${sourcePageIndexes.length}] Embedded text analyzed for page ${pageNumber}`));
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
    onProgress?.(19, local(language, "사이트에 포함된 한국어·영어 OCR 모델을 준비하는 중…", "Preparing the bundled Korean and English OCR models…"));
    const ocrWorker = await createWorker(["kor", "eng"], undefined, {
      workerPath: `${TESSERACT_BASE_URL}worker.min.js`,
      corePath: `${TESSERACT_BASE_URL}core/`,
      langPath: `${TESSERACT_BASE_URL}lang/`,
      logger: (message) => {
        if (message.status === "recognizing text") {
          const value = 22 + ((activePage + message.progress) / ocrTargets.length) * 68;
          onProgress?.(value, local(language, `[${activePage + 1}/${ocrTargets.length}] OCR 인식 중… ${Math.round(message.progress * 100)}%`, `[${activePage + 1}/${ocrTargets.length}] Recognizing text… ${Math.round(message.progress * 100)}%`));
        } else {
          onProgress?.(19 + message.progress * 3, translateOcrStatus(message.status, language));
        }
      },
    });
    try {
      for (activePage = 0; activePage < ocrTargets.length; activePage += 1) {
        const pageIndex = ocrTargets[activePage];
        const sourcePageNumber = sourcePageIndexes[pageIndex] + 1;
        onProgress?.(22 + (activePage / ocrTargets.length) * 68, local(language, `[${activePage + 1}/${ocrTargets.length}] ${sourcePageNumber}페이지 OCR용 이미지 생성 중…`, `[${activePage + 1}/${ocrTargets.length}] Rendering page ${sourcePageNumber} for OCR…`));
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

async function renderPageForExport(document: PDFDocumentProxy, pageNumber: number, scale: number, language: AppLanguage) {
  const page = await document.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = documentCanvas(viewport.width, viewport.height);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error(local(language, "PDF 페이지 이미지를 만들 수 없습니다.", "Unable to render the PDF page image."));
  await page.render({ canvas, canvasContext: context, viewport, background: "#ffffff" }).promise;
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
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error(local(language, "이미지 파일을 만들지 못했습니다.", "Unable to create the image file."))), type, quality));
}

function yieldToBrowser() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}

function stripExtension(name: string) {
  return name.replace(/\.[^.]+$/, "") || "pdf";
}

function translateOcrStatus(status: string, language: AppLanguage) {
  const labels: Record<string, [string, string]> = {
    "loading tesseract core": ["OCR WebAssembly 엔진 불러오는 중…", "Loading the OCR WebAssembly engine…"],
    "initializing tesseract": ["OCR 엔진 초기화 중…", "Initializing the OCR engine…"],
    "loading language traineddata": ["한국어·영어 학습 모델 내려받는 중…", "Loading Korean and English language models…"],
    "initializing api": ["한국어·영어 인식기 준비 중…", "Preparing Korean and English recognition…"],
  };
  const label = labels[status];
  return label ? local(language, label[0], label[1]) : local(language, `OCR 준비 중 · ${status}`, `Preparing OCR · ${status}`);
}

function normalizePdfOpenError(error: unknown, language: AppLanguage) {
  if (error instanceof PasswordException || (error instanceof Error && error.name === "PasswordException")) {
    return new Error(local(language, "암호로 보호된 PDF입니다. 보호가 해제된 사본으로 다시 시도해 주세요.", "This PDF is password-protected. Try again with an unlocked copy."));
  }
  if (error instanceof Error && /password|encrypted/i.test(error.message)) {
    return new Error(local(language, "암호로 보호된 PDF입니다. 보호가 해제된 사본으로 다시 시도해 주세요.", "This PDF is password-protected. Try again with an unlocked copy."));
  }
  return error instanceof Error ? error : new Error(local(language, "PDF 파일을 열지 못했습니다.", "Unable to open the PDF file."));
}
