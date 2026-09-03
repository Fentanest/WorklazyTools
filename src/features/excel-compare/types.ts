import type { SpreadsheetInputFormat } from "../spreadsheet-core/inputAdapter.ts";

export type ExcelCompareMode = "position" | "key" | "reconcile";
export type DuplicateKeyPolicy = "secondary" | "occurrence" | "error";
export type FormulaComparisonMode = "formula" | "cached" | "both";
export type ExcelCompareStatus = "matched" | "changed" | "added" | "removed" | "duplicate" | "ambiguous" | "unmatched" | "error";

export interface ExcelCompareNormalizationOptions {
  trimWhitespace: boolean;
  collapseWhitespace: boolean;
  normalizeLineBreaks: boolean;
  ignoreCase: boolean;
  unicodeNfc: boolean;
  stripNumberSymbols: boolean;
  numericStrings: boolean;
  ignoreDateDisplayFormat: boolean;
  absoluteTolerance: number;
  relativeTolerance: number;
  blankEqualsEmpty: boolean;
  blankEqualsZero: boolean;
  formulaMode: FormulaComparisonMode;
  compareFormatting: boolean;
  compareDisplayValues: boolean;
}

export interface ExcelCompareSheetSelection {
  sheetName: string;
  headerRow: number;
}

export interface ExcelComparePairOptions {
  mode: ExcelCompareMode;
  left: ExcelCompareSheetSelection;
  right: ExcelCompareSheetSelection;
  normalization: ExcelCompareNormalizationOptions;
  key?: {
    leftColumns: number[];
    rightColumns: number[];
    secondaryLeftColumns: number[];
    secondaryRightColumns: number[];
    duplicatePolicy: DuplicateKeyPolicy;
  };
  reconcile?: {
    leftAmountColumn: number;
    rightAmountColumn: number;
    leftDateColumn: number;
    rightDateColumn: number;
    leftPartnerColumn: number;
    rightPartnerColumn: number;
    dateToleranceDays: number;
    allowGroupedMatches: boolean;
    roundingUnit: number;
  };
  alignmentCellBudget?: number;
}

export interface ExcelCompareRecord {
  status: ExcelCompareStatus;
  leftRow: number | null;
  rightRow: number | null;
  leftColumn: number | null;
  rightColumn: number | null;
  key: string;
  leftValue: string;
  rightValue: string;
  change: string;
  reason: string;
}

export interface ExcelCompareSummary {
  matched: number;
  changed: number;
  added: number;
  removed: number;
  duplicate: number;
  ambiguous: number;
  unmatched: number;
  error: number;
}

export interface ExcelComparePairResult {
  leftName: string;
  rightName: string;
  leftFormat: SpreadsheetInputFormat;
  rightFormat: SpreadsheetInputFormat;
  summary: ExcelCompareSummary;
  records: ExcelCompareRecord[];
  warnings: string[];
  reportBuffer: ArrayBuffer;
  reportName: string;
}

export interface ExcelCompareInspection {
  fileName: string;
  format: SpreadsheetInputFormat;
  supportsStyleComparison: boolean;
  sheets: Array<{
    name: string;
    rowCount: number;
    columnCount: number;
    headerRows: Array<{ row: number; values: string[] }>;
  }>;
}

export const DEFAULT_EXCEL_COMPARE_OPTIONS: ExcelCompareNormalizationOptions = {
  trimWhitespace: true,
  collapseWhitespace: false,
  normalizeLineBreaks: true,
  ignoreCase: false,
  unicodeNfc: true,
  stripNumberSymbols: false,
  numericStrings: false,
  ignoreDateDisplayFormat: true,
  absoluteTolerance: 0,
  relativeTolerance: 0,
  blankEqualsEmpty: true,
  blankEqualsZero: false,
  formulaMode: "both",
  compareFormatting: true,
  compareDisplayValues: true,
};
