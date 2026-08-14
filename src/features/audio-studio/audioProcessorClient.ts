import type { AudioProcessorProgress, AudioProcessorRequest, AudioProcessorResult } from "./types";

export function runAudioProcessor(request: AudioProcessorRequest, onProgress?: AudioProcessorProgress, signal?: AbortSignal) {
  const worker = new Worker(new URL("./audioProcessor.worker.ts", import.meta.url), { type: "module" });
  return new Promise<AudioProcessorResult>((resolve, reject) => {
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
      reject(new DOMException(request.language === "en" ? "The audio operation was cancelled." : "오디오 작업을 취소했습니다.", "AbortError"));
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
        result?: AudioProcessorResult;
        error?: string;
      };
      if (data.type === "progress") {
        onProgress?.(data.progress ?? 0, data.message ?? (request.language === "en" ? "Processing audio…" : "오디오 처리 중…"));
        return;
      }
      if (!finish()) return;
      if (data.type === "result") resolve(data.result as AudioProcessorResult);
      else reject(new Error(data.error || (request.language === "en" ? "Audio processing failed." : "오디오 처리에 실패했습니다.")));
    };
    worker.onerror = (event) => {
      if (!finish()) return;
      reject(new Error(event.message || (request.language === "en" ? "The audio worker could not start." : "오디오 Worker를 시작하지 못했습니다.")));
    };
    // 입력 Float32Array는 현재 편집 상태와 Undo 기록이 계속 참조하므로
    // 전송(분리)하지 않고 Worker에 구조 복제합니다. 결과 버퍼만 Worker가 전송합니다.
    worker.postMessage(request);
  });
}
