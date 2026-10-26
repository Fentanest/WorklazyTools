import assert from "node:assert/strict";
import test from "node:test";
import { compareCellsWithStringDates, parseStringDate } from "../../src/features/excel-compare/stringDates.ts";
import { DEFAULT_EXCEL_COMPARE_OPTIONS, type ExcelComparePairOptions } from "../../src/features/excel-compare/types.ts";
import type { SpreadsheetCellData } from "../../src/features/spreadsheet-core/inputAdapter.ts";

const cell = (value: SpreadsheetCellData["value"], column = 1): SpreadsheetCellData => ({ row: 4, column, address: `${column === 1 ? "A" : "D"}4`, value, type: value instanceof Date ? "date" : typeof value === "number" ? "number" : "string", sourceRow: 4, sourceColumn: column, rowLineageId: "row4", columnLineageId: `col${column}` });
const options = (): ExcelComparePairOptions => ({ mode: "position", left: { sheetName: "Data", headerRow: 1 }, right: { sheetName: "Data", headerRow: 1 }, normalization: { ...DEFAULT_EXCEL_COMPARE_OPTIONS, compareDisplayValues: false }, stringDates: { mode: "US", leftColumns: [1], rightColumns: [4] } });

test("strict calendar tuples honor locale, leap years and date/time distinction", () => {
  assert.equal(parseStringDate("01/02/2024", "US").normalizedDate, "date:2024-01-02");
  assert.equal(parseStringDate("01/02/2024", "EU").normalizedDate, "date:2024-02-01");
  assert.equal(parseStringDate("29.02.2024 23:59:59", "EU").normalizedDate, "datetime:2024-02-29T23:59:59");
  for (const value of ["02/29/2023", "02/30/2024", "2024-02-00", "2024-13-01", "0000-01-01", "1/2/2024", "01/02/24", "01/02", "2024-01-02T24:00:00", "2024-01-02T12:00:00.1", "2024-01-02T12:00:00Z", "2024-01-02T12:00:00+09:00", "01/02-2024"]) assert.equal(parseStringDate(value, "US").parseStatus, "invalid", value);
  assert.notEqual(parseStringDate("2024-01-02", "US").normalizedDate, parseStringDate("2024-01-02 00:00:00", "US").normalizedDate);
});
test("only selected non-formula string pairs normalize VALUE while retaining raw and formatting", () => {
  const left = cell("01/02/2024"); const right = cell("2024-01-02", 4);
  const original = structuredClone({ left, right });
  assert.equal(compareCellsWithStringDates(left, right, options(), true).equal, true);
  assert.equal(compareCellsWithStringDates(left, right, { ...options(), stringDates: { ...options().stringDates!, mode: "off" } }, true).equal, false);
  assert.equal(compareCellsWithStringDates(left, cell("2024-01-02", 1), options(), true).equal, false);
  const independent = options(); independent.normalization.compareDisplayValues = true;
  left.style = { numFmt: "@" }; right.style = { numFmt: "General" };
  // A parsed date's text is its display: another date format is not a display change while date
  // display formats are ignored (the default); formatting stays independent.
  independent.normalization.ignoreDateDisplayFormat = true;
  assert.deepEqual(compareCellsWithStringDates(left, right, independent, true).changes, ["FORMATTING"]);
  const displayed = options(); displayed.normalization.compareDisplayValues = true; displayed.normalization.ignoreDateDisplayFormat = false;
  assert.deepEqual(compareCellsWithStringDates(left, right, displayed, true).changes, ["DISPLAY_VALUE", "FORMATTING"]);
  delete left.style; delete right.style;
  assert.deepEqual({ left, right }, original);
  assert.equal(compareCellsWithStringDates(left, cell(new Date("2024-01-02T00:00:00Z"), 4), options(), true).equal, false);
  assert.equal(compareCellsWithStringDates(left, cell(45293, 4), options(), true).equal, false);
  for (const formulaMode of ["formula", "cached", "both"] as const) {
    const configured = options(); configured.normalization.formulaMode = formulaMode;
    assert.equal(compareCellsWithStringDates({ ...left, formula: '="01/02/2024"', cachedValue: left.value }, right, configured, true).dateNormalization, undefined);
  }
});
test("invalid dates fall back with explicit parse status", () => {
  const comparison = compareCellsWithStringDates(cell("02/30/2024"), cell("2024-02-29", 4), options(), false);
  assert.equal(comparison.equal, false);
  assert.equal(comparison.dateNormalization?.left.parseStatus, "invalid");
  assert.ok(comparison.notes.includes("STRING_DATE_PARSE_FAILED"));
});
