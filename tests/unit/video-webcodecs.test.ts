import assert from "node:assert/strict";
import test from "node:test";

import type { VideoTask, VideoWorkerInput } from "../../src/features/video-studio/types.ts";
import {
  assessVideoWebCodecsSupport,
  assessVideoHybridSupport,
  createVideoWebCodecsAudioEncoderConfig,
  createVideoWebCodecsEncoderConfig,
  parsedVideoTrackFrameRate,
  resolveVideoFrameCanvasTransform,
  resolveVideoFrameTransformLayout,
  resolveVideoWebCodecsFrameRate,
  type VideoWebCodecsSupportApi,
} from "../../src/features/video-studio/videoWebCodecs.ts";

const targetTask: Extract<VideoTask, { kind: "encode" }> = {
  kind: "encode",
  container: "mp4",
  codec: "h264",
  resolution: "720",
  aspect: "1:1",
  crf: 23,
  bitrate: "5M",
  audioMode: "encode",
  audioBitrate: "192k",
  audioSampleRate: 44_100,
  rotation: 90,
  flipHorizontal: true,
};

const input = (frameRate: number | undefined = 30): VideoWorkerInput => ({
  fileName: "source.mp4",
  file: new File([new Uint8Array([0])], "source.mp4", { type: "video/mp4" }),
  fileSize: 1,
  duration: 2,
  width: 1280,
  height: 720,
  frameRate,
  start: 0,
  end: 2,
});

test("missing AudioEncoder and rejected selected video codec cause whole-job fallback", async () => {
  const request = {
    videoDecoderConfigs: [{ codec: "avc1.64001f" }],
    videoEncoderConfig: createVideoWebCodecsEncoderConfig(targetTask, 720, 720, 30),
    audioMode: "encode" as const,
    audioDecoderConfigs: [{ codec: "mp4a.40.2", sampleRate: 48_000, numberOfChannels: 2 }],
    audioEncoderConfig: createVideoWebCodecsAudioEncoderConfig(targetTask, 48_000, 2, false),
    audioTracksCompatible: true,
  };
  const supported = async <Config>(config: Config) => ({ config, supported: true });
  const api: VideoWebCodecsSupportApi = {
    offscreenCanvasAvailable: true,
    videoDecoder: { isConfigSupported: supported },
    videoEncoder: { isConfigSupported: supported },
    audioDecoder: { isConfigSupported: supported },
  };
  assert.deepEqual(await assessVideoWebCodecsSupport(request, api), {
    compatible: false,
    reasonCode: "AUDIO_ENCODER_UNAVAILABLE",
  });
  assert.deepEqual(await assessVideoWebCodecsSupport(request, {
    ...api,
    videoEncoder: { isConfigSupported: async (config) => ({ config, supported: false }) },
    audioEncoder: { isConfigSupported: supported },
  }), {
    compatible: false,
    reasonCode: "VIDEO_ENCODER_UNSUPPORTED",
  });
  assert.deepEqual(await assessVideoWebCodecsSupport({ ...request, audioMode: "remove" }, api), {
    compatible: true,
    reasonCode: "READY",
  });
  assert.deepEqual(await assessVideoWebCodecsSupport({ ...request, audioMode: "copy", audioTracksCompatible: false }, api), {
    compatible: false,
    reasonCode: "AUDIO_TRACK_MISMATCH",
  });
  assert.deepEqual(await assessVideoWebCodecsSupport({
    ...request,
    audioMode: "encode",
    audioDecoderConfigs: [],
    audioEncoderConfig: undefined,
  }, api), {
    compatible: true,
    reasonCode: "READY",
  });
  assert.deepEqual(await assessVideoHybridSupport({
    videoDecoderConfigs: request.videoDecoderConfigs,
    videoEncoderConfig: request.videoEncoderConfig,
    audioEncoderConfig: request.audioEncoderConfig,
    hasAudio: true,
  }, api), { compatible: true, reasonCode: "READY" });
  assert.deepEqual(await assessVideoHybridSupport({
    videoDecoderConfigs: request.videoDecoderConfigs,
    videoEncoderConfig: request.videoEncoderConfig,
    audioEncoderConfig: request.audioEncoderConfig,
    hasAudio: true,
  }, { ...api, audioEncoder: { isConfigSupported: supported } }), {
    compatible: false,
    reasonCode: "AUDIO_ENCODER_SUPPORTED",
  });
});

test("encoder configs preserve the selected codec and no-preference hardware policy", () => {
  assert.deepEqual(createVideoWebCodecsEncoderConfig(targetTask, 720, 720, 30), {
    codec: "avc1.42001f",
    width: 720,
    height: 720,
    displayWidth: 720,
    displayHeight: 720,
    bitrate: 5_000_000,
    bitrateMode: "variable",
    framerate: 30,
    hardwareAcceleration: "no-preference",
    latencyMode: "realtime",
    avc: { format: "avc" },
  });
  const hevc = createVideoWebCodecsEncoderConfig({ ...targetTask, codec: "hevc" }, 1280, 720, 60);
  assert.equal(hevc.codec, "hvc1.1.6.L93.B0");
  assert.equal(hevc.hardwareAcceleration, "no-preference");
  assert.equal(hevc.avc, undefined);
  assert.equal(createVideoWebCodecsEncoderConfig({ ...targetTask, resolution: "source", aspect: "source", bitrate: "8M" }, 3840, 2160, 30).codec, "avc1.420033");
});

test("concat requires every measured FPS and applies crop, normalization, rotation, and flip geometry", () => {
  const concat = { mode: "concat" as const, inputs: [input(24), { ...input(60), width: 720, height: 1280 }] };
  assert.equal(resolveVideoWebCodecsFrameRate(concat), 60);
  assert.equal(resolveVideoWebCodecsFrameRate({ ...concat, inputs: [input(24), { ...input(), frameRate: undefined }] }), undefined);
  assert.equal(resolveVideoWebCodecsFrameRate({ mode: "individual", inputs: [{ ...input(), frameRate: undefined }] }, [29.97]), 29.97);
  assert.ok(Math.abs(parsedVideoTrackFrameRate([{ duration: 1001, timescale: 30_000 }, { duration: 1001, timescale: 30_000 }])! - 30_000 / 1001) < 1e-9);

  const crop = resolveVideoFrameTransformLayout(input(30), targetTask, [720, 720], true);
  assert.deepEqual(
    { sourceX: crop.sourceX, sourceY: crop.sourceY, sourceWidth: crop.sourceWidth, sourceHeight: crop.sourceHeight },
    { sourceX: 280, sourceY: 0, sourceWidth: 720, sourceHeight: 720 },
  );
  assert.deepEqual([crop.outputWidth, crop.outputHeight], [720, 720]);
  assert.deepEqual(resolveVideoFrameCanvasTransform(90, true, [720, 720]), [0, 1, 1, 0, 0, 0]);

  const padded = resolveVideoFrameTransformLayout(
    { width: 720, height: 1280 },
    { ...targetTask, aspect: "source", rotation: 0, flipHorizontal: false },
    [1280, 720],
    true,
  );
  assert.equal(padded.destinationWidth, 405);
  assert.equal(padded.destinationHeight, 720);
  assert.equal(padded.destinationX, 437.5);
});
