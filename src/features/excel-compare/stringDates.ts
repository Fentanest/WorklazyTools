import type { SpreadsheetCellData } from "../spreadsheet-core/inputAdapter.ts";
import { compareSpreadsheetCells } from "./normalization.ts";
import type { ExcelComparePairOptions } from "./types.ts";

export type StringDateMode = "off" | "US" | "EU";
export interface ParsedStringDate { parseStatus: "parsed" | "invalid"; normalizedDate?: string }

/** Describes requested versus eligible VALUE policy; does not alter any matcher. */
export function stringDatePolicy(options:Pick<ExcelComparePairOptions,'mode'|'stringDates'>){
 const requestedMode=options.stringDates?.mode??'off';
 const inactiveReason=requestedMode==='off'?'off':options.mode==='reconcile'?'reconcile':!options.stringDates?.leftColumns.length||!options.stringDates.rightColumns.length?'noColumns':'none';
 return {requestedMode,appliedMode:inactiveReason==='none'?requestedMode:'off' as StringDateMode,active:inactiveReason==='none',inactiveReason};
}

/** Calendar tuples only: no Date.parse, epoch conversion, timezone or partial-year guesses. */
export function parseStringDate(value: string, mode: Exclude<StringDateMode, "off">): ParsedStringDate {
  const parts = /^(\d{4}-\d{2}-\d{2}|\d{2}([/.-])\d{2}\2\d{4})(?:[ T](\d{2}):(\d{2}):(\d{2}))?$/u.exec(value);
  if (!parts) return { parseStatus: "invalid" };
  const date = parts[1];
  let year: number, month: number, day: number;
  if (/^\d{4}-/u.test(date)) [year, month, day] = date.split("-").map(Number);
  else {
    if (parts[2] === "." && mode !== "EU") return { parseStatus: "invalid" };
    const [first, second, last] = date.split(/[/.-]/u).map(Number);
    year = last; month = mode === "US" ? first : second; day = mode === "US" ? second : first;
  }
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const maximum = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (year < 1 || !maximum || day < 1 || day > maximum) return { parseStatus: "invalid" };
  if (parts[3] !== undefined && (Number(parts[3]) > 23 || Number(parts[4]) > 59 || Number(parts[5]) > 59)) return { parseStatus: "invalid" };
  const canonical = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { parseStatus: "parsed", normalizedDate: parts[3] === undefined ? `date:${canonical}` : `datetime:${canonical}T${parts[3]}:${parts[4]}:${parts[5]}` };
}

export function compareCellsWithStringDates(left: SpreadsheetCellData | undefined, right: SpreadsheetCellData | undefined, options: ExcelComparePairOptions, compareStyles: boolean) {
  const compared = compareSpreadsheetCells(left, right, options.normalization, compareStyles);
  const dates = options.stringDates;
  if (!dates || dates.mode === "off" || !left || !right || left.formula || right.formula
    || left.type !== "string" || right.type !== "string" || typeof left.value !== "string" || typeof right.value !== "string"
    || !dates.leftColumns.includes(left.column) || !dates.rightColumns.includes(right.column)) return { ...compared, dateNormalization: undefined };
  const dateNormalization = { left: parseStringDate(left.value, dates.mode), right: parseStringDate(right.value, dates.mode) };
  if (dateNormalization.left.parseStatus !== "parsed" || dateNormalization.right.parseStatus !== "parsed") {
    return { ...compared, notes: [...compared.notes, "STRING_DATE_PARSE_FAILED"], dateNormalization };
  }
  const changes = compared.changes.filter((change) => change !== "VALUE");
  if (dateNormalization.left.normalizedDate !== dateNormalization.right.normalizedDate) changes.unshift("VALUE");
  return { ...compared, changes, equal: changes.length === 0, dateNormalization };
}
