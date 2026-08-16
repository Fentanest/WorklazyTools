import assert from "node:assert/strict";
import test from "node:test";

import { appendVideoRateControl, outputDimensionsForSource, resolveAudioSampleRate, resolveConcatFrameRate } from "../../src/features/video-studio/videoEncoding.ts";

test("H.264 target bitrate does not also enable CRF", () => {
  const args: string[] = [];
  appendVideoRateControl(args, "h264", "5M", 23);
  assert.deepEqual(args, ["-preset", "veryfast", "-b:v", "5M", "-maxrate", "5M", "-bufsize", "10M"]);
  assert.equal(args.includes("-crf"), false);
});

test("H.264 automatic quality and VP9 retain their intended CRF modes", () => {
  const h264: string[] = [];
  appendVideoRateControl(h264, "h264", "0", 22);
  assert.deepEqual(h264, ["-preset", "veryfast", "-crf", "22"]);
  const vp9: string[] = [];
  appendVideoRateControl(vp9, "vp9", "5M", 28);
  assert.ok(vp9.includes("-crf") && vp9.includes("-b:v"));
});

test("resolution uses the short edge and never upscales the source", () => {
  assert.deepEqual(outputDimensionsForSource(1080, 1920, "source", "1080"), [1080, 1920]);
  assert.deepEqual(outputDimensionsForSource(640, 360, "source", "1080"), [640, 360]);
  assert.deepEqual(outputDimensionsForSource(1080, 1920, "9:16", "source"), [1080, 1920]);
});

test("audio sample rates respect encoder constraints", () => {
  assert.equal(resolveAudioSampleRate(44_100, "opus"), 48_000);
  assert.equal(resolveAudioSampleRate(96_000, "mp3"), 48_000);
  assert.equal(resolveAudioSampleRate(44_100, "aac"), 44_100);
  assert.equal(resolveAudioSampleRate(45_000, "aac"), 44_100);
  assert.equal(resolveAudioSampleRate(70_000, "aac"), 64_000);
});

test("concatenated videos use the highest trustworthy rate or a shared compatibility fallback", () => {
  assert.equal(resolveConcatFrameRate([24, 29.97, 60]), 60);
  assert.equal(resolveConcatFrameRate([undefined, 0, Number.NaN]), 30);
  assert.equal(resolveConcatFrameRate([30, 1_000]), 30);
});
