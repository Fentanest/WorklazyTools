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
import { appendXlsxReportSheets, writeUntrustedText, writeXlsxReport } from "../../src/utils/xlsxReport.ts";

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
