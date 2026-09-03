import type { SpreadsheetCellData, SpreadsheetComparableStyle, SpreadsheetScalar } from "../spreadsheet-core/inputAdapter.ts";
import type { ExcelCompareNormalizationOptions } from "./types.ts";

export interface CellComparison {
  equal: boolean;
  changes: string[];
  notes: string[];
  leftText: string;
  rightText: string;
}

interface NormalizedValue {
  type: "blank" | "string" | "number" | "boolean" | "date" | "error";
  value: string | number | boolean | null;
}

export function compareSpreadsheetCells(
  left: SpreadsheetCellData | undefined,
  right: SpreadsheetCellData | undefined,
  options: ExcelCompareNormalizationOptions,
  compareStyles: boolean,
): CellComparison {
  const changes: string[] = [];
  const notes: string[] = [];
  const leftValue = normalizeCellValue(left, options);
  const rightValue = normalizeCellValue(right, options);
  if (!normalizedValuesEqual(leftValue, rightValue, options)) changes.push("VALUE");

  if (options.formulaMode === "formula" || options.formulaMode === "both") {
    if (normalizeText(left?.formula ?? "", options) !== normalizeText(right?.formula ?? "", options)) changes.push("FORMULA");
  }
  if ((options.formulaMode === "cached" || options.formulaMode === "both") && (left?.formula || right?.formula)) {
    const leftCached = normalizeScalar(left?.formula ? left.cachedValue ?? null : left?.value ?? null, left, options);
    const rightCached = normalizeScalar(right?.formula ? right.cachedValue ?? null : right?.value ?? null, right, options);
    if (!normalizedValuesEqual(leftCached, rightCached, options)) changes.push("CACHED_VALUE");
    if ((left?.formula && left.cachedValue === null) || (right?.formula && right.cachedValue === null)) notes.push("CALCULATION_VALUE_UNAVAILABLE");
  }

  const dateDisplayIgnored = options.ignoreDateDisplayFormat && (leftValue.type === "date" || rightValue.type === "date");
  if (options.compareDisplayValues && !dateDisplayIgnored) {
    const leftDisplay = normalizeText(left?.displayValue ?? scalarText(left?.value ?? null), options);
    const rightDisplay = normalizeText(right?.displayValue ?? scalarText(right?.value ?? null), options);
    if (leftDisplay !== rightDisplay) changes.push("DISPLAY_VALUE");
    if ((left?.formula && !left.displayValue) || (right?.formula && !right.displayValue)) notes.push("DISPLAY_VALUE_UNAVAILABLE");
  }

  if (options.compareFormatting && compareStyles) {
    const leftStyle = comparableStyle(left?.style, dateDisplayIgnored);
    const rightStyle = comparableStyle(right?.style, dateDisplayIgnored);
    if (stableStringify(leftStyle) !== stableStringify(rightStyle)) changes.push("FORMATTING");
  }

  return {
    equal: changes.length === 0,
    changes,
    notes,
    leftText: cellText(left),
    rightText: cellText(right),
  };
}

export function normalizedCellIdentity(cell: SpreadsheetCellData | undefined, options: ExcelCompareNormalizationOptions) {
  const normalized = normalizeCellValue(cell, { ...options, absoluteTolerance: 0, relativeTolerance: 0, blankEqualsZero: false });
  return `${normalized.type}:${String(normalized.value ?? "")}`;
}

export function normalizeKeyPart(cell: SpreadsheetCellData | undefined, options: ExcelCompareNormalizationOptions) {
  const value = normalizeCellValue(cell, { ...options, absoluteTolerance: 0, relativeTolerance: 0, blankEqualsZero: false });
  return `${value.type}:${String(value.value ?? "")}`;
}

export function normalizeComparableText(value: string, options: ExcelCompareNormalizationOptions) {
  return normalizeText(value, options);
}

export function cellText(cell: SpreadsheetCellData | undefined) {
  if (!cell) return "";
  if (cell.formula && cell.cachedValue === null) return cell.formula;
  return cell.displayValue ?? scalarText(cell.value);
}

function normalizeCellValue(cell: SpreadsheetCellData | undefined, options: ExcelCompareNormalizationOptions) {
  return normalizeScalar(cell?.value ?? null, cell, options);
}

function normalizeScalar(value: SpreadsheetScalar, cell: SpreadsheetCellData | undefined, options: ExcelCompareNormalizationOptions): NormalizedValue {
  if (value === null) return { type: "blank", value: null };
  if (value instanceof Date) return { type: "date", value: value.getTime() };
  if (typeof value === "number") return { type: "number", value };
  if (typeof value === "boolean") return { type: "boolean", value };
  let text = normalizeText(value, options);
  if (text === "" && options.blankEqualsEmpty) return { type: "blank", value: null };
  if (options.numericStrings && cell?.numberFormat !== "@" && !hasMeaningfulLeadingZero(text)) {
    const numericText = options.stripNumberSymbols ? text.replace(/[,\s₩$€£¥]/gu, "") : text;
    if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/u.test(numericText)) return { type: "number", value: Number(numericText) };
  }
  return { type: cell?.type === "error" ? "error" : "string", value: text };
}

function normalizedValuesEqual(left: NormalizedValue, right: NormalizedValue, options: ExcelCompareNormalizationOptions) {
  if (left.type === right.type && left.value === right.value) return true;
  if (options.blankEqualsZero) {
    if (left.type === "blank" && right.type === "number" && right.value === 0) return true;
    if (right.type === "blank" && left.type === "number" && left.value === 0) return true;
  }
  if (left.type !== "number" || right.type !== "number") return false;
  const difference = Math.abs((left.value as number) - (right.value as number));
  if (difference <= Math.max(0, options.absoluteTolerance)) return true;
  const denominator = Math.max(Math.abs(left.value as number), Math.abs(right.value as number));
  if (denominator === 0) return difference === 0;
  return difference / denominator <= Math.max(0, options.relativeTolerance);
}

function normalizeText(value: string, options: ExcelCompareNormalizationOptions) {
  let text = value;
  if (options.unicodeNfc) text = text.normalize("NFC");
  if (options.normalizeLineBreaks) text = text.replace(/\r\n?/gu, "\n");
  if (options.trimWhitespace) text = text.trim();
  if (options.collapseWhitespace) text = text.replace(/[\t ]+/gu, " ");
  if (options.ignoreCase) text = text.toLocaleLowerCase("und");
  return text;
}

function hasMeaningfulLeadingZero(value: string) {
  const unsigned = value.replace(/^[+-]/u, "");
  return /^0\d/u.test(unsigned) && !/^0(?:\.\d+)?$/u.test(unsigned);
}

function comparableStyle(style: SpreadsheetComparableStyle | undefined, omitNumberFormat: boolean) {
  if (!style) return {};
  const fill = style.fill as { type?: string } | undefined;
  return {
    numFmt: omitNumberFormat ? undefined : style.numFmt,
    font: style.font,
    fill: fill?.type === "gradient" ? undefined : style.fill,
    border: style.border,
    alignment: style.alignment,
    protection: style.protection,
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function scalarText(value: SpreadsheetScalar) {
  return value instanceof Date ? value.toISOString() : value === null ? "" : String(value);
}
