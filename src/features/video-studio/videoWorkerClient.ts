import type { VideoWorkerOutput, VideoWorkerOutputHandler, VideoWorkerProgress, VideoWorkerRequest, VideoWorkerResult } from "./types";
import type { AppLanguage } from "../../i18n/languages";
import videoProbeWorkerUrl from "./video-probe.worker.ts?worker&url";
import videoProcessorWorkerUrl from "./video.worker.ts?worker&url";
import { localizedVideoWorkerUrl } from "./localizedWorkerUrl";
import { featureMessage, resolveFeatureMessage } from "../../i18n/featureMessages";
import { FEATURE_MESSAGE_TOKEN_PREFIX } from "../../i18n/workerMessages";
import { UserFacingVideoError } from "./videoErrors";

type VideoWorkerInputDescriptor = Omit<VideoWorkerRequest["jobs"][number]["inputs"][number], "file"> & { fileId: string };
interface VideoWorkerStartRequest {
  mode: "batch";
  jobs: Array<{ name: string; mode: "individual" | "concat"; inputs: VideoWorkerInputDescriptor[] }>;
  task: VideoWorkerRequest["task"];
  language: AppLanguage;
  fileLabels: { concatenated: string; passthrough: string; converted: string; animation: string; audio: string };
}

export interface VideoProbeResult {
  duration: number;
  width: number;
  height: number;
  rotation?: number;
  frameRate?: number;
}

const VIDEO_PROBE_TIMEOUT_MS = 60_000;

export function probeVideoMetadata(file: File, signal?: AbortSignal, language: AppLanguage = "ko") {
  const worker = new Worker(localizedVideoWorkerUrl(videoProbeWorkerUrl), { type: "module" });
  return new Promise<VideoProbeResult>((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (!finish()) return;
      reject(new UserFacingVideoError(featureMessage(language, "video.messages.videoWorkerClient.videoMetadataInspectionTimedOut")));
    }, VIDEO_PROBE_TIMEOUT_MS);
    const finish = () => {
      if (settled) return false;
      settled = true;
      window.clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      worker.terminate();
      return true;
    };
    const abort = () => {
      if (!finish()) return;
      reject(new DOMException(featureMessage(language, "video.messages.videoWorkerClient.videoMetadataInspectionWasCanceled"), "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) return abort();
    worker.onmessage = (event: MessageEvent) => {
      if (event.data.type === "progress") return;
      if (!finish()) return;
      if (event.data.type === "result") resolve(event.data.result as VideoProbeResult);
      else reject(new UserFacingVideoError(resolveSafeWorkerMessage(event.data.error, language, "video.messages.videoWorkerClient.unableToReadVideoMetadata")));
    };
    worker.onerror = (event) => {
      if (!finish()) return;
      reject(new UserFacingVideoError(featureMessage(language, "video.messages.videoWorkerClient.unableToStartVideoMetadataInspection")));
    };
    worker.postMessage({ file, language });
  });
}

export function runVideoTask(
  request: VideoWorkerRequest,
  onProgress?: VideoWorkerProgress,
  onOutput?: VideoWorkerOutputHandler,
  signal?: AbortSignal,
  language: AppLanguage = "ko",
) {
    const worker = new Worker(localizedVideoWorkerUrl(videoProcessorWorkerUrl), { type: "module" });
  const inputFiles = new Map<string, File>();
  const startRequest: VideoWorkerStartRequest = {
    mode: request.mode,
    task: request.task,
    language,
    fileLabels: {
      concatenated: featureMessage(language, "video.messages.video.concatenated"),
      passthrough: featureMessage(language, "video.messages.video.passthrough"),
      converted: featureMessage(language, "video.messages.video.converted"),
      animation: featureMessage(language, "video.messages.video.animation"),
      audio: featureMessage(language, "video.messages.video.audio"),
    },
    jobs: request.jobs.map((job, jobIndex) => ({
      name: job.name,
      mode: job.mode,
      inputs: job.inputs.map(({ file, ...input }, inputIndex) => {
        const fileId = `${jobIndex}-${inputIndex}`;
        inputFiles.set(fileId, file);
        return { ...input, fileId };
      }),
    })),
  };
  return new Promise<VideoWorkerResult>((resolve, reject) => {
    let settled = false;
    let started = false;
    let startupTimer: number | undefined;
    const finish = () => {
      if (settled) return false;
      settled = true;
      if (startupTimer !== undefined) window.clearTimeout(startupTimer);
      signal?.removeEventListener("abort", abort);
      inputFiles.clear();
      worker.terminate();
      return true;
    };
    const abort = () => {
      if (!finish()) return;
      reject(new DOMException(featureMessage(language, "video.messages.videoWorkerClient.videoProcessingWasCanceled"), "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as {
        type: "ready" | "request-input-file" | "progress" | "output" | "result" | "error";
        fileId?: string;
        fileName?: string;
        progress?: number;
        message?: string;
        output?: VideoWorkerOutput;
        result?: VideoWorkerResult;
        error?: { message?: string; code?: string };
      };
      if (data.type === "ready") {
        if (started || settled) return;
        started = true;
        if (startupTimer !== undefined) window.clearTimeout(startupTimer);
        onProgress?.(1, featureMessage(language, "video.messages.videoWorkerClient.videoWorkspaceReadySendingTheJobList"));
        window.setTimeout(() => {
          if (settled) return;
          try {
            worker.postMessage({ type: "start", request: startRequest });
          } catch (error) {
            if (finish()) reject(new UserFacingVideoError(featureMessage(language, "video.messages.videoWorkerClient.unableToSendTheVideoJobListTo")));
          }
        }, 0);
        return;
      }
      if (data.type === "request-input-file") {
        const file = data.fileId ? inputFiles.get(data.fileId) : undefined;
        if (!file) {
          if (finish()) reject(new UserFacingVideoError(featureMessage(language, "video.messages.videoWorkerClient.theBrowserFileReferenceForIsUnavailableSelect", { p0: data.fileName || featureMessage(language, "video.messages.videoWorkerClient.originalVideo") })));
          return;
        }
        try {
          worker.postMessage({ type: "input-file", fileId: data.fileId, file });
        } catch (error) {
          if (finish()) reject(new UserFacingVideoError(featureMessage(language, "video.messages.videoWorkerClient.unableToSendTheFileReferenceToThe", { p0: file.name })));
        }
        return;
      }
      if (data.type === "progress") {
        onProgress?.(data.progress ?? 0, resolveSafeWorkerMessage(data.message, language, "video.messages.videoWorkerClient.processingVideo"));
        return;
      }
      if (data.type === "output") {
        if (data.output) onOutput?.(data.output);
        return;
      }
      if (!finish()) return;
      if (data.type === "result") {
        const result = data.result as VideoWorkerResult;
        resolve({ ...result, warnings: result.warnings.map((warning) => resolveFeatureMessage(language, warning)) });
      } else reject(new UserFacingVideoError(resolveSafeWorkerMessage(data.error?.message, language, "video.messages.videoWorkerClient.anErrorOccurredWhileProcessingTheVideo"), data.error?.code));
    };
    worker.onerror = (event) => {
      if (!finish()) return;
      reject(new UserFacingVideoError(featureMessage(language, "video.messages.videoWorkerClient.unableToStartVideoProcessing")));
    };
    startupTimer = window.setTimeout(() => {
      if (!finish()) return;
      reject(new UserFacingVideoError(featureMessage(language, "video.messages.videoWorkerClient.theVideoWorkspaceDidNotStartWithin30")));
    }, 30_000);
  });
}

function resolveSafeWorkerMessage(message: string | undefined, language: AppLanguage, fallbackKey: string) {
  return message?.startsWith(FEATURE_MESSAGE_TOKEN_PREFIX)
    ? resolveFeatureMessage(language, message)
    : featureMessage(language, fallbackKey);
}
