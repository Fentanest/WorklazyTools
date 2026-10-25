import assert from "node:assert/strict";
import test from "node:test";

import { changesOnlyPixels, compareRgba, HIGHLIGHT_DARKER, HIGHLIGHT_LIGHTER } from "../../src/features/image-compare/kernel.ts";
import { regionPreset } from "../../src/features/image-compare/regionOptions.ts";
import { DEFAULT_PIXEL_OPTIONS } from "../../src/features/image-compare/types.ts";

const valid = (pixels: number) => new Uint8Array(pixels).fill(1);

test("highlight uses Diffchecker's two colors: red where the revised pixel is lighter, green where darker", () => {
  const left = Uint8ClampedArray.from([128, 128, 128, 255, 128, 128, 128, 255, 128, 128, 128, 255]);
  const right = Uint8ClampedArray.from([230, 230, 230, 255, 20, 20, 20, 255, 128, 128, 128, 255]);
  const result = compareRgba(left, right, 3, 1, valid(3), valid(3), DEFAULT_PIXEL_OPTIONS);
  assert.equal(result.changedPixelCount, 2);
  assert.deepEqual([...result.overlay.subarray(0, 4)], [...HIGHLIGHT_LIGHTER, 255]);
  assert.deepEqual([...result.overlay.subarray(4, 8)], [...HIGHLIGHT_DARKER, 255]);
  // Changes only: the unchanged pixel is white instead of the faded original.
  const only = changesOnlyPixels(result.overlay, result.changedMask);
  assert.deepEqual([...only.subarray(0, 4)], [...HIGHLIGHT_LIGHTER, 255]);
  assert.deepEqual([...only.subarray(8, 12)], [255, 255, 255, 255]);
});

test("region presets follow Diffchecker's values scaled by the image diagonal / 425", () => {
  assert.deepEqual(regionPreset("tiny", 1920, 1080), { diffThreshold: 80, groupingRadius: 0, minArea: 2, maxAreaFraction: 0.01 });
  // 1920x1080: e = 2202.9 / 425 = 5.18.
  assert.deepEqual(regionPreset("words", 1920, 1080), { diffThreshold: 20, groupingRadius: 12, minArea: 155, maxAreaFraction: 0.15 });
  assert.deepEqual(regionPreset("graphics", 1920, 1080), { diffThreshold: 25, groupingRadius: 25, minArea: 1037, maxAreaFraction: 0.5 });
  // Small images hit the lower clamps.
  assert.deepEqual(regionPreset("words", 100, 100), { diffThreshold: 20, groupingRadius: 2, minArea: 15, maxAreaFraction: 0.15 });
  assert.deepEqual(regionPreset("graphics", 100, 100), { diffThreshold: 25, groupingRadius: 5, minArea: 100, maxAreaFraction: 0.5 });
});

test("an opacity-only change keeps the first highlight color whatever the gray level", () => {
  const options = { ...DEFAULT_PIXEL_OPTIONS, background: "transparent" as const, alphaThreshold: 0 };
  for (const [gray, from, to] of [[128, 255, 64], [255, 255, 64], [0, 255, 64], [128, 64, 255]]) {
    const left = Uint8ClampedArray.from([gray, gray, gray, from]), right = Uint8ClampedArray.from([gray, gray, gray, to]);
    const result = compareRgba(left, right, 1, 1, valid(1), valid(1), options);
    assert.equal(result.changedPixelCount, 1, `${gray} ${from}->${to}`);
    assert.deepEqual([...result.overlay.subarray(0, 4)], [...HIGHLIGHT_LIGHTER, 255], `${gray} ${from}->${to}`);
  }
  // A real color change under the same transparency setting still uses the two colors.
  const darker = compareRgba(Uint8ClampedArray.from([200, 200, 200, 255]), Uint8ClampedArray.from([20, 20, 20, 255]), 1, 1, valid(1), valid(1), options);
  assert.deepEqual([...darker.overlay.subarray(0, 4)], [...HIGHLIGHT_DARKER, 255]);
});
