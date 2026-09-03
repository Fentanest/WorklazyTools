import type { SpreadsheetCellData, SpreadsheetInputFormat, SpreadsheetScalar } from "../spreadsheet-core/inputAdapter.ts";

export const EXCEL_CLEANER_RULE_TYPES = [
  "trim-edge-empty", "remove-empty-rows", "remove-empty-columns", "collapse-consecutive-empty",
  "unmerge-cells", "unmerge-fill-down", "rename-column", "reorder-columns", "delete-columns",
  "combine-columns", "split-column", "add-constant-column", "add-row-number-column",
  "trim-whitespace", "collapse-spaces", "normalize-newlines", "remove-invisible-chars", "normalize-unicode",
  "find-replace", "regex-replace", "dedupe-rows", "dedupe-by-columns", "filter-rows",
  "fill-empty-cells", "convert-numeric-strings", "unify-date-format", "format-phone-number",
  "format-business-number",
] as const;

export type ExcelCleanerRuleType = typeof EXCEL_CLEANER_RULE_TYPES[number];
export type ColumnTarget = { columnIds?: string[] };
export type ExcelCleanerRule =
  | Rule<"trim-edge-empty"> & { axis?: "rows" | "columns" | "both" }
  | Rule<"remove-empty-rows">
  | Rule<"remove-empty-columns">
  | Rule<"collapse-consecutive-empty"> & { axis: "rows" | "columns"; minRun: number }
  | Rule<"unmerge-cells">
  | Rule<"unmerge-fill-down">
  | Rule<"rename-column"> & { columnId: string; newName: string }
  | Rule<"reorder-columns"> & { order: string[] }
  | Rule<"delete-columns"> & { columnIds: string[] }
  | Rule<"combine-columns"> & { columnIds: string[]; separator?: string; outputColumnId: string; outputName: string; removeSources?: boolean }
  | Rule<"split-column"> & { columnId: string; mode: "delimiter" | "regex"; pattern: string; maxParts: number; outputColumnIds: string[]; outputNames: string[]; removeSource?: boolean }
  | Rule<"add-constant-column"> & { value: SpreadsheetScalar; outputColumnId: string; outputName: string; position?: "start" | "end" }
  | Rule<"add-row-number-column"> & { startAt?: number; outputColumnId: string; outputName: string; position?: "start" | "end" }
  | Rule<"trim-whitespace"> & ColumnTarget
  | Rule<"collapse-spaces"> & ColumnTarget
  | Rule<"normalize-newlines"> & ColumnTarget & { replaceWith?: "space" | "lf" | "remove" }
  | Rule<"remove-invisible-chars"> & ColumnTarget
  | Rule<"normalize-unicode"> & ColumnTarget
  | Rule<"find-replace"> & ColumnTarget & { find: string; replace?: string; caseSensitive?: boolean }
  | Rule<"regex-replace"> & ColumnTarget & { pattern: string; flags?: string; replace?: string }
  | Rule<"dedupe-rows">
  | Rule<"dedupe-by-columns"> & { columnIds: string[]; keep: "first" | "last" | "latest"; dateColumnId?: string }
  | Rule<"filter-rows"> & { mode: "keep" | "delete"; columnId: string; operator: FilterOperator; value?: SpreadsheetScalar; caseSensitive?: boolean }
  | Rule<"fill-empty-cells"> & ColumnTarget & { source: "above" | "constant"; value?: SpreadsheetScalar }
  | Rule<"convert-numeric-strings"> & ColumnTarget
  | Rule<"unify-date-format"> & { columnIds: string[]; outputFormat: ExcelCleanerDateFormat; inputHint?: "auto" | "serial" | "text" }
  | Rule<"format-phone-number"> & { columnIds: string[]; style?: "dash" | "none" }
  | Rule<"format-business-number"> & { columnIds: string[]; style?: "dash" | "none" };

export type Rule<T extends ExcelCleanerRuleType> = { type: T; id: string };
export type FilterOperator = "equals" | "contains" | "regex" | "empty" | "number-gt" | "number-gte" | "number-lt" | "number-lte" | "number-eq";
export type ExcelCleanerDateFormat = "yyyy-mm-dd" | "yyyy.mm.dd" | "yyyy/mm/dd" | "yyyymmdd" | "mm/dd/yyyy" | "dd/mm/yyyy" | "yyyy-mm-dd hh:mm" | "yyyy-mm-dd hh:mm:ss";

export interface ExcelCleanerPipeline {
  version: 1;
  rules: ExcelCleanerRule[];
}

export interface ExcelCleanerSheetSelection {
  sheetName: string;
  headerRow: number;
}

export interface ExcelCleanerOptions {
  selections: ExcelCleanerSheetSelection[];
  pipeline: ExcelCleanerPipeline;
  output: "xlsx" | "csv" | "both";
  csvSafeMode: boolean;
  confirmFormulaDowngrade: boolean;
  previewRows?: number;
}

export interface ExcelCleanerInspection {
  fileName: string;
  format: SpreadsheetInputFormat;
  cellCount: number;
  softLimitExceeded: boolean;
  hardLimitExceeded: boolean;
  sheets: Array<{ name: string; rowCount: number; columnCount: number; headerRows: Array<{ row: number; values: string[] }> }>;
}

export interface CleanerCell extends Pick<SpreadsheetCellData,
  "value" | "formula" | "cachedValue" | "cacheState" | "formulaType" | "formulaRef" | "sharedFormulaMaster" | "numberFormat" | "style"
> {
  sourceRow?: number;
  sourceColumn?: number;
  formulaDegraded?: boolean;
}

export interface CleanerColumn {
  id: string;
  name: string;
  sourceColumn?: number;
}

export interface CleanerRow {
  id: string;
  sourceRow?: number;
  cells: Record<string, CleanerCell>;
}

export interface CleanerSheetModel {
  name: string;
  headerRow: number;
  columns: CleanerColumn[];
  rows: CleanerRow[];
  merges: string[];
}

export interface ExcelCleanerRuleStats {
  ruleId: string;
  type: ExcelCleanerRuleType;
  changedCells: number;
  deletedRows: number;
  deletedColumns: number;
  duplicates: number;
  conversionFailures: number;
  excludedRows: number;
}

export interface ExcelCleanerIssueRow {
  sheet: string;
  ruleId: string;
  ruleType: ExcelCleanerRuleType | "preflight";
  sourceRow: number | null;
  address?: string;
  reason: string;
  values: string;
}

export interface ExcelCleanerPreviewStage {
  ruleId: string;
  type: ExcelCleanerRuleType;
  sample: string[][];
  stats: ExcelCleanerRuleStats;
}

export interface ExcelCleanerSummary {
  sheetCount: number;
  inputRows: number;
  outputRows: number;
  inputColumns: number;
  outputColumns: number;
  changedCells: number;
  deletedRows: number;
  deletedColumns: number;
  duplicates: number;
  conversionFailures: number;
  excludedRows: number;
  errorRowsTruncated: number;
  excludedRowsTruncated: number;
}

export interface ExcelCleanerOutput {
  kind: "xlsx" | "csv";
  sheetName?: string;
  suggestedName: string;
  buffer: ArrayBuffer;
  byteLength: number;
  csvRiskCount?: number;
}

export interface ExcelCleanerResult {
  fileName: string;
  format: SpreadsheetInputFormat;
  warnings: string[];
  summary: ExcelCleanerSummary;
  stages: ExcelCleanerPreviewStage[];
  outputs: ExcelCleanerOutput[];
}

export interface ExcelCleanerEngineResult {
  sheets: CleanerSheetModel[];
  warnings: string[];
  summary: ExcelCleanerSummary;
  stages: ExcelCleanerPreviewStage[];
  ruleStats: ExcelCleanerRuleStats[];
  errors: ExcelCleanerIssueRow[];
  excluded: ExcelCleanerIssueRow[];
}

export const EXCEL_CLEANER_SOFT_CELL_LIMIT = 2_000_000;
export const EXCEL_CLEANER_HARD_CELL_LIMIT = 10_000_000;
export const EXCEL_CLEANER_REPORT_ROW_LIMIT = 100_000;
export const EXCEL_CLEANER_MAX_JSON_BYTES = 256 * 1024;
export const EXCEL_CLEANER_MAX_RULES = 100;
