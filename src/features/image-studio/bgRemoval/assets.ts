import manifest from './model.manifest.json' with { type: 'json' };
import { BgRemovalError, cancelled } from './errors.ts';
export type BgMode = 'person' | 'product';
export interface Asset { id: string; url: string; bytes: number; sha256: string }
export interface VerifiedAsset { asset: Asset; buffer: ArrayBuffer; source: 'cache' | 'network' }
export interface AssetPlan { assets: Asset[]; cached: Map<string, VerifiedAsset>; cache: Cache | null; missingBytes: number; cacheFailed: boolean }
export const CACHE_NAME = manifest.cacheName;
export { manifest };
export function assetsFor(mode: BgMode, baseUrl: string): Asset[] {
  const model = manifest.models.find(item => item.id === mode)!;
  const runtime = manifest.runtimes.find(item => item.id === model.runtime)!;
  return [model, runtime].map(item => ({ id: item.id, bytes: item.bytes, sha256: item.sha256, url: new URL(item.url, baseUrl).href }));
}
export async function sha256(buffer: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)), b => b.toString(16).padStart(2, '0')).join('');
}
export async function verifyAsset(buffer: ArrayBuffer, asset: Asset): Promise<void> {
  if (buffer.byteLength !== asset.bytes || await sha256(buffer) !== asset.sha256) throw new BgRemovalError('bg-model-integrity');
}
export async function prepareAssets(assets: Asset[], storage: CacheStorage | null, signal?: AbortSignal): Promise<AssetPlan> {
  const plan: AssetPlan = { assets, cached: new Map(), cache: null, missingBytes: 0, cacheFailed: !storage };
  try { plan.cache = await storage?.open(CACHE_NAME) ?? null; } catch { plan.cacheFailed = true; }
  for (const asset of assets) {
    cancelled(signal);
    try {
      const response = await plan.cache?.match(asset.url);
      if (response) {
        const buffer = await response.arrayBuffer();
        try { await verifyAsset(buffer, asset); plan.cached.set(asset.id, { asset, buffer, source: 'cache' }); }
        catch { await plan.cache?.delete(asset.url); }
      }
    } catch { plan.cacheFailed = true; }
    if (!plan.cached.has(asset.id)) plan.missingBytes += asset.bytes;
  }
  cancelled(signal); return plan;
}
export async function acquireAssets(plan: AssetPlan, signal: AbortSignal, onProgress: (id: string, current: number, total: number) => void,
  onCacheFailure: () => void, fetcher: typeof fetch = fetch): Promise<VerifiedAsset[]> {
  const verified: VerifiedAsset[] = [];
  if (plan.cacheFailed) onCacheFailure();
  for (const asset of plan.assets) {
    cancelled(signal);
    const cached = plan.cached.get(asset.id);
    if (cached) { verified.push(cached); continue; }
    let buffer: ArrayBuffer;
    try {
      const response = await fetcher(asset.url, { signal, credentials: 'omit', cache: 'no-store', redirect: 'error' });
      if (!response.ok || !response.body) throw new BgRemovalError('bg-model-fetch-failed');
      // The manifest pins the exact length. Copy each chunk into its final
      // allocation immediately instead of retaining a second model-sized list.
      const bytes = new Uint8Array(asset.bytes);
      const reader = response.body.getReader(); let length = 0;
      try {
        while (true) {
          cancelled(signal); const { done, value } = await reader.read(); if (done) break;
          if (value.byteLength > bytes.byteLength - length) throw new BgRemovalError('bg-model-integrity');
          bytes.set(value, length); length += value.byteLength;
          onProgress(asset.id, length, asset.bytes);
        }
      } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
      // A zero-filled tail must never make a short response look complete.
      if (length !== asset.bytes) throw new BgRemovalError('bg-model-integrity');
      buffer = bytes.buffer;
    } catch (error) {
      cancelled(signal);
      throw error instanceof BgRemovalError ? error : new BgRemovalError('bg-model-fetch-failed');
    }
    cancelled(signal); await verifyAsset(buffer, asset); cancelled(signal);
    // Response snapshots its BufferSource body. Its owned bytes survive the
    // later transfer to the worker; an explicit slice adds another whole copy.
    try { await plan.cache?.put(asset.url, new Response(buffer, { headers: { 'Content-Type': 'application/octet-stream' } })); }
    catch { onCacheFailure(); }
    cancelled(signal); verified.push({ asset, buffer, source: 'network' });
  }
  return verified;
}
