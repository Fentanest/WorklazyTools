import fs from "node:fs/promises";
import path from "node:path";

import ExcelJS from "exceljs";

const outputDirectory = path.resolve(process.argv[2] || "/tmp/worklazy-excel-cleaner-fixtures");
await fs.mkdir(outputDirectory, { recursive: true });

await write("formula.xlsx", formulaWorkbook());
await write("complex-formula.xlsx", complexFormulaWorkbook());
await write("missing-cache.xlsx", missingCacheWorkbook());
await write("merged.xlsx", mergedWorkbook());
await write("date-1900.xlsx", dateWorkbook(false));
await write("date-1904.xlsx", dateWorkbook(true));
await write("header-mismatch.xlsx", headerMismatchWorkbook());
await fs.writeFile(path.join(outputDirectory, "dangerous.csv"), "Name,Value\r\n Alice ,=1+1\r\nBob,+2\r\n", "utf8");
await fs.writeFile(path.join(outputDirectory, "damaged.xlsx"), Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x00]));

console.log(JSON.stringify({
  outputDirectory,
  fixtures: ["formula.xlsx", "complex-formula.xlsx", "missing-cache.xlsx", "merged.xlsx", "date-1900.xlsx", "date-1904.xlsx", "header-mismatch.xlsx", "dangerous.csv", "damaged.xlsx"],
  golden: {
    rowDelete: '#REF!+$B$2+SUM(C2:D4)+"A2"',
    columnDelete: "#REF!+A2:B2",
    columnInsert: "C2+A2:D2",
    noncontiguousReorder: "cached value only",
  },
}, null, 2));

function workbook() {
  const value = new ExcelJS.Workbook();
  value.creator = "Worklazy Tools fixture generator";
  value.created = new Date("2026-09-03T00:00:00.000Z");
  value.modified = value.created;
  return value;
}

function formulaWorkbook() {
  const value = workbook();
  const sheet = value.addWorksheet("Data");
  sheet.addRow(["A", "B", "C", "Relative", "Absolute", "Range", "Danger"]);
  sheet.addRow([1, 2, 3]);
  sheet.addRow([4, 5, 6]);
  sheet.getCell("D2").value = { formula: "A2+B2", result: 3 };
  sheet.getCell("E2").value = { formula: "$A$2+B2", result: 3 };
  sheet.getCell("F2").value = { formula: "SUM(A2:C2)", result: 6 };
  sheet.getCell("D3").value = { formula: "A3+B3", result: 9 };
  sheet.getCell("G2").value = "=1+1";
  return value;
}

function complexFormulaWorkbook() {
  const value = workbook();
  const sheet = value.addWorksheet("Complex");
  sheet.addRow(["A", "B", "Shared", "Array", "Table value"]);
  sheet.addRow([1, 2, null, null, 10]);
  sheet.addRow([3, 4, null, null, 20]);
  sheet.fillFormula("C2:C3", "A2+B2", [3, 7], "shared");
  sheet.fillFormula("D2:D3", "A2:A3*2", [2, 6], "array");
  value.definedNames.add("Complex!$A$2", "NamedInput");
  sheet.addTable({ name: "FixtureTable", ref: "E1", headerRow: true, totalsRow: false, style: { theme: "TableStyleMedium2", showRowStripes: true }, columns: [{ name: "Table value" }], rows: [[10], [20]] });
  return value;
}

function missingCacheWorkbook() {
  const value = workbook();
  const sheet = value.addWorksheet("Missing Cache");
  sheet.addRow(["Input", "Formula"]);
  sheet.addRow([7, null]);
  sheet.getCell("B2").value = { formula: "A2*2" };
  return value;
}

function mergedWorkbook() {
  const value = workbook();
  const sheet = value.addWorksheet("Merged");
  sheet.addRow(["Group", "Detail", "Amount"]);
  sheet.addRow(["North", null, 10]);
  sheet.addRow([null, null, 20]);
  sheet.mergeCells("A2:B3");
  return value;
}

function dateWorkbook(date1904) {
  const value = workbook();
  value.properties.date1904 = date1904;
  const sheet = value.addWorksheet(date1904 ? "Dates 1904" : "Dates 1900");
  sheet.addRow(["Date", "Serial"]);
  sheet.addRow([new Date("2024-02-29T00:00:00.000Z"), date1904 ? 43889 : 45351]);
  sheet.getCell("A2").numFmt = "yyyy-mm-dd";
  return value;
}

function headerMismatchWorkbook() {
  const value = workbook();
  value.addWorksheet("Valid").addRows([["Name", "Value"], [" Alice ", "=1+1"]]);
  value.addWorksheet("Mismatch").addRows([["Different", "Columns"], [" Bob ", "+2"]]);
  return value;
}

async function write(name, value) {
  await value.xlsx.writeFile(path.join(outputDirectory, name));
}
