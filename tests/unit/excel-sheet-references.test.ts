import assert from "node:assert/strict";
import test from "node:test";

import ExcelJS from "exceljs";

import { buildIncomingSheetReferenceIndex, hasIncomingSheetReference } from "../../src/features/excel-merger/sheetReferences.ts";

test("detects cross-sheet formulas before trimming referenced sheet edges", () => {
  const workbook = new ExcelJS.Workbook();
  const source = workbook.addWorksheet("원본 자료");
  const summary = workbook.addWorksheet("Summary");
  const isolated = workbook.addWorksheet("Isolated");
  const apostrophe = workbook.addWorksheet("팀's 자료");
  source.getCell("A1").value = 10;
  source.getCell("B1").value = { formula: "A1 * 2", result: 20 };
  summary.getCell("A1").value = { formula: "SUM('원본 자료'!A1:B1)", result: 30 };
  summary.getCell("A2").value = { formula: "Isolated!A1+'팀''s 자료'!A1", result: 0 };
  isolated.getCell("B1").value = { formula: "A1 * 3", result: 0 };

  const index = buildIncomingSheetReferenceIndex(workbook);
  assert.equal(hasIncomingSheetReference(workbook, source, index), true);
  assert.equal(hasIncomingSheetReference(workbook, summary, index), false);
  assert.equal(hasIncomingSheetReference(workbook, isolated, index), true);
  assert.equal(hasIncomingSheetReference(workbook, apostrophe, index), true);
});
