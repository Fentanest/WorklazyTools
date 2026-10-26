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
const emptyResult = { beforeName: "before.docx", afterName: "after.docx", summary: { added: 0, deleted: 0, changed: 0, format: 0, unchanged: 0 }, changes: [], tables: [], warnings: [], views: { document: [], headerFooter: [], note: [] } };
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
  for (const result of [{}, [], [null], [{ result: {} }], [{ result: { ...emptyResult, beforeName: "wrong.docx" } }]]) {
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
  message({ data: { type: "result", result: [{ result: emptyResult }] } } as MessageEvent);
  await pending;
  message({ data: { type: "progress", progress: 99, message: "Late" } } as MessageEvent);
  assert.equal(progress, 1); assert.equal(worker.terminated, 1);
  assert.equal(worker.onmessage, null); assert.equal(worker.onmessageerror, null);
});
test("screen results arrive first, tracked files follow, done settles with both", async () => {
  const seen: string[] = [];
  const pending = compareWordFilePairs(pairs(), options, undefined, "en", undefined, {
    onScreen: (index, result) => seen.push(`screen:${index}:${result.beforeName}`),
    onTracked: (index, buffer, warnings) => seen.push(`tracked:${index}:${buffer?.byteLength}:${warnings.length}`),
  }); await setImmediate();
  const message = FakeWorker.instances[0].onmessage!;
  message({ data: { type: "screen", index: 0, result: structuredClone(emptyResult) } } as MessageEvent);
  assert.deepEqual(seen, ["screen:0:before.docx"]); assert.equal(FakeWorker.instances[0].terminated, 0);
  message({ data: { type: "tracked", index: 0, trackedBuffer: new ArrayBuffer(4), warnings: [] } } as MessageEvent);
  message({ data: { type: "done" } } as MessageEvent);
  const [entry] = await pending;
  assert.deepEqual(seen, ["screen:0:before.docx", "tracked:0:4:0"]); assert.equal(entry.trackedBuffer?.byteLength, 4); assert.equal(FakeWorker.instances[0].terminated, 1);
});
test("a missing tracked file adds its warning to the pair result", async () => {
  const pending = compareWordFilePairs(pairs(), options, undefined, "en"); await setImmediate();
  const message = FakeWorker.instances[0].onmessage!;
  message({ data: { type: "screen", index: 0, result: structuredClone(emptyResult) } } as MessageEvent);
  message({ data: { type: "tracked", index: 0, trackedBuffer: undefined, warnings: ["no docx"] } } as MessageEvent);
  message({ data: { type: "done" } } as MessageEvent);
  const [entry] = await pending; assert.equal(entry.trackedBuffer, undefined); assert.deepEqual(entry.result.warnings, ["no docx"]);
});
test("out-of-order, duplicate or malformed progressive messages are rejected", async () => {
  const cases = [
    [{ type: "tracked", index: 0, trackedBuffer: new ArrayBuffer(1), warnings: [] }],
    [{ type: "screen", index: 1, result: emptyResult }],
    [{ type: "screen", index: 0, result: emptyResult }, { type: "screen", index: 0, result: emptyResult }],
    [{ type: "screen", index: 0, result: { ...emptyResult, afterName: "x.docx" } }],
    [{ type: "screen", index: 0, result: emptyResult }, { type: "tracked", index: 0, trackedBuffer: new ArrayBuffer(0), warnings: [] }],
    [{ type: "screen", index: 0, result: emptyResult }, { type: "tracked", index: 0, warnings: [1] }],
    [{ type: "done" }],
  ];
  for (const sequence of cases) {
    const pending = compareWordFilePairs(pairs(), options, undefined, "en"); await setImmediate();
    const worker = FakeWorker.instances.at(-1)!;
    for (const data of sequence) worker.onmessage?.({ data: structuredClone(data) } as MessageEvent);
    await assert.rejects(pending, /An error occurred/, JSON.stringify(sequence)); assert.equal(worker.terminated, 1);
  }
});
test("a worker that dies out of memory reports the memory message", async () => {
  const pending = compareWordFilePairs(pairs(), options, undefined, "ko"); await setImmediate();
  FakeWorker.instances[0].onerror?.({ message: "Uncaught RangeError: Array buffer allocation failed", preventDefault() {} } as ErrorEvent);
  await assert.rejects(pending, /^Error: 메모리가 부족해 비교를 끝내지 못했습니다/);
});
