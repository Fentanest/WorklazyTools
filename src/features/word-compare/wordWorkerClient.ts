import type { WordCompareResult } from "../excel-merger/types";

export interface WordCompareOptions {
  formatting: boolean;
  tables: boolean;
  metadata: boolean;
  trackedDocument: boolean;
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
) {
  const worker = new Worker(new URL("./word.worker.ts", import.meta.url), { type: "module" });
  const payloads: Array<{ beforeName: string; afterName: string; beforeBuffer: ArrayBuffer; afterBuffer: ArrayBuffer }> = [];
  for (const { beforeFile, afterFile } of pairs) {
    payloads.push({
      beforeName: beforeFile.name,
      afterName: afterFile.name,
      beforeBuffer: await beforeFile.arrayBuffer(),
      afterBuffer: await afterFile.arrayBuffer(),
    });
  }
  const transfer = payloads.flatMap((pair) => [pair.beforeBuffer, pair.afterBuffer]);

  return new Promise<WordWorkerPairResult[]>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent) => {
      if (event.data.type === "progress") {
        onProgress?.(event.data.progress, event.data.message);
        return;
      }
      worker.terminate();
      if (event.data.type === "result") resolve(event.data.result as WordWorkerPairResult[]);
      else reject(new Error(event.data.error?.message || "Word 문서 비교 중 오류가 발생했습니다."));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || "Word 문서 비교를 시작하지 못했습니다."));
    };
    worker.postMessage({
      pairs: payloads,
      options,
    }, transfer);
  });
}
