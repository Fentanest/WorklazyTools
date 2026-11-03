import { acquireAssets, assetsFor, CACHE_NAME, prepareAssets, verifyAsset, type VerifiedAsset } from '../../src/features/image-studio/bgRemoval/assets.ts';
const w = window as unknown as Record<string, any>;
let held: VerifiedAsset[] = [];
const assets = assetsFor('product', new URL('/', location.href).href);
w.seed = async () => {
  const cache = await caches.open(CACHE_NAME);
  for (const asset of assets) {
    const response = await fetch(asset.url, { cache: 'no-store' });
    const buffer = await response.arrayBuffer(); await verifyAsset(buffer, asset);
    await cache.put(asset.url, new Response(buffer));
  }
};
w.runAssets = async () => {
  const started = performance.now(), phases: unknown[] = [];
  const plan = await prepareAssets(assets, caches);
  phases.push({ stage: 'planned', at: performance.now() - started, missingBytes: plan.missingBytes });
  let cacheFailures = 0;
  held = await acquireAssets(plan, new AbortController().signal,
    (id, current, total) => { if (current === total) phases.push({ stage: 'downloaded', id, at: performance.now() - started }); },
    () => cacheFailures++);
  phases.push({ stage: 'verified-and-cached', at: performance.now() - started });
  return { phases, cacheFailures, bytes: held.reduce((sum, item) => sum + item.buffer.byteLength, 0),
    assets: held.map(item => ({ id: item.asset.id, bytes: item.buffer.byteLength, sha256: item.asset.sha256, source: item.source })) };
};
// Run outside the measured interval: prove the actual bytes and transfer/cache
// ownership without adding a diagnostic digest allocation to the measured peak.
w.check = async () => {
  for (const item of held) await verifyAsset(item.buffer, item.asset);
  const transferred = structuredClone(held, { transfer: held.map(item => item.buffer) });
  if (held.some(item => item.buffer.byteLength !== 0)) throw new Error('asset transfer copied rather than detached');
  for (const item of transferred) await verifyAsset(item.buffer, item.asset);
  held = [];
  const warm = await prepareAssets(assets, caches);
  if (warm.missingBytes !== 0 || warm.cached.size !== assets.length) throw new Error('cache bytes did not survive transfer');
  return { transferredAndVerified: true, cachedAndVerified: true };
};
w.ready = true; document.getElementById('status')!.textContent = 'Ready';
