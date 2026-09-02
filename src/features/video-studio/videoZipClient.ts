import type { VideoResultStorageSession, VideoWorkerOutput, VideoWorkerProgress } from "./types";
import type { AppLanguage } from "../../i18n/languages";
import videoZipWorkerUrl from "./video-zip.worker.ts?worker&url";
import { localizedVideoWorkerUrl } from "./localizedWorkerUrl";
import { featureMessage, resolveFeatureMessage } from "../../i18n/featureMessages";
import { FEATURE_MESSAGE_TOKEN_PREFIX } from "../../i18n/workerMessages";
import { UserFacingVideoError } from "./videoErrors";

export interface VideoZipSource {
  fileName: string;
  blob: Blob;
}

export type VideoZipResult = VideoWorkerOutput;

export function createVideoZip(
  files: VideoZipSource[],
  onProgress?: VideoWorkerProgress,
  signal?: AbortSignal,
  language: AppLanguage = "ko",
  resultStorage?: VideoResultStorageSession,
) {
  const worker = new Worker(localizedVideoWorkerUrl(videoZipWorkerUrl), { type: "module" });
  return new Promise<VideoZipResult>((resolve, reject) => {
    let settled = false;
    let abortRequested = false;
    let cancelTimer: number | undefined;
    const finish = () => {
      if (settled) return false;
      settled = true;
      if (cancelTimer !== undefined) window.clearTimeout(cancelTimer);
      signal?.removeEventListener("abort", abort);
      worker.terminate();
      return true;
    };
    const abort = () => {
      if (settled || abortRequested) return;
      abortRequested = true;
      try {
        worker.postMessage({ type: "cancel" });
        cancelTimer = window.setTimeout(() => {
          if (!finish()) return;
          reject(new DOMException(featureMessage(language, "video.messages.videoZipClient.zipCreationWasCanceled"), "AbortError"));
        }, 5_000);
      } catch {
        if (finish()) reject(new DOMException(featureMessage(language, "video.messages.videoZipClient.zipCreationWasCanceled"), "AbortError"));
      }
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      if (finish()) reject(new DOMException(featureMessage(language, "video.messages.videoZipClient.zipCreationWasCanceled"), "AbortError"));
      return;
    }
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as {
        type: "progress" | "result" | "error" | "canceled";
        progress?: number;
        message?: string;
        result?: VideoZipResult;
        error?: { message?: string; code?: string };
      };
      if (data.type === "progress") {
        onProgress?.(data.progress ?? 0, data.message?.startsWith(FEATURE_MESSAGE_TOKEN_PREFIX) ? resolveFeatureMessage(language, data.message) : featureMessage(language, "video.messages.videoZipClient.creatingZipFile"));
        return;
      }
      if (data.type === "canceled") {
        if (finish()) reject(new DOMException(featureMessage(language, "video.messages.videoZipClient.zipCreationWasCanceled"), "AbortError"));
        return;
      }
      if (!finish()) return;
      if (data.type === "result") resolve(data.result as VideoZipResult);
      else reject(new UserFacingVideoError(data.error?.message?.startsWith(FEATURE_MESSAGE_TOKEN_PREFIX) ? resolveFeatureMessage(language, data.error.message) : featureMessage(language, "video.messages.videoZipClient.unableToCreateTheZipFile"), data.error?.code));
    };
    worker.onerror = (event) => {
      if (!finish()) return;
      reject(abortRequested
        ? new DOMException(featureMessage(language, "video.messages.videoZipClient.zipCreationWasCanceled"), "AbortError")
        : new UserFacingVideoError(featureMessage(language, "video.messages.videoZipClient.unableToStartTheZipWorker")));
    };
    worker.postMessage({
      type: "start",
      files,
      language,
      resultStorage,
      archiveName: featureMessage(language, "video.messages.videoZip.worklazyVideoResultsZip", { p0: files.length }),
    });
  });
}
