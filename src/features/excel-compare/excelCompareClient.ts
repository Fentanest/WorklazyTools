import { runModuleWorker, type ModuleWorkerProgress } from "../../utils/workerLifecycle.ts";
import type { ExcelCompareInspection, ExcelComparePairOptions, ExcelComparePairResult } from "./types.ts";

const messages = {
  ko: {
    canceled: "Excel 비교를 취소했습니다.",
    start: "파일 처리를 시작하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
    result: "파일을 비교하지 못했습니다. 손상 여부와 지원 형식을 확인해 주세요.",
  },
  en: {
    canceled: "Excel comparison was canceled.",
    start: "Could not start file processing. Reload the page and try again.",
    result: "Could not compare the files. Check that they are supported and not damaged.",
  },
};

function createWorker() {
  return new Worker(new URL("./excelCompare.worker.ts", import.meta.url), { type: "module" });
}

export async function inspectExcelCompareFile(file: File, language: "ko" | "en", signal?: AbortSignal, headerRows: number[] = [1]) {
  const buffer = await file.arrayBuffer();
  return runModuleWorker<object, ExcelCompareInspection>(createWorker, {
    type: "inspect",
    fileName: file.name,
    buffer,
    headerRows,
  }, {
    transfer: [buffer],
    signal,
    canceledMessage: messages[language].canceled,
    startErrorMessage: messages[language].start,
    resultErrorMessage: messages[language].result,
  });
}

export async function runExcelComparePair(
  left: File,
  right: File,
  options: ExcelComparePairOptions,
  language: "ko" | "en",
  signal?: AbortSignal,
  onProgress?: (progress: ModuleWorkerProgress) => void,
) {
  if (signal?.aborted) throw new DOMException(messages[language].canceled, "AbortError");
  const [leftBuffer, rightBuffer] = await Promise.all([left.arrayBuffer(), right.arrayBuffer()]);
  if (signal?.aborted) throw new DOMException(messages[language].canceled, "AbortError");
  return runModuleWorker<object, ExcelComparePairResult>(createWorker, {
    type: "compare",
    leftName: left.name,
    rightName: right.name,
    leftBuffer,
    rightBuffer,
    options,
  }, {
    transfer: [leftBuffer, rightBuffer],
    signal,
    onProgress,
    canceledMessage: messages[language].canceled,
    startErrorMessage: messages[language].start,
    resultErrorMessage: messages[language].result,
  });
}
