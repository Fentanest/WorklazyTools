import type { VideoOutputJob, VideoTask } from "./types.ts";

export function estimateVideoJobOutputBytes(
  job: VideoOutputJob,
  task?: VideoTask,
  sourceAudioBitratesBps: readonly (number | null | undefined)[] = [],
) {
  if (task?.kind === "encode" && task.bitrate !== "copy" && task.bitrate !== "0") {
    const durationSeconds = estimateVideoJobDuration(job);
    const videoBitrateBps = parseBitrate(task.bitrate, "M", 1_000_000);
    const audioBitrateBps = task.audioMode === "remove"
      ? 0
      : task.audioMode === "encode"
        ? parseBitrate(task.audioBitrate, "k", 1_000)
        : estimateCopiedAudioBitrate(sourceAudioBitratesBps, job.inputs.length);
    return ((videoBitrateBps + audioBitrateBps) / 8) * durationSeconds * 1.1;
  }
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

export function taskForVideoJob(task: VideoTask, job: VideoOutputJob): VideoTask {
  return task.kind === "encode" && job.audioModeOverride === "remove"
    ? { ...task, audioMode: "remove" }
    : task;
}

function estimateCopiedAudioBitrate(values: readonly (number | null | undefined)[], inputCount: number) {
  if (values.length !== inputCount || values.some((value) => value === undefined)) return 320_000;
  const known = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0);
  return known.length ? Math.max(...known) : 0;
}

function parseBitrate(value: string, suffix: "M" | "k", multiplier: number) {
  const match = new RegExp(`^(\\d+(?:\\.\\d+)?)${suffix}$`, "i").exec(value);
  return match ? Number(match[1]) * multiplier : 0;
}
