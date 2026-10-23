import { IMAGE_LIMITS } from "./types.ts";
const MiB = 1024 * 1024;
export const MAX_REGION_PASSES = 3;
// The pinned WASM declares 2048 initial memory pages (128 MiB), before any Mat exists.
export const CV_INITIAL_MEMORY_BYTES = 2048 * 65536;
const CV_ASSET_TRANSIENT_BYTES = 3 * 8355721 + 8 * 128047; // Fetch/hash/compiled-code and JS parsing reserve.
const REGION_RESULTS_BYTES = MAX_REGION_PASSES * 8 * MiB; // Up to 5000 boxed/source-polygon records per pass.

/** Conservative concurrent reservations, not a measurement of browser process RSS.
 * Sources: max 16-bit RGBA decode + conversion/bitmap/codec scratch = 24 bytes/source pixel.
 * Compare: retained RGBA/masks/outputs20 + pixelmatch copies12 + render staging16 =48/output pixel.
 * Views: retained20 + two canvases8 + ImageData copies8 + fade/prior frames8 =44/output pixel.
 * Regions: views44 + transferred delta1 + JS threshold mask1 + fixed128 MiB CV arena.
 * Masks, native contour vectors, hierarchy and ROI scratch live inside that arena. Its JS
 * allocator is capped before initialization; excessive complexity fails rather than growing.
 */
export function imageMemoryEstimate(sourcePixels: number, outputPixels: number, encodedBytes: number, previousViewBytes = 0, retainedSessionBytes = 0) {
  if (![sourcePixels, outputPixels, encodedBytes, previousViewBytes, retainedSessionBytes].every((value) => Number.isSafeInteger(value) && value >= 0)) throw new Error("INVALID_RESOURCE_ESTIMATE");
  const encoded = encodedBytes * 3; // Original File backing + transferred buffers + decoder Blob copies.
  const decoded = sourcePixels * 24;
  const cvHeapBytes = CV_INITIAL_MEMORY_BYTES;
  const stages = {
    decode: encoded + decoded + previousViewBytes + retainedSessionBytes,
    comparison: encoded + decoded + outputPixels * 48 + previousViewBytes + retainedSessionBytes,
    views: encoded + outputPixels * 44 + previousViewBytes + retainedSessionBytes,
    regions: encoded + outputPixels * 46 + cvHeapBytes + CV_ASSET_TRANSIENT_BYTES + REGION_RESULTS_BYTES + retainedSessionBytes,
  };
  return { sourcePixels, outputPixels, encodedBytes, previousViewBytes, retainedSessionBytes, cvHeapBytes, stages, estimatedPeakBytes: Math.max(...Object.values(stages)), budgetBytes: IMAGE_LIMITS.memoryBytes };
}
export function assertImageBudget(sourcePixels: number, outputPixels: number, encodedBytes: number, previousViewBytes = 0, retainedSessionBytes = 0) {
  const estimate = imageMemoryEstimate(sourcePixels, outputPixels, encodedBytes, previousViewBytes, retainedSessionBytes);
  if (estimate.estimatedPeakBytes > estimate.budgetBytes) throw new Error("IMAGE_MEMORY_LIMIT");
  return estimate;
}
export function validateImageFileSizes(files: ReadonlyArray<{ size: number }>) {
  for (const file of files) if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > IMAGE_LIMITS.fileBytes) throw new Error("IMAGE_FILE_LIMIT");
}

/** Transfer-and-discard detaches owned working buffers; original File/Blob sources are untouched. */
export function discardOwnedBuffer(buffer: ArrayBufferLike) {
  if (buffer instanceof ArrayBuffer && buffer.byteLength) structuredClone(undefined, { transfer: [buffer] });
}
export function disposeImageResult(result: import("./types.ts").ImageCompareResult | undefined) {
  if (!result) return;
  const buffers = new Set([result.left, result.right, result.leftValid, result.rightValid, result.changedMask, result.channelDelta, result.overlay, result.subtract].map((array) => array.buffer));
  for (const buffer of buffers) discardOwnedBuffer(buffer);
}

export function assertAlignmentBudget(sourcePixels:number,encodedBytes:number,retainedBytes:number){
  if(![sourcePixels,encodedBytes,retainedBytes].every(v=>Number.isSafeInteger(v)&&v>=0))throw new Error("INVALID_RESOURCE_ESTIMATE");
  const estimate=3*encodedBytes+24*sourcePixels+retainedBytes+CV_INITIAL_MEMORY_BYTES+CV_ASSET_TRANSIENT_BYTES+4*MiB;
  if(estimate>IMAGE_LIMITS.memoryBytes)throw new Error("IMAGE_MEMORY_LIMIT");
  return estimate;
}
