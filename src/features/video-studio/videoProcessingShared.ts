import type { VideoTask, VideoWorkerResult } from "./types";
import { classifyVideoProcessingFailure, type VideoProcessingFailureCode } from "./videoErrors.ts";

export interface VideoFileLabels {
  concatenated: string;
  passthrough: string;
  converted: string;
  animation: string;
  audio: string;
}

export type VideoMessageFactory = (key: string, values?: Record<string, unknown>) => string;

export type NormalizedVideoProcessingError = {
  message: string;
  code: VideoProcessingFailureCode | "RESULT_STORAGE_QUOTA";
};

export class VideoResultQuotaError extends Error {
  constructor() {
    super("Temporary result storage quota is insufficient");
    this.name = "VideoResultQuotaError";
  }
}

export function createVideoOutputName(name: string, task: VideoTask, concat: boolean, labels: VideoFileLabels) {
  const base = sanitizeVideoFileName(name.replace(/\.[^.]+$/, "")) || "worklazy-video";
  const suffix = concat ? labels.concatenated : task.kind === "encode" && task.bitrate === "copy" ? labels.passthrough : labels.converted;
  if (task.kind === "gif") return `${base}-${concat ? `${labels.concatenated}-` : ""}${labels.animation}.gif`;
  if (task.kind === "audio") return `${base}-${concat ? `${labels.concatenated}-` : ""}${labels.audio}.${task.format === "aac" ? "m4a" : "mp3"}`;
  return `${base}-${suffix}.${task.container}`;
}

export function getVideoOutputMimeType(name: string) {
  const normalizedName = name.toLowerCase();
  if (normalizedName.endsWith(".gif")) return "image/gif";
  if (normalizedName.endsWith(".mp3")) return "audio/mpeg";
  if (normalizedName.endsWith(".m4a")) return "audio/mp4";
  if (normalizedName.endsWith(".webm")) return "video/webm";
  if (normalizedName.endsWith(".mkv")) return "video/x-matroska";
  return "video/mp4";
}

export function createVideoWorkerResult(
  outputCounts: number | readonly number[],
  task: VideoTask,
  message: VideoMessageFactory,
): VideoWorkerResult {
  const outputCount = countVideoOutputs(outputCounts);
  const warnings = [message("video.messages.video.processedOutputJobsAccordingToGroupSettings", { p0: outputCount })];
  if (task.kind === "encode" && task.bitrate === "copy") warnings.push(message("video.messages.video.passthroughTrimmingMayStartSlightlyEarlierAtA"));
  if (task.kind === "encode" && task.audioMode === "copy") warnings.push(message("video.messages.video.theFirstAudioTrackWasPreservedWithoutRe"));
  if (task.kind === "encode" && task.audioMode === "remove") warnings.push(message("video.messages.video.theAudioTrackWasRemovedFromTheOutput"));
  if (task.kind === "encode" && task.codec === "hevc") warnings.push(message("video.messages.video.hevcMayNotPlayOnEveryDeviceOr"));
  return { outputCount, warnings };
}

export function countVideoOutputs(outputCounts: number | readonly number[]) {
  const counts = typeof outputCounts === "number" ? [outputCounts] : outputCounts;
  return counts.reduce((total, count) => total + (Number.isInteger(count) && count > 0 ? count : 0), 0);
}

export function normalizeVideoProcessingError(
  error: unknown,
  diagnosticMessages: readonly string[],
  message: VideoMessageFactory,
): NormalizedVideoProcessingError {
  if (error instanceof VideoResultQuotaError) {
    return {
      message: message("video.messages.video.thereIsNotEnoughBrowserStorageForThisResult"),
      code: "RESULT_STORAGE_QUOTA",
    };
  }
  const code = classifyVideoProcessingFailure(error, diagnosticMessages);
  if (code === "OUT_OF_MEMORY") return { message: message("video.messages.video.theBrowserRanOutOfMemoryTryA"), code };
  if (code === "CODEC_UNAVAILABLE") return { message: message("video.messages.video.theBrowserEncodingEngineDoesNotSupportThe"), code };
  return { message: message("video.messages.video.theInputFormatOrCodecMayNotBe"), code: "VIDEO_PROCESSING_ERROR" };
}

function sanitizeVideoFileName(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]+/g, "-");
}
