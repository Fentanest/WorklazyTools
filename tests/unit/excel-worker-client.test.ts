import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function harness(isolated = true, failConstruction = false, failPost = false) {
  const instances: FakeWorker[] = [], revoked: string[] = [], blobs: Blob[] = [];
  class FakeWorker {
    onmessage?: (event: any) => void;
    onerror?: (event: any) => void;
    terminated = 0;
    readonly url: string | URL;
    constructor(url: string | URL) {
      this.url = url;
      if (failConstruction) throw new Error("constructor failure");
      instances.push(this);
    }
    terminate() { this.terminated++; }
    postMessage() { if (failPost) throw new Error("dispatch failure"); }
  }
  class TestURL extends URL {
    static createObjectURL(blob: Blob) { blobs.push(blob); return "blob:https://example.test/owned-worker"; }
    static revokeObjectURL(url: string) { revoked.push(url); }
  }
  const exports: any = {};
  const source = readFileSync("src/features/excel-merger/excelWorkerClient.ts", "utf8")
    .replaceAll("import.meta.url", JSON.stringify("https://example.test/assets/client.js"));
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, {
    exports, require: (id: string) => {
      assert.equal(id, "./excel.worker.ts?worker&url");
      return { default: "/assets/excel.worker-test.js", __esModule: true };
    }, URL: TestURL, Blob, Worker: FakeWorker, crossOriginIsolated: isolated, DOMException,
  });
  const inspect = () => exports.inspectExcelFiles([{ id: "synthetic", file: new File(["synthetic"], "input.xlsx") }], "en");
  const created = async () => { await new Promise<void>(resolve => setImmediate(resolve)); return instances[0]; };
  const released = () => { assert.equal(instances[0].terminated, 1); assert.deepEqual(revoked, ["blob:https://example.test/owned-worker"]); };
  return { exports, inspect, created, instances, revoked, blobs, released };
}

test("isolated Excel worker keeps its URL through progress and releases it once after result", async () => {
  const h = harness(); const pending = h.inspect(); const worker = await h.created();
  assert.equal(h.blobs.length, 1);
  assert.match(await h.blobs[0].text(), /^import "https:\/\/example.test\/assets\/excel.worker-test.js";$/);
  worker.onmessage?.({ data: { type: "progress" } }); assert.deepEqual(h.revoked, []);
  worker.onmessage?.({ data: { type: "result", result: ["ready"] } });
  assert.deepEqual(await pending, ["ready"]); h.released();
  worker.onerror?.({ preventDefault() {} }); h.released();
});
test("Excel worker startup error releases the owned URL and returns the localized error", async () => {
  const h = harness(); const pending = h.inspect(); const worker = await h.created();
  worker.onerror?.({ preventDefault() {} }); await assert.rejects(pending, /Could not start file processing/); h.released();
});
test("Excel merge abort terminates the worker and releases its URL", async () => {
  const h = harness(), controller = new AbortController();
  const pending = h.exports.mergeExcelFiles([], {}, undefined, "en", controller.signal);
  const rejected = assert.rejects(pending, { name: "AbortError" });
  controller.abort(); await rejected; h.released();
});
test("Excel worker construction failure releases the URL even before ownership is returned", async () => {
  const h = harness(true, true); await assert.rejects(h.inspect(), /constructor failure/);
  assert.deepEqual(h.revoked, ["blob:https://example.test/owned-worker"]); assert.equal(h.instances.length, 0);
});
test("Excel dispatch failure terminates the worker and releases the URL", async () => {
  const h = harness(true, false, true); await assert.rejects(h.inspect(), /dispatch failure/); h.released();
});
test("ordinary Excel keeps a direct worker without allocating a Blob URL", async () => {
  const h = harness(false); const pending = h.inspect(); const worker = await h.created();
  assert.equal(String(worker.url), "https://example.test/assets/excel.worker-test.js");
  worker.onmessage?.({ data: { type: "result", result: [] } }); await pending;
  assert.equal(worker.terminated, 1); assert.deepEqual(h.blobs, []); assert.deepEqual(h.revoked, []);
});
