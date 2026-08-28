import assert from "node:assert/strict";
import test from "node:test";

import { compactPdfPageRange, mapWithConcurrency, splitPdfPageRanges } from "../../src/features/pdf-editor/pdfShared.ts";

test("bounded PDF page rendering preserves order and concurrency", async () => {
  let active = 0;
  let peak = 0;
  const values = await mapWithConcurrency([5, 4, 3, 2, 1], 3, async (value) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, value));
    active -= 1;
    return value * 2;
  });
  assert.deepEqual(values, [10, 8, 6, 4, 2]);
  assert.equal(peak, 3);
});

test("PDF page ranges compact visual selection without losing custom order", () => {
  assert.equal(compactPdfPageRange([0, 1, 2, 4]), "1-3, 5");
  assert.equal(compactPdfPageRange([4, 0, 1, 2]), "5, 1-3");
  assert.equal(compactPdfPageRange([4, 3, 2]), "5-3");
  assert.equal(compactPdfPageRange([4, 0, 1, 2], true), "1-3, 5");
});

test("quick PDF splitting creates complete continuous page groups", () => {
  assert.deepEqual(splitPdfPageRanges(7, [1, 4]), [[0, 1], [2, 3, 4], [5, 6]]);
  assert.deepEqual(splitPdfPageRanges(3, []), [[0, 1, 2]]);
  assert.deepEqual(splitPdfPageRanges(4, [2, 2, 9, -1]), [[0, 1, 2], [3]]);
});
