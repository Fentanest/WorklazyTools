import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acquireAssets, assetsFor, prepareAssets, sha256, verifyAsset, type Asset } from '../assets.ts';
import { inputSize, normalizeRgb, multiplyAlpha } from '../pixels.ts';
import { BgRemovalError, normalizeError, messages } from '../errors.ts';
class MemoryCache {
  items = new Map<string, ArrayBuffer>(); deleted: string[] = []; failPut = false;
  async match(url: string) { const bytes = this.items.get(url); return bytes ? new Response(bytes.slice(0)) : undefined; }
  async put(url: string, response: Response) { if (this.failPut) throw new DOMException('quota', 'QuotaExceededError'); this.items.set(url, await response.arrayBuffer()); }
  async delete(url: string) { this.deleted.push(url); return this.items.delete(url); }
  storage() { return { open: async () => this } as unknown as CacheStorage; }
}
async function fixtures() {
  const a = new Uint8Array([1, 2, 3]).buffer, b = new Uint8Array([4, 5]).buffer;
  const assets: Asset[] = [
    { id: 'model', url: 'https://local.test/model', bytes: a.byteLength, sha256: await sha256(a) },
    { id: 'wasm', url: 'https://local.test/wasm', bytes: b.byteLength, sha256: await sha256(b) },
  ];
  return { a, b, assets };
}
test('manifest resolves same-origin root and subpath asset locations', () => {
  assert.match(assetsFor('person', 'https://local.test/tools/')[0].url, /^https:\/\/local.test\/tools\/vendor\/bg-removal\/person\//);
  assert.equal(assetsFor('person', 'https://local.test/').reduce((n, a) => n + a.bytes, 0), 40737492);
  assert.equal(assetsFor('product', 'https://local.test/').reduce((n, a) => n + a.bytes, 0), 127232270);
});
test('asset validation rejects same-length corruption and truncation', async () => {
  const { a, assets } = await fixtures(); await verifyAsset(a, assets[0]);
  await assert.rejects(verifyAsset(new Uint8Array([3, 2, 1]).buffer, assets[0]), { code: 'bg-model-integrity' });
  await assert.rejects(verifyAsset(new Uint8Array([1]).buffer, assets[0]), { code: 'bg-model-integrity' });
});
test('partial cache counts only missing bytes and revalidates cached bytes', async () => {
  const { a, assets } = await fixtures(), cache = new MemoryCache(); cache.items.set(assets[0].url, a);
  const plan = await prepareAssets(assets, cache.storage()); assert.equal(plan.missingBytes, 2); assert.equal(plan.cached.size, 1);
});
test('corrupt cache entry is deleted and counted as missing', async () => {
  const { assets } = await fixtures(), cache = new MemoryCache(); cache.items.set(assets[0].url, new Uint8Array([0, 0, 0]).buffer);
  const plan = await prepareAssets(assets, cache.storage()); assert.equal(plan.missingBytes, 5); assert.deepEqual(cache.deleted, [assets[0].url]);
});
test('cache unavailable and quota failure still use exactly verified bytes for this run', async () => {
  for (const unavailable of [false, true]) {
    const { a, b, assets } = await fixtures(), cache = new MemoryCache(); cache.failPut = true;
    const plan = await prepareAssets(assets, unavailable ? null : cache.storage()); let notices = 0, requests = 0;
    const result = await acquireAssets(plan, new AbortController().signal, () => undefined, () => notices++, (async url => { requests++; return new Response(String(url).endsWith('model') ? a : b); }) as typeof fetch);
    assert.equal(requests, 2); assert.ok(notices > 0); assert.equal(await sha256(result[0].buffer), assets[0].sha256); assert.equal(cache.items.size, 0);
  }
});
test('warm offline uses no fetch and verifies both cached payloads', async () => {
  const { a, b, assets } = await fixtures(), cache = new MemoryCache(); cache.items.set(assets[0].url, a); cache.items.set(assets[1].url, b);
  const plan = await prepareAssets(assets, cache.storage()); assert.equal(plan.missingBytes, 0);
  const result = await acquireAssets(plan, new AbortController().signal, () => undefined, () => undefined, (async () => { throw new Error('network must not be called'); }) as typeof fetch);
  assert.deepEqual(result.map(item => item.source), ['cache', 'cache']);
});
test('cancel while streaming never commits a partial cache entry', async () => {
  const { assets } = await fixtures(), cache = new MemoryCache(), abort = new AbortController();
  const plan = await prepareAssets(assets, cache.storage());
  await assert.rejects(acquireAssets(plan, abort.signal, () => abort.abort(), () => undefined, (async () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1])); } }))) as typeof fetch), { code: 'ai-cancelled' });
  assert.equal(cache.items.size, 0);
});
test('integrity mismatch never enters cache and never falls back to another model', async () => {
  const { assets } = await fixtures(), cache = new MemoryCache(); let requests = 0;
  await assert.rejects(acquireAssets(await prepareAssets(assets, cache.storage()), new AbortController().signal, () => undefined, () => undefined,
    (async () => { requests++; return new Response(new Uint8Array([0, 0, 0])); }) as typeof fetch), { code: 'bg-model-integrity' });
  assert.equal(requests, 1); assert.equal(cache.items.size, 0);
});
test('MODNet shape keeps short edge 512 and both dimensions divisible by 32', () => {
  assert.deepEqual(inputSize(4000, 3000, 'person'), { width: 672, height: 512 });
  assert.deepEqual(inputSize(3000, 4000, 'person'), { width: 512, height: 672 });
  assert.deepEqual(inputSize(6000, 4000, 'product'), { width: 512, height: 512 });
});
test('normalization emits NCHW with each model mean/std', () => {
  const rgba = new Uint8ClampedArray([255, 0, 128, 0]);
  const p = normalizeRgb(rgba, 1, 1, 'person'); assert.equal(p[0], 1); assert.equal(p[1], -1); assert.ok(Math.abs(p[2] - (128 / 255 - .5) / .5) < 1e-6);
  const b = normalizeRgb(rgba, 1, 1, 'product'); assert.ok(Math.abs(b[0] - (1 - .485) / .229) < 1e-6);
});
test('alpha multiplication retains transparency/RGB and aligns bilinear samples', () => {
  const pixels = new Uint8ClampedArray([10, 20, 30, 0, 10, 20, 30, 128, 10, 20, 30, 255, 10, 20, 30, 255]);
  multiplyAlpha(pixels, 4, 1, new Float32Array([0, 1]), 2, 1, false);
  assert.deepEqual([...pixels], [10, 20, 30, 0, 10, 20, 30, 32, 10, 20, 30, 191, 10, 20, 30, 255]);
  const logits = new Uint8ClampedArray([0, 0, 0, 128]); multiplyAlpha(logits, 1, 1, new Float32Array([0]), 1, 1, true); assert.equal(logits[3], 64);
});
test('public errors stay code-based and cancellation has no UI message', () => {
  assert.equal(messages.ko['ai-cancelled'], ''); assert.equal(normalizeError(new Error('allocation failed')).code, 'bg-out-of-memory');
  assert.equal(normalizeError(new BgRemovalError('bg-model-integrity')).code, 'bg-model-integrity');
});

test('BG Vite plugin removes only manifest-verified fallback wasm from BG workers', async () => {
  const { verifiedRuntimeWasmPlugin } = await import('../verified-runtime-vite.mjs');
  const { readFileSync } = await import('node:fs');
  const transform = verifiedRuntimeWasmPlugin().generateBundle as unknown as (options: unknown, bundle: Record<string, unknown>) => void;
  const bundle: Record<string, unknown> = {
    'bg.js': { type: 'chunk', isEntry: true, facadeModuleId: '/src/features/image-studio/bgRemoval/bgRemoval.worker.ts' },
    'fallback.wasm': { type: 'asset', source: readFileSync('node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm') },
  };
  transform({}, bundle); assert.deepEqual(Object.keys(bundle), ['bg.js']);
});
test('BG Vite plugin preserves unrelated worker assets', async () => {
  const { verifiedRuntimeWasmPlugin } = await import('../verified-runtime-vite.mjs');
  const transform = verifiedRuntimeWasmPlugin().generateBundle as unknown as (options: unknown, bundle: Record<string, unknown>) => void;
  const bundle = { 'other.js': { type: 'chunk', isEntry: true, facadeModuleId: '/src/features/pdf/other.worker.ts' }, 'other.wasm': { type: 'asset', source: new Uint8Array([1]) } };
  transform({}, bundle); assert.equal(Object.keys(bundle).length, 2);
});
test('BG Vite plugin fails on unexpected fallback bytes rather than dropping them', async () => {
  const { verifiedRuntimeWasmPlugin } = await import('../verified-runtime-vite.mjs');
  const transform = verifiedRuntimeWasmPlugin().generateBundle as unknown as (options: unknown, bundle: Record<string, unknown>) => void;
  const bundle = { 'bg.js': { type: 'chunk', isEntry: true, facadeModuleId: '/src/features/image-studio/bgRemoval/bgRemoval.worker.ts' }, 'unknown.wasm': { type: 'asset', source: new Uint8Array([1]) } };
  assert.throws(() => transform({}, bundle), /Unrecognized BG worker fallback wasm/);
});

test('MODNet short edge remains exactly512 for rounding boundary inputs and transposes', () => {
  for (const [width, height] of [[958,1280],[607,754],[1280,853],[795,1280],[1280,832],[4095,8191],[2731,4096],[1,1],[8192,8191]]) {
    for (const [w,h] of [[width,height],[height,width]]) {
      const result=inputSize(w,h,'person'); assert.equal(Math.min(result.width,result.height),512);
      assert.equal(result.width%32,0); assert.equal(result.height%32,0);
      const long=Math.floor(Math.max(w,h)*16/Math.min(w,h))*32; assert.equal(Math.max(result.width,result.height),long);
    }
  }
  assert.deepEqual(inputSize(958,1280,'person'),{width:512,height:672});
  assert.deepEqual(inputSize(1280,958,'person'),{width:672,height:512});
});
test('clearStoredModels reports blocked deletion instead of false success', async () => {
  const { BackgroundRemovalController } = await import('../controller.ts');
  for (const cacheStorage of [null, { delete: async () => { throw new DOMException('blocked', 'SecurityError'); } } as unknown as CacheStorage]) {
    const notices: string[] = [];
    const controller = new BackgroundRemovalController({ confirm: () => false, cacheStorage, notice: value => notices.push(value) });
    assert.equal(await controller.clearStoredModels(), false); assert.equal(notices.length, 1);
  }
  const controller = new BackgroundRemovalController({ confirm: () => false, cacheStorage: { delete: async () => true } as unknown as CacheStorage });
  assert.equal(await controller.clearStoredModels(), true);
});
