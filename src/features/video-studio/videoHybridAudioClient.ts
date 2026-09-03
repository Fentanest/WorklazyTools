import type { AppLanguage } from "../../i18n/languages.ts";
import { featureMessage } from "../../i18n/featureMessages.ts";
import type { VideoOutputJob, VideoTask } from "./types.ts";
import { localizedVideoWorkerUrl } from "./localizedWorkerUrl.ts";
import hybridAudioWorkerUrl from "./videoHybridAudio.worker.ts?worker&url";

export type HybridAudioCancelBranch = "idle" | "forced";

export function runHybridAudioFfmpeg(
  job: VideoOutputJob,
  task: Extract<VideoTask, { kind: "encode" }>,
  expectedBytes: number,
  onProgress?: (completedUnits: number, totalUnits: number) => void,
  signal?: AbortSignal,
  language: AppLanguage = "ko",
) {
  const worker = new Worker(localizedVideoWorkerUrl(hybridAudioWorkerUrl), { type: "module" });
  const files = new Map<string, File>();
  const request = {
    job: {
      inputs: job.inputs.map(({ file, ...input }, index) => {
        const fileId = `hybrid-audio-${index}`;
        files.set(fileId, file);
        return { ...input, fileId };
      }),
    },
    task,
    expectedBytes,
  };
  return new Promise<{ buffer: ArrayBuffer; cancelBranch?: HybridAudioCancelBranch }>((resolve, reject) => {
    let settled = false;
    let cancelRequested = false;
    let cancelTimer: number | undefined;
    const finish = () => {
      if (settled) return false;
      settled = true;
      if (cancelTimer !== undefined) window.clearTimeout(cancelTimer);
      signal?.removeEventListener("abort", abort);
      files.clear();
      worker.terminate();
      return true;
    };
    const canceled = (branch?: HybridAudioCancelBranch) => Object.assign(
      new DOMException(featureMessage(language, "video.messages.videoWorkerClient.videoProcessingWasCanceled"), "AbortError"),
      { cancelBranch: branch },
    );
    const abort = () => {
      if (settled) return;
      cancelRequested = true;
      try {
        worker.postMessage({ type: "cancel" });
        cancelTimer = window.setTimeout(() => { if (finish()) reject(canceled()); }, 5_000);
      } catch {
        if (finish()) reject(canceled());
      }
    };
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as {
        type: "ready" | "request-input-file" | "progress" | "result" | "canceled" | "error";
        fileId?: string;
        buffer?: ArrayBuffer;
        completedUnits?: number;
        totalUnits?: number;
        branch?: HybridAudioCancelBranch;
      };
      if (data.type === "ready") {
        if (!cancelRequested) worker.postMessage({ type: "start", request });
      } else if (data.type === "request-input-file") {
        const file = data.fileId ? files.get(data.fileId) : undefined;
        if (!file) {
          if (finish()) reject(new Error("missing-input"));
        } else {
          worker.postMessage({ type: "input-file", fileId: data.fileId, file });
        }
      } else if (data.type === "progress") {
        onProgress?.(data.completedUnits ?? 0, data.totalUnits ?? 1);
      } else if (data.type === "result" && data.buffer) {
        if (finish()) resolve({ buffer: data.buffer });
      } else if (data.type === "canceled") {
        if (finish()) reject(canceled(data.branch));
      } else if (data.type === "error") {
        if (finish()) reject(new Error("hybrid-audio-failed"));
      }
    };
    worker.onerror = () => { if (finish()) reject(new Error("hybrid-audio-worker-failed")); };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
}
