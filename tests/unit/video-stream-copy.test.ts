import assert from "node:assert/strict";
import test from "node:test";

import {
  compareVideoStreamInputProfiles,
  selectAudioStreamSamples,
  selectVideoStreamSamples,
  type VideoStreamInputProfile,
  type VideoStreamSampleInfo,
} from "../../src/features/video-studio/videoStreamCopy.ts";

const profile: VideoStreamInputProfile = {
  codec: "h264",
  video: {
    codecName: "avc1.64001e",
    sampleEntry: "avc1",
    configuration: new Uint8Array([1, 100, 0, 30]),
    width: 640,
    height: 360,
  },
  audio: {
    codecName: "mp4a.40.2",
    sampleEntry: "mp4a",
    configuration: new Uint8Array([0x11, 0x90]),
    channelCount: 2,
    sampleRate: 48_000,
  },
};

test("concat direct copy requires identical codec names, sample entries, configurations, dimensions, and audio settings", () => {
  const clone = structuredClone(profile);
  assert.equal(compareVideoStreamInputProfiles([profile, clone], true), true);
  assert.equal(compareVideoStreamInputProfiles([profile, { ...clone, video: { ...clone.video, width: 1280 } }], true), false);
  assert.equal(compareVideoStreamInputProfiles([profile, { ...clone, video: { ...clone.video, configuration: new Uint8Array([1, 100, 0, 31]) } }], true), false);
  assert.equal(compareVideoStreamInputProfiles([profile, { ...clone, audio: { ...clone.audio!, channelCount: 1 } }], true), false);
  assert.equal(compareVideoStreamInputProfiles([profile, { ...clone, audio: undefined }], true), false);
  assert.equal(compareVideoStreamInputProfiles([profile, { ...clone, audio: undefined }], false), true);
});

test("trim selection snaps to the nearest preceding keyframe and ends by decode timestamp", () => {
  const video = [
    sample(0, 0, 2, true),
    sample(1, 1, 4, false),
    sample(2, 2, 3, false),
    sample(3, 3, 4, true),
    sample(4, 4, 6, false),
    sample(5, 5, 7, false),
  ];
  const selection = selectVideoStreamSamples(video, 4.6, 6.1, 0);
  assert.ok(selection);
  assert.equal(selection.snappedPresentationSeconds, 4);
  assert.deepEqual(selection.samples.map((item) => item.number), [3, 4, 5]);
  assert.equal(selection.firstDecodeSeconds, 3);
  assert.equal(selection.endDecodeSeconds, 6);

  const audio = Array.from({ length: 8 }, (_, index) => sample(index, index, index, true));
  assert.deepEqual(selectAudioStreamSamples(audio, selection.firstDecodeSeconds, 6.1, 0).map((item) => item.number), [3, 4, 5, 6]);
});

function sample(number: number, dts: number, cts: number, isSync: boolean): VideoStreamSampleInfo {
  return {
    number,
    offset: number * 100,
    size: 100,
    dts,
    cts,
    duration: 1,
    timescale: 1,
    isSync,
  };
}
