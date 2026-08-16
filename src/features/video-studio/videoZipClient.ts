import type { VideoWorkerProgress } from "./types";
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

export interface VideoZipResult {
  buffer: ArrayBuffer;
  fileName: string;
  mimeType: string;
}

export function createVideoZip(files: VideoZipSource[], onProgress?: VideoWorkerProgress, signal?: AbortSignal, language: AppLanguage = "ko") {
    const worker = new Worker(localizedVideoWorkerUrl(videoZipWorkerUrl), { type: "module" });
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
      reject(new DOMException(featureMessage(language, "video.messages.videoZipClient.zipCreationWasCanceled"), "AbortError"));
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
        onProgress?.(data.progress ?? 0, data.message?.startsWith(FEATURE_MESSAGE_TOKEN_PREFIX) ? resolveFeatureMessage(language, data.message) : featureMessage(language, "video.messages.videoZipClient.creatingZipFile"));
        return;
      }
      if (!finish()) return;
      if (data.type === "result") resolve(data.result as VideoZipResult);
      else reject(new UserFacingVideoError(data.error?.startsWith(FEATURE_MESSAGE_TOKEN_PREFIX) ? resolveFeatureMessage(language, data.error) : featureMessage(language, "video.messages.videoZipClient.unableToCreateTheZipFile")));
    };
    worker.onerror = (event) => {
      if (!finish()) return;
      reject(new UserFacingVideoError(featureMessage(language, "video.messages.videoZipClient.unableToStartTheZipWorker")));
    };
    worker.postMessage({ files, language, archiveName: featureMessage(language, "video.messages.videoZip.worklazyVideoResultsZip", { p0: files.length }) });
  });
}
