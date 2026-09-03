import { runModuleWorker, type ModuleWorkerProgress } from "../../utils/workerLifecycle.ts";
import type { ExcelCleanerInspection, ExcelCleanerOptions, ExcelCleanerResult } from "./types.ts";

const messages = {
  ko: { canceled: "Excel 데이터 정리를 취소했습니다.", start: "파일 처리를 시작하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.", result: "파일을 정리하지 못했습니다. 파일과 규칙 설정을 확인해 주세요.", timeout: "규칙 처리가 너무 오래 멈춰 종료했습니다. 해당 규칙을 수정하거나 제거해 주세요." },
  en: { canceled: "Excel data cleaning was canceled.", start: "Could not start file processing. Reload the page and try again.", result: "Could not clean the file. Check the file and rule settings.", timeout: "A rule stopped making progress and was ended. Change or remove that rule and try again." },
};

function createWorker() { return new Worker(new URL("./excelCleaner.worker.ts", import.meta.url), { type: "module" }); }

export async function inspectExcelCleanerFile(file: File, language: "ko" | "en", signal?: AbortSignal, headerRows: number[] = [1]) {
  const buffer = await file.arrayBuffer();
  return runModuleWorker<object, ExcelCleanerInspection>(createWorker, { type: "inspect", fileName: file.name, buffer, headerRows }, {
    transfer: [buffer], signal, canceledMessage: messages[language].canceled, startErrorMessage: messages[language].start, resultErrorMessage: messages[language].result,
  });
}

export async function runExcelCleanerFile(file: File, options: ExcelCleanerOptions, language: "ko" | "en", mode: "preview" | "run", signal?: AbortSignal, onProgress?: (progress: ModuleWorkerProgress) => void, inactivityTimeoutMs = 30_000) {
  if (signal?.aborted) throw new DOMException(messages[language].canceled, "AbortError");
  const buffer = await file.arrayBuffer();
  if (signal?.aborted) throw new DOMException(messages[language].canceled, "AbortError");
  return runModuleWorker<object, ExcelCleanerResult>(createWorker, { type: mode, fileName: file.name, buffer, language, options }, {
    transfer: [buffer], signal, onProgress, inactivityTimeoutMs, timeoutMessage: messages[language].timeout,
    canceledMessage: messages[language].canceled, startErrorMessage: messages[language].start, resultErrorMessage: messages[language].result,
  });
}
