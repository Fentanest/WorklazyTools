import assert from "node:assert/strict";
import test from "node:test";

import { normalizeMonotonicOperationProgress } from "../../src/hooks/operationProgress.ts";
import {
  VIDEO_PROGRESS_STAGE_WEIGHTS,
  createVideoProcessingProgressController,
  videoProgressStageWeightsForRoute,
} from "../../src/features/video-studio/videoProcessingProgress.ts";
import { createVideoProgressCoalescer } from "../../src/features/video-studio/videoProgressCoalescer.ts";
import { upsertOperationLogEntry, type OperationLogEntryValue } from "../../src/hooks/operationProgress.ts";

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
  assert.deepEqual(events, [8, 18]);
});

test("job stage aggregation uses duration for processing and bytes for result writes", () => {
  const events: number[] = [];
  const progress = createVideoProcessingProgressController((value) => events.push(value), [
    { durationSeconds: 10, expectedOutputBytes: 100, route: "hybrid" },
    { durationSeconds: 30, expectedOutputBytes: 300, route: "hybrid" },
  ]);
  progress.reportStage("audio", 100, "audio complete");
  progress.reportJobStage(0, "decode", 10, 10, "first decode");
  progress.reportJobStage(1, "decode", 15, 30, "second decode");
  progress.reportStage("demux", 100, "demux complete");
  progress.reportStage("decode", 100, "decode complete");
  progress.reportStage("encode", 100, "encode complete");
  progress.reportStage("mux", 100, "mux complete");
  progress.reportJobStage(0, "write", 100, 100, "first write");
  progress.reportJobStage(1, "write", 300, 300, "second write");
  assert.deepEqual(events, [15, 20, 28, 36, 43, 78, 90, 93, 100]);
});

test("stream-copy and webcodecs remove the inactive audio stage while hybrid retains it", () => {
  for (const route of ["stream-copy", "webcodecs"] as const) {
    const weights = videoProgressStageWeightsForRoute(route);
    assert.equal(weights.audio, 0);
    assert.ok(Math.abs(Object.values(weights).reduce((sum, value) => sum + value, 0) - 1) < 1e-12);
    const values: number[] = [];
    const progress = createVideoProcessingProgressController((value) => values.push(value), [
      { durationSeconds: 10, expectedOutputBytes: 100, route },
    ]);
    progress.reportJobStage(0, "demux", 1, 1, "demux");
    progress.reportJobStage(0, "decode", 1, 1, "decode");
    progress.reportJobStage(0, "encode", 1, 1, "encode");
    progress.reportJobStage(0, "mux", 1, 1, "mux");
    progress.reportJobStage(0, "write", 1, 1, "write");
    assert.deepEqual(values, [9, 33, 74, 88, 100]);
  }
  assert.equal(videoProgressStageWeightsForRoute("hybrid").audio, 0.15);
  assert.equal(videoProgressStageWeightsForRoute("ffmpeg").audio, 0.15);
});

test("mixed-route batches apply active weights per job and finish without an 85-to-100 jump", () => {
  const values: number[] = [];
  const progress = createVideoProcessingProgressController((value) => values.push(value), [
    { durationSeconds: 10, expectedOutputBytes: 100, route: "stream-copy" },
    { durationSeconds: 10, expectedOutputBytes: 100, route: "hybrid" },
  ]);
  for (const stage of ["demux", "decode", "encode", "mux", "write"] as const) {
    progress.reportJobStage(0, stage, 1, 1, `copy ${stage}`);
  }
  for (const stage of ["audio", "demux", "decode", "encode", "mux", "write"] as const) {
    progress.reportJobStage(1, stage, 1, 1, `hybrid ${stage}`);
  }
  assert.equal(values.at(-1), 100);
  assert.ok(values.every((value, index) => index === 0 || value >= values[index - 1]));
  assert.ok(values.some((value) => value > 85 && value < 100));
});

test("worker stage coalescing bounds 50,000 raw reports and always preserves explicit completion", () => {
  let clock = 0;
  const emissions: Array<{ percent: number; explicitCompletion: boolean }> = [];
  const coalescer = createVideoProgressCoalescer((event) => emissions.push({
    percent: Math.floor(event.completedUnits / event.totalUnits * 100),
    explicitCompletion: event.explicitCompletion,
  }), () => clock);
  for (let index = 0; index < 50_000; index += 1) coalescer.report("mux", index, 50_000, "mux");
  coalescer.report("mux", 50_000, 50_000, "mux");
  const beforeExplicit = emissions.length;
  coalescer.report("mux", 50_000, 50_000, "mux complete", true);
  assert.ok(beforeExplicit <= 101, `unexpected emission count: ${beforeExplicit}`);
  assert.equal(emissions.length, beforeExplicit + 1);
  assert.equal(emissions.at(-1)?.explicitCompletion, true);
  clock = 101;
  assert.equal(coalescer.report("write", 1, 100, "write"), true);
  clock = 202;
  assert.equal(coalescer.report("write", 1, 100, "write heartbeat"), true);
});

test("alternating stage reports update two rows in place and track a non-final active row", () => {
  let logs: OperationLogEntryValue[] = [{ id: 1, message: "start", progress: 1, elapsedMs: 0, status: "running" }];
  let activeLogId = 1;
  for (let index = 0; index < 30; index += 1) {
    for (const stageKey of ["video:0:mux", "video:0:write"]) {
      const result = upsertOperationLogEntry(logs, {
        id: 2 + index * 2 + (stageKey.endsWith("write") ? 1 : 0),
        stageKey,
        message: stageKey,
        progress: index + 2,
        elapsedMs: index,
        status: "running",
      });
      logs = result.logs;
      activeLogId = result.activeLogId;
    }
  }
  const activeMux = upsertOperationLogEntry(logs, {
    id: 100,
    stageKey: "video:0:mux",
    message: "mux complete",
    progress: 99,
    elapsedMs: 31,
    status: "running",
  });
  assert.equal(activeMux.logs.length, 3);
  assert.equal(activeMux.activeLogId, activeMux.logs[1].id);
  assert.notEqual(activeMux.activeLogId, activeMux.logs.at(-1)?.id);
  assert.equal(activeLogId, logs.at(-1)?.id);
  const finished = upsertOperationLogEntry(activeMux.logs, { id: 101, message: "done", progress: 100, elapsedMs: 32, status: "success" });
  assert.equal(finished.logs.length, 4);
});

test("operation progress normalization never moves backward or accepts non-finite values", () => {
  assert.equal(normalizeMonotonicOperationProgress(41, 30), 41);
  assert.equal(normalizeMonotonicOperationProgress(41, 41.8), 42);
  assert.equal(normalizeMonotonicOperationProgress(42, Number.NaN), 42);
  assert.equal(normalizeMonotonicOperationProgress(99, 120), 100);
});
