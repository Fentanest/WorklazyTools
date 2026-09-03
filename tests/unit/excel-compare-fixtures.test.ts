import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import JSZip from "jszip";
import XLSX from "xlsx";

import { compareSpreadsheetPair } from "../../src/features/excel-compare/compareEngine.ts";
import { DEFAULT_EXCEL_COMPARE_OPTIONS, type ExcelComparePairOptions } from "../../src/features/excel-compare/types.ts";
import { parseSpreadsheetInput } from "../../src/features/spreadsheet-core/inputAdapter.ts";

test("synthetic format fixtures preserve BIFF8/XLSB formulas, real XLSM VBA and 1900/1904 dates", async (context) => {
  const output = path.join(tmpdir(), `worklazy-excel-compare-${process.pid}-${Date.now()}`);
  context.after(() => rm(output, { recursive: true, force: true }));
  const generation = execFileSync(process.execPath, ["scripts/generate-excel-compare-fixtures.mjs", output], { encoding: "utf8" });
  const manifest = JSON.parse(generation) as { vbaProjectBytes: number };
  assert.equal(manifest.vbaProjectBytes, 15_872);

  const biff8 = await parse(output, "formula-biff8.xls");
  const xlsb = await parse(output, "formula.xlsb");
  const spreadsheetMl = await parse(output, "spreadsheetml.xls");
  assert.equal(biff8.format, "xls");
  assert.equal(biff8.sheets[0].cells.find((cell) => cell.address === "A1")?.formula, "7");
  assert.equal(xlsb.format, "xlsb");
  assert.equal(xlsb.sheets[0].cells.find((cell) => cell.address === "B1")?.formula, "A1");
  assert.equal(spreadsheetMl.format, "spreadsheetml");
  assert.equal(spreadsheetMl.sheets[0].cells.find((cell) => cell.address === "B1")?.formula, "A1");
  assert.equal(biff8.supportsStyleComparison, false);
  assert.equal(xlsb.supportsStyleComparison, false);

  const macroBytes = await readFile(path.join(output, "macro.xlsm"));
  const macroArchive = await JSZip.loadAsync(macroBytes);
  const vbaProject = await macroArchive.file("xl/vbaProject.bin")?.async("nodebuffer");
  assert.ok(vbaProject);
  const cfb = XLSX.CFB.read(vbaProject, { type: "buffer" });
  assert.ok(XLSX.CFB.find(cfb, "/VBA/Module1"));
  assert.match(Buffer.from(XLSX.CFB.find(cfb, "/PROJECT")!.content).toString("latin1"), /Module=Module1/u);
  const macro = await parse(output, "macro.xlsm");
  assert.equal(macro.format, "xlsm");
  assert.equal(macro.supportsStyleComparison, true);
  assert.equal(macro.sheets[0].cells.find((cell) => cell.address === "D2")?.formula, "B2+C2");

  const date1900 = await parse(output, "date-1900.xlsx");
  const date1904 = await parse(output, "date-1904.xlsx");
  assert.equal(date1900.date1904, false);
  assert.equal(date1904.date1904, true);
  assert.deepEqual(
    date1904.sheets[0].cells.filter((cell) => cell.row === 2).map((cell) => [cell.value, cell.displayValue]),
    date1900.sheets[0].cells.filter((cell) => cell.row === 2).map((cell) => [cell.value, cell.displayValue]),
  );
  const options: ExcelComparePairOptions = {
    mode: "position",
    left: { sheetName: "Dates", headerRow: 1 },
    right: { sheetName: "Dates", headerRow: 1 },
    normalization: { ...DEFAULT_EXCEL_COMPARE_OPTIONS },
  };
  assert.equal(compareSpreadsheetPair(date1900, date1904, options).summary.changed, 0);
});

async function parse(directory: string, name: string) {
  const buffer = await readFile(path.join(directory, name));
  return parseSpreadsheetInput(name, buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
}
