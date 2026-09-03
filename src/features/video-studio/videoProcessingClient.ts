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
  preflightVideoHybridJob,
  preflightVideoWebCodecsJob,
  runVideoHybridJob,
  runVideoStreamCopyJob,
  runVideoWebCodecsJob,
  VideoStreamingStageError,
} from "./videoStreamWorkerClient";
import { runFfmpegVideoTask } from "./videoWorkerClient";
import type { VideoStreamCopyReasonCode } from "./videoStreamCopy";
import type { VideoWebCodecsReasonCode } from "./videoWebCodecs";
import type { VideoHybridReasonCode } from "./videoWebCodecs";
import { runHybridAudioFfmpeg } from "./videoHybridAudioClient";
import { estimateHybridAudioBytes, parseHybridAudioBitrate } from "./videoHybridAudio";
import { estimateVideoJobDuration, estimateVideoJobOutputBytes, taskForVideoJob } from "./videoOutputEstimate";

export { estimateVideoJobDuration, estimateVideoJobOutputBytes, taskForVideoJob } from "./videoOutputEstimate";

export type VideoProcessingProbeDetail =
  | { operation: "stream-copy"; audioMode: "copy" | "remove"; reasonCode: VideoStreamCopyReasonCode }
  | { operation: "webcodecs"; reasonCode: VideoWebCodecsReasonCode }
  | { operation: "hybrid"; reasonCode: VideoHybridReasonCode };

export interface VideoProcessingJobRoute {
  jobIndex: number;
  durationSeconds: number;
  estimatedOutputBytes: number;
  decision: VideoRouteDecision;
  probeDetails: VideoProcessingProbeDetail[];
  audioRemovalSuggested: boolean;
}

export interface VideoProcessingPreflight {
  jobs: VideoProcessingJobRoute[];
}

export interface VideoProcessingPreflightOptions {
  opfsAvailable?: boolean;
  estimateQuota?: (requiredBytes: number) => Promise<VideoStorageQuotaState>;
  probeStreamCopyJob?: typeof preflightVideoStreamCopyJob;
  probeWebCodecsJob?: typeof preflightVideoWebCodecsJob;
  probeHybridJob?: typeof preflightVideoHybridJob;
}

export async function preflightVideoProcessingRoutes(
  request: VideoWorkerRequest,
  options: VideoProcessingPreflightOptions = {},
): Promise<VideoProcessingPreflight> {
  const opfsAvailable = options.opfsAvailable ?? browserOpfsAvailable();
  const estimateQuota = options.estimateQuota ?? estimateVideoStorageQuota;
  const probeStreamCopyJob = options.probeStreamCopyJob ?? preflightVideoStreamCopyJob;
  const probeWebCodecsJob = options.probeWebCodecsJob ?? preflightVideoWebCodecsJob;
  const probeHybridJob = options.probeHybridJob ?? preflightVideoHybridJob;
  const jobs: VideoProcessingJobRoute[] = [];
  for (let jobIndex = 0; jobIndex < request.jobs.length; jobIndex += 1) {
    const job = request.jobs[jobIndex];
    const jobTask = taskForVideoJob(request.task, job);
    const durationSeconds = estimateVideoJobDuration(job);
    let estimatedOutputBytes = estimateVideoJobOutputBytes(job, jobTask);
    if (jobTask.kind !== "encode") {
      jobs.push({ jobIndex, durationSeconds, estimatedOutputBytes, decision: decideFfmpegOnlyRoute(estimatedOutputBytes), probeDetails: [], audioRemovalSuggested: false });
      continue;
    }
    const routeInput = {
      container: jobTask.container,
      codec: jobTask.bitrate === "copy" ? "h264" as const : jobTask.codec,
      bitrateMode: videoBitrateMode(jobTask),
      audioMode: jobTask.audioMode,
      opfsAvailable,
      quota: "enough" as const,
      estimatedOutputBytes,
    };
    let decision = decideVideoProcessingRoute(routeInput);
    const probeDetails: VideoProcessingProbeDetail[] = [];
    let audioRemovalSuggested = false;
    let streamCopyCompatible: boolean | undefined;
    let webCodecsCompatible: boolean | undefined;
    let hybridCompatible: boolean | undefined;
    if (decision.reasonCode === "STREAM_COPY_PENDING") {
      let probe;
      try {
        probe = await probeStreamCopyJob(job, jobTask.audioMode);
      } catch {
        probe = { compatible: false as const, reasonCode: "NOT_ISO_BMFF" as const };
      }
      probeDetails.push({ operation: "stream-copy", audioMode: jobTask.audioMode === "remove" ? "remove" : "copy", reasonCode: probe.reasonCode });
      streamCopyCompatible = probe.compatible;
      routeInput.codec = probe.codec ?? routeInput.codec;
      if (!probe.compatible && jobTask.audioMode === "copy") {
        try {
          const withoutAudio = await probeStreamCopyJob(job, "remove");
          probeDetails.push({ operation: "stream-copy", audioMode: "remove", reasonCode: withoutAudio.reasonCode });
          audioRemovalSuggested = withoutAudio.compatible;
        } catch {
          audioRemovalSuggested = false;
        }
      }
    }
    if (decision.reasonCode === "WEBCODECS_PENDING") {
      let probe;
      try {
        probe = await probeWebCodecsJob(job, jobTask);
      } catch {
        probe = { compatible: false as const, reasonCode: "INPUT_UNSUPPORTED" as const };
      }
      probeDetails.push({ operation: "webcodecs", reasonCode: probe.reasonCode });
      webCodecsCompatible = probe.compatible;
      estimatedOutputBytes = estimateVideoJobOutputBytes(job, jobTask, probe.sourceAudioBitratesBps);
      if (!probe.compatible && jobTask.audioMode === "encode") {
        try {
          const hybridProbe = await probeHybridJob(job, jobTask);
          hybridCompatible = hybridProbe.compatible;
          probeDetails.push({ operation: "hybrid", reasonCode: hybridProbe.reasonCode });
          estimatedOutputBytes = estimateVideoJobOutputBytes(job, jobTask, hybridProbe.sourceAudioBitratesBps);
        } catch {
          hybridCompatible = false;
        }
      }
    }
    const quota = opfsAvailable ? await safeQuotaEstimate(estimateQuota, estimatedOutputBytes) : "unknown";
    decision = decideVideoProcessingRoute({
      ...routeInput,
      quota,
      estimatedOutputBytes,
      streamCopyCompatible,
      webCodecsCompatible,
      hybridCompatible,
    });
    jobs.push({
      jobIndex,
      durationSeconds,
      estimatedOutputBytes,
      decision,
      probeDetails,
      audioRemovalSuggested,
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
      const jobTask = taskForVideoJob(request.task, job);
      const subRequest = { ...request, jobs: [job], task: jobTask };
      if (routeJob.decision.route === "stream-copy" && jobTask.kind === "encode") {
        progress.reportJobStage(routeJob.jobIndex, "decode", 1, 1, featureMessage(language, "video.messages.video.copyingWithoutChangingPictureQuality"));
        progress.reportJobStage(routeJob.jobIndex, "encode", 1, 1, featureMessage(language, "video.messages.video.copyingWithoutChangingPictureQuality"));
        try {
          const result = await runVideoStreamCopyJob(
            job,
            jobTask,
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
          const failureStage = error instanceof VideoStreamingStageError ? error.stage : "mux-write";
          if (routeJob.decision.failureFallbacks[failureStage].route === "reject") {
            throw new UserFacingVideoError(featureMessage(language, "video.messages.videoWorkerClient.largePassthroughCouldNotBeCompletedSafely"));
          }
        }
      }
      if (routeJob.decision.route === "hybrid" && jobTask.kind === "encode") {
        const audioExpectedBytes = estimateHybridAudioBytes(parseHybridAudioBitrate(jobTask.audioBitrate), routeJob.durationSeconds);
        let audioBuffer: ArrayBuffer;
        try {
          const audio = await runHybridAudioFfmpeg(
            job,
            jobTask,
            audioExpectedBytes,
            (completed, total) => progress.reportJobStage(
              routeJob.jobIndex,
              "audio",
              completed,
              total,
              featureMessage(language, "video.messages.video.preparingAudioForVideo"),
            ),
            signal,
            language,
          );
          audioBuffer = audio.buffer;
          progress.reportJobStage(routeJob.jobIndex, "audio", 1, 1, featureMessage(language, "video.messages.video.audioReadyForVideo"));
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") throw error;
          if (routeJob.decision.failureFallbacks.audio.route === "reject") {
            throw new UserFacingVideoError(featureMessage(language, "video.messages.videoWorkerClient.largeStreamingEncodeCouldNotBeCompletedSafely"));
          }
          const result = await runFfmpegVideoTask(subRequest, (value, message) => progress.reportJobOverall(routeJob.jobIndex, value, message), onOutput, signal, language);
          outputCounts.push(result.outputCount);
          continue;
        }
        try {
          const result = await runVideoHybridJob(
            job,
            jobTask,
            audioBuffer,
            request.resultStorage,
            routeJob.estimatedOutputBytes,
            (stage, completedUnits, totalUnits, message) => progress.reportJobStage(routeJob.jobIndex, stage, completedUnits, totalUnits, message),
            onOutput,
            signal,
            language,
          );
          outputCounts.push(result.outputCount);
          progress.reportJobOverall(routeJob.jobIndex, 100, featureMessage(language, "video.messages.video.resultReadyCheckingTheNextJob", { p0: routeJob.jobIndex + 1, p1: routePlan.jobs.length }));
          continue;
        } catch (error) {
          audioBuffer = new ArrayBuffer(0);
          if (error instanceof DOMException && error.name === "AbortError") throw error;
          const failureStage = error instanceof VideoStreamingStageError ? error.stage : "video-codec";
          if (routeJob.decision.failureFallbacks[failureStage].route === "reject") {
            throw new UserFacingVideoError(featureMessage(language, "video.messages.videoWorkerClient.largeStreamingEncodeCouldNotBeCompletedSafely"));
          }
        }
      }
      if (routeJob.decision.route === "webcodecs" && jobTask.kind === "encode") {
        try {
          const result = await runVideoWebCodecsJob(
            job,
            jobTask,
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
          const failureStage = error instanceof VideoStreamingStageError ? error.stage : "video-codec";
          if (routeJob.decision.failureFallbacks[failureStage].route === "reject") {
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
