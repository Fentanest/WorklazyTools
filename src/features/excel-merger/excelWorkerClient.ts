import type {
  ExcelInputPayload,
  ExcelInspectionResult,
  ExcelMergeOptions,
  ExcelMergeResult,
  WordCompareResult,
} from "./types";

type WorkerProgress = (progress: number, message: string) => void;

interface WorkerErrorPayload {
  message: string;
  code?: string;
  fileName?: string;
}

function createExcelWorker() {
  return new Worker(new URL("./excel.worker.ts", import.meta.url), { type: "module" });
}

function runWorker<T>(
  message: object,
  transfer: Transferable[],
  onProgress?: WorkerProgress,
): Promise<T> {
  const worker = createExcelWorker();

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
      if (data.type === "result") {
        resolve(data.result as T);
        return;
      }

      const error = new Error(data.error?.message || "파일 처리 중 오류가 발생했습니다.") as Error & WorkerErrorPayload;
      error.code = data.error?.code;
      error.fileName = data.error?.fileName;
      reject(error);
    };

    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || "파일 처리를 시작하지 못했습니다."));
    };

    worker.postMessage(message, transfer);
  });
}

export async function inspectExcelFiles(files: Array<{ id: string; file: File; password?: string }>) {
  const payloads: ExcelInputPayload[] = await Promise.all(files.map(async ({ id, file, password }) => ({
    id,
    name: file.name,
    buffer: await file.arrayBuffer(),
    password,
  })));
  return runWorker<ExcelInspectionResult[]>(
    { type: "inspect", files: payloads },
    payloads.map((file) => file.buffer),
  );
}

export async function mergeExcelFiles(
  files: Array<{ id: string; file: File; password?: string; selectedSheetNames: string[] }>,
  options: ExcelMergeOptions,
  onProgress?: WorkerProgress,
) {
  const payloads: ExcelInputPayload[] = await Promise.all(files.map(async ({ id, file, password, selectedSheetNames }) => ({
    id,
    name: file.name,
    buffer: await file.arrayBuffer(),
    password,
    selectedSheetNames,
  })));

  return runWorker<ExcelMergeResult>(
    { type: "merge", files: payloads, options },
    payloads.map((file) => file.buffer),
    onProgress,
  );
}

export function createWordExcelReport(result: WordCompareResult, onProgress?: WorkerProgress) {
  return runWorker<ArrayBuffer>({ type: "word-report", result }, [], onProgress);
}

export function createWordExcelReports(results: WordCompareResult[], onProgress?: WorkerProgress) {
  return runWorker<ArrayBuffer[]>({ type: "word-reports", results }, [], onProgress);
}
