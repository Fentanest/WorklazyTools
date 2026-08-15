import assert from "node:assert/strict";
import test from "node:test";

import ExcelJS from "exceljs";

import { hasIncomingSheetReference } from "../../src/features/excel-merger/sheetReferences.ts";

test("detects cross-sheet formulas before trimming referenced sheet edges", () => {
  const workbook = new ExcelJS.Workbook();
  const source = workbook.addWorksheet("원본 자료");
  const summary = workbook.addWorksheet("Summary");
  const isolated = workbook.addWorksheet("Isolated");
  source.getCell("A1").value = 10;
  source.getCell("B1").value = { formula: "A1 * 2", result: 20 };
  summary.getCell("A1").value = { formula: "SUM('원본 자료'!A1:B1)", result: 30 };

  assert.equal(hasIncomingSheetReference(workbook, source), true);
  assert.equal(hasIncomingSheetReference(workbook, summary), false);
  assert.equal(hasIncomingSheetReference(workbook, isolated), false);
});
