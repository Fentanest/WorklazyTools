import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { pages, accessibilityExceptions, assertAccessibilityResults } from "../accessibility-audit.mjs";

function report() {
  return { summary: { violations: 0, placeholderContrast: { ratio: 4.8871 } }, externalRequests: [],
    results: pages.map(({ id }) => ({ id, violations: [] })) };
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
  assert.deepEqual(pages.filter(({ id }) => ["home-mobile-ko", "tools-mobile-ko"].includes(id)).map(({ path, viewport }) => [path, viewport?.width]), [["/ko", 412], ["/ko/tools", 412]]);
  assert.ok(pages.some(({ id }) => id === "hwp-editor"));
  const duplicateResults = pages.filter(({ setup }) => setup === "excel-duplicates");
  assert.equal(duplicateResults.length, 8);
  assert.deepEqual(new Set(duplicateResults.map(({ language }) => language)), new Set(["ko", "en"]));
  assert.deepEqual(new Set(duplicateResults.map(({ colorScheme }) => colorScheme)), new Set(["light", "dark"]));
  assert.deepEqual(new Set(duplicateResults.map(({ viewport }) => viewport ? "mobile" : "desktop")), new Set(["desktop", "mobile"]));
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
