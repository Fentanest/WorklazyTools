import assert from "node:assert/strict";
import test from "node:test";

import {
  anchorRegionEffect,
  mapCanvasSelectionToImagePixels,
  orderRegionEffectsAboveBase,
  resolveRegionEffectSourceStrength,
} from "../../src/features/image-studio/regionEffectTransform.ts";

test("region effects retain their source-image anchor through move, scale and rotation", () => {
  assert.deepEqual(anchorRegionEffect([2, 0, 0, 2, 450, 300], -100, -50), [2, 0, 0, 2, 250, 200]);
  assert.deepEqual(anchorRegionEffect([0, 2, -2, 0, 450, 300], -100, -50), [0, 2, -2, 0, 550, 100]);
  assert.deepEqual(anchorRegionEffect([1, 0, 0, 1, 120, 80], 30, 20), [1, 0, 0, 1, 150, 100]);
});

test("region effect strength follows object zoom but never display DPR", () => {
  assert.equal(resolveRegionEffectSourceStrength(10, 0.5, 0.5), 20);
  assert.equal(resolveRegionEffectSourceStrength(10, 0.5, 0.5, 2), 10);
  // DPR is deliberately absent from the API, so the same edit has the same source strength on DPR 1, 2, or 3.
  assert.equal(resolveRegionEffectSourceStrength(10, 1, 1), 10);
});

test("region effect layers stay directly above the base image", () => {
  const base = { role: "base" };
  const firstEffect = { role: "effect", id: 1 };
  const secondEffect = { role: "effect", id: 2 };
  const label = { role: "label" };
  assert.deepEqual(
    orderRegionEffectsAboveBase([firstEffect, label, secondEffect, base], base, (item) => item.role === "effect"),
    [label, base, firstEffect, secondEffect],
  );
});

test("canvas selections map to source pixels across scale, rotation, flip and source edges", () => {
  assert.deepEqual(
    mapCanvasSelectionToImagePixels({
      selection: { left: 10, top: 10, width: 20, height: 20 },
      imageTransform: [1, 0, 0, 1, 50, 40],
      cropX: 0,
      cropY: 0,
      imageWidth: 100,
      imageHeight: 80,
      sourceWidth: 100,
      sourceHeight: 80,
    }).bounds,
    { left: 10, top: 10, width: 20, height: 20 },
  );
  assert.deepEqual(
    mapCanvasSelectionToImagePixels({
      selection: { left: 160, top: 20, width: 40, height: 40 },
      imageTransform: [0, 2, -2, 0, 200, 100],
      cropX: 0,
      cropY: 0,
      imageWidth: 100,
      imageHeight: 80,
      sourceWidth: 100,
      sourceHeight: 80,
    }).bounds,
    { left: 10, top: 40, width: 20, height: 20 },
  );
  assert.deepEqual(
    mapCanvasSelectionToImagePixels({
      selection: { left: 80, top: 30, width: 30, height: 40 },
      imageTransform: [-1, 0, 0, 1, 100, 50],
      cropX: 0,
      cropY: 0,
      imageWidth: 100,
      imageHeight: 80,
      sourceWidth: 100,
      sourceHeight: 80,
    }).bounds,
    { left: 40, top: 20, width: 30, height: 40 },
  );
});
