import assert from "node:assert/strict";
import test from "node:test";

import { createHybridAudioFfmpegArguments, estimateHybridAudioBytes } from "../../src/features/video-studio/videoHybridAudio.ts";
import { estimateVideoJobOutputBytes, taskForVideoJob } from "../../src/features/video-studio/videoOutputEstimate.ts";
import type { VideoOutputJob, VideoTask, VideoWorkerInput } from "../../src/features/video-studio/types.ts";

const input = (duration = 60): VideoWorkerInput => ({
  fileName: "source.mp4",
  file: new File([new Uint8Array([0])], "source.mp4"),
  fileSize: 100_000_000,
  duration,
  width: 3840,
  height: 2160,
  frameRate: 30,
  start: 0,
  end: duration,
});

const task: Extract<VideoTask, { kind: "encode" }> = {
  kind: "encode", container: "mp4", codec: "h264", resolution: "source", aspect: "source",
  crf: 23, bitrate: "8M", audioMode: "encode", audioBitrate: "192k", audioSampleRate: 48_000,
  rotation: 0, flipHorizontal: false,
};

test("target output estimates use bits-per-second once and keep all audio modes explicit", () => {
  const job: VideoOutputJob = { name: "one", mode: "individual", inputs: [input()] };
  assert.equal(estimateVideoJobOutputBytes(job, task), ((8_000_000 + 192_000) / 8) * 60 * 1.1);
  assert.equal(estimateVideoJobOutputBytes(job, { ...task, audioMode: "remove" }), (8_000_000 / 8) * 60 * 1.1);
  assert.equal(estimateVideoJobOutputBytes(job, { ...task, audioMode: "copy" }, [128_000]), ((8_000_000 + 128_000) / 8) * 60 * 1.1);
  assert.equal(estimateVideoJobOutputBytes({ ...job, mode: "concat", inputs: [input(30), input(30)] }, { ...task, audioMode: "copy" }, [128_000, 256_000]), ((8_000_000 + 256_000) / 8) * 60 * 1.1);
  assert.equal(estimateVideoJobOutputBytes({ ...job, mode: "concat", inputs: [input(30), input(30)] }, { ...task, audioMode: "copy" }, [128_000, undefined]), ((8_000_000 + 320_000) / 8) * 60 * 1.1);
});

test("job-level audio removal selects the existing remove mode without changing sibling jobs", () => {
  const overridden: VideoOutputJob = { name: "one", mode: "individual", inputs: [input()], audioModeOverride: "remove" };
  assert.equal((taskForVideoJob(task, overridden) as typeof task).audioMode, "remove");
  assert.equal(task.audioMode, "encode");
});

test("hybrid audio uses filter-based trim and normalized concat before AAC output", () => {
  const args = createHybridAudioFfmpegArguments(
    [{ start: 1.25, end: 3.5 }, { start: 4, end: 7 }],
    ["/a/one.mp4", "/b/two.mp4"],
    task,
    "hybrid.m4a",
  );
  const filter = args[args.indexOf("-filter_complex") + 1];
  assert.match(filter, /atrim=start=1\.250000:end=3\.500000,asetpts=PTS-STARTPTS,aresample=48000,aformat=/);
  assert.match(filter, /\[a0\]\[a1\]concat=n=2:v=0:a=1\[hybrid-audio\]/);
  assert.equal(args.includes("-ss"), false);
  assert.equal(args[args.indexOf("-b:a") + 1], "192k");
  assert.equal(estimateHybridAudioBytes(192_000, 480), 13_824_000);
});
