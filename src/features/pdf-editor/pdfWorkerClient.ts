import { inspectImage, ImageInputError } from "./imageInput.ts";
import { rasterImage } from "./imageRaster.ts";
import { imageConversionError } from "./imageMessages";
import type {
  PdfPagePlan,
  PdfOutputOptions,
  PdfTextDocument,
  PdfWorkerInput,
  PdfWorkerResult,
  WorkerProgress,
} from "./types";
import type { AppLanguage } from "../../i18n/languages";
import { featureMessage } from "../../i18n/featureMessages";
import { throwIfAborted } from "../../utils/cooperativeCancel.ts";
import { pdfWorkerCanceledMessage, runPdfWorker } from "./pdfWorkerLifecycle";
import { isConversionErrorCode, PdfConversionError } from "./pdfConversionErrors";
import { LEGACY_ORGANIZE_PDF_PRESET } from "./legacyOrganizePreset.ts";

function createPdfWorker() {
  return new Worker(new URL("./pdf.worker.ts", import.meta.url), { type: "module" });
}

function createPdfOfficeWorker() {
  return new Worker(new URL("./pdfOffice.worker.ts", import.meta.url), { type: "module" });
}

function runWorker<T>(message: object, transfer: Transferable[], onProgress?: WorkerProgress, language: AppLanguage = "ko", signal?: AbortSignal) {
  return runPdfWorker<object, T>(createPdfWorker, { ...message, language }, transfer, onProgress, language, signal);
}

async function serializeFiles(files: Array<{ id: string; file: File }>, language: AppLanguage, signal?: AbortSignal) {
  const inputs: PdfWorkerInput[] = [];
  for (const { id, file } of files) {
    throwIfPdfWorkerAborted(signal, language);
    const buffer = await file.arrayBuffer();
    throwIfPdfWorkerAborted(signal, language);
    inputs.push({ id, name: file.name, mimeType: file.type, buffer });
  }
  return inputs;
}

export async function mergePdfPages(
  files: Array<{ id: string; file: File }>,
  pages: PdfPagePlan[],
  fileName: string,
  onProgress?: WorkerProgress,
  language: AppLanguage = "ko",
  options: PdfOutputOptions = {},
  signal?: AbortSignal,
) {
  const sourceIds = new Set(pages.map((page) => page.sourceId));
  const inputs = await serializeFiles(files.filter((file) => sourceIds.has(file.id)), language, signal);
  const workerOptions = await serializeOutputOptions(options, language, signal);
  const transfer = [...inputs.map((input) => input.buffer), ...(workerOptions.watermarkImage ? [workerOptions.watermarkImage] : [])];
  return runWorker<PdfWorkerResult>(
    { type: "merge", inputs, pages, fileName, options: workerOptions },
    transfer,
    onProgress,
    language,
    signal,
  );
}

export async function exportPdfGroups(
  files: Array<{ id: string; file: File }>,
  groups: Array<{ fileName: string; pages: PdfPagePlan[] }>,
  archiveName: string,
  onProgress?: WorkerProgress,
  language: AppLanguage = "ko",
  options: PdfOutputOptions = {},
  signal?: AbortSignal,
) {
  const sourceIds = new Set(groups.flatMap((group) => group.pages.map((page) => page.sourceId)));
  const inputs = await serializeFiles(files.filter((file) => sourceIds.has(file.id)), language, signal);
  const workerOptions = await serializeOutputOptions(options, language, signal);
  const transfer = [...inputs.map((input) => input.buffer), ...(workerOptions.watermarkImage ? [workerOptions.watermarkImage] : [])];
  return runWorker<PdfWorkerResult>(
    { type: "export-groups", inputs, groups, archiveName, splitPdfFallback: featureMessage(language, "pdf.messages.pdf.splitPdf"), options: workerOptions },
    transfer,
    onProgress,
    language,
    signal,
  );
}

async function serializeOutputOptions(options: PdfOutputOptions, language: AppLanguage, signal?: AbortSignal) {
  throwIfPdfWorkerAborted(signal, language);
  const serialized = {
    pageNumbers: Boolean(options.pageNumbers),
    watermarkImage: options.watermarkText?.trim() ? await createWatermarkImage(options.watermarkText.trim()) : undefined,
  };
  throwIfPdfWorkerAborted(signal, language);
  return serialized;
}

async function createWatermarkImage(text: string) {
  const preset = LEGACY_ORGANIZE_PDF_PRESET.watermarkCanvas;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to prepare the watermark.");
  context.font = preset.font;
  const width = Math.min(preset.maxWidth, Math.max(preset.minWidth, Math.ceil(context.measureText(text).width + preset.horizontalPadding)));
  canvas.width = width;
  canvas.height = preset.height;
  context.font = preset.font;
  context.fillStyle = preset.fillStyle;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text.slice(0, preset.utf16SliceUnits), width / 2, canvas.height / 2);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Unable to prepare the watermark.")), "image/png"));
  canvas.width = 1; canvas.height = 1;
  return blob.arrayBuffer();
}

export async function imagesToPdf(
  files: File[],
  pageMode: "a4" | "image",
  fileName: string,
  onProgress?: WorkerProgress,
  language: AppLanguage = "ko",
  options: PdfOutputOptions = {},
  signal?: AbortSignal,
  imageIds: string[] = [],
) {
  const inputs: PdfWorkerInput[] = [];
  for (let index = 0; index < files.length; index += 1) {
    throwIfPdfWorkerAborted(signal, language);
    const file = files[index], id = imageIds[index] ?? `image-${index}`;
    onProgress?.(index / files.length * 30, featureMessage(language, "pdf.imageInput.preprocessing", { index: index+1, total: files.length, name: file.name }));
    try {
      let buffer: ArrayBuffer;
      try { buffer = await file.arrayBuffer(); } catch (cause) { throw new ImageInputError('read', cause); }
      throwIfPdfWorkerAborted(signal, language);
      const metadata = inspectImage(buffer);
      const direct = metadata.directJpeg || options.imagesAlreadyNormalized;
      if (!direct) {
        const normalized = await rasterImage(new File([buffer], file.name, { type: metadata.mime }), metadata, false, signal);
        buffer = await normalized.arrayBuffer();
      }
      throwIfPdfWorkerAborted(signal, language);
      console.debug('image-pdf', { id, name: file.name, size: file.size, width: metadata.width, height: metadata.height,
        route: metadata.directJpeg ? 'jpeg-direct' : direct ? 'already-normalized' : 'normalize', index: index+1, total: files.length });
      inputs.push({ id, name: file.name, mimeType: metadata.mime, buffer });
    } catch (reason) {
      throwIfPdfWorkerAborted(signal, language);
      throw imageConversionError(reason, language, file, index, id);
    }
  }
  const workerOptions = await serializeOutputOptions(options, language, signal);
  const transfer = [...inputs.map((input) => input.buffer), ...(workerOptions.watermarkImage ? [workerOptions.watermarkImage] : [])];
  return runWorker<PdfWorkerResult>(
    { type: "images-to-pdf", inputs, pageMode, fileName, options: workerOptions }, transfer,
    (value, message) => onProgress?.(30 + value * 0.7, message), language, signal,
  );
}

export function textDocumentToOffice(
  document: PdfTextDocument,
  format: "docx" | "xlsx" | "txt" | "pptx" | "hwpx",
  fileName: string,
  onProgress?: WorkerProgress,
  language: AppLanguage = "ko",
  signal?: AbortSignal,
) {
  return runPdfWorker<object, PdfWorkerResult>(
    createPdfOfficeWorker,
    {
      type: "text-to-office",
      document,
      format,
      fileName,
      language,
      copy: {
        textPageTitles: document.pages.map((page) => featureMessage(language, "pdf.messages.pdfOffice.page", { p0: page.pageNumber })),
        pageTitles: document.pages.map((page) => featureMessage(language, "pdf.messages.pdfOffice.page2", { p0: page.pageNumber })),
        normalStyle: featureMessage(language, "pdf.messages.pdfOffice.normal"),
        pageHeadingStyle: featureMessage(language, "pdf.messages.pdfOffice.pageHeading"),
        noRecognizedText: featureMessage(language, "pdf.messages.pdfOffice.noRecognizedText"),
      },
    },
    [],
    onProgress,
    language,
    signal,
  ).catch((error: unknown) => {
    if (signal?.aborted || error instanceof DOMException && error.name === "AbortError") throw error;
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    throw new PdfConversionError(isConversionErrorCode(code) ? code : "DOCUMENT_EXPORT", { format });
  });
}

export function combineOcrPdfPages(buffers: ArrayBuffer[], fileName: string, onProgress?: WorkerProgress, language: AppLanguage = "ko", signal?: AbortSignal) {
  return runWorker<PdfWorkerResult>(
    { type: "combine-ocr-pdfs", buffers, fileName },
    buffers,
    onProgress,
    language,
    signal,
  );
}

function throwIfPdfWorkerAborted(signal: AbortSignal | undefined, language: AppLanguage): void {
  throwIfAborted(signal, pdfWorkerCanceledMessage(language));
}
