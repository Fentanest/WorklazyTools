import type { BgMode } from './assets.ts';
import { BgRemovalError } from './errors.ts';
import { validateMask } from './pixels.ts';

export interface InferredMask { data: Float32Array; width: number; height: number }
/** Retry only a degenerate GPU mask, once, with the same verified graph on CPU. */
export async function inferUsableMask(mode: BgMode, infer: (provider: 'wasm' | 'webgpu') => Promise<InferredMask>, onFallback: () => void): Promise<InferredMask> {
  const provider = mode === 'product' ? 'webgpu' : 'wasm';
  const first = await infer(provider);
  try { validateMask(first.data, mode === 'product'); return first; }
  catch (error) {
    if (provider !== 'webgpu' || !(error instanceof BgRemovalError) || error.code !== 'bg-mask-unusable') throw error;
  }
  onFallback();
  const fallback = await infer('wasm');
  validateMask(fallback.data, true);
  return fallback;
}
