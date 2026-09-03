import type { VideoProcessingJobRoute } from "./videoProcessingClient.ts";
import type { VideoRouteReasonCode } from "./videoRouting.ts";
import type { VideoProbeCause } from "./videoProbe.ts";

export type VideoRouteGuidanceCode =
  | "source-structure"
  | "video-format"
  | "audio-format"
  | "timeline"
  | "concat"
  | "frame-rate"
  | "video-capability"
  | "audio-capability"
  | "container-setting"
  | "codec-setting"
  | "quality-setting"
  | "storage-route"
  | "generic";

export function primaryVideoProbeCause(probeDetails: VideoProcessingJobRoute["probeDetails"]) {
  return probeDetails.find((detail) => detail.cause)?.cause;
}

export function guidanceCodeForProbeCause(cause: VideoProbeCause): VideoRouteGuidanceCode {
  const reasonCode = cause.reasonCode;
  switch (reasonCode) {
    case "NOT_ISO_BMFF":
    case "FRAGMENTED_INPUT":
    case "VIDEO_TRACK_UNAVAILABLE":
      return "source-structure";
    case "VIDEO_CODEC_UNSUPPORTED":
    case "VIDEO_SAMPLE_ENTRY_UNSUPPORTED":
    case "VIDEO_CONFIGURATION_UNAVAILABLE":
    case "DOLBY_VISION_CONFIGURATION_UNAVAILABLE":
    case "DOLBY_VISION_CONFIGURATION_AMBIGUOUS":
    case "DOLBY_VISION_VERSION_UNSUPPORTED":
    case "DOLBY_VISION_PROFILE_UNSUPPORTED":
    case "DOLBY_VISION_BASE_LAYER_UNAVAILABLE":
    case "DOLBY_VISION_COMPATIBILITY_UNSUPPORTED":
      return "video-format";
    case "AUDIO_CODEC_UNSUPPORTED":
    case "AUDIO_CONFIGURATION_UNAVAILABLE":
      return "audio-format";
    case "EDIT_LIST_UNSUPPORTED":
    case "SAMPLE_TABLE_UNAVAILABLE":
      return "timeline";
    case "CONCAT_TRACK_MISMATCH":
    case "AUDIO_TRACK_MISMATCH":
      return "concat";
    case "CONCAT_FRAME_RATE_UNAVAILABLE":
      return "frame-rate";
    case "OFFSCREEN_CANVAS_UNAVAILABLE":
    case "VIDEO_DECODER_UNAVAILABLE":
    case "VIDEO_DECODER_UNSUPPORTED":
    case "VIDEO_ENCODER_UNAVAILABLE":
    case "VIDEO_ENCODER_UNSUPPORTED":
      return "video-capability";
    case "AUDIO_DECODER_UNAVAILABLE":
    case "AUDIO_DECODER_UNSUPPORTED":
    case "AUDIO_ENCODER_UNAVAILABLE":
    case "AUDIO_ENCODER_UNSUPPORTED":
    case "AUDIO_TRACK_UNAVAILABLE":
    case "AUDIO_ENCODER_SUPPORTED":
      return "audio-capability";
    default:
      return assertNever(reasonCode);
  }
}

export function guidanceCodeForRouteReason(reasonCode: VideoRouteReasonCode): VideoRouteGuidanceCode | undefined {
  switch (reasonCode) {
    case "CONTAINER_REQUIRES_FFMPEG":
      return "container-setting";
    case "CODEC_REQUIRES_FFMPEG":
      return "codec-setting";
    case "CRF_REQUIRES_FFMPEG":
      return "quality-setting";
    case "COPY_AUDIO_ENCODE_REQUIRES_FFMPEG":
      return "audio-capability";
    case "OPFS_UNAVAILABLE":
    case "QUOTA_UNKNOWN":
    case "QUOTA_INSUFFICIENT":
      return "storage-route";
    case "STREAM_COPY_INCOMPATIBLE":
    case "WEBCODECS_INCOMPATIBLE":
      return "generic";
    case "NON_VIDEO_TASK":
    case "STREAM_COPY_READY":
    case "STREAM_COPY_PENDING":
    case "HYBRID_READY":
    case "WEBCODECS_READY":
    case "WEBCODECS_PENDING":
      return undefined;
    default:
      return assertNever(reasonCode);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled video guidance code: ${String(value)}`);
}
