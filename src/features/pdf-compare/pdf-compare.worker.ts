import { compareRgb } from './kernel.ts';
import { diffText } from '../document-compare/documentComparison.ts';
import type { PixelThreshold } from './types.ts';
self.onmessage = (event: MessageEvent<{ before: Uint8ClampedArray; after: Uint8ClampedArray; threshold: PixelThreshold; overlay: boolean; beforeText?: string; afterText?: string }>) => {
  try {
    const input = event.data;
    const result = compareRgb(input.before, input.after, input.threshold, input.overlay);
    const segments = input.beforeText !== undefined && input.afterText !== undefined ? diffText(input.beforeText, input.afterText) : [];
    self.postMessage({ ...result, segments }, result.diff ? { transfer: [result.diff.buffer] } : undefined);
  } catch { self.postMessage({ error: 'render-failed' }); }
};
