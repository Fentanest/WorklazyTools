import type { SpreadsheetBookData, SpreadsheetCellData, SpreadsheetSheetData } from "../spreadsheet-core/inputAdapter.ts";
import { formulaNeedsValueDowngrade, transformFormulaReferences } from "./formulaTransform.ts";
import type { CleanerCell, CleanerColumn, CleanerRow, CleanerSheetModel, ExcelCleanerPipeline, ExcelCleanerSheetSelection } from "./types.ts";
import { EXCEL_CLEANER_HARD_CELL_LIMIT, EXCEL_CLEANER_SOFT_CELL_LIMIT } from "./types.ts";

export class ExcelCleanerError extends Error {
  readonly code: string;
  readonly details: string[];
  readonly ruleId?: string;

  constructor(code: string, details: string[] = [], ruleId?: string) {
    super(code);
    this.name = "ExcelCleanerError";
    this.code = code;
    this.details = details;
    this.ruleId = ruleId;
  }
}

export interface ExcelCleanerPreflight {
  downgradeFormulas: boolean;
  warnings: string[];
  missingFormulaCaches: string[];
  cellCount: number;
}

const STRUCTURAL_RULES = new Set([
  "trim-edge-empty", "remove-empty-rows", "remove-empty-columns", "collapse-consecutive-empty", "reorder-columns",
  "delete-columns", "combine-columns", "split-column", "add-constant-column", "add-row-number-column",
]);

export function preflightExcelCleaner(book: SpreadsheetBookData, selections: ExcelCleanerSheetSelection[], pipeline: ExcelCleanerPipeline): ExcelCleanerPreflight {
  if (!selections.length) throw new ExcelCleanerError("SHEET_REQUIRED");
  const sheets = selections.map((selection) => {
    const sheet = book.sheets.find((candidate) => candidate.name === selection.sheetName);
    if (!sheet || selection.headerRow < 1 || selection.headerRow > Math.max(1, sheet.rowCount)) throw new ExcelCleanerError("SHEET_NOT_FOUND", [selection.sheetName]);
    return { sheet, selection };
  });
  const cellCount = sheets.reduce((sum, { sheet }) => sum + sheet.rowCount * sheet.columnCount, 0);
  if (cellCount > EXCEL_CLEANER_HARD_CELL_LIMIT) throw new ExcelCleanerError("CELL_LIMIT_EXCEEDED", [String(cellCount)]);
  const formulaCells = sheets.flatMap(({ sheet }) => sheet.cells.filter((cell) => cell.formula).map((cell) => ({ sheet: sheet.name, cell })));
  const missingFormulaCaches = formulaCells.filter(({ cell }) => cell.cacheState !== "present").map(({ sheet, cell }) => `${sheet}!${cell.address}`);
  if (missingFormulaCaches.length) throw new ExcelCleanerError("FORMULA_CACHE_MISSING", missingFormulaCaches);

  const warnings: string[] = [];
  let downgradeFormulas = false;
  if (cellCount > EXCEL_CLEANER_SOFT_CELL_LIMIT) warnings.push("LARGE_FILE");
  if (formulaCells.length && book.format !== "xlsx" && book.format !== "xlsm") {
    downgradeFormulas = true;
    warnings.push("LEGACY_FORMULAS_TO_VALUES");
  }
  if (formulaCells.some(({ cell }) => cell.formulaType === "shared")) { downgradeFormulas = true; warnings.push("SHARED_FORMULAS_TO_VALUES"); }
  if (formulaCells.some(({ cell }) => cell.formulaType === "array")) { downgradeFormulas = true; warnings.push("ARRAY_FORMULAS_TO_VALUES"); }
  if (formulaCells.some(({ cell }) => formulaNeedsValueDowngrade(cell.formula!))) { downgradeFormulas = true; warnings.push("COMPLEX_FORMULAS_TO_VALUES"); }
  if (formulaCells.length && book.definedNames.length) { downgradeFormulas = true; warnings.push("DEFINED_NAMES_TO_VALUES"); }
  if (formulaCells.length && sheets.some(({ sheet }) => sheet.tables.length)) { downgradeFormulas = true; warnings.push("TABLE_FORMULAS_TO_VALUES"); }

  const firstUnmerge = pipeline.rules.findIndex((rule) => rule.type === "unmerge-cells" || rule.type === "unmerge-fill-down");
  const firstStructure = pipeline.rules.findIndex((rule) => STRUCTURAL_RULES.has(rule.type));
  if (sheets.some(({ sheet }) => sheet.merges.length) && firstStructure >= 0 && (firstUnmerge < 0 || firstStructure < firstUnmerge)) {
    throw new ExcelCleanerError("MERGE_RULE_ORDER", [], pipeline.rules[firstStructure].id);
  }
  return { downgradeFormulas, warnings: [...new Set(warnings)], missingFormulaCaches, cellCount };
}

export function createCleanerSheetModels(book: SpreadsheetBookData, selections: ExcelCleanerSheetSelection[], downgradeFormulas: boolean, options: { consumeSource?: boolean; unmergePlanned?: boolean } = {}) {
  const selected = selections.map((selection) => ({ selection, sheet: selectedSheet(book, selection.sheetName) }));
  const firstHeaders = headers(selected[0].sheet, selected[0].selection.headerRow);
  ensureUniqueHeaders(firstHeaders.map((item) => item.name), selected[0].sheet.name);
  const canonicalColumns: CleanerColumn[] = firstHeaders.map((header) => ({ id: `column:${header.column}`, name: header.name, sourceColumn: header.column }));
  validatePipelineColumnLineage(canonicalColumns, { version: 1, rules: [] });
  return selected.map(({ sheet, selection }) => {
    const model = projectSheet(sheet, selection.headerRow, canonicalColumns, downgradeFormulas, options.consumeSource ?? false, options.unmergePlanned ?? false);
    if (options.consumeSource) { sheet.cells.length = 0; sheet.rowLineage.length = 0; sheet.columnLineage.length = 0; }
    return model;
  });
}

export function validatePipelineColumnLineage(initialColumns: CleanerColumn[], pipeline: ExcelCleanerPipeline) {
  const columns = initialColumns.map((column) => column.id);
  const created = new Set<string>();
  const requireColumns = (ids: string[] | undefined, ruleId: string) => {
    for (const id of ids ?? columns) if (!columns.includes(id)) throw new ExcelCleanerError("COLUMN_ID_MISSING", [id], ruleId);
  };
  for (const rule of pipeline.rules) {
    switch (rule.type) {
      case "rename-column": requireColumns([rule.columnId], rule.id); break;
      case "reorder-columns":
        if (rule.order.length !== columns.length || new Set(rule.order).size !== columns.length || rule.order.some((id) => !columns.includes(id))) throw new ExcelCleanerError("COLUMN_ORDER_INVALID", [], rule.id);
        columns.splice(0, columns.length, ...rule.order);
        break;
      case "delete-columns": requireColumns(rule.columnIds, rule.id); rule.columnIds.forEach((id) => columns.splice(columns.indexOf(id), 1)); break;
      case "combine-columns": {
        requireColumns(rule.columnIds, rule.id);
        requireFresh(rule.outputColumnId, columns, created, rule.id);
        const index = Math.min(...rule.columnIds.map((id) => columns.indexOf(id)));
        if (rule.removeSources ?? true) rule.columnIds.forEach((id) => columns.splice(columns.indexOf(id), 1));
        columns.splice(Math.min(index, columns.length), 0, rule.outputColumnId);
        break;
      }
      case "split-column": {
        requireColumns([rule.columnId], rule.id);
        rule.outputColumnIds.forEach((id) => requireFresh(id, columns, created, rule.id));
        const index = columns.indexOf(rule.columnId);
        if (rule.removeSource ?? true) columns.splice(index, 1);
        columns.splice(index, 0, ...rule.outputColumnIds);
        break;
      }
      case "add-constant-column": case "add-row-number-column":
        requireFresh(rule.outputColumnId, columns, created, rule.id);
        columns.splice((rule.position ?? (rule.type === "add-row-number-column" ? "start" : "end")) === "start" ? 0 : columns.length, 0, rule.outputColumnId);
        break;
      case "trim-whitespace": case "collapse-spaces": case "normalize-newlines": case "remove-invisible-chars": case "normalize-unicode": case "find-replace": case "regex-replace": case "fill-empty-cells": case "convert-numeric-strings":
        requireColumns(rule.columnIds, rule.id); break;
      case "dedupe-by-columns": requireColumns([...rule.columnIds, ...(rule.dateColumnId ? [rule.dateColumnId] : [])], rule.id); break;
      case "filter-rows": requireColumns([rule.columnId], rule.id); break;
      case "unify-date-format": case "format-phone-number": case "format-business-number": requireColumns(rule.columnIds, rule.id); break;
      default: break;
    }
  }
  return columns;
}

function projectSheet(sheet: SpreadsheetSheetData, headerRow: number, canonicalColumns: CleanerColumn[], downgradeFormulas: boolean, consumeSource: boolean, unmergePlanned: boolean): CleanerSheetModel {
  const sheetHeaders = headers(sheet, headerRow);
  ensureUniqueHeaders(sheetHeaders.map((item) => item.name), sheet.name);
  const byName = new Map(sheetHeaders.map((header) => [header.name.normalize("NFC"), header.column]));
  if (byName.size !== canonicalColumns.length || canonicalColumns.some((column) => !byName.has(column.name.normalize("NFC")))) throw new ExcelCleanerError("HEADER_MISMATCH", [sheet.name]);
  const sourceToCanonical = Array.from({ length: sheet.columnCount + 1 }, () => null as number | null);
  canonicalColumns.forEach((column, index) => { sourceToCanonical[byName.get(column.name.normalize("NFC"))!] = index + 1; });
  const columnIdBySource = new Map(canonicalColumns.map((column) => [byName.get(column.name.normalize("NFC"))!, column.id]));
  const sourceRows = new Map<number, CleanerRow>();
  for (let row = headerRow + 1; row <= sheet.rowCount; row += 1) sourceRows.set(row, { id: `row:${row}`, sourceRow: row, cells: {} });
  sheet.cells.forEach((source) => {
    if (source.row <= headerRow) return;
    const columnId = columnIdBySource.get(source.column);
    const row = sourceRows.get(source.row);
    if (!columnId || !row) return;
    const cell = consumeSource ? consumeCell(source, downgradeFormulas) : cloneCell(source, downgradeFormulas);
    if (cell.formula && !cell.formulaDegraded) {
      const transformed = transformFormulaReferences(cell.formula, { columns: sourceToCanonical });
      if (transformed.degraded) cell.formulaDegraded = true;
      else cell.formula = transformed.formula;
    }
    row.cells[columnId] = cell;
  });
  const merges = unmergePlanned ? [...sheet.merges] : sheet.merges.map((range) => remapMergeRange(range, sourceToCanonical));
  return { name: sheet.name, headerRow, columns: canonicalColumns.map((column) => ({ ...column })), rows: [...sourceRows.values()], merges };
}

function consumeCell(source: SpreadsheetCellData, downgradeFormulas: boolean): CleanerCell {
  const cell = source as SpreadsheetCellData & CleanerCell;
  cell.formulaDegraded = source.formula ? downgradeFormulas : undefined;
  return cell;
}

function cloneCell(source: SpreadsheetCellData, downgradeFormulas: boolean): CleanerCell {
  return {
    value: cloneScalar(source.value), formula: source.formula, cachedValue: cloneScalar(source.cachedValue), cacheState: source.cacheState,
    formulaType: source.formulaType, formulaRef: source.formulaRef, sharedFormulaMaster: source.sharedFormulaMaster,
    numberFormat: source.numberFormat, style: source.style ? structuredClone(source.style) : undefined,
    sourceRow: source.sourceRow, sourceColumn: source.sourceColumn,
    formulaDegraded: source.formula ? downgradeFormulas : undefined,
  };
}

function cloneScalar<T>(value: T) { return value instanceof Date ? new Date(value) as T : value; }
function selectedSheet(book: SpreadsheetBookData, name: string) {
  const sheet = book.sheets.find((candidate) => candidate.name === name);
  if (!sheet) throw new ExcelCleanerError("SHEET_NOT_FOUND", [name]);
  return sheet;
}
function headers(sheet: SpreadsheetSheetData, headerRow: number) {
  const cells = new Map(sheet.cells.filter((cell) => cell.row === headerRow).map((cell) => [cell.column, cell]));
  return Array.from({ length: sheet.columnCount }, (_, index) => ({
    column: index + 1,
    name: String(cells.get(index + 1)?.displayValue ?? cells.get(index + 1)?.value ?? columnName(index + 1)).normalize("NFC"),
  }));
}
function ensureUniqueHeaders(values: string[], sheet: string) {
  if (new Set(values).size !== values.length) throw new ExcelCleanerError("DUPLICATE_HEADERS", [sheet]);
}
function requireFresh(id: string, columns: string[], created: Set<string>, ruleId: string) {
  if (columns.includes(id) || created.has(id)) throw new ExcelCleanerError("COLUMN_ID_DUPLICATE", [id], ruleId);
  created.add(id);
}
function columnName(column: number) {
  let value = column;
  let result = "";
  while (value > 0) { value -= 1; result = String.fromCharCode(65 + value % 26) + result; value = Math.floor(value / 26); }
  return result;
}
function remapMergeRange(value: string, columns: Array<number | null>) {
  const match = value.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/iu);
  if (!match) return value;
  const left = decodeColumn(match[1]);
  const right = decodeColumn(match[3]);
  const mapped = Array.from({ length: Math.abs(right - left) + 1 }, (_, index) => columns[Math.min(left, right) + index]).filter((column): column is number => column !== null && column !== undefined).sort((a, b) => a - b);
  if (!mapped.length || mapped.some((column, index) => index > 0 && column !== mapped[index - 1] + 1)) throw new ExcelCleanerError("MERGE_RULE_ORDER");
  return `${columnName(mapped[0])}${match[2]}:${columnName(mapped.at(-1)!)}${match[4]}`;
}
function decodeColumn(value: string) { return [...value.toUpperCase()].reduce((sum, character) => sum * 26 + character.charCodeAt(0) - 64, 0); }
