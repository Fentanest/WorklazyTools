import type { SpreadsheetBookData, SpreadsheetCellData, SpreadsheetSheetData } from "../spreadsheet-core/inputAdapter.ts";
import { alignSequenceWithBudget, type SequenceAlignmentPair } from "../../utils/sequenceAlignment.ts";
import {
  cellText,
  compareSpreadsheetCells,
  normalizeComparableText,
  normalizedCellIdentity,
  normalizeKeyPart,
} from "./normalization.ts";
import type {
  ExcelComparePairOptions,
  ExcelCompareRecord,
  ExcelCompareSummary,
} from "./types.ts";

export interface ExcelCompareEngineResult {
  records: ExcelCompareRecord[];
  summary: ExcelCompareSummary;
  warnings: string[];
  parameters: Array<[string, string]>;
}

interface SheetIndex {
  sheet: SpreadsheetSheetData;
  cells: Map<string, SpreadsheetCellData>;
}

interface AxisItem {
  index: number;
  content: string;
  hash: string;
}

const DEFAULT_ALIGNMENT_CELL_BUDGET = 12_000_000;
const RECON_CANDIDATE_LIMIT = 10;
const RECON_COMPONENT_COMBINATIONS = 1_023;
const RECON_GLOBAL_BUDGET = 1_000_000;

export function compareSpreadsheetPair(
  leftBook: SpreadsheetBookData,
  rightBook: SpreadsheetBookData,
  options: ExcelComparePairOptions,
  checkCanceled: () => void = () => undefined,
): ExcelCompareEngineResult {
  const leftSheet = selectedSheet(leftBook, options.left.sheetName);
  const rightSheet = selectedSheet(rightBook, options.right.sheetName);
  const left = indexSheet(leftSheet);
  const right = indexSheet(rightSheet);
  const warnings: string[] = [];
  const records = options.mode === "position"
    ? compareByPosition(leftBook, rightBook, left, right, options, warnings, checkCanceled)
    : options.mode === "key"
      ? compareByKey(leftBook, rightBook, left, right, options, warnings, checkCanceled)
      : compareByReconciliation(left, right, options, warnings, checkCanceled);
  return {
    records,
    summary: summarize(records),
    warnings,
    parameters: comparisonParameters(leftBook, rightBook, options),
  };
}

function compareByPosition(
  leftBook: SpreadsheetBookData,
  rightBook: SpreadsheetBookData,
  left: SheetIndex,
  right: SheetIndex,
  options: ExcelComparePairOptions,
  warnings: string[],
  checkCanceled: () => void,
) {
  const columnAlignment = alignColumns(left, right, options, checkCanceled);
  const rowAlignment = alignRows(left, right, columnAlignment.pairs, options, checkCanceled);
  const records: ExcelCompareRecord[] = [];
  if (columnAlignment.budgetFallback || rowAlignment.budgetFallback) {
    warnings.push("ALIGN_LIMIT_FALLBACK");
    records.push(record("error", null, null, null, null, "", "", "", "ALIGNMENT", "ALIGN_LIMIT_FALLBACK"));
  }
  const compareStyles = leftBook.supportsStyleComparison && rightBook.supportsStyleComparison;
  if (options.normalization.compareFormatting && !compareStyles) warnings.push("FORMATTING_NOT_SUPPORTED_FOR_PAIR");
  for (const rowPair of rowAlignment.pairs) {
    checkCanceled();
    records.push(...compareRowPair(left, right, rowPair, columnAlignment.pairs, options, compareStyles, ""));
  }
  records.push(...compareMerges(left.sheet, right.sheet));
  return records;
}

function compareByKey(
  leftBook: SpreadsheetBookData,
  rightBook: SpreadsheetBookData,
  left: SheetIndex,
  right: SheetIndex,
  options: ExcelComparePairOptions,
  warnings: string[],
  checkCanceled: () => void,
) {
  const keyOptions = options.key;
  if (!keyOptions || !keyOptions.leftColumns.length || keyOptions.leftColumns.length !== keyOptions.rightColumns.length) {
    return [record("error", null, null, null, null, "", "", "", "KEY", "KEY_MAPPING_REQUIRED")];
  }
  const columnAlignment = alignColumns(left, right, options, checkCanceled);
  const leftRows = dataRows(left.sheet, options.left.headerRow);
  const rightRows = dataRows(right.sheet, options.right.headerRow);
  const primaryLeft = groupRows(left, leftRows, keyOptions.leftColumns, options);
  const primaryRight = groupRows(right, rightRows, keyOptions.rightColumns, options);
  const records: ExcelCompareRecord[] = [];
  const compareStyles = leftBook.supportsStyleComparison && rightBook.supportsStyleComparison;
  if (options.normalization.compareFormatting && !compareStyles) warnings.push("FORMATTING_NOT_SUPPORTED_FOR_PAIR");

  if (keyOptions.duplicatePolicy === "error") {
    const duplicateKeys = new Set([...primaryLeft, ...primaryRight].filter(([, rows]) => rows.length > 1).map(([key]) => key));
    duplicateKeys.forEach((key) => {
      for (const row of primaryLeft.get(key) ?? []) records.push(record("duplicate", row, null, null, null, key, rowText(left, row), "", "KEY", "DUPLICATE_KEY"));
      for (const row of primaryRight.get(key) ?? []) records.push(record("duplicate", null, row, null, null, key, "", rowText(right, row), "KEY", "DUPLICATE_KEY"));
      primaryLeft.delete(key);
      primaryRight.delete(key);
    });
  }

  const leftGroups = keyOptions.duplicatePolicy === "secondary"
    ? groupRows(left, leftRows, [...keyOptions.leftColumns, ...keyOptions.secondaryLeftColumns], options)
    : primaryLeft;
  const rightGroups = keyOptions.duplicatePolicy === "secondary"
    ? groupRows(right, rightRows, [...keyOptions.rightColumns, ...keyOptions.secondaryRightColumns], options)
    : primaryRight;
  const keys = new Set([...leftGroups.keys(), ...rightGroups.keys()]);
  for (const key of [...keys].sort()) {
    checkCanceled();
    const beforeRows = leftGroups.get(key) ?? [];
    const afterRows = rightGroups.get(key) ?? [];
    if (keyOptions.duplicatePolicy !== "occurrence" && (beforeRows.length > 1 || afterRows.length > 1)) {
      beforeRows.forEach((row) => records.push(record("ambiguous", row, null, null, null, key, rowText(left, row), "", "KEY", "MULTIPLE_CANDIDATES")));
      afterRows.forEach((row) => records.push(record("ambiguous", null, row, null, null, key, "", rowText(right, row), "KEY", "MULTIPLE_CANDIDATES")));
      continue;
    }
    const count = Math.max(beforeRows.length, afterRows.length);
    for (let index = 0; index < count; index += 1) {
      records.push(...compareRowPair(
        left,
        right,
        { beforeIndex: beforeRows[index] ?? null, afterIndex: afterRows[index] ?? null },
        columnAlignment.pairs,
        options,
        compareStyles,
        key,
      ));
    }
  }
  if (columnAlignment.budgetFallback) {
    warnings.push("ALIGN_LIMIT_FALLBACK");
    records.push(record("error", null, null, null, null, "", "", "", "ALIGNMENT", "ALIGN_LIMIT_FALLBACK"));
  }
  return records;
}

function compareByReconciliation(
  left: SheetIndex,
  right: SheetIndex,
  options: ExcelComparePairOptions,
  warnings: string[],
  checkCanceled: () => void,
) {
  const config = options.reconcile;
  if (!config) return [record("error", null, null, null, null, "", "", "", "RECONCILIATION", "RECON_MAPPING_REQUIRED")];
  const leftTransactions = dataRows(left.sheet, options.left.headerRow).map((row) => transaction(left, row, config.leftAmountColumn, config.leftDateColumn, config.leftPartnerColumn, options));
  const rightTransactions = dataRows(right.sheet, options.right.headerRow).map((row) => transaction(right, row, config.rightAmountColumn, config.rightDateColumn, config.rightPartnerColumn, options));
  const records: ExcelCompareRecord[] = [];
  const validLeft = leftTransactions.filter((item) => {
    if (item.valid) return true;
    records.push(record("error", item.row, null, null, null, item.partner, item.amountText, "", "RECONCILIATION", "INVALID_TRANSACTION"));
    return false;
  });
  const validRight = rightTransactions.filter((item) => {
    if (item.valid) return true;
    records.push(record("error", null, item.row, null, null, item.partner, "", item.amountText, "RECONCILIATION", "INVALID_TRANSACTION"));
    return false;
  });
  const usedLeft = new Set<number>();
  const usedRight = new Set<number>();
  const unmatchedLeftReasons = new Map<number, string>();
  let evaluations = 0;
  let limitReached = false;

  const evaluateSubsets = (targetAmount: number, candidates: typeof validRight) => {
    const bounded = candidates.slice(0, RECON_CANDIDATE_LIMIT);
    const maximum = Math.min(RECON_COMPONENT_COMBINATIONS, (1 << bounded.length) - 1);
    const matches: Array<typeof bounded> = [];
    for (let mask = 1; mask <= maximum; mask += 1) {
      evaluations += 1;
      if ((evaluations & 4095) === 0) checkCanceled();
      if (evaluations > RECON_GLOBAL_BUDGET) { limitReached = true; break; }
      const subset = bounded.filter((_candidate, index) => (mask & (1 << index)) !== 0);
      const sum = roundAmount(subset.reduce((total, candidate) => total + candidate.amount, 0), config.roundingUnit);
      if (amountsEqual(targetAmount, sum, options)) matches.push(subset);
      if (matches.length > 1) break;
    }
    return matches;
  };

  for (const target of validLeft) {
    checkCanceled();
    if (usedLeft.has(target.row)) continue;
    const component = validRight.filter((candidate) => !usedRight.has(candidate.row) && candidate.partner === target.partner && Math.abs(candidate.day - target.day) <= config.dateToleranceDays);
    if (config.allowGroupedMatches && component.length > 1 && !limitReached) {
      const combinations = evaluateSubsets(roundAmount(target.amount, config.roundingUnit), component);
      if (combinations.length === 1) {
        usedLeft.add(target.row); combinations[0].forEach((candidate) => usedRight.add(candidate.row));
        records.push(reconciliationRecord("matched", [target], combinations[0], combinations[0].length === 1 ? "ONE_TO_ONE" : "ONE_TO_MANY"));
        continue;
      }
      if (combinations.length > 1) {
        records.push(reconciliationRecord("ambiguous", [target], combinations.flat(), "MULTIPLE_COMBINATIONS"));
        usedLeft.add(target.row);
        continue;
      }
    }
    const exact = component.filter((candidate) => amountsEqual(target.amount, candidate.amount, options));
    if (exact.length === 1) {
      usedLeft.add(target.row); usedRight.add(exact[0].row);
      records.push(reconciliationRecord("matched", [target], [exact[0]], "ONE_TO_ONE"));
      continue;
    }
    if (exact.length > 1) {
      records.push(reconciliationRecord("ambiguous", [target], exact, "MULTIPLE_CANDIDATES"));
      usedLeft.add(target.row);
      continue;
    }
    const samePartner = validRight.filter((candidate) => !usedRight.has(candidate.row) && candidate.partner === target.partner);
    unmatchedLeftReasons.set(target.row, component.length ? "AMOUNT_DIFFERENCE" : samePartner.length ? "DATE_DIFFERENCE" : "NO_CANDIDATE");
  }

  if (config.allowGroupedMatches && !limitReached) {
    for (const target of validRight.filter((item) => !usedRight.has(item.row))) {
      const component = validLeft.filter((candidate) => !usedLeft.has(candidate.row) && candidate.partner === target.partner && Math.abs(candidate.day - target.day) <= config.dateToleranceDays);
      if (component.length <= 1) continue;
      const combinations = evaluateSubsets(roundAmount(target.amount, config.roundingUnit), component);
      if (combinations.length === 1) {
        combinations[0].forEach((candidate) => usedLeft.add(candidate.row)); usedRight.add(target.row);
        records.push(reconciliationRecord("matched", combinations[0], [target], "MANY_TO_ONE"));
      } else if (combinations.length > 1) {
        records.push(reconciliationRecord("ambiguous", combinations.flat(), [target], "MULTIPLE_COMBINATIONS"));
        usedRight.add(target.row);
      }
    }
  }
  validLeft.filter((item) => !usedLeft.has(item.row)).forEach((item) => records.push(reconciliationRecord("unmatched", [item], [], unmatchedLeftReasons.get(item.row) ?? "NO_CANDIDATE")));
  validRight.filter((item) => !usedRight.has(item.row)).forEach((item) => records.push(reconciliationRecord("unmatched", [], [item], "NO_CANDIDATE")));
  if (limitReached) {
    warnings.push("RECON_SEARCH_LIMIT");
    records.push(record("error", null, null, null, null, "", "", "", "RECONCILIATION", "RECON_SEARCH_LIMIT"));
  }
  return records;
}

function alignColumns(left: SheetIndex, right: SheetIndex, options: ExcelComparePairOptions, checkCanceled: () => void) {
  const leftItems = Array.from({ length: left.sheet.columnCount }, (_, index) => axisItem(index + 1, columnContent(left, index + 1, options.left.headerRow, options)));
  const rightItems = Array.from({ length: right.sheet.columnCount }, (_, index) => axisItem(index + 1, columnContent(right, index + 1, options.right.headerRow, options)));
  return alignAxis(leftItems, rightItems, options.alignmentCellBudget, checkCanceled);
}

function alignRows(left: SheetIndex, right: SheetIndex, columns: SequenceAlignmentPair[], options: ExcelComparePairOptions, checkCanceled: () => void) {
  const leftRows = dataRows(left.sheet, options.left.headerRow);
  const rightRows = dataRows(right.sheet, options.right.headerRow);
  const leftItems = leftRows.map((row) => axisItem(row, rowContent(left, row, columns, true, options)));
  const rightItems = rightRows.map((row) => axisItem(row, rowContent(right, row, columns, false, options)));
  const aligned = alignAxis(leftItems, rightItems, options.alignmentCellBudget, checkCanceled);
  return { ...aligned, pairs: aligned.pairs.map((pair) => ({
    beforeIndex: pair.beforeIndex === null ? null : leftItems[pair.beforeIndex].index,
    afterIndex: pair.afterIndex === null ? null : rightItems[pair.afterIndex].index,
  })) };
}

function alignAxis(before: AxisItem[], after: AxisItem[], budget: number | undefined, checkCanceled: () => void) {
  return alignSequenceWithBudget(before, after, {
    signature: (item) => item.hash,
    equals: (left, right) => left.content === right.content,
    score: (left, right) => left.content === right.content ? 4 : 0,
    acceptsPair: () => true,
    gapScore: -1,
    cellBudget: budget ?? DEFAULT_ALIGNMENT_CELL_BUDGET,
    checkCanceled,
  });
}

function compareRowPair(
  left: SheetIndex,
  right: SheetIndex,
  rows: SequenceAlignmentPair,
  columns: SequenceAlignmentPair[],
  options: ExcelComparePairOptions,
  compareStyles: boolean,
  key: string,
) {
  const records: ExcelCompareRecord[] = [];
  for (const columnsPair of columns) {
    const leftColumn = columnsPair.beforeIndex === null ? null : columnsPair.beforeIndex + 1;
    const rightColumn = columnsPair.afterIndex === null ? null : columnsPair.afterIndex + 1;
    const leftCell = rows.beforeIndex === null || leftColumn === null ? undefined : getCell(left, rows.beforeIndex, leftColumn);
    const rightCell = rows.afterIndex === null || rightColumn === null ? undefined : getCell(right, rows.afterIndex, rightColumn);
    if (rows.beforeIndex === null || leftColumn === null) {
      if (rightCell) records.push(record("added", null, rows.afterIndex, null, rightColumn, key, "", cellText(rightCell), "CELL", "ADDED"));
      continue;
    }
    if (rows.afterIndex === null || rightColumn === null) {
      if (leftCell) records.push(record("removed", rows.beforeIndex, null, leftColumn, null, key, cellText(leftCell), "", "CELL", "REMOVED"));
      continue;
    }
    const comparison = compareSpreadsheetCells(leftCell, rightCell, options.normalization, compareStyles);
    const reason = [...comparison.changes, ...comparison.notes].join("+");
    records.push(record(comparison.equal ? "matched" : "changed", rows.beforeIndex, rows.afterIndex, leftColumn, rightColumn, key, comparison.leftText, comparison.rightText, comparison.changes.join("+"), reason || "MATCHED"));
  }
  return records;
}

function compareMerges(left: SpreadsheetSheetData, right: SpreadsheetSheetData) {
  const records: ExcelCompareRecord[] = [];
  const leftSet = new Set(left.merges);
  const rightSet = new Set(right.merges);
  leftSet.forEach((merge) => { if (!rightSet.has(merge)) records.push(record("removed", null, null, null, null, "", merge, "", "MERGE", "MERGE_REMOVED")); });
  rightSet.forEach((merge) => { if (!leftSet.has(merge)) records.push(record("added", null, null, null, null, "", "", merge, "MERGE", "MERGE_ADDED")); });
  return records;
}

function groupRows(index: SheetIndex, rows: number[], columns: number[], options: ExcelComparePairOptions) {
  const groups = new Map<string, number[]>();
  rows.forEach((row) => {
    const key = columns.map((column) => normalizeKeyPart(getCell(index, row, column), options.normalization)).join("\u241f");
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });
  return groups;
}

function columnContent(index: SheetIndex, column: number, headerRow: number, options: ExcelComparePairOptions) {
  const header = normalizedCellIdentity(getCell(index, headerRow, column), options.normalization);
  if (header !== "blank:") return `header:${header}`;
  const sample = dataRows(index.sheet, headerRow).slice(0, 32).map((row) => normalizedCellIdentity(getCell(index, row, column), options.normalization)).join("\u241e");
  return `blank:${sample}`;
}

function rowContent(index: SheetIndex, row: number, columns: SequenceAlignmentPair[], before: boolean, options: ExcelComparePairOptions) {
  return columns.flatMap((pair) => {
    if (pair.beforeIndex === null || pair.afterIndex === null) return [];
    const zeroBased = before ? pair.beforeIndex : pair.afterIndex;
    return [normalizedCellIdentity(getCell(index, row, zeroBased + 1), options.normalization)];
  }).join("\u241f");
}

function axisItem(index: number, content: string): AxisItem {
  return { index, content, hash: fnv1a(content) };
}

function fnv1a(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function transaction(index: SheetIndex, row: number, amountColumn: number, dateColumn: number, partnerColumn: number, options: ExcelComparePairOptions) {
  const amountCell = getCell(index, row, amountColumn);
  const dateCell = getCell(index, row, dateColumn);
  const partner = normalizeComparableText(cellText(getCell(index, row, partnerColumn)), options.normalization);
  const amountText = cellText(amountCell);
  const amount = parseAmount(amountCell?.value, options.normalization.stripNumberSymbols);
  const day = parseDay(dateCell?.value);
  return { row, amount, day, partner, amountText, valid: Number.isFinite(amount) && Number.isFinite(day) && Boolean(partner) };
}

function parseAmount(value: SpreadsheetCellData["value"] | undefined, stripSymbols: boolean) {
  if (typeof value === "number") return value;
  const text = String(value ?? "").trim();
  const normalized = stripSymbols ? text.replace(/[,\s₩$€£¥]/gu, "") : text;
  return /^[+-]?(?:\d+\.?\d*|\.\d+)$/u.test(normalized) ? Number(normalized) : Number.NaN;
}

function parseDay(value: SpreadsheetCellData["value"] | undefined) {
  if (value instanceof Date) return Math.floor(value.getTime() / 86_400_000);
  if (typeof value === "number") return Math.floor(value);
  const timestamp = Date.parse(String(value ?? ""));
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 86_400_000) : Number.NaN;
}

function amountsEqual(left: number, right: number, options: ExcelComparePairOptions) {
  const difference = Math.abs(left - right);
  if (difference <= Math.max(0, options.normalization.absoluteTolerance)) return true;
  const denominator = Math.max(Math.abs(left), Math.abs(right));
  return denominator === 0 ? difference === 0 : difference / denominator <= Math.max(0, options.normalization.relativeTolerance);
}

function roundAmount(value: number, unit: number) {
  const normalizedUnit = Number.isFinite(unit) && unit > 0 ? unit : 0.01;
  return Math.round(value / normalizedUnit) * normalizedUnit;
}

function reconciliationRecord(status: ExcelCompareRecord["status"], left: Array<{ row: number; amountText: string; partner: string }>, right: Array<{ row: number; amountText: string; partner: string }>, reason: string) {
  return record(status, left[0]?.row ?? null, right[0]?.row ?? null, null, null, left[0]?.partner ?? right[0]?.partner ?? "", left.map((item) => item.amountText).join(" + "), right.map((item) => item.amountText).join(" + "), "RECONCILIATION", reason);
}

function rowText(index: SheetIndex, row: number) {
  return Array.from({ length: index.sheet.columnCount }, (_, column) => cellText(getCell(index, row, column + 1))).join(" | ");
}

function selectedSheet(book: SpreadsheetBookData, name: string) {
  const sheet = book.sheets.find((candidate) => candidate.name === name);
  if (!sheet) throw new Error("SHEET_NOT_FOUND");
  return sheet;
}

function indexSheet(sheet: SpreadsheetSheetData): SheetIndex {
  return { sheet, cells: new Map(sheet.cells.map((cell) => [`${cell.row}:${cell.column}`, cell])) };
}

function getCell(index: SheetIndex, row: number, column: number) {
  return index.cells.get(`${row}:${column}`);
}

function dataRows(sheet: SpreadsheetSheetData, headerRow: number) {
  return Array.from({ length: Math.max(0, sheet.rowCount - headerRow) }, (_, index) => headerRow + index + 1);
}

function record(
  status: ExcelCompareRecord["status"], leftRow: number | null, rightRow: number | null,
  leftColumn: number | null, rightColumn: number | null, key: string, leftValue: string,
  rightValue: string, change: string, reason: string,
): ExcelCompareRecord {
  return { status, leftRow, rightRow, leftColumn, rightColumn, key, leftValue, rightValue, change, reason };
}

function summarize(records: ExcelCompareRecord[]): ExcelCompareSummary {
  const summary: ExcelCompareSummary = { matched: 0, changed: 0, added: 0, removed: 0, duplicate: 0, ambiguous: 0, unmatched: 0, error: 0 };
  records.forEach((item) => { summary[item.status] += 1; });
  return summary;
}

function comparisonParameters(left: SpreadsheetBookData, right: SpreadsheetBookData, options: ExcelComparePairOptions): Array<[string, string]> {
  const normalization = options.normalization;
  return [
    ["mode", options.mode],
    ["leftFormat", left.format],
    ["rightFormat", right.format],
    ["leftDateSystem", left.date1904 ? "1904" : "1900"],
    ["rightDateSystem", right.date1904 ? "1904" : "1900"],
    ["styleComparisonActive", String(normalization.compareFormatting && left.supportsStyleComparison && right.supportsStyleComparison)],
    ["leftSheet", options.left.sheetName],
    ["rightSheet", options.right.sheetName],
    ["leftHeaderRow", String(options.left.headerRow)],
    ["rightHeaderRow", String(options.right.headerRow)],
    ["trimWhitespace", String(normalization.trimWhitespace)],
    ["collapseWhitespace", String(normalization.collapseWhitespace)],
    ["normalizeLineBreaks", String(normalization.normalizeLineBreaks)],
    ["ignoreCase", String(normalization.ignoreCase)],
    ["unicodeNfc", String(normalization.unicodeNfc)],
    ["stripNumberSymbols", String(normalization.stripNumberSymbols)],
    ["numericStrings", String(normalization.numericStrings)],
    ["ignoreDateDisplayFormat", String(normalization.ignoreDateDisplayFormat)],
    ["blankEqualsEmpty", String(normalization.blankEqualsEmpty)],
    ["blankEqualsZero", String(normalization.blankEqualsZero)],
    ["compareDisplayValues", String(normalization.compareDisplayValues)],
    ["compareFormatting", String(normalization.compareFormatting)],
    ["formulaMode", normalization.formulaMode],
    ["absoluteTolerance", String(normalization.absoluteTolerance)],
    ["relativeTolerance", String(normalization.relativeTolerance)],
    ["keyLeftColumns", (options.key?.leftColumns ?? []).join(",")],
    ["keyRightColumns", (options.key?.rightColumns ?? []).join(",")],
    ["keySecondaryLeftColumns", (options.key?.secondaryLeftColumns ?? []).join(",")],
    ["keySecondaryRightColumns", (options.key?.secondaryRightColumns ?? []).join(",")],
    ["duplicateKeyPolicy", options.key?.duplicatePolicy ?? ""],
    ["reconcileLeftAmountColumn", String(options.reconcile?.leftAmountColumn ?? "")],
    ["reconcileRightAmountColumn", String(options.reconcile?.rightAmountColumn ?? "")],
    ["reconcileLeftDateColumn", String(options.reconcile?.leftDateColumn ?? "")],
    ["reconcileRightDateColumn", String(options.reconcile?.rightDateColumn ?? "")],
    ["reconcileLeftPartnerColumn", String(options.reconcile?.leftPartnerColumn ?? "")],
    ["reconcileRightPartnerColumn", String(options.reconcile?.rightPartnerColumn ?? "")],
    ["reconcileDateToleranceDays", String(options.reconcile?.dateToleranceDays ?? "")],
    ["reconcileGroupedMatches", String(options.reconcile?.allowGroupedMatches ?? false)],
    ["roundingUnit", String(options.reconcile?.roundingUnit ?? 0.01)],
    ["relativeToleranceZeroDenominator", "exact-zero-only"],
    ["alignmentCellBudget", String(options.alignmentCellBudget ?? DEFAULT_ALIGNMENT_CELL_BUDGET)],
    ["reconciliationCandidatesPerTarget", String(RECON_CANDIDATE_LIMIT)],
    ["reconciliationCombinationBudgetPerComponent", String(RECON_COMPONENT_COMBINATIONS)],
    ["reconciliationGlobalCombinationBudget", String(RECON_GLOBAL_BUDGET)],
  ];
}
