import assert from "node:assert/strict";
import test from "node:test";

import ExcelJS from "exceljs";
import * as XLSX from "xlsx";

import {
  classifySpreadsheetInput,
  parseSpreadsheetInput,
  spreadsheetHeaders,
} from "../../src/features/spreadsheet-core/inputAdapter.ts";
import {
  createUniqueSafeFileName,
  SafeFileNameRegistry,
  UnsafeFileNameError,
  validateSafeFileName,
} from "../../src/utils/fileNameSafety.ts";
import {
  appendXlsxReportSheets,
  assertXlsxWorkbookXmlTextSafe,
  sanitizeXlsxText,
  writeUntrustedText,
  writeXlsxReport,
  writeXlsxWorkbook,
} from "../../src/utils/xlsxReport.ts";
import { assertVisibleXlsxReport } from "../xlsx-report-assertions.mjs";

test("spreadsheet adapter classifies OOXML from package contents and parses it only once into the common model", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Data");
  sheet.getCell("A1").value = "ID";
  sheet.getCell("B1").value = "Amount";
  sheet.getCell("A2").value = "001";
  sheet.getCell("B2").value = { formula: "1+2", result: 3 };
  sheet.getCell("B2").numFmt = "0.00";
  sheet.mergeCells("C1:D1");
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer());

  assert.equal(await classifySpreadsheetInput("wrong.xls", bytes), "xlsx");
  const parsed = await parseSpreadsheetInput("wrong.xls", bytes.slice().buffer);
  assert.equal(parsed.format, "xlsx");
  assert.equal(parsed.supportsStyleComparison, true);
  assert.deepEqual(parsed.sheets[0].merges, ["C1:D1"]);
  assert.deepEqual(spreadsheetHeaders(parsed.sheets[0], 1).slice(0, 2), [
    { column: 1, name: "ID" },
    { column: 2, name: "Amount" },
  ]);
  const formula = parsed.sheets[0].cells.find((cell) => cell.address === "B2");
  assert.equal(formula?.formula, "1+2");
  assert.equal(formula?.cachedValue, 3);
  assert.equal(formula?.displayValue, "3.00");
});

test("OOXML errors retain their type without changing scalar values or formula cache states", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Errors");
  const errors = ["#DIV/0!", "#N/A", "#REF!", "#VALUE!", "#NAME?", "#NUM!", "#NULL!"] as const;
  errors.forEach((error, index) => { sheet.getCell(1, index + 1).value = { error }; });
  sheet.getCell("A2").value = "#DIV/0!";
  sheet.getCell("B2").value = "#N/A";
  sheet.getCell("C2").value = { formula: "1/0", result: { error: "#DIV/0!" } };
  sheet.getCell("D2").value = { formula: "NA()" };
  sheet.getCell("E2").value = true;
  sheet.getCell("F2").value = 7;
  sheet.getCell("G2").value = new Date("2024-02-29T00:00:00.000Z");

  const parsed = await parseSpreadsheetInput("errors.xlsx", transferable(await workbook.xlsx.writeBuffer()));
  const cells = new Map(parsed.sheets[0].cells.map((cell) => [cell.address, cell]));
  errors.forEach((error, index) => {
    const cell = cells.get(`${String.fromCharCode(65 + index)}1`);
    assert.deepEqual([cell?.value, cell?.displayValue, cell?.type], [error, error, "error"]);
  });
  assert.deepEqual([cells.get("A2")?.value, cells.get("A2")?.type], ["#DIV/0!", "string"]);
  assert.deepEqual([cells.get("B2")?.value, cells.get("B2")?.type], ["#N/A", "string"]);
  assert.deepEqual(
    [cells.get("C2")?.value, cells.get("C2")?.cachedValue, cells.get("C2")?.type, cells.get("C2")?.cacheState],
    ["#DIV/0!", "#DIV/0!", "error", "present"],
  );
  assert.deepEqual(
    [cells.get("D2")?.value, cells.get("D2")?.cachedValue, cells.get("D2")?.type, cells.get("D2")?.cacheState],
    [null, undefined, "blank", "missing"],
  );
  assert.deepEqual([cells.get("E2")?.value, cells.get("E2")?.type], [true, "boolean"]);
  assert.deepEqual([cells.get("F2")?.value, cells.get("F2")?.type], [7, "number"]);
  assert.deepEqual([cells.get("G2")?.value instanceof Date, cells.get("G2")?.type], [true, "date"]);
});

test("spreadsheet adapter uses SheetJS for BIFF8/XLSB and Papa Parse for CSV text", async () => {
  const source = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([["Key", "Value"], ["001", 7]]);
  sheet.B2.f = "3+4";
  sheet.B2.v = 7;
  sheet.B2.z = "0.0";
  XLSX.utils.book_append_sheet(source, sheet, "Ledger");

  for (const [bookType, expected] of [["biff8", "xls"], ["xlsb", "xlsb"]] as const) {
    const bytes = XLSX.write(source, { bookType, type: "array", cellStyles: true }) as ArrayBuffer;
    assert.equal(await classifySpreadsheetInput(`fixture.${expected}`, new Uint8Array(bytes)), expected);
    const parsed = await parseSpreadsheetInput(`fixture.${expected}`, bytes);
    assert.equal(parsed.format, expected);
    assert.equal(parsed.supportsStyleComparison, false);
    assert.equal(parsed.sheets[0].cells.find((cell) => cell.address === "B2")?.value, 7);
    assert.equal(parsed.sheets[0].cells.find((cell) => cell.address === "B2")?.displayValue, "7.0");
  }

  const csv = new TextEncoder().encode("Code,Name\r\n001, Alpha \r\n");
  const parsedCsv = await parseSpreadsheetInput("fixture.csv", csv.buffer);
  assert.equal(parsedCsv.format, "csv");
  assert.equal(parsedCsv.sheets[0].cells.find((cell) => cell.address === "A2")?.value, "001");
  assert.equal(parsedCsv.sheets[0].cells.find((cell) => cell.address === "B2")?.value, " Alpha ");
});

test("OOXML editing metadata distinguishes formula kinds, cached values, names, tables, and source lineage", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Data");
  sheet.addRows([["Input", "Shared", "Zero", "False", "Empty", "Missing", "Error", "TableValue"], [1], [2]]);
  sheet.fillFormula("B2:B3", "A2*2", [2, 4]);
  sheet.getCell("C2").value = { formula: "1-1", result: 0 };
  sheet.getCell("D2").value = { formula: "1=2", result: false };
  sheet.getCell("E2").value = { formula: "\"\"", result: "" };
  sheet.getCell("F2").value = { formula: "NOW()" };
  sheet.getCell("G2").value = { formula: "1/0", result: { error: "#DIV/0!" } };
  sheet.getCell("H2").value = "value";
  sheet.getCell("I2").value = { formula: "SUM(A2:A3)", result: 3, shareType: "array", ref: "I2:I3" } as ExcelJS.CellValue;
  workbook.definedNames.add("Data!$A$2:$A$3", "InputRange");
  sheet.addTable({ name: "InputTable", ref: "H1", headerRow: true, totalsRow: false, style: { theme: "TableStyleMedium2" }, columns: [{ name: "TableValue" }], rows: [["value"]] });

  const parsed = await parseSpreadsheetInput("metadata.xlsx", transferable(await workbook.xlsx.writeBuffer()));
  const cells = new Map(parsed.sheets[0].cells.map((cell) => [cell.address, cell]));
  assert.equal(cells.get("B2")?.formulaType, "shared");
  assert.equal(cells.get("B2")?.formulaRef, "B2:B3");
  assert.equal(cells.get("B3")?.formulaType, "shared");
  assert.equal(cells.get("B3")?.sharedFormulaMaster, "B2");
  assert.equal(cells.get("I2")?.formulaType, "array");
  assert.equal(cells.get("I2")?.formulaRef, "I2:I3");
  for (const address of ["B2", "C2", "D2", "E2", "G2"]) assert.equal(cells.get(address)?.cacheState, "present", address);
  assert.equal(cells.get("F2")?.cacheState, "missing");
  assert.equal(cells.get("C2")?.cachedValue, 0);
  assert.equal(cells.get("D2")?.cachedValue, false);
  assert.equal(cells.get("E2")?.cachedValue, "");
  assert.equal(cells.get("G2")?.cachedValue, "#DIV/0!");
  assert.deepEqual(parsed.definedNames.map(({ name, ranges, formula }) => ({ name, ranges, formula })), [{ name: "InputRange", ranges: ["Data!$A$2:$A$3"], formula: "Data!$A$2:$A$3" }]);
  assert.deepEqual(parsed.sheets[0].tables.map(({ name, ref, columns }) => ({ name, ref, columns })), [{ name: "InputTable", ref: "H1:H2", columns: ["TableValue"] }]);
  assert.equal(cells.get("H2")?.rowLineageId, "row:2");
  assert.equal(cells.get("H2")?.columnLineageId, "column:8");
  assert.deepEqual(parsed.sheets[0].columnLineage[7], { id: "column:8", sourceColumn: 8 });
});

test("file-name safety blocks traversal, controls and reserved names and resolves normalized collisions", () => {
  for (const unsafe of ["", "../report.xlsx", "folder/report.xlsx", "bad\u0000.xlsx", "CON.xlsx", "name. "]) {
    assert.throws(() => validateSafeFileName(unsafe), UnsafeFileNameError);
  }
  const registry = new SafeFileNameRegistry();
  assert.equal(createUniqueSafeFileName("Cafe\u0301.xlsx", registry), "Café.xlsx");
  assert.equal(createUniqueSafeFileName("Café.xlsx", registry), "Café-2.xlsx");
  assert.equal(createUniqueSafeFileName("../CON?.xlsx", registry), "_CON_.xlsx");
});

test("writeUntrustedText stores every external value as text without formula coercion", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Boundary");
  const values: unknown[] = ["=1+1", "+2", "-3", "@cmd", "\tvalue", "\r\nvalue", " leading", { formula: "1+1", result: 2 }];
  values.forEach((value, index) => writeUntrustedText(sheet.getCell(index + 1, 1), value));
  values.forEach((_value, index) => {
    assert.equal(typeof sheet.getCell(index + 1, 1).value, "string");
    assert.equal(sheet.getCell(index + 1, 1).numFmt, "@");
  });
  assert.equal(sheet.getCell(8, 1).value, "[object Object]");

  const output = await writeXlsxReport({ sheets: [{ name: "Rows", headers: ["Value"], rows: values.map((value) => [value]) }] });
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(output);
  const reopenedSheet = reopened.getWorksheet("Rows")!;
  values.forEach((_value, index) => assert.equal(typeof reopenedSheet.getCell(index + 2, 1).value, "string"));
  assert.equal(reopenedSheet.getCell(9, 1).value, "[object Object]");
});

test("XLSX text boundaries replace XML 1.0-disallowed characters without deleting positions", async () => {
  const disallowedControls = Array.from({ length: 0x20 }, (_, codeUnit) => codeUnit)
    .filter((codeUnit) => codeUnit !== 0x09 && codeUnit !== 0x0a && codeUnit !== 0x0d)
    .map((codeUnit) => String.fromCharCode(codeUnit))
    .join("");
  const fddNoncharacters = Array.from({ length: 0x20 }, (_, index) => String.fromCodePoint(0xfdd0 + index)).join("");
  const normal = `한글😀&<>"'\t\n\r${fddNoncharacters}`;
  const source = `앞${disallowedControls}중\uFFFE\uFFFF\uD800뒤\uDC00${normal}`;
  const expected = `앞${"\uFFFD".repeat(29)}중\uFFFD\uFFFD\uFFFD뒤\uFFFD${normal}`;
  assert.equal(sanitizeXlsxText(source), expected);
  assert.equal(expected.length, source.length);
  assert.equal(sanitizeXlsxText(normal), normal);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Boundary");
  writeUntrustedText(sheet.getCell("A1"), source);
  assert.equal(sheet.getCell("A1").value, expected);

  const output = await writeXlsxReport({
    sheets: [
      { name: "이름\uFFFE😀\uD800", headers: [normal], rows: [[source]] },
      { name: "이름\uFFFF😀\uDC00", headers: ["Value"], rows: [["visible"]] },
    ],
  });
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(output);
  assert.deepEqual(reopened.worksheets.map((worksheet) => worksheet.name), ["이름�😀�", "이름�😀� (2)"]);
  assert.equal(reopened.worksheets[0].getCell("A1").value, normal.replace("\r", "\n"));
  assert.equal(reopened.worksheets[0].getCell("A2").value, expected.replace("\r", "\n"));
});

test("XLSX value-and-number-format backstop rejects disallowed text that bypasses writer boundaries", () => {
  for (const value of ["raw\u0000value", "raw\uFFFEvalue", "raw\uFFFFvalue", "raw\uD800value", "raw\uDC00value"]) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Raw");
    sheet.getCell("A1").value = value;
    assert.throws(
      () => assertXlsxWorkbookXmlTextSafe(workbook),
      (error: Error & { code?: string }) => error.code === "REPORT_INTEGRITY_FAILED" && error.message === "REPORT_INTEGRITY_FAILED",
    );
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Raw\uFFFE");
  sheet.getCell("A1").value = "visible";
  assert.throws(
    () => assertXlsxWorkbookXmlTextSafe(workbook),
    (error: Error & { code?: string }) => error.code === "REPORT_INTEGRITY_FAILED",
  );

  for (const numberFormat of ["0\"A\u0000B\"", "0\"A\uFFFEB\"", "0\"A\uFFFFB\"", "0\"A\uD800B\"", "0\"A\uDC00B\""]) {
    const numberFormatWorkbook = new ExcelJS.Workbook();
    const numberFormatSheet = numberFormatWorkbook.addWorksheet("Raw");
    numberFormatSheet.getCell("C7").style = { numFmt: numberFormat };
    assert.equal(numberFormatSheet.getCell("C7").value, null);
    assert.throws(
      () => assertXlsxWorkbookXmlTextSafe(numberFormatWorkbook),
      (error: Error & { code?: string }) => error.code === "REPORT_INTEGRITY_FAILED",
    );
  }

  const safeWorkbook = new ExcelJS.Workbook();
  const safeSheet = safeWorkbook.addWorksheet("Safe");
  const fddNoncharacters = Array.from({ length: 0x20 }, (_, index) => String.fromCodePoint(0xfdd0 + index)).join("");
  ["#,##0.00;[Red]-#,##0.00", "yyyy-mm-dd", `0\"한글😀₩$${fddNoncharacters}\"`].forEach((numberFormat, index) => {
    safeSheet.getCell(index + 1, 1).numFmt = numberFormat;
  });
  assert.doesNotThrow(() => assertXlsxWorkbookXmlTextSafe(safeWorkbook));
});

test("XLSX backstop rejects six value and eight number-format paths before serialization", async () => {
  const valueInjections: Array<[string, (workbook: ExcelJS.Workbook, sheet: ExcelJS.Worksheet) => void]> = [
    ["name", (_workbook, sheet) => { sheet.name = "Unsafe\uFFFE"; }],
    ["scalar", (_workbook, sheet) => { sheet.getCell("A2").value = "Unsafe\uFFFE"; }],
    ["formula", (_workbook, sheet) => { sheet.getCell("A2").value = { formula: "1+\uFFFE", result: 1 }; }],
    ["cache", (_workbook, sheet) => { sheet.getCell("A2").value = { formula: "1+1", result: "Unsafe\uFFFE" }; }],
    ["rich-text", (_workbook, sheet) => { sheet.getCell("A2").value = { richText: [{ text: "Unsafe\uFFFE" }] }; }],
    ["hyperlink", (_workbook, sheet) => { sheet.getCell("A2").value = { text: "Link", hyperlink: "https://example.com/\uFFFE" }; }],
  ];
  const numberFormatInjections: Array<[string, (sheet: ExcelJS.Worksheet) => void]> = [
    ["cell-numFmt", (sheet) => { sheet.getCell("A2").numFmt = "0\"\uFFFE\""; }],
    ["style-numFmt", (sheet) => { sheet.getCell("A2").style = { numFmt: "0\"\uFFFF\"" }; }],
    ["empty-row-numFmt", (sheet) => { sheet.getCell("A50").numFmt = "0\"\uD800\""; }],
    ["sparse-last-column", (sheet) => { sheet.getCell("M2").numFmt = "0\"\u0001\""; }],
    ["row-inherited", (sheet) => { sheet.getRow(2).numFmt = "0\"\uFFFE\""; sheet.getCell("A2"); }],
    ["column-inherited", (sheet) => { sheet.getColumn(2).numFmt = "0\"\uFFFE\""; sheet.getCell("B2"); }],
    ["row-style-without-cell", (sheet) => { sheet.getCell("C2").value = 123; sheet.getRow(2).style = { numFmt: "0\"\uFFFE\"" }; }],
    ["column-style-without-cell", (sheet) => { sheet.getCell("C2").value = 123; sheet.getColumn(2).style = { numFmt: "0\"\uFFFE\"" }; }],
  ];

  const rejectsBeforeSerialization = async (id: string, setup: (workbook: ExcelJS.Workbook, sheet: ExcelJS.Worksheet) => void) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Safe");
    sheet.getCell("A1").value = "Header";
    setup(workbook, sheet);
    let serializerCalls = 0;
    workbook.xlsx.writeBuffer = async () => {
      serializerCalls += 1;
      return Buffer.from("unexpected serializer call");
    };
    await assert.rejects(
      () => writeXlsxWorkbook(workbook),
      (error: Error & { code?: string }) => error.code === "REPORT_INTEGRITY_FAILED" && error.message === "REPORT_INTEGRITY_FAILED",
      id,
    );
    assert.equal(serializerCalls, 0, id);
  };

  for (const [id, setup] of valueInjections) await rejectsBeforeSerialization(id, setup);
  for (const [id, setup] of numberFormatInjections) {
    await rejectsBeforeSerialization(id, (_workbook, sheet) => setup(sheet));
  }
});

test("XLSX backstop scans existing sparse objects without allocating missing coordinates", () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sparse");
  sheet.getCell("A1").value = "Header";
  sheet.getCell("G25").numFmt = "yyyy-mm-dd";
  sheet.getCell("M50").value = "Tail";
  const before = countExistingWorkbookObjects(workbook);

  assert.deepEqual(before, { rows: 3, cells: 3 });
  assert.doesNotThrow(() => assertXlsxWorkbookXmlTextSafe(workbook));
  assert.deepEqual(countExistingWorkbookObjects(workbook), before);
  assert.equal(sheet.findRow(25)?.findCell(7)?.value, null);
});

test("XLSX backstop preserves safe row and column number formats without allocating coordinates", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Safe");
  sheet.getCell("A1").value = "Header";
  sheet.getCell("C2").value = 123;
  sheet.getCell("G25").numFmt = "yyyy-mm-dd";
  sheet.getColumn(2).style = { numFmt: "0\"열😀\"" };
  sheet.getColumn(20).style = { numFmt: "#,##0.00" };
  sheet.getRow(2).style = { numFmt: "0\"행₩\"" };
  sheet.getRow(75).style = { numFmt: "0.00" };
  sheet.getRow(75).height = 20;
  const before = countExistingWorkbookObjects(workbook);

  assert.deepEqual(before, { rows: 4, cells: 3 });
  assert.doesNotThrow(() => assertXlsxWorkbookXmlTextSafe(workbook));
  assert.deepEqual(countExistingWorkbookObjects(workbook), before);
  assert.equal(sheet.columnCount, 3);
  assert.equal(sheet.columns.length, 20);
  assert.equal(sheet.findRow(2)?.findCell(2), undefined);
  assert.equal(sheet.findRow(75)?.cellCount, 0);

  const output = await writeXlsxWorkbook(workbook);
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(output);
  const reopenedSheet = reopened.getWorksheet("Safe")!;
  assert.equal(reopenedSheet.getCell("C2").value, 123);
  assert.equal(reopenedSheet.getCell("G25").numFmt, "yyyy-mm-dd");
  assert.equal(reopenedSheet.getColumn(2).numFmt, "0\"열😀\"");
  assert.equal(reopenedSheet.getColumn(20).numFmt, "#,##0.00");
  assert.equal(reopenedSheet.getRow(2).numFmt, "0\"행₩\"");
  assert.equal(reopenedSheet.getRow(75).numFmt, "0.00");
});

test("XLSX reports serialize finite positive widths for sparse ExcelJS columns", async () => {
  const output = await writeXlsxReport({
    sheets: [{
      name: "Widths",
      headers: ["First", "Second", "Third", "Fourth"],
      rows: [
        ["short", "a longer value", "한글", 42],
        ["tail", "", null, false],
        [Number.NaN, Number.POSITIVE_INFINITY, undefined, Number.NEGATIVE_INFINITY],
      ],
    }],
  });
  const visibility = await assertVisibleXlsxReport(output);
  assert.equal(visibility.worksheetCount, 1);
  assert.equal(visibility.customWidthColumns, 4);
  assert.ok(visibility.widths.every((width) => Number.isFinite(width) && width >= 12 && width <= 48));
});

test("XLSX reports size a 50,000-row column without argument overflow", async () => {
  const output = await writeXlsxReport({
    sheets: [{
      name: "Large",
      headers: ["Value"],
      rows: Array.from({ length: 50_000 }, (_, index) => [`row-${index}`]),
    }],
  });
  const visibility = await assertVisibleXlsxReport(output);
  assert.equal(visibility.customWidthColumns, 1);
  assert.equal(visibility.dataRows, 50_000);
});

test("appendXlsxReportSheets preserves cleaned sheets and resolves report-name collisions deterministically", () => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Summary").getCell("A1").value = "cleaned";
  const names = appendXlsxReportSheets(workbook, [
    { name: "Summary", headers: ["Value"], rows: [["=1+1"]] },
    { name: "Summary", headers: ["Value"], rows: [["second"]] },
    { name: "Invalid/Report", headers: [], rows: [] },
  ]);
  assert.deepEqual(names, ["Summary (2)", "Summary (3)", "Invalid Report"]);
  assert.equal(workbook.getWorksheet("Summary")?.getCell("A1").value, "cleaned");
  assert.equal(workbook.getWorksheet("Summary (2)")?.getCell("A2").value, "=1+1");
  assert.equal(workbook.getWorksheet("Summary (2)")?.getCell("A2").numFmt, "@");
});

function transferable(value: ExcelJS.Buffer): ArrayBuffer {
  if (value instanceof ArrayBuffer) return value;
  const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return bytes.slice().buffer;
}

function countExistingWorkbookObjects(workbook: ExcelJS.Workbook) {
  let rows = 0;
  let cells = 0;
  for (const worksheet of workbook.worksheets) {
    for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.findRow(rowNumber);
      if (!row) continue;
      rows += 1;
      for (let columnNumber = 1; columnNumber <= row.cellCount; columnNumber += 1) {
        if (row.findCell(columnNumber)) cells += 1;
      }
    }
  }
  return { rows, cells };
}
