import type { VideoWorkerProgress, VideoWorkerRequest, VideoWorkerResult } from "./types";

export interface VideoProbeResult {
  duration: number;
  width: number;
  height: number;
}

export function probeVideoMetadata(file: File, signal?: AbortSignal) {
  const worker = new Worker(new URL("./video-probe.worker.ts", import.meta.url), { type: "module" });
  return new Promise<VideoProbeResult>((resolve, reject) => {
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
      reject(new DOMException("영상 정보 확인을 취소했습니다.", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) return abort();
    worker.onmessage = (event: MessageEvent) => {
      if (event.data.type === "progress") return;
      if (!finish()) return;
      if (event.data.type === "result") resolve(event.data.result as VideoProbeResult);
      else reject(new Error(event.data.error || "영상 정보를 확인하지 못했습니다."));
    };
    worker.onerror = (event) => {
      if (!finish()) return;
      reject(new Error(event.message || "영상 정보 확인을 시작하지 못했습니다."));
    };
    worker.postMessage({ file });
  });
}

export function runVideoTask(request: VideoWorkerRequest, onProgress?: VideoWorkerProgress, signal?: AbortSignal) {
  const worker = new Worker(new URL("./video.worker.ts", import.meta.url), { type: "module" });
  return new Promise<VideoWorkerResult>((resolve, reject) => {
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
      reject(new DOMException("비디오 작업이 취소되었습니다.", "AbortError"));
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
        result?: VideoWorkerResult;
        error?: { message?: string; code?: string };
      };
      if (data.type === "progress") {
        onProgress?.(data.progress ?? 0, data.message ?? "비디오 처리 중…");
        return;
      }
      if (!finish()) return;
      if (data.type === "result") resolve(data.result as VideoWorkerResult);
      else reject(Object.assign(new Error(data.error?.message || "비디오 처리 중 오류가 발생했습니다."), { code: data.error?.code }));
    };
    worker.onerror = (event) => {
      if (!finish()) return;
      reject(new Error(event.message || "비디오 작업을 시작하지 못했습니다."));
    };
    // File/Blob is structured-cloned as a browser-backed handle. Do not turn it
    // into an ArrayBuffer here: multi-GB sources would require one contiguous
    // JavaScript allocation before FFmpeg even starts.
    worker.postMessage(request);
  });
}
