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
  const worker = new Worker(new URL("./word.worker.ts", import.meta.url), { type: "module" });
  const payloads: Array<{ beforeName: string; afterName: string; beforeBuffer: ArrayBuffer; afterBuffer: ArrayBuffer }> = [];
  for (const { beforeFile, afterFile } of pairs) {
    if (signal?.aborted) throw new DOMException(language === "en" ? "Word comparison was cancelled." : "Word 문서 비교를 취소했습니다.", "AbortError");
    payloads.push({
      beforeName: beforeFile.name,
      afterName: afterFile.name,
      beforeBuffer: await beforeFile.arrayBuffer(),
      afterBuffer: await afterFile.arrayBuffer(),
    });
  }
  const transfer = payloads.flatMap((pair) => [pair.beforeBuffer, pair.afterBuffer]);

  return new Promise<WordWorkerPairResult[]>((resolve, reject) => {
    let settled = false;
    const finish = () => { if (settled) return false; settled = true; signal?.removeEventListener("abort", abort); worker.terminate(); return true; };
    const abort = () => { if (finish()) reject(new DOMException(language === "en" ? "Word comparison was cancelled." : "Word 문서 비교를 취소했습니다.", "AbortError")); };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    worker.onmessage = (event: MessageEvent) => {
      if (event.data.type === "progress") {
        onProgress?.(event.data.progress, event.data.message);
        return;
      }
      if (!finish()) return;
      if (event.data.type === "result") resolve(event.data.result as WordWorkerPairResult[]);
      else reject(new Error(event.data.error?.message || (language === "en" ? "An error occurred while comparing Word documents." : "Word 문서 비교 중 오류가 발생했습니다.")));
    };
    worker.onerror = (event) => {
      if (!finish()) return;
      event.preventDefault();
      reject(new Error(language === "en" ? "Could not start Word comparison. Reload the page and try again." : "Word 문서 비교를 시작하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요."));
    };
    worker.postMessage({
      pairs: payloads,
      options,
      language,
    }, transfer);
  });
}
