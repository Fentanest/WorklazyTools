import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = (path: string) => readFileSync(`src/${path}.ts`, "utf8");
function load(path: string, globals = {}, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source(path), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, require: (id: string) => { assert.ok(id in dependencies, id); return dependencies[id]; }, File, crypto, ...globals });
  return exports as any;
}
const corePath = "app/persistentHandoff";
const pendingPath = "features/office-editor/pendingOfficeFile";
const file = new File(["synthetic-private-content"], "a.docx");
function transactionHarness() {
  const requests: any[] = [];
  const deleted: string[] = [];
  const inserted: any[] = [];
  const store = {
    getAll: () => request(), get: (id: string) => { assert.equal(id, "id"); return request(); },
    openCursor: () => request(), delete: (id: string) => deleted.push(id), add: (value: any) => inserted.push(value),
  };
  const transaction: any = { objectStore: () => store, abort: () => queueMicrotask(() => transaction.onabort()) };
  const database: any = { transaction: () => transaction, close: () => { database.closed = true; } };
  const open: any = { result: database };
  function request() { const r = {}; requests.push(r); return r; }
  const core = load(corePath, { indexedDB: { open: () => { queueMicrotask(() => open.onsuccess()); return open; } } });
  return { core, open, database, transaction, requests, deleted, inserted };
}
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

test("consume only returns after the read+delete transaction commits", async () => {
  const h = transactionHarness();
  const promise = h.core.consumePersistentHandoff({ id: "id", nonce: "nonce" });
  let settled = false; void promise.then(() => { settled = true; });
  await tick();
  h.requests[0].result = { id: "id", nonce: "nonce", receiverId: "office-editor", entryPath: h.core.OFFICE_HANDOFF_PATH,
    schema: 1, file, createdAt: Date.now(), expiresAt: 0 };
  h.requests[0].result.expiresAt = h.requests[0].result.createdAt + h.core.HANDOFF_TTL_MS;
  h.requests[0].onsuccess();
  assert.deepEqual(h.deleted, ["id"]); await tick(); assert.equal(settled, false);
  h.transaction.oncomplete(); assert.equal(await promise, file); assert.equal(h.database.closed, true);
});
test("an aborted consume never returns a file even after get succeeds", async () => {
  const h = transactionHarness(); const promise = h.core.consumePersistentHandoff({ id: "id", nonce: "nonce" });
  const rejected = assert.rejects(promise, { code: "unavailable" }); await tick();
  h.requests[0].result = undefined; h.requests[0].onsuccess(); h.transaction.onabort(); await rejected;
  assert.equal(h.database.closed, true);
});
test("mismatched or malformed records are not deleted or delivered", async () => {
  for (const patch of [{ nonce: "wrong" }, { receiverId: "other" }, { entryPath: "/wrong" }, { schema: 2 }, { expiresAt: 1 }, { file: {} }]) {
    const h = transactionHarness(); const promise = h.core.consumePersistentHandoff({ id: "id", nonce: "nonce" }); await tick();
    const now = Date.now(); h.requests[0].result = { id: "id", nonce: "nonce", receiverId: "office-editor", entryPath: h.core.OFFICE_HANDOFF_PATH, schema: 1, file, createdAt: now, expiresAt: now + h.core.HANDOFF_TTL_MS, ...patch };
    h.requests[0].onsuccess(); h.transaction.oncomplete(); assert.equal(await promise, undefined); assert.deepEqual(h.deleted, []);
  }
});
test("matching expired consume deletes in its transaction without delivering; mismatches remain", async () => {
  for (const patch of [{}, { id: "other" }, { nonce: "wrong" }, { receiverId: "other" }, { entryPath: "/wrong" }]) {
    const h = transactionHarness(); const promise = h.core.consumePersistentHandoff({ id: "id", nonce: "nonce" }); await tick();
    const createdAt = Date.now() - h.core.HANDOFF_TTL_MS - 1;
    h.requests[0].result = { id: "id", nonce: "nonce", receiverId: "office-editor", entryPath: h.core.OFFICE_HANDOFF_PATH,
      schema: 1, file, createdAt, expiresAt: createdAt + h.core.HANDOFF_TTL_MS, ...patch };
    let settled = false; void promise.then(() => { settled = true; });
    h.requests[0].onsuccess();
    assert.deepEqual(h.deleted, Object.keys(patch).length ? [] : ["id"]);
    await tick(); assert.equal(settled, false);
    h.transaction.oncomplete(); assert.equal(await promise, undefined);
  }
});
test("capacity refuses a 21st live record without replacing existing records", async () => {
  const h = transactionHarness(); const promise = h.core.stagePersistentHandoff(file);
  const rejected = assert.rejects(promise, { code: "full" }); await tick();
  h.requests[0].result = Array.from({ length: 20 }, (_, id) => ({ id, expiresAt: Date.now() + 10000 }));
  h.requests[0].onsuccess(); h.transaction.oncomplete(); await rejected;
  assert.equal(h.inserted.length, 0); assert.equal(h.deleted.length, 0);
});
test("stage cleans expired records before inserting a schema-1 record with a 15-minute lifetime", async () => {
  const h = transactionHarness(); const promise = h.core.stagePersistentHandoff(file); await tick();
  h.requests[0].result = [{ id: "old", expiresAt: 0 }]; h.requests[0].onsuccess(); h.transaction.oncomplete();
  const token = await promise; const record = h.inserted[0];
  assert.deepEqual(h.deleted, ["old"]); assert.equal(record.id, token.id); assert.equal(record.nonce, token.nonce);
  assert.equal(record.expiresAt - record.createdAt, 900000); assert.equal(record.schema, 1); assert.equal(record.file, file);
});
test("blocked rejects promptly and a late upgrade is aborted", async () => {
  const h = transactionHarness();
  // Replace the fake open's automatic success for this event-order test.
  const open: any = { transaction: { abort() { open.aborted = true; } }, result: h.database };
  const core = load(corePath, { indexedDB: { open: () => open } });
  const rejected = assert.rejects(core.purgeExpired(), { code: "blocked" });
  open.onblocked(); await rejected; open.onupgradeneeded(); open.onsuccess();
  assert.equal(open.aborted, true); assert.equal(h.database.closed, true);
});
test("connections close when a later version requests an upgrade", async () => {
  const h = transactionHarness(); const promise = h.core.purgeExpired(); await tick();
  h.database.onversionchange(); assert.equal(h.database.closed, true);
  h.requests[0].result = null; h.requests[0].onsuccess(); h.transaction.oncomplete(); await promise;
});
function tokenHarness(overrides = {}) {
  const values = new Map(); const events: string[] = [];
  const core = { PersistentHandoffError: class extends Error { code: string; constructor(code: string) { super(code); this.code = code; } },
    stagePersistentHandoff: async () => ({ id: "id", nonce: "nonce" }), cancelPersistentHandoff: async () => { events.push("cancel"); },
    consumePersistentHandoff: async () => { events.push("consume"); assert.equal(values.size, 0); return file; }, ...overrides };
  const sessionStorage = { setItem: (k: string, v: string) => values.set(k, v), getItem: (k: string) => values.get(k) ?? null,
    removeItem: (k: string) => { events.push("remove"); values.delete(k); } };
  return { module: load(pendingPath, { sessionStorage }, { "../../app/persistentHandoff": core }), values, events, sessionStorage };
}
test("tab token contains only id/nonce and is removed before consume", async () => {
  const h = tokenHarness(); await h.module.stagePendingOfficeFile(file);
  assert.deepEqual(JSON.parse(h.values.get("worklazy-handoff-token:office-editor")), { id: "id", nonce: "nonce" });
  assert.equal(await h.module.takePendingOfficeFile(), file); assert.deepEqual(h.events, ["remove", "consume"]);
  assert.equal(await h.module.takePendingOfficeFile(), undefined);
});
test("missing, malformed and already-consumed tokens cannot fall back to another record", async () => {
  const h = tokenHarness({ consumePersistentHandoff: async () => undefined });
  for (const value of ['null', '{', '{"id":1}', '{"id":"id","nonce":"nonce"}']) {
    h.values.set("worklazy-handoff-token:office-editor", value);
    await assert.rejects(h.module.takePendingOfficeFile(), { code: "notReceived" }); assert.equal(h.values.size, 0);
  }
});
test("unavailable sessionStorage cancels the just-staged file", async () => {
  const h = tokenHarness(); h.sessionStorage.setItem = () => { throw new Error("quota"); };
  await assert.rejects(h.module.stagePendingOfficeFile(file), { code: "unavailable" }); assert.deepEqual(h.events, ["cancel"]);
});
