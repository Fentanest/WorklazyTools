import test from "node:test";
import assert from "node:assert/strict";
// @ts-ignore JavaScript runner exports a pure assessment function.
import { assess, validSuites } from "../../scripts/test-product-banner.mjs";
test("banner runner rejects missing, skipped, failed, duplicate, extra and zero cases", () => {
  for (const [expected, observed, exit] of [
    [["A"], [], 0], [["A"], [{ name: "A", status: "NOT_RUN" }], 0],
    [["A"], [{ name: "A", status: "FAIL" }], 0],
    [["A"], [{ name: "A", status: "PASS" }, { name: "A", status: "PASS" }], 0],
    [["A"], [{ name: "B", status: "PASS" }], 0], [[], [], 0],
    [["A", "A"], [{ name: "A", status: "PASS" }], 0],
    [["A"], [{ name: "A", status: "PASS" }], 1],
  ]) assert.equal(assess(expected, observed, exit).ok, false);
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
