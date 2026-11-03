import type { BgMode } from './assets.ts';
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
