import type { AppLanguage } from "../../i18n/languages";
import { featureMessage, resolveFeatureMessage } from "../../i18n/featureMessages";
import { FEATURE_MESSAGE_TOKEN_PREFIX } from "../../i18n/workerMessages";
import type { VideoProgressStage } from "./videoProcessingProgress";
import type { VideoStreamCopyMetrics, VideoStreamCopyProbeResult } from "./videoStreamCopy";
import type { VideoWebCodecsMetrics, VideoWebCodecsProbeResult } from "./videoWebCodecs";
import type {
  VideoAudioMode,
  VideoOutputJob,
  VideoWorkerOutput,
  VideoWorkerOutputHandler,
  VideoWorkerRequest,
  VideoWorkerResult,
} from "./types";
import { localizedVideoWorkerUrl } from "./localizedWorkerUrl";
import { UserFacingVideoError } from "./videoErrors";
import { VideoOutputQueue } from "./videoOutputQueue";
import videoStreamWorkerUrl from "./videoStream.worker.ts?worker&url";

type VideoStreamInputDescriptor = Omit<VideoOutputJob["inputs"][number], "file"> & { fileId: string };
type VideoStreamJobDescriptor = Omit<VideoOutputJob, "inputs"> & { inputs: VideoStreamInputDescriptor[] };

interface VideoStreamWorkerRequestBase {
  job: VideoStreamJobDescriptor;
  language: AppLanguage;
}

type VideoStreamPreflightRequest = VideoStreamWorkerRequestBase & (
  | { operation: "stream-copy"; audioMode: VideoAudioMode }
  | { operation: "webcodecs"; task: Extract<VideoWorkerRequest["task"], { kind: "encode" }> }
);

interface VideoStreamRunRequest extends VideoStreamWorkerRequestBase {
  operation: "stream-copy" | "webcodecs";
  task: Extract<VideoWorkerRequest["task"], { kind: "encode" }>;
  resultStorage: VideoWorkerRequest["resultStorage"];
  estimatedOutputBytes: number;
  fileLabels: { concatenated: string; passthrough: string; converted: string; animation: string; audio: string };
  collectMetrics?: boolean;
}

export interface VideoStreamWorkerResult extends VideoWorkerResult {
  metrics?: VideoStreamCopyMetrics | VideoWebCodecsMetrics;
}

export type VideoStreamWorkerProgress = (
  stage: VideoProgressStage,
  completedUnits: number,
  totalUnits: number,
  message: string,
) => void;

export function preflightVideoStreamCopyJob(
  job: VideoOutputJob,
  audioMode: VideoAudioMode,
  signal?: AbortSignal,
  language: AppLanguage = "ko",
) {
  const prepared = prepareJob(job);
  return runVideoStreamWorker<VideoStreamCopyProbeResult>(
    "preflight",
    { operation: "stream-copy", job: prepared.job, audioMode, language },
    prepared.files,
    undefined,
    undefined,
    signal,
    language,
  );
}

export function preflightVideoWebCodecsJob(
  job: VideoOutputJob,
  task: Extract<VideoWorkerRequest["task"], { kind: "encode" }>,
  signal?: AbortSignal,
  language: AppLanguage = "ko",
) {
  const prepared = prepareJob(job);
  return runVideoStreamWorker<VideoWebCodecsProbeResult>(
    "preflight",
    { operation: "webcodecs", job: prepared.job, task, language },
    prepared.files,
    undefined,
    undefined,
    signal,
    language,
  );
}

export function runVideoStreamCopyJob(
  job: VideoOutputJob,
  task: Extract<VideoWorkerRequest["task"], { kind: "encode" }>,
  resultStorage: VideoWorkerRequest["resultStorage"],
  estimatedOutputBytes: number,
  onProgress?: VideoStreamWorkerProgress,
  onOutput?: VideoWorkerOutputHandler,
  signal?: AbortSignal,
  language: AppLanguage = "ko",
  options: { collectMetrics?: boolean } = {},
) {
  const prepared = prepareJob(job);
  return runVideoStreamWorker<VideoStreamWorkerResult>(
    "start",
    {
      operation: "stream-copy",
      job: prepared.job,
      task,
      resultStorage,
      estimatedOutputBytes,
      collectMetrics: options.collectMetrics,
      language,
      fileLabels: {
        concatenated: featureMessage(language, "video.messages.video.concatenated"),
        passthrough: featureMessage(language, "video.messages.video.passthrough"),
        converted: featureMessage(language, "video.messages.video.converted"),
        animation: featureMessage(language, "video.messages.video.animation"),
        audio: featureMessage(language, "video.messages.video.audio"),
      },
    },
    prepared.files,
    onProgress,
    onOutput,
    signal,
    language,
  );
}

export function runVideoWebCodecsJob(
  job: VideoOutputJob,
  task: Extract<VideoWorkerRequest["task"], { kind: "encode" }>,
  resultStorage: VideoWorkerRequest["resultStorage"],
  estimatedOutputBytes: number,
  onProgress?: VideoStreamWorkerProgress,
  onOutput?: VideoWorkerOutputHandler,
  signal?: AbortSignal,
  language: AppLanguage = "ko",
  options: { collectMetrics?: boolean } = {},
) {
  const prepared = prepareJob(job);
  return runVideoStreamWorker<VideoStreamWorkerResult>(
    "start",
    {
      operation: "webcodecs",
      job: prepared.job,
      task,
      resultStorage,
      estimatedOutputBytes,
      collectMetrics: options.collectMetrics,
      language,
      fileLabels: {
        concatenated: featureMessage(language, "video.messages.video.concatenated"),
        passthrough: featureMessage(language, "video.messages.video.passthrough"),
        converted: featureMessage(language, "video.messages.video.converted"),
        animation: featureMessage(language, "video.messages.video.animation"),
        audio: featureMessage(language, "video.messages.video.audio"),
      },
    },
    prepared.files,
    onProgress,
    onOutput,
    signal,
    language,
  );
}

function prepareJob(job: VideoOutputJob) {
  const files = new Map<string, File>();
  return {
    files,
    job: {
      ...job,
      inputs: job.inputs.map(({ file, ...input }, inputIndex) => {
        const fileId = `stream-input-${inputIndex}`;
        files.set(fileId, file);
        return { ...input, fileId };
      }),
    },
  };
}

function runVideoStreamWorker<Result>(
  mode: "preflight" | "start",
  request: VideoStreamPreflightRequest | VideoStreamRunRequest,
  files: Map<string, File>,
  onProgress: VideoStreamWorkerProgress | undefined,
  onOutput: VideoWorkerOutputHandler | undefined,
  signal: AbortSignal | undefined,
  language: AppLanguage,
) {
  const worker = new Worker(localizedVideoWorkerUrl(videoStreamWorkerUrl), { type: "module" });
  return new Promise<Result>((resolve, reject) => {
    let settled = false;
    let terminal = false;
    let cancelTimeout: number | undefined;
    let abortError: DOMException | undefined;
    const outputHandlers = new VideoOutputQueue();
    const timeout = window.setTimeout(() => {
      if (finish()) reject(new UserFacingVideoError(featureMessage(language, "video.messages.videoWorkerClient.theVideoWorkspaceDidNotStartWithin30")));
    }, 60_000);
    const finish = () => {
      if (settled) return false;
      settled = true;
      window.clearTimeout(timeout);
      if (cancelTimeout !== undefined) window.clearTimeout(cancelTimeout);
      signal?.removeEventListener("abort", abort);
      files.clear();
      worker.terminate();
      return true;
    };
    const rejectAfterOutputs = (error: unknown) => {
      void outputHandlers.wait().then(() => { if (finish()) reject(error); }, () => { if (finish()) reject(error); });
    };
    const abort = () => {
      if (settled) return;
      terminal = true;
      abortError = new DOMException(featureMessage(language, "video.messages.videoWorkerClient.videoProcessingWasCanceled"), "AbortError");
      try {
        worker.postMessage({ type: "cancel" });
        cancelTimeout = window.setTimeout(() => rejectAfterOutputs(abortError), 5_000);
      } catch {
        rejectAfterOutputs(abortError);
      }
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) return abort();

    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as {
        type: "ready" | "request-input-file" | "progress" | "output" | "preflight-result" | "result" | "canceled" | "error";
        fileId?: string;
        fileName?: string;
        stage?: VideoProgressStage;
        completedUnits?: number;
        totalUnits?: number;
        message?: string;
        output?: VideoWorkerOutput;
        probe?: VideoStreamCopyProbeResult;
        result?: VideoStreamWorkerResult;
      };
      if (data.type === "ready") {
        if (terminal || settled) return;
        window.clearTimeout(timeout);
        try {
          worker.postMessage({ type: mode, request });
        } catch {
          rejectAfterOutputs(new UserFacingVideoError(featureMessage(language, "video.messages.videoWorkerClient.unableToSendTheVideoJobListTo")));
        }
        return;
      }
      if (data.type === "request-input-file") {
        if (terminal || settled) return;
        const file = data.fileId ? files.get(data.fileId) : undefined;
        if (!file) {
          terminal = true;
          rejectAfterOutputs(new UserFacingVideoError(featureMessage(language, "video.messages.videoWorkerClient.theBrowserFileReferenceForIsUnavailableSelect", { p0: data.fileName || featureMessage(language, "video.messages.videoWorkerClient.originalVideo") })));
          return;
        }
        worker.postMessage({ type: "input-file", fileId: data.fileId, file });
        return;
      }
      if (data.type === "progress") {
        if (!terminal && data.stage) onProgress?.(
          data.stage,
          data.completedUnits ?? 0,
          data.totalUnits ?? 1,
          resolveSafeMessage(data.message, language, "video.messages.videoWorkerClient.processingVideo"),
        );
        return;
      }
      if (data.type === "output" && data.output) {
        if (terminal || settled) return;
        const pending = outputHandlers.enqueue(() => onOutput?.(data.output!));
        void pending.catch(() => rejectAfterOutputs(new UserFacingVideoError(featureMessage(language, "video.messages.videoWorkerClient.unableToStoreTheCompletedVideoResult"))));
        return;
      }
      if (data.type === "canceled") {
        rejectAfterOutputs(abortError || new DOMException(featureMessage(language, "video.messages.videoWorkerClient.videoProcessingWasCanceled"), "AbortError"));
        return;
      }
      if (terminal || settled) return;
      terminal = true;
      if (data.type === "preflight-result") {
        if (finish()) resolve(data.probe as Result);
      } else if (data.type === "result") {
        void outputHandlers.wait().then(() => {
          if (!finish()) return;
          const result = data.result as VideoStreamWorkerResult;
          resolve({ ...result, warnings: result.warnings.map((warning) => resolveFeatureMessage(language, warning)) } as Result);
        }, () => rejectAfterOutputs(new UserFacingVideoError(featureMessage(language, "video.messages.videoWorkerClient.unableToStoreTheCompletedVideoResult"))));
      } else {
        rejectAfterOutputs(new UserFacingVideoError(featureMessage(language, "video.messages.videoWorkerClient.anErrorOccurredWhileProcessingTheVideo")));
      }
    };
    worker.onerror = () => {
      if (terminal || settled) return;
      terminal = true;
      rejectAfterOutputs(new UserFacingVideoError(featureMessage(language, "video.messages.videoWorkerClient.unableToStartVideoProcessing")));
    };
  });
}

function resolveSafeMessage(message: string | undefined, language: AppLanguage, fallbackKey: string) {
  return message?.startsWith(FEATURE_MESSAGE_TOKEN_PREFIX)
    ? resolveFeatureMessage(language, message)
    : featureMessage(language, fallbackKey);
}

export type { VideoStreamInputDescriptor, VideoStreamJobDescriptor, VideoStreamPreflightRequest, VideoStreamRunRequest };
