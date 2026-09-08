import assert from "node:assert/strict";
import test from "node:test";

import {
  applyInitialInspection,
  assignPairFiles,
  mergeExcelCompareInspection,
  selectManualHeader,
  selectPairSheet,
  swapPairSides,
  type PairState,
} from "../../src/features/excel-compare/pairFiles.ts";
import type { ExcelCompareInspection } from "../../src/features/excel-compare/types.ts";

test("assignPairFiles fills two empty slots from a two-file drop", () => {
  assert.deepEqual(assignPairFiles({}, ["first", "second"]), {
    left: "first", right: "second", assignedCount: 2, unassignedFiles: [],
  });
});

test("assignPairFiles fills the left slot from a one-file drop", () => {
  assert.deepEqual(assignPairFiles({}, ["first"]), {
    left: "first", right: undefined, assignedCount: 1, unassignedFiles: [],
  });
});

test("assignPairFiles fills only the available slot without overwriting", () => {
  assert.deepEqual(assignPairFiles({ left: "occupied" }, ["first"]), {
    left: "occupied", right: "first", assignedCount: 1, unassignedFiles: [],
  });
});

test("assignPairFiles reports overflow when one slot receives two files", () => {
  assert.deepEqual(assignPairFiles({ right: "occupied" }, ["first", "second"]), {
    left: "first", right: "occupied", assignedCount: 1, unassignedFiles: ["second"],
  });
});

test("assignPairFiles preserves two occupied slots and reports every incoming file", () => {
  assert.deepEqual(assignPairFiles({ left: "left", right: "right" }, ["first", "second", "third"]), {
    left: "left", right: "right", assignedCount: 0, unassignedFiles: ["first", "second", "third"],
  });
});

test("swapPairSides exchanges every side-owned field and preserves pair-wide fields", () => {
  const left = new File(["left"], "left.xlsx");
  const right = new File(["right"], "right.xlsx");
  const pair: PairState = {
    id: 7,
    left,
    right,
    leftInspection: { fileName: "left.xlsx", format: "xlsx", supportsStyleComparison: true, sheets: [] },
    rightInspection: { fileName: "right.xlsx", format: "xlsb", supportsStyleComparison: false, sheets: [] },
    leftInspecting: false,
    rightInspecting: true,
    leftError: "left-error",
    rightError: "right-error",
    leftSheet: "Left sheet",
    rightSheet: "Right sheet",
    leftHeaderRow: 2,
    rightHeaderRow: 5,
    leftHeaderInput: "2",
    rightHeaderInput: "5",
    leftHeaderSelections: { "Left sheet": { row: 2, source: "manual" } },
    rightHeaderSelections: { "Right sheet": { row: 5, source: "suggested" } },
    leftHeaderAnnouncement: undefined,
    rightHeaderAnnouncement: { row: 5, source: "suggested" },
    primaryLeft: [1, 3],
    primaryRight: [2, 4],
    secondaryLeft: [6],
    secondaryRight: [7],
    duplicatePolicy: "secondary",
    reconcile: {
      leftAmountColumn: 8,
      rightAmountColumn: 9,
      leftDateColumn: 10,
      rightDateColumn: 11,
      leftPartnerColumn: 12,
      rightPartnerColumn: 13,
      dateToleranceDays: 4,
      allowGroupedMatches: true,
      roundingUnit: 0.5,
    },
    unassignedFileCount: 2,
  };

  const swapped = swapPairSides(pair);
  assert.equal(swapped.left, pair.right);
  assert.equal(swapped.right, pair.left);
  assert.equal(swapped.leftInspection, pair.rightInspection);
  assert.equal(swapped.rightInspection, pair.leftInspection);
  assert.equal(swapped.leftInspecting, pair.rightInspecting);
  assert.equal(swapped.rightInspecting, pair.leftInspecting);
  assert.equal(swapped.leftError, pair.rightError);
  assert.equal(swapped.rightError, pair.leftError);
  assert.equal(swapped.leftSheet, pair.rightSheet);
  assert.equal(swapped.rightSheet, pair.leftSheet);
  assert.equal(swapped.leftHeaderRow, pair.rightHeaderRow);
  assert.equal(swapped.rightHeaderRow, pair.leftHeaderRow);
  assert.equal(swapped.leftHeaderInput, pair.rightHeaderInput);
  assert.equal(swapped.rightHeaderInput, pair.leftHeaderInput);
  assert.equal(swapped.leftHeaderSelections, pair.rightHeaderSelections);
  assert.equal(swapped.rightHeaderSelections, pair.leftHeaderSelections);
  assert.equal(swapped.leftHeaderAnnouncement, pair.rightHeaderAnnouncement);
  assert.equal(swapped.rightHeaderAnnouncement, pair.leftHeaderAnnouncement);
  assert.equal(swapped.primaryLeft, pair.primaryRight);
  assert.equal(swapped.primaryRight, pair.primaryLeft);
  assert.equal(swapped.secondaryLeft, pair.secondaryRight);
  assert.equal(swapped.secondaryRight, pair.secondaryLeft);
  assert.deepEqual(swapped.reconcile, {
    ...pair.reconcile,
    leftAmountColumn: 9,
    rightAmountColumn: 8,
    leftDateColumn: 11,
    rightDateColumn: 10,
    leftPartnerColumn: 13,
    rightPartnerColumn: 12,
  });
  assert.equal(swapped.id, pair.id);
  assert.equal(swapped.duplicatePolicy, pair.duplicatePolicy);
  assert.equal(swapped.unassignedFileCount, pair.unassignedFileCount);
});

test("initial suggestions, manual overrides, and fallback rows remain sheet-local", () => {
  const inspection: ExcelCompareInspection = {
    fileName: "book.xlsx",
    format: "xlsx",
    supportsStyleComparison: true,
    sheets: [
      { name: "Suggested", rowCount: 8, columnCount: 2, headerRows: [{ row: 1, values: ["Title", "B"] }, { row: 4, values: ["ID", "Name"] }], headerSuggestion: { row: 4, reason: "suggested" } },
      { name: "Fallback", rowCount: 5, columnCount: 2, headerRows: [{ row: 1, values: ["A", "B"] }, { row: 2, values: ["ID", "Name"] }], headerSuggestion: { row: null, reason: "uncertain" } },
    ],
  };
  const initial = applyInitialInspection(emptyPair(1), "left", inspection);
  assert.equal(initial.leftSheet, "Suggested");
  assert.deepEqual(initial.leftHeaderSelections, {
    Suggested: { row: 4, source: "suggested" },
    Fallback: { row: 1, source: "fallback" },
  });
  assert.deepEqual(initial.leftHeaderAnnouncement, { row: 4, source: "suggested" });

  const manualSuggested = selectManualHeader(initial, "left", 1);
  assert.deepEqual(manualSuggested.leftHeaderSelections.Suggested, { row: 1, source: "manual" });
  assert.equal(manualSuggested.leftHeaderAnnouncement, undefined);
  const fallbackSheet = selectPairSheet(manualSuggested, "left", "Fallback");
  assert.equal(fallbackSheet.leftHeaderRow, 1);
  assert.equal(fallbackSheet.leftHeaderSelections.Fallback.source, "fallback");
  const manualFallback = selectManualHeader(fallbackSheet, "left", 2);
  const restoredSuggested = selectPairSheet(manualFallback, "left", "Suggested");
  assert.deepEqual(restoredSuggested.leftHeaderSelections.Suggested, { row: 1, source: "manual" });
  assert.equal(restoredSuggested.leftHeaderRow, 1);
});

test("a new initial inspection replaces old manual state and an uncached refresh preserves its suggestion", () => {
  const first: ExcelCompareInspection = {
    fileName: "first.xlsx", format: "xlsx", supportsStyleComparison: true,
    sheets: [{ name: "Data", rowCount: 6, columnCount: 2, headerRows: [{ row: 1, values: ["ID", "Name"] }], headerSuggestion: { row: 1, reason: "suggested" } }],
  };
  const replacement: ExcelCompareInspection = {
    fileName: "replacement.xlsx", format: "xlsx", supportsStyleComparison: true,
    sheets: [{ name: "Data", rowCount: 8, columnCount: 2, headerRows: [{ row: 1, values: ["Title", "B"] }, { row: 4, values: ["ID", "Name"] }], headerSuggestion: { row: 4, reason: "suggested" } }],
  };
  const oldManual = selectManualHeader(applyInitialInspection(emptyPair(2), "left", first), "left", 3);
  const replaced = applyInitialInspection(oldManual, "left", replacement);
  assert.deepEqual(replaced.leftHeaderSelections, { Data: { row: 4, source: "suggested" } });
  assert.equal(replaced.leftHeaderRow, 4);

  const manualRefresh: ExcelCompareInspection = {
    ...replacement,
    sheets: [{ name: "Data", rowCount: 8, columnCount: 2, headerRows: [{ row: 6, values: ["Custom", "Header"] }] }],
  };
  const merged = mergeExcelCompareInspection(replacement, manualRefresh);
  assert.deepEqual(merged.sheets[0].headerRows.map((item) => item.row), [1, 4, 6]);
  assert.deepEqual(merged.sheets[0].headerSuggestion, { row: 4, reason: "suggested" });
});

function emptyPair(id: number): PairState {
  return {
    id,
    leftInspecting: false,
    rightInspecting: false,
    leftSheet: "",
    rightSheet: "",
    leftHeaderRow: 1,
    rightHeaderRow: 1,
    leftHeaderInput: "1",
    rightHeaderInput: "1",
    leftHeaderSelections: {},
    rightHeaderSelections: {},
    primaryLeft: [1],
    primaryRight: [1],
    secondaryLeft: [],
    secondaryRight: [],
    duplicatePolicy: "error",
    reconcile: { leftAmountColumn: 1, rightAmountColumn: 1, dateToleranceDays: 0, allowGroupedMatches: false, roundingUnit: 0.01 },
    unassignedFileCount: 0,
  };
}
