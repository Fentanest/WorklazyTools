import assert from "node:assert/strict";
import test from "node:test";

import { assignPairFiles, swapPairSides, type PairState } from "../../src/features/excel-compare/pairFiles.ts";

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
