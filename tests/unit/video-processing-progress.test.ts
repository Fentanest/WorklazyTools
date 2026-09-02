import assert from "node:assert/strict";
import test from "node:test";

import { normalizeMonotonicOperationProgress } from "../../src/hooks/operationProgress.ts";
import {
  VIDEO_PROGRESS_STAGE_WEIGHTS,
  createVideoProcessingProgressController,
} from "../../src/features/video-studio/videoProcessingProgress.ts";

test("the video orchestrator keeps overall progress monotonic", () => {
  const events: Array<[number, string]> = [];
  const progress = createVideoProcessingProgressController((value, message) => events.push([value, message]));
  progress.reportOverall(4, "start");
  progress.reportOverall(63.6, "working");
  progress.reportOverall(21, "late lower event");
  progress.reportOverall(110, "bounded");
  assert.deepEqual(events.map(([value]) => value), [4, 64, 64, 100]);
  assert.equal(progress.current(), 100);
});

test("the video orchestrator weights stages and blocks every event after termination", () => {
  assert.equal(Object.values(VIDEO_PROGRESS_STAGE_WEIGHTS).reduce((total, weight) => total + weight, 0), 1);
  const events: number[] = [];
  const progress = createVideoProcessingProgressController((value) => events.push(value));
  progress.reportStage("demux", 100, "demuxed");
  progress.reportStage("decode", 50, "decoded");
  progress.terminate();
  progress.reportStage("write", 100, "late stage");
  progress.reportOverall(100, "late overall");
  assert.deepEqual(events, [10, 23]);
});

test("job stage aggregation uses duration for processing and bytes for result writes", () => {
  const events: number[] = [];
  const progress = createVideoProcessingProgressController((value) => events.push(value), [
    { durationSeconds: 10, expectedOutputBytes: 100 },
    { durationSeconds: 30, expectedOutputBytes: 300 },
  ]);
  progress.reportJobStage(0, "decode", 10, 10, "first decode");
  progress.reportJobStage(1, "decode", 15, 30, "second decode");
  progress.reportStage("demux", 100, "demux complete");
  progress.reportStage("decode", 100, "decode complete");
  progress.reportStage("encode", 100, "encode complete");
  progress.reportStage("mux", 100, "mux complete");
  progress.reportJobStage(0, "write", 100, 100, "first write");
  progress.reportJobStage(1, "write", 300, 300, "second write");
  assert.deepEqual(events, [6, 16, 26, 35, 75, 90, 93, 100]);
});

test("operation progress normalization never moves backward or accepts non-finite values", () => {
  assert.equal(normalizeMonotonicOperationProgress(41, 30), 41);
  assert.equal(normalizeMonotonicOperationProgress(41, 41.8), 42);
  assert.equal(normalizeMonotonicOperationProgress(42, Number.NaN), 42);
  assert.equal(normalizeMonotonicOperationProgress(99, 120), 100);
});
