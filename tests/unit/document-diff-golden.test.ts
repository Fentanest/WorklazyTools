import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { diffText } from "../../src/features/document-compare/documentComparison.ts";

interface GoldenCase {
  id: string;
  before: string;
  after: string;
  expected: ReturnType<typeof diffText>;
}

interface GoldenFixture {
  schemaVersion: number;
  offsetUnit: string;
  cases: GoldenCase[];
}

const fixture = JSON.parse(
  fs.readFileSync(new URL("../fixtures/document-compare/word-diff-golden.json", import.meta.url), "utf8"),
) as GoldenFixture;

// Canonical sentence diff contract (2026-09-07): tokenize with
// /\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu, build an LCS matrix with before
// on rows and after on columns, prefer the left cell on backtracking ties,
// reverse once, and merge adjacent segments of the same type. The 1,500,000
// cell guard is calculated from token counts and preserves empty guard items.
test("document diff golden fixture has the fixed 97-pair inventory", () => {
  assert.equal(fixture.schemaVersion, 1);
  assert.equal(fixture.offsetUnit, "unicode-code-point");
  assert.equal(fixture.cases.length, 97);
  assert.deepEqual(
    Object.fromEntries(["syn", "fixture", "hwp"].map((prefix) => [
      prefix,
      fixture.cases.filter((row) => row.id.startsWith(`${prefix}:`)).length,
    ])),
    { syn: 27, fixture: 68, hwp: 2 },
  );
  assert.equal(fixture.cases.some((row) => row.id.startsWith("user:")), false);
});

for (const row of fixture.cases) {
  test(`document diff golden: ${row.id}`, () => {
    assert.deepEqual(diffText(row.before, row.after), row.expected);
  });
}
