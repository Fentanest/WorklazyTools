import { disposeImageResult } from '../image-compare/memory.ts';
import type { ImageCompareResult } from '../image-compare/types.ts';
export type CompactImageResult = Pick<ImageCompareResult, 'width' | 'height' | 'changedPixelCount' | 'differenceRatio' | 'comparablePixelCount' | 'addedBoundaryPixelCount' | 'removedBoundaryPixelCount' | 'sources' | 'quality'>;
/** Copies only scalar provenance, then retires all eight owned pixel buffers before returning. */
export function compactImageResult(result: ImageCompareResult, signal?: AbortSignal): CompactImageResult {
  try {
    signal?.throwIfAborted();
    return { width: result.width, height: result.height, changedPixelCount: result.changedPixelCount, differenceRatio: result.differenceRatio,
      comparablePixelCount: result.comparablePixelCount, addedBoundaryPixelCount: result.addedBoundaryPixelCount, removedBoundaryPixelCount: result.removedBoundaryPixelCount,
      sources: structuredClone(result.sources), quality: structuredClone(result.quality) };
  } finally { disposeImageResult(result); }
}
