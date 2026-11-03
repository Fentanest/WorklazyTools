import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
const origin = 'http://127.0.0.1:4192', output = process.env.BG_TEST_OUTPUT ?? '/tmp/sol-ie-bg';
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/home/better0101/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome' });
const cases = [], matrix = []; let count = 0;
async function surface() {
  const context = await browser.newContext(); const page = await context.newPage();
  const requests = []; page.on('request', request => requests.push({ url: request.url(), type: request.resourceType() }));
  await page.goto(origin); await page.waitForFunction(() => window.ready);
  return { context, page, requests };
}
function assertAudit(events, mode) {
  const assigned = events.find(e => e.type === 'assigned'), consumed = events.find(e => e.type === 'consumed-wasm'), session = events.find(e => e.type === 'session');
  assert.ok(assigned && consumed && session, 'actual ORT/WASM evidence required');
  assert.equal(consumed.sha256, assigned.wasmSHA256); assert.equal(session.modelBufferSHA256, assigned.modelSHA256);
  assert.equal(consumed.bytes, assigned.wasmBytes); assert.equal(assigned.wasmBinaryIdentity, true); assert.equal(assigned.proxy, false); assert.equal(assigned.numThreads, 1);
  assert.equal(session.executionProvider, mode === 'person' ? 'wasm' : 'webgpu');
}
async function execute(surface, name, config = {}, expectedBytes = 0, mode = 'person', offline = false) {
  const { page, context, requests } = surface; requests.length = 0;
  await page.evaluate(config => window.configure({ ...config, deferredConsent: true }), config);
  await page.evaluate(mode => { window.pending = window.run(mode); }, mode);
  if (expectedBytes > 0) {
    await page.waitForFunction(() => window.events.some(e => e.type === 'consent'));
    const before = requests.filter(r => r.url.includes('/vendor/') || r.url.includes('/assets/bgRemoval.worker'));
    assert.equal(before.length, 0, 'no heavy requests/worker before consent');
    const consent = await page.evaluate(() => window.events.find(e => e.type === 'consent'));
    assert.equal(consent.downloadBytes, expectedBytes);
    await page.evaluate(() => window.approve(true));
  }
  const result = await page.evaluate(() => window.pending);
  const events = await page.evaluate(() => window.events);
  const heavy = requests.filter(r => r.url.includes('/vendor/'));
  const assets = await page.evaluate(mode => window.assets(mode), mode);
  const allowed = new Set(assets.map(a => a.url));
  assert.equal(result.ok, true, `${name}: ${JSON.stringify(result)}`); assertAudit(events, mode);
  assert.equal(result.width, result.inputWidth); assert.equal(result.height, result.inputHeight);
  assert.equal(events.find(e => e.type === 'plan').downloadBytes, expectedBytes);
  assert.ok(heavy.every(r => allowed.has(r.url))); assert.equal(new Set(heavy.map(r => r.url)).size, heavy.length);
  const transferred = heavy.reduce((sum, r) => sum + assets.find(a => a.url === r.url).bytes, 0);
  assert.equal(transferred, expectedBytes);
  assert.equal(requests.filter(r => !r.url.startsWith(origin + '/')).length, 0);
  assert.equal(requests.filter(r => /\.mjs(?:$|\?)/.test(r.url)).length, 0);
  if (offline) assert.equal(heavy.length, 0);
  cases.push({ name, mode, result, expectedBytes, heavyRequests: heavy, extraHeavyFetches: 0, externalMjsRequests: 0, events: events.filter(e => e.type !== 'progress'), requests: [...requests] });
  console.log(`ok ${++count} - ${mode} ${name}`);
}
try {
  const first = await surface(), p = first.page;
  assert.equal(await p.evaluate(() => navigator.serviceWorker.controller === null), true);
  const supported = await p.evaluate(() => window.supported());
  fs.writeFileSync(`${output}/capabilities.json`, JSON.stringify({ shaderF16: supported, crossOriginIsolated: await p.evaluate(() => crossOriginIsolated), chromium: browser.version() }, null, 2));
  await execute(first, 'SW-uncontrolled-first', {}, 40737492);
  await p.evaluate(async () => { const assets = window.assets('person'); const cache = await caches.open(window.manifest.cacheName); await cache.delete(assets[1].url); });
  await execute(first, 'partial-model-only', {}, 14848852);
  const unavailable = await surface(); await execute(unavailable, 'cache-unavailable', { cacheOff: true }, 40737492); await unavailable.context.close();
  const quota = await surface(); await execute(quota, 'cache-put-quota', { quota: true }, 40737492);
  assert.ok(cases.at(-1).events.some(e => e.type === 'notice')); await quota.context.close();
  await execute(first, 'warm', {}, 0);
  await first.context.setOffline(true); await execute(first, 'warm-offline', {}, 0, 'person', true); await first.context.setOffline(false);
  const cancel = await surface(); const cdp = await cancel.context.newCDPSession(cancel.page);
  await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 10, downloadThroughput: 250_000, uploadThroughput: -1 });
  await cancel.page.evaluate(() => { window.configure(); window.pending = window.run(); });
  await cancel.page.waitForFunction(() => window.events.some(e => e.type === 'progress' && e.key.startsWith('fetch:') && e.current > 0));
  await cancel.page.evaluate(() => window.controller.cancel());
  const cancelled = await cancel.page.evaluate(() => window.pending);
  const remaining = await cancel.page.evaluate(async () => (await (await caches.open(window.manifest.cacheName)).keys()).map(r => r.url));
  const cancelEvents = await cancel.page.evaluate(() => window.events);
  assert.equal(cancelled.code, 'ai-cancelled'); assert.equal(remaining.length, 0); assert.ok(!cancelEvents.some(e => e.type === 'worker-created'));
  cases.push({ name: 'cancel-during-download', mode: 'person', result: cancelled, remainingCacheKeys: remaining, events: cancelEvents.filter(e => e.type !== 'progress'), extraHeavyFetches: 0, externalMjsRequests: 0 });
  console.log(`ok ${++count} - person cancel-during-download`); await cancel.context.close();
  // Consent invalidation must settle promptly, and a late positive answer must not start a worker.
  await p.evaluate(async () => { await window.clear(); window.configure({ deferredConsent: true }); window.pending = window.run(); });
  await p.waitForFunction(() => window.events.some(e => e.type === 'consent'));
  await p.evaluate(() => window.controller.onImageReplaced());
  const replacement = await p.evaluate(() => window.pending); assert.equal(replacement.code, 'ai-cancelled');
  await p.evaluate(() => window.approve(true));
  assert.equal(await p.evaluate(() => window.events.some(e => e.type === 'worker-created')), false);
  cases.push({ name: 'replace-image-pending-consent', result: replacement }); console.log(`ok ${++count} - replace image invalidates pending consent`);
  if (!supported) {
    first.requests.length = 0; await p.evaluate(() => window.configure());
    const result = await p.evaluate(() => window.run('product')); assert.equal(result.code, 'bg-unsupported');
    assert.equal(first.requests.filter(r => r.url.includes('/vendor/')).length, 0);
    cases.push({ name: 'product-unsupported', result, heavyRequests: 0, noAutomaticPersonFallback: true }); console.log(`ok ${++count} - product unsupported without downloads/fallback`);
  } else {
    const gpu = await surface(); await execute(gpu, 'SW-uncontrolled-first', {}, 127232270, 'product');
    await gpu.page.evaluate(async () => { const assets = window.assets('product'); await (await caches.open(window.manifest.cacheName)).delete(assets[1].url); });
    await execute(gpu, 'partial-model-only', {}, 28747738, 'product'); await execute(gpu, 'warm', {}, 0, 'product');
    await gpu.context.setOffline(true); await execute(gpu, 'warm-offline', {}, 0, 'product', true); await gpu.context.setOffline(false); await gpu.context.close();
  }
  // Reload with a normal cache and consent to the separately measured image-size matrix.
  await p.evaluate(() => window.configure());
  for (const [width, height, transparent] of [[1250,800,false],[800,1250,false],[4000,3000,false],[3000,4000,false],[6000,4000,false],[4000,6000,false],[1250,800,true]]) {
    const result = await p.evaluate(({ width, height, transparent }) => window.run('person', width, height, transparent), { width, height, transparent });
    assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(result.width, width); assert.equal(result.height, height);
    assert.equal(result.alphaIncreased, 0); assert.equal(result.transparentLost, 0); assert.ok(result.rgbMaxDifference <= 2);
    matrix.push({ ...result, transparent }); console.log(`ok ${++count} - dimensions and registration ${width}x${height} transparent=${transparent}`);
  }
  const stringResult = await p.evaluate(async () => {
    const blob = await window.makeInput(100, 80);
    const src = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
    return window.runSource(src);
  });
  assert.deepEqual(stringResult, { ok: true, type: 'image/png', width: 100, height: 80 });
  const beforeRemote = first.requests.length;
  const remoteResult = await p.evaluate(() => window.runSource('https://private.invalid/user-image.png'));
  assert.equal(remoteResult.code, 'bg-unsupported'); assert.equal(first.requests.length, beforeRemote);
  cases.push({ name: 'fork-string-contract', dataURL: stringResult, remoteURL: remoteResult, externalFetches: 0 }); console.log(`ok ${++count} - fork Blob|string contract and remote string rejection`);
  await p.screenshot({ path: `${output}/harness.png`, fullPage: true }); await first.context.close();
} finally {
  fs.writeFileSync(`${output}/browser-scenarios.json`, JSON.stringify(cases, null, 2)); fs.writeFileSync(`${output}/resolution-matrix.json`, JSON.stringify(matrix, null, 2)); await browser.close();
}
console.log(`1..${count}`); console.log(`# tests ${count}`); console.log(`# pass ${count}`); console.log('# fail 0');
