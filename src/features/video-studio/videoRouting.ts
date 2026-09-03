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
export type VideoProcessingRoute = "ffmpeg" | VideoPlannedStreamingRoute | "hybrid";

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
  | "HYBRID_READY"
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
  hybridCompatible?: boolean;
}

export type VideoProcessingFailureStage = "audio" | "audio-demux" | "video-codec" | "mux-write" | "quota";

export interface VideoRouteDecision {
  route: VideoProcessingRoute;
  plannedStreamingRoute: VideoPlannedStreamingRoute | null;
  reasonCode: VideoRouteReasonCode;
  failureFallbacks: Record<VideoProcessingFailureStage, {
    route: "ffmpeg" | "reject";
    reasonCode: VideoStreamingFailureReasonCode;
  }>;
}

export function decideVideoProcessingRoute(input: VideoRouteInput): VideoRouteDecision {
  const failureFallbacks = decideFailureFallbacks(input.estimatedOutputBytes);
  const plannedStreamingRoute = plannedStreamingRouteFor(input);
  if (!plannedStreamingRoute) {
    return {
      route: "ffmpeg",
      plannedStreamingRoute: null,
      reasonCode: ineligibleReasonFor(input),
      failureFallbacks,
    };
  }
  if (!input.opfsAvailable) {
    return { route: "ffmpeg", plannedStreamingRoute, reasonCode: "OPFS_UNAVAILABLE", failureFallbacks };
  }
  if (input.quota === "unknown") {
    return { route: "ffmpeg", plannedStreamingRoute, reasonCode: "QUOTA_UNKNOWN", failureFallbacks };
  }
  if (input.quota === "insufficient") {
    return { route: "ffmpeg", plannedStreamingRoute, reasonCode: "QUOTA_INSUFFICIENT", failureFallbacks };
  }
  if (plannedStreamingRoute === "stream-copy" && input.streamCopyCompatible === false) {
    return { route: "ffmpeg", plannedStreamingRoute, reasonCode: "STREAM_COPY_INCOMPATIBLE", failureFallbacks };
  }
  if (plannedStreamingRoute === "stream-copy" && input.streamCopyCompatible === true) {
    return { route: "stream-copy", plannedStreamingRoute, reasonCode: "STREAM_COPY_READY", failureFallbacks };
  }
  if (plannedStreamingRoute === "webcodecs" && input.webCodecsCompatible === false) {
    if (input.hybridCompatible === true) return { route: "hybrid", plannedStreamingRoute, reasonCode: "HYBRID_READY", failureFallbacks };
    return { route: "ffmpeg", plannedStreamingRoute, reasonCode: "WEBCODECS_INCOMPATIBLE", failureFallbacks };
  }
  if (plannedStreamingRoute === "webcodecs" && input.webCodecsCompatible === true) {
    return { route: "webcodecs", plannedStreamingRoute, reasonCode: "WEBCODECS_READY", failureFallbacks };
  }
  return {
    route: "ffmpeg",
    plannedStreamingRoute,
    reasonCode: plannedStreamingRoute === "stream-copy" ? "STREAM_COPY_PENDING" : "WEBCODECS_PENDING",
    failureFallbacks,
  };
}

export function decideFfmpegOnlyRoute(estimatedOutputBytes: number): VideoRouteDecision {
  return {
    route: "ffmpeg",
    plannedStreamingRoute: null,
    reasonCode: "NON_VIDEO_TASK",
    failureFallbacks: decideFailureFallbacks(estimatedOutputBytes),
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

function decideFailureFallbacks(estimatedOutputBytes: number): VideoRouteDecision["failureFallbacks"] {
  const safeForFfmpeg = Number.isFinite(estimatedOutputBytes)
    && estimatedOutputBytes >= 0
    && estimatedOutputBytes <= MAX_SAFE_FFMPEG_OUTPUT_BYTES;
  const fallback: VideoRouteDecision["failureFallbacks"][VideoProcessingFailureStage] = safeForFfmpeg
    ? { route: "ffmpeg", reasonCode: "FALLBACK_OUTPUT_WITHIN_SAFE_LIMIT" }
    : { route: "reject", reasonCode: "FALLBACK_OUTPUT_EXCEEDS_SAFE_LIMIT" };
  return {
    audio: fallback,
    "audio-demux": fallback,
    "video-codec": fallback,
    "mux-write": fallback,
    quota: fallback,
  };
}
