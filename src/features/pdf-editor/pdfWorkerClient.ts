import type {
  PdfPagePlan,
  PdfTextDocument,
  PdfWorkerInput,
  PdfWorkerResult,
  WorkerProgress,
} from "./types";

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

function runWorker<T>(message: object, transfer: Transferable[], onProgress?: WorkerProgress) {
  return runSpecificWorker<T>(createPdfWorker(), message, transfer, onProgress);
}

function runSpecificWorker<T>(worker: Worker, message: object, transfer: Transferable[], onProgress?: WorkerProgress) {
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
        onProgress?.(data.progress ?? 0, data.message ?? "처리 중…");
        return;
      }
      worker.terminate();
      if (data.type === "result") resolve(data.result as T);
      else {
        const error = new Error(data.error?.message || "PDF 처리 중 오류가 발생했습니다.") as Error & { code?: string };
        error.code = data.error?.code;
        reject(error);
      }
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || "PDF 작업을 시작하지 못했습니다."));
    };
    worker.postMessage(message, transfer);
  });
}

async function serializeFiles(files: Array<{ id: string; file: File }>) {
  return Promise.all(files.map(async ({ id, file }): Promise<PdfWorkerInput> => ({
    id,
    name: file.name,
    buffer: await file.arrayBuffer(),
  })));
}

export async function mergePdfPages(
  files: Array<{ id: string; file: File }>,
  pages: PdfPagePlan[],
  fileName: string,
  onProgress?: WorkerProgress,
) {
  const inputs = await serializeFiles(files);
  return runWorker<PdfWorkerResult>(
    { type: "merge", inputs, pages, fileName },
    inputs.map((input) => input.buffer),
    onProgress,
  );
}

export async function exportPdfGroups(
  files: Array<{ id: string; file: File }>,
  groups: Array<{ fileName: string; pages: PdfPagePlan[] }>,
  archiveName: string,
  onProgress?: WorkerProgress,
) {
  const inputs = await serializeFiles(files);
  return runWorker<PdfWorkerResult>(
    { type: "export-groups", inputs, groups, archiveName },
    inputs.map((input) => input.buffer),
    onProgress,
  );
}

export async function imagesToPdf(
  files: File[],
  pageMode: "a4" | "image",
  fileName: string,
  onProgress?: WorkerProgress,
) {
  const inputs = await serializeFiles(files.map((file, index) => ({ id: `image-${index}`, file })));
  return runWorker<PdfWorkerResult>(
    { type: "images-to-pdf", inputs, pageMode, fileName },
    inputs.map((input) => input.buffer),
    onProgress,
  );
}

export function textDocumentToOffice(
  document: PdfTextDocument,
  format: "docx" | "xlsx" | "txt",
  fileName: string,
  onProgress?: WorkerProgress,
) {
  return runSpecificWorker<PdfWorkerResult>(
    createPdfOfficeWorker(),
    { type: "text-to-office", document, format, fileName },
    [],
    onProgress,
  );
}

export function combineOcrPdfPages(buffers: ArrayBuffer[], fileName: string, onProgress?: WorkerProgress) {
  return runWorker<PdfWorkerResult>(
    { type: "combine-ocr-pdfs", buffers, fileName },
    buffers,
    onProgress,
  );
}
