import type { AppLanguage } from "../../i18n/languages";
import { featureMessage } from "../../i18n/featureMessages";
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
import { UserFacingVideoError } from "./videoErrors";
import { createVideoWorkerResult } from "./videoProcessingShared";
import {
  preflightVideoStreamCopyJob,
  preflightVideoWebCodecsJob,
  runVideoStreamCopyJob,
  runVideoWebCodecsJob,
} from "./videoStreamWorkerClient";
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
  probeStreamCopyJob?: typeof preflightVideoStreamCopyJob;
  probeWebCodecsJob?: typeof preflightVideoWebCodecsJob;
}

export async function preflightVideoProcessingRoutes(
  request: VideoWorkerRequest,
  options: VideoProcessingPreflightOptions = {},
): Promise<VideoProcessingPreflight> {
  const opfsAvailable = options.opfsAvailable ?? browserOpfsAvailable();
  const estimateQuota = options.estimateQuota ?? estimateVideoStorageQuota;
  const probeStreamCopyJob = options.probeStreamCopyJob ?? preflightVideoStreamCopyJob;
  const probeWebCodecsJob = options.probeWebCodecsJob ?? preflightVideoWebCodecsJob;
  const jobs: VideoProcessingJobRoute[] = [];
  for (let jobIndex = 0; jobIndex < request.jobs.length; jobIndex += 1) {
    const job = request.jobs[jobIndex];
    const durationSeconds = estimateVideoJobDuration(job);
    const estimatedOutputBytes = estimateVideoJobOutputBytes(job);
    if (request.task.kind !== "encode") {
      jobs.push({ jobIndex, durationSeconds, estimatedOutputBytes, decision: decideFfmpegOnlyRoute(estimatedOutputBytes) });
      continue;
    }
    const quota = opfsAvailable ? await safeQuotaEstimate(estimateQuota, estimatedOutputBytes) : "unknown";
    const routeInput = {
      container: request.task.container,
      codec: request.task.bitrate === "copy" ? "h264" as const : request.task.codec,
      bitrateMode: videoBitrateMode(request.task),
      audioMode: request.task.audioMode,
      opfsAvailable,
      quota,
      estimatedOutputBytes,
    };
    let decision = decideVideoProcessingRoute(routeInput);
    if (decision.reasonCode === "STREAM_COPY_PENDING") {
      let probe;
      try {
        probe = await probeStreamCopyJob(job, request.task.audioMode);
      } catch {
        probe = { compatible: false as const, reasonCode: "NOT_ISO_BMFF" as const };
      }
      decision = decideVideoProcessingRoute({
        ...routeInput,
        codec: probe.codec ?? routeInput.codec,
        streamCopyCompatible: probe.compatible,
      });
    }
    if (decision.reasonCode === "WEBCODECS_PENDING") {
      let probe;
      try {
        probe = await probeWebCodecsJob(job, request.task);
      } catch {
        probe = { compatible: false as const, reasonCode: "INPUT_UNSUPPORTED" as const };
      }
      decision = decideVideoProcessingRoute({
        ...routeInput,
        webCodecsCompatible: probe.compatible,
      });
    }
    jobs.push({
      jobIndex,
      durationSeconds,
      estimatedOutputBytes,
      decision,
    });
  }
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
  const outputCounts: number[] = [];
  try {
    for (const routeJob of routePlan.jobs) {
      const job = request.jobs[routeJob.jobIndex];
      const subRequest = { ...request, jobs: [job] };
      if (routeJob.decision.route === "stream-copy" && request.task.kind === "encode") {
        progress.reportJobStage(routeJob.jobIndex, "decode", 1, 1, featureMessage(language, "video.messages.video.copyingWithoutChangingPictureQuality"));
        progress.reportJobStage(routeJob.jobIndex, "encode", 1, 1, featureMessage(language, "video.messages.video.copyingWithoutChangingPictureQuality"));
        try {
          const result = await runVideoStreamCopyJob(
            job,
            request.task,
            request.resultStorage,
            routeJob.estimatedOutputBytes,
            (stage, completedUnits, totalUnits, message) => progress.reportJobStage(
              routeJob.jobIndex,
              stage,
              completedUnits,
              totalUnits,
              message,
            ),
            onOutput,
            signal,
            language,
          );
          outputCounts.push(result.outputCount);
          progress.reportJobOverall(routeJob.jobIndex, 100, featureMessage(language, "video.messages.video.resultReadyCheckingTheNextJob", { p0: routeJob.jobIndex + 1, p1: routePlan.jobs.length }));
          continue;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") throw error;
          if (routeJob.decision.streamingFailure.route === "reject") {
            throw new UserFacingVideoError(featureMessage(language, "video.messages.videoWorkerClient.largePassthroughCouldNotBeCompletedSafely"));
          }
        }
      }
      if (routeJob.decision.route === "webcodecs" && request.task.kind === "encode") {
        try {
          const result = await runVideoWebCodecsJob(
            job,
            request.task,
            request.resultStorage,
            routeJob.estimatedOutputBytes,
            (stage, completedUnits, totalUnits, message) => progress.reportJobStage(
              routeJob.jobIndex,
              stage,
              completedUnits,
              totalUnits,
              message,
            ),
            onOutput,
            signal,
            language,
          );
          outputCounts.push(result.outputCount);
          progress.reportJobOverall(routeJob.jobIndex, 100, featureMessage(language, "video.messages.video.resultReadyCheckingTheNextJob", { p0: routeJob.jobIndex + 1, p1: routePlan.jobs.length }));
          continue;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") throw error;
          if (routeJob.decision.streamingFailure.route === "reject") {
            throw new UserFacingVideoError(featureMessage(language, "video.messages.videoWorkerClient.largeStreamingEncodeCouldNotBeCompletedSafely"));
          }
        }
      }
      const result = await runFfmpegVideoTask(
        subRequest,
        (value, message) => progress.reportJobOverall(routeJob.jobIndex, value, message),
        onOutput,
        signal,
        language,
      );
      outputCounts.push(result.outputCount);
      progress.reportJobOverall(routeJob.jobIndex, 100, featureMessage(language, "video.messages.video.resultReadyCheckingTheNextJob", { p0: routeJob.jobIndex + 1, p1: routePlan.jobs.length }));
    }
    return createVideoWorkerResult(outputCounts, request.task, (key, values) => featureMessage(language, key, values));
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
