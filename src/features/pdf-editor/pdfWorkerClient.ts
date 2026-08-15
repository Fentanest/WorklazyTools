import type {
  PdfPagePlan,
  PdfOutputOptions,
  PdfTextDocument,
  PdfWorkerInput,
  PdfWorkerResult,
  WorkerProgress,
} from "./types";
import type { AppLanguage } from "../../i18n/languages";

interface WorkerErrorPayload {
  message: string;
  code?: string;
}

function createPdfWorker() {
  return new Worker(new URL("./pdf.worker.ts", import.meta.url), { type: "module" });
}

function createPdfOfficeWorker() {
  return new Worker(new URL("./pdfOffice.worker.ts", import.meta.url), { type: "module" });
}

function runWorker<T>(message: object, transfer: Transferable[], onProgress?: WorkerProgress, language: AppLanguage = "ko") {
  return runSpecificWorker<T>(createPdfWorker(), { ...message, language }, transfer, onProgress, language);
}

function runSpecificWorker<T>(worker: Worker, message: object, transfer: Transferable[], onProgress?: WorkerProgress, language: AppLanguage = "ko") {
  const L = (ko: string, en: string) => language === "ko" ? ko : en;
  return new Promise<T>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as {
        type: "progress" | "result" | "error";
        progress?: number;
        message?: string;
        result?: T;
        error?: WorkerErrorPayload;
      };
      if (data.type === "progress") {
        onProgress?.(data.progress ?? 0, data.message ?? L("처리 중…", "Processing…"));
        return;
      }
      worker.terminate();
      if (data.type === "result") resolve(data.result as T);
      else {
        const error = new Error(data.error?.message || L("PDF 처리 중 오류가 발생했습니다.", "An error occurred while processing the PDF.")) as Error & { code?: string };
        error.code = data.error?.code;
        reject(error);
      }
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || L("PDF 작업을 시작하지 못했습니다.", "Unable to start the PDF operation.")));
    };
    worker.postMessage(message, transfer);
  });
}

async function serializeFiles(files: Array<{ id: string; file: File }>) {
  const inputs: PdfWorkerInput[] = [];
  for (const { id, file } of files) {
    inputs.push({ id, name: file.name, mimeType: file.type, buffer: await file.arrayBuffer() });
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
) {
  const sourceIds = new Set(pages.map((page) => page.sourceId));
  const inputs = await serializeFiles(files.filter((file) => sourceIds.has(file.id)));
  const workerOptions = await serializeOutputOptions(options);
  const transfer = [...inputs.map((input) => input.buffer), ...(workerOptions.watermarkImage ? [workerOptions.watermarkImage] : [])];
  return runWorker<PdfWorkerResult>(
    { type: "merge", inputs, pages, fileName, options: workerOptions },
    transfer,
    onProgress,
    language,
  );
}

export async function exportPdfGroups(
  files: Array<{ id: string; file: File }>,
  groups: Array<{ fileName: string; pages: PdfPagePlan[] }>,
  archiveName: string,
  onProgress?: WorkerProgress,
  language: AppLanguage = "ko",
  options: PdfOutputOptions = {},
) {
  const sourceIds = new Set(groups.flatMap((group) => group.pages.map((page) => page.sourceId)));
  const inputs = await serializeFiles(files.filter((file) => sourceIds.has(file.id)));
  const workerOptions = await serializeOutputOptions(options);
  const transfer = [...inputs.map((input) => input.buffer), ...(workerOptions.watermarkImage ? [workerOptions.watermarkImage] : [])];
  return runWorker<PdfWorkerResult>(
    { type: "export-groups", inputs, groups, archiveName, options: workerOptions },
    transfer,
    onProgress,
    language,
  );
}

async function serializeOutputOptions(options: PdfOutputOptions) {
  return {
    pageNumbers: Boolean(options.pageNumbers),
    watermarkImage: options.watermarkText?.trim() ? await createWatermarkImage(options.watermarkText.trim()) : undefined,
  };
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
) {
  const inputs: PdfWorkerInput[] = [];
  for (let index = 0; index < files.length; index += 1) {
    const normalized = options.imagesAlreadyNormalized ? files[index] : await normalizeImageOrientation(files[index], language);
    inputs.push({ id: `image-${index}`, name: normalized.name, mimeType: normalized.type, buffer: await normalized.arrayBuffer() });
  }
  const workerOptions = await serializeOutputOptions(options);
  const transfer = [...inputs.map((input) => input.buffer), ...(workerOptions.watermarkImage ? [workerOptions.watermarkImage] : [])];
  return runWorker<PdfWorkerResult>(
    { type: "images-to-pdf", inputs, pageMode, fileName, options: workerOptions },
    transfer,
    onProgress,
    language,
  );
}

async function normalizeImageOrientation(file: File, language: AppLanguage) {
  const L = (ko: string, en: string) => language === "ko" ? ko : en;
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
    if (!source) throw new Error(L("원본 이미지를 읽지 못했습니다.", "The source image could not be decoded."));
    const width = bitmap?.width ?? image?.naturalWidth ?? 0;
    const height = bitmap?.height ?? image?.naturalHeight ?? 0;
    if (!width || !height) throw new Error(L("이미지 크기를 확인할 수 없습니다.", "The image dimensions could not be determined."));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: file.type === "image/png" });
    if (!context) throw new Error(L("이미지 방향을 보정할 수 없습니다.", "Unable to correct the image orientation."));
    context.drawImage(source, 0, 0);
    const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error(L("이미지를 PDF용으로 준비하지 못했습니다.", "Unable to prepare the image for PDF conversion."))), mimeType, 0.96));
    canvas.width = 1;
    canvas.height = 1;
    const extension = mimeType === "image/png" ? "png" : "jpg";
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${extension}`, { type: mimeType, lastModified: file.lastModified });
  } catch (error) {
    throw error instanceof Error ? error : new Error(L("이미지 파일을 읽지 못했습니다.", "Unable to read the image file."));
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
) {
  return runSpecificWorker<PdfWorkerResult>(
    createPdfOfficeWorker(),
    { type: "text-to-office", document, format, fileName, language },
    [],
    onProgress,
    language,
  );
}

export function combineOcrPdfPages(buffers: ArrayBuffer[], fileName: string, onProgress?: WorkerProgress, language: AppLanguage = "ko") {
  return runWorker<PdfWorkerResult>(
    { type: "combine-ocr-pdfs", buffers, fileName },
    buffers,
    onProgress,
    language,
  );
}
