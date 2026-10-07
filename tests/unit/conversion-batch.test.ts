import assert from "node:assert/strict";
import { test } from "node:test";
import { BatchQueue, BatchFailure, BATCH_LIMITS } from "../../src/features/conversion-batch/batchQueue.ts";
const file = (name: string) => new File(["document"], name);
const output = (name: string) => ({ blob: new Blob(["result"]), fileName: name });

test("batch preserves order, isolates failures, and reserves collision-safe result names", async () => {
  const queue = new BatchQueue(() => undefined); queue.add([file("a.pdf"), file("bad.pdf"), file("A.pdf")]);
  const seen: string[] = [];
  await queue.run(async input => { seen.push(input.name); if (input.name === "bad.pdf") throw new Error("private parser detail"); return output(input.name.replace(/pdf$/, "docx")); });
  assert.deepEqual(seen, ["a.pdf", "bad.pdf", "A.pdf"]);
  assert.deepEqual(queue.items.map(item => item.status), ["success", "failed", "success"]);
  assert.equal(queue.items[1].error, "conversion"); assert.equal(queue.items[2].output?.fileName, "A-2.docx");
  queue.retry(queue.items[1].id); await queue.run(async () => output("bad.docx"));
  assert.ok(queue.items.every(item => item.status === "success")); queue.dispose();
});
test("cancelling an active conversion discards late results before starting next file", async () => {
  const queue = new BatchQueue(() => undefined); queue.add([file("a.pdf"), file("b.pdf")]);
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); const started: string[] = [];
  const run = queue.run(async (input, signal, progress) => { started.push(input.name); if (input.name === "a.pdf") { await gate; progress(99); assert.equal(signal.aborted, true); } return output(input.name); });
  queue.cancel(queue.items[0].id); assert.deepEqual(started, ["a.pdf"]); release(); await run;
  assert.deepEqual(started, ["a.pdf", "b.pdf"]); assert.equal(queue.items[0].output, undefined); assert.equal(queue.items[0].progress, 0); assert.equal(queue.items[1].status, "success"); queue.dispose();
});
test("cancel all preserves completed results and does not process pending files", async () => {
  const queue = new BatchQueue(() => undefined); queue.add([file("first.pdf")]); await queue.run(async () => output("first.pdf")); queue.add([file("second.pdf"), file("third.pdf")]);
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); let count = 0;
  const run = queue.run(async () => { count++; await gate; return output("second.pdf"); }); queue.cancelAll(); release(); await run;
  assert.equal(count, 1); assert.deepEqual(queue.items.map(item => item.status), ["success", "cancelled", "cancelled"]); queue.dispose();
});
test("parallel start is ignored and disposed queues never publish a late output", async () => {
  const queue = new BatchQueue(() => undefined); queue.add([file("a.pdf")]); let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  let count = 0; const process = async () => { count++; await gate; return output("a.pdf"); };
  const run = queue.run(process); await queue.run(process); queue.dispose(); release(); await run; assert.equal(count, 1); assert.deepEqual(queue.items, []);
});
test("admission caps reject the whole selection; individual invalid files remain visible", () => {
  const queue = new BatchQueue(input => input.name.endsWith(".pdf") ? undefined : "unsupported");
  assert.equal(queue.add(Array.from({ length: 21 }, () => file("a.pdf"))), false); assert.equal(queue.items.length, 0);
  assert.equal(queue.add([file("invalid.exe"), file("good.pdf")]), true); assert.equal(queue.items[0].error, "unsupported"); assert.equal(queue.items[1].status, "pending");
  const large = file("large.pdf"); Object.defineProperty(large, "size", { value: BATCH_LIMITS.fileBytes + 1 }); queue.add([large]); assert.equal(queue.items[2].error, "input-limit"); queue.dispose();
});
test("result cap retains existing downloads and pauses remaining work", async () => {
  const queue = new BatchQueue(() => undefined); queue.add([file("a.pdf"), file("b.pdf"), file("c.pdf")]); let count = 0;
  await queue.run(async () => { count++; if (count === 2) throw new BatchFailure("output-limit"); return output("a.pdf"); });
  assert.deepEqual(queue.items.map(item => item.status), ["success", "failed", "pending"]); assert.equal(queue.items[1].error, "output-limit"); queue.dispose();
});
test("manual print rows never claim downloadable or saved success", async () => {
  const queue = new BatchQueue(input => input.name.endsWith(".hwp") ? "print-needed" : undefined); queue.add([file("a.hwp"), file("b.doc")]);
  let count = 0; await queue.run(async () => { count++; return output("b.pdf"); }); queue.reviewed(queue.items[0].id); queue.saved(queue.items[0].id);
  assert.equal(count, 1); assert.equal(queue.items[0].status, "print-reviewed"); assert.equal(queue.items[0].saved, false); assert.equal(queue.items[0].output, undefined); queue.retry(queue.items[0].id); assert.equal(queue.items[0].status, "print-needed"); queue.dispose();
});
test("maximum-length duplicate filenames terminate with distinct valid UTF-8 names", async () => {
  const queue = new BatchQueue(() => undefined); queue.add([file("a.pdf"), file("b.pdf")]);
  await queue.run(async () => output("가".repeat(83) + ".docx"));
  const names = queue.items.map(item => item.output!.fileName); assert.notEqual(names[0], names[1]); assert.ok(names.every(name => new TextEncoder().encode(name).length <= 255)); assert.match(names[1], /-2\.docx$/); queue.dispose();
});
