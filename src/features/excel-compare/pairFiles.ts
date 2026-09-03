import type { ExcelCompareInspection, ExcelComparePairOptions, DuplicateKeyPolicy } from "./types.ts";

export interface PairState {
  id: number;
  left?: File;
  right?: File;
  leftInspection?: ExcelCompareInspection;
  rightInspection?: ExcelCompareInspection;
  leftInspecting: boolean;
  rightInspecting: boolean;
  leftError?: string;
  rightError?: string;
  leftSheet: string;
  rightSheet: string;
  leftHeaderRow: number;
  rightHeaderRow: number;
  primaryLeft: number[];
  primaryRight: number[];
  secondaryLeft: number[];
  secondaryRight: number[];
  duplicatePolicy: DuplicateKeyPolicy;
  reconcile: NonNullable<ExcelComparePairOptions["reconcile"]>;
  unassignedFileCount: number;
}

export function assignPairFiles<T>(slots: { left?: T; right?: T }, files: readonly T[]) {
  let cursor = 0;
  const left = slots.left ?? files[cursor++];
  const right = slots.right ?? files[cursor++];
  const assignedCount = Math.min(files.length, Number(slots.left === undefined) + Number(slots.right === undefined));
  return {
    left,
    right,
    assignedCount,
    unassignedFiles: files.slice(assignedCount),
  };
}

export function swapPairSides(pair: PairState): PairState {
  return {
    ...pair,
    left: pair.right,
    right: pair.left,
    leftInspection: pair.rightInspection,
    rightInspection: pair.leftInspection,
    leftInspecting: pair.rightInspecting,
    rightInspecting: pair.leftInspecting,
    leftError: pair.rightError,
    rightError: pair.leftError,
    leftSheet: pair.rightSheet,
    rightSheet: pair.leftSheet,
    leftHeaderRow: pair.rightHeaderRow,
    rightHeaderRow: pair.leftHeaderRow,
    primaryLeft: pair.primaryRight,
    primaryRight: pair.primaryLeft,
    secondaryLeft: pair.secondaryRight,
    secondaryRight: pair.secondaryLeft,
    reconcile: {
      ...pair.reconcile,
      leftAmountColumn: pair.reconcile.rightAmountColumn,
      rightAmountColumn: pair.reconcile.leftAmountColumn,
      leftDateColumn: pair.reconcile.rightDateColumn,
      rightDateColumn: pair.reconcile.leftDateColumn,
      leftPartnerColumn: pair.reconcile.rightPartnerColumn,
      rightPartnerColumn: pair.reconcile.leftPartnerColumn,
    },
  };
}
