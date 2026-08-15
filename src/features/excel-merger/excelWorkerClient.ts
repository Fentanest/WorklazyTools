import type {
  ExcelInputPayload,
  ExcelInspectionResult,
  ExcelMergeOptions,
  ExcelMergeResult,
  WordCompareResult,
} from "./types";

type WorkerProgress = (progress: number, message: string) => void;
type AppLanguage = "ko" | "en";

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
  language: AppLanguage = "ko",
  signal?: AbortSignal,
): Promise<T> {
  const worker = createExcelWorker();

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = () => { if (settled) return false; settled = true; signal?.removeEventListener("abort", abort); worker.terminate(); return true; };
    const abort = () => { if (finish()) reject(new DOMException(language === "en" ? "The spreadsheet merge was cancelled." : "스프레드시트 병합을 취소했습니다.", "AbortError")); };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as {
        type: "progress" | "result" | "error";
        progress?: number;
        message?: string;
        result?: T;
        error?: WorkerErrorPayload;
      };

      if (data.type === "progress") {
        onProgress?.(data.progress ?? 0, data.message ?? (language === "en" ? "Processing…" : "처리 중…"));
        return;
      }

      if (!finish()) return;
      if (data.type === "result") {
        resolve(data.result as T);
        return;
      }

      const error = new Error(data.error?.message || (language === "en" ? "An error occurred while processing the file." : "파일 처리 중 오류가 발생했습니다.")) as Error & WorkerErrorPayload;
      error.code = data.error?.code;
      error.fileName = data.error?.fileName;
      reject(error);
    };

    worker.onerror = (event) => {
      if (!finish()) return;
      reject(new Error(event.message || (language === "en" ? "Could not start file processing." : "파일 처리를 시작하지 못했습니다.")));
    };

    worker.postMessage(message, transfer);
  });
}

export async function inspectExcelFiles(files: Array<{ id: string; file: File; password?: string; csvEncoding?: ExcelInputPayload["csvEncoding"] }>, language: AppLanguage = "ko") {
  const payloads: ExcelInputPayload[] = [];
  for (const { id, file, password, csvEncoding } of files) {
    payloads.push({ id, name: file.name, buffer: await file.arrayBuffer(), password, csvEncoding });
  }
  return runWorker<ExcelInspectionResult[]>(
    { type: "inspect", files: payloads, language },
    payloads.map((file) => file.buffer),
    undefined,
    language,
  );
}

export async function mergeExcelFiles(
  files: Array<{ id: string; file: File; password?: string; selectedSheetNames: string[]; csvEncoding?: ExcelInputPayload["csvEncoding"] }>,
  options: ExcelMergeOptions,
  onProgress?: WorkerProgress,
  language: AppLanguage = "ko",
  signal?: AbortSignal,
) {
  const payloads: ExcelInputPayload[] = [];
  for (const { id, file, password, selectedSheetNames, csvEncoding } of files) {
    if (signal?.aborted) throw new DOMException(language === "en" ? "The spreadsheet merge was cancelled." : "스프레드시트 병합을 취소했습니다.", "AbortError");
    payloads.push({ id, name: file.name, buffer: await file.arrayBuffer(), password, selectedSheetNames, csvEncoding });
  }

  return runWorker<ExcelMergeResult>(
    { type: "merge", files: payloads, options, language },
    payloads.map((file) => file.buffer),
    onProgress,
    language,
    signal,
  );
}

export function createWordExcelReport(result: WordCompareResult, onProgress?: WorkerProgress, language: AppLanguage = "ko") {
  return runWorker<ArrayBuffer>({ type: "word-report", result, language }, [], onProgress, language);
}

export function createWordExcelReports(results: WordCompareResult[], onProgress?: WorkerProgress, language: AppLanguage = "ko", signal?: AbortSignal) {
  return runWorker<ArrayBuffer[]>({ type: "word-reports", results, language }, [], onProgress, language, signal);
}
