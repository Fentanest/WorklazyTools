import assert from "node:assert/strict";
import test from "node:test";

import { buildCaptureMatrix, parseVisualShard, selectVisualShard } from "../visual-regression-matrix.mjs";
import { visualRegressionConfig } from "../visual-regression.config.mjs";

const scenarios = visualRegressionConfig.scenarios;
const viewports = visualRegressionConfig.viewports;

test("VISUAL_SHARD parses k/n and rejects malformed values", () => {
  assert.equal(parseVisualShard(undefined), null);
  assert.equal(parseVisualShard("  "), null);
  assert.deepEqual(parseVisualShard("1/2"), { index: 1, total: 2 });
  assert.deepEqual(parseVisualShard("2/2"), { index: 2, total: 2 });
  for (const raw of ["bogus", "1", "1/", "/2", "0/2", "3/2", "1/0", "1.5/2"]) {
    assert.throws(() => parseVisualShard(raw), /VISUAL_SHARD/);
  }
});

test("two-shard partition covers the real manifest with ceil/floor sizes", () => {
  const full = buildCaptureMatrix(scenarios, viewports);
  const first = selectVisualShard(full, { index: 1, total: 2 });
  const second = selectVisualShard(full, { index: 2, total: 2 });
  assert.equal(first.length, Math.ceil(full.length / 2));
  assert.equal(second.length, Math.floor(full.length / 2));
  const union = new Set([...first, ...second].map(({ name }) => name));
  assert.equal(union.size, full.length);
  assert.ok(full.every(({ name }) => union.has(name)));
  assert.equal(selectVisualShard(full, null), full);
});

test("matrix rejects unknown viewports and duplicate capture names", () => {
  assert.throws(
    () => buildCaptureMatrix([{ scenarioId: "x", routeId: "x", profiles: [{ locale: "ko", theme: "light", viewport: "nope" }] }], viewports),
    /Unknown visual viewport/,
  );
  const dup = { scenarioId: "x", routeId: "x", profiles: [{ locale: "ko", theme: "light", viewport: "desktop" }] };
  assert.throws(() => buildCaptureMatrix([dup, dup], viewports), /duplicate capture names/);
});
