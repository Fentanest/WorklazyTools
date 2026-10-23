import type { WordCompareResult } from "../excel-merger/types";

export interface WordCompareOptions {
  formatting: boolean;
  tables: boolean;
  metadata: boolean;
  trackedDocument: boolean;
  rewriteRevisionAuthor: boolean;
  revisionAuthor: string;
}

export interface WordWorkerPairResult {
  result: WordCompareResult;
  trackedBuffer?: ArrayBuffer;
}

export interface WordFilePair {
  beforeFile: File;
  afterFile: File;
}

export async function compareWordFilePairs(
  pairs: WordFilePair[],
  options: WordCompareOptions,
  onProgress?: (progress: number, message: string) => void,
  language: "ko" | "en" = "ko",
  signal?: AbortSignal,
) {
  const canceledMessage = language === "en" ? "Word comparison was cancelled." : "Word 문서 비교를 취소했습니다.";
  const startError = language === "en" ? "Could not start Word comparison. Reload the page and try again." : "Word 문서 비교를 시작하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.";
  const checkAbort = () => { if (signal?.aborted) throw new DOMException(canceledMessage, "AbortError"); };
  const payloads: Array<{ beforeName: string; afterName: string; beforeBuffer: ArrayBuffer; afterBuffer: ArrayBuffer }> = [];
  try {
    for (const { beforeFile, afterFile } of pairs) {
      checkAbort();
      const beforeBuffer = await beforeFile.arrayBuffer();
      checkAbort();
      const afterBuffer = await afterFile.arrayBuffer();
      checkAbort();
      payloads.push({ beforeName: beforeFile.name, afterName: afterFile.name, beforeBuffer, afterBuffer });
    }
  } catch (error) {
    if (signal?.aborted || error instanceof DOMException && error.name === "AbortError") throw new DOMException(canceledMessage, "AbortError");
    throw new Error(language === "en" ? "Could not read the selected Word files. Choose the files again." : "선택한 파일을 읽지 못했습니다. 파일을 다시 선택해 주세요.");
  }
  const transfer = payloads.flatMap((pair) => [pair.beforeBuffer, pair.afterBuffer]);
  checkAbort();
  let worker: Worker;
  try { worker = new Worker(new URL("./word.worker.ts", import.meta.url), { type: "module" }); }
  catch { throw new Error(startError); }

  const validEntry = (value: unknown, index: number) => {
    if (!value || typeof value !== "object") return false;
    const item = value as Partial<WordWorkerPairResult>, result = item.result;
    return Boolean(result && result.beforeName === payloads[index].beforeName && result.afterName === payloads[index].afterName
      && result.summary && ["added", "deleted", "changed", "format", "unchanged"].every((key) => Number.isFinite(result.summary[key as keyof typeof result.summary]) && result.summary[key as keyof typeof result.summary]! >= 0)
      && Array.isArray(result.changes) && Array.isArray(result.tables) && Array.isArray(result.warnings) && result.warnings.every((message) => typeof message === "string")
      && result.views && Array.isArray(result.views.document) && Array.isArray(result.views.headerFooter) && Array.isArray(result.views.note)
      && (item.trackedBuffer === undefined || item.trackedBuffer instanceof ArrayBuffer && item.trackedBuffer.byteLength > 0));
  };

  return new Promise<WordWorkerPairResult[]>((resolve, reject) => {
    let settled = false;
    const finish = () => { if (settled) return false; settled = true; signal?.removeEventListener("abort", abort); worker.onmessage = worker.onerror = worker.onmessageerror = null; worker.terminate(); return true; };
    const abort = () => { if (finish()) reject(new DOMException(canceledMessage, "AbortError")); };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    worker.onmessage = (event: MessageEvent) => {
      if (settled) return;
      if (event.data?.type === "progress") {
        onProgress?.(event.data.progress, event.data.message);
        return;
      }
      if (!finish()) return;
      if (event.data?.type === "result" && Array.isArray(event.data.result) && event.data.result.length === payloads.length && event.data.result.every(validEntry)) resolve(event.data.result as WordWorkerPairResult[]);
      else reject(new Error(event.data?.type === "error" && typeof event.data.error?.message === "string" ? event.data.error.message : language === "en" ? "An error occurred while comparing Word documents." : "Word 문서 비교 중 오류가 발생했습니다."));
    };
    worker.onerror = (event) => {
      if (!finish()) return;
      event.preventDefault();
      reject(new Error(startError));
    };
    worker.onmessageerror = () => {
      if (finish()) reject(new Error(language === "en" ? "Could not read the comparison result." : "비교 결과를 읽지 못했습니다."));
    };
    try { worker.postMessage({
      pairs: payloads,
      options,
      language,
    }, transfer); }
    catch { if (finish()) reject(new Error(startError)); }
  });
}
