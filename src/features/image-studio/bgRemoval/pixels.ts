import type { BgMode } from './assets.ts';
import { BgRemovalError } from './errors.ts';

export interface MaskStats { min: number; max: number; mean: number; variance: number }
/** Check alpha, not raw logits: large varying logits can all saturate to one alpha. */
export function validateMask(mask: Float32Array, logits: boolean): MaskStats {
  let min = Infinity, max = -Infinity, mean = 0, m2 = 0, count = 0;
  for (const raw of mask) {
    if (!Number.isFinite(raw)) throw new BgRemovalError('bg-mask-unusable');
    const alpha = logits ? 1 / (1 + Math.exp(-raw)) : Math.max(0, Math.min(1, raw));
    min = Math.min(min, alpha); max = Math.max(max, alpha);
    const delta = alpha - mean; mean += delta / ++count; m2 += delta * (alpha - mean);
  }
  const variance = m2 / count;
  // Less than one 8-bit alpha step, or stddev <= .001: no meaningful separation.
  if (!count || max - min <= 1 / 255 || variance <= 1e-6) throw new BgRemovalError('bg-mask-unusable');
  return { min, max, mean, variance };
}

/** Validate the entire mask before touching any source pixel. */
export function applyMask(rgba: Uint8ClampedArray, width: number, height: number, mask: Float32Array, mw: number, mh: number, logits: boolean): void {
  validateMask(mask, logits);
  multiplyAlpha(rgba, width, height, mask, mw, mh, logits);
}
export function inputSize(width: number, height: number, mode: BgMode): { width: number; height: number } {
  if (mode === 'product') return { width: 512, height: 512 };
  // Bitmap dimensions are positive integers. Keep the short side exact and
  // calculate only the long-side block count with integer division.
  const blocks = BigInt(Math.max(width, height)) * 16n / BigInt(Math.min(width, height));
  const longSide = Number(blocks * 32n);
  return width <= height ? { width: 512, height: longSide } : { width: longSide, height: 512 };
}
export function normalizeRgb(rgba: Uint8ClampedArray, width: number, height: number, mode: BgMode): Float32Array {
  const count = width * height, tensor = new Float32Array(count * 3);
  const mean = mode === 'person' ? [.5, .5, .5] : [.485, .456, .406];
  const std = mode === 'person' ? [.5, .5, .5] : [.229, .224, .225];
  for (let i = 0; i < count; i++) for (let c = 0; c < 3; c++) tensor[c * count + i] = (rgba[i * 4 + c] / 255 - mean[c]) / std[c];
  return tensor;
}
/** Half-pixel aligned bilinear expansion; preserve RGB and multiply existing alpha. */
export function multiplyAlpha(rgba: Uint8ClampedArray, width: number, height: number, mask: Float32Array, mw: number, mh: number, logits: boolean): void {
  const value = (index: number) => logits ? 1 / (1 + Math.exp(-mask[index])) : Math.max(0, Math.min(1, mask[index]));
  for (let y = 0; y < height; y++) {
    const fy = Math.max(0, Math.min(mh - 1, (y + .5) * mh / height - .5)), y0 = Math.floor(fy), y1 = Math.min(mh - 1, y0 + 1), dy = fy - y0;
    for (let x = 0; x < width; x++) {
      const fx = Math.max(0, Math.min(mw - 1, (x + .5) * mw / width - .5)), x0 = Math.floor(fx), x1 = Math.min(mw - 1, x0 + 1), dx = fx - x0;
      const top = value(y0 * mw + x0) * (1 - dx) + value(y0 * mw + x1) * dx;
      const bottom = value(y1 * mw + x0) * (1 - dx) + value(y1 * mw + x1) * dx;
      const index = (y * width + x) * 4 + 3;
      rgba[index] = Math.round(rgba[index] * (top * (1 - dy) + bottom * dy));
    }
  }
}
