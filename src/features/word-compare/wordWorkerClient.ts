import type { FormattingMask } from "../document-compare/formattingMask";
import type { WordCompareResult } from "../excel-merger/types";
import { isOutOfMemory, outOfMemoryMessage } from "../document-compare/memoryFailure";

export interface WordCompareOptions {
  requestedFormattingMask?: Partial<FormattingMask>;
  formattingMask?: Partial<FormattingMask>;
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

/** Results as they become available: each pair's screen result, then its tracked DOCX (or the
 * warnings explaining why there is none). The returned promise still settles once with every pair. */
export interface WordComparisonEvents {
  onScreen?: (index: number, result: WordCompareResult) => void;
  onTracked?: (index: number, trackedBuffer: ArrayBuffer | undefined, warnings: string[]) => void;
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
  events?: WordComparisonEvents,
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
    const collected: Array<WordWorkerPairResult | undefined> = payloads.map(() => undefined), trackedSeen = new Set<number>();
    const failure = () => new Error(language === "en" ? "An error occurred while comparing Word documents." : "Word 문서 비교 중 오류가 발생했습니다.");
    const validIndex = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) < payloads.length;
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
      if (event.data?.type === "screen") {
        const index = event.data.index;
        if (!validIndex(index) || collected[index] || !validEntry({ result: event.data.result }, index)) { if (finish()) reject(failure()); return; }
        collected[index] = { result: event.data.result as WordCompareResult };
        events?.onScreen?.(index, collected[index]!.result);
        return;
      }
      if (event.data?.type === "tracked") {
        const index = event.data.index, buffer = event.data.trackedBuffer, warnings = event.data.warnings;
        const entry = validIndex(index) ? collected[index] : undefined;
        if (!entry || trackedSeen.has(index) || !Array.isArray(warnings) || !warnings.every((message: unknown) => typeof message === "string") || !validEntry({ result: entry.result, trackedBuffer: buffer }, index)) { if (finish()) reject(failure()); return; }
        trackedSeen.add(index);
        entry.trackedBuffer = buffer;
        entry.result.warnings.push(...warnings);
        events?.onTracked?.(index, buffer, warnings);
        return;
      }
      if (!finish()) return;
      if (event.data?.type === "done") {
        if (collected.every(Boolean)) resolve(collected as WordWorkerPairResult[]);
        else reject(failure());
        return;
      }
      if (event.data?.type === "result" && Array.isArray(event.data.result) && event.data.result.length === payloads.length && event.data.result.every(validEntry)) resolve(event.data.result as WordWorkerPairResult[]);
      else reject(new Error(event.data?.type === "error" && typeof event.data.error?.message === "string" ? event.data.error.message : language === "en" ? "An error occurred while comparing Word documents." : "Word 문서 비교 중 오류가 발생했습니다."));
    };
    worker.onerror = (event) => {
      if (!finish()) return;
      event.preventDefault();
      reject(new Error(isOutOfMemory(event.message) ? outOfMemoryMessage(language) : startError));
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
