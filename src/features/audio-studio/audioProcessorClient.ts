import type { AudioProcessorProgress, AudioProcessorRequest, AudioProcessorResult } from "./types";
import { featureMessage, resolveFeatureMessage } from "../../i18n/featureMessages";

const AUDIO_PROGRESS_KEYS = {
  "audio.edit.MUTE": "audio.edit.MUTE", "audio.edit.CUT": "audio.edit.CUT", "audio.edit.COPY": "audio.edit.COPY", "audio.edit.PASTE": "audio.edit.PASTE", "audio.edit.DELETE": "audio.edit.DELETE", "audio.edit.PREVIEW": "audio.edit.PREVIEW",
  "audio.edit.FADE_IN": "audio.edit.FADE_IN", "audio.edit.FADE_OUT": "audio.edit.FADE_OUT", "audio.edit.GAIN": "audio.edit.GAIN", "audio.edit.NORMALIZE": "audio.edit.NORMALIZE", "audio.edit.TRIM": "audio.edit.TRIM",
  "audio.voice.status.previewing": "audio.voice.status.previewing", "audio.voice.status.applying": "audio.voice.status.applying", "audio.status.exportPrepare": "audio.status.exportPrepare",
} as const;

let sessionWorker: Worker | undefined;
let operationActive = false;

function getSessionWorker() {
  if (!sessionWorker) sessionWorker = new Worker(new URL("./audioProcessor.worker.ts", import.meta.url), { type: "module" });
  return sessionWorker;
}

export function terminateAudioProcessorSession() {
  sessionWorker?.terminate();
  sessionWorker = undefined;
  operationActive = false;
}

export function runAudioProcessor(request: AudioProcessorRequest, onProgress?: AudioProcessorProgress, signal?: AbortSignal) {
  const language = request.language === "en" ? "en" : "ko";
  if (operationActive) return Promise.reject(new Error(featureMessage(language, "audio.client.busy")));
  const worker = getSessionWorker();
  const requestId = globalThis.crypto?.randomUUID?.() || `audio-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  operationActive = true;
  return new Promise<AudioProcessorResult>((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return false;
      settled = true;
      signal?.removeEventListener("abort", abort);
      worker.onmessage = null;
      worker.onerror = null;
      operationActive = false;
      return true;
    };
    const abort = () => {
      if (!finish()) return;
      terminateAudioProcessorSession();
      reject(new DOMException(featureMessage(language, "audio.client.cancelled"), "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as {
        type: "progress" | "result" | "error";
        requestId?: string;
        progress?: number;
        message?: string;
        messageKey?: string;
        result?: AudioProcessorResult;
        error?: string;
      };
      if (data.requestId !== requestId) return;
      if (data.type === "progress") {
        const key = data.messageKey ? AUDIO_PROGRESS_KEYS[data.messageKey as keyof typeof AUDIO_PROGRESS_KEYS] : undefined;
        onProgress?.(data.progress ?? 0, key
          ? featureMessage(language, key, { format: request.command.replace("EXPORT_", "") })
          : data.message ? resolveFeatureMessage(language, data.message) : featureMessage(language, "audio.client.processing"));
        return;
      }
      if (!finish()) return;
      if (data.type === "result") resolve(data.result as AudioProcessorResult);
      else reject(new Error(data.error ? resolveFeatureMessage(language, data.error) : featureMessage(language, "audio.client.failed")));
    };
    worker.onerror = (event) => {
      if (!finish()) return;
      terminateAudioProcessorSession();
      reject(new Error(event.message || featureMessage(language, "audio.client.workerStart")));
    };
    // 입력 Float32Array는 현재 편집 상태와 Undo 기록이 계속 참조하므로
    // 전송(분리)하지 않고 Worker에 구조 복제합니다. 결과 버퍼만 Worker가 전송합니다.
    worker.postMessage({ ...request, requestId });
  });
}
