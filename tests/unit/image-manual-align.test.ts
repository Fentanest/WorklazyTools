import assert from "node:assert/strict";
import test from "node:test";

import { transformMatrix, workingGeometry } from "../../src/features/image-compare/geometry.ts";
import { ImageWorkingHistory } from "../../src/features/image-compare/history.ts";
import { axisAligned, cornerSigns, imageCorners, resizeFromCorner, rotateFromPointer, snapMove, snapResize, tidyTransform } from "../../src/features/image-compare/manualAlign.ts";
import { DEFAULT_PIXEL_OPTIONS, IDENTITY_TRANSFORM, type Transform } from "../../src/features/image-compare/types.ts";

const at = (patch: Partial<Transform>): Transform => ({ ...IDENTITY_TRANSFORM, ...patch });
const close = (actual: number, expected: number, message?: string) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message ?? ""} ${actual} != ${expected}`);
const left = { width: 200, height: 100 }, right = { width: 100, height: 50 };

test("vertical scale is separate and optional: old transforms stay uniform", () => {
  assert.deepEqual(transformMatrix(100, 50, at({ scale: 2 })), transformMatrix(100, 50, at({ scale: 2, scaleY: 2 })));
  assert.deepEqual(transformMatrix(100, 50, at({ scale: 1, scaleY: 2 })), [1, 0, 0, 2, 0, -25]);
  assert.throws(() => transformMatrix(100, 50, at({ scaleY: 0.01 })), /INVALID_TRANSFORM/u);
  assert.throws(() => transformMatrix(100, 50, at({ scaleY: Number.NaN })), /INVALID_TRANSFORM/u);
  const geometry = workingGeometry(100, 50, 100, 50, at({ scaleY: 3 }));
  assert.equal(geometry.height, 150); assert.equal(geometry.width, 100);
  const history = new ImageWorkingHistory({ options: { ...DEFAULT_PIXEL_OPTIONS }, transform: at({ scale: 1.5, scaleY: 0.5 }) });
  assert.equal(history.current.transform.scaleY, 0.5);
  assert.equal("scaleY" in new ImageWorkingHistory({ options: { ...DEFAULT_PIXEL_OPTIONS }, transform: at({}) }).current.transform, false);
});

test("tidy transform rounds for the number fields and drops an equal vertical scale", () => {
  assert.deepEqual(tidyTransform(at({ x: 1.23456, y: -0.004, degrees: 10.004, scale: 1.234567, scaleY: 1.234567 })), at({ x: 1.23, y: -0, degrees: 10, scale: 1.2346 }));
  assert.equal(tidyTransform(at({ scale: 1, scaleY: 2 })).scaleY, 2);
});

test("move snapping: centre and edges when axis-aligned, centre only when rotated", () => {
  const edge = snapMove(left, right, at({ x: 5, y: 3 }), 8);
  assert.equal(edge.transform.x, 0); assert.equal(edge.transform.y, 0); assert.deepEqual(edge.guides, { x: 0, y: 0 });
  const centre = snapMove(left, right, at({ x: 47, y: 22 }), 8);
  assert.equal(centre.transform.x, 50); assert.equal(centre.transform.y, 25); assert.deepEqual(centre.guides, { x: 100, y: 50 });
  const free = snapMove(left, right, at({ x: 30, y: 12 }), 8);
  assert.equal(free.transform.x, 30); assert.deepEqual(free.guides, {});
  // At 30° the box edges are not the image edges: only the centre snaps.
  const rotated = snapMove(left, right, at({ x: 5, y: 3, degrees: 30 }), 8);
  assert.equal(rotated.transform.x, 5); assert.equal(rotated.transform.y, 3);
  assert.equal(snapMove(left, right, at({ x: 46, y: 21, degrees: 30 }), 8).transform.x, 50);
  assert.equal(axisAligned(91.4), true); assert.equal(axisAligned(-179), true); assert.equal(axisAligned(45), false);
  // A 90° turn swaps the box: the 50-pixel-wide box's left edge snaps to 0.
  const turned = snapMove(left, right, at({ x: -22, degrees: 90 }), 8);
  assert.equal(Math.round(Math.min(...imageCorners(right, turned.transform).map(p => p.x))), 0);
  // Astra R23: a centre never snaps to an edge (400-wide image at x=195: centre 395 is 5 from the right edge 400).
  const square = { width: 400, height: 300 };
  const cross = snapMove(square, square, at({ x: 195 }), 8);
  assert.equal(cross.transform.x, 195); assert.equal(cross.guides.x, undefined);
});

test("corner resize snapping lands the real corner on the edge it shows (Astra R22)", () => {
  const square = { width: 400, height: 300 }, bottomRight = cornerSigns(at({}))[2];
  // Locked: the pointer is near x=400 but the ratio projection would stop short; the snapped corner reaches 400.
  const locked = snapResize(square, square, at({}), bottomRight, { x: 397, y: 260 }, true, 8);
  const lockedCorner = imageCorners(square, locked.transform)[2];
  close(lockedCorner.x, 400); assert.equal(locked.guides.x, 400); assert.equal(locked.transform.scaleY, undefined);
  close(imageCorners(square, locked.transform)[0].x, 0); close(imageCorners(square, locked.transform)[0].y, 0);
  // Unlocked: each axis lands on its edge independently.
  const free = snapResize(square, square, at({}), bottomRight, { x: 397, y: 304 }, false, 8);
  const freeCorner = imageCorners(square, free.transform)[2];
  close(freeCorner.x, 400); close(freeCorner.y, 300); assert.deepEqual(free.guides, { x: 400, y: 300 });
  // Off: no guides and the pointer is followed.
  const off = snapResize(square, square, at({}), bottomRight, { x: 397, y: 260 }, false, -1);
  close(imageCorners(square, off.transform)[2].x, 397); assert.deepEqual(off.guides, {});
  // Rotated 90°: guides only where the final corner really is.
  const turned = at({ degrees: 90 }), corner = cornerSigns(turned)[2], start = imageCorners(square, turned)[2];
  const rotated = snapResize(square, square, turned, corner, { x: start.x + 3, y: start.y + 2 }, true, 8);
  const landed = imageCorners(square, rotated.transform)[2];
  if (rotated.guides.x !== undefined) close(landed.x, rotated.guides.x);
  if (rotated.guides.y !== undefined) close(landed.y, rotated.guides.y);
  // Not axis-aligned: no snapping.
  assert.deepEqual(snapResize(square, square, at({ degrees: 20 }), bottomRight, { x: 397, y: 260 }, true, 8).guides, {});
});

test("corner resize keeps the opposite corner, per axis or with a locked ratio", () => {
  const free = resizeFromCorner(right, at({}), { ux: 1, uy: 1 }, { x: 150, y: 100 }, false);
  assert.equal(free.scale, 1.5); assert.equal(free.scaleY, 2);
  assert.deepEqual(imageCorners(right, free).map(p => [Math.round(p.x * 1e6) / 1e6, Math.round(p.y * 1e6) / 1e6]), [[0, 0], [150, 0], [150, 100], [0, 100]]);
  const locked = resizeFromCorner(right, at({}), { ux: 1, uy: 1 }, { x: 150, y: 100 }, true);
  close(locked.scale, 1.6); assert.equal(locked.scaleY, undefined);
  // Rotated and flipped: the opposite visual corner stays where it was.
  const start = at({ x: 20, y: 10, degrees: 37, scale: 1.2, scaleY: 0.8, flipX: true });
  const signs = cornerSigns(start), before = imageCorners(right, start);
  for (const index of [0, 1, 2, 3]) {
    const opposite = (index + 2) % 4, next = resizeFromCorner(right, start, signs[index], { x: before[index].x + 13, y: before[index].y - 7 }, false), after = imageCorners(right, next);
    close(after[opposite].x, before[opposite].x, `corner ${index} x`); close(after[opposite].y, before[opposite].y, `corner ${index} y`);
    assert.equal(next.flipX, true); assert.equal(next.degrees, 37);
  }
  // A pointer crossing the anchor clamps to the minimum scale instead of flipping.
  assert.equal(resizeFromCorner(right, at({}), { ux: 1, uy: 1 }, { x: -40, y: -40 }, false).scale, 0.05);
});

test("rotation handle follows the pointer around the centre; Shift snaps to 5°", () => {
  const start = at({}), centre = { x: 50, y: 25 };
  close(rotateFromPointer(right, start, { x: centre.x, y: 0 }, { x: 100, y: centre.y }, false).degrees, 90);
  const snapped = rotateFromPointer(right, start, { x: centre.x, y: 0 }, { x: centre.x + 10, y: 0 }, true);
  assert.equal(snapped.degrees % 5, 0);
  close(rotateFromPointer(right, at({ degrees: 170 }), { x: 100, y: centre.y }, { x: centre.x, y: 75 }, false).degrees, -100);
});
