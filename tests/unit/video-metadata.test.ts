import assert from "node:assert/strict";
import test from "node:test";

import { hasUsableVideoRange, shouldProbeVideoMetadata } from "../../src/features/video-studio/videoMetadata.ts";

test("supplemental FPS probing never blocks a valid browser video range", () => {
  assert.equal(hasUsableVideoRange({ duration: 10, start: 1, end: 9 }), true);
  assert.equal(shouldProbeVideoMetadata({ duration: 10, frameRate: undefined, frameRateProbeStatus: "running" }), false);
});

test("an unavailable FPS is probed only once", () => {
  assert.equal(shouldProbeVideoMetadata({ duration: 10, frameRate: 0, frameRateProbeStatus: undefined }), true);
  assert.equal(shouldProbeVideoMetadata({ duration: 10, frameRate: 0, frameRateProbeStatus: "done" }), false);
  assert.equal(shouldProbeVideoMetadata({ duration: 10, frameRate: undefined, frameRateProbeStatus: "failed" }), false);
});
