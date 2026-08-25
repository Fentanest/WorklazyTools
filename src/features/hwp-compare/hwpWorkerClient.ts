import type { WordCompareResult } from "../excel-merger/types";

export interface HwpCompareOptions {
  formatting: boolean;
  tables: boolean;
  metadata: boolean;
}

export interface HwpFilePair {
  beforeFile: File;
  afterFile: File;
  beforePassword?: string;
  afterPassword?: string;
}

export interface HwpWorkerPairResult {
  result: WordCompareResult;
}

export async function compareHwpFilePairs(
  pairs: HwpFilePair[],
  options: HwpCompareOptions,
  onProgress?: (progress: number, message: string) => void,
  language: "ko" | "en" = "ko",
  signal?: AbortSignal,
) {
  const worker = new Worker(new URL("./hwp-compare.worker.ts", import.meta.url), { type: "module" });
  const payloads: Array<{
    beforeName: string;
    afterName: string;
    beforePassword?: string;
    afterPassword?: string;
    beforeBuffer: ArrayBuffer;
    afterBuffer: ArrayBuffer;
  }> = [];
  for (const pair of pairs) {
    if (signal?.aborted) throw new DOMException(language === "en" ? "HWP comparison was cancelled." : "HWP 문서 비교를 취소했습니다.", "AbortError");
    payloads.push({
      beforeName: pair.beforeFile.name,
      afterName: pair.afterFile.name,
      beforePassword: pair.beforePassword,
      afterPassword: pair.afterPassword,
      beforeBuffer: await pair.beforeFile.arrayBuffer(),
      afterBuffer: await pair.afterFile.arrayBuffer(),
    });
  }
  const transfer = payloads.flatMap((pair) => [pair.beforeBuffer, pair.afterBuffer]);

  return new Promise<HwpWorkerPairResult[]>((resolve, reject) => {
    let settled = false;
    const finish = () => { if (settled) return false; settled = true; signal?.removeEventListener("abort", abort); worker.terminate(); return true; };
    const abort = () => { if (finish()) reject(new DOMException(language === "en" ? "HWP comparison was cancelled." : "HWP 문서 비교를 취소했습니다.", "AbortError")); };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    worker.onmessage = (event: MessageEvent) => {
      if (event.data.type === "progress") {
        onProgress?.(event.data.progress, event.data.message);
        return;
      }
      if (!finish()) return;
      if (event.data.type === "result") resolve(event.data.result as HwpWorkerPairResult[]);
      else reject(new Error(event.data.error?.message || (language === "en" ? "An error occurred while comparing HWP documents." : "HWP 문서 비교 중 오류가 발생했습니다.")));
    };
    worker.onerror = (event) => {
      if (!finish()) return;
      event.preventDefault();
      reject(new Error(language === "en" ? "Could not start HWP comparison. Reload the page and try again." : "HWP 문서 비교를 시작하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요."));
    };
    worker.postMessage({ pairs: payloads, options, language }, transfer);
  });
}
