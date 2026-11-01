import assert from "node:assert/strict";
import test from "node:test";

import {
  clearUnsavedWork,
  getUnsavedWorkMessageKey,
  grantOneShotSafeTarget,
  hasUnsavedWork,
  isGuardedTarget,
  normalizeSafePath,
  restoreLastOneShotSafeTarget,
  revokeOneShotSafeTarget,
  setUnsavedWork,
  subscribeUnsavedWork,
} from "../../src/app/toolState.ts";
import { holdAutoReload, isAutoReloadHeld, recoverChunkError, release } from "../../src/app/chunkRecovery.ts";

interface ToolStateTestHooks {
  __clearToolStateForTests: () => void;
  __peekOneShotSafeTargetForTests: () => { toolId: string; path: string } | null;
}

function toolStateHooks(): ToolStateTestHooks {
  const hooks = (globalThis as unknown as { __wlToolStateTestHooks?: ToolStateTestHooks }).__wlToolStateTestHooks;
  if (!hooks) throw new Error("toolState test hooks are not installed (dev/test only)");
  return hooks;
}

function reset() {
  // chunkRecovery has no reset hook (N1); its hold test balances to zero.
  toolStateHooks().__clearToolStateForTests();
}

function listenerCounted() {
  let calls = 0;
  const off = subscribeUnsavedWork(() => {
    calls += 1;
  });
  return { calls: () => calls, off };
}

test("safePaths entries must be normalized absolute paths", () => {
  assert.equal(normalizeSafePath("/tools/pdf-editor/merge"), "/tools/pdf-editor/merge");
  assert.equal(normalizeSafePath("/tools/pdf-editor/merge/"), "/tools/pdf-editor/merge");
  assert.equal(normalizeSafePath("/tools/pdf-editor//watermark"), "/tools/pdf-editor/watermark");
  assert.equal(normalizeSafePath("tools/pdf-editor/merge"), null);
  assert.equal(normalizeSafePath("./merge"), null);
  assert.equal(normalizeSafePath("../tools/pdf-editor"), null);
  assert.equal(normalizeSafePath("/merge"), null);
  assert.equal(normalizeSafePath("/tools"), null);
  assert.equal(normalizeSafePath("/"), null);
  assert.equal(normalizeSafePath("/tools/pdf-editor/../finish"), null);
  assert.equal(normalizeSafePath("/tools/pdf-editor/finish?x=1"), null);
  assert.equal(normalizeSafePath("/tools/pdf-editor/finish#top"), null);
  assert.equal(normalizeSafePath(""), null);
});

test("registering a relative or root-guess safePaths entry is refused", () => {
  reset();
  assert.throws(() => setUnsavedWork("pdf-result", {
    hasWork: true,
    kind: "files",
    scopePath: "/tools/pdf-editor",
    safePaths: ["tools/pdf-editor/merge"],
  }));
  assert.throws(() => setUnsavedWork("pdf-result", {
    hasWork: true,
    kind: "files",
    scopePath: "/tools/pdf-editor",
    safePaths: ["/merge"],
  }));
  assert.equal(hasUnsavedWork(), false);
});

test("registered safePaths replace the scope-prefix rule (no OR)", () => {
  reset();
  setUnsavedWork("pdf-result", {
    hasWork: true,
    kind: "files",
    scopePath: "/tools/pdf-editor",
    safePaths: ["/tools/pdf-editor/finish"],
  });
  // Exact match is safe even though the scope prefix would also match.
  assert.equal(isGuardedTarget("/tools/pdf-editor/finish"), false);
  // Same-scope siblings are guarded: the prefix rule no longer applies.
  assert.equal(isGuardedTarget("/tools/pdf-editor/merge"), true);
  assert.equal(isGuardedTarget("/tools/pdf-editor"), true);
  // Trailing slashes normalize on both sides.
  assert.equal(isGuardedTarget("/tools/pdf-editor/finish/"), false);
  // Outside paths stay guarded.
  assert.equal(isGuardedTarget("/tools/image-studio"), true);
  assert.equal(isGuardedTarget("/"), true);
});

test("scope-only registrations keep the legacy behavior (7-tool regression)", () => {
  reset();
  const legacy: Array<[string, string]> = [
    ["conversion-batch", "/tools/conversion-batch"],
    ["document-compare", "/tools/document-compare"],
    ["document-to-pdf", "/tools/pdf-converter/document-to-pdf"],
    ["document-markdown", "/tools/document-markdown"],
    ["product-banner", "/tools/product-banner"],
    ["text-merger", "/tools/text-merger"],
  ];
  for (const [toolId, scopePath] of legacy) {
    setUnsavedWork(toolId, { hasWork: true, kind: "files", scopePath });
    assert.equal(isGuardedTarget(scopePath), false, `${toolId} own scope`);
    assert.equal(isGuardedTarget("/tools/pdf-editor/finish"), true, `${toolId} other tool`);
    clearUnsavedWork(toolId);
  }
  assert.equal(hasUnsavedWork(), false);
});

test("same-value comparison covers safePaths and messageKey (N5-1)", () => {
  reset();
  const counter = listenerCounted();
  setUnsavedWork("pdf-result", {
    hasWork: true,
    kind: "files",
    scopePath: "/tools/pdf-editor",
    safePaths: ["/tools/pdf-editor/finish"],
    messageKey: "pdf.messages.PdfEditorPage.unsavedResult",
  });
  assert.equal(counter.calls(), 1);
  // Same values with fresh array identities must not notify.
  setUnsavedWork("pdf-result", {
    hasWork: true,
    kind: "files",
    scopePath: "/tools/pdf-editor",
    safePaths: ["/tools/pdf-editor/finish"],
    messageKey: "pdf.messages.PdfEditorPage.unsavedResult",
  });
  assert.equal(counter.calls(), 1);
  // hasWork is the same but safePaths changed: this is a new registration.
  setUnsavedWork("pdf-result", {
    hasWork: true,
    kind: "files",
    scopePath: "/tools/pdf-editor",
    safePaths: ["/tools/pdf-editor/finish", "/tools/pdf-editor/watermark"],
    messageKey: "pdf.messages.PdfEditorPage.unsavedResult",
  });
  assert.equal(counter.calls(), 2);
  assert.equal(isGuardedTarget("/tools/pdf-editor/watermark"), false);
  // hasWork is the same but only the message changed.
  setUnsavedWork("pdf-result", {
    hasWork: true,
    kind: "files",
    scopePath: "/tools/pdf-editor",
    safePaths: ["/tools/pdf-editor/finish", "/tools/pdf-editor/watermark"],
    messageKey: "pdf.messages.PdfEditorPage.unsavedFinish",
  });
  assert.equal(counter.calls(), 3);
  assert.equal(getUnsavedWorkMessageKey(), "pdf.messages.PdfEditorPage.unsavedFinish");
  counter.off();
});

test("first hasWork registration wins the guard message", () => {
  reset();
  setUnsavedWork("pdf-organize", {
    hasWork: true,
    kind: "files",
    scopePath: "/tools/pdf-editor",
    messageKey: "pdf.messages.PdfEditorPage.unsavedOrganize",
  });
  setUnsavedWork("pdf-result", {
    hasWork: true,
    kind: "files",
    scopePath: "/tools/pdf-editor",
    messageKey: "pdf.messages.PdfEditorPage.unsavedResult",
  });
  assert.equal(getUnsavedWorkMessageKey(), "pdf.messages.PdfEditorPage.unsavedOrganize");
  clearUnsavedWork("pdf-organize");
  assert.equal(getUnsavedWorkMessageKey(), "pdf.messages.PdfEditorPage.unsavedResult");
  clearUnsavedWork("pdf-result");
  assert.equal(getUnsavedWorkMessageKey(), undefined);
});

test("one-shot allowance passes one evaluation of the exact path", () => {
  reset();
  setUnsavedWork("pdf-organize", {
    hasWork: true,
    kind: "files",
    scopePath: "/tools/pdf-editor",
    safePaths: [
      "/tools/pdf-editor",
      "/tools/pdf-editor/merge",
      "/tools/pdf-editor/split",
      "/tools/pdf-editor/delete",
      "/tools/pdf-editor/rotate",
    ],
  });
  setUnsavedWork("pdf-result", {
    hasWork: true,
    kind: "files",
    scopePath: "/tools/pdf-editor",
    safePaths: ["/tools/pdf-editor", "/tools/pdf-editor/watermark"],
  });
  grantOneShotSafeTarget("pdf-organize", "/tools/pdf-editor/watermark");
  assert.deepEqual(toolStateHooks().__peekOneShotSafeTargetForTests(), { toolId: "pdf-organize", path: "/tools/pdf-editor/watermark" });
  // pdf-result is safe via safePaths, pdf-organize via the one-shot grant.
  assert.equal(isGuardedTarget("/tools/pdf-editor/watermark"), false);
  // Consumed: the second evaluation of the same path is guarded again.
  assert.equal(isGuardedTarget("/tools/pdf-editor/watermark"), true);
  assert.equal(toolStateHooks().__peekOneShotSafeTargetForTests(), null);
});

test("one-shot grant expires on other paths and revocation", () => {
  reset();
  setUnsavedWork("pdf-organize", {
    hasWork: true,
    kind: "files",
    scopePath: "/tools/pdf-editor",
    safePaths: ["/tools/pdf-editor"],
  });
  grantOneShotSafeTarget("pdf-organize", "/tools/pdf-editor/watermark");
  assert.equal(isGuardedTarget("/tools/pdf-editor/stamp"), true);
  assert.equal(toolStateHooks().__peekOneShotSafeTargetForTests(), null);

  grantOneShotSafeTarget("pdf-organize", "/tools/pdf-editor/watermark");
  revokeOneShotSafeTarget("pdf-organize");
  assert.equal(toolStateHooks().__peekOneShotSafeTargetForTests(), null);
  assert.equal(isGuardedTarget("/tools/pdf-editor/watermark"), true);
});

test("a failed perform() restores the consumed one-shot grant", () => {
  reset();
  setUnsavedWork("pdf-organize", {
    hasWork: true,
    kind: "files",
    scopePath: "/tools/pdf-editor",
    safePaths: ["/tools/pdf-editor"],
  });
  grantOneShotSafeTarget("pdf-organize", "/tools/pdf-editor/watermark");
  assert.equal(isGuardedTarget("/tools/pdf-editor/watermark"), false);
  restoreLastOneShotSafeTarget();
  assert.equal(isGuardedTarget("/tools/pdf-editor/watermark"), false);
  assert.equal(isGuardedTarget("/tools/pdf-editor/watermark"), true);
});

test("D4-1 handoff order never leaves both registrations false", () => {
  reset();
  const anyWork: boolean[] = [];
  // Step 1-3: result held, finish not registered yet.
  setUnsavedWork("pdf-result", {
    hasWork: true,
    kind: "files",
    scopePath: "/tools/pdf-editor",
    safePaths: ["/tools/pdf-editor", "/tools/pdf-editor/watermark"],
  });
  setUnsavedWork("pdf-organize", {
    hasWork: true,
    kind: "files",
    scopePath: "/tools/pdf-editor",
    safePaths: ["/tools/pdf-editor"],
  });
  grantOneShotSafeTarget("pdf-organize", "/tools/pdf-editor/watermark");
  anyWork.push(hasUnsavedWork());
  // The prepared handoff target passes without a dialog (one-shot consumed).
  assert.equal(isGuardedTarget("/tools/pdf-editor/watermark"), false);
  anyWork.push(hasUnsavedWork());
  // Organize unmounts on the move; its hook cleanup clears its entry.
  clearUnsavedWork("pdf-organize");
  anyWork.push(hasUnsavedWork());
  // Step 5: finish registers true directly, before the ack.
  setUnsavedWork("pdf-finish", {
    hasWork: true,
    kind: "files",
    scopePath: "/tools/pdf-editor/finish",
    safePaths: ["/tools/pdf-editor/finish"],
  });
  anyWork.push(hasUnsavedWork());
  // Step 6: ack clears only the result registration.
  setUnsavedWork("pdf-result", {
    hasWork: false,
    kind: "files",
    scopePath: "/tools/pdf-editor",
    safePaths: ["/tools/pdf-editor", "/tools/pdf-editor/watermark"],
  });
  anyWork.push(hasUnsavedWork());
  assert.ok(anyWork.every(Boolean), "protection must hold at every step");
  assert.equal(hasUnsavedWork(), true);
  assert.equal(isGuardedTarget("/"), true);
  assert.equal(isGuardedTarget("/tools/pdf-editor/finish"), false);
});

test("chunk hold suspends automatic recovery reloads", () => {
  reset();
  assert.equal(isAutoReloadHeld(), false);
  holdAutoReload();
  assert.equal(isAutoReloadHeld(), true);
  // While held, even a chunk failure resolves to no-reload immediately.
  assert.equal(recoverChunkError(new Error("Failed to fetch dynamically imported module: ./x.js")), false);
  // R1: the held CSS preload branch resolves the same way, without recovery.
  assert.equal(recoverChunkError(new Error("Unable to preload CSS for /assets/PdfFinishPanel-x.css")), false);
  holdAutoReload();
  release();
  assert.equal(isAutoReloadHeld(), true);
  release();
  assert.equal(isAutoReloadHeld(), false);
  release();
  assert.equal(isAutoReloadHeld(), false);
});

test("R5: absent safePaths and an empty set are different registrations", () => {
  reset();
  const counter = listenerCounted();
  setUnsavedWork("x", { hasWork: true, kind: "files", scopePath: "/tools/pdf-editor" });
  // Legacy scope-prefix rule still applies while unregistered.
  assert.equal(isGuardedTarget("/tools/pdf-editor/merge"), false);
  // Switching to an explicitly empty set must notify and change behavior.
  setUnsavedWork("x", { hasWork: true, kind: "files", scopePath: "/tools/pdf-editor", safePaths: [] });
  assert.equal(counter.calls(), 2);
  assert.equal(isGuardedTarget("/tools/pdf-editor/merge"), true);
  assert.equal(isGuardedTarget("/tools/pdf-editor"), true);
  // Switching back to absent notifies again and restores the prefix rule.
  setUnsavedWork("x", { hasWork: true, kind: "files", scopePath: "/tools/pdf-editor" });
  assert.equal(counter.calls(), 3);
  assert.equal(isGuardedTarget("/tools/pdf-editor/merge"), false);
  counter.off();
});

test("R5: an empty safePaths set guards every path", () => {
  reset();
  setUnsavedWork("tool", { hasWork: true, kind: "files", scopePath: "/tools/pdf-editor", safePaths: [] });
  assert.equal(isGuardedTarget("/tools/pdf-editor"), true);
  assert.equal(isGuardedTarget("/tools/pdf-editor/merge"), true);
  assert.equal(isGuardedTarget("/"), true);
});

test("R5: any first evaluation settles the one-shot grant", () => {
  reset();
  setUnsavedWork("pdf-organize", {
    hasWork: true,
    kind: "files",
    scopePath: "/tools/pdf-editor",
    safePaths: ["/tools/pdf-editor/merge"],
  });
  grantOneShotSafeTarget("pdf-organize", "/tools/pdf-editor/watermark");
  // Evaluating another *safe* path still consumes the grant.
  assert.equal(isGuardedTarget("/tools/pdf-editor/merge"), false);
  assert.equal(toolStateHooks().__peekOneShotSafeTargetForTests(), null);
  // The later watermark evaluation is guarded again.
  assert.equal(isGuardedTarget("/tools/pdf-editor/watermark"), true);
});

test("R5: one-shot grant does not leak across registrations", () => {
  reset();
  setUnsavedWork("pdf-result", {
    hasWork: true,
    kind: "files",
    scopePath: "/tools/pdf-editor",
    safePaths: ["/tools/pdf-editor/merge", "/tools/pdf-editor/watermark"],
  });
  setUnsavedWork("pdf-organize", {
    hasWork: true,
    kind: "files",
    scopePath: "/tools/pdf-editor",
    safePaths: ["/tools/pdf-editor/merge"],
  });
  grantOneShotSafeTarget("pdf-organize", "/tools/pdf-editor/watermark");
  // Blocked by pdf-organize (its safe set misses, grant is for another path).
  assert.equal(isGuardedTarget("/"), true);
  assert.equal(toolStateHooks().__peekOneShotSafeTargetForTests(), null);
  // And the grant is gone for the later watermark evaluation too.
  assert.equal(isGuardedTarget("/tools/pdf-editor/watermark"), true);
});

test("R5: expired grants never pass, restorable only after a matched consume", () => {
  reset();
  setUnsavedWork("pdf-organize", {
    hasWork: true,
    kind: "files",
    scopePath: "/tools/pdf-editor",
    safePaths: ["/tools/pdf-editor"],
  });
  const realNow = Date.now;
  try {
    grantOneShotSafeTarget("pdf-organize", "/tools/pdf-editor/watermark");
    Date.now = () => realNow() + 6000;
    assert.equal(isGuardedTarget("/tools/pdf-editor/watermark"), true);
    assert.equal(toolStateHooks().__peekOneShotSafeTargetForTests(), null);
    // Dropped grants are not restorable.
    restoreLastOneShotSafeTarget();
    assert.equal(isGuardedTarget("/tools/pdf-editor/watermark"), true);
  } finally {
    Date.now = realNow;
  }
  // Fresh grant inside the TTL passes once, then restores after a failure.
  grantOneShotSafeTarget("pdf-organize", "/tools/pdf-editor/watermark");
  assert.equal(isGuardedTarget("/tools/pdf-editor/watermark"), false);
  restoreLastOneShotSafeTarget();
  assert.equal(isGuardedTarget("/tools/pdf-editor/watermark"), false);
  assert.equal(isGuardedTarget("/tools/pdf-editor/watermark"), true);
});

test("R5+N1: hook deps distinguish absent vs empty; no test exports in prod bundle", async () => {
  const { readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const path = await import("node:path");
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const source = await readFile(path.join(root, "src/app/toolState.ts"), "utf8");
  assert.match(source, /safePaths === undefined \? "\\0absent"/);
  assert.match(source, /function safePathsEqual/);
  assert.doesNotMatch(source, /export function __\w+ForTests/);
  const chunk = await readFile(path.join(root, "src/app/chunkRecovery.ts"), "utf8");
  assert.doesNotMatch(chunk, /export function __\w+ForTests/);
  assert.doesNotMatch(chunk, /__wl\w+TestHooks/);
  const hosts = await readFile(path.join(root, "src/features/pdf-editor/PdfEditorPage.tsx"), "utf8");
  assert.doesNotMatch(hosts, /export function __\w+ForTests/);
  for (const name of ["__wlToolStateTestHooks", "__wlPdfHandoffTestHooks"]) {
    assert.match(source + hosts, new RegExp(name));
  }
});
