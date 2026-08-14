import type {
  PdfPagePlan,
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
    inputs.push({ id, name: file.name, buffer: await file.arrayBuffer() });
  }
  return inputs;
}

export async function mergePdfPages(
  files: Array<{ id: string; file: File }>,
  pages: PdfPagePlan[],
  fileName: string,
  onProgress?: WorkerProgress,
  language: AppLanguage = "ko",
) {
  const inputs = await serializeFiles(files);
  return runWorker<PdfWorkerResult>(
    { type: "merge", inputs, pages, fileName },
    inputs.map((input) => input.buffer),
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
) {
  const inputs = await serializeFiles(files);
  return runWorker<PdfWorkerResult>(
    { type: "export-groups", inputs, groups, archiveName },
    inputs.map((input) => input.buffer),
    onProgress,
    language,
  );
}

export async function imagesToPdf(
  files: File[],
  pageMode: "a4" | "image",
  fileName: string,
  onProgress?: WorkerProgress,
  language: AppLanguage = "ko",
) {
  const inputs = await serializeFiles(files.map((file, index) => ({ id: `image-${index}`, file })));
  return runWorker<PdfWorkerResult>(
    { type: "images-to-pdf", inputs, pageMode, fileName },
    inputs.map((input) => input.buffer),
    onProgress,
    language,
  );
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
