import type { VideoAudioMode, VideoCodec } from "./types";
import type { VideoStorageQuotaState } from "./videoResultStorage";

export const MAX_SAFE_FFMPEG_OUTPUT_BYTES = 1.5 * 1024 * 1024 * 1024;

export const VIDEO_ROUTE_CONTAINERS = ["mp4", "mov", "mkv", "webm"] as const;
export const VIDEO_ROUTE_CODECS = ["h264", "hevc", "vp9"] as const satisfies readonly VideoCodec[];
export const VIDEO_ROUTE_BITRATE_MODES = ["copy", "crf", "target"] as const;
export const VIDEO_ROUTE_AUDIO_MODES = ["copy", "remove", "encode"] as const satisfies readonly VideoAudioMode[];
export const VIDEO_ROUTE_OPFS_STATES = [false, true] as const;
export const VIDEO_ROUTE_QUOTA_STATES = ["enough", "insufficient", "unknown"] as const satisfies readonly VideoStorageQuotaState[];

export type VideoRouteContainer = typeof VIDEO_ROUTE_CONTAINERS[number];
export type VideoRouteBitrateMode = typeof VIDEO_ROUTE_BITRATE_MODES[number];
export type VideoPlannedStreamingRoute = "stream-copy" | "webcodecs";
export type VideoProcessingRoute = "ffmpeg" | VideoPlannedStreamingRoute;

export type VideoRouteReasonCode =
  | "NON_VIDEO_TASK"
  | "CRF_REQUIRES_FFMPEG"
  | "CONTAINER_REQUIRES_FFMPEG"
  | "CODEC_REQUIRES_FFMPEG"
  | "COPY_AUDIO_ENCODE_REQUIRES_FFMPEG"
  | "OPFS_UNAVAILABLE"
  | "QUOTA_UNKNOWN"
  | "QUOTA_INSUFFICIENT"
  | "STREAM_COPY_INCOMPATIBLE"
  | "STREAM_COPY_READY"
  | "STREAM_COPY_PENDING"
  | "WEBCODECS_INCOMPATIBLE"
  | "WEBCODECS_READY"
  | "WEBCODECS_PENDING";

export type VideoStreamingFailureReasonCode =
  | "FALLBACK_OUTPUT_WITHIN_SAFE_LIMIT"
  | "FALLBACK_OUTPUT_EXCEEDS_SAFE_LIMIT";

export interface VideoRouteInput {
  container: VideoRouteContainer;
  codec: VideoCodec;
  bitrateMode: VideoRouteBitrateMode;
  audioMode: VideoAudioMode;
  opfsAvailable: boolean;
  quota: VideoStorageQuotaState;
  estimatedOutputBytes: number;
  streamCopyCompatible?: boolean;
  webCodecsCompatible?: boolean;
}

export interface VideoRouteDecision {
  route: VideoProcessingRoute;
  plannedStreamingRoute: VideoPlannedStreamingRoute | null;
  reasonCode: VideoRouteReasonCode;
  streamingFailure: {
    route: "ffmpeg" | "reject";
    reasonCode: VideoStreamingFailureReasonCode;
  };
}

export function decideVideoProcessingRoute(input: VideoRouteInput): VideoRouteDecision {
  const streamingFailure = decideStreamingFailureFallback(input.estimatedOutputBytes);
  const plannedStreamingRoute = plannedStreamingRouteFor(input);
  if (!plannedStreamingRoute) {
    return {
      route: "ffmpeg",
      plannedStreamingRoute: null,
      reasonCode: ineligibleReasonFor(input),
      streamingFailure,
    };
  }
  if (!input.opfsAvailable) {
    return { route: "ffmpeg", plannedStreamingRoute, reasonCode: "OPFS_UNAVAILABLE", streamingFailure };
  }
  if (input.quota === "unknown") {
    return { route: "ffmpeg", plannedStreamingRoute, reasonCode: "QUOTA_UNKNOWN", streamingFailure };
  }
  if (input.quota === "insufficient") {
    return { route: "ffmpeg", plannedStreamingRoute, reasonCode: "QUOTA_INSUFFICIENT", streamingFailure };
  }
  if (plannedStreamingRoute === "stream-copy" && input.streamCopyCompatible === false) {
    return { route: "ffmpeg", plannedStreamingRoute, reasonCode: "STREAM_COPY_INCOMPATIBLE", streamingFailure };
  }
  if (plannedStreamingRoute === "stream-copy" && input.streamCopyCompatible === true) {
    return { route: "stream-copy", plannedStreamingRoute, reasonCode: "STREAM_COPY_READY", streamingFailure };
  }
  if (plannedStreamingRoute === "webcodecs" && input.webCodecsCompatible === false) {
    return { route: "ffmpeg", plannedStreamingRoute, reasonCode: "WEBCODECS_INCOMPATIBLE", streamingFailure };
  }
  if (plannedStreamingRoute === "webcodecs" && input.webCodecsCompatible === true) {
    return { route: "webcodecs", plannedStreamingRoute, reasonCode: "WEBCODECS_READY", streamingFailure };
  }
  return {
    route: "ffmpeg",
    plannedStreamingRoute,
    reasonCode: plannedStreamingRoute === "stream-copy" ? "STREAM_COPY_PENDING" : "WEBCODECS_PENDING",
    streamingFailure,
  };
}

export function decideFfmpegOnlyRoute(estimatedOutputBytes: number): VideoRouteDecision {
  return {
    route: "ffmpeg",
    plannedStreamingRoute: null,
    reasonCode: "NON_VIDEO_TASK",
    streamingFailure: decideStreamingFailureFallback(estimatedOutputBytes),
  };
}

function plannedStreamingRouteFor(input: VideoRouteInput): VideoPlannedStreamingRoute | null {
  if (input.bitrateMode === "crf") return null;
  if (input.container !== "mp4" && input.container !== "mov") return null;
  if (input.codec !== "h264" && input.codec !== "hevc") return null;
  if (input.bitrateMode === "copy" && input.audioMode === "encode") return null;
  return input.bitrateMode === "copy" ? "stream-copy" : "webcodecs";
}

function ineligibleReasonFor(input: VideoRouteInput): VideoRouteReasonCode {
  if (input.bitrateMode === "crf") return "CRF_REQUIRES_FFMPEG";
  if (input.container !== "mp4" && input.container !== "mov") return "CONTAINER_REQUIRES_FFMPEG";
  if (input.codec !== "h264" && input.codec !== "hevc") return "CODEC_REQUIRES_FFMPEG";
  return "COPY_AUDIO_ENCODE_REQUIRES_FFMPEG";
}

function decideStreamingFailureFallback(estimatedOutputBytes: number): VideoRouteDecision["streamingFailure"] {
  const safeForFfmpeg = Number.isFinite(estimatedOutputBytes)
    && estimatedOutputBytes >= 0
    && estimatedOutputBytes <= MAX_SAFE_FFMPEG_OUTPUT_BYTES;
  return safeForFfmpeg
    ? { route: "ffmpeg", reasonCode: "FALLBACK_OUTPUT_WITHIN_SAFE_LIMIT" }
    : { route: "reject", reasonCode: "FALLBACK_OUTPUT_EXCEEDS_SAFE_LIMIT" };
}
