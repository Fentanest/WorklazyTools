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
import { writeUntrustedText, writeXlsxReport } from "../../src/utils/xlsxReport.ts";

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
