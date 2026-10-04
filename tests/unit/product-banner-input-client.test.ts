import test from "node:test";
import assert from "node:assert/strict";
import { extractInputProducts, summarizeSheets } from "../../src/features/product-banner/inputMapping.ts";
import { parseInputBytes } from "../../src/features/product-banner/inputParser.ts";
import { combineProductFiles, extractProductFile, inspectProductFile, readProductFiles, type InputWorkerRequest } from "../../src/features/product-banner/inputClient.ts";
import { INPUT_LIMITS, ProductBannerInputError } from "../../src/features/product-banner/inputTypes.ts";
import { syntheticBytes } from "../fixtures/product-banner/synthetic.ts";

class FakeWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { preventDefault(): void }) => void) | null = null;
  terminated = 0; detached = false; transfers = 0;
  mode: "result" | "wait" | "error" | "post-error";
  constructor(mode: "result" | "wait" | "error" | "post-error" = "result") { this.mode = mode; }
  terminate() { this.terminated++; }
  postMessage(request: InputWorkerRequest, transfer: Transferable[]) {
    if (this.mode === "post-error") throw new Error("private raw detail");
    this.transfers = transfer.length;
    const cloned = structuredClone(request, { transfer }); this.detached = request.buffer.byteLength === 0;
    queueMicrotask(() => {
      if (this.mode === "wait") return;
      if (this.mode === "error") { this.onerror?.({ preventDefault() {} }); return; }
      this.onmessage?.({ data: { type: "progress", progress: 0.5, phase: "parsing" } });
      try {
        const book = parseInputBytes(cloned.buffer);
        const result = cloned.type === "inspect" ? summarizeSheets(book) : extractInputProducts(book, cloned.fileIndex, cloned.fileName, cloned.selections);
        this.onmessage?.({ data: { type: "result", result } });
      } catch (error) { this.onmessage?.({ data: { type: "error", code: (error as ProductBannerInputError).code } }); }
    });
  }
}
const file = () => new File([syntheticBytes("xlsx")], "synthetic.csv");
const workerFactory = (worker: FakeWorker) => () => worker as unknown as Worker;
const rejects = (code: string) => (error: unknown) => error instanceof ProductBannerInputError && error.code === code;
test("client transfers/detaches buffer, reports progress, terminates after result and supports inspect", async () => {
  const worker = new FakeWorker(), progress: number[] = [];
  const result = await extractProductFile(file(), 3, { createWorker: workerFactory(worker), onProgress: (p) => progress.push(p.progress) });
  assert.equal(result.products.length, 3); assert.equal(result.fileIndex, 3);
  assert.equal(worker.detached, true); assert.equal(worker.transfers, 1); assert.equal(worker.terminated, 1); assert.deepEqual(progress, [0.5]);
  const inspector = new FakeWorker(); const summary = await inspectProductFile(file(), { createWorker: workerFactory(inspector) });
  assert.equal(summary.length, 1); assert.equal(summary[0].suggestedHeaderRow, 1); assert.equal(inspector.terminated, 1);
});
test("cancel before reading or while Worker waits; retry uses a new Worker", async () => {
  const before = new AbortController(); before.abort(); let created = 0;
  await assert.rejects(extractProductFile(file(), 0, { signal: before.signal, createWorker: () => { created++; return new FakeWorker() as unknown as Worker; } }), rejects("CANCELED"));
  assert.equal(created, 0);
  const during = new AbortController(), worker = new FakeWorker("wait");
  const pending = extractProductFile(file(), 0, { signal: during.signal, createWorker: workerFactory(worker) });
  await new Promise((resolve) => setImmediate(resolve)); during.abort();
  await assert.rejects(pending, rejects("CANCELED")); assert.equal(worker.terminated, 1);
  const retry = new FakeWorker(); assert.equal((await extractProductFile(file(), 0, { createWorker: workerFactory(retry) })).products.length, 3);
  assert.equal(retry.terminated, 1);
});
test("startup, runtime, transfer and timeout failures end Worker with public codes", async () => {
  await assert.rejects(extractProductFile(file(), 0, { createWorker: () => { throw new Error("secret"); } }), rejects("WORKER_START_FAILED"));
  for (const mode of ["error", "post-error", "wait"] as const) {
    const worker = new FakeWorker(mode);
    await assert.rejects(extractProductFile(file(), 0, { createWorker: workerFactory(worker), inactivityTimeoutMs: 10 }), rejects(mode === "wait" ? "WORKER_TIMEOUT" : "WORKER_START_FAILED"));
    assert.equal(worker.terminated, 1);
  }
  const damaged = new FakeWorker();
  await assert.rejects(extractProductFile(new File([new Uint8Array([0x50, 0x4b, 3, 4])], "a"), 0, { createWorker: workerFactory(damaged) }), rejects("DAMAGED_FILE"));
  assert.equal(damaged.terminated, 1);
});
test("empty/oversized inputs never create a Worker", async () => {
  let created = 0; const createWorker = () => { created++; return new FakeWorker() as unknown as Worker; };
  await assert.rejects(extractProductFile(new File([], "empty"), 0, { createWorker }), rejects("EMPTY_FILE"));
  await assert.rejects(extractProductFile(new File([new Uint8Array(INPUT_LIMITS.fileBytes + 1)], "large"), 0, { createWorker }), rejects("FILE_TOO_LARGE"));
  assert.equal(created, 0);
});
test("completion order does not reorder files; failed files preserve valid and duplicate products", async () => {
  const files = [file(), file(), file()]; const completed: number[] = [];
  const result = await combineProductFiles(files, async (_file, index) => {
    await new Promise((resolve) => setTimeout(resolve, [20, 5, 1][index])); completed.push(index);
    if (index === 1) throw new ProductBannerInputError("ENCRYPTED_FILE");
    return extractInputProducts(parseInputBytes(syntheticBytes("xlsx")), index, _file.name);
  });
  assert.deepEqual(completed, [2, 1, 0]); assert.deepEqual(result.files.map((f) => f.fileIndex), [0, 2]);
  assert.deepEqual(result.products.map((p) => p.source.fileIndex), [0, 0, 0, 2, 2, 2]);
  assert.deepEqual(result.failures.map((f) => [f.fileIndex, f.code]), [[1, "ENCRYPTED_FILE"]]);
  assert.equal(result.products[0].promotionUrl, result.products[3].promotionUrl);
});
test("batch upper bound fails excess files explicitly while preserving earlier success", async () => {
  const one = extractInputProducts(parseInputBytes(syntheticBytes("xlsx")), 0, "a");
  const result = await combineProductFiles([file(), file()], async (_file, i) => ({ ...one, fileIndex: i, products: Array.from({ length: 6000 }, () => ({ ...one.products[0], source: { ...one.products[0].source, fileIndex: i } })) }));
  assert.equal(result.products.length, 6000); assert.equal(result.failures[0].code, "PRODUCT_LIMIT"); assert.equal(result.failures[0].fileIndex, 1);
});
test("production serial reader preserves file indices and partial failure; canceled batch can retry", async () => {
  const workers: FakeWorker[] = []; const createWorker = () => { const worker = new FakeWorker(); workers.push(worker); return worker as unknown as Worker; };
  const input = [file(), new File([], "empty"), file()];
  const result = await readProductFiles(input, { createWorker });
  assert.deepEqual(result.files.map((f) => f.fileIndex), [0, 2]); assert.equal(result.products.length, 6);
  assert.deepEqual(result.failures.map((f) => [f.fileIndex, f.code]), [[1, "EMPTY_FILE"]]);
  assert.ok(workers.every((w) => w.terminated === 1));
  const controller = new AbortController(); controller.abort();
  assert.equal((await readProductFiles(input, { signal: controller.signal, createWorker })).products.length, 0);
  assert.equal((await readProductFiles([file()], { createWorker })).products.length, 3);
});
