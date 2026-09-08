import type { ExcelCompareInspection, ExcelComparePairOptions, DuplicateKeyPolicy } from "./types.ts";

export type HeaderSelectionSource = "suggested" | "manual" | "fallback";

export interface HeaderSelection {
  row: number;
  source: HeaderSelectionSource;
}

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
  leftHeaderInput: string;
  rightHeaderInput: string;
  leftHeaderSelections: Record<string, HeaderSelection>;
  rightHeaderSelections: Record<string, HeaderSelection>;
  leftHeaderAnnouncement?: HeaderSelection;
  rightHeaderAnnouncement?: HeaderSelection;
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
    leftHeaderInput: pair.rightHeaderInput,
    rightHeaderInput: pair.leftHeaderInput,
    leftHeaderSelections: pair.rightHeaderSelections,
    rightHeaderSelections: pair.leftHeaderSelections,
    leftHeaderAnnouncement: pair.rightHeaderAnnouncement,
    rightHeaderAnnouncement: pair.leftHeaderAnnouncement,
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

export function headerSelectionsFromInspection(inspection: ExcelCompareInspection) {
  return Object.fromEntries(inspection.sheets.map((sheet) => [sheet.name, suggestedSelection(sheet)]));
}

export function applyInitialInspection(pair: PairState, side: "left" | "right", inspection: ExcelCompareInspection): PairState {
  const selections = headerSelectionsFromInspection(inspection);
  const sheetName = inspection.sheets[0]?.name ?? "";
  const selection = selections[sheetName] ?? { row: 1, source: "fallback" as const };
  if (side === "left") {
    return {
      ...pair,
      leftInspection: inspection,
      leftError: undefined,
      leftSheet: sheetName,
      leftHeaderRow: selection.row,
      leftHeaderInput: String(selection.row),
      leftHeaderSelections: selections,
      leftHeaderAnnouncement: selection,
    };
  }
  return {
    ...pair,
    rightInspection: inspection,
    rightError: undefined,
    rightSheet: sheetName,
    rightHeaderRow: selection.row,
    rightHeaderInput: String(selection.row),
    rightHeaderSelections: selections,
    rightHeaderAnnouncement: selection,
  };
}

export function selectPairSheet(pair: PairState, side: "left" | "right", sheetName: string): PairState {
  const selections = side === "left" ? pair.leftHeaderSelections : pair.rightHeaderSelections;
  const inspection = side === "left" ? pair.leftInspection : pair.rightInspection;
  const sheet = inspection?.sheets.find((candidate) => candidate.name === sheetName);
  const selection = selections[sheetName] ?? (sheet ? suggestedSelection(sheet) : { row: 1, source: "fallback" as const });
  if (side === "left") return { ...pair, leftSheet: sheetName, leftHeaderRow: selection.row, leftHeaderInput: String(selection.row) };
  return { ...pair, rightSheet: sheetName, rightHeaderRow: selection.row, rightHeaderInput: String(selection.row) };
}

export function selectManualHeader(pair: PairState, side: "left" | "right", row: number): PairState {
  const selection: HeaderSelection = { row, source: "manual" };
  if (side === "left") {
    return {
      ...pair,
      leftHeaderRow: row,
      leftHeaderInput: String(row),
      leftHeaderSelections: { ...pair.leftHeaderSelections, [pair.leftSheet]: selection },
      leftHeaderAnnouncement: undefined,
    };
  }
  return {
    ...pair,
    rightHeaderRow: row,
    rightHeaderInput: String(row),
    rightHeaderSelections: { ...pair.rightHeaderSelections, [pair.rightSheet]: selection },
    rightHeaderAnnouncement: undefined,
  };
}

export function mergeExcelCompareInspection(current: ExcelCompareInspection, incoming: ExcelCompareInspection): ExcelCompareInspection {
  const incomingByName = new Map(incoming.sheets.map((sheet) => [sheet.name, sheet]));
  return {
    ...current,
    sheets: current.sheets.map((sheet) => {
      const next = incomingByName.get(sheet.name);
      if (!next) return sheet;
      const rows = new Map(sheet.headerRows.map((header) => [header.row, header]));
      next.headerRows.forEach((header) => rows.set(header.row, header));
      return {
        ...next,
        headerRows: [...rows.values()],
        ...(sheet.headerSuggestion ? { headerSuggestion: sheet.headerSuggestion } : {}),
      };
    }),
  };
}

function suggestedSelection(sheet: ExcelCompareInspection["sheets"][number]): HeaderSelection {
  return sheet.headerSuggestion?.reason === "suggested" && sheet.headerSuggestion.row !== null
    ? { row: sheet.headerSuggestion.row, source: "suggested" }
    : { row: 1, source: "fallback" };
}
