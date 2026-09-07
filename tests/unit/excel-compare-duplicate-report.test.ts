import assert from "node:assert/strict";
import test from "node:test";

import ExcelJS from "exceljs";

import { compareSpreadsheetPair, type ExcelCompareEngineResult } from "../../src/features/excel-compare/compareEngine.ts";
import {
  DUPLICATE_KEY_TOO_LONG,
  DUPLICATE_REPORT_CELL_LIMIT,
  DUPLICATE_REPORT_LAYOUT,
  DUPLICATE_REPORT_LIST_CELL_LIMIT,
  DUPLICATE_REPORT_MULTILINE_KEY_LIMIT,
  DUPLICATE_REPORT_ROW_NOTATION,
  formatDuplicateReportRows,
} from "../../src/features/excel-compare/duplicateReport.ts";
import { buildExcelCompareReport } from "../../src/features/excel-compare/report.ts";
import { assertGeneratedXlsxReport } from "../../src/features/excel-compare/reportIntegrity.ts";
import {
  DEFAULT_EXCEL_COMPARE_OPTIONS,
  type ExcelCompareDuplicateRecord,
  type ExcelComparePairOptions,
} from "../../src/features/excel-compare/types.ts";
import type {
  SpreadsheetBookData,
  SpreadsheetCellData,
  SpreadsheetScalar,
} from "../../src/features/spreadsheet-core/inputAdapter.ts";

test("duplicate error records preserve all rows and values for 2:0, 0:2, 2:1, and 1:2 groups", () => {
  const cases = [
    { name: "2:0", left: ["A", "A"], right: [], leftRows: [2, 3], rightRows: [] },
    { name: "0:2", left: [], right: ["A", "A"], leftRows: [], rightRows: [2, 3] },
    { name: "2:1", left: ["A", "A"], right: ["A"], leftRows: [2, 3], rightRows: [2] },
    { name: "1:2", left: ["A"], right: ["A", "A"], leftRows: [2], rightRows: [2, 3] },
  ] as const;

  for (const shape of cases) {
    const result = compareSpreadsheetPair(keyBook(shape.left, "L"), keyBook(shape.right, "R"), keyOptions());
    assert.equal(result.summary.duplicate, 1, shape.name);
    assert.equal(result.records.length, 1, shape.name);
    const duplicate = result.records[0];
    assert.equal(duplicate.status, "duplicate", shape.name);
    if (duplicate.status !== "duplicate") continue;
    assert.deepEqual(duplicate.leftRows, shape.leftRows, shape.name);
    assert.deepEqual(duplicate.rightRows, shape.rightRows, shape.name);
    assert.equal(duplicate.leftRows.length, duplicate.leftValues.length, shape.name);
    assert.equal(duplicate.rightRows.length, duplicate.rightValues.length, shape.name);
    assert.deepEqual(duplicate.leftValues, shape.left.map((key, index) => `${key} | L${index + 1}`), shape.name);
    assert.deepEqual(duplicate.rightValues, shape.right.map((key, index) => `${key} | R${index + 1}`), shape.name);
    assert.equal(duplicate.leftRow, null, shape.name);
    assert.equal(duplicate.rightRow, null, shape.name);
    assert.equal(duplicate.leftColumn, null, shape.name);
    assert.equal(duplicate.rightColumn, null, shape.name);
    assert.equal(duplicate.leftValue, "", shape.name);
    assert.equal(duplicate.rightValue, "", shape.name);
  }
});

test("a 1:1 key stays on the existing scalar comparison path", () => {
  const result = compareSpreadsheetPair(keyBook(["A"], "same"), keyBook(["A"], "same"), keyOptions());
  assert.equal(result.summary.duplicate, 0);
  assert.equal(result.summary.matched, 2);
  assert.equal(result.records.some((record) => record.status === "duplicate"), false);
  for (const record of result.records) {
    assert.equal("leftRows" in record, false);
    assert.equal("rightRows" in record, false);
    assert.equal("displayKey" in record, false);
  }
});

test("displayKey uses original key cells, prefers the first left row, and never becomes group identity", () => {
  const options = keyOptions([1, 2], [1, 2]);
  options.normalization.ignoreCase = true;
  const preferredLeft = compareSpreadsheetPair(
    book([["Key 1", "Key 2"], ["string:Alpha", "Part"], ["STRING:ALPHA", "PART"]]),
    book([["Key 1", "Key 2"], ["String:Alpha", "part"], ["string:alpha", "PART"]]),
    options,
  );
  const preferredRecord = preferredLeft.records.find((record) => record.status === "duplicate");
  assert.ok(preferredRecord && preferredRecord.status === "duplicate");
  assert.equal(preferredRecord.displayKey, "string:Alpha | Part");
  assert.match(preferredRecord.key, /^string:string:alpha\u241fstring:part$/u);

  const rightFallback = compareSpreadsheetPair(
    book([["Key 1", "Key 2"]]),
    book([["Key 1", "Key 2"], ["Right", "First"], ["right", "first"]]),
    options,
  ).records[0];
  assert.equal(rightFallback.status, "duplicate");
  if (rightFallback.status === "duplicate") assert.equal(rightFallback.displayKey, "Right | First");

  const sameDisplay = compareSpreadsheetPair(
    book([["Key"], [1], [1], ["1"], ["1"]]),
    book([["Key"]]),
    keyOptions(),
  );
  const duplicateRecords = sameDisplay.records.filter((record) => record.status === "duplicate");
  assert.equal(sameDisplay.summary.duplicate, 2);
  assert.deepEqual(duplicateRecords.map((record) => record.displayKey), ["1", "1"]);
  assert.deepEqual(duplicateRecords.map((record) => record.key), ["number:1", "string:1"]);
});

test("duplicate group and source-row order remain deterministic", () => {
  const result = compareSpreadsheetPair(
    keyBook(["B", "B", "A", "A"], "L"),
    keyBook(["C", "C"], "R"),
    keyOptions(),
  );
  const duplicates = result.records.filter((record) => record.status === "duplicate");
  assert.deepEqual(duplicates.map((record) => record.displayKey), ["B", "A", "C"]);
  assert.deepEqual(duplicates.map((record) => record.leftRows), [[2, 3], [4, 5], []]);
  assert.deepEqual(duplicates.map((record) => record.rightRows), [[], [], [2, 3]]);
});

test("30,000-row duplicate grouping is append-based and checks cancellation inside the long group", () => {
  const left = book([["Key"], ...Array.from({ length: 30_000 }, () => ["A"])]);
  const right = book([["Key"]]);
  let checks = 0;
  const result = compareSpreadsheetPair(left, right, keyOptions(), () => { checks += 1; });
  assert.equal(result.summary.duplicate, 1);
  const duplicate = result.records[0];
  assert.equal(duplicate.status, "duplicate");
  if (duplicate.status === "duplicate") assert.equal(duplicate.leftRows.length, 30_000);
  assert.ok(checks >= 14, `expected group construction and value collection checks, received ${checks}`);

  let cancelChecks = 0;
  assert.throws(
    () => compareSpreadsheetPair(
      book([["Key"], ...Array.from({ length: 4_096 }, () => ["A"])]),
      right,
      keyOptions(),
      () => {
        cancelChecks += 1;
        if (cancelChecks === 3) throw new Error("CANCELED_IN_GROUPING");
      },
    ),
    /CANCELED_IN_GROUPING/u,
  );
  assert.equal(cancelChecks, 3);
});

test("duplicate formatter applies the 16,000-unit budget with independent sides and source-row notation", () => {
  const exact = formatDuplicateReportRows([duplicateRecord({
    leftRows: [2],
    leftValues: ["a".repeat(DUPLICATE_REPORT_LIST_CELL_LIMIT - "2: ".length)],
    rightRows: [8, 9],
    rightValues: ["right one", "right two"],
  })]);
  assert.equal(exact.rows.length, 1);
  assert.equal(exact.rows[0].leftValues.length, DUPLICATE_REPORT_LIST_CELL_LIMIT);

  const longValue = "a".repeat(DUPLICATE_REPORT_LIST_CELL_LIMIT - "2: ".length + 1);
  const split = formatDuplicateReportRows([duplicateRecord({
    leftRows: [2, 3],
    leftValues: [longValue, "tail"],
    rightRows: [8, 9],
    rightValues: ["right one", "right two"],
  })]);
  assert.equal(split.rows.length, 3);
  assert.equal(split.splitGroupCount, 1);
  assert.deepEqual(split.rows.map((row) => row.leftRows), ["2 [1/2]", "2 [2/2]", "3"]);
  assert.deepEqual(split.rows.map((row) => row.rightRows), ["8, 9", "", ""]);
  assert.equal(split.rows[0].leftValues.length, DUPLICATE_REPORT_LIST_CELL_LIMIT);
  assert.equal(split.rows[0].leftValues.slice(3) + split.rows[1].leftValues.slice(3), longValue);
  assert.equal(split.rows[2].leftValues, "3: tail");
  for (const row of split.rows) {
    assert.ok(row.leftRows.length <= DUPLICATE_REPORT_LIST_CELL_LIMIT);
    assert.ok(row.rightRows.length <= DUPLICATE_REPORT_LIST_CELL_LIMIT);
    assert.ok(row.leftValues.length <= DUPLICATE_REPORT_LIST_CELL_LIMIT);
    assert.ok(row.rightValues.length <= DUPLICATE_REPORT_LIST_CELL_LIMIT);
  }
});

test("duplicate formatter splits long row-number lists without dropping or reordering source rows", () => {
  const sourceRows = Array.from({ length: 3_000 }, (_, index) => 1_000_000 + index);
  const formatted = formatDuplicateReportRows([duplicateRecord({
    leftRows: sourceRows,
    leftValues: sourceRows.map(() => ""),
  })]);
  assert.ok(formatted.rows.length > 1);
  assert.deepEqual(
    formatted.rows.flatMap((row) => row.leftRows.split(", ").filter(Boolean).map(Number)),
    sourceRows,
  );
  for (const row of formatted.rows) {
    assert.ok(row.leftRows.length <= DUPLICATE_REPORT_LIST_CELL_LIMIT);
    assert.ok(row.leftValues.length <= DUPLICATE_REPORT_LIST_CELL_LIMIT);
  }
});

test("long-row splitting preserves surrogate pairs and CRLF boundaries and remains cancellable", () => {
  const maximumPart = DUPLICATE_REPORT_LIST_CELL_LIMIT - "2: ".length;
  for (const value of [
    `${"a".repeat(maximumPart - 1)}😀tail`,
    `${"a".repeat(maximumPart - 1)}\r\nend`,
  ]) {
    const formatted = formatDuplicateReportRows([duplicateRecord({ leftRows: [2], leftValues: [value] })]);
    assert.equal(formatted.rows.length, 2);
    const restored = formatted.rows.map((row) => row.leftValues.slice("2: ".length)).join("");
    assert.equal(restored, value);
    assert.equal(hasUnpairedSurrogate(restored), false);
    assert.equal(formatted.rows.some((row) => row.leftValues.endsWith("\r") || row.leftValues.startsWith("2: \n")), false);
  }

  let checks = 0;
  assert.throws(
    () => formatDuplicateReportRows([duplicateRecord({ leftRows: [2], leftValues: ["x".repeat(80_000)] })], () => {
      checks += 1;
      if (checks === 2) throw new Error("CANCELED_IN_LONG_VALUE");
    }),
    /CANCELED_IN_LONG_VALUE/u,
  );
  assert.equal(checks, 2);
});

test("DUPLICATE_KEY_TOO_LONG enforces single-line and multiline boundaries without truncation", async () => {
  for (const displayKey of [
    "k".repeat(DUPLICATE_REPORT_CELL_LIMIT),
    `${"k".repeat(DUPLICATE_REPORT_MULTILINE_KEY_LIMIT - 1)}\n`,
  ]) {
    const formatted = formatDuplicateReportRows([duplicateRecord({ displayKey })]);
    assert.equal(formatted.rows[0].record.displayKey, displayKey);
  }

  for (const displayKey of [
    "k".repeat(DUPLICATE_REPORT_CELL_LIMIT + 1),
    `${"k".repeat(DUPLICATE_REPORT_MULTILINE_KEY_LIMIT)}\r`,
  ]) {
    assert.throws(
      () => formatDuplicateReportRows([duplicateRecord({ displayKey })]),
      (error: Error & { code?: string }) => error.code === DUPLICATE_KEY_TOO_LONG,
    );
  }

  const result = engineResult([
    duplicateRecord({ displayKey: "k".repeat(DUPLICATE_REPORT_CELL_LIMIT + 1) }),
  ], [["mode", "key"], ["duplicateKeyPolicy", "error"]]);
  await awaitRejectsDuplicateKey(result);
});

test("report repeats grouped context, records exact group ranges, and leaves engine records untouched", async () => {
  const records = [
    duplicateRecord({
      key: "string:internal-one",
      displayKey: "=visible key",
      leftRows: [2, 3],
      leftValues: ["=left", "+left"],
      rightRows: [7],
      rightValues: ["@right"],
    }),
    duplicateRecord({
      key: "string:internal-two",
      displayKey: "visible two",
      leftRows: [4],
      leftValues: ["z".repeat(DUPLICATE_REPORT_LIST_CELL_LIMIT)],
      rightRows: [],
      rightValues: [],
    }),
  ];
  const result = engineResult(records, [
    ["mode", "key"],
    ["duplicateKeyPolicy", "error"],
  ]);
  const before = structuredClone(result.records);
  const buffer = reportArrayBuffer(await buildExcelCompareReport(result, {
    leftName: "=left.xlsx",
    rightName: "+right.xlsx",
    leftSheet: "Data",
    rightSheet: "Data",
  }));
  await assert.doesNotReject(() => assertGeneratedXlsxReport(buffer));
  assert.deepEqual(result.records, before);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), [
    "Summary", "Parameters", "Matched", "Changed", "Added", "Removed", "Duplicates", "Ambiguous", "Errors",
  ]);
  const duplicates = workbook.getWorksheet("Duplicates");
  assert.ok(duplicates);
  assert.equal(duplicates.columnCount, 13);
  assert.deepEqual(duplicates.getRow(1).values.slice(1), [
    "Left file", "Right file", "Left sheet", "Right sheet", "Left row", "Right row", "Left column", "Right column", "Key", "Left value", "Right value", "Change", "Reason",
  ]);
  assert.equal(duplicates.rowCount, 4);
  assert.deepEqual(duplicates.getRow(2).values.slice(1), [
    "=left.xlsx", "+right.xlsx", "Data", "Data", "2, 3", "7", "", "", "=visible key", "2: =left\n3: +left", "7: @right", "KEY", "DUPLICATE_KEY",
  ]);
  assert.equal(duplicates.getRow(3).getCell(9).value, "visible two");
  assert.equal(duplicates.getRow(4).getCell(9).value, "visible two");
  assert.equal(duplicates.getRow(3).getCell(12).value, "KEY");
  assert.equal(duplicates.getRow(4).getCell(13).value, "DUPLICATE_KEY");
  assert.equal(duplicates.getRow(4).getCell(6).value, "");
  workbook.worksheets.forEach((sheet) => sheet.eachRow((row) => row.eachCell({ includeEmpty: true }, (cell) => {
    if (cell.value === null) return;
    assert.equal(typeof cell.value, "string");
    assert.equal(cell.formula, undefined);
    assert.ok(String(cell.value).length <= DUPLICATE_REPORT_CELL_LIMIT);
  })));

  const parameters = worksheetMap(workbook.getWorksheet("Parameters"));
  assert.equal(parameters.duplicateCountUnit, "key-group");
  assert.equal(parameters.duplicateReportSplit, "true");
  assert.equal(parameters.duplicateReportSplitGroupCount, "1");
  assert.equal(parameters.duplicateReportDataRows, "3");
  assert.equal(parameters.duplicateReportCellLimit, String(DUPLICATE_REPORT_CELL_LIMIT));
  assert.equal(parameters.duplicateReportListCellLimit, String(DUPLICATE_REPORT_LIST_CELL_LIMIT));
  assert.equal(parameters.duplicateReportMultilineKeyLimit, String(DUPLICATE_REPORT_MULTILINE_KEY_LIMIT));
  assert.equal(parameters.duplicateReportLayout, DUPLICATE_REPORT_LAYOUT);
  assert.equal(parameters.duplicateReportRowNotation, DUPLICATE_REPORT_ROW_NOTATION);
  assert.equal(parameters["duplicateReportGroup.1"], "Duplicates!2:2");
  assert.equal(parameters["duplicateReportGroup.2"], "Duplicates!3:4");
});

test("duplicate report metadata uses false and zero for an empty applicable report and UNUSED elsewhere", async () => {
  const applicable = engineResult([], [["mode", "key"], ["duplicateKeyPolicy", "error"]]);
  const applicableBook = new ExcelJS.Workbook();
  await applicableBook.xlsx.load(await buildExcelCompareReport(applicable, reportContext()));
  const applicableParameters = worksheetMap(applicableBook.getWorksheet("Parameters"));
  assert.equal(applicableParameters.duplicateCountUnit, "key-group");
  assert.equal(applicableParameters.duplicateReportSplit, "false");
  assert.equal(applicableParameters.duplicateReportSplitGroupCount, "0");
  assert.equal(applicableParameters.duplicateReportDataRows, "0");
  assert.equal(Object.keys(applicableParameters).some((key) => key.startsWith("duplicateReportGroup.")), false);

  const unused = engineResult([], [["mode", "position"], ["duplicateKeyPolicy", "UNUSED"]]);
  const unusedBook = new ExcelJS.Workbook();
  await unusedBook.xlsx.load(await buildExcelCompareReport(unused, reportContext()));
  const unusedParameters = worksheetMap(unusedBook.getWorksheet("Parameters"));
  for (const key of [
    "duplicateCountUnit",
    "duplicateReportSplit",
    "duplicateReportSplitGroupCount",
    "duplicateReportDataRows",
    "duplicateReportCellLimit",
    "duplicateReportListCellLimit",
    "duplicateReportMultilineKeyLimit",
    "duplicateReportLayout",
    "duplicateReportRowNotation",
  ]) assert.equal(unusedParameters[key], "UNUSED", key);
});

function keyOptions(leftColumns = [1], rightColumns = [1]): ExcelComparePairOptions {
  return {
    mode: "key",
    left: { sheetName: "Data", headerRow: 1 },
    right: { sheetName: "Data", headerRow: 1 },
    normalization: { ...DEFAULT_EXCEL_COMPARE_OPTIONS, compareFormatting: false, compareDisplayValues: false },
    key: {
      leftColumns,
      rightColumns,
      secondaryLeftColumns: [],
      secondaryRightColumns: [],
      duplicatePolicy: "error",
    },
  };
}

function keyBook(keys: readonly string[], side: string) {
  return book([["Key", "Value"], ...keys.map((key, index) => [key, `${side}${index + 1}`])]);
}

function book(rows: SpreadsheetScalar[][]): SpreadsheetBookData {
  const cells: SpreadsheetCellData[] = [];
  rows.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
    if (value === null) return;
    cells.push({
      row: rowIndex + 1,
      column: columnIndex + 1,
      address: `${columnIndex + 1}:${rowIndex + 1}`,
      type: value instanceof Date ? "date" : typeof value as "string" | "number" | "boolean",
      value,
      displayValue: value instanceof Date ? value.toISOString() : String(value),
    });
  }));
  return {
    format: "xlsx",
    date1904: false,
    supportsStyleComparison: true,
    sheets: [{
      name: "Data",
      rowCount: rows.length,
      columnCount: Math.max(0, ...rows.map((row) => row.length)),
      cells,
      merges: [],
    }],
  };
}

function duplicateRecord(overrides: Partial<ExcelCompareDuplicateRecord> = {}): ExcelCompareDuplicateRecord {
  return {
    status: "duplicate",
    leftRow: null,
    rightRow: null,
    leftColumn: null,
    rightColumn: null,
    key: "string:internal",
    displayKey: "Visible key",
    leftValue: "",
    rightValue: "",
    change: "KEY",
    reason: "DUPLICATE_KEY",
    leftRows: [2, 3],
    rightRows: [],
    leftValues: ["left one", "left two"],
    rightValues: [],
    ...overrides,
  };
}

function engineResult(
  records: ExcelCompareDuplicateRecord[],
  parameters: Array<[string, string]>,
): ExcelCompareEngineResult {
  return {
    records,
    summary: { matched: 0, changed: 0, added: 0, removed: 0, duplicate: records.length, ambiguous: 0, unmatched: 0, error: 0 },
    warnings: [],
    parameters,
  };
}

function reportContext() {
  return { leftName: "left.xlsx", rightName: "right.xlsx", leftSheet: "Data", rightSheet: "Data" };
}

function worksheetMap(sheet: ExcelJS.Worksheet | undefined) {
  assert.ok(sheet);
  return Object.fromEntries(sheet.getRows(2, Math.max(0, sheet.rowCount - 1))?.map((row) => [
    String(row.getCell(1).value ?? ""),
    String(row.getCell(2).value ?? ""),
  ]) ?? []);
}

function reportArrayBuffer(value: ExcelJS.Buffer) {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice().buffer;
  throw new Error("Unexpected report buffer type.");
}

function awaitRejectsDuplicateKey(result: ExcelCompareEngineResult) {
  return assert.rejects(
    () => buildExcelCompareReport(result, reportContext()),
    (error: Error & { code?: string }) => error.code === DUPLICATE_KEY_TOO_LONG,
  );
}

function hasUnpairedSurrogate(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) return true;
  }
  return false;
}
