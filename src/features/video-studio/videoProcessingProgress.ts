import type { VideoWorkerProgress } from "./types";

export const VIDEO_PROGRESS_STAGES = ["demux", "decode", "encode", "mux", "write"] as const;
export type VideoProgressStage = typeof VIDEO_PROGRESS_STAGES[number];

export const VIDEO_PROGRESS_STAGE_WEIGHTS: Readonly<Record<VideoProgressStage, number>> = {
  demux: 0.1,
  decode: 0.25,
  encode: 0.4,
  mux: 0.15,
  write: 0.1,
};

export interface VideoProcessingProgressController {
  reportOverall: VideoWorkerProgress;
  reportStage: (stage: VideoProgressStage, progress: number, message: string) => void;
  reportJobStage: (jobIndex: number, stage: VideoProgressStage, completedUnits: number, totalUnits: number, message: string) => void;
  terminate: () => void;
  current: () => number;
}

export interface VideoProgressJobWeight {
  durationSeconds: number;
  expectedOutputBytes: number;
}

export function createVideoProcessingProgressController(
  onProgress?: VideoWorkerProgress,
  jobWeights: readonly VideoProgressJobWeight[] = [],
): VideoProcessingProgressController {
  let currentProgress = 0;
  let terminal = false;
  const stageProgress = Object.fromEntries(VIDEO_PROGRESS_STAGES.map((stage) => [stage, 0])) as Record<VideoProgressStage, number>;
  const jobStageProgress = VIDEO_PROGRESS_STAGES.map(() => jobWeights.map(() => 0));
  const reportOverall: VideoWorkerProgress = (progress, message) => {
    if (terminal) return;
    const nextProgress = normalizeProgress(progress);
    currentProgress = Math.max(currentProgress, nextProgress);
    onProgress?.(currentProgress, message);
  };
  return {
    reportOverall,
    reportStage: (stage, progress, message) => {
      stageProgress[stage] = normalizeProgress(progress) / 100;
      reportOverall(weightedStageProgress(stageProgress), message);
    },
    reportJobStage: (jobIndex, stage, completedUnits, totalUnits, message) => {
      if (!jobWeights[jobIndex]) return;
      const stageIndex = VIDEO_PROGRESS_STAGES.indexOf(stage);
      jobStageProgress[stageIndex][jobIndex] = unitRatio(completedUnits, totalUnits);
      const weights = jobWeights.map((job) => stage === "write" ? job.expectedOutputBytes : job.durationSeconds);
      stageProgress[stage] = weightedAverage(jobStageProgress[stageIndex], weights);
      reportOverall(weightedStageProgress(stageProgress), message);
    },
    terminate: () => { terminal = true; },
    current: () => currentProgress,
  };
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
