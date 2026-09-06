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
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to prepare the watermark.");
  context.font = "600 46px system-ui, sans-serif";
  const width = Math.min(1800, Math.max(420, Math.ceil(context.measureText(text).width + 80)));
  canvas.width = width;
  canvas.height = 92;
  context.font = "600 46px system-ui, sans-serif";
  context.fillStyle = "rgba(30, 30, 34, .82)";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text.slice(0, 120), width / 2, canvas.height / 2);
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
) {
  const inputs: PdfWorkerInput[] = [];
  for (let index = 0; index < files.length; index += 1) {
    throwIfPdfWorkerAborted(signal, language);
    const normalized = options.imagesAlreadyNormalized ? files[index] : await normalizeImageOrientation(files[index], language);
    throwIfPdfWorkerAborted(signal, language);
    const buffer = await normalized.arrayBuffer();
    throwIfPdfWorkerAborted(signal, language);
    inputs.push({ id: `image-${index}`, name: normalized.name, mimeType: normalized.type, buffer });
  }
  const workerOptions = await serializeOutputOptions(options, language, signal);
  const transfer = [...inputs.map((input) => input.buffer), ...(workerOptions.watermarkImage ? [workerOptions.watermarkImage] : [])];
  return runWorker<PdfWorkerResult>(
    { type: "images-to-pdf", inputs, pageMode, fileName, options: workerOptions },
    transfer,
    onProgress,
    language,
    signal,
  );
}

async function normalizeImageOrientation(file: File, language: AppLanguage) {
    let bitmap: ImageBitmap | undefined;
  let image: HTMLImageElement | undefined;
  let objectUrl = "";
  try {
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      objectUrl = URL.createObjectURL(file);
      image = new Image();
      image.src = objectUrl;
      await image.decode();
    }
    const source = bitmap ?? image;
    if (!source) throw new Error(featureMessage(language, "pdf.messages.pdfWorkerClient.theSourceImageCouldNotBeDecoded"));
    const width = bitmap?.width ?? image?.naturalWidth ?? 0;
    const height = bitmap?.height ?? image?.naturalHeight ?? 0;
    if (!width || !height) throw new Error(featureMessage(language, "pdf.messages.pdfWorkerClient.theImageDimensionsCouldNotBeDetermined"));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: file.type === "image/png" });
    if (!context) throw new Error(featureMessage(language, "pdf.messages.pdfWorkerClient.unableToCorrectTheImageOrientation"));
    context.drawImage(source, 0, 0);
    const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error(featureMessage(language, "pdf.messages.pdfWorkerClient.unableToPrepareTheImageForPdfConversion"))), mimeType, 0.96));
    canvas.width = 1;
    canvas.height = 1;
    const extension = mimeType === "image/png" ? "png" : "jpg";
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${extension}`, { type: mimeType, lastModified: file.lastModified });
  } catch (error) {
    throw error instanceof Error ? error : new Error(featureMessage(language, "pdf.messages.pdfWorkerClient.unableToReadTheImageFile"));
  } finally {
    bitmap?.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

export function textDocumentToOffice(
  document: PdfTextDocument,
  format: "docx" | "xlsx" | "txt",
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
  );
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
