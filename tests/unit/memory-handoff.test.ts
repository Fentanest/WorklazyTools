import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isAutoReloadHeld } from "../../src/app/chunkRecovery.ts";
import { acceptsFile } from "../../src/app/fileAccepts.ts";
import { clearUnsavedWork, hasUnsavedWork } from "../../src/app/toolState.ts";
import { claimHandoff, stageHandoff, deliverHandoff, closeDelivery, retainDelivery, cancelStagedHandoff,
  clearRecovery, getRecovery, transferToRecovery, deferErrorNavigation, purgeExpiredHandoffs,
  selectHandoffFiles, validateHandoff, type HandoffInput, type DeliveryResult } from "../../src/app/memoryHandoff.ts";
const file = new File(["synthetic-result"], "result.pdf", { type: "application/pdf" });
const input = (overrides: Partial<HandoffInput> = {}): HandoffInput => ({ receiverId: "pdf-organize", entryPath: "/tools/pdf-editor", files: [file], origin: "generated", source: "unit", ...overrides });
const accepted = (files: File[]): DeliveryResult => ({ status: "accepted", accepted: files, rejected: [] });
const wait = () => new Promise(resolve => setTimeout(resolve, 5));
// Only location is emulated here; browser tests exercise actual History/React.
Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { pathname: "/ko/tools/pdf-editor", search: "" } } });

test("preflight: counts, exact destination, roles and image tabs", () => {
  assert.equal(validateHandoff(input()), null);
  assert.equal(validateHandoff(input({ files: [] })), "count");
  assert.equal(validateHandoff(input({ files: Array(51).fill(file) })), "count");
  assert.equal(validateHandoff(input({ entryPath: "/tools/pdf-editor/split" })), "destination");
  assert.equal(validateHandoff(input({ receiverId: "image-edit", entryPath: "/tools/image-studio" })), "destination");
  assert.equal(validateHandoff(input({ receiverId: "document-generator", entryPath: "/tools/document-generator" })), "roles");
  assert.equal(validateHandoff(input({ receiverId: "document-generator", entryPath: "/tools/document-generator", files: [new File(["x"], "T.DOCX"), new File(["y"], "D.csv")], roles: ["template", "data"] })), null);
  assert.equal(acceptsFile("image-batch", new File([], "A.JPEG")), true);
});
test("single slot: mismatches cannot consume; claim is once; replacement and expiry release holds", () => {
  const old = stageHandoff(input(), 100);
  const token = stageHandoff(input(), 100);
  assert.equal(claimHandoff(old, "pdf-organize", "/tools/pdf-editor", 101), null);
  assert.equal(claimHandoff({ ...token, nonce: "wrong" }, "pdf-organize", "/tools/pdf-editor", 101), null);
  assert.equal(claimHandoff(token, "pdf-finish", "/tools/pdf-editor", 101), null);
  assert.equal(claimHandoff(token, "pdf-organize", "/tools/pdf-editor/merge", 101), null);
  assert.equal(claimHandoff(token, "pdf-organize", "/tools/pdf-editor", 60_100), null);
  assert.equal(isAutoReloadHeld(), false);
  const cancel = stageHandoff(input()); cancelStagedHandoff(cancel);
  assert.equal(isAutoReloadHeld(), false);
});
test("delivery: StrictMode detach/reattach shares one adapter promise; accepted releases refs/hold", async () => {
  let calls = 0, resets = 0;
  const token = stageHandoff(input()); const entry = claimHandoff(token, "pdf-organize", "/tools/pdf-editor")!;
  assert.equal(claimHandoff(token, "pdf-organize", "/tools/pdf-editor"), null);
  const adapter = { kind: "inspection" as const, receive: async () => { calls++; await wait(); return accepted([file]); }, invalidate: () => resets++ };
  const record = deliverHandoff(entry, "/ko/tools/pdf-editor", "same-key", adapter);
  const detach = retainDelivery(record); detach(); const detachAgain = retainDelivery(record);
  assert.equal(deliverHandoff(entry, record.path, "same-key", adapter).promise, record.promise);
  const result = await record.promise; detachAgain(); await wait();
  assert.equal(calls, 1); assert.equal(result.status, "accepted"); assert.equal(resets, 0);
  assert.deepEqual(record.files, []); assert.deepEqual(entry.files, []); assert.equal(isAutoReloadHeld(), false);
});
test("adapter statuses: partial keeps only rejected files; close releases references", async () => {
  const bad = new File(["bad"], "bad.pdf");
  for (const status of ["partial", "rejected", "cancelled"] as const) {
    const token = stageHandoff(input({ files: [file, bad] })); const entry = claimHandoff(token, "pdf-organize", "/tools/pdf-editor")!;
    const record = deliverHandoff(entry, "/ko/tools/pdf-editor", status, { kind: "selection", receive: () => ({ status, accepted: status === "partial" ? [file] : [], rejected: [{ file: bad, reasonCode: "corrupt" }] }) });
    assert.equal((await record.promise).status, status);
    assert.deepEqual(record.files, status === "partial" ? [bad] : [file, bad]);
    assert.deepEqual(record.result?.accepted, []); assert.equal(isAutoReloadHeld(), true);
    closeDelivery(record); assert.equal(isAutoReloadHeld(), false);
  }
});
test("selection result is synchronous and applies format + remaining-count filter", () => {
  const png = new File([], "ok.PNG"), bad = new File([], "bad.gif");
  assert.equal(selectHandoffFiles("image-batch", [png]).status, "accepted");
  assert.equal(selectHandoffFiles("image-batch", [png, bad]).status, "partial");
  assert.equal(selectHandoffFiles("image-batch", [png], 0).status, "rejected");
});
test("same-location error unmount transfers delivery; route exit cancels pending intake", async () => {
  for (const leaving of [false, true]) {
    let resolve!: (value: DeliveryResult) => void, invalidations = 0;
    const token = stageHandoff(input()); const entry = claimHandoff(token, "pdf-organize", "/tools/pdf-editor")!;
    const record = deliverHandoff(entry, "/ko/tools/pdf-editor", "key", { kind: "inspection", receive: () => new Promise(done => { resolve = done; }), invalidate: () => invalidations++ });
    const detach = retainDelivery(record); await Promise.resolve();
    window.location.pathname = leaving ? "/ko/" : "/ko/tools/pdf-editor"; detach(); await wait();
    assert.equal(record.abort.signal.aborted, true); assert.equal(invalidations, 1);
    if (!leaving) { assert.equal(getRecovery()?.files[0], file); assert.equal(hasUnsavedWork(), true); clearRecovery(); }
    else assert.equal(getRecovery(), null);
    resolve(accepted([file])); await record.promise;
    assert.equal(isAutoReloadHeld(), false); window.location.pathname = "/ko/tools/pdf-editor";
  }
});
test("boundary transfer from unclaimed slot keeps hold and executes deferred assign only after recovery", () => {
  stageHandoff(input()); transferToRecovery();
  let assigns = 0; assert.equal(deferErrorNavigation(() => assigns++), true);
  assert.equal(assigns, 0); assert.equal(isAutoReloadHeld(), true);
  purgeExpiredHandoffs(Date.now() + 90_000); assert.equal(getRecovery()?.files[0], file);
  clearRecovery(); assert.equal(assigns, 1); assert.equal(isAutoReloadHeld(), false); assert.equal(hasUnsavedWork(), false);
});
test("bfcache age purge removes expired slot/cache, not explicit recovery", async () => {
  const token = stageHandoff(input({ origin: "user-input" }), 100);
  const entry = claimHandoff(token, "pdf-organize", "/tools/pdf-editor", 101)!;
  const record = deliverHandoff(entry, "/ko/tools/pdf-editor", "old", { kind: "selection", receive: () => ({ status: "rejected", accepted: [], rejected: [{ file, reasonCode: "bad" }] }) });
  await record.promise; purgeExpiredHandoffs(60_100); assert.equal(record.closed, true);
  stageHandoff(input(), 100); purgeExpiredHandoffs(60_100); assert.equal(isAutoReloadHeld(), false);
  clearUnsavedWork("handoff-recovery");
});
test("inspection timeout invalidates before reset result and ignores late acceptance", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let resolve!: (value: DeliveryResult) => void;
  let generation = 0, stored = 0;
  const token = stageHandoff(input()); const entry = claimHandoff(token, "pdf-organize", "/tools/pdf-editor")!;
  const record = deliverHandoff(entry, "/ko/tools/pdf-editor", "timeout", { kind: "inspection", invalidate: () => { generation++; stored = 0; },
    receive: async (_entry, { signal }) => { const original = generation; const value = await new Promise<DeliveryResult>(done => { resolve = done; }); if (original === generation && !signal.aborted) stored++; return value; } });
  await Promise.resolve(); context.mock.timers.tick(30_000);
  assert.equal((await record.promise).rejected[0].reasonCode, "timeout");
  assert.equal(generation, 1); resolve(accepted([file])); await Promise.resolve(); await Promise.resolve();
  assert.equal(stored, 0); closeDelivery(record); assert.equal(isAutoReloadHeld(), false);
  context.mock.timers.reset();
});
test("new claim leaves the older mounted chip downloadable until its owner dismisses it", async () => {
  const oldToken = stageHandoff(input()); const oldEntry = claimHandoff(oldToken, "pdf-organize", "/tools/pdf-editor")!;
  const oldRecord = deliverHandoff(oldEntry, "/ko/tools/pdf-editor", "old", { kind: "selection", receive: () => ({ status: "rejected", accepted: [], rejected: [{ file, reasonCode: "bad" }] }) });
  const detach = retainDelivery(oldRecord); await oldRecord.promise;
  const nextToken = stageHandoff(input()); const nextEntry = claimHandoff(nextToken, "pdf-organize", "/tools/pdf-editor")!;
  const next = deliverHandoff(nextEntry, "/ko/tools/pdf-editor", "next", { kind: "selection", receive: () => accepted([file]) });
  await next.promise; assert.deepEqual(oldRecord.files, [file]); assert.equal(isAutoReloadHeld(), true);
  closeDelivery(oldRecord); detach(); assert.equal(isAutoReloadHeld(), false);
});
test("cancelled pending delivery settles without another timeout invalidation", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let resets = 0;
  const token = stageHandoff(input()); const entry = claimHandoff(token, "pdf-organize", "/tools/pdf-editor")!;
  const record = deliverHandoff(entry, "/ko/tools/pdf-editor", "pending", { kind: "inspection", receive: () => new Promise(() => {}), invalidate: () => resets++ });
  await Promise.resolve(); closeDelivery(record); await record.promise; context.mock.timers.tick(30_000);
  assert.equal(resets, 1); assert.equal(isAutoReloadHeld(), false); context.mock.timers.reset();
});
test("memory contract uses no persistent storage, URL token, feature imports or object URLs", () => {
  const source = readFileSync(new URL("../../src/app/memoryHandoff.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|caches\.|createObjectURL|URLSearchParams/);
  assert.doesNotMatch(readFileSync(new URL("../../src/app/fileAccepts.ts", import.meta.url), "utf8"), /import.*(?:features|pages)/);
});
