import assert from "node:assert/strict";
import test from "node:test";

import * as XLSX from "xlsx";

import { detectExcelCompareHeader } from "../../src/features/excel-compare/headerDetection.ts";
import { buildExcelCompareInspection } from "../../src/features/excel-compare/inspection.ts";
import { ExcelCompareInspectionRequests } from "../../src/features/excel-compare/inspectionRequests.ts";
import { inspectExcelCompareFile } from "../../src/features/excel-compare/excelCompareClient.ts";
import {
  parseSpreadsheetInput,
  type SpreadsheetBookData,
  type SpreadsheetCellData,
  type SpreadsheetInputFormat,
  type SpreadsheetSheetData,
} from "../../src/features/spreadsheet-core/inputAdapter.ts";
import { EXCEL_COMPARE_HEADER_CASES, type ExcelCompareHeaderCase } from "../fixtures/excel-compare-header-cases.ts";
import { EXCEL_COMPARE_HEADER_FORMAT_EXPECTATIONS, type HeaderFixtureFormat } from "../fixtures/excel-compare-header-format-expectations.ts";

test("the 23 raw header fixtures produce the fixed conservative classifications", () => {
  const actual = EXCEL_COMPARE_HEADER_CASES.map((fixture) => ({
    name: fixture.name,
    result: detectExcelCompareHeader(sheetFromFixture(fixture)),
  }));
  assert.deepEqual(actual, EXCEL_COMPARE_HEADER_CASES.map((fixture) => ({ name: fixture.name, result: fixture.expected })));

  const original = EXCEL_COMPARE_HEADER_CASES.slice(0, 22);
  assert.deepEqual(countReasons(original), { suggested: 12, uncertain: 8, none: 2 });
  assert.equal(original.filter((fixture) => fixture.semanticFalseSuggestion).length, 5);
  assert.deepEqual(actual.at(-1), { name: "vertical-prefix", result: { row: null, reason: "uncertain" } });
});

test("all 23 fixtures are parsed and classified through every supported adapter", async (t) => {
  const formats = Object.keys(EXCEL_COMPARE_HEADER_FORMAT_EXPECTATIONS) as HeaderFixtureFormat[];
  let assertionCount = 0;
  for (const format of formats) {
    await t.test(`${format} has an explicit 23-case expectation table`, async () => {
      const expectations = EXCEL_COMPARE_HEADER_FORMAT_EXPECTATIONS[format];
      assert.equal(expectations.length, 23);
      assert.deepEqual(expectations.map((item) => item.name), EXCEL_COMPARE_HEADER_CASES.map((item) => item.name));
      for (const expectation of expectations) {
        const fixture = EXCEL_COMPARE_HEADER_CASES.find((item) => item.name === expectation.name)!;
        const { fileName, buffer } = serializeFixture(fixture, format);
        const parsed = await parseSpreadsheetInput(fileName, buffer);
        assert.equal(parsed.format, format);
        assert.deepEqual(detectExcelCompareHeader(parsed.sheets[0]), expectation.expected, `${format}:${fixture.name}`);
        assertionCount += 1;
      }
    });
  }
  assert.equal(assertionCount, 138);
});

test("initial inspection returns suggestions and requested plus candidate headers in one result", () => {
  const suggested = sheetFromFixture(EXCEL_COMPARE_HEADER_CASES.find((item) => item.name === "merged-title")!);
  const uncertain = sheetFromFixture(EXCEL_COMPARE_HEADER_CASES.find((item) => item.name === "vertical-prefix")!);
  suggested.name = "Suggested";
  uncertain.name = "Uncertain";
  const inspection = buildExcelCompareInspection("book.xlsx", bookWithSheets([suggested, uncertain]), [1, 5], true);

  assert.deepEqual(inspection.sheets[0].headerSuggestion, { row: 3, reason: "suggested" });
  assert.deepEqual(inspection.sheets[0].headerRows.map((item) => item.row), [1, 5, 3]);
  assert.deepEqual(inspection.sheets[1].headerSuggestion, { row: null, reason: "uncertain" });
  assert.deepEqual(inspection.sheets[1].headerRows.map((item) => item.row), [1, 5]);

  const manualInspection = buildExcelCompareInspection("book.xlsx", bookWithSheets([suggested, uncertain]), [4], false);
  assert.deepEqual(manualInspection.sheets.map((sheet) => sheet.headerRows.map((item) => item.row)), [[4], [4]]);
  assert.ok(manualInspection.sheets.every((sheet) => sheet.headerSuggestion === undefined));
});

test("the first judgeable formula or error row stops detection as uncertain", () => {
  const formulaSheet = sheetFromFixture({
    name: "formula", rows: [["ID", "Computed", "Other"], ["A", "Alice", 1], ["B", "Bob", 2]], merges: [], intendedHeaderRow: 1,
    expected: { row: null, reason: "uncertain" },
  });
  for (const cell of formulaSheet.cells.filter((cell) => cell.row === 1 && cell.column > 1)) {
    cell.formula = "A1";
    cell.type = "number";
    cell.value = 1;
  }
  assert.deepEqual(detectExcelCompareHeader(formulaSheet), { row: null, reason: "uncertain" });

  const errorSheet = sheetFromFixture({
    name: "error", rows: [["ID", "Name", "Amount"], ["A", "Alice", 1], ["B", "Bob", 2]], merges: [], intendedHeaderRow: 1,
    expected: { row: null, reason: "uncertain" },
  });
  for (const cell of errorSheet.cells.filter((cell) => cell.row === 1 && cell.column > 1)) {
    cell.type = "error";
    cell.value = "#VALUE!";
  }
  assert.deepEqual(detectExcelCompareHeader(errorSheet), { row: null, reason: "uncertain" });
});

test("inspection requests cancel by pair and side and stale completions cannot finish the owner", () => {
  const requests = new ExcelCompareInspectionRequests();
  const firstFile = new File(["first"], "first.xlsx");
  const secondFile = new File(["second"], "second.xlsx");
  const first = requests.begin(4, "left", firstFile);
  const otherSide = requests.begin(4, "right", firstFile);
  const replacement = requests.begin(4, "left", secondFile);
  assert.equal(first.controller.signal.aborted, true);
  assert.equal(requests.isCurrent(first), false);
  assert.equal(requests.finish(first), false);
  assert.equal(requests.isCurrent(replacement), true);
  requests.cancelPair(4);
  assert.equal(replacement.controller.signal.aborted, true);
  assert.equal(otherSide.controller.signal.aborted, true);

  const next = requests.begin(5, "left", firstFile);
  requests.cancelAll();
  assert.equal(next.controller.signal.aborted, true);
  assert.equal(requests.isCurrent(next), false);
});

test("an aborted inspection never creates a worker before or after file reading", async () => {
  const originalWorker = globalThis.Worker;
  let workerConstructions = 0;
  globalThis.Worker = class {
    constructor() { workerConstructions += 1; }
  } as unknown as typeof Worker;
  try {
    const preAborted = new AbortController();
    preAborted.abort();
    let preRead = false;
    const preFile = { name: "pre.xlsx", arrayBuffer: async () => { preRead = true; return new ArrayBuffer(1); } } as File;
    await assert.rejects(inspectExcelCompareFile(preFile, "en", preAborted.signal), { name: "AbortError" });
    assert.equal(preRead, false);

    const postAborted = new AbortController();
    const postFile = {
      name: "post.xlsx",
      arrayBuffer: async () => {
        postAborted.abort();
        return new ArrayBuffer(1);
      },
    } as File;
    await assert.rejects(inspectExcelCompareFile(postFile, "en", postAborted.signal), { name: "AbortError" });
    assert.equal(workerConstructions, 0);
  } finally {
    globalThis.Worker = originalWorker;
  }
});

function countReasons(fixtures: ExcelCompareHeaderCase[]) {
  return fixtures.reduce((counts, fixture) => {
    counts[fixture.expected.reason] += 1;
    return counts;
  }, { suggested: 0, uncertain: 0, none: 0 });
}

function sheetFromFixture(fixture: ExcelCompareHeaderCase): SpreadsheetSheetData {
  const cells: SpreadsheetCellData[] = [];
  fixture.rows.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
    if (value === null || value === undefined) return;
    const rowNumber = rowIndex + 1;
    const columnNumber = columnIndex + 1;
    cells.push({
      row: rowNumber,
      column: columnNumber,
      address: XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex }),
      type: typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string",
      value: value as string | number | boolean,
      sourceRow: rowNumber,
      sourceColumn: columnNumber,
      rowLineageId: `row:${rowNumber}`,
      columnLineageId: `column:${columnNumber}`,
    });
  }));
  return {
    name: fixture.name,
    rowCount: fixture.rows.length,
    columnCount: fixture.rows.reduce((maximum, row) => Math.max(maximum, row.length), 0),
    cells,
    merges: fixture.merges,
    rowLineage: [],
    columnLineage: [],
    tables: [],
  };
}

function bookWithSheets(sheets: SpreadsheetSheetData[]): SpreadsheetBookData {
  return { format: "xlsx", date1904: false, supportsStyleComparison: true, definedNames: [], sheets };
}

function serializeFixture(fixture: ExcelCompareHeaderCase, format: HeaderFixtureFormat) {
  const worksheet = XLSX.utils.aoa_to_sheet(fixture.rows);
  worksheet["!merges"] = fixture.merges.map((range) => XLSX.utils.decode_range(range));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  const config: Record<HeaderFixtureFormat, { bookType: "xlsx" | "xlsm" | "biff8" | "xlsb" | "xlml" | "csv"; extension: string; parsed: SpreadsheetInputFormat }> = {
    xlsx: { bookType: "xlsx", extension: "xlsx", parsed: "xlsx" },
    xlsm: { bookType: "xlsm", extension: "xlsm", parsed: "xlsm" },
    xls: { bookType: "biff8", extension: "xls", parsed: "xls" },
    xlsb: { bookType: "xlsb", extension: "xlsb", parsed: "xlsb" },
    spreadsheetml: { bookType: "xlml", extension: "xls", parsed: "spreadsheetml" },
    csv: { bookType: "csv", extension: "csv", parsed: "csv" },
  };
  const selected = config[format];
  void selected.parsed;
  return {
    fileName: `${fixture.name}.${selected.extension}`,
    buffer: XLSX.write(workbook, { bookType: selected.bookType, type: "array" }) as ArrayBuffer,
  };
}
