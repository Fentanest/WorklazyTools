import assert from "node:assert/strict";
import test from "node:test";
import { runModuleWorker } from "../../src/utils/workerLifecycle.ts";
import { compareHwpFilePairs } from "../../src/features/hwp-compare/hwpWorkerClient.ts";

class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminated = 0;
  failPost = false;
  postMessage() { if (this.failPost) throw new Error("clone failed"); }
  terminate() { this.terminated += 1; }
  send(data: unknown) { this.onmessage?.({ data } as MessageEvent); }
}
const messages = { canceledMessage: "canceled", startErrorMessage: "start", resultErrorMessage: "result" };
const start = (worker: FakeWorker, options = {}) => runModuleWorker(() => worker as unknown as Worker, {}, { ...messages, ...options });

test("malformed messages and message deserialization failures terminate once", async () => {
  for (const data of [null, {}, { type: "result" }, { type: "unknown" }]) {
    const worker = new FakeWorker(); const pending = start(worker);
    worker.send(data); await assert.rejects(pending, /result/);
    assert.equal(worker.terminated, 1);
  }
  const worker = new FakeWorker(); const pending = start(worker);
  worker.onmessageerror?.(); await assert.rejects(pending, /result/);
  assert.equal(worker.terminated, 1);
});

test("a stale reply cannot overwrite cancellation or settle twice", async () => {
  const worker = new FakeWorker(), abort = new AbortController();
  const pending = start(worker, { signal: abort.signal }); const oldHandler = worker.onmessage;
  abort.abort(); oldHandler?.({ data: { type: "result", result: "old" } } as MessageEvent);
  await assert.rejects(pending, { name: "AbortError" }); assert.equal(worker.terminated, 1);
});

test("hard deadline is not extended by heartbeats", async () => {
  const worker = new FakeWorker(); const pending = start(worker, { hardTimeoutMs: 20, inactivityTimeoutMs: 100 });
  const timer = setInterval(() => worker.send({ type: "heartbeat" }), 2);
  try { await assert.rejects(pending, { code: "WORKER_DEADLINE" }); }
  finally { clearInterval(timer); }
  assert.equal(worker.terminated, 1);
});

test("opt-in schema validation rejects wrong results, valid results still resolve", async () => {
  for (const result of [3, "wrong"]) {
    const worker = new FakeWorker();
    const pending = start(worker, { validateResult: (value: unknown) => typeof value === "number" });
    worker.send({ type: "result", result });
    if (typeof result === "number") assert.equal(await pending, result);
    else await assert.rejects(pending, /result/);
    assert.equal(worker.terminated, 1);
  }
});

test("postMessage failure and already-aborted input release the Worker", async () => {
  const worker = new FakeWorker(); worker.failPost = true;
  await assert.rejects(start(worker), /start/); assert.equal(worker.terminated, 1);
  const other = new FakeWorker(); const abort = new AbortController(); abort.abort();
  await assert.rejects(start(other, { signal: abort.signal }), { name: "AbortError" }); assert.equal(other.terminated, 1);
});

test("HWP file-read failure and cancellation never create an orphan Worker", async () => {
  const original = globalThis.Worker; let created = 0;
  globalThis.Worker = class extends FakeWorker { constructor() { super(); created += 1; } } as unknown as typeof Worker;
  const options = { formatting: true, tables: true, metadata: true };
  try {
    const bad = { name: "a.hwp", arrayBuffer: async () => { throw new Error("read failed"); } } as File;
    await assert.rejects(compareHwpFilePairs([{ beforeFile: bad, afterFile: bad }], options), /read failed/);
    const abort = new AbortController();
    const file = { name: "a.hwp", arrayBuffer: async () => { abort.abort(); return new ArrayBuffer(0); } } as File;
    await assert.rejects(compareHwpFilePairs([{ beforeFile: file, afterFile: file }], options, undefined, "en", abort.signal), { name: "AbortError" });
    assert.equal(created, 0);
  } finally { globalThis.Worker = original; }
});
