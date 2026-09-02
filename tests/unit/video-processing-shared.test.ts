import assert from "node:assert/strict";
import test from "node:test";

import type { VideoTask } from "../../src/features/video-studio/types.ts";
import {
  VideoResultQuotaError,
  countVideoOutputs,
  createVideoOutputName,
  createVideoWorkerResult,
  getVideoOutputMimeType,
  normalizeVideoProcessingError,
} from "../../src/features/video-studio/videoProcessingShared.ts";

const labels = {
  concatenated: "joined",
  passthrough: "copied",
  converted: "converted",
  animation: "animation",
  audio: "audio",
};
const message = (key: string, values: Record<string, unknown> = {}) => `${key}:${JSON.stringify(values)}`;
const copyTask: VideoTask = {
  kind: "encode",
  container: "mp4",
  codec: "hevc",
  resolution: "source",
  aspect: "source",
  crf: 23,
  bitrate: "copy",
  audioMode: "copy",
  audioBitrate: "192k",
  audioSampleRate: "source",
  rotation: 0,
  flipHorizontal: false,
};

test("shared output naming sanitizes names and covers video, GIF, and audio results", () => {
  assert.equal(createVideoOutputName("bad:name.mov", copyTask, false, labels), "bad-name-copied.mp4");
  assert.equal(createVideoOutputName("group.mp4", { kind: "gif", fps: 12, width: 480 }, true, labels), "group-joined-animation.gif");
  assert.equal(createVideoOutputName("sound.mov", { kind: "audio", format: "aac", bitrate: "192k", sampleRate: "source" }, false, labels), "sound-audio.m4a");
});

test("shared MIME selection is case-insensitive and preserves all output families", () => {
  assert.equal(getVideoOutputMimeType("clip.MP4"), "video/mp4");
  assert.equal(getVideoOutputMimeType("clip.webm"), "video/webm");
  assert.equal(getVideoOutputMimeType("clip.mkv"), "video/x-matroska");
  assert.equal(getVideoOutputMimeType("clip.gif"), "image/gif");
  assert.equal(getVideoOutputMimeType("clip.mp3"), "audio/mpeg");
  assert.equal(getVideoOutputMimeType("clip.m4a"), "audio/mp4");
});

test("shared result aggregation counts route batches and creates task warnings once", () => {
  assert.equal(countVideoOutputs([2, 0, -1, 3.5, 4]), 6);
  const result = createVideoWorkerResult([1, 2], copyTask, message);
  assert.equal(result.outputCount, 3);
  assert.equal(result.warnings.length, 4);
  assert.match(result.warnings[0], /processedOutputJobsAccordingToGroupSettings/);
  assert.match(result.warnings[1], /passthroughTrimmingMayStartSlightlyEarlierAtA/);
  assert.match(result.warnings[2], /theFirstAudioTrackWasPreservedWithoutRe/);
  assert.match(result.warnings[3], /hevcMayNotPlayOnEveryDeviceOr/);
});

test("shared error normalization classifies quota, memory, codec, and generic failures", () => {
  assert.equal(normalizeVideoProcessingError(new VideoResultQuotaError(), [], message).code, "RESULT_STORAGE_QUOTA");
  assert.equal(normalizeVideoProcessingError(new Error("failed"), ["Aborted(OOM)"], message).code, "OUT_OF_MEMORY");
  assert.equal(normalizeVideoProcessingError(new Error("Unknown encoder 'libx265'"), [], message).code, "CODEC_UNAVAILABLE");
  assert.equal(normalizeVideoProcessingError(new Error("bad input"), [], message).code, "VIDEO_PROCESSING_ERROR");
});
