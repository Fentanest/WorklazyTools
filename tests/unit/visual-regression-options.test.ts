import assert from "node:assert/strict";
import test from "node:test";

import {
  filterVisualScenarios,
  parseVisualOnly,
  resolveVisualConcurrency,
} from "../visual-regression-options.mjs";

const scenarios = [
  { scenarioId: "excel-compare-empty--initial", routeId: "excel-compare-empty", toolId: "excel-compare" },
  { scenarioId: "excel-compare-empty--bottom", routeId: "excel-compare-empty", toolId: "excel-compare" },
  { scenarioId: "document-compare-empty--initial", routeId: "document-compare-empty", toolId: "document-compare" },
];

test("visual concurrency uses a bounded half-CPU default and supports an explicit override", () => {
  assert.deepEqual(resolveVisualConcurrency(undefined, 16), {
    value: 4,
    source: "cpu-default",
    availableCpuCount: 16,
  });
  assert.equal(resolveVisualConcurrency(undefined, 2).value, 1);
  assert.equal(resolveVisualConcurrency(" 6 ", 16).value, 6);
  assert.throws(() => resolveVisualConcurrency("0", 16), /VISUAL_CONCURRENCY/);
  assert.throws(() => resolveVisualConcurrency("many", 16), /VISUAL_CONCURRENCY/);
});

test("VISUAL_ONLY accepts comma-separated scenario, route, and tool identifiers", () => {
  const terms = parseVisualOnly("excel-compare, document-compare-empty--initial,excel-compare");
  assert.deepEqual(terms, ["excel-compare", "document-compare-empty--initial"]);
  assert.deepEqual(filterVisualScenarios(scenarios, terms), scenarios);
  assert.equal(filterVisualScenarios(scenarios, parseVisualOnly("excel-compare-empty")).length, 2);
  assert.equal(filterVisualScenarios(scenarios, parseVisualOnly(undefined)), scenarios);
  assert.throws(() => filterVisualScenarios(scenarios, ["missing-tool"]), /missing-tool/);
});
