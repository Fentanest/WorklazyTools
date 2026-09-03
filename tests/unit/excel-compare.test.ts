import assert from "node:assert/strict";
import test from "node:test";

import ExcelJS from "exceljs";

import { compareSpreadsheetPair } from "../../src/features/excel-compare/compareEngine.ts";
import { buildExcelCompareReport } from "../../src/features/excel-compare/report.ts";
import {
  assertGeneratedXlsxReport,
  assertReceivedXlsxReport,
  assertReportBlobSize,
  REPORT_INTEGRITY_ERROR_CODE,
} from "../../src/features/excel-compare/reportIntegrity.ts";
import {
  DEFAULT_EXCEL_COMPARE_OPTIONS,
  type ExcelComparePairOptions,
} from "../../src/features/excel-compare/types.ts";
import type {
  SpreadsheetBookData,
  SpreadsheetCellData,
  SpreadsheetScalar,
} from "../../src/features/spreadsheet-core/inputAdapter.ts";

const baseOptions = (): ExcelComparePairOptions => ({
  mode: "position",
  left: { sheetName: "Data", headerRow: 1 },
  right: { sheetName: "Data", headerRow: 1 },
  normalization: { ...DEFAULT_EXCEL_COMPARE_OPTIONS, compareFormatting: false, compareDisplayValues: false },
});

test("report integrity checks keep worker, client, and page responsibilities distinct", () => {
  const valid = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x01]).buffer;
  assert.doesNotThrow(() => assertGeneratedXlsxReport(valid));
  assert.doesNotThrow(() => assertReceivedXlsxReport(valid, 5));
  assert.doesNotThrow(() => assertReportBlobSize(new Blob([valid]), 5));
  for (const action of [
    () => assertGeneratedXlsxReport(new ArrayBuffer(0)),
    () => assertGeneratedXlsxReport(Uint8Array.from([1, 2, 3, 4]).buffer),
    () => assertReceivedXlsxReport(valid, 4),
    () => assertReportBlobSize(new Blob([valid]), 4),
  ]) {
    assert.throws(action, (error: Error & { code?: string }) => error.code === REPORT_INTEGRITY_ERROR_CODE);
  }
});

test("position comparison aligns columns before rows and keeps structural gaps distinct from blank-zero equality", () => {
  const left = book([
    ["ID", "Amount"],
    ["A", 10],
    ["B", 20],
    ["C", 30],
  ]);
  const right = book([
    ["ID", "New", "Amount"],
    ["A", "", 10],
    ["X", "added", 0],
    ["B", "", 21],
    ["C", "", 30],
  ]);
  const options = baseOptions();
  options.normalization.blankEqualsZero = true;
  const result = compareSpreadsheetPair(left, right, options);
  assert.ok(result.records.some((item) => item.status === "added" && item.rightRow === 3 && item.rightValue === "X"));
  assert.ok(result.records.some((item) => item.status === "changed" && item.leftRow === 3 && item.rightRow === 4 && item.leftValue === "20" && item.rightValue === "21"));
  assert.equal(result.warnings.includes("ALIGN_LIMIT_FALLBACK"), false);
});

test("position alignment reports its deterministic location fallback when the DP cell budget is exceeded", () => {
  const left = book([["A"], ...Array.from({ length: 8 }, (_, index) => [`L${index}`])]);
  const right = book([["A"], ...Array.from({ length: 8 }, (_, index) => [`R${index}`])]);
  const options = { ...baseOptions(), alignmentCellBudget: 4 };
  const result = compareSpreadsheetPair(left, right, options);
  assert.ok(result.warnings.includes("ALIGN_LIMIT_FALLBACK"));
  assert.ok(result.records.some((item) => item.status === "error" && item.reason === "ALIGN_LIMIT_FALLBACK"));
});

test("key comparison implements duplicate error, occurrence and secondary-key policies without first-row guessing", () => {
  const left = book([["Key", "Sub", "Value"], ["A", "x", 1], ["A", "y", 2]]);
  const right = book([["Key", "Sub", "Value"], ["A", "x", 1], ["A", "y", 3]]);

  const duplicateError = baseOptions();
  duplicateError.mode = "key";
  duplicateError.key = { leftColumns: [1], rightColumns: [1], secondaryLeftColumns: [], secondaryRightColumns: [], duplicatePolicy: "error" };
  assert.equal(compareSpreadsheetPair(left, right, duplicateError).summary.duplicate, 4);

  const occurrence = structuredClone(duplicateError);
  occurrence.key!.duplicatePolicy = "occurrence";
  const occurrenceResult = compareSpreadsheetPair(left, right, occurrence);
  assert.ok(occurrenceResult.records.some((item) => item.status === "changed" && item.leftRow === 3 && item.rightRow === 3));

  const secondary = structuredClone(duplicateError);
  secondary.key = { leftColumns: [1], rightColumns: [1], secondaryLeftColumns: [2], secondaryRightColumns: [2], duplicatePolicy: "secondary" };
  const secondaryResult = compareSpreadsheetPair(left, right, secondary);
  assert.equal(secondaryResult.summary.duplicate, 0);
  assert.equal(secondaryResult.summary.ambiguous, 0);
  assert.ok(secondaryResult.records.some((item) => item.status === "changed" && item.key.includes("string:y")));
});

test("normalization preserves leading-zero text and missing formula caches while honoring numeric opt-in elsewhere", () => {
  const left = book([["Code", "Number", "Formula"], ["001", "12", null]]);
  const right = book([["Code", "Number", "Formula"], ["1", 12, null]]);
  left.sheets[0].cells.push(formulaCell(2, 3, "SUM(A1:A1)", undefined));
  right.sheets[0].cells.push(formulaCell(2, 3, "SUM(A1:A1)", 1));
  const options = baseOptions();
  options.normalization.numericStrings = true;
  options.normalization.formulaMode = "cached";
  const result = compareSpreadsheetPair(left, right, options);
  assert.ok(result.records.some((item) => item.leftColumn === 1 && item.status === "changed"));
  assert.ok(result.records.some((item) => item.leftColumn === 2 && item.status === "matched"));
  assert.ok(result.records.some((item) => item.leftColumn === 3 && item.reason.includes("CACHED_VALUE")));
});

test("OOXML formatting equality compares baked style fields and excludes gradient fill details", () => {
  const left = book([["Value"], [10]]);
  const right = book([["Value"], [10]]);
  const leftCell = left.sheets[0].cells.find((item) => item.row === 2)!;
  const rightCell = right.sheets[0].cells.find((item) => item.row === 2)!;
  leftCell.style = { font: { bold: true, color: { argb: "FF22A65A" } }, fill: { type: "gradient", stops: [{ position: 0 }] } };
  rightCell.style = { font: { bold: true, color: { argb: "FF22A65A" } }, fill: { type: "gradient", stops: [{ position: 1 }] } };
  const options = baseOptions();
  options.normalization.compareFormatting = true;
  assert.equal(compareSpreadsheetPair(left, right, options).summary.changed, 0);
  rightCell.style.font = { bold: true, color: { argb: "FFFF0000" } };
  assert.ok(compareSpreadsheetPair(left, right, options).records.some((item) => item.reason.includes("FORMATTING")));

  right.supportsStyleComparison = false;
  assert.equal(compareSpreadsheetPair(left, right, options).summary.changed, 0);
});

test("reconciliation finds deterministic 1:N matches and never auto-confirms multiple satisfying combinations", () => {
  const options = baseOptions();
  options.mode = "reconcile";
  options.normalization.absoluteTolerance = 0.001;
  options.reconcile = {
    leftAmountColumn: 1, rightAmountColumn: 1,
    leftDateColumn: 2, rightDateColumn: 2,
    leftPartnerColumn: 3, rightPartnerColumn: 3,
    dateToleranceDays: 1, allowGroupedMatches: true, roundingUnit: 0.01,
  };
  const left = book([["Amount", "Date", "Partner"], [30, "2026-09-01", "Vendor"]]);
  const right = book([["Amount", "Date", "Partner"], [10, "2026-09-01", "Vendor"], [20, "2026-09-01", "Vendor"]]);
  const matched = compareSpreadsheetPair(left, right, options);
  assert.ok(matched.records.some((item) => item.status === "matched" && item.reason === "ONE_TO_MANY"));

  const ambiguousRight = book([["Amount", "Date", "Partner"], [10, "2026-09-01", "Vendor"], [20, "2026-09-01", "Vendor"], [30, "2026-09-01", "Vendor"]]);
  const ambiguous = compareSpreadsheetPair(left, ambiguousRight, options);
  assert.ok(ambiguous.records.some((item) => item.status === "ambiguous" && item.reason === "MULTIPLE_COMBINATIONS"));
});

test("reconciliation excludes disabled date and partner criteria symmetrically", () => {
  const dateUnused = reconciliationOptions();
  dateUnused.reconcile!.leftDateColumn = undefined;
  dateUnused.reconcile!.rightDateColumn = undefined;
  const dateResult = compareSpreadsheetPair(
    book([["Amount", "Date", "Partner"], [10, "not-a-date", "Vendor"]]),
    book([["Amount", "Date", "Partner"], [10, "also-not-a-date", "Vendor"]]),
    dateUnused,
  );
  assert.equal(dateResult.summary.matched, 1);
  assert.equal(dateResult.records.some((item) => item.reason.includes("INVALID_DATE")), false);

  const partnerUnused = reconciliationOptions();
  partnerUnused.reconcile!.leftPartnerColumn = undefined;
  partnerUnused.reconcile!.rightPartnerColumn = undefined;
  const partnerResult = compareSpreadsheetPair(
    book([["Amount", "Date", "Partner"], [10, "2026-09-01", ""]]),
    book([["Amount", "Date", "Partner"], [10, "2026-09-01", ""]]),
    partnerUnused,
  );
  assert.equal(partnerResult.summary.matched, 1);
  assert.equal(partnerResult.records.some((item) => item.reason.includes("INVALID_PARTNER")), false);
});

test("amount-only reconciliation counts ambiguity once per unresolved left target", () => {
  const options = reconciliationOptions();
  options.reconcile = {
    ...options.reconcile!,
    leftDateColumn: undefined,
    rightDateColumn: undefined,
    leftPartnerColumn: undefined,
    rightPartnerColumn: undefined,
  };
  const result = compareSpreadsheetPair(
    book([["Amount"], [10], [10]]),
    book([["Amount"], [10], [10], [10]]),
    options,
  );
  assert.equal(result.summary.ambiguous, 2);
  assert.deepEqual(result.records.filter((item) => item.status === "ambiguous").map((item) => item.leftRow), [2, 3]);
  assert.equal(result.records.some((item) => /INVALID_DATE|INVALID_PARTNER/u.test(item.reason)), false);
});

test("active reconciliation criteria report amount, date, and partner errors separately", () => {
  const options = reconciliationOptions();
  const result = compareSpreadsheetPair(
    book([
      ["Amount", "Date", "Partner"],
      ["bad", "2026-09-01", "Vendor"],
      [10, "bad", "Vendor"],
      [10, "2026-09-01", ""],
    ]),
    book([["Amount", "Date", "Partner"], [10, "2026-09-01", "Vendor"]]),
    options,
  );
  assert.deepEqual(
    result.records.filter((item) => item.status === "error").map((item) => item.reason),
    ["INVALID_AMOUNT", "INVALID_DATE", "INVALID_PARTNER"],
  );
});

test("reconciliation validator rejects one-sided optional mappings", () => {
  const options = reconciliationOptions();
  options.reconcile!.rightDateColumn = undefined;
  const result = compareSpreadsheetPair(book([["Amount"], [10]]), book([["Amount"], [10]]), options);
  assert.equal(result.summary.error, 1);
  assert.equal(result.records[0].reason, "RECON_MAPPING_REQUIRED");
});

test("reverse grouped ambiguity is recorded once for every involved left target", () => {
  const options = reconciliationOptions();
  options.reconcile = {
    ...options.reconcile!,
    leftDateColumn: undefined,
    rightDateColumn: undefined,
    leftPartnerColumn: undefined,
    rightPartnerColumn: undefined,
    allowGroupedMatches: true,
  };
  const result = compareSpreadsheetPair(
    book([["Amount"], [4], [6], [3], [7]]),
    book([["Amount"], [10]]),
    options,
  );
  const ambiguous = result.records.filter((item) => item.status === "ambiguous");
  assert.equal(result.summary.ambiguous, 4);
  assert.deepEqual(ambiguous.map((item) => item.leftRow).sort(), [2, 3, 4, 5]);
  assert.ok(ambiguous.every((item) => item.reason === "MULTIPLE_COMBINATIONS" && item.rightRow === 2));
});

test("candidate-limit overflow prevents exact auto-matching and matches Parameters", () => {
  const options = reconciliationOptions();
  options.reconcile = {
    ...options.reconcile!,
    leftDateColumn: undefined,
    rightDateColumn: undefined,
    leftPartnerColumn: undefined,
    rightPartnerColumn: undefined,
    allowGroupedMatches: false,
  };
  const result = compareSpreadsheetPair(
    book([["Amount"], [10]]),
    book([["Amount"], ...Array.from({ length: 11 }, () => [10])]),
    options,
  );
  assert.equal(result.summary.matched, 0);
  assert.equal(result.summary.ambiguous, 1);
  assert.ok(result.warnings.includes("RECON_SEARCH_LIMIT"));
  assert.equal(result.records.find((item) => item.status === "ambiguous")?.reason, "RECON_SEARCH_LIMIT");
  const parameters = Object.fromEntries(result.parameters);
  assert.equal(parameters.reconciliationCandidatesPerTarget, "10");
  assert.equal(parameters.reconciliationCombinationBudgetPerComponent, "UNUSED");
  assert.equal(parameters.reconcileLeftDateColumn, "UNUSED");
  assert.equal(parameters.reconcileLeftPartnerColumn, "UNUSED");
});

test("reconciliation records the pair-wide combination budget as RECON_SEARCH_LIMIT", () => {
  const options = baseOptions();
  options.mode = "reconcile";
  options.reconcile = {
    leftAmountColumn: 1, rightAmountColumn: 1,
    leftDateColumn: 2, rightDateColumn: 2,
    leftPartnerColumn: 3, rightPartnerColumn: 3,
    dateToleranceDays: 0, allowGroupedMatches: true, roundingUnit: 0.01,
  };
  const leftRows = Array.from({ length: 980 }, () => [9_999, "2026-09-01", "Budget"]);
  const rightRows = Array.from({ length: 10 }, (_, index) => [index + 1, "2026-09-01", "Budget"]);
  const result = compareSpreadsheetPair(book([["Amount", "Date", "Partner"], ...leftRows]), book([["Amount", "Date", "Partner"], ...rightRows]), options);
  assert.ok(result.warnings.includes("RECON_SEARCH_LIMIT"));
  assert.ok(result.records.some((item) => item.reason === "RECON_SEARCH_LIMIT"));
});

test("pair report always has nine sheets and stores external values as primitive text", async () => {
  const compared = compareSpreadsheetPair(book([["ID"], ["=1+1"]]), book([["ID"], ["+2"]]), baseOptions());
  compared.records[0].key = "\tkey";
  compared.records[0].leftValue = " leading";
  const buffer = await buildExcelCompareReport(compared, { leftName: "=left.xlsx", rightName: "@right.xlsx", leftSheet: "Data", rightSheet: "Data" });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["Summary", "Parameters", "Matched", "Changed", "Added", "Removed", "Duplicates", "Ambiguous", "Errors"]);
  workbook.worksheets.forEach((sheet) => sheet.eachRow((row) => row.eachCell((cell) => {
    assert.equal(typeof cell.value, "string");
    assert.equal(cell.formula, undefined);
  })));
  const parameters = Object.fromEntries(workbook.getWorksheet("Parameters").getRows(2, workbook.getWorksheet("Parameters").rowCount - 1).map((row) => [String(row.getCell(1).value), String(row.getCell(2).value)]));
  assert.equal(parameters.keyLeftColumns, "UNUSED");
  assert.equal(parameters.reconcileLeftAmountColumn, "UNUSED");
  assert.equal(parameters.reconciliationCandidatesPerTarget, "UNUSED");
});

function reconciliationOptions(): ExcelComparePairOptions {
  return {
    ...baseOptions(),
    mode: "reconcile",
    reconcile: {
      leftAmountColumn: 1,
      rightAmountColumn: 1,
      leftDateColumn: 2,
      rightDateColumn: 2,
      leftPartnerColumn: 3,
      rightPartnerColumn: 3,
      dateToleranceDays: 0,
      allowGroupedMatches: false,
      roundingUnit: 0.01,
    },
  };
}

function book(rows: SpreadsheetScalar[][], date1904 = false): SpreadsheetBookData {
  const cells: SpreadsheetCellData[] = [];
  rows.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
    if (value === null) return;
    cells.push(cell(rowIndex + 1, columnIndex + 1, value));
  }));
  return {
    format: "xlsx",
    date1904,
    supportsStyleComparison: true,
    sheets: [{ name: "Data", rowCount: rows.length, columnCount: Math.max(0, ...rows.map((row) => row.length)), cells, merges: [] }],
  };
}

function cell(row: number, column: number, value: SpreadsheetScalar): SpreadsheetCellData {
  return {
    row,
    column,
    address: `${column}:${row}`,
    type: value instanceof Date ? "date" : value === null ? "blank" : typeof value as "string" | "number" | "boolean",
    value,
    displayValue: value instanceof Date ? value.toISOString() : String(value ?? ""),
  };
}

function formulaCell(row: number, column: number, formula: string, cachedValue: SpreadsheetScalar | undefined): SpreadsheetCellData {
  return {
    ...cell(row, column, cachedValue ?? null),
    formula,
    cachedValue,
  };
}
