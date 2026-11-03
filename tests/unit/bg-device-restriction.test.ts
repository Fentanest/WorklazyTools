import assert from 'node:assert/strict';
import test from 'node:test';
import { BackgroundRemovalController, productSupported } from '../../src/features/image-studio/bgRemoval/controller.ts';
import { productDeviceRestriction } from '../../src/features/image-studio/bgRemoval/devicePolicy.ts';

const webkit = 'AppleWebKit/605.1.15';
const restricted = [
  { name: 'iPhone Safari without deviceMemory', userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) ${webkit} Version/26.0 Mobile/15E148 Safari/604.1`, platform: 'iPhone', maxTouchPoints: 5 },
  { name: 'iPad desktop UA without deviceMemory', userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ${webkit} Version/26.0 Safari/605.1.15`, platform: 'MacIntel', maxTouchPoints: 5 },
  { name: 'iOS Chrome WebKit', userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) ${webkit} CriOS/138.0 Mobile/15E148 Safari/604.1`, platform: 'iPhone', maxTouchPoints: 5 },
  { name: 'Android 4 GiB with shader-f16', userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/138.0 Mobile Safari/537.36', platform: 'Linux armv8l', maxTouchPoints: 5, deviceMemory: 4 },
];

async function withDevice<T>(device: object, run: () => Promise<T>): Promise<T> {
  const navigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const secure = Object.getOwnPropertyDescriptor(globalThis, 'isSecureContext');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: device });
  Object.defineProperty(globalThis, 'isSecureContext', { configurable: true, value: true });
  try { return await run(); }
  finally {
    for (const [key, descriptor] of [['navigator', navigator], ['isSecureContext', secure]] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  }
}

for (const device of restricted) test(`product guard: ${device.name} blocks before cache, consent, download, GPU probe and worker`, async () => {
  await withDevice(device, async () => {
    const calls = { cache: 0, consent: 0, fetch: 0, worker: 0, gpu: 0 };
    const controller = new BackgroundRemovalController({
      baseUrl: 'https://local.test/',
      productSupported: async () => { calls.gpu++; return true; },
      confirm: () => { calls.consent++; return false; },
      cacheStorage: { open: async () => { calls.cache++; return { match: async () => undefined }; } } as unknown as CacheStorage,
      fetcher: (async () => { calls.fetch++; throw new Error('must not fetch'); }) as typeof fetch,
      workerFactory: () => { calls.worker++; throw new Error('must not create worker'); },
    });
    try {
      await assert.rejects(controller.removeBackground(new Blob(['synthetic']), { mode: 'product' }), { code: 'bg-product-device-restricted' });
      assert.equal(await controller.defaultMode(), 'person');
      assert.deepEqual(calls, { cache: 0, consent: 0, fetch: 0, worker: 0, gpu: 0 });
    } finally { controller.dispose(); }
  });
});

for (const [name, device, mode] of [
  ['portrait stays available on iPhone', restricted[0], 'person'],
  ['product stays available on desktop 8 GiB', { userAgent: 'Chrome/138.0', platform: 'Linux x86_64', maxTouchPoints: 0, deviceMemory: 8 }, 'product'],
] as const) test(name, async () => {
  await withDevice(device, async () => {
    let consent = 0;
    const controller = new BackgroundRemovalController({ baseUrl: 'https://local.test/', productSupported: async () => true,
      confirm: () => { consent++; return false; }, cacheStorage: null });
    try {
      await assert.rejects(controller.removeBackground(new Blob(['synthetic']), { mode }), { code: 'ai-cancelled' });
      assert.equal(consent, 1, 'permitted mode reaches consent; no inference is run in this test');
    } finally { controller.dispose(); }
  });
});

test('device policy uses iPad touch evidence and positive memory buckets, not Safari or missing RAM alone', () => {
  const mac = { userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X) ${webkit} Safari/605.1.15`, platform: 'MacIntel', maxTouchPoints: 0 };
  assert.equal(productDeviceRestriction(mac), undefined, 'desktop Safari without deviceMemory remains eligible');
  assert.equal(productDeviceRestriction({ ...mac, platform: '', maxTouchPoints: 5 }), 'ios-webkit', 'desktop-mode iPad UA still works when platform is absent');
  for (const deviceMemory of [.25, .5, 1, 2, 4]) assert.equal(productDeviceRestriction({ ...mac, deviceMemory }), 'low-memory');
  for (const deviceMemory of [undefined, NaN, Infinity, -1, 0, 8]) assert.equal(productDeviceRestriction({ ...mac, deviceMemory }), undefined);
  assert.equal(productDeviceRestriction({ userAgent: 'Firefox/138 iPhone', maxTouchPoints: 5 }), undefined, 'not an AppleWebKit UA');
  assert.equal(productDeviceRestriction({ userAgent: 'Android AppleWebKit/537.36 Chrome/138', maxTouchPoints: 5, deviceMemory: 8 }), undefined);
});

test('shader-f16 support never overrides the device restriction; supported desktop still probes GPU', async () => {
  for (const [device, allowed] of [[restricted[0], false], [{ userAgent: 'Chrome/138.0', deviceMemory: 8 }, true]] as const) {
    let probes = 0;
    await withDevice({ ...device, gpu: { requestAdapter: async () => { probes++; return { features: new Set(['shader-f16']) }; } } }, async () => {
      assert.equal(await productSupported(), allowed);
      assert.equal(probes, allowed ? 1 : 0);
    });
  }
});
