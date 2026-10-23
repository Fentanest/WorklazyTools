import assert from "node:assert/strict";
import test from "node:test";
import { projectCompareRecords, selectCompareResult } from "../../src/features/excel-compare/resultProjection.ts";
import type { ExcelCompareStandardRecord } from "../../src/features/excel-compare/types.ts";

const records: ExcelCompareStandardRecord[] = [4, 7, 8].map((row) => ({ recordId: `run:${row}`, status: "changed", leftRow: row, rightRow: row + 2, leftColumn: 4, rightColumn: 2, key: "key", displayKey: "key", leftValue: "before", rightValue: "after", reason: "FORMULA", change: "FORMULA" }));

test("sorting and hiding project record IDs without mutating source coordinates", () => {
  const frozen = records.map((record) => Object.freeze({ ...record }));
  const visible = projectCompareRecords(frozen, { hiddenLeftRows: new Set([8]), descending: true });
  assert.deepEqual(visible.map((r) => [r.recordId, r.leftRow, r.leftColumn]), [["run:7", 7, 4], ["run:4", 4, 4]]);
  assert.deepEqual(frozen.map((r) => r.leftRow), [4, 7, 8]);
  assert.equal(projectCompareRecords(frozen, { hiddenLeftColumns: new Set([4]) }).length, 0);
});
test("visible export selects the same IDs and recomputes only projected counts", () => {
  const result = { runId: "run", records, parameters: [["mode", "key"]] as Array<[string, string]>, warnings: ["warning"], summary: { matched: 0, changed: 3, added: 0, removed: 0, duplicate: 0, ambiguous: 0, unmatched: 0, error: 0 } };
  const visible = selectCompareResult(result, new Set(["run:7"]));
  assert.equal(visible.runId, result.runId);
  assert.equal(visible.records[0], records[1]);
  assert.equal(visible.summary.changed, 1);
  assert.equal(result.summary.changed, 3);
});
