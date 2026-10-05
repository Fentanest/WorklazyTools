import test from "node:test";
import assert from "node:assert/strict";
// @ts-ignore JavaScript runner exports a pure assessment function.
import { assess, validSuites, caseDiagnostics } from "../../scripts/test-product-banner.mjs";
test("banner runner rejects missing, skipped, failed, duplicate, extra and zero cases", () => {
  for (const [expected, observed, exit] of [
    [["A"], [], 0], [["A"], [{ name: "A", status: "NOT_RUN" }], 0],
    [["A"], [{ name: "A", status: "FAIL" }], 0],
    [["A"], [{ name: "A", status: "PASS" }, { name: "A", status: "PASS" }], 0],
    [["A"], [{ name: "B", status: "PASS" }], 0], [[], [], 0],
    [["A", "A"], [{ name: "A", status: "PASS" }], 0],
    [["A"], [{ name: "A", status: "PASS" }], 1],
  ]) assert.equal(assess(expected, observed, exit).ok, false);
  const tap = `# not ok 0 - A\n# error: PRIVATE_PREFIX\nnot ok 1 - A prefix\n  ---\n  error: PRIVATE_STALE_PREFIX\n  ...\n# Subtest: A\nnot ok 2 - A\n  ---\n  failureType: 'testCodeFailure'\n  error: |-\n    locator.click: Timeout 6000ms exceeded. token=PRIVATE_TOKEN https://affiliate.invalid/?secret=PRIVATE_URL\n    PRIVATE_PRODUCT_VALUE\n  stack: |-\n    TestContext.<anonymous> (/private/host/tests/product-banner/t5b.browser.test.ts:140:1)\n  ...\nok 3 - C\n`;
  const diagnostics = caseDiagnostics([{ name: "A", status: "FAIL" }, { name: "B", status: "NOT_RUN" }, { name: "C", status: "PASS" }], tap);
  assert.deepEqual(diagnostics[0], { case: "A", status: "FAIL", errorType: "testCodeFailure", location: "tests/product-banner/t5b.browser.test.ts:140:1", message: "locator.click: Timeout 6000ms exceeded." });
  assert.equal(diagnostics.length, 2); assert.equal(diagnostics[1].case, "B"); assert.equal(diagnostics[1].location, "unavailable");
  assert.doesNotMatch(JSON.stringify(diagnostics), /PRIVATE|https?:|\/private\//u);
  assert.equal(caseDiagnostics([{ name: "A", status: "FAIL" }], "not ok 1 - A\n  ---\n  error: 'PRIVATE_PRODUCT secret=PRIVATE_SECRET'\n  ...\n")[0].message, "[message redacted or unavailable]");
  assert.deepEqual(caseDiagnostics([{ name: "A", status: "PASS" }], tap), []);
});
test("banner runner counts only the declared successful cases", () => {
  const result = assess(["A", "B"], [{ name: "A", status: "PASS" }, { name: "B", status: "PASS" }], 0);
  assert.equal(result.ok, true); assert.equal(result.passed, 2); assert.equal(result.notRun, 0);
});
test("banner runner rejects a missing or duplicate suite", () => {
  const ids = ["unit", "render", "export", "ui", "t5b", "r3a", "r3b", "late-image", "matrix", "editor-repair"].map((id) => ({ id }));
  assert.equal(validSuites(ids), true);
  for (const bad of [[], ...ids.map((_, index) => ids.filter((_, i) => i !== index)), [...ids, ids[0]]]) assert.equal(validSuites(bad), false);
});
