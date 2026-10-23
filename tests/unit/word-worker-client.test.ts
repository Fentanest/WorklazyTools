import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { compareWordFilePairs } from "../../src/features/word-compare/wordWorkerClient.ts";
const previousWorker = globalThis.Worker;
class FakeWorker {
  static instances: FakeWorker[] = [];
  static failConstruction = false;
  static failPost = false;
  static onCreate?: () => void;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  terminated = 0;
  sent = 0;
  constructor() { if (FakeWorker.failConstruction) throw new Error("raw module internals"); FakeWorker.instances.push(this); FakeWorker.onCreate?.(); }
  postMessage() { this.sent++; if (FakeWorker.failPost) throw new Error("raw clone internals"); }
  terminate() { this.terminated++; }
}
const options = { formatting: true, tables: true, metadata: true, trackedDocument: true, rewriteRevisionAuthor: false, revisionAuthor: "Reviewer" };
const file = (name: string, read = async () => new ArrayBuffer(1)) => ({ name, arrayBuffer: read }) as File;
const pairs = () => [{ beforeFile: file("before.docx"), afterFile: file("after.docx") }];
beforeEach(() => { FakeWorker.instances = []; FakeWorker.failConstruction = FakeWorker.failPost = false; FakeWorker.onCreate = undefined; globalThis.Worker = FakeWorker as unknown as typeof Worker; });
afterEach(() => { globalThis.Worker = previousWorker; });
test("failed file read creates no Word worker and exposes a safe message", async () => {
  await assert.rejects(compareWordFilePairs([{ beforeFile: file("bad.docx", async () => { throw new Error("private read internals"); }), afterFile: file("after.docx") }], options, undefined, "en"), /Could not read the selected Word files/);
  assert.equal(FakeWorker.instances.length, 0);
});
test("abort during delayed read never creates worker or starts next read", async () => {
  let release!: (value: ArrayBuffer) => void;
  let afterReads = 0;
  const controller = new AbortController();
  const pending = compareWordFilePairs([{ beforeFile: file("before.docx", () => new Promise((resolve) => { release = resolve; })), afterFile: file("after.docx", async () => { afterReads++; return new ArrayBuffer(1); }) }], options, undefined, "en", controller.signal);
  controller.abort(); release(new ArrayBuffer(1));
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(FakeWorker.instances.length, 0); assert.equal(afterReads, 0);
});
test("pre-aborted request does not read a file or create worker", async () => {
  const controller = new AbortController(); controller.abort(); let reads = 0;
  await assert.rejects(compareWordFilePairs([{ beforeFile: file("before.docx", async () => { reads++; return new ArrayBuffer(1); }), afterFile: file("after.docx") }], options, undefined, "en", controller.signal), { name: "AbortError" });
  assert.equal(reads, 0); assert.equal(FakeWorker.instances.length, 0);
});
test("constructor failure is localized", async () => {
  FakeWorker.failConstruction = true;
  await assert.rejects(compareWordFilePairs(pairs(), options, undefined, "en"), /Could not start Word comparison/);
});
test("failed post terminates Word worker once", async () => {
  FakeWorker.failPost = true;
  await assert.rejects(compareWordFilePairs(pairs(), options, undefined, "en"), /Could not start Word comparison/);
  assert.equal(FakeWorker.instances[0].terminated, 1);
});
test("abort at worker creation prevents dispatch and terminates", async () => {
  const controller = new AbortController(); FakeWorker.onCreate = () => controller.abort();
  await assert.rejects(compareWordFilePairs(pairs(), options, undefined, "en", controller.signal), { name: "AbortError" });
  assert.equal(FakeWorker.instances[0].sent, 0); assert.equal(FakeWorker.instances[0].terminated, 1);
});
test("messageerror is terminal", async () => {
  const pending = compareWordFilePairs(pairs(), options, undefined, "en"); await setImmediate();
  FakeWorker.instances[0].onmessageerror?.({} as MessageEvent);
  await assert.rejects(pending, /Could not read the comparison result/); assert.equal(FakeWorker.instances[0].terminated, 1);
});
test("safe localized worker errors are preserved", async () => {
  const pending = compareWordFilePairs(pairs(), options, undefined, "ko"); await setImmediate();
  FakeWorker.instances[0].onmessage?.({ data: { type: "error", error: { message: "1번 문서 쌍: 암호로 보호된 Word 파일은 열 수 없습니다." } } } as MessageEvent);
  await assert.rejects(pending, /1번 문서 쌍: 암호로 보호된 Word 파일/);
});
test("malformed or incomplete result is rejected", async () => {
  for (const result of [{}, []]) {
    const pending = compareWordFilePairs(pairs(), options, undefined, "en"); await setImmediate();
    FakeWorker.instances.at(-1)!.onmessage?.({ data: { type: "result", result } } as MessageEvent);
    await assert.rejects(pending, /An error occurred/); assert.equal(FakeWorker.instances.at(-1)!.terminated, 1);
  }
});
test("result settles once and late progress cannot reach consumer", async () => {
  let progress = 0;
  const pending = compareWordFilePairs(pairs(), options, () => progress++, "en"); await setImmediate();
  const worker = FakeWorker.instances[0], message = worker.onmessage!;
  message({ data: { type: "progress", progress: 50, message: "Working" } } as MessageEvent);
  message({ data: { type: "result", result: [{ result: {} }] } } as MessageEvent);
  await pending;
  message({ data: { type: "progress", progress: 99, message: "Late" } } as MessageEvent);
  assert.equal(progress, 1); assert.equal(worker.terminated, 1);
  assert.equal(worker.onmessage, null); assert.equal(worker.onmessageerror, null);
});
