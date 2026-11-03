import { BackgroundRemovalController, createBackgroundRemovalLoader, productSupported, requestDownloadConsent } from '../controller.ts';
import { assetsFor, CACHE_NAME, manifest, prepareAssets, verifyAsset } from '../assets.ts';
import { messages, normalizeError } from '../errors.ts';
import type { Diagnostic } from '../protocol.ts';
import type { BgMode } from '../assets.ts';
const w = window as unknown as Record<string, any>;
w.events = []; w.results = []; w.supported = productSupported; w.assets = (mode: BgMode) => assetsFor(mode, location.origin + '/'); w.manifest = manifest;
let active: BackgroundRemovalController;
w.makeInput = async (width = 1000, height = 1000, transparent = false): Promise<Blob> => {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const x = canvas.getContext('2d')!; x.fillStyle = '#b6d6f1'; x.fillRect(0, 0, width, height);
  x.fillStyle = '#ad5642'; x.fillRect(width * .3, height * .2, width * .4, height * .65);
  x.fillStyle = '#efceac'; x.beginPath(); x.ellipse(width * .5, height * .27, width * .13, height * .18, 0, 0, Math.PI * 2); x.fill();
  // Asymmetric registration marks make rotation/mirroring visible in retained RGB.
  x.fillStyle = '#11dd44'; x.fillRect(width * .32, height * .45, width * .06, height * .05);
  x.fillStyle = '#4411dd'; x.fillRect(width * .6, height * .7, width * .05, height * .04);
  if (transparent) { x.clearRect(0, 0, width * .2, height); x.globalCompositeOperation = 'destination-in'; x.globalAlpha = .5; x.fillStyle = '#000'; x.fillRect(0, 0, width, height); }
  return new Promise(resolve => canvas.toBlob(blob => { canvas.width = 1; canvas.height = 1; resolve(blob!); }, 'image/png'));
};
w.configure = (options: { cacheOff?: boolean; quota?: boolean; deferredConsent?: boolean; rejectConsent?: boolean; audit?: boolean; unsupportedProduct?: boolean } = {}) => {
  active?.dispose(); w.events = []; w.results = [];
  let storage: CacheStorage | null | undefined;
  if (options.cacheOff) storage = null;
  else if (options.quota) storage = {
    open: async (name: string) => {
      const cache = await caches.open(name);
      return new Proxy(cache, { get(target, key) { if (key === 'put') return async () => { throw new DOMException('quota', 'QuotaExceededError'); }; const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value; } });
    }, delete: (name: string) => caches.delete(name),
  } as CacheStorage;
  active = new BackgroundRemovalController({ baseUrl: location.origin + '/', cacheStorage: storage, auditRuntime: options.audit !== false,
    productSupported: options.unsupportedProduct ? async () => false : undefined,
    confirm: info => { w.events.push({ type: 'consent', ...info }); document.getElementById('status')!.textContent = `${info.label}\n${info.downloadBytes} bytes\n${info.programFilesNote}`;
      if (options.deferredConsent) return new Promise(resolve => { w.approve = resolve; }); return !options.rejectConsent; },
    diagnostic: (event: Diagnostic) => w.events.push(event), notice: message => w.events.push({ type: 'notice', message }),
  });
  w.controller = active;
};
w.run = async (mode: BgMode = 'person', width = 1000, height = 1000, transparent = false) => {
  const input = await w.makeInput(width, height, transparent);
  const started = performance.now();
  try {
    const loader = createBackgroundRemovalLoader(active, () => mode); const module = await loader();
    const output = await module.removeBackground(input, { progress: (key, current, total) => w.events.push({ type: 'progress', key, current, total }) });
    const original = await createImageBitmap(input), bitmap = await createImageBitmap(output);
    const read = (image: ImageBitmap) => { const c = new OffscreenCanvas(image.width, image.height); const x = c.getContext('2d')!; x.drawImage(image, 0, 0); return x.getImageData(0, 0, image.width, image.height).data; };
    const before = read(original), after = read(bitmap); let alphaIncreased = 0, transparentLost = 0, opaqueSamples = 0, rgbMaxDifference = 0;
    for (let i = 0; i < after.length; i += 4) {
      if (after[i + 3] > before[i + 3]) alphaIncreased++;
      if (before[i + 3] === 0 && after[i + 3] !== 0) transparentLost++;
      // At high alpha, unpremultiplication rounding is bounded and pixels must stay at their source coordinates.
      if (after[i + 3] >= 200) { opaqueSamples++; for (let c = 0; c < 3; c++) rgbMaxDifference = Math.max(rgbMaxDifference, Math.abs(before[i + c] - after[i + c])); }
    }
    const fact = { ok: true, mode, inputWidth: original.width, inputHeight: original.height, width: bitmap.width, height: bitmap.height,
      bytes: output.size, milliseconds: performance.now() - started, alphaIncreased, transparentLost, opaqueSamples, rgbMaxDifference };
    original.close(); bitmap.close(); w.results.push(fact); w.output = output; return fact;
  } catch (error) { const code = normalizeError(error).code; const fact = { ok: false, code, message: messages.ko[code], milliseconds: performance.now() - started }; w.results.push(fact); return fact; }
};
w.clear = async () => { active?.cancel(); await caches.delete(CACHE_NAME); };
w.configure();
w.runSource = async (source: string) => {
  try { const loader = createBackgroundRemovalLoader(active, () => 'person'); const result = await (await loader()).removeBackground(source); const bitmap = await createImageBitmap(result); const fact = { ok: true, type: result.type, width: bitmap.width, height: bitmap.height }; bitmap.close(); return fact; }
  catch (error) { return { ok: false, code: normalizeError(error).code }; }
};
for (const mode of ['person', 'product'] as const) document.getElementById(mode)!.onclick = async () => {
  w.configure(); w.controller = new BackgroundRemovalController({ confirm: requestDownloadConsent, baseUrl: location.origin + '/' });
  active = w.controller; const fact = await w.run(mode); document.getElementById('status')!.textContent = JSON.stringify(fact);
  if (fact.ok) (document.getElementById('result') as HTMLImageElement).src = URL.createObjectURL(w.output);
};
document.getElementById('cancel')!.onclick = () => active.cancel();
document.getElementById('clear')!.onclick = () => active.clearStoredModels();
w.ready = true;

// QA-only: use the same default /webgpu bundle inside a dedicated Worker.
// EP=wasm proves glue/session initialization without claiming GPU inference or adding a fallback.
w.runtimeProbe = async (ep: 'wasm' | 'webgpu') => {
  const modelAsset = w.assets(ep === 'wasm' ? 'person' : 'product')[0];
  const runtimeAsset = w.assets('product')[1];
  const model = { asset: modelAsset, source: 'network', buffer: await (await fetch(modelAsset.url)).arrayBuffer() };
  const runtime = { asset: runtimeAsset, source: 'network', buffer: await (await fetch(runtimeAsset.url)).arrayBuffer() };
  const probe = new Worker(new URL('./runtime-probe.worker.ts', import.meta.url), { type: 'module' });
  try { return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Runtime probe timeout')), 180000);
    probe.onmessage = event => { clearTimeout(timer); resolve(event.data); };
    probe.onerror = event => { clearTimeout(timer); reject(new Error(event.message)); };
    probe.postMessage({ ep, model, runtime }, [model.buffer, runtime.buffer]);
  }); } finally { probe.terminate(); }
};

w.productCachePlan = async (stage: 'empty' | 'model-and-obsolete' | 'warm' | 'corrupt-new') => {
  const assets = w.assets('product');
  if (stage === 'empty') await caches.delete(CACHE_NAME);
  const cache = await caches.open(CACHE_NAME);
  if (stage === 'model-and-obsolete') {
    const model = await (await fetch(assets[0].url)).arrayBuffer(); await verifyAsset(model, assets[0]);
    await cache.put(assets[0].url, new Response(model));
    await cache.put(new URL('vendor/onnxruntime-web/1.31.1/ort-wasm-simd-threaded.jsep.wasm', location.origin).href, new Response(new Uint8Array([1, 2])));
  }
  if (stage === 'warm') {
    const runtime = await (await fetch(assets[1].url)).arrayBuffer(); await verifyAsset(runtime, assets[1]);
    await cache.put(assets[1].url, new Response(runtime));
  }
  if (stage === 'corrupt-new') await cache.put(assets[1].url, new Response(new Uint8Array([0])));
  const plan = await prepareAssets(assets, caches);
  return { stage, missingBytes: plan.missingBytes, cached: [...plan.cached.keys()], runtimeUrl: assets[1].url, cacheKeys: (await cache.keys()).map(r => r.url) };
};

// QA only: provider comparison bypasses the product capability gate.
w.qualityProbe = async (mode: BgMode, ep: 'wasm' | 'webgpu', input: Blob, scenario?: 'constant-gpu') => {
  const assets = w.assets(mode);
  const model = { asset: assets[0], buffer: await (await fetch(assets[0].url)).arrayBuffer() };
  const runtime = { asset: assets[1], buffer: await (await fetch(assets[1].url)).arrayBuffer() };
  const probe = new Worker(new URL('./quality-probe.worker.ts', import.meta.url), { type: 'module' });
  try { return await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Quality probe timeout')), 240000);
    probe.onmessage = ({ data }) => { clearTimeout(timer); resolve(data); };
    probe.onerror = e => { clearTimeout(timer); reject(new Error(e.message)); };
    probe.postMessage({ mode, ep, input, model, runtime, scenario }, [model.buffer, runtime.buffer]);
  }); } finally { probe.terminate(); }
};
