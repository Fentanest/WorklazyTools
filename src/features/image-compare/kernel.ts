import pixelmatch from "pixelmatch";
import type { PixelOptions } from "./types.ts";

export const HIGHLIGHT_LIGHTER: [number, number, number] = [255, 59, 48], HIGHLIGHT_DARKER: [number, number, number] = [8, 201, 136];
export function compareRgba(left: Uint8ClampedArray, right: Uint8ClampedArray, width: number, height: number, leftValid: Uint8Array, rightValid: Uint8Array, options: PixelOptions) {
  const pixels = width * height;
  if (left.length !== pixels * 4 || right.length !== left.length || leftValid.length !== pixels || rightValid.length !== pixels) throw new Error("INVALID_RGBA");
  if (!Number.isFinite(options.threshold) || options.threshold < 0 || options.threshold > 1 || !Number.isInteger(options.alphaThreshold) || options.alphaThreshold < 0 || options.alphaThreshold > 255) throw new Error("INVALID_THRESHOLD");
  const a = left.slice(), b = right.slice(), diff = new Uint8ClampedArray(left.length);
  let comparablePixelCount = 0, addedBoundaryPixelCount = 0, removedBoundaryPixelCount = 0;
  for (let p = 0; p < pixels; p += 1) {
    const i = p * 4;
    if (!leftValid[p] || !rightValid[p]) { a.fill(0, i, i + 4); b.fill(0, i, i + 4); if (leftValid[p]) removedBoundaryPixelCount++; if (rightValid[p]) addedBoundaryPixelCount++; continue; }
    comparablePixelCount++;
    if (options.background !== "transparent") {
      const background = options.background === "white" ? 255 : 0;
      for (const image of [a, b]) { for (let c = 0; c < 3; c++) image[i + c] = Math.round(image[i + c] * image[i + 3] / 255 + background * (1 - image[i + 3] / 255)); image[i + 3] = 255; }
    } else {
      // Colors weighted by their opacity (premultiplied): a nearly transparent red and blue look
      // alike; an opacity difference itself is judged by alphaThreshold below.
      for (const image of [a, b]) { for (let c = 0; c < 3; c++) image[i + c] = Math.round(image[i + c] * image[i + 3] / 255); image[i + 3] = 255; }
    }
  }
  // Diffchecker's two highlight colors: red where the revised pixel is lighter, green where it is darker.
  pixelmatch(a, b, diff, width, height, { threshold: options.threshold, includeAA: options.includeAA, diffMask: true, diffColor: HIGHLIGHT_LIGHTER, diffColorAlt: HIGHLIGHT_DARKER });
  const changedMask = new Uint8Array(pixels), channelDelta = new Uint8Array(pixels), overlay = new Uint8ClampedArray(left.length), subtract = new Uint8ClampedArray(left.length);
  let changedPixelCount = 0;
  for (let p = 0; p < pixels; p++) {
    const i = p * 4, valid = leftValid[p] && rightValid[p];
    const alphaChanged = options.background === "transparent" && Math.abs(left[i + 3] - right[i + 3]) > options.alphaThreshold;
    const changed = !!valid && (diff[i + 3] > 0 || alphaChanged);
    changedMask[p] = changed ? 255 : 0; if (changed) changedPixelCount++;
    const delta = valid ? Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]), options.background === "transparent" ? Math.abs(left[i + 3] - right[i + 3]) : 0) : 0;
    channelDelta[p] = delta;
    // An opacity-only change (same source RGB) is shown in the first color: weighting by opacity
    // would otherwise make it look darker or lighter to pixelmatch.
    const opacityOnly = left[i] === right[i] && left[i + 1] === right[i + 1] && left[i + 2] === right[i + 2] && left[i + 3] !== right[i + 3];
    overlay.set(changed ? diff[i + 3] > 0 && !opacityOnly ? [diff[i], diff[i + 1], diff[i + 2], 255] : [...HIGHLIGHT_LIGHTER, 255] : [left[i], left[i + 1], left[i + 2], Math.round(left[i + 3] * 0.35)], i);
    subtract.set([delta, delta, delta, valid ? 255 : 0], i);
  }
  return { changedMask, channelDelta, overlay, subtract, changedPixelCount, comparablePixelCount, differenceRatio: comparablePixelCount ? changedPixelCount / comparablePixelCount : 0, addedBoundaryPixelCount, removedBoundaryPixelCount };
}
/** Changed pixels in their highlight colors on white, without the faded original (Diffchecker's "Changes only"). */
export function changesOnlyPixels(overlay: Uint8ClampedArray, changedMask: Uint8Array) {
  const output = new Uint8ClampedArray(overlay.length).fill(255);
  for (let p = 0; p < changedMask.length; p++) if (changedMask[p]) output.set(overlay.subarray(p * 4, p * 4 + 4), p * 4);
  return output;
}
