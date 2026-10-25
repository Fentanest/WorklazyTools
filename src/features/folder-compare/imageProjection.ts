import { disposeImageResult } from '../image-compare/memory.ts';
import type { ImageCompareResult } from '../image-compare/types.ts';
export interface ImagePreview { width: number; height: number; highlight: Uint8ClampedArray; left: Uint8ClampedArray; right: Uint8ClampedArray }
export type CompactImageResult = Pick<ImageCompareResult, 'width' | 'height' | 'changedPixelCount' | 'differenceRatio' | 'comparablePixelCount' | 'addedBoundaryPixelCount' | 'removedBoundaryPixelCount' | 'sources' | 'quality'> & { preview?: ImagePreview };
/** Longest side of the kept previews; three RGBA previews stay under about 6 MB. */
export const IMAGE_PREVIEW_SIDE = 800;
/** Small highlight/left/right previews (nearest sample; a block with any changed pixel keeps that pixel's color). */
export function imagePreview(result: ImageCompareResult): ImagePreview {
  const scale = Math.min(1, IMAGE_PREVIEW_SIDE / Math.max(result.width, result.height));
  const width = Math.max(1, Math.round(result.width * scale)), height = Math.max(1, Math.round(result.height * scale));
  const highlight = new Uint8ClampedArray(width * height * 4), left = new Uint8ClampedArray(highlight.length), right = new Uint8ClampedArray(highlight.length);
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y / scale), y1 = Math.max(y0 + 1, Math.min(result.height, Math.floor((y + 1) / scale)));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x / scale), x1 = Math.max(x0 + 1, Math.min(result.width, Math.floor((x + 1) / scale)));
      const center = Math.min(result.height - 1, (y0 + y1) >> 1) * result.width + Math.min(result.width - 1, (x0 + x1) >> 1);
      let source = center;
      search: for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) if (result.changedMask[sy * result.width + sx]) { source = sy * result.width + sx; break search; }
      const target = (y * width + x) * 4;
      highlight.set(result.overlay.subarray(source * 4, source * 4 + 4), target);
      left.set(result.left.subarray(center * 4, center * 4 + 4), target);
      right.set(result.right.subarray(center * 4, center * 4 + 4), target);
    }
  }
  return { width, height, highlight, left, right };
}
/** Copies only scalar provenance, then retires all eight owned pixel buffers before returning. */
export function compactImageResult(result: ImageCompareResult, signal?: AbortSignal): CompactImageResult {
  try {
    signal?.throwIfAborted();
    return { width: result.width, height: result.height, changedPixelCount: result.changedPixelCount, differenceRatio: result.differenceRatio,
      comparablePixelCount: result.comparablePixelCount, addedBoundaryPixelCount: result.addedBoundaryPixelCount, removedBoundaryPixelCount: result.removedBoundaryPixelCount,
      sources: structuredClone(result.sources), quality: structuredClone(result.quality), preview: imagePreview(result) };
  } finally { disposeImageResult(result); }
}
