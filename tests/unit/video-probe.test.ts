import assert from "node:assert/strict";
import test from "node:test";

import {
  capabilityProbeCause,
  parserProbeCause,
  resolveVideoAudioAlternatives,
  type VideoCapabilityReasonCode,
  type VideoParserReasonCode,
} from "../../src/features/video-studio/videoProbe.ts";
import { decideVideoProcessingRoute } from "../../src/features/video-studio/videoRouting.ts";
import { guidanceCodeForProbeCause, guidanceCodeForRouteReason, primaryVideoProbeCause } from "../../src/features/video-studio/videoRouteGuidance.ts";

test("combined audio alternatives prefer conversion and preserve the selected job mode", () => {
  const both = { remove: { compatible: true }, encode: { compatible: true } };
  assert.deepEqual(resolveVideoAudioAlternatives("copy", both), {
    hybridCompatible: undefined,
    suggestions: ["encode", "remove"],
  });
  assert.deepEqual(resolveVideoAudioAlternatives("encode", both), {
    hybridCompatible: true,
    suggestions: [],
  });
  assert.deepEqual(resolveVideoAudioAlternatives("remove", both), {
    hybridCompatible: undefined,
    suggestions: [],
  });
  assert.deepEqual(resolveVideoAudioAlternatives("copy", { remove: { compatible: true } }).suggestions, ["remove"]);
});

test("the FFmpeg guidance mapper covers every parser and capability cause", () => {
  const parserReasons: VideoParserReasonCode[] = [
    "NOT_ISO_BMFF", "FRAGMENTED_INPUT", "VIDEO_TRACK_UNAVAILABLE", "VIDEO_CODEC_UNSUPPORTED",
    "VIDEO_SAMPLE_ENTRY_UNSUPPORTED", "VIDEO_CONFIGURATION_UNAVAILABLE", "AUDIO_CODEC_UNSUPPORTED",
    "AUDIO_CONFIGURATION_UNAVAILABLE", "EDIT_LIST_UNSUPPORTED", "SAMPLE_TABLE_UNAVAILABLE",
    "CONCAT_TRACK_MISMATCH", "DOLBY_VISION_CONFIGURATION_UNAVAILABLE", "DOLBY_VISION_CONFIGURATION_AMBIGUOUS",
    "DOLBY_VISION_VERSION_UNSUPPORTED", "DOLBY_VISION_PROFILE_UNSUPPORTED", "DOLBY_VISION_BASE_LAYER_UNAVAILABLE",
    "DOLBY_VISION_COMPATIBILITY_UNSUPPORTED",
  ];
  const capabilityReasons: VideoCapabilityReasonCode[] = [
    "CONCAT_FRAME_RATE_UNAVAILABLE", "OFFSCREEN_CANVAS_UNAVAILABLE", "VIDEO_DECODER_UNAVAILABLE",
    "VIDEO_DECODER_UNSUPPORTED", "VIDEO_ENCODER_UNAVAILABLE", "VIDEO_ENCODER_UNSUPPORTED",
    "AUDIO_TRACK_MISMATCH", "AUDIO_DECODER_UNAVAILABLE", "AUDIO_DECODER_UNSUPPORTED",
    "AUDIO_ENCODER_UNAVAILABLE", "AUDIO_ENCODER_UNSUPPORTED", "AUDIO_TRACK_UNAVAILABLE", "AUDIO_ENCODER_SUPPORTED",
  ];
  assert.ok(parserReasons.every((reason) => guidanceCodeForProbeCause(parserProbeCause(reason))));
  assert.ok(capabilityReasons.every((reason) => guidanceCodeForProbeCause(capabilityProbeCause(reason))));
  assert.equal(guidanceCodeForProbeCause(parserProbeCause("AUDIO_CODEC_UNSUPPORTED")), "audio-format");
  assert.equal(guidanceCodeForProbeCause(capabilityProbeCause("VIDEO_DECODER_UNSUPPORTED")), "video-capability");
});

test("probe guidance outranks quota routing while quota remains an explanatory decision reason", () => {
  assert.equal(guidanceCodeForProbeCause(capabilityProbeCause("VIDEO_DECODER_UNSUPPORTED")), "video-capability");
  for (const reason of ["OPFS_UNAVAILABLE", "QUOTA_UNKNOWN", "QUOTA_INSUFFICIENT"] as const) {
    assert.equal(guidanceCodeForRouteReason(reason), "storage-route");
  }
});

test("codec causes keep priority across the storage route matrix", () => {
  const causes = [
    parserProbeCause("DOLBY_VISION_COMPATIBILITY_UNSUPPORTED"),
    capabilityProbeCause("VIDEO_DECODER_UNSUPPORTED"),
  ];
  const storageStates = [
    { opfsAvailable: true, quota: "enough" as const, reasonCode: "WEBCODECS_INCOMPATIBLE" },
    { opfsAvailable: false, quota: "enough" as const, reasonCode: "OPFS_UNAVAILABLE" },
    { opfsAvailable: true, quota: "unknown" as const, reasonCode: "QUOTA_UNKNOWN" },
    { opfsAvailable: true, quota: "insufficient" as const, reasonCode: "QUOTA_INSUFFICIENT" },
  ];
  for (const cause of causes) {
    const probeDetails = [{ operation: "webcodecs" as const, reasonCode: "INPUT_UNSUPPORTED" as const, cause }];
    const primaryCause = primaryVideoProbeCause(probeDetails);
    assert.ok(primaryCause);
    for (const storage of storageStates) {
      const { reasonCode, ...routeStorage } = storage;
      const decision = decideVideoProcessingRoute({
        container: "mp4",
        codec: "h264",
        bitrateMode: "target",
        audioMode: "remove",
        estimatedOutputBytes: 64 * 1024 * 1024,
        webCodecsCompatible: false,
        ...routeStorage,
      });
      assert.equal(decision.route, "ffmpeg");
      assert.equal(decision.reasonCode, reasonCode);
      assert.equal(guidanceCodeForProbeCause(primaryCause), cause.causeKind === "parser" ? "video-format" : "video-capability");
    }
  }
});
