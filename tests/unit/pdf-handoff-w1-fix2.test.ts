import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { isDevTestEnvironment } from "../../src/app/toolState.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("fix2 timeout gate: ack deadline honors the override only in dev/QA", () => {
  const source = read("src/features/pdf-editor/PdfEditorPage.tsx");
  // The override global must be read only behind a dev/QA gate so normal
  // production builds always use exactly 30s.
  assert.match(source, /isDevTestEnvironment\(\) \|\| isLocalQaBuild/);
  assert.match(source, /function ackTimeoutMs/);
  const gateBlock = source.slice(source.indexOf("function ackTimeoutMs"));
  assert.match(gateBlock, /__wlHandoffAckTimeoutMs/);
  assert.match(gateBlock, /return HANDOFF_ACK_TIMEOUT_MS/);
});

test("fix2 pdfjs epoch: reset is bounded and reports whether it reset", () => {
  const source = read("src/features/pdf-editor/pdfPreview.ts");
  assert.match(source, /MAX_PDF_DISPLAY_EPOCHS = \d+/);
  assert.match(source, /export function resetPdfDisplayModule\(\): boolean/);
  assert.match(source, /if \(pdfDisplayModuleEpoch >= MAX_PDF_DISPLAY_EPOCHS\) return false/);
});

test("fix2 F3: the intake effect has no consumed-once guard", () => {
  // A StrictMode remount aborts the first insert; treating the aborted run
  // as consumed leaves the intake empty forever. Superseded runs exit via
  // the fileRequestRef generation check instead.
  const source = read("src/features/pdf-editor/PdfFinishPanel.tsx");
  assert.doesNotMatch(source, /intakeConsumedRef/);
});

test("fix2 F1: unmount always cancels the armed ack timer", () => {
  const source = read("src/features/pdf-editor/PdfEditorPage.tsx");
  // The fire callback must recheck ownership (generation+attempt) so an old
  // timer can never release a newer handoff's hold.
  assert.match(source, /current\.generation === generation && current\.attempt === attempt/);
});

test("fix2 F2/F5: save signals keep the payload and never discard the slot", () => {
  const source = read("src/features/pdf-editor/PdfEditorPage.tsx");
  // Chip/boundary/retained downloads release the guard via setResultSaved;
  // only the explicit discard path nulls the slot.
  assert.match(source, /const markHandoffSaved = useCallback\(\(\) => \{\s+clearUnsavedWork\("pdf-result"\);\s+setResultSaved\(true\);/);
  assert.match(source, /const handleBoundaryDownloaded = useCallback\(\(\) => \{\s+releaseHold\(\);\s+clearUnsavedWork\("pdf-result"\);\s+setResultSaved\(true\);/);
});

test("fix2 leave race: our own back() popstate is swallowed on arrival", () => {
  // The destination re-pushes its guard entry before our back()'s popstate
  // arrives; consuming it as a fresh Back press reopens the dialog.
  const source = read("src/components/AppShell.tsx");
  assert.match(source, /skipPopRef\.current = true;\s+action\(\);/);
});

test("isDevTestEnvironment honors NODE_ENV in plain node", () => {
  const previous = process.env.NODE_ENV;
  try {
    delete process.env.NODE_ENV;
    assert.equal(isDevTestEnvironment(), true);
    process.env.NODE_ENV = "production";
    assert.equal(isDevTestEnvironment(), false);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
