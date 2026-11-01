import assert from "node:assert/strict";
import test from "node:test";

import {
  __clearToolStateForTests,
  __peekOneShotSafeTargetForTests,
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
import { __clearAutoReloadHoldForTests, holdAutoReload, isAutoReloadHeld, recoverChunkError, release } from "../../src/app/chunkRecovery.ts";

function reset() {
  __clearToolStateForTests();
  __clearAutoReloadHoldForTests();
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
  assert.deepEqual(__peekOneShotSafeTargetForTests(), { toolId: "pdf-organize", path: "/tools/pdf-editor/watermark" });
  // pdf-result is safe via safePaths, pdf-organize via the one-shot grant.
  assert.equal(isGuardedTarget("/tools/pdf-editor/watermark"), false);
  // Consumed: the second evaluation of the same path is guarded again.
  assert.equal(isGuardedTarget("/tools/pdf-editor/watermark"), true);
  assert.equal(__peekOneShotSafeTargetForTests(), null);
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
  assert.equal(__peekOneShotSafeTargetForTests(), null);

  grantOneShotSafeTarget("pdf-organize", "/tools/pdf-editor/watermark");
  revokeOneShotSafeTarget("pdf-organize");
  assert.equal(__peekOneShotSafeTargetForTests(), null);
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
  holdAutoReload();
  release();
  assert.equal(isAutoReloadHeld(), true);
  release();
  assert.equal(isAutoReloadHeld(), false);
  release();
  assert.equal(isAutoReloadHeld(), false);
});
