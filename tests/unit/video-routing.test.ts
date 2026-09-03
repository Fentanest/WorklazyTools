import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_SAFE_FFMPEG_OUTPUT_BYTES,
  VIDEO_ROUTE_AUDIO_MODES,
  VIDEO_ROUTE_BITRATE_MODES,
  VIDEO_ROUTE_CODECS,
  VIDEO_ROUTE_CONTAINERS,
  VIDEO_ROUTE_OPFS_STATES,
  VIDEO_ROUTE_QUOTA_STATES,
  decideVideoProcessingRoute,
  isSafeFfmpegOutputSize,
  type VideoRouteInput,
  type VideoRouteReasonCode,
} from "../../src/features/video-studio/videoRouting.ts";

test("the complete route table keeps copy candidates on FFmpeg until compatibility preflight succeeds", () => {
  let combinations = 0;
  for (const container of VIDEO_ROUTE_CONTAINERS) {
    for (const codec of VIDEO_ROUTE_CODECS) {
      for (const bitrateMode of VIDEO_ROUTE_BITRATE_MODES) {
        for (const audioMode of VIDEO_ROUTE_AUDIO_MODES) {
          for (const opfsAvailable of VIDEO_ROUTE_OPFS_STATES) {
            for (const quota of VIDEO_ROUTE_QUOTA_STATES) {
              const input: VideoRouteInput = {
                container,
                codec,
                bitrateMode,
                audioMode,
                opfsAvailable,
                quota,
                estimatedOutputBytes: 64 * 1024 * 1024,
              };
              const decision = decideVideoProcessingRoute(input);
              assert.equal(decision.route, "ffmpeg");
              assert.equal(decision.reasonCode, expectedReason(input));
              assert.equal(decision.plannedStreamingRoute, expectedPlannedRoute(input));
              assert.deepEqual(new Set(Object.keys(decision.failureFallbacks)), new Set(["audio", "audio-demux", "video-codec", "mux-write", "quota"]));
              assert.ok(Object.values(decision.failureFallbacks).every((fallback) => fallback.route === "ffmpeg" && fallback.reasonCode === "FALLBACK_OUTPUT_WITHIN_SAFE_LIMIT"));
              combinations += 1;
            }
          }
        }
      }
    }
  }
  assert.equal(combinations, 648);
});

test("streaming eligibility requires MP4/MOV, H.264/HEVC, suitable bitrate/audio, OPFS, and quota", () => {
  const base = {
    container: "mp4",
    codec: "h264",
    bitrateMode: "copy",
    audioMode: "copy",
    opfsAvailable: true,
    quota: "enough",
    estimatedOutputBytes: 512 * 1024 * 1024,
  } as const;
  assert.equal(decideVideoProcessingRoute(base).reasonCode, "STREAM_COPY_PENDING");
  assert.deepEqual(decideVideoProcessingRoute({ ...base, streamCopyCompatible: true }), {
    route: "stream-copy",
    plannedStreamingRoute: "stream-copy",
    reasonCode: "STREAM_COPY_READY",
    failureFallbacks: safeFallbacks("ffmpeg"),
  });
  assert.equal(decideVideoProcessingRoute({ ...base, streamCopyCompatible: false }).reasonCode, "STREAM_COPY_INCOMPATIBLE");
  assert.equal(decideVideoProcessingRoute({ ...base, container: "mov" }).reasonCode, "STREAM_COPY_PENDING");
  assert.equal(decideVideoProcessingRoute({ ...base, bitrateMode: "target", audioMode: "encode" }).reasonCode, "WEBCODECS_PENDING");
  assert.deepEqual(decideVideoProcessingRoute({ ...base, bitrateMode: "target", audioMode: "remove", webCodecsCompatible: true }), {
    route: "webcodecs",
    plannedStreamingRoute: "webcodecs",
    reasonCode: "WEBCODECS_READY",
    failureFallbacks: safeFallbacks("ffmpeg"),
  });
  assert.equal(
    decideVideoProcessingRoute({ ...base, bitrateMode: "target", audioMode: "copy", webCodecsCompatible: false }).reasonCode,
    "WEBCODECS_INCOMPATIBLE",
  );
  assert.equal(decideVideoProcessingRoute({ ...base, bitrateMode: "target", audioMode: "encode", webCodecsCompatible: false, hybridCompatible: true }).route, "hybrid");
  assert.equal(decideVideoProcessingRoute({ ...base, bitrateMode: "crf" }).reasonCode, "CRF_REQUIRES_FFMPEG");
  assert.equal(decideVideoProcessingRoute({ ...base, container: "webm", codec: "vp9" }).reasonCode, "CONTAINER_REQUIRES_FFMPEG");
  assert.equal(decideVideoProcessingRoute({ ...base, container: "mkv" }).reasonCode, "CONTAINER_REQUIRES_FFMPEG");
  assert.equal(decideVideoProcessingRoute({ ...base, codec: "vp9" }).reasonCode, "CODEC_REQUIRES_FFMPEG");
  assert.equal(decideVideoProcessingRoute({ ...base, audioMode: "encode" }).reasonCode, "COPY_AUDIO_ENCODE_REQUIRES_FFMPEG");
  assert.equal(decideVideoProcessingRoute({ ...base, opfsAvailable: false }).reasonCode, "OPFS_UNAVAILABLE");
  assert.equal(decideVideoProcessingRoute({ ...base, quota: "unknown" }).reasonCode, "QUOTA_UNKNOWN");
  assert.equal(decideVideoProcessingRoute({ ...base, quota: "insufficient" }).reasonCode, "QUOTA_INSUFFICIENT");
});

test("every stage in the fallback matrix only uses FFmpeg within the safety limit", () => {
  const base = {
    container: "mp4",
    codec: "hevc",
    bitrateMode: "target",
    audioMode: "remove",
    opfsAvailable: true,
    quota: "enough",
  } as const;
  assert.deepEqual(decideVideoProcessingRoute({ ...base, estimatedOutputBytes: MAX_SAFE_FFMPEG_OUTPUT_BYTES }).failureFallbacks, safeFallbacks("ffmpeg"));
  assert.deepEqual(decideVideoProcessingRoute({ ...base, estimatedOutputBytes: MAX_SAFE_FFMPEG_OUTPUT_BYTES + 1 }).failureFallbacks, safeFallbacks("reject"));
  assert.ok(Object.values(decideVideoProcessingRoute({ ...base, estimatedOutputBytes: Number.NaN }).failureFallbacks).every((fallback) => fallback.route === "reject"));
  assert.equal(isSafeFfmpegOutputSize(MAX_SAFE_FFMPEG_OUTPUT_BYTES), true);
  assert.equal(isSafeFfmpegOutputSize(MAX_SAFE_FFMPEG_OUTPUT_BYTES + 1), false);
  assert.equal(isSafeFfmpegOutputSize(Number.NaN), false);
  assert.equal(isSafeFfmpegOutputSize(-1), false);
});

function safeFallbacks(route: "ffmpeg" | "reject") {
  const reasonCode = route === "ffmpeg" ? "FALLBACK_OUTPUT_WITHIN_SAFE_LIMIT" : "FALLBACK_OUTPUT_EXCEEDS_SAFE_LIMIT";
  return { audio: { route, reasonCode }, "audio-demux": { route, reasonCode }, "video-codec": { route, reasonCode }, "mux-write": { route, reasonCode }, quota: { route, reasonCode } };
}

function expectedPlannedRoute(input: VideoRouteInput) {
  if (input.bitrateMode === "crf") return null;
  if (input.container !== "mp4" && input.container !== "mov") return null;
  if (input.codec !== "h264" && input.codec !== "hevc") return null;
  if (input.bitrateMode === "copy" && input.audioMode === "encode") return null;
  return input.bitrateMode === "copy" ? "stream-copy" : "webcodecs";
}

function expectedReason(input: VideoRouteInput): VideoRouteReasonCode {
  const plannedRoute = expectedPlannedRoute(input);
  if (!plannedRoute) {
    if (input.bitrateMode === "crf") return "CRF_REQUIRES_FFMPEG";
    if (input.container !== "mp4" && input.container !== "mov") return "CONTAINER_REQUIRES_FFMPEG";
    if (input.codec === "vp9") return "CODEC_REQUIRES_FFMPEG";
    return "COPY_AUDIO_ENCODE_REQUIRES_FFMPEG";
  }
  if (!input.opfsAvailable) return "OPFS_UNAVAILABLE";
  if (input.quota === "unknown") return "QUOTA_UNKNOWN";
  if (input.quota === "insufficient") return "QUOTA_INSUFFICIENT";
  return plannedRoute === "stream-copy" ? "STREAM_COPY_PENDING" : "WEBCODECS_PENDING";
}
