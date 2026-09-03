export type VideoParserReasonCode =
  | "NOT_ISO_BMFF"
  | "FRAGMENTED_INPUT"
  | "VIDEO_TRACK_UNAVAILABLE"
  | "VIDEO_CODEC_UNSUPPORTED"
  | "VIDEO_SAMPLE_ENTRY_UNSUPPORTED"
  | "VIDEO_CONFIGURATION_UNAVAILABLE"
  | "AUDIO_CODEC_UNSUPPORTED"
  | "AUDIO_CONFIGURATION_UNAVAILABLE"
  | "EDIT_LIST_UNSUPPORTED"
  | "SAMPLE_TABLE_UNAVAILABLE"
  | "CONCAT_TRACK_MISMATCH"
  | "DOLBY_VISION_CONFIGURATION_UNAVAILABLE"
  | "DOLBY_VISION_CONFIGURATION_AMBIGUOUS"
  | "DOLBY_VISION_VERSION_UNSUPPORTED"
  | "DOLBY_VISION_PROFILE_UNSUPPORTED"
  | "DOLBY_VISION_BASE_LAYER_UNAVAILABLE"
  | "DOLBY_VISION_COMPATIBILITY_UNSUPPORTED";

export type VideoCapabilityReasonCode =
  | "CONCAT_FRAME_RATE_UNAVAILABLE"
  | "OFFSCREEN_CANVAS_UNAVAILABLE"
  | "VIDEO_DECODER_UNAVAILABLE"
  | "VIDEO_DECODER_UNSUPPORTED"
  | "VIDEO_ENCODER_UNAVAILABLE"
  | "VIDEO_ENCODER_UNSUPPORTED"
  | "AUDIO_TRACK_MISMATCH"
  | "AUDIO_DECODER_UNAVAILABLE"
  | "AUDIO_DECODER_UNSUPPORTED"
  | "AUDIO_ENCODER_UNAVAILABLE"
  | "AUDIO_ENCODER_UNSUPPORTED"
  | "AUDIO_TRACK_UNAVAILABLE"
  | "AUDIO_ENCODER_SUPPORTED";

export type VideoProbeCause =
  | { causeKind: "parser"; reasonCode: VideoParserReasonCode }
  | { causeKind: "capability"; reasonCode: VideoCapabilityReasonCode };

export interface VideoProbeAssessment {
  compatible: boolean;
  cause?: VideoProbeCause;
}

export interface VideoAudioAlternativeProbes {
  remove?: VideoProbeAssessment;
  encode?: VideoProbeAssessment;
}

export function parserProbeCause(reasonCode: VideoParserReasonCode): VideoProbeCause {
  return { causeKind: "parser", reasonCode };
}

export function capabilityProbeCause(reasonCode: VideoCapabilityReasonCode): VideoProbeCause {
  return { causeKind: "capability", reasonCode };
}

export function resolveVideoAudioAlternatives(
  audioMode: "copy" | "remove" | "encode",
  alternatives: VideoAudioAlternativeProbes | undefined,
) {
  const removeCompatible = alternatives?.remove?.compatible === true;
  const encodeCompatible = alternatives?.encode?.compatible === true;
  return {
    hybridCompatible: audioMode === "encode" ? encodeCompatible : undefined,
    suggestions: audioMode === "copy"
      ? [
          ...(encodeCompatible ? ["encode" as const] : []),
          ...(removeCompatible ? ["remove" as const] : []),
        ]
      : [] as Array<"remove" | "encode">,
  };
}
