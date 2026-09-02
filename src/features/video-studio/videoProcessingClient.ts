import type { AppLanguage } from "../../i18n/languages";
import type {
  VideoOutputJob,
  VideoTask,
  VideoWorkerOutputHandler,
  VideoWorkerProgress,
  VideoWorkerRequest,
} from "./types";
import { createVideoProcessingProgressController } from "./videoProcessingProgress";
import {
  decideFfmpegOnlyRoute,
  decideVideoProcessingRoute,
  type VideoRouteDecision,
} from "./videoRouting";
import { estimateVideoStorageQuota, type VideoStorageQuotaState } from "./videoResultStorage";
import { runFfmpegVideoTask } from "./videoWorkerClient";

export interface VideoProcessingJobRoute {
  jobIndex: number;
  durationSeconds: number;
  estimatedOutputBytes: number;
  decision: VideoRouteDecision;
}

export interface VideoProcessingPreflight {
  jobs: VideoProcessingJobRoute[];
}

export interface VideoProcessingPreflightOptions {
  opfsAvailable?: boolean;
  estimateQuota?: (requiredBytes: number) => Promise<VideoStorageQuotaState>;
}

export async function preflightVideoProcessingRoutes(
  request: VideoWorkerRequest,
  options: VideoProcessingPreflightOptions = {},
): Promise<VideoProcessingPreflight> {
  const opfsAvailable = options.opfsAvailable ?? browserOpfsAvailable();
  const estimateQuota = options.estimateQuota ?? estimateVideoStorageQuota;
  const jobs = await Promise.all(request.jobs.map(async (job, jobIndex) => {
    const durationSeconds = estimateVideoJobDuration(job);
    const estimatedOutputBytes = estimateVideoJobOutputBytes(job);
    if (request.task.kind !== "encode") {
      return { jobIndex, durationSeconds, estimatedOutputBytes, decision: decideFfmpegOnlyRoute(estimatedOutputBytes) };
    }
    const quota = opfsAvailable ? await safeQuotaEstimate(estimateQuota, estimatedOutputBytes) : "unknown";
    return {
      jobIndex,
      durationSeconds,
      estimatedOutputBytes,
      decision: decideVideoProcessingRoute({
        container: request.task.container,
        codec: request.task.codec,
        bitrateMode: videoBitrateMode(request.task),
        audioMode: request.task.audioMode,
        opfsAvailable,
        quota,
        estimatedOutputBytes,
      }),
    };
  }));
  return { jobs };
}

export async function runVideoProcessingTask(
  request: VideoWorkerRequest,
  onProgress?: VideoWorkerProgress,
  onOutput?: VideoWorkerOutputHandler,
  signal?: AbortSignal,
  language: AppLanguage = "ko",
  preflight?: VideoProcessingPreflight,
) {
  const routePlan = preflight?.jobs.length === request.jobs.length
    ? preflight
    : await preflightVideoProcessingRoutes(request);
  const progress = createVideoProcessingProgressController(onProgress, routePlan.jobs.map((job) => ({
    durationSeconds: job.durationSeconds,
    expectedOutputBytes: job.estimatedOutputBytes,
  })));
  try {
    // B4 establishes job-level ownership here. B2/B3 will dispatch their eligible jobs from this table.
    if (routePlan.jobs.some(({ decision }) => decision.route !== "ffmpeg")) {
      throw new Error("Unsupported video processing route");
    }
    return await runFfmpegVideoTask(request, progress.reportOverall, onOutput, signal, language);
  } finally {
    progress.terminate();
  }
}

export function estimateVideoJobOutputBytes(job: VideoOutputJob) {
  return job.inputs.reduce((total, input) => {
    const selectedRatio = input.duration > 0
      ? Math.min(1, Math.max(0, (input.end - input.start) / input.duration))
      : 1;
    return total + input.fileSize * selectedRatio;
  }, 0);
}

export function estimateVideoJobDuration(job: VideoOutputJob) {
  return job.inputs.reduce((total, input) => total + Math.max(0.05, input.end - input.start), 0);
}

function videoBitrateMode(task: Extract<VideoTask, { kind: "encode" }>) {
  if (task.bitrate === "copy") return "copy" as const;
  return task.bitrate === "0" ? "crf" as const : "target" as const;
}

function browserOpfsAvailable() {
  if (typeof navigator === "undefined") return false;
  return typeof (navigator.storage as StorageManager & { getDirectory?: unknown } | undefined)?.getDirectory === "function";
}

async function safeQuotaEstimate(
  estimateQuota: (requiredBytes: number) => Promise<VideoStorageQuotaState>,
  requiredBytes: number,
) {
  try {
    return await estimateQuota(requiredBytes);
  } catch {
    return "unknown" as const;
  }
}
