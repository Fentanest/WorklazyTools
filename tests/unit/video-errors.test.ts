import assert from "node:assert/strict";
import test from "node:test";

import { classifyVideoProcessingFailure } from "../../src/features/video-studio/videoErrors.ts";

test("FFmpeg OOM diagnostics override a generic processing error", () => {
  const code = classifyVideoProcessingFailure(
    new Error("Unable to process the selected video"),
    ["frame=   23 fps=6.4", "Aborted(OOM)"],
  );
  assert.equal(code, "OUT_OF_MEMORY");
});

test("common browser memory failures are classified without exposing raw diagnostics", () => {
  assert.equal(classifyVideoProcessingFailure(new Error("memory access out of bounds")), "OUT_OF_MEMORY");
  assert.equal(classifyVideoProcessingFailure(new Error("Cannot enlarge memory arrays")), "OUT_OF_MEMORY");
});

test("codec and generic processing failures remain distinct", () => {
  assert.equal(classifyVideoProcessingFailure(new Error("Unknown encoder 'libx265'")), "CODEC_UNAVAILABLE");
  assert.equal(classifyVideoProcessingFailure(new Error("Invalid data found when processing input")), "VIDEO_PROCESSING_ERROR");
});
