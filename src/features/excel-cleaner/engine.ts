import { transformFormulaReferences, type FormulaCoordinateTransform } from "./formulaTransform.ts";
import { ExcelCleanerError, validatePipelineColumnLineage } from "./model.ts";
import type { SpreadsheetScalar } from "../spreadsheet-core/inputAdapter.ts";
import {
  EXCEL_CLEANER_REPORT_ROW_LIMIT,
  type CleanerCell,
  type CleanerColumn,
  type CleanerRow,
  type CleanerSheetModel,
  type ExcelCleanerEngineResult,
  type ExcelCleanerIssueRow,
  type ExcelCleanerPipeline,
  type ExcelCleanerPreviewStage,
  type ExcelCleanerRule,
  type ExcelCleanerRuleStats,
  type ExcelCleanerSummary,
} from "./types.ts";

export interface ExcelCleanerEngineOptions {
  previewRows?: number;
  date1904?: boolean;
  onRuleStart?: (rule: ExcelCleanerRule, index: number, count: number) => void;
  onProgress?: (rule: ExcelCleanerRule, index: number, count: number) => void;
}

interface IssueBuffers {
  errors: ExcelCleanerIssueRow[];
  excluded: ExcelCleanerIssueRow[];
  errorTruncated: number;
  excludedTruncated: number;
}

export function runExcelCleanerPipeline(sheets: CleanerSheetModel[], pipeline: ExcelCleanerPipeline, options: ExcelCleanerEngineOptions = {}): ExcelCleanerEngineResult {
  if (!sheets.length) throw new ExcelCleanerError("SHEET_REQUIRED");
  validatePipelineColumnLineage(sheets[0].columns, pipeline);
  for (const sheet of sheets.slice(1)) validatePipelineColumnLineage(sheet.columns, pipeline);
  const previewRows = Math.min(100, Math.max(1, options.previewRows ?? 20));
  const issues: IssueBuffers = { errors: [], excluded: [], errorTruncated: 0, excludedTruncated: 0 };
  const initial = dimensions(sheets);
  const ruleStats: ExcelCleanerRuleStats[] = [];
  const stages: ExcelCleanerPreviewStage[] = [];

  pipeline.rules.forEach((rule, index) => {
    options.onRuleStart?.(rule, index, pipeline.rules.length);
    const combined = emptyStats(rule);
    sheets.forEach((sheet) => addStats(combined, applyRule(sheet, rule, issues, options.date1904 ?? false)));
    ruleStats.push(combined);
    stages.push({ ruleId: rule.id, type: rule.type, stats: { ...combined }, sample: sampleSheets(sheets, previewRows) });
    options.onProgress?.(rule, index, pipeline.rules.length);
  });

  const final = dimensions(sheets);
  const summary: ExcelCleanerSummary = {
    sheetCount: sheets.length,
    inputRows: initial.rows,
    outputRows: final.rows,
    inputColumns: initial.columns,
    outputColumns: final.columns,
    changedCells: sum(ruleStats, "changedCells"),
    deletedRows: sum(ruleStats, "deletedRows"),
    deletedColumns: sum(ruleStats, "deletedColumns"),
    duplicates: sum(ruleStats, "duplicates"),
    conversionFailures: sum(ruleStats, "conversionFailures"),
    excludedRows: sum(ruleStats, "excludedRows"),
    errorRowsTruncated: issues.errorTruncated,
    excludedRowsTruncated: issues.excludedTruncated,
  };
  return { sheets, warnings: [], summary, stages, ruleStats, errors: issues.errors, excluded: issues.excluded };
}

function applyRule(sheet: CleanerSheetModel, rule: ExcelCleanerRule, issues: IssueBuffers, date1904: boolean): ExcelCleanerRuleStats {
  const stats = emptyStats(rule);
  switch (rule.type) {
    case "trim-edge-empty": trimEdges(sheet, rule.axis ?? "both", stats, issues, rule); break;
    case "remove-empty-rows": removeRows(sheet, (_row) => rowEmpty(_row, sheet.columns), stats, issues, rule); break;
    case "remove-empty-columns": removeColumns(sheet, (column) => columnEmpty(column.id, sheet.rows), stats, issues, rule); break;
    case "collapse-consecutive-empty": collapseEmpty(sheet, rule.axis, rule.minRun, stats, issues, rule); break;
    case "unmerge-cells": sheet.merges = []; break;
    case "unmerge-fill-down": unmergeFill(sheet, stats); break;
    case "rename-column": sheet.columns.find((column) => column.id === rule.columnId)!.name = rule.newName; break;
    case "reorder-columns": mutateColumns(sheet, rule.order.map((id) => sheet.columns.find((column) => column.id === id)!), stats, issues, rule); break;
    case "delete-columns": removeColumns(sheet, (column) => rule.columnIds.includes(column.id), stats, issues, rule); break;
    case "combine-columns": combineColumns(sheet, rule, stats, issues); break;
    case "split-column": splitColumn(sheet, rule, stats, issues); break;
    case "add-constant-column": addColumn(sheet, { id: rule.outputColumnId, name: rule.outputName }, rule.position ?? "end", (row) => cell(rule.value), stats, issues, rule); break;
    case "add-row-number-column": addColumn(sheet, { id: rule.outputColumnId, name: rule.outputName }, rule.position ?? "start", (_row, index) => cell((rule.startAt ?? 1) + index), stats, issues, rule); break;
    case "trim-whitespace": transformText(sheet, rule.columnIds, (value) => value.trim(), stats); break;
    case "collapse-spaces": transformText(sheet, rule.columnIds, (value) => value.replace(/[ \t]+/gu, " "), stats); break;
    case "normalize-newlines": {
      const replacement = (rule.replaceWith ?? "space") === "lf" ? "\n" : (rule.replaceWith ?? "space") === "remove" ? "" : " ";
      transformText(sheet, rule.columnIds, (value) => value.replace(/\r\n?|\n/gu, replacement), stats);
      break;
    }
    case "remove-invisible-chars": transformText(sheet, rule.columnIds, (value) => value.replace(/\u00a0/gu, " ").replace(/[\u200b-\u200d\ufeff]/gu, ""), stats); break;
    case "normalize-unicode": transformText(sheet, rule.columnIds, (value) => value.normalize("NFC"), stats); break;
    case "find-replace": {
      const expression = new RegExp(escapeRegex(rule.find), rule.caseSensitive ?? true ? "g" : "gi");
      transformText(sheet, rule.columnIds, (value) => value.replace(expression, rule.replace ?? ""), stats);
      break;
    }
    case "regex-replace": {
      const expression = new RegExp(rule.pattern, rule.flags ?? "g");
      transformText(sheet, rule.columnIds, (value) => { expression.lastIndex = 0; return value.replace(expression, rule.replace ?? ""); }, stats);
      break;
    }
    case "dedupe-rows": dedupe(sheet, sheet.columns.map((column) => column.id), "first", undefined, stats, issues, rule); break;
    case "dedupe-by-columns": dedupe(sheet, rule.columnIds, rule.keep, rule.dateColumnId, stats, issues, rule); break;
    case "filter-rows": filterRows(sheet, rule, stats, issues); break;
    case "fill-empty-cells": fillEmpty(sheet, rule.columnIds, rule.source, rule.value, stats); break;
    case "convert-numeric-strings": convertNumbers(sheet, rule.columnIds, stats, issues, rule); break;
    case "unify-date-format": unifyDates(sheet, rule.columnIds, rule.outputFormat, rule.inputHint ?? "auto", date1904, stats, issues, rule); break;
    case "format-phone-number": formatIdentifiers(sheet, rule.columnIds, "phone", rule.style ?? "dash", stats, issues, rule); break;
    case "format-business-number": formatIdentifiers(sheet, rule.columnIds, "business", rule.style ?? "dash", stats, issues, rule); break;
  }
  return stats;
}

function trimEdges(sheet: CleanerSheetModel, axis: "rows" | "columns" | "both", stats: ExcelCleanerRuleStats, issues: IssueBuffers, rule: ExcelCleanerRule) {
  if (axis === "rows" || axis === "both") {
    let start = 0; let end = sheet.rows.length;
    while (start < end && rowEmpty(sheet.rows[start], sheet.columns)) start += 1;
    while (end > start && rowEmpty(sheet.rows[end - 1], sheet.columns)) end -= 1;
    const keep = new Set(sheet.rows.slice(start, end).map((row) => row.id));
    removeRows(sheet, (row) => !keep.has(row.id), stats, issues, rule);
  }
  if (axis === "columns" || axis === "both") {
    let start = 0; let end = sheet.columns.length;
    while (start < end && columnEmpty(sheet.columns[start].id, sheet.rows)) start += 1;
    while (end > start && columnEmpty(sheet.columns[end - 1].id, sheet.rows)) end -= 1;
    const keep = new Set(sheet.columns.slice(start, end).map((column) => column.id));
    removeColumns(sheet, (column) => !keep.has(column.id), stats, issues, rule);
  }
}

function collapseEmpty(sheet: CleanerSheetModel, axis: "rows" | "columns", minRun: number, stats: ExcelCleanerRuleStats, issues: IssueBuffers, rule: ExcelCleanerRule) {
  if (axis === "rows") {
    const remove = collapsedIndexes(sheet.rows.map((row) => rowEmpty(row, sheet.columns)), minRun);
    removeRows(sheet, (_row, index) => remove.has(index), stats, issues, rule);
  } else {
    const remove = collapsedIndexes(sheet.columns.map((column) => columnEmpty(column.id, sheet.rows)), minRun);
    removeColumns(sheet, (_column, index) => remove.has(index), stats, issues, rule);
  }
}

function collapsedIndexes(empty: boolean[], minRun: number) {
  const remove = new Set<number>();
  for (let start = 0; start < empty.length;) {
    if (!empty[start]) { start += 1; continue; }
    let end = start + 1;
    while (end < empty.length && empty[end]) end += 1;
    if (end - start >= minRun) for (let index = start + 1; index < end; index += 1) remove.add(index);
    start = end;
  }
  return remove;
}

function removeRows(sheet: CleanerSheetModel, predicate: (row: CleanerRow, index: number) => boolean, stats: ExcelCleanerRuleStats, issues: IssueBuffers, rule: ExcelCleanerRule) {
  const before = [...sheet.rows];
  const removed = before.filter(predicate);
  if (!removed.length) return;
  const removedIds = new Set(removed.map((row) => row.id));
  sheet.rows = before.filter((row) => !removedIds.has(row.id));
  stats.deletedRows += removed.length;
  applyFormulaTransform(sheet, rowTransform(before, sheet.rows, sheet.headerRow), issues, rule);
}

function removeColumns(sheet: CleanerSheetModel, predicate: (column: CleanerColumn, index: number) => boolean, stats: ExcelCleanerRuleStats, issues: IssueBuffers, rule: ExcelCleanerRule) {
  const next = sheet.columns.filter((column, index) => !predicate(column, index));
  mutateColumns(sheet, next, stats, issues, rule);
}

function mutateColumns(sheet: CleanerSheetModel, next: CleanerColumn[], stats: ExcelCleanerRuleStats, issues: IssueBuffers, rule: ExcelCleanerRule) {
  const before = [...sheet.columns];
  const nextIds = new Set(next.map((column) => column.id));
  const deleted = before.filter((column) => !nextIds.has(column.id));
  sheet.columns = next;
  deleted.forEach((column) => sheet.rows.forEach((row) => { delete row.cells[column.id]; }));
  stats.deletedColumns += deleted.length;
  applyFormulaTransform(sheet, columnTransform(before, next), issues, rule);
}

function combineColumns(sheet: CleanerSheetModel, rule: Extract<ExcelCleanerRule, { type: "combine-columns" }>, stats: ExcelCleanerRuleStats, issues: IssueBuffers) {
  const before = [...sheet.columns];
  const sourceSet = new Set(rule.columnIds);
  const insertion = Math.min(...rule.columnIds.map((id) => before.findIndex((column) => column.id === id)));
  const output: CleanerColumn = { id: rule.outputColumnId, name: rule.outputName };
  const next = (rule.removeSources ?? true) ? before.filter((column) => !sourceSet.has(column.id)) : [...before];
  next.splice(Math.min(insertion, next.length), 0, output);
  sheet.rows.forEach((row) => {
    row.cells[rule.outputColumnId] = cell(rule.columnIds.map((id) => scalarText(decisionValue(row.cells[id]))).join(rule.separator ?? ""));
    stats.changedCells += 1;
    if (rule.removeSources ?? true) rule.columnIds.forEach((id) => { delete row.cells[id]; });
  });
  sheet.columns = next;
  if (rule.removeSources ?? true) stats.deletedColumns += rule.columnIds.length;
  applyFormulaTransform(sheet, columnTransform(before, next, true), issues, rule);
}

function splitColumn(sheet: CleanerSheetModel, rule: Extract<ExcelCleanerRule, { type: "split-column" }>, stats: ExcelCleanerRuleStats, issues: IssueBuffers) {
  const before = [...sheet.columns];
  const sourceIndex = before.findIndex((column) => column.id === rule.columnId);
  const next = (rule.removeSource ?? true) ? before.filter((column) => column.id !== rule.columnId) : [...before];
  next.splice(sourceIndex, 0, ...rule.outputColumnIds.map((id, index) => ({ id, name: rule.outputNames[index] })));
  const expression = rule.mode === "regex" ? new RegExp(rule.pattern) : undefined;
  sheet.rows.forEach((row) => {
    if (expression) expression.lastIndex = 0;
    const pieces = splitBounded(scalarText(decisionValue(row.cells[rule.columnId])), rule.mode === "regex" ? expression! : rule.pattern, rule.maxParts);
    rule.outputColumnIds.forEach((id, index) => { row.cells[id] = cell(pieces[index] ?? ""); stats.changedCells += 1; });
    if (rule.removeSource ?? true) delete row.cells[rule.columnId];
  });
  sheet.columns = next;
  if (rule.removeSource ?? true) stats.deletedColumns += 1;
  applyFormulaTransform(sheet, columnTransform(before, next, true), issues, rule);
}

function addColumn(sheet: CleanerSheetModel, column: CleanerColumn, position: "start" | "end", create: (row: CleanerRow, index: number) => CleanerCell, stats: ExcelCleanerRuleStats, issues: IssueBuffers, rule: ExcelCleanerRule) {
  const before = [...sheet.columns];
  sheet.columns = position === "start" ? [column, ...before] : [...before, column];
  sheet.rows.forEach((row, index) => { row.cells[column.id] = create(row, index); stats.changedCells += 1; });
  applyFormulaTransform(sheet, columnTransform(before, sheet.columns, true), issues, rule);
}

function unmergeFill(sheet: CleanerSheetModel, stats: ExcelCleanerRuleStats) {
  const snapshots = sheet.merges.map((range) => {
    const parsed = parseRange(range);
    if (!parsed) return undefined;
    const row = sheet.rows.find((candidate) => candidate.sourceRow === parsed.top);
    const column = sheet.columns.find((candidate) => candidate.sourceColumn === parsed.left);
    const master = row && column ? cloneCell(row.cells[column.id]) : cell("");
    return { ...parsed, master };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));
  snapshots.forEach(({ top, bottom, left, right, master }) => {
    for (let rowNumber = top; rowNumber <= bottom; rowNumber += 1) {
      const row = sheet.rows.find((candidate) => candidate.sourceRow === rowNumber);
      if (!row) continue;
      for (let columnNumber = left; columnNumber <= right; columnNumber += 1) {
        const column = sheet.columns.find((candidate) => candidate.sourceColumn === columnNumber);
        if (!column) continue;
        row.cells[column.id] = cloneCell(master);
        stats.changedCells += 1;
      }
    }
  });
  sheet.merges = [];
}

function transformText(sheet: CleanerSheetModel, ids: string[] | undefined, transform: (value: string) => string, stats: ExcelCleanerRuleStats) {
  forCells(sheet, ids, (current) => {
    if (current.formula || typeof current.value !== "string") return;
    const next = transform(current.value);
    if (next !== current.value) { current.value = next; stats.changedCells += 1; }
  });
}

function dedupe(sheet: CleanerSheetModel, ids: string[], keep: "first" | "last" | "latest", dateId: string | undefined, stats: ExcelCleanerRuleStats, issues: IssueBuffers, rule: ExcelCleanerRule) {
  const selected = new Map<string, number>();
  sheet.rows.forEach((row, index) => {
    const key = ids.map((id) => identity(decisionValue(row.cells[id]))).join("\u001f");
    const existing = selected.get(key);
    if (existing === undefined) { selected.set(key, index); return; }
    if (keep === "last") selected.set(key, index);
    if (keep === "latest" && dateRank(decisionValue(row.cells[dateId!])) > dateRank(decisionValue(sheet.rows[existing].cells[dateId!]))) selected.set(key, index);
  });
  const retained = new Set(selected.values());
  const removedIndexes = new Set<number>();
  sheet.rows.forEach((row, index) => {
    const key = ids.map((id) => identity(decisionValue(row.cells[id]))).join("\u001f");
    if (retained.has(index) || !selected.has(key)) return;
    removedIndexes.add(index);
    stats.duplicates += 1;
    stats.excludedRows += 1;
    pushIssue(issues, "excluded", issue(sheet, row, rule, "DUPLICATE"));
  });
  removeRows(sheet, (_row, index) => removedIndexes.has(index), stats, issues, rule);
}

function filterRows(sheet: CleanerSheetModel, rule: Extract<ExcelCleanerRule, { type: "filter-rows" }>, stats: ExcelCleanerRuleStats, issues: IssueBuffers) {
  const expression = rule.operator === "regex" ? new RegExp(String(rule.value ?? ""), rule.caseSensitive ?? true ? "" : "i") : undefined;
  const remove = new Set<number>();
  sheet.rows.forEach((row, index) => {
    if (expression) expression.lastIndex = 0;
    const matched = filterMatch(decisionValue(row.cells[rule.columnId]), rule.operator, rule.value, rule.caseSensitive ?? true, expression);
    if ((rule.mode === "keep" && !matched) || (rule.mode === "delete" && matched)) {
      remove.add(index);
      stats.excludedRows += 1;
      pushIssue(issues, "excluded", issue(sheet, row, rule, "FILTERED"));
    }
  });
  removeRows(sheet, (_row, index) => remove.has(index), stats, issues, rule);
}

function fillEmpty(sheet: CleanerSheetModel, ids: string[] | undefined, source: "above" | "constant", value: SpreadsheetScalar | undefined, stats: ExcelCleanerRuleStats) {
  for (const id of ids ?? sheet.columns.map((column) => column.id)) {
    let above: CleanerCell | undefined;
    sheet.rows.forEach((row) => {
      const current = row.cells[id];
      if (!isEmpty(decisionValue(current))) { above = current; return; }
      const replacement = source === "above" ? above && cloneCell(above) : cell(value ?? null);
      if (!replacement) return;
      row.cells[id] = replacement;
      stats.changedCells += 1;
    });
  }
}

function convertNumbers(sheet: CleanerSheetModel, ids: string[] | undefined, stats: ExcelCleanerRuleStats, issues: IssueBuffers, rule: ExcelCleanerRule) {
  forCells(sheet, ids, (current, row) => {
    if (current.formula || typeof current.value !== "string" || current.numberFormat === "@") return;
    const raw = current.value.trim();
    if (!raw || /^[-+]?0\d+/u.test(raw) || !/^[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:[eE][-+]?\d+)?$/u.test(raw)) return;
    const number = Number(raw.replace(/,/gu, ""));
    if (!Number.isFinite(number)) { conversionFailure(sheet, row, rule, current, stats, issues); return; }
    current.value = number;
    stats.changedCells += 1;
  });
}

function unifyDates(sheet: CleanerSheetModel, ids: string[], outputFormat: string, inputHint: "auto" | "serial" | "text", date1904: boolean, stats: ExcelCleanerRuleStats, issues: IssueBuffers, rule: ExcelCleanerRule) {
  forCells(sheet, ids, (current, row) => {
    if (current.formula || isEmpty(current.value)) return;
    const parsed = parseDate(current.value, inputHint, date1904);
    if (!parsed) { conversionFailure(sheet, row, rule, current, stats, issues); return; }
    current.value = parsed;
    current.numberFormat = outputFormat;
    stats.changedCells += 1;
  });
}

function formatIdentifiers(sheet: CleanerSheetModel, ids: string[], kind: "phone" | "business", style: "dash" | "none", stats: ExcelCleanerRuleStats, issues: IssueBuffers, rule: ExcelCleanerRule) {
  forCells(sheet, ids, (current, row) => {
    if (current.formula || isEmpty(current.value)) return;
    const digits = scalarText(current.value).replace(/[^0-9]/gu, "");
    let next: string | undefined;
    if (kind === "business" && digits.length === 10) next = style === "dash" ? `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}` : digits;
    if (kind === "phone" && /^0\d{8,10}$/u.test(digits)) next = style === "none" ? digits : phoneWithDashes(digits);
    if (!next) { conversionFailure(sheet, row, rule, current, stats, issues); return; }
    if (next !== current.value) { current.value = next; current.numberFormat = "@"; stats.changedCells += 1; }
  });
}

function applyFormulaTransform(sheet: CleanerSheetModel, transform: FormulaCoordinateTransform, issues: IssueBuffers, rule: ExcelCleanerRule) {
  sheet.rows.forEach((row) => sheet.columns.forEach((column) => {
    const current = row.cells[column.id];
    if (!current?.formula || current.formulaDegraded) return;
    const transformed = transformFormulaReferences(current.formula, transform);
    if (transformed.degraded) {
      current.formulaDegraded = true;
      pushIssue(issues, "errors", issue(sheet, row, rule, transformed.reason ?? "FORMULA_DEGRADED", column.id));
    } else current.formula = transformed.formula;
  }));
}

function rowTransform(before: CleanerRow[], after: CleanerRow[], headerRow: number) {
  const map = Array.from({ length: headerRow + before.length + 1 }, (_, index) => index) as Array<number | null>;
  const position = new Map(after.map((row, index) => [row.id, headerRow + index + 1]));
  before.forEach((row, index) => { map[headerRow + index + 1] = position.get(row.id) ?? null; });
  return { rows: map };
}

function columnTransform(before: CleanerColumn[], after: CleanerColumn[], expandInsertedColumns = false) {
  const positions = new Map(after.map((column, index) => [column.id, index + 1]));
  const columns = Array.from({ length: before.length + 1 }, () => null as number | null);
  before.forEach((column, index) => { columns[index + 1] = positions.get(column.id) ?? null; });
  return { columns, expandInsertedColumns };
}

function filterMatch(current: SpreadsheetScalar | undefined, operator: string, expected: SpreadsheetScalar | undefined, caseSensitive: boolean, expression?: RegExp) {
  if (operator === "empty") return isEmpty(current);
  const left = scalarText(current);
  const right = scalarText(expected);
  if (operator === "equals") return caseSensitive ? left === right : left.toLocaleLowerCase() === right.toLocaleLowerCase();
  if (operator === "contains") return caseSensitive ? left.includes(right) : left.toLocaleLowerCase().includes(right.toLocaleLowerCase());
  if (operator === "regex") return expression!.test(left);
  const leftNumber = Number(left); const rightNumber = Number(right);
  if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) return false;
  if (operator === "number-gt") return leftNumber > rightNumber;
  if (operator === "number-gte") return leftNumber >= rightNumber;
  if (operator === "number-lt") return leftNumber < rightNumber;
  if (operator === "number-lte") return leftNumber <= rightNumber;
  return leftNumber === rightNumber;
}

function parseDate(value: SpreadsheetScalar, hint: "auto" | "serial" | "text", date1904: boolean) {
  if (value instanceof Date && hint !== "serial" && !Number.isNaN(value.getTime())) return new Date(value);
  if (typeof value === "number" && hint !== "text") {
    const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
    const result = new Date(epoch + value * 86_400_000);
    return Number.isNaN(result.getTime()) ? undefined : result;
  }
  if (typeof value !== "string" || hint === "serial") return undefined;
  const normalized = value.trim().replace(/[./]/gu, "-");
  const compact = normalized.match(/^(\d{4})(\d{2})(\d{2})$/u);
  const parsed = new Date(compact ? `${compact[1]}-${compact[2]}-${compact[3]}T00:00:00Z` : normalized);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function splitBounded(value: string, separator: string | RegExp, count: number) {
  if (count === 1) return [value];
  const pieces: string[] = [];
  let start = 0;
  if (typeof separator === "string") {
    if (!separator) return [...value].slice(0, count - 1).concat([...value].slice(count - 1).join(""));
    while (pieces.length < count - 1) {
      const index = value.indexOf(separator, start);
      if (index < 0) break;
      pieces.push(value.slice(start, index));
      start = index + separator.length;
    }
  } else {
    const expression = new RegExp(separator.source, separator.flags.includes("g") ? separator.flags : `${separator.flags}g`);
    while (pieces.length < count - 1) {
      expression.lastIndex = start;
      const match = expression.exec(value);
      if (!match) break;
      pieces.push(value.slice(start, match.index));
      start = match.index + match[0].length;
      if (!match[0].length) start += 1;
    }
  }
  pieces.push(value.slice(start));
  return pieces;
}

function forCells(sheet: CleanerSheetModel, ids: string[] | undefined, callback: (cell: CleanerCell, row: CleanerRow, column: CleanerColumn) => void) {
  const columns = ids ? ids.map((id) => sheet.columns.find((column) => column.id === id)!) : sheet.columns;
  sheet.rows.forEach((row) => columns.forEach((column) => {
    const current = row.cells[column.id];
    if (current) callback(current, row, column);
  }));
}

function conversionFailure(sheet: CleanerSheetModel, row: CleanerRow, rule: ExcelCleanerRule, current: CleanerCell, stats: ExcelCleanerRuleStats, issues: IssueBuffers) {
  stats.conversionFailures += 1;
  pushIssue(issues, "errors", issue(sheet, row, rule, "CONVERSION_FAILED", undefined, scalarText(current.value)));
}

function issue(sheet: CleanerSheetModel, row: CleanerRow, rule: ExcelCleanerRule, reason: string, address?: string, value?: string): ExcelCleanerIssueRow {
  return { sheet: sheet.name, ruleId: rule.id, ruleType: rule.type, sourceRow: row.sourceRow ?? null, address, reason, values: value ?? JSON.stringify(sheet.columns.map((column) => scalarText(decisionValue(row.cells[column.id])))) };
}

function pushIssue(buffers: IssueBuffers, target: "errors" | "excluded", value: ExcelCleanerIssueRow) {
  if (buffers[target].length < EXCEL_CLEANER_REPORT_ROW_LIMIT) buffers[target].push(value);
  else if (target === "errors") buffers.errorTruncated += 1;
  else buffers.excludedTruncated += 1;
}

function sampleSheets(sheets: CleanerSheetModel[], limit: number) {
  const result: string[][] = [];
  for (const sheet of sheets) {
    result.push([sheet.name, ...sheet.columns.map((column) => column.name)]);
    for (const row of sheet.rows.slice(0, Math.max(0, limit - result.length))) result.push([String(row.sourceRow ?? ""), ...sheet.columns.map((column) => scalarText(decisionValue(row.cells[column.id])))]);
    if (result.length >= limit) break;
  }
  return result;
}

function rowEmpty(row: CleanerRow, columns: CleanerColumn[]) { return columns.every((column) => isEmpty(decisionValue(row.cells[column.id]))); }
function columnEmpty(id: string, rows: CleanerRow[]) { return rows.every((row) => isEmpty(decisionValue(row.cells[id]))); }
function isEmpty(value: SpreadsheetScalar | undefined) { return value === undefined || value === null || value === ""; }
function decisionValue(value: CleanerCell | undefined) { return value?.formula ? value.cachedValue : value?.value; }
function scalarText(value: SpreadsheetScalar | undefined) { return value instanceof Date ? value.toISOString() : value === null || value === undefined ? "" : String(value); }
function identity(value: SpreadsheetScalar | undefined) { return value instanceof Date ? `d:${value.toISOString()}` : `${typeof value}:${scalarText(value)}`; }
function dateRank(value: SpreadsheetScalar | undefined) { const parsed = value instanceof Date ? value : new Date(scalarText(value)); return Number.isNaN(parsed.getTime()) ? Number.NEGATIVE_INFINITY : parsed.getTime(); }
function cell(value: SpreadsheetScalar): CleanerCell { return { value }; }
function cloneCell(value: CleanerCell | undefined): CleanerCell { return value ? { ...value, value: value.value instanceof Date ? new Date(value.value) : value.value, cachedValue: value.cachedValue instanceof Date ? new Date(value.cachedValue) : value.cachedValue, style: value.style ? structuredClone(value.style) : undefined } : cell(null); }
function phoneWithDashes(value: string) {
  if (value.startsWith("02")) return value.length === 9 ? `${value.slice(0, 2)}-${value.slice(2, 5)}-${value.slice(5)}` : `${value.slice(0, 2)}-${value.slice(2, 6)}-${value.slice(6)}`;
  return value.length === 10 ? `${value.slice(0, 3)}-${value.slice(3, 6)}-${value.slice(6)}` : `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`;
}
function parseRange(value: string) {
  const match = value.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/iu);
  if (!match) return undefined;
  return { left: decodeColumn(match[1]), top: Number(match[2]), right: decodeColumn(match[3]), bottom: Number(match[4]) };
}
function decodeColumn(value: string) { return [...value.toUpperCase()].reduce((sum, character) => sum * 26 + character.charCodeAt(0) - 64, 0); }
function escapeRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"); }
function emptyStats(rule: ExcelCleanerRule): ExcelCleanerRuleStats { return { ruleId: rule.id, type: rule.type, changedCells: 0, deletedRows: 0, deletedColumns: 0, duplicates: 0, conversionFailures: 0, excludedRows: 0 }; }
function addStats(target: ExcelCleanerRuleStats, source: ExcelCleanerRuleStats) { target.changedCells += source.changedCells; target.deletedRows += source.deletedRows; target.deletedColumns += source.deletedColumns; target.duplicates += source.duplicates; target.conversionFailures += source.conversionFailures; target.excludedRows += source.excludedRows; }
function dimensions(sheets: CleanerSheetModel[]) { return { rows: sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0), columns: sheets.reduce((sum, sheet) => sum + sheet.columns.length, 0) }; }
function sum(stats: ExcelCleanerRuleStats[], key: keyof Omit<ExcelCleanerRuleStats, "ruleId" | "type">) { return stats.reduce((total, item) => total + item[key], 0); }
