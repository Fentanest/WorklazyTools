import assert from 'node:assert/strict';
import test from 'node:test';
import { IOS_PRODUCT_RUN_KEY, ProductRecoveryMarker } from '../../src/features/image-studio/bgRemoval/recovery.ts';
import { BackgroundRemovalController } from '../../src/features/image-studio/bgRemoval/controller.ts';

function storage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}

test('an active product run persists only a constant flag, never input metadata', () => {
  const store = storage(), marker = new ProductRecoveryMarker(() => store);
  store.setItem('unrelated', 'keep'); const finish = marker.begin();
  assert.deepEqual([...store.values], [['unrelated', 'keep'], [IOS_PRODUCT_RUN_KEY, '1']]);
  assert.equal(marker.hasInterrupted(), false, 'a live run is not an old interrupted run');
  assert.equal(marker.consume(), false); finish();
  assert.deepEqual([...store.values], [['unrelated', 'keep']]);
});
test('a new document can detect and consume an interrupted flag once', () => {
  const store = storage(); new ProductRecoveryMarker(() => store).begin(); // no normal finalizer = simulated process loss
  const reopened = new ProductRecoveryMarker(() => store);
  assert.equal(reopened.hasInterrupted(), true); assert.equal(reopened.hasInterrupted(), true, 'render reads do not consume');
  assert.equal(reopened.consume(), true); assert.equal(reopened.consume(), false);
  assert.equal(store.getItem(IOS_PRODUCT_RUN_KEY), null);
  assert.equal(new ProductRecoveryMarker(() => store).hasInterrupted(), false);
});
test('a stale/idempotent finalizer cannot erase a newer run', () => {
  const store = storage(), marker = new ProductRecoveryMarker(() => store);
  const old = marker.begin(), current = marker.begin(); old(); old();
  assert.equal(store.getItem(IOS_PRODUCT_RUN_KEY), '1'); current(); current();
  assert.equal(store.getItem(IOS_PRODUCT_RUN_KEY), null);
});
test('missing, inaccessible and failed writes do not fail an image operation', () => {
  const absent = new ProductRecoveryMarker(() => undefined); assert.equal(absent.hasInterrupted(), false); absent.begin()();
  const denied = new ProductRecoveryMarker(() => { throw new Error('storage denied'); });
  assert.equal(denied.hasInterrupted(), false); assert.equal(denied.consume(), false); assert.doesNotThrow(() => denied.begin()());
  const full = new ProductRecoveryMarker(() => ({ getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem() {} }));
  assert.doesNotThrow(() => full.begin()());
});
test('failed cleanup is best effort and does not repeat a notice in the same document', () => {
  const store = storage(); store.setItem(IOS_PRODUCT_RUN_KEY, '1');
  const marker = new ProductRecoveryMarker(() => ({ ...store, removeItem() { throw new Error('denied'); } }));
  assert.equal(marker.consume(), true); assert.equal(marker.hasInterrupted(), false);
  const finish = marker.begin(); assert.doesNotThrow(finish); assert.equal(marker.hasInterrupted(), false);
});
test('unknown marker contents are not called a prior crash', () => {
  const store = storage(); store.setItem(IOS_PRODUCT_RUN_KEY, 'unknown');
  assert.equal(new ProductRecoveryMarker(() => store).hasInterrupted(), false);
});

const ios = { userAgent: 'iPhone AppleWebKit/605.1.15 Safari/605.1', platform: 'iPhone', maxTouchPoints: 5 };
async function environment(device: object, run: (store: ReturnType<typeof storage>) => Promise<void>) {
  const before = new Map(['navigator', 'isSecureContext', 'sessionStorage'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  const store = storage();
  for (const [key, value] of Object.entries({ navigator: device, isSecureContext: true, sessionStorage: store })) Object.defineProperty(globalThis, key, { configurable: true, value });
  try { await run(store); }
  finally { for (const [key, descriptor] of before) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } }
}
for (const mode of ['risk-cancel', 'consent-cancel', 'consent-error', 'cancel-pending', 'portrait', 'desktop', 'low-memory'] as const) test(`controller marker lifecycle: ${mode}`, async () => {
  const device = mode === 'desktop' ? { userAgent: 'Linux Chrome', deviceMemory: 8 } : mode === 'low-memory' ? { ...ios, deviceMemory: 4 } : ios;
  await environment(device, async store => {
    let release!: () => void;
    const entered = new Promise<void>(resolve => { release = resolve; });
    const controller = new BackgroundRemovalController({ baseUrl: 'https://local.test/', cacheStorage: null,
      productSupported: async () => true, confirmProductRisk: () => mode !== 'risk-cancel',
      confirm: () => {
        const shouldMark = !['portrait', 'desktop'].includes(mode);
        assert.equal(store.getItem(IOS_PRODUCT_RUN_KEY), shouldMark ? '1' : null);
        if (mode === 'consent-error') throw new Error('synthetic consent failure');
        if (mode === 'cancel-pending') { release(); return new Promise<boolean>(() => {}); }
        return false;
      },
    });
    const pending = controller.removeBackground(new Blob(['not persisted']), { mode: mode === 'portrait' ? 'person' : 'product' });
    const outcome = pending.then(() => null, error => error);
    if (mode === 'cancel-pending') {
      await Promise.race([entered, outcome.then(error => { if (error) throw error; })]);
      controller.cancel(); assert.equal(store.getItem(IOS_PRODUCT_RUN_KEY), null, 'cancel cleans immediately');
    }
    assert.ok(await outcome); assert.equal(store.getItem(IOS_PRODUCT_RUN_KEY), null); controller.dispose();
  });
});
