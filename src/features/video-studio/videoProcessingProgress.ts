import type { VideoWorkerProgress } from "./types";
import type { VideoProcessingRoute } from "./videoRouting";

export const VIDEO_PROGRESS_STAGES = ["audio", "demux", "decode", "encode", "mux", "write"] as const;
export type VideoProgressStage = typeof VIDEO_PROGRESS_STAGES[number];

export const VIDEO_PROGRESS_STAGE_WEIGHTS: Readonly<Record<VideoProgressStage, number>> = {
  audio: 0.15,
  demux: 0.08,
  decode: 0.2,
  encode: 0.35,
  mux: 0.12,
  write: 0.1,
};

export interface VideoProcessingProgressController {
  reportOverall: VideoWorkerProgress;
  reportStage: (stage: VideoProgressStage, progress: number, message: string) => void;
  reportJobStage: (jobIndex: number, stage: VideoProgressStage, completedUnits: number, totalUnits: number, message: string) => void;
  reportJobOverall: (jobIndex: number, progress: number, message: string) => void;
  terminate: () => void;
  current: () => number;
}

export interface VideoProgressJobWeight {
  durationSeconds: number;
  expectedOutputBytes: number;
  route: VideoProcessingRoute;
}

export function createVideoProcessingProgressController(
  onProgress?: VideoWorkerProgress,
  jobWeights: readonly VideoProgressJobWeight[] = [],
): VideoProcessingProgressController {
  let currentProgress = 0;
  let terminal = false;
  const stageProgress = Object.fromEntries(VIDEO_PROGRESS_STAGES.map((stage) => [stage, 0])) as Record<VideoProgressStage, number>;
  const jobStageProgress = VIDEO_PROGRESS_STAGES.map(() => jobWeights.map(() => 0));
  const activeWeights = jobWeights.map((job) => videoProgressStageWeightsForRoute(job.route));
  const reportJobProgress = (jobIndex: number, message: string, stageKey: string) => {
    const overall = VIDEO_PROGRESS_STAGES.reduce((total, stage, stageIndex) => {
      const weights = jobWeights.map((job) => stage === "write" ? job.expectedOutputBytes : job.durationSeconds);
      const contributions = jobStageProgress[stageIndex].map((value, index) => value * activeWeights[index][stage]);
      return total + weightedAverage(contributions, weights);
    }, 0) * 100;
    reportOverall(overall, message, stageKey);
  };
  const reportOverall: VideoWorkerProgress = (progress, message, stageKey) => {
    if (terminal) return;
    const nextProgress = normalizeProgress(progress);
    currentProgress = Math.max(currentProgress, nextProgress);
    onProgress?.(currentProgress, message, stageKey);
  };
  return {
    reportOverall,
    reportStage: (stage, progress, message) => {
      const ratio = normalizeProgress(progress) / 100;
      stageProgress[stage] = ratio;
      if (jobWeights.length) {
        const stageIndex = VIDEO_PROGRESS_STAGES.indexOf(stage);
        jobStageProgress[stageIndex].fill(ratio);
        reportJobProgress(-1, message, `video:${stage}`);
      } else {
        reportOverall(weightedStageProgress(stageProgress), message, `video:${stage}`);
      }
    },
    reportJobStage: (jobIndex, stage, completedUnits, totalUnits, message) => {
      if (!jobWeights[jobIndex]) return;
      const stageIndex = VIDEO_PROGRESS_STAGES.indexOf(stage);
      jobStageProgress[stageIndex][jobIndex] = unitRatio(completedUnits, totalUnits);
      reportJobProgress(jobIndex, message, `video:${jobIndex}:${stage}`);
    },
    reportJobOverall: (jobIndex, progress, message) => {
      if (!jobWeights[jobIndex]) return;
      const ratio = normalizeProgress(progress) / 100;
      let consumed = 0;
      VIDEO_PROGRESS_STAGES.forEach((stage, stageIndex) => {
        const weight = activeWeights[jobIndex][stage];
        jobStageProgress[stageIndex][jobIndex] = weight > 0
          ? Math.max(0, Math.min(1, (ratio - consumed) / weight))
          : 0;
        consumed += weight;
      });
      reportJobProgress(jobIndex, message, `video:${jobIndex}:overall`);
    },
    terminate: () => { terminal = true; },
    current: () => currentProgress,
  };
}

export function videoProgressStageWeightsForRoute(route: VideoProcessingRoute) {
  if (route === "hybrid" || route === "ffmpeg") return VIDEO_PROGRESS_STAGE_WEIGHTS;
  const activeTotal = 1 - VIDEO_PROGRESS_STAGE_WEIGHTS.audio;
  return Object.fromEntries(VIDEO_PROGRESS_STAGES.map((stage) => [
    stage,
    stage === "audio" ? 0 : VIDEO_PROGRESS_STAGE_WEIGHTS[stage] / activeTotal,
  ])) as Record<VideoProgressStage, number>;
}

function normalizeProgress(progress: number) {
  return Number.isFinite(progress) ? Math.max(0, Math.min(100, Math.round(progress))) : 0;
}

function weightedStageProgress(progress: Readonly<Record<VideoProgressStage, number>>) {
  return VIDEO_PROGRESS_STAGES.reduce((total, stage) => (
    total + VIDEO_PROGRESS_STAGE_WEIGHTS[stage] * progress[stage]
  ), 0) * 100;
}

function unitRatio(completedUnits: number, totalUnits: number) {
  if (!Number.isFinite(completedUnits) || !Number.isFinite(totalUnits) || totalUnits <= 0) return 0;
  return Math.max(0, Math.min(1, completedUnits / totalUnits));
}

function weightedAverage(values: readonly number[], rawWeights: readonly number[]) {
  const weights = rawWeights.map((weight) => Number.isFinite(weight) && weight > 0 ? weight : 0);
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  if (totalWeight <= 0) return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
  return values.reduce((total, value, index) => total + value * weights[index], 0) / totalWeight;
}
