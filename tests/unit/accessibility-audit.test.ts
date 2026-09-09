import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { pages, accessibilityExceptions, accessibilityOwnerFromResolution, assertAccessibilityResults, selectAccessibilityPages, f3OwnedSelector, f3StampOwnershipTargets, f4aOwnedSelector, f4aStructureOwnershipTargets, f4bOwnedSelector, f4bRasterOwnershipTargets } from "../accessibility-audit.mjs";

function report() {
  return { summary: { violations: 0, placeholderContrast: { ratio: 4.8871 } }, externalRequests: [],
    results: pages.map(({ id, scenario }) => ({ id, violations: [], incomplete: [], ...(id.startsWith("pdf-stamp") ? {
      stampContrast: [{ target: "notice-body", ratio: 5.87 }, { target: "notice-title", ratio: 14.66 }],
    } : {}), ...(scenario === "pdf-stamp-editing" ? {
      stampOwnership: { owner: "f3-stamp", selector: f3OwnedSelector, targets: f3StampOwnershipTargets.map(({ id: targetId }) => ({ id: targetId, matches: 1 })) },
    } : {}), ...(scenario === "pdf-structure-editing" ? {
      structureOwnership: { owner: "f4a-structure", selector: f4aOwnedSelector, targets: f4aStructureOwnershipTargets.map(({ id: targetId, expected }) => ({ id: targetId, matches: expected })) },
    } : {}), ...(scenario === "pdf-raster-editing" ? {
      rasterOwnership: { owner: "f4b-raster", selector: f4bOwnedSelector, targets: f4bRasterOwnershipTargets.map(({ id: targetId, expected }) => ({ id: targetId, matches: expected })) },
    } : {}), ...(scenario === "pdf-watermark-empty-text" ? {
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
  assert.deepEqual(pages.filter(({ id }) => ["pdf-finish-mobile-ko", "pdf-stamp-mobile-ko", "home-mobile-ko", "tools-mobile-ko"].includes(id)).map(({ path, viewport }) => [path, viewport?.width]), [["/ko/tools/pdf-editor/finish", 412], ["/ko/tools/pdf-editor/stamp", 412], ["/ko", 412], ["/ko/tools", 412]]);
  assert.ok(pages.some(({ id }) => id === "hwp-editor"));
  assert.deepEqual(pages.filter(({ id }) => id.startsWith("pdf-finish")).map(({ id }) => id), ["pdf-finish-ko", "pdf-finish-mobile-ko", "pdf-finish-en"]);
  assert.ok(pages.some(({ id }) => id === "pdf-watermark-ko"));
  assert.deepEqual(pages.filter(({ id }) => id.startsWith("pdf-stamp")).map(({ id }) => id), ["pdf-stamp-ko", "pdf-stamp-mobile-ko", "pdf-stamp-en", "pdf-stamp-editing-ko-light", "pdf-stamp-editing-ko-dark", "pdf-stamp-editing-en-light", "pdf-stamp-editing-en-dark"]);
  const stampEditingStates = pages.filter(({ scenario }) => scenario === "pdf-stamp-editing");
  assert.equal(stampEditingStates.length, 4);
  assert.deepEqual([...new Set(stampEditingStates.map(({ colorScheme }) => colorScheme))].sort(), ["dark", "light"]);
  assert.deepEqual([...new Set(stampEditingStates.map(({ locale }) => locale))].sort(), ["en-US", "ko-KR"]);
  const structureEditingStates = pages.filter(({ scenario }) => scenario === "pdf-structure-editing");
  assert.equal(structureEditingStates.length, 4);
  assert.deepEqual([...new Set(structureEditingStates.map(({ colorScheme }) => colorScheme))].sort(), ["dark", "light"]);
  assert.deepEqual([...new Set(structureEditingStates.map(({ locale }) => locale))].sort(), ["en-US", "ko-KR"]);
  const rasterEditingStates = pages.filter(({ scenario }) => scenario === "pdf-raster-editing");
  assert.equal(rasterEditingStates.length, 4);
  assert.deepEqual([...new Set(rasterEditingStates.map(({ colorScheme }) => colorScheme))].sort(), ["dark", "light"]);
  assert.deepEqual([...new Set(rasterEditingStates.map(({ locale }) => locale))].sort(), ["en-US", "ko-KR"]);
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

test("a11y includes all eight Excel duplicate-result states", () => {
  const duplicateResults = pages.filter(({ setup }) => setup === "excel-duplicates");
  assert.equal(duplicateResults.length, 8);
  assert.deepEqual(new Set(duplicateResults.map(({ language }) => language)), new Set(["ko", "en"]));
  assert.deepEqual(new Set(duplicateResults.map(({ colorScheme }) => colorScheme)), new Set(["light", "dark"]));
  assert.deepEqual(new Set(duplicateResults.map(({ viewport }) => viewport ? "mobile" : "desktop")), new Set(["desktop", "mobile"]));
});

test("A11Y_ONLY=excel-compare selects the base page and all eight duplicate-result states", () => {
  const selected = selectAccessibilityPages("excel-compare");
  assert.equal(selected.length, 9);
  assert.equal(selected[0].id, "excel-compare");
  assert.ok(selected.slice(1).every(({ id }) => id.startsWith("excel-compare-duplicates-")));
  assert.throws(() => selectAccessibilityPages("missing-page"), /did not match/);
  const scoped = { summary: { violations: 0 }, externalRequests: [], results: selected.map(({ id }) => ({ id, violations: [], incomplete: [] })) };
  assert.equal(assertAccessibilityResults(scoped, { registeredPages: selected }).violations, 0);
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

test("a11y incomplete targets and reasons remain visible while F2/F3-owned nodes fail the gate", () => {
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

test("a11y F4a gate fails closed for missing ownership, omitted states, and incomplete nodes", () => {
  const missingMarker = report();
  missingMarker.results.find(({ id }) => id === "pdf-structure-editing-ko-light").structureOwnership.targets
    .find(({ id }) => id === "preservation-rows").matches = 12;
  assert.throws(() => assertAccessibilityResults(missingMarker), /ownership marker is missing or ambiguous/);

  const omitted = report();
  omitted.results = omitted.results.filter(({ id }) => id !== "pdf-structure-editing-en-dark");
  assert.throws(() => assertAccessibilityResults(omitted), /registration mismatch/);

  const unresolved = report();
  unresolved.results.find(({ id }) => id === "pdf-structure-editing-en-light").incomplete.push({
    id: "color-contrast",
    nodes: [{ target: ["[data-testid='pdf-finish-link-preservation']"], reasons: ["Needs manual review"], owner: "f4a-structure" }],
  });
  assert.throws(() => assertAccessibilityResults(unresolved), /F4a accessibility incomplete nodes/);
});

test("a11y F4b gate fails closed for missing ownership, omitted states, and incomplete nodes", () => {
  const missingMarker = report();
  missingMarker.results.find(({ id }) => id === "pdf-raster-editing-ko-light").rasterOwnership.targets
    .find(({ id }) => id === "format").matches = 0;
  assert.throws(() => assertAccessibilityResults(missingMarker), /ownership marker is missing or ambiguous/);

  const omitted = report();
  omitted.results = omitted.results.filter(({ id }) => id !== "pdf-raster-editing-en-dark");
  assert.throws(() => assertAccessibilityResults(omitted), /registration mismatch/);

  const unresolved = report();
  unresolved.results.find(({ id }) => id === "pdf-raster-editing-en-light").incomplete.push({
    id: "color-contrast",
    nodes: [{ target: ["[data-testid='pdf-finish-raster-loss']"], reasons: ["Needs manual review"], owner: "f4b-raster" }],
  });
  assert.throws(() => assertAccessibilityResults(unresolved), /F4b accessibility incomplete nodes/);
});

test("a11y gradient incomplete is separately retained only after reload pixel contrast passes", () => {
  const measured = report();
  measured.results.find(({ id }) => id === "pdf-watermark-display-error-ko-dark").resolvedIncomplete = [{
    rule: "color-contrast", target: ["[data-testid='pdf-display-reload']"], reasons: ["Background gradient"], resolution: "measured-pixel", owner: "f2-watermark",
  }];
  const summary = assertAccessibilityResults(measured);
  assert.equal(summary.pixelResolvedIncompleteNodes, 1);
  assert.equal(summary.inheritedIncompleteNodes, 0);

  measured.results.find(({ id }) => id === "pdf-watermark-display-error-ko-dark").interactiveContrast[0].ratio = 4.49;
  assert.throws(() => assertAccessibilityResults(measured), /below 4\.5:1/);
});

test("a11y incomplete selector resolution never defaults missing or invalid targets to shared ownership", () => {
  assert.equal(accessibilityOwnerFromResolution("f2-watermark", "owned"), "f2-watermark");
  assert.equal(accessibilityOwnerFromResolution("f3-stamp", "owned"), "f3-stamp");
  assert.equal(accessibilityOwnerFromResolution("f4a-structure", "owned"), "f4a-structure");
  assert.equal(accessibilityOwnerFromResolution("f4b-raster", "owned"), "f4b-raster");
  assert.equal(accessibilityOwnerFromResolution("shared-existing", "shared"), "shared-existing");
  assert.throws(() => accessibilityOwnerFromResolution("missing", "missing-selector"), /missing-selector/);
  assert.throws(() => accessibilityOwnerFromResolution("invalid", "invalid-selector"), /invalid-selector/);
  assert.throws(() => accessibilityOwnerFromResolution(undefined, "no-resolution"), /no-resolution/);
});

test("a11y F3 gate fails closed when a required ownership marker is removed", () => {
  const missingMarker = report();
  const editing = missingMarker.results.find(({ id }) => id === "pdf-stamp-editing-ko-light");
  editing.stampOwnership.targets.find(({ id }) => id === "overlay").matches = 0;
  assert.throws(() => assertAccessibilityResults(missingMarker), /ownership marker is missing or ambiguous/);
});

test("a11y F3 gate fails closed when an owned target cannot be found", () => {
  assert.throws(() => accessibilityOwnerFromResolution("missing", "pdf-stamp-editing/notice"), /target is missing/);
});

test("a11y F3 gate fails closed when an editing-state result is omitted", () => {
  const omitted = report();
  omitted.results = omitted.results.filter(({ id }) => id !== "pdf-stamp-editing-en-dark");
  assert.throws(() => assertAccessibilityResults(omitted), /registration mismatch/);
});

test("a11y F3 gate fails closed while an owned incomplete result remains unresolved", () => {
  const unresolved = report();
  unresolved.results.find(({ id }) => id === "pdf-stamp-editing-en-light").incomplete.push({
    id: "color-contrast",
    nodes: [{ target: ["[data-testid='pdf-stamp-notice']"], reasons: ["Needs manual review"], owner: "f3-stamp" }],
  });
  assert.throws(() => assertAccessibilityResults(unresolved), /F3 accessibility incomplete nodes/);
});
