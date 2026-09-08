import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { pages, accessibilityExceptions, accessibilityOwnerFromResolution, assertAccessibilityResults } from "../accessibility-audit.mjs";

function report() {
  return { summary: { violations: 0, placeholderContrast: { ratio: 4.8871 } }, externalRequests: [],
    results: pages.map(({ id, scenario }) => ({ id, violations: [], incomplete: [], ...(scenario === "pdf-watermark-empty-text" ? {
      settledContrast: [{ target: "invalid-textarea", ratio: 4.5 }, { target: "empty-text-notice", ratio: 4.5 }],
    } : {}), ...(scenario === "pdf-watermark-display-load-failure" ? {
      interactiveContrast: ["normal", "hover", "focus"].map((state) => ({ state, ratio: 4.5 })),
    } : {}) })) };
}

test("a11y zero passes; one violation fails even if stored summary still says zero", () => {
  assert.equal(assertAccessibilityResults(report()).violations, 0);
  const injected = report();
  injected.results[0].violations.push({ id: "color-contrast", impact: "moderate", nodes: 1 });
  assert.throws(() => assertAccessibilityResults(injected), /limits exceeded/);
});

test("a11y registrations reject missing or duplicate pages and include mobile ko and HWP", () => {
  const missing = report(); missing.results.pop();
  assert.throws(() => assertAccessibilityResults(missing), /registration/);
  const duplicate = report(); duplicate.results[1] = duplicate.results[0];
  assert.throws(() => assertAccessibilityResults(duplicate), /registration/);
  assert.deepEqual(pages.filter(({ viewport }) => viewport).map(({ path, viewport }) => [path, viewport.width]), [["/ko/tools/pdf-editor/finish", 412], ["/ko/tools/pdf-editor/stamp", 412], ["/ko", 412], ["/ko/tools", 412]]);
  assert.ok(pages.some(({ id }) => id === "hwp-editor"));
  assert.deepEqual(pages.filter(({ id }) => id.startsWith("pdf-finish")).map(({ id }) => id), ["pdf-finish-ko", "pdf-finish-mobile-ko", "pdf-finish-en"]);
  assert.ok(pages.some(({ id }) => id === "pdf-watermark-ko"));
  assert.deepEqual(pages.filter(({ id }) => id.startsWith("pdf-stamp")).map(({ id }) => id), ["pdf-stamp-ko", "pdf-stamp-mobile-ko", "pdf-stamp-en"]);
  const errorStates = pages.filter(({ scenario }) => scenario === "pdf-watermark-empty-text");
  assert.equal(errorStates.length, 4);
  assert.deepEqual([...new Set(errorStates.map(({ colorScheme }) => colorScheme))].sort(), ["dark", "light"]);
  assert.deepEqual([...new Set(errorStates.map(({ locale }) => locale))].sort(), ["en-US", "ko-KR"]);
  const displayFailures = pages.filter(({ scenario }) => scenario === "pdf-watermark-display-load-failure");
  assert.equal(displayFailures.length, 4);
  assert.deepEqual([...new Set(displayFailures.map(({ colorScheme }) => colorScheme))].sort(), ["dark", "light"]);
  assert.deepEqual([...new Set(displayFailures.map(({ locale }) => locale))].sort(), ["en-US", "ko-KR"]);
});

test("a11y PDF display reload contrast requires normal, hover and focus in every locale and theme", () => {
  const missing = report();
  missing.results.find(({ id }) => id === "pdf-watermark-display-error-en-dark").interactiveContrast.pop();
  assert.throws(() => assertAccessibilityResults(missing), /missing an interaction state/);

  const low = report();
  low.results.find(({ id }) => id === "pdf-watermark-display-error-ko-light").interactiveContrast[2].ratio = 4.49;
  assert.throws(() => assertAccessibilityResults(low), /below 4\.5:1/);
});

test("a11y watermark error-state contrast is required for every locale and theme without raising limits", () => {
  const missing = report();
  delete missing.results.find(({ id }) => id === "pdf-watermark-error-en-dark")?.settledContrast;
  assert.throws(() => assertAccessibilityResults(missing), /contrast is missing/);

  const low = report();
  low.results.find(({ id }) => id === "pdf-watermark-error-ko-light").settledContrast[1].ratio = 4.49;
  assert.throws(() => assertAccessibilityResults(low), /below 4\.5:1/);
});

test("a11y exception is exactly one upstream iframe with explicit owner and reason", () => {
  assert.equal(accessibilityExceptions.length, 1);
  const exception = accessibilityExceptions[0];
  assert.equal(exception.pageId, "hwp-editor");
  assert.equal(exception.selector, 'iframe[title="rhwp HWP 문서 편집기"]');
  assert.match(exception.owner, /rhwp Studio 0.8.6/);
  assert.match(exception.reason, /docs\/backlog.md/);
  assert.ok(exception.reason.length > 20);
});

test("recorded desktop zero-result JSON passes and an injected violation fails", () => {
  const measured = JSON.parse(fs.readFileSync(new URL("../fixtures/harness/a11y-zero.json", import.meta.url), "utf8"));
  const registeredPages = pages.filter(({ id }) => ["home", "document-compare", "tools", "excel-compare", "pdf-editor"].includes(id));
  assert.equal(assertAccessibilityResults(measured, { registeredPages }).violations, 0);
  measured.results[0].violations.push({ id: "color-contrast", impact: "moderate", nodes: 1 });
  assert.throws(() => assertAccessibilityResults(measured, { registeredPages }), /limits exceeded/);
});

test("a11y incomplete targets and reasons remain visible while only F2-owned nodes fail the gate", () => {
  const inherited = report();
  inherited.results[0].incomplete.push({ id: "color-contrast", nodes: [{ target: [".shared"], reasons: ["Needs manual review"], owner: "shared-existing" }] });
  const summary = assertAccessibilityResults(inherited);
  assert.equal(summary.incompleteNodes, 1);
  assert.equal(summary.inheritedIncompleteNodes, 1);
  assert.equal(summary.f2IncompleteNodes, 0);

  const f2 = report();
  f2.results.find(({ id }) => id === "pdf-watermark-ko")?.incomplete.push({ id: "color-contrast", nodes: [{ target: ["[data-pdf-watermark-owned]"], reasons: ["Needs manual review"], owner: "f2-watermark" }] });
  assert.throws(() => assertAccessibilityResults(f2), /F2 accessibility incomplete nodes/);

  const discarded = report();
  discarded.results[0].incomplete.push({ id: "color-contrast", nodes: [{ target: [], reasons: [], owner: "shared-existing" }] });
  assert.throws(() => assertAccessibilityResults(discarded), /target or reason was discarded/);
});

test("a11y gradient incomplete is separately retained only after reload pixel contrast passes", () => {
  const measured = report();
  measured.results.find(({ id }) => id === "pdf-watermark-display-error-ko-dark").resolvedIncomplete = [{
    rule: "color-contrast", target: ["[data-testid='pdf-display-reload']"], reasons: ["Background gradient"], resolution: "measured-pixel",
  }];
  const summary = assertAccessibilityResults(measured);
  assert.equal(summary.pixelResolvedIncompleteNodes, 1);
  assert.equal(summary.inheritedIncompleteNodes, 0);

  measured.results.find(({ id }) => id === "pdf-watermark-display-error-ko-dark").interactiveContrast[0].ratio = 4.49;
  assert.throws(() => assertAccessibilityResults(measured), /below 4\.5:1/);
});

test("a11y incomplete selector resolution never defaults missing or invalid targets to shared ownership", () => {
  assert.equal(accessibilityOwnerFromResolution("f2-watermark", "owned"), "f2-watermark");
  assert.equal(accessibilityOwnerFromResolution("shared-existing", "shared"), "shared-existing");
  assert.throws(() => accessibilityOwnerFromResolution("missing", "missing-selector"), /missing-selector/);
  assert.throws(() => accessibilityOwnerFromResolution("invalid", "invalid-selector"), /invalid-selector/);
  assert.throws(() => accessibilityOwnerFromResolution(undefined, "no-resolution"), /no-resolution/);
});
