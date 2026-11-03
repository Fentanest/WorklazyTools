import assert from 'node:assert/strict';
import test from 'node:test';
import { BackgroundRemovalController, productSupported } from '../../src/features/image-studio/bgRemoval/controller.ts';
import * as policy from '../../src/features/image-studio/bgRemoval/devicePolicy.ts';

const webkit = 'AppleWebKit/605.1.15';
const ios = [
  { name: 'iPhone Safari', userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) ${webkit} Version/26.0 Mobile/15E148 Safari/604.1`, platform: 'iPhone', maxTouchPoints: 5 },
  { name: 'desktop-UA iPadOS', userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ${webkit} Version/26.0 Safari/605.1.15`, platform: 'MacIntel', maxTouchPoints: 5 },
  { name: 'iOS Chrome', userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) ${webkit} CriOS/138.0 Mobile/15E148 Safari/604.1`, platform: 'iPhone', maxTouchPoints: 5 },
];
async function withDevice<T>(device: object, run: () => Promise<T>): Promise<T> {
  const before = new Map(['navigator', 'isSecureContext'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: device });
  Object.defineProperty(globalThis, 'isSecureContext', { configurable: true, value: true });
  try { return await run(); }
  finally { for (const [key, descriptor] of before) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } }
}

for (const device of ios) for (const proceed of [false, true]) test(`${device.name}: risk choice ${proceed ? 'precedes download consent' : 'cancels before cache and download'}`, async () => {
  await withDevice(device, async () => {
    const steps: string[] = [];
    const controller = new BackgroundRemovalController({ baseUrl: 'https://local.test/', productSupported: async () => true,
      confirmProductRisk: () => { steps.push('risk'); return proceed; },
      confirm: () => { steps.push('download-consent'); return false; },
      cacheStorage: { open: async () => { steps.push('cache'); return { match: async () => undefined }; } } as unknown as CacheStorage,
      fetcher: (async () => { throw Error('no download allowed'); }) as typeof fetch,
      workerFactory: () => { throw Error('no inference allowed'); },
    });
    try {
      assert.equal(await controller.defaultMode(), 'person', 'portrait remains the default recommendation');
      await assert.rejects(controller.removeBackground(new Blob(['synthetic']), { mode: 'product' }), { code: 'ai-cancelled' });
      assert.deepEqual(steps, proceed ? ['risk', 'cache', 'download-consent'] : ['risk']);
      assert.equal(policy.productDeviceRestriction(device), undefined, 'iOS alone is not a block');
    } finally { controller.dispose(); }
  });
});

for (const device of [{ ...ios[0], deviceMemory: 4 }, { name: 'Android low-memory', userAgent: 'Android AppleWebKit/537.36 Chrome/138', deviceMemory: 4 }]) test(`${device.name}: reported low memory blocks before warning, cache, GPU and consent`, async () => {
  await withDevice(device, async () => {
    const calls: string[] = [];
    const controller = new BackgroundRemovalController({ baseUrl: 'https://local.test/',
      confirmProductRisk: () => { calls.push('risk'); return true; },
      productSupported: async () => { calls.push('gpu'); return true; },
      confirm: () => { calls.push('consent'); return true; },
      cacheStorage: { open: async () => { calls.push('cache'); throw Error('blocked'); } } as unknown as CacheStorage,
      fetcher: (async () => { calls.push('fetch'); throw Error('blocked'); }) as typeof fetch,
      workerFactory: () => { calls.push('worker'); throw Error('blocked'); },
    });
    try {
      await assert.rejects(controller.removeBackground(new Blob(['synthetic']), { mode: 'product' }), { code: 'bg-product-device-restricted' });
      assert.equal(await controller.defaultMode(), 'person');
      assert.deepEqual(calls, []);
      assert.equal(policy.productDeviceRestriction(device), 'low-memory');
    } finally { controller.dispose(); }
  });
});

for (const [name, device, mode] of [
  ['iPhone portrait does not warn', ios[0], 'person'],
  ['desktop product does not warn', { userAgent: 'Chrome/138.0', platform: 'Linux x86_64', maxTouchPoints: 0, deviceMemory: 8 }, 'product'],
] as const) test(name, async () => {
  await withDevice(device, async () => {
    const steps: string[] = [];
    const controller = new BackgroundRemovalController({ baseUrl: 'https://local.test/', productSupported: async () => true,
      confirmProductRisk: () => { steps.push('unexpected-risk'); return true; },
      confirm: () => { steps.push('download-consent'); return false; }, cacheStorage: null });
    try {
      await assert.rejects(controller.removeBackground(new Blob(['synthetic']), { mode }), { code: 'ai-cancelled' });
      assert.deepEqual(steps, ['download-consent']);
    } finally { controller.dispose(); }
  });
});

test('cancelling an iOS warning invalidates its late approval', async () => {
  await withDevice(ios[0], async () => {
    let approve!: (value: boolean) => void;
    let riskStarted!: () => void;
    const ready = new Promise<void>(resolve => { riskStarted = resolve; });
    let consent = 0;
    const controller = new BackgroundRemovalController({ baseUrl: 'https://local.test/', productSupported: async () => true,
      confirmProductRisk: () => { riskStarted(); return new Promise<boolean>(resolve => { approve = resolve; }); },
      confirm: () => { consent++; return false; }, cacheStorage: null });
    const run = controller.removeBackground(new Blob(['synthetic']), { mode: 'product' });
    const outcome = run.then(() => null, error => error);
    await Promise.race([ready, outcome.then(error => { if (error) throw error; })]);
    controller.cancel(); approve(true);
    assert.equal((await outcome)?.code, 'ai-cancelled');
    assert.equal(consent, 0); controller.dispose();
  });
});

test('policy distinguishes reported memory from iOS warning and still checks GPU capability', async () => {
  const mac = { userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X) ${webkit} Safari/605.1.15`, platform: 'MacIntel', maxTouchPoints: 0 };
  assert.equal(policy.productDeviceRestriction(mac), undefined);
  for (const deviceMemory of [.25, .5, 1, 2, 4]) assert.equal(policy.productDeviceRestriction({ ...mac, deviceMemory }), 'low-memory');
  for (const deviceMemory of [undefined, NaN, Infinity, -1, 0, 8]) assert.equal(policy.productDeviceRestriction({ ...ios[0], deviceMemory }), undefined);
  assert.equal(policy.productDeviceWarning({ ...mac, platform: '', maxTouchPoints: 5 }), 'ios-webkit');
  assert.equal(policy.productDeviceWarning({ userAgent: 'Firefox/138 iPhone', maxTouchPoints: 5 }), undefined);
  for (const [device, allowed] of [[ios[0], true], [{ ...ios[0], deviceMemory: 4 }, false], [{ ...mac, deviceMemory: 8 }, true]] as const) {
    let probes = 0;
    await withDevice({ ...device, gpu: { requestAdapter: async () => { probes++; return { features: new Set(['shader-f16']) }; } } }, async () => {
      assert.equal(await productSupported(), allowed);
      assert.equal(probes, allowed ? 1 : 0);
    });
  }
});
