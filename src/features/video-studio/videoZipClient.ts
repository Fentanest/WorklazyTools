import type { VideoWorkerProgress } from "./types";

export interface VideoZipSource {
  fileName: string;
  blob: Blob;
}

export interface VideoZipResult {
  buffer: ArrayBuffer;
  fileName: string;
  mimeType: string;
}

export function createVideoZip(files: VideoZipSource[], onProgress?: VideoWorkerProgress, signal?: AbortSignal) {
  const worker = new Worker(new URL("./video-zip.worker.ts", import.meta.url), { type: "module" });
  return new Promise<VideoZipResult>((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return false;
      settled = true;
      signal?.removeEventListener("abort", abort);
      worker.terminate();
      return true;
    };
    const abort = () => {
      if (!finish()) return;
      reject(new DOMException("ZIP 만들기를 취소했습니다.", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as {
        type: "progress" | "result" | "error";
        progress?: number;
        message?: string;
        result?: VideoZipResult;
        error?: string;
      };
      if (data.type === "progress") {
        onProgress?.(data.progress ?? 0, data.message ?? "ZIP 파일 만드는 중…");
        return;
      }
      if (!finish()) return;
      if (data.type === "result") resolve(data.result as VideoZipResult);
      else reject(new Error(data.error || "ZIP 파일을 만들지 못했습니다."));
    };
    worker.onerror = (event) => {
      if (!finish()) return;
      reject(new Error(event.message || "ZIP Worker를 시작하지 못했습니다."));
    };
    worker.postMessage({ files });
  });
}
