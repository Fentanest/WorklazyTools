import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = (path: string) => readFileSync(`src/${path}.ts`, "utf8");
function load(path: string, globals = {}, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source(path), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, IDBKeyRange: { upperBound: (value: number) => value }, require: (id: string) => { assert.ok(id in dependencies, id); return dependencies[id]; }, File, crypto, ...globals });
  return exports as any;
}
const corePath = "app/persistentHandoff";
const pendingPath = "features/office-editor/pendingOfficeFile";
const file = new File(["synthetic-private-content"], "a.docx");
function transactionHarness(globals = {}) {
  const requests: any[] = [];
  const deleted: string[] = [];
  const inserted: any[] = [];
  const added: any[] = [];
  const store = {
    getAll: () => request(), get: (_id: string) => request(),
    index: () => ({ openCursor: () => request() }), openCursor: () => request(), delete: (id: string) => deleted.push(id), add: (value: any) => { inserted.push(value); const result = {}; added.push(result); return result; },
  };
  const transaction: any = { objectStore: () => store, abort: () => queueMicrotask(() => transaction.onabort()) };
  const database: any = { transaction: () => transaction, close: () => { database.closed = true; } };
  const open: any = { result: database };
  function request() { const r = {}; requests.push(r); return r; }
  const core = load(corePath, { indexedDB: { open: () => { queueMicrotask(() => open.onsuccess()); return open; } }, ...globals });
  return { core, open, database, transaction, requests, deleted, inserted, added };
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
test("identity and metadata mismatches are not deleted or delivered", async () => {
  for (const patch of [{ nonce: "wrong" }, { receiverId: "other" }, { entryPath: "/wrong" }, { schema: 2 }, { expiresAt: 1 }]) {
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

const isolated = ["document-redactor", "document-to-pdf", "xls-preserve"];
test("all isolated receivers stage files under the exact registered destination", async () => {
  for (const receiverId of isolated) {
    const h = transactionHarness();
    const promise = h.core.stagePersistentFiles({ receiverId, entryPath: h.core.PERSISTENT_RECEIVERS[receiverId], files: [file, file] });
    await tick(); h.requests[0].result = []; h.requests[0].onsuccess(); h.transaction.oncomplete();
    const token = await promise, record = h.inserted[0];
    assert.equal(record.receiverId, receiverId); assert.equal(record.id, token.id);
    assert.equal(record.files.length, 2); assert.equal(record.files[0], file); assert.equal(record.files[1], file); assert.equal(record.file, undefined);
  }
});
test("isolated preflight rejects empty, over-count, oversized and inexact destinations before opening DB", async () => {
  const core = load(corePath, { indexedDB: { open: () => assert.fail("must reject before DB") } });
  const huge = new File([], "large.pdf"); Object.defineProperty(huge, "size", { value: core.HANDOFF_RECORD_BYTES + 1 });
  const input = { receiverId: "document-redactor", entryPath: core.PERSISTENT_RECEIVERS["document-redactor"], files: [file] };
  for (const patch of [{ files: [] }, { files: Array(21).fill(file) }, { files: [huge] }, { files: [{}] },
    { entryPath: input.entryPath + "/" }, { receiverId: "toString" }, { entryPath: "/tools/office-editor/app" }]) {
    await assert.rejects(core.stagePersistentFiles({ ...input, ...patch }), { code: "invalid" });
  }
});
test("global bytes include live Office records, preserve them at overflow and admit exact limits", async () => {
  for (const extra of [0, 1]) {
    const h = transactionHarness();
    const incoming = new File([], "incoming.pdf"); Object.defineProperty(incoming, "size", { value: h.core.HANDOFF_RECORD_BYTES });
    const office = new File([], "office.docx"); Object.defineProperty(office, "size", { value: h.core.HANDOFF_TOTAL_BYTES - incoming.size + extra });
    const promise = h.core.stagePersistentFiles({ receiverId: "document-redactor", entryPath: h.core.PERSISTENT_RECEIVERS["document-redactor"], files: [incoming] });
    const checked = extra ? assert.rejects(promise, { code: "full" }) : promise;
    await tick(); h.requests[0].result = [{ id: "office", receiverId: "office-editor", file: office, expiresAt: Date.now() + 10000 }];
    h.requests[0].onsuccess(); h.transaction.oncomplete(); await checked;
    assert.equal(h.inserted.length, extra ? 0 : 1); assert.deepEqual(h.deleted, []);
  }
});
test("isolated consume commits one matching files payload; expiry is strict and mismatches survive", async () => {
  for (const receiverId of isolated) for (const offset of [0, 1]) for (const mismatch of [false, true]) {
    const now = 1000000, h = transactionHarness();
    const RealDate = Date;
    // Load deterministic time without mutating the host test clock.
    const core = load(corePath, { Date: class extends RealDate { static now() { return now; } },
      indexedDB: { open: () => { queueMicrotask(() => h.open.onsuccess()); return h.open; } } });
    const promise = core.consumePersistentFiles({ id: "id", nonce: mismatch ? "wrong" : "nonce" }, receiverId, core.PERSISTENT_RECEIVERS[receiverId]);
    await tick(); h.requests[0].result = { id: "id", nonce: "nonce", receiverId, entryPath: core.PERSISTENT_RECEIVERS[receiverId], schema: 1,
      files: [file], createdAt: now - core.HANDOFF_TTL_MS - offset, expiresAt: now - offset };
    h.requests[0].onsuccess(); h.transaction.oncomplete();
    assert.equal((await promise)?.[0], mismatch || offset ? undefined : file);
    assert.deepEqual(h.deleted, mismatch ? [] : ["id"]);
  }
});
test("version 3 adds expiry index in-place while keeping Office records store", () => {
  let requestedVersion = 0, created = 0;
  const store = { indexNames: { contains: () => false }, createIndex: (name: string, path: string) => { assert.equal(name, "expiresAt"); assert.equal(path, "expiresAt"); created++; } };
  const open: any = { result: { objectStoreNames: { contains: (name: string) => name === "records" },
    createObjectStore: () => assert.fail("must preserve existing records") }, transaction: { objectStore: () => store } };
  const core = load(corePath, { indexedDB: { open: (name: string, version: number) => { assert.equal(name, "worklazy-office-handoff"); requestedVersion = version; return open; } } });
  void core.purgeExpired(); open.onupgradeneeded(); assert.equal(requestedVersion, 3); assert.equal(created, 1);
});
test("Office token reads report blocked session storage as unavailable", async () => {
  const h = tokenHarness(); h.sessionStorage.getItem = () => { throw new Error("denied"); };
  await assert.rejects(h.module.takePendingOfficeFile(), { code: "unavailable" });
});
test("legacy single-file consume cannot delete an isolated multi-file case", async () => {
  const core = load(corePath, { indexedDB: { open: () => assert.fail("legacy Office API must refuse other receivers") } });
  assert.equal(await core.consumePersistentHandoff({ id: "id", nonce: "nonce" }, "document-redactor", "/tools/document-redactor"), undefined);
});
test("generic tab token snapshots destination and rolls back a sessionStorage failure", async () => {
  for (const fail of [false, true]) {
    let key: string | undefined;
    const h = transactionHarness({ sessionStorage: { setItem: (next: string, value: string) => {
      key = next; assert.deepEqual(Object.keys(JSON.parse(value)).sort(), ["id", "nonce"]);
      if (fail) throw new Error("quota");
    } } });
    const input = { receiverId: "document-redactor", entryPath: "/tools/document-redactor", files: [file] };
    const promise = h.core.stagePendingPersistentHandoff(input);
    const checked = fail ? assert.rejects(promise, { code: "unavailable" }) : promise;
    input.receiverId = "xls-preserve";
    await tick(); h.requests[0].result = []; h.requests[0].onsuccess(); h.transaction.oncomplete();
    await tick();
    if (fail) { h.requests[1].result = h.inserted[0]; h.requests[1].onsuccess(); h.transaction.oncomplete(); }
    await checked;
    assert.equal(key, "worklazy-handoff-token:document-redactor");
    assert.deepEqual(h.deleted, fail ? [h.inserted[0].id] : []);
  }
});


test("P3 matching corrupt payloads delete in the consume transaction without returning files", async () => {
  const oversized = new File([], "large.pdf"); Object.defineProperty(oversized, "size", { value: 500 * 1024 * 1024 + 1 });
  for (const receiverId of ["office-editor", ...isolated]) {
    const invalid = receiverId === "office-editor" ? [{ file: undefined }, { file: {} }] : [{ files: [] }, { files: [{}] }, { files: Array(21).fill(file) }, { files: [oversized] }];
    for (const payload of invalid) for (const mismatch of [false, true]) {
      const h = transactionHarness();
      const promise = h.core.consumePersistentFiles({ id: "id", nonce: mismatch ? "wrong" : "nonce" }, receiverId, h.core.PERSISTENT_RECEIVERS[receiverId]);
      let settled = false; void promise.then(() => { settled = true; }); await tick();
      const now = Date.now(); h.requests[0].result = { id: "id", nonce: "nonce", receiverId, entryPath: h.core.PERSISTENT_RECEIVERS[receiverId], schema: 1,
        createdAt: now, expiresAt: now + h.core.HANDOFF_TTL_MS, ...payload };
      h.requests[0].onsuccess(); await tick();
      assert.deepEqual(h.deleted, mismatch ? [] : ["id"]); assert.equal(settled, false);
      h.transaction.oncomplete(); assert.equal(await promise, undefined);
    }
  }
});

test("P3 pending cancellation removes only the matching receiver record after commit", async () => {
  for (const mismatch of [undefined, "nonce", "receiver"] as const) {
    const values = new Map([["worklazy-handoff-token:document-redactor", JSON.stringify({ id: "id", nonce: "nonce" })],
      ["worklazy-handoff-token:xls-preserve", "other-token"]]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, removeItem: (key: string) => values.delete(key) };
    const h = transactionHarness({ sessionStorage: storage });
    const promise = h.core.cancelPendingPersistentHandoff("document-redactor"); await tick();
    h.requests[0].result = { id: "id", nonce: mismatch === "nonce" ? "wrong" : "nonce", receiverId: mismatch === "receiver" ? "xls-preserve" : "document-redactor" };
    h.requests[0].onsuccess();
    assert.deepEqual(h.deleted, mismatch ? [] : ["id"]); assert.equal(values.size, 2);
    h.transaction.oncomplete(); await promise;
    assert.equal(values.has("worklazy-handoff-token:document-redactor"), false);
    assert.equal(values.get("worklazy-handoff-token:xls-preserve"), "other-token");
  }
});
test("P3 aborted pending cancellation preserves the old token; malformed/missing tokens never open DB", async () => {
  const raw = JSON.stringify({ id: "id", nonce: "nonce" }); let removed = false;
  const h = transactionHarness({ sessionStorage: { getItem: () => raw, removeItem: () => { removed = true; } } });
  const promise = h.core.cancelPendingPersistentHandoff("document-redactor");
  const rejected = assert.rejects(promise, { code: "unavailable" }); await tick();
  h.requests[0].result = { id: "id", nonce: "nonce", receiverId: "document-redactor" }; h.requests[0].onsuccess(); h.transaction.onabort();
  await rejected; assert.equal(removed, false);
  for (const value of [null, "{", "null", '{"id":1}']) {
    let cleared = false;
    const core = load(corePath, { indexedDB: { open: () => assert.fail("no identifiable old record") },
      sessionStorage: { getItem: () => value, removeItem: () => { cleared = true; } } });
    await core.cancelPendingPersistentHandoff("document-redactor"); assert.equal(cleared, value !== null);
  }
});

const corruptExpiries = [undefined, null, "9999999999999", "invalid", NaN, Infinity, -Infinity, {}, []];
test("P3b purge scans missing/non-numeric/non-finite expiry keys and preserves the strict boundary", async () => {
  const now = 1000000;
  const h = transactionHarness({ Date: class extends Date { static now() { return now; } } });
  const pending = h.core.purgeExpired(); await tick();
  const values = [...corruptExpiries, now - 1, now, now + 1];
  const removed: number[] = [];
  for (const [index, expiresAt] of values.entries()) {
    h.requests[0].result = { value: { id: index, ...(expiresAt === undefined ? {} : { expiresAt }) },
      delete: () => removed.push(index), continue: () => {} };
    h.requests[0].onsuccess();
  }
  h.requests[0].result = null; h.requests[0].onsuccess();
  let settled = false; void pending.then(() => { settled = true; }); await tick(); assert.equal(settled, false);
  h.transaction.oncomplete(); await pending;
  assert.deepEqual(removed, values.slice(0, -2).map((_, index) => index));
});
test("P3b stage retires corrupt expiries before quota accounting and preserves live records", async () => {
  const now = 1000000;
  const h = transactionHarness({ Date: class extends Date { static now() { return now; } } });
  const pending = h.core.stagePersistentHandoff(file); await tick();
  const records = corruptExpiries.map((expiresAt, id) => ({ id, expiresAt }));
  h.requests[0].result = [...records, { id: "boundary", receiverId: "office-editor", file, expiresAt: now },
    { id: "live", receiverId: "office-editor", file, expiresAt: now + 1 }];
  h.requests[0].onsuccess(); h.transaction.oncomplete(); await pending;
  assert.deepEqual(h.deleted, records.map(record => record.id)); assert.equal(h.inserted.length, 1);
});


function replacementHarness(storageFailure = false) {
  const key = "worklazy-handoff-token:document-to-pdf";
  const old = { id: "owned", nonce: "old-nonce", receiverId: "document-to-pdf", entryPath: "/tools/pdf-converter/document-to-pdf",
    files: [file], schema: 1, createdAt: Date.now(), expiresAt: Date.now() + 900000 };
  const raw = JSON.stringify({ id: old.id, nonce: old.nonce });
  const values = new Map([[key, raw], ["worklazy-handoff-token:document-redactor", "unrelated-token"]]);
  const h = transactionHarness({ sessionStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { if (storageFailure) throw Error("denied"); values.set(key, value); },
    removeItem: (key: string) => values.delete(key),
  } });
  const input = { receiverId: old.receiverId, entryPath: old.entryPath, files: [new File(["new"], "new.docx")] };
  return { ...h, key, old, raw, values, input };
}
test("P3E atomic replacement credits the owned slot at 20 records and waits for commit", async () => {
  const h = replacementHarness();
  const promise = h.core.replacePendingPersistentHandoff(h.input);
  let settled = false; void promise.then(() => { settled = true; }); await tick();
  h.requests[0].result = [h.old, ...Array.from({ length: 19 }, (_, i) => ({ ...h.old, id: `other-${i}`, nonce: `other-${i}` }))];
  h.requests[0].onsuccess();
  assert.equal(h.inserted.length, 1); assert.deepEqual(h.deleted, [h.old.id]);
  assert.equal(h.values.get(h.key), h.raw);
  h.added[0].onsuccess(); await tick(); assert.equal(settled, false);
  assert.deepEqual(JSON.parse(h.values.get(h.key)!), { id: h.inserted[0].id, nonce: h.inserted[0].nonce });
  h.transaction.oncomplete(); await promise;
  assert.equal(h.values.get("worklazy-handoff-token:document-redactor"), "unrelated-token");
});
test("P3E byte cap credits only the owned payload and rejects over-cap without changing token", async () => {
  for (const extra of [0, 1]) {
    const h = replacementHarness();
    Object.defineProperty(h.input.files[0], "size", { value: h.core.HANDOFF_RECORD_BYTES });
    const other = new File([], "other.docx"); Object.defineProperty(other, "size", { value: h.core.HANDOFF_TOTAL_BYTES - h.core.HANDOFF_RECORD_BYTES + extra });
    const promise = h.core.replacePendingPersistentHandoff(h.input);
    const checked = extra ? assert.rejects(promise, { code: "full" }) : promise;
    await tick(); h.requests[0].result = [h.old, { ...h.old, id: "other", receiverId: "office-editor", file: other }];
    h.requests[0].onsuccess();
    if (!extra) h.added[0].onsuccess();
    h.transaction.oncomplete(); await checked;
    assert.deepEqual(h.deleted, extra ? [] : [h.old.id]);
    assert.equal(h.inserted.length, extra ? 0 : 1);
    if (extra) assert.equal(h.values.get(h.key), h.raw);
  }
});
test("P3E replacement abort restores old token after publish; denied session write aborts DB", async () => {
  for (const storageFailure of [false, true]) {
    const h = replacementHarness(storageFailure);
    const rejected = assert.rejects(h.core.replacePendingPersistentHandoff(h.input), { code: "unavailable" });
    await tick(); h.requests[0].result = [h.old]; h.requests[0].onsuccess();
    h.added[0].onsuccess();
    if (!storageFailure) h.transaction.onabort();
    await rejected; assert.equal(h.values.get(h.key), h.raw);
  }
});
test("P3E mismatched ownership never earns a quota slot or deletes another record", async () => {
  for (const patch of [{ nonce: "wrong" }, { receiverId: "xls-preserve" }, { entryPath: "/wrong" }, { id: "other" }]) {
    const h = replacementHarness();
    const rejected = assert.rejects(h.core.replacePendingPersistentHandoff(h.input), { code: "full" });
    await tick(); h.requests[0].result = [{ ...h.old, ...patch }, ...Array.from({ length: 19 }, (_, i) => ({ ...h.old, id: `other-${i}` }))];
    h.requests[0].onsuccess(); h.transaction.oncomplete(); await rejected;
    assert.deepEqual(h.deleted, []); assert.equal(h.inserted.length, 0); assert.equal(h.values.get(h.key), h.raw);
  }
});
test("P3E transaction failure before publish preserves token; changed token aborts instead of overwriting", async () => {
  for (const changed of [false, true]) {
    const h = replacementHarness();
    const rejected = assert.rejects(h.core.replacePendingPersistentHandoff(h.input), { code: "unavailable" });
    await tick(); h.requests[0].result = [h.old]; h.requests[0].onsuccess();
    if (changed) { h.values.set(h.key, "newer-token"); h.added[0].onsuccess(); }
    else h.transaction.onabort();
    await rejected; assert.equal(h.values.get(h.key), changed ? "newer-token" : h.raw);
  }
});
