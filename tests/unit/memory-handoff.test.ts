import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import * as handoff from "../../src/app/memoryHandoff.ts";
import { isAutoReloadHeld } from "../../src/app/chunkRecovery.ts";
import { acceptsFile, fileAccepts, type HandoffReceiverDefinition } from "../../src/app/fileAccepts.ts";
import { clearUnsavedWork, hasUnsavedWork } from "../../src/app/toolState.ts";
import { claimHandoff, stageHandoff, deliverHandoff, closeDelivery, retainDelivery, cancelStagedHandoff,
  clearRecovery, getRecovery, transferToRecovery, deferErrorNavigation, purgeExpiredHandoffs, reconcileHandoffLocation,
  selectHandoffFiles, validateHandoff, MAX_HANDOFF_TEXT_BYTES, type HandoffInput, type DeliveryResult } from "../../src/app/memoryHandoff.ts";
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

test("recovery: approved location exit drops deferred assign and releases the result", () => {
  const original = { pathname: window.location.pathname, search: window.location.search };
  try {
    for (const target of [{ pathname: "/ko/", search: "" }, { pathname: "/ko/tools/excel-cleaner", search: "" }, { pathname: original.pathname, search: "?changed=1" }]) {
      window.location.pathname = original.pathname; window.location.search = original.search;
      stageHandoff(input()); transferToRecovery();
      let assigns = 0;
      assert.equal(deferErrorNavigation(() => assigns++), true);
      assert.equal(isAutoReloadHeld(), true);
      window.location.pathname = target.pathname; window.location.search = target.search;
      reconcileHandoffLocation();
      assert.equal(assigns, 0, `approved exit to ${target.pathname}${target.search} must keep its destination`);
      assert.equal(getRecovery(), null); assert.equal(hasUnsavedWork(), false); assert.equal(isAutoReloadHeld(), false);
      clearRecovery(); assert.equal(assigns, 0, "the stale deferred action must also be forgotten");
    }
  } finally {
    clearRecovery(false); window.location.pathname = original.pathname; window.location.search = original.search;
  }
});
test("recovery: explicit download or discard executes deferred assign exactly once", () => {
  for (const action of ["download", "discard"]) {
    stageHandoff(input()); transferToRecovery();
    let assigns = 0;
    assert.equal(deferErrorNavigation(() => {
      assigns++;
      assert.equal(isAutoReloadHeld(), false, `${action} releases the hold before assign`);
      assert.equal(getRecovery(), null);
    }), true);
    clearRecovery(); clearRecovery();
    assert.equal(assigns, 1, action); assert.equal(hasUnsavedWork(), false);
  }
});

// Run the real hook with React effects and stale Router location.state. Only
// useLocation is stubbed; the browser probe additionally uses BrowserRouter.
async function receiverFixture(run: (fixture: {
  mount: (token: { id: string; nonce: string }, receiverId?: "pdf-organize" | "pdf-finish") => Promise<ReturnType<typeof import("../../src/app/useHandoffReceiver").useHandoffReceiver>>;
  unmount: () => Promise<void>; calls: () => number;
  current: () => ReturnType<typeof import("../../src/app/useHandoffReceiver").useHandoffReceiver>;
}) => Promise<void>, receive: (entry: handoff.HandoffEntry) => DeliveryResult = entry => accepted(entry.files), textReceive?: (text: string, context: handoff.IntakeContext) => boolean | Promise<boolean>) {
  const dom = new JSDOM("<div id='root'></div>", { url: "https://example.test/ko/tools/pdf-editor" });
  const saved = new Map(["window", "document", "IS_REACT_ACT_ENVIRONMENT"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, "window", { configurable: true, value: dom.window });
  Object.defineProperty(globalThis, "document", { configurable: true, value: dom.window.document });
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  let location: { pathname: string; search: string; key: string; state: unknown };
  const source = readFileSync(new URL("../../src/app/useHandoffReceiver.ts", import.meta.url), "utf8");
  const context = vm.createContext({ exports: {}, window: dom.window, require: (id: string) => {
    if (id === "react") return React;
    if (id === "react-router-dom") return { useLocation: () => location };
    if (id === "./memoryHandoff") return handoff;
    if (id === "./persistentHandoff") return {}; // Memory tests never invoke the isolated hook.
    if (id === "../i18n/languages") return { stripLanguagePrefix: (path: string) => path.replace(/^\/(ko|en)(?=\/|$)/, "") };
    throw new Error(`unexpected hook dependency ${id}`);
  } });
  vm.runInContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, context);
  let root: ReturnType<typeof createRoot> | undefined;
  let state: ReturnType<typeof import("../../src/app/useHandoffReceiver").useHandoffReceiver>;
  let calls = 0;
  const unmount = async () => { if (root) { const current = root; root = undefined; await React.act(async () => current.unmount()); await wait(); } };
  try {
    await run({ calls: () => calls, current: () => state!, unmount, mount: async (token, receiverId = "pdf-organize") => {
      const pathname = receiverId === "pdf-organize" ? "/ko/tools/pdf-editor" : "/ko/tools/pdf-editor/watermark";
      dom.window.history.replaceState({ key: "remount-key", idx: 2, usr: { wlHandoff: token, other: "preserved" } }, "", pathname);
      location = { pathname, search: "", key: "remount-key", state: { wlHandoff: token } };
      function Probe() {
        state = textReceive
          ? context.exports.useTextHandoffReceiver(receiverId, { kind: "selection", receiveText: (text: string, context: handoff.IntakeContext) => { calls++; return textReceive(text, context); } })
          : context.exports.useHandoffReceiver(receiverId, { kind: "selection", receive: (entry: handoff.HandoffEntry) => { calls++; return receive(entry); } });
        return null;
      }
      root = createRoot(dom.window.document.getElementById("root")!);
      await React.act(async () => { root!.render(React.createElement(React.StrictMode, null, React.createElement(Probe))); await wait(); });
      assert.equal(dom.window.history.state.usr.wlHandoff, undefined);
      assert.equal(dom.window.history.state.usr.other, "preserved");
      assert.equal(dom.window.history.state.key, "remount-key");
      return state!;
    } });
  } finally {
    await unmount(); dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

test("receiver hook: accepted and dismissed partial remount silently without redelivery", async () => {
  const bad = new File(["bad"], "rejected.pdf");
  for (const receiverId of ["pdf-organize", "pdf-finish"] as const) {
    for (const partial of [false, true]) {
      await receiverFixture(async fixture => {
        const entryPath = receiverId === "pdf-organize" ? "/tools/pdf-editor" : "/tools/pdf-editor/watermark";
        const token = stageHandoff(input({ receiverId, entryPath, files: partial ? [file, bad] : [file] }));
        const first = await fixture.mount(token, receiverId);
        assert.equal(first.result?.status, partial ? "partial" : "accepted");
        assert.equal(fixture.calls(), 1, "StrictMode must apply input once");
        if (partial) {
          assert.equal(first.recoveryFiles.length, 1);
          assert.equal(first.recoveryFiles[0], bad);
          await React.act(async () => first.dismiss());
        }
        await fixture.unmount();
        const remount = await fixture.mount(token, receiverId);
        assert.equal(remount.notReceived, false, `${receiverId} consumed token must be silent`);
        assert.equal(remount.result, undefined);
        assert.equal(remount.recoveryFiles.length, 0);
        assert.equal(fixture.calls(), 1, "closed accepted/partial token must not rerun adapter");
        assert.equal(isAutoReloadHeld(), false);
      }, entry => ({ status: partial ? "partial" : "accepted", accepted: [entry.files[0]], rejected: partial ? [{ file: bad, reasonCode: "bad" }] : [] }));
    }
  }
});

test("receiver hook: absent, expired, wrong nonce and another tab tokens still show notReceived", async () => {
  for (const reason of ["absent", "expired", "nonce", "another-tab"]) {
    await receiverFixture(async fixture => {
      const staged = reason === "expired" || reason === "nonce" ? stageHandoff(input({ origin: "user-input" }), reason === "expired" ? 100 : Date.now()) : undefined;
      const token = staged ? { ...staged, ...(reason === "nonce" ? { nonce: "wrong-nonce" } : {}) } : { id: crypto.randomUUID(), nonce: crypto.randomUUID() };
      const state = await fixture.mount(token);
      assert.equal(state.notReceived, true, reason);
      assert.equal(state.result, undefined);
      assert.equal(fixture.calls(), 0);
      if (staged) await React.act(async () => cancelStagedHandoff(staged));
    });
  }
});

for (const receiverId of ["pdf-organize", "pdf-finish"] as const) {
  test(`receiver hook: dismiss clears notReceived for ${receiverId} without consuming the missing token`, async () => {
    await receiverFixture(async fixture => {
      const token = { id: crypto.randomUUID(), nonce: crypto.randomUUID() };
      const state = await fixture.mount(token, receiverId);
      assert.equal(state.notReceived, true);
      await React.act(async () => state.dismiss());
      assert.equal(fixture.current().notReceived, false);
      assert.equal(fixture.current().result, undefined);
      assert.equal(fixture.current().recoveryFiles.length, 0);
      await React.act(async () => fixture.current().dismiss());
      assert.equal(fixture.current().notReceived, false, "repeated dismissal stays cleared");
      assert.equal(fixture.calls(), 0, "dismiss must not deliver a missing token");
      await fixture.unmount();
      const remount = await fixture.mount(token, receiverId);
      assert.equal(remount.notReceived, true, "dismiss must not remember an unreceived token as consumed");
      assert.equal(fixture.calls(), 0);
    });
  });
}

test("consumed token identity includes nonce, receiver, route and location key; failures are not remembered", async () => {
  const path = "/ko/tools/pdf-editor";
  for (const status of ["accepted", "partial", "rejected", "cancelled"] as const) {
    const extra = new File([], "extra.pdf");
    const token = stageHandoff(input({ files: [file, extra], origin: "user-input" }));
    const entry = claimHandoff(token, "pdf-organize", "/tools/pdf-editor")!;
    const record = deliverHandoff(entry, path, "identity-key", { kind: "selection", receive: () => ({ status, accepted: status === "accepted" ? [file, extra] : status === "partial" ? [file] : [], rejected: [] }) });
    await record.promise; closeDelivery(record);
    const wasConsumed = (candidate = token, receiverId: "pdf-organize" | "pdf-finish" = "pdf-organize", entryPath = "/tools/pdf-editor", locationKey = "identity-key", actualPath = path) => handoff.wasHandoffConsumed(candidate, receiverId, entryPath, locationKey, actualPath);
    assert.equal(wasConsumed(), status === "accepted" || status === "partial");
    assert.equal(wasConsumed({ ...token, nonce: "wrong" }), false);
    assert.equal(wasConsumed(token, "pdf-finish"), false);
    assert.equal(wasConsumed(token, "pdf-organize", "/tools/pdf-editor/merge"), false);
    assert.equal(wasConsumed(token, "pdf-organize", undefined, "another-key"), false);
    assert.equal(wasConsumed(token, "pdf-organize", undefined, undefined, `${path}?changed=1`), false);
    assert.deepEqual(entry.files, []); assert.deepEqual(record.files, []);
  }
});

test("consumed token memory evicts old identities at its 256 entry bound", async () => {
  const tokens = [];
  for (let index = 0; index < 257; index++) {
    const token = stageHandoff(input({ origin: "user-input" })); tokens.push(token);
    const entry = claimHandoff(token, "pdf-organize", "/tools/pdf-editor")!;
    await deliverHandoff(entry, "/ko/tools/pdf-editor", "bounded", { kind: "selection", receive: entry => accepted(entry.files) }).promise;
  }
  const seen = (index: number) => handoff.wasHandoffConsumed(tokens[index], "pdf-organize", "/tools/pdf-editor", "bounded", "/ko/tools/pdf-editor");
  assert.equal(seen(0), false);
  assert.equal(seen(1), true);
  assert.equal(seen(256), true);
});

// Contract fixture only: no production text receiver or route is installed.
async function withTextReceiver(run: () => void | Promise<void>) {
  const definition: HandoffReceiverDefinition = fileAccepts["pdf-organize"];
  try { definition.payload = "text"; await run(); } finally { delete definition.payload; }
}
const textInput = (text = "synthetic private document 🧪", overrides: Partial<HandoffInput> = {}) => input({ files: [], text, ...overrides });
const textAdapter = (success = true): handoff.HandoffAdapter => ({ payload: "text", kind: "selection", receive: () => ({ status: success ? "accepted" : "rejected", textAccepted: success, accepted: [], rejected: [] }) });

test("U5a before/after cardinality, vocabulary and order; mailmerge keeps its own roles", () => {
  for (const roles of [["before", "after"], ["after", "before"]] as const) {
    const value = input({ files: [file, new File([], "after.pdf")], roles: [...roles] });
    assert.equal(validateHandoff(value), null);
    const token = stageHandoff(value); value.roles!.reverse();
    const entry = claimHandoff(token, "pdf-organize", "/tools/pdf-editor")!;
    assert.deepEqual(entry.roles, [...roles]);
    closeDelivery(deliverHandoff(entry, "/ko/tools/pdf-editor", "roles", { kind: "selection", receive: entry => accepted(entry.files) }));
  }
  for (const roles of [["before"], ["before", "before"], ["after", "after"], ["before", "data"], ["before", "after", "after"], ["left", "right"]]) {
    assert.equal(validateHandoff(input({ files: [file, file], roles: roles as HandoffInput["roles"] })), "roles");
  }
  assert.equal(validateHandoff(input({ receiverId: "document-generator", entryPath: "/tools/document-generator", files: [file, file], roles: ["before", "after"] })), "roles");
});

test("U5a text is opt-in, exclusive and bounded by UTF-8 bytes including emoji", async () => {
  assert.equal(validateHandoff(textInput()), "destination");
  await withTextReceiver(() => {
    assert.equal(validateHandoff(textInput()), null);
    for (const value of [textInput(""), textInput(null as unknown as string), textInput("text", { files: [file] }), textInput("text", { roles: [] }), textInput("text", { tab: "edit" })]) assert.equal(validateHandoff(value), "text");
    for (const [unit, bytes] of [["x", 1], ["가", 3], ["🧪", 4]] as const) {
      const atLimit = unit.repeat(Math.floor(MAX_HANDOFF_TEXT_BYTES / bytes)) + "x".repeat(MAX_HANDOFF_TEXT_BYTES % bytes);
      assert.equal(new TextEncoder().encode(atLimit).byteLength, MAX_HANDOFF_TEXT_BYTES);
      assert.equal(validateHandoff(textInput(atLimit)), null);
      assert.equal(validateHandoff(textInput(atLimit + "x")), "text-size");
    }
  });
});

test("U5a text token has identity only, nonce/path bind claim and 60-second slot expiry", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  try { await withTextReceiver(() => {
    const secret = "synthetic-private-text-never-in-token";
    const token = stageHandoff(textInput(secret));
    assert.deepEqual(Object.keys(token).sort(), ["id", "nonce"]);
    assert.ok(!JSON.stringify(token).includes(secret));
    assert.equal(claimHandoff({ ...token, nonce: "wrong" }, "pdf-organize", "/tools/pdf-editor"), null);
    assert.equal(claimHandoff(token, "pdf-organize", "/tools/pdf-editor/merge"), null);
    assert.equal(isAutoReloadHeld(), true);
    context.mock.timers.tick(60_000);
    assert.equal(claimHandoff(token, "pdf-organize", "/tools/pdf-editor"), null);
    assert.equal(isAutoReloadHeld(), false);
    const replaced = stageHandoff(textInput(secret)); const current = stageHandoff(textInput("replacement"));
    assert.equal(claimHandoff(replaced, "pdf-organize", "/tools/pdf-editor"), null);
    cancelStagedHandoff(current); assert.equal(isAutoReloadHeld(), false);
  }); } finally { context.mock.timers.reset(); }
});

test("U5a text delivery requires explicit adapter acknowledgement, clears accepted refs", async () => {
  await withTextReceiver(async () => {
    for (const mode of ["accepted", "rejected", "file-adapter", "false-ack"] as const) {
      const token = stageHandoff(textInput()); const entry = claimHandoff(token, "pdf-organize", "/tools/pdf-editor")!;
      const adapter = mode === "file-adapter" ? { kind: "selection" as const, receive: () => accepted([]) } : mode === "false-ack" ? { payload: "text" as const, kind: "selection" as const, receive: () => ({ ...accepted([]), textAccepted: false }) } : textAdapter(mode === "accepted");
      const record = deliverHandoff(entry, "/ko/tools/pdf-editor", mode, adapter);
      const result = await record.promise;
      assert.equal(result.status, mode === "accepted" ? "accepted" : "rejected");
      assert.equal(result.textAccepted, mode === "accepted");
      assert.equal(entry.text, undefined);
      assert.equal(record.text, mode === "accepted" ? undefined : textInput().text);
      assert.ok(!JSON.stringify(result).includes(textInput().text!));
      closeDelivery(record); assert.equal(record.text, undefined); assert.equal(isAutoReloadHeld(), false);
    }
  });
});

test("U5a generated text recovery uses downloadable bytes, holds and deferred navigation", async () => {
  await withTextReceiver(async () => {
    for (const claimed of [false, true]) {
      const secret = "private recovery 🧪\nline two";
      const token = stageHandoff(textInput(secret));
      let record: handoff.Delivery | undefined;
      if (claimed) { const entry = claimHandoff(token, "pdf-organize", "/tools/pdf-editor")!; record = deliverHandoff(entry, "/ko/tools/pdf-editor", "recovery-text", textAdapter(false)); await record.promise; }
      transferToRecovery();
      assert.equal(getRecovery()?.files.length, 1);
      assert.equal(getRecovery()?.files[0].name, "handoff.txt");
      assert.equal(await getRecovery()!.files[0].text(), secret);
      if (record) assert.equal(record.text, undefined);
      let navigation = 0; assert.equal(deferErrorNavigation(() => navigation++), true);
      purgeExpiredHandoffs(Date.now() + 90_000); assert.equal(getRecovery()?.files.length, 1);
      assert.equal(isAutoReloadHeld(), true); clearRecovery(); clearRecovery();
      assert.equal(navigation, 1); assert.equal(isAutoReloadHeld(), false); assert.equal(hasUnsavedWork(), false);
    }
  });
});

test("U5a text expiry closes user-input cache and moves generated cache to explicit recovery", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  try { await withTextReceiver(async () => {
    for (const origin of ["user-input", "generated"] as const) {
      const token = stageHandoff(textInput("expiry-private-text", { origin }));
      const entry = claimHandoff(token, "pdf-organize", "/tools/pdf-editor")!;
      const record = deliverHandoff(entry, "/ko/tools/pdf-editor", "expiry", textAdapter(false)); await record.promise;
      context.mock.timers.tick(60_000);
      assert.equal(record.closed, true); assert.equal(record.text, undefined); assert.equal(entry.text, undefined);
      assert.equal(getRecovery()?.files.length ?? 0, origin === "generated" ? 1 : 0);
      clearRecovery(); assert.equal(isAutoReloadHeld(), false);
    }
  }); } finally { clearRecovery(false); context.mock.timers.reset(); }
});

test("U5a real text hook applies once in StrictMode, keeps history token-only and remounts silently", async () => {
  await withTextReceiver(async () => {
    const secret = "private hook text 🧪"; let received: string | undefined;
    await receiverFixture(async fixture => {
      const token = stageHandoff(textInput(secret));
      const first = await fixture.mount(token);
      assert.equal(received, secret); assert.equal(fixture.calls(), 1); assert.equal(first.result?.textAccepted, true);
      assert.equal(first.recoveryTexts.length, 0);
      assert.ok(!JSON.stringify(window.history.state).includes(secret)); assert.ok(!window.location.href.includes(secret));
      await fixture.unmount(); const remount = await fixture.mount(token);
      assert.equal(remount.notReceived, false); assert.equal(fixture.calls(), 1);
    }, undefined, text => { received = text; return true; });
    assert.equal(isAutoReloadHeld(), false);
  });
});

test("U5a rejected text hook retains raw text locally until dismiss; route cleanup releases it", async () => {
  await withTextReceiver(async () => {
    await receiverFixture(async fixture => {
      const token = stageHandoff(textInput("rejected-private", { origin: "user-input" }));
      const state = await fixture.mount(token); assert.equal(state.result?.status, "rejected");
      assert.deepEqual([...state.recoveryTexts], ["rejected-private"]);
      assert.ok(!JSON.stringify(window.history.state).includes("rejected-private"));
      await React.act(async () => state.dismiss()); assert.equal(fixture.current().recoveryTexts.length, 0);
      await fixture.unmount(); assert.equal(isAutoReloadHeld(), false);
    }, undefined, () => false);
  });
});

test("U5a all twelve file receiver definitions remain file-only and their file paths/tabs validate", () => {
  assert.equal(Object.keys(fileAccepts).length, 12);
  for (const [id, definition] of Object.entries(fileAccepts)) {
    assert.equal((definition as HandoffReceiverDefinition).payload, undefined);
    const files = id === "document-generator" ? [new File([], "template.docx"), new File([], "data.csv")] : [new File([], `input.${definition.extensions[0]}`)];
    const value = input({ receiverId: id as HandoffInput["receiverId"], entryPath: definition.paths[0], files, roles: id === "document-generator" ? ["template", "data"] : undefined, tab: id === "image-edit" ? "edit" : id === "image-batch" ? "batch" : undefined });
    assert.equal(validateHandoff(value), null, id);
    assert.equal(validateHandoff({ ...value, text: "private" }), "destination", id);
  }
});

test("U5a text inspection timeout, late acknowledgement and route/error cleanup preserve ownership", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  try { await withTextReceiver(async () => {
    let finish!: (value: DeliveryResult) => void; let resets = 0;
    const token = stageHandoff(textInput("timeout-private"));
    const entry = claimHandoff(token, "pdf-organize", "/tools/pdf-editor")!;
    const record = deliverHandoff(entry, "/ko/tools/pdf-editor", "timeout-text", { payload: "text", kind: "inspection", invalidate: () => resets++, receive: () => new Promise(resolve => { finish = resolve; }) });
    await Promise.resolve(); context.mock.timers.tick(30_000);
    const result = await record.promise;
    assert.equal(result.status, "rejected"); assert.equal(result.textReason, "timeout"); assert.equal(resets, 1);
    finish({ ...accepted([]), textAccepted: true }); await Promise.resolve();
    assert.equal(record.text, "timeout-private"); assert.equal(isAutoReloadHeld(), true);
    transferToRecovery("route-error", [record]); assert.equal(record.text, undefined); assert.equal(getRecovery()?.files.length, 1);
    clearRecovery(); assert.equal(isAutoReloadHeld(), false);
    // Pending generated input is moved by error cleanup; a real location exit cancels.
    for (const leaving of [false, true]) {
      const token = stageHandoff(textInput("unmount-private"));
      const value = claimHandoff(token, "pdf-organize", "/tools/pdf-editor")!;
      const pending = deliverHandoff(value, "/ko/tools/pdf-editor", "pending-text", { payload: "text", kind: "inspection", invalidate: () => {}, receive: () => new Promise(() => {}) });
      await Promise.resolve(); const detach = retainDelivery(pending);
      window.location.pathname = leaving ? "/ko/" : "/ko/tools/pdf-editor";
      detach(); context.mock.timers.tick(0); await pending.promise;
      assert.equal(pending.closed, true); assert.equal(pending.text, undefined); assert.equal(value.text, undefined);
      assert.equal(getRecovery()?.files.length ?? 0, leaving ? 0 : 1);
      clearRecovery(false); window.location.pathname = "/ko/tools/pdf-editor";
    }
  }); } finally { window.location.pathname = "/ko/tools/pdf-editor"; clearRecovery(false); context.mock.timers.reset(); }
});

test("U5a bfcache age purge preserves claimed generated text through the same recovery path", async () => {
  await withTextReceiver(async () => {
    const token = stageHandoff(textInput("bfcache-private"));
    const entry = claimHandoff(token, "pdf-organize", "/tools/pdf-editor")!;
    const record = deliverHandoff(entry, "/ko/tools/pdf-editor", "bfcache-text", textAdapter(false)); await record.promise;
    purgeExpiredHandoffs(entry.expiresAt);
    assert.equal(record.closed, true); assert.equal(record.text, undefined); assert.equal(entry.text, undefined);
    assert.equal(await getRecovery()!.files[0].text(), "bfcache-private");
    assert.equal(isAutoReloadHeld(), true); clearRecovery(); assert.equal(isAutoReloadHeld(), false);
  });
});
