import type { VideoProgressStage } from "./videoProcessingProgress";

export interface VideoProgressEmission {
  stage: VideoProgressStage;
  completedUnits: number;
  totalUnits: number;
  message: string;
  explicitCompletion: boolean;
}

export function createVideoProgressCoalescer(
  emit: (event: VideoProgressEmission) => void,
  now: () => number = () => performance.now(),
) {
  const lastIntegerPercent = new Map<VideoProgressStage, number>();
  const lastEmittedAt = new Map<VideoProgressStage, number>();
  return {
    report(
      stage: VideoProgressStage,
      completedUnits: number,
      totalUnits: number,
      message: string,
      explicitCompletion = false,
    ) {
      const timestamp = now();
      const integerPercent = progressIntegerPercent(completedUnits, totalUnits);
      const previousPercent = lastIntegerPercent.get(stage);
      const previousTimestamp = lastEmittedAt.get(stage);
      if (!explicitCompletion
        && integerPercent === previousPercent
        && previousTimestamp !== undefined
        && timestamp - previousTimestamp < 100) return false;
      lastIntegerPercent.set(stage, integerPercent);
      lastEmittedAt.set(stage, timestamp);
      emit({ stage, completedUnits, totalUnits, message, explicitCompletion });
      return true;
    },
  };
}

function progressIntegerPercent(completedUnits: number, totalUnits: number) {
  if (!Number.isFinite(completedUnits) || !Number.isFinite(totalUnits) || totalUnits <= 0) return 0;
  return Math.floor(Math.max(0, Math.min(1, completedUnits / totalUnits)) * 100);
}
