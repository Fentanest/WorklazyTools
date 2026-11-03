import assert from 'node:assert/strict';
import test from 'node:test';
import { reserveNativeThreads, patchNativeThreadReadiness } from '../../scripts/libreoffice-native-threads.mjs';

const ready = () => ({ loaded: true, terminate() {} });

test('native gate withholds a newly allocated worker until its loaded reply', async () => {
  let finish!: () => void;
  const worker = { loaded: false, terminated: false, terminate() { this.terminated = true; } };
  const pool = { unusedWorkers: [ready(), ready(), ready()],
    allocateUnusedWorker() { this.unusedWorkers.push(worker); },
    loadWasmModuleToWorker(value: typeof worker) {
      assert.equal(this.unusedWorkers.includes(value), false, 'native allocation cannot see an unready worker');
      return new Promise<void>(resolve => { finish = () => { value.loaded = true; resolve(); }; });
    } };
  let entered = false;
  const pending = reserveNativeThreads(pool).then(() => { entered = true; });
  assert.equal(entered, false); assert.equal(pool.unusedWorkers.length, 3);
  finish(); await pending;
  assert.equal(entered, true); assert.equal(pool.unusedWorkers.length, 4);
  assert.ok(pool.unusedWorkers.every(value => value.loaded));
});

test('queued pthread cleanup is reused while the native gate awaits a ready worker', async () => {
  let allocations = 0;
  const pool = { unusedWorkers: [ready(), ready(), ready()],
    allocateUnusedWorker() { allocations++; this.unusedWorkers.push({ ...ready(), loaded: false }); },
    async loadWasmModuleToWorker(worker: ReturnType<typeof ready>) {
      await Promise.resolve(); this.unusedWorkers.push(ready(), ready()); worker.loaded = true;
    } };
  await reserveNativeThreads(pool); await reserveNativeThreads(pool);
  assert.equal(allocations, 1, 'warm native calls do not grow the pool again');
  assert.equal(pool.unusedWorkers.length, 6);
});

test('an already ready native reserve does not create or reload workers', async () => {
  const pool = { unusedWorkers: Array.from({ length: 4 }, ready),
    allocateUnusedWorker() { assert.fail('unnecessary allocation'); },
    loadWasmModuleToWorker() { assert.fail('must not reload an initialized worker'); } };
  await reserveNativeThreads(pool);
});

for (const failure of ['reject', 'unready'] as const) test(`failed worker bootstrap (${failure}) is terminated and never published`, async () => {
  const worker = { loaded: false, stopped: false, terminate() { this.stopped = true; } };
  const pool = { unusedWorkers: [ready(), ready(), ready()],
    allocateUnusedWorker() { this.unusedWorkers.push(worker); },
    async loadWasmModuleToWorker() { if (failure === 'reject') throw new Error('load failed'); } };
  await assert.rejects(reserveNativeThreads(pool));
  assert.equal(worker.stopped, true); assert.equal(pool.unusedWorkers.length, 3);
});

test('unexpected runtime contracts fail before a synchronous native call', async () => {
  for (const pool of [undefined, {}, { unusedWorkers: [] }]) await assert.rejects(reserveNativeThreads(pool), /office-thread-pool-unavailable/);
  const pool = { unusedWorkers: [{ loaded: false }], allocateUnusedWorker() {}, loadWasmModuleToWorker() {} };
  await assert.rejects(reserveNativeThreads(pool), /office-thread-pool-not-ready/);
  assert.throws(() => patchNativeThreadReadiness('unknown worker release'), /anchor changed/);
});
