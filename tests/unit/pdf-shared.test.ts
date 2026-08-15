import assert from "node:assert/strict";
import test from "node:test";

import { mapWithConcurrency } from "../../src/features/pdf-editor/pdfShared.ts";

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
