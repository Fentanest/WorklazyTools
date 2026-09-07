import assert from "node:assert/strict";
import test from "node:test";

import ExcelJS from "exceljs";
import JSZip from "jszip";

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
import { countWorksheetDataRows, createSharedStringValueLookup } from "../../src/utils/xlsxReportDataRows.mjs";
import { writeXlsxReport } from "../../src/utils/xlsxReport.ts";
import { assertVisibleXlsxReport } from "../xlsx-report-assertions.mjs";

const baseOptions = (): ExcelComparePairOptions => ({
  mode: "position",
  left: { sheetName: "Data", headerRow: 1 },
  right: { sheetName: "Data", headerRow: 1 },
  normalization: { ...DEFAULT_EXCEL_COMPARE_OPTIONS, compareFormatting: false, compareDisplayValues: false },
});

test("report integrity checks keep worker, client, and page responsibilities distinct", async () => {
  const valid = reportArrayBuffer(await writeXlsxReport({ sheets: [{ name: "Report", headers: ["Value"], rows: [["visible"]] }] }));
  await assert.doesNotReject(() => assertGeneratedXlsxReport(valid));
  assert.doesNotThrow(() => assertReceivedXlsxReport(valid, valid.byteLength));
  assert.doesNotThrow(() => assertReportBlobSize(new Blob([valid]), valid.byteLength));
  for (const action of [
    () => assertGeneratedXlsxReport(new ArrayBuffer(0)),
    () => assertGeneratedXlsxReport(Uint8Array.from([1, 2, 3, 4]).buffer),
  ]) {
    await assert.rejects(action, (error: Error & { code?: string }) => error.code === REPORT_INTEGRITY_ERROR_CODE);
  }
  assert.throws(() => assertReceivedXlsxReport(valid, valid.byteLength - 1), (error: Error & { code?: string }) => error.code === REPORT_INTEGRITY_ERROR_CODE);
  assert.throws(() => assertReportBlobSize(new Blob([valid]), valid.byteLength - 1), (error: Error & { code?: string }) => error.code === REPORT_INTEGRITY_ERROR_CODE);
});

test("generated report integrity rejects missing column widths and header-only workbooks", async () => {
  const mutant = new ExcelJS.Workbook();
  const mutantSheet = mutant.addWorksheet("Mutant");
  mutantSheet.addRows([["Value"], ["hidden"]]);
  mutantSheet.getColumn(1).width = Number.NaN;
  const missingWidth = reportArrayBuffer(await mutant.xlsx.writeBuffer());
  const headerOnly = reportArrayBuffer(await writeXlsxReport({ sheets: [{ name: "Empty", headers: ["Value"], rows: [] }] }));
  for (const invalid of [missingWidth, headerOnly]) {
    await assert.rejects(
      () => assertGeneratedXlsxReport(invalid),
      (error: Error & { code?: string }) => error.code === REPORT_INTEGRITY_ERROR_CODE,
    );
  }
});

test("generated report integrity requires a populated cell after the header", async (context) => {
  const rowHeightOnly = new ExcelJS.Workbook();
  const rowHeightSheet = rowHeightOnly.addWorksheet("RowHeight");
  rowHeightSheet.addRow(["Header"]);
  rowHeightSheet.getColumn(1).width = 12;
  rowHeightSheet.getRow(2).height = 20;

  const cellFormatOnly = new ExcelJS.Workbook();
  const cellFormatSheet = cellFormatOnly.addWorksheet("CellFormat");
  cellFormatSheet.addRow(["Header"]);
  cellFormatSheet.getColumn(1).width = 12;
  cellFormatSheet.getCell("A2").numFmt = "@";

  const headersOnly = new ExcelJS.Workbook();
  for (const name of ["First", "Second"]) {
    const sheet = headersOnly.addWorksheet(name);
    sheet.addRow(["Header"]);
    sheet.getColumn(1).width = 12;
  }

  const emptyStringOnly = new ExcelJS.Workbook();
  const emptyStringSheet = emptyStringOnly.addWorksheet("EmptyString");
  emptyStringSheet.addRows([["Header"], [""]]);
  emptyStringSheet.getColumn(1).width = 12;

  const styleBeforeEmptyString = new ExcelJS.Workbook();
  const styleBeforeEmptyStringSheet = styleBeforeEmptyString.addWorksheet("StyleBeforeEmpty");
  styleBeforeEmptyStringSheet.addRow(["Header A", "Header B"]);
  styleBeforeEmptyStringSheet.getColumn(1).width = 12;
  styleBeforeEmptyStringSheet.getColumn(2).width = 12;
  styleBeforeEmptyStringSheet.getCell("A2").numFmt = "@";
  styleBeforeEmptyStringSheet.getCell("B2").value = "";

  for (const [name, workbook] of [
    ["row height only", rowHeightOnly],
    ["cell format only", cellFormatOnly],
    ["headers only", headersOnly],
    ["empty string only", emptyStringOnly],
    ["style before empty string in the same row", styleBeforeEmptyString],
  ] as const) {
    await context.test(name, async () => {
      const bytes = reportArrayBuffer(await workbook.xlsx.writeBuffer());
      assert.equal(await countReopenedPopulatedDataRows(bytes), 0);
      assert.equal((await assertVisibleXlsxReport(bytes)).dataRows, 0);
      await assert.rejects(
        () => assertGeneratedXlsxReport(bytes),
        (error: Error & { code?: string }) => error.code === REPORT_INTEGRITY_ERROR_CODE,
      );
    });
  }
});

test("XLSX data-row scanning matches ExcelJS across cell, value, and placement combinations", async () => {
  const cellKinds = ["self-closing", "empty-c", "v", "shared", "inline", "formula"] as const;
  const placements = ["same-row-before", "same-row-after", "skipped-row", "attribute-only-row"] as const;
  const values = [
    { name: "empty-string", value: "" },
    { name: "space", value: " " },
    { name: "zero", value: 0 },
    { name: "false", value: false },
    { name: "long-string", value: "long".repeat(80) },
    { name: "quotes", value: `'single' and "double"` },
    { name: "greater-than", value: "left>right" },
    { name: "slash", value: "left/right" },
  ] as const;
  const workbook = new ExcelJS.Workbook();
  const cases = [];
  for (const cellKind of cellKinds) {
    for (const [valueIndex, value] of values.entries()) {
      for (const placement of placements) {
        const sheet = workbook.addWorksheet(`Matrix${cases.length + 1}`);
        sheet.addRow(["Header"]);
        sheet.getColumn(1).width = 12;
        sheet.getColumn(2).width = 12;
        sheet.getCell("B4").numFmt = "@";
        cases.push({ sheetName: sheet.name, cellKind, value, valueIndex, placement });
      }
    }
  }
  assert.equal(cases.length, 192);

  const archive = await JSZip.loadAsync(await workbook.xlsx.writeBuffer());
  archive.file("xl/sharedStrings.xml", matrixSharedStringsXml(values));
  for (const [index, matrixCase] of cases.entries()) {
    const path = `xl/worksheets/sheet${index + 1}.xml`;
    const xml = await archive.file(path)?.async("string");
    assert.ok(xml, `missing ${path}`);
    archive.file(path, xml.replace(/<sheetData>[\s\S]*?<\/sheetData>/u, matrixSheetDataXml(matrixCase, index)));
  }
  const bytes = await archive.generateAsync({ type: "arraybuffer" });
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(bytes);
  const generatedArchive = await JSZip.loadAsync(bytes);
  const sharedStringsXml = await generatedArchive.file("xl/sharedStrings.xml")?.async("string");
  assert.ok(sharedStringsXml);
  const sharedStringHasValue = createSharedStringValueLookup(sharedStringsXml);
  let reopenedTotal = 0;
  let scannerTotal = 0;
  for (const [index, matrixCase] of cases.entries()) {
    const reopenedRows = countWorksheetPopulatedDataRows(reopened.getWorksheet(matrixCase.sheetName));
    const worksheetXml = await generatedArchive.file(`xl/worksheets/sheet${index + 1}.xml`)?.async("string");
    assert.ok(worksheetXml);
    const scannedRows = countWorksheetDataRows(worksheetXml, sharedStringHasValue);
    assert.equal(scannedRows, reopenedRows, JSON.stringify(matrixCase));
    reopenedTotal += reopenedRows;
    scannerTotal += scannedRows;
  }
  assert.equal(scannerTotal, reopenedTotal);
  assert.equal((await assertVisibleXlsxReport(bytes)).dataRows, reopenedTotal);
  await assert.doesNotReject(() => assertGeneratedXlsxReport(bytes));
});

test("XLSX data-row scanning preserves self-closing boundaries with quoted tag attributes", () => {
  const sharedStringHasValue = createSharedStringValueLookup([
    '<sst probe="a/b > c">',
    '<si probe="a/b > c"><t probe="a/b > c">Header</t></si>',
    '<si probe="a/b > c" />',
    '<si probe="a/b > c"><t probe="a/b > c" /></si>',
    '<si probe="a/b > c"><t probe="a/b > c">visible</t></si>',
    "</sst>",
  ].join(""));
  assert.deepEqual([0, 1, 2, 3].map(sharedStringHasValue), [true, false, false, true]);

  const worksheetXml = [
    '<sheetData probe="a/b > c">',
    '<row probe="a/b > c" r="1" />',
    '<row probe="a/b > c" r="2"><c probe="a/b > c" r="A2" s="1" /><c probe="a/b > c" r="B2" t="s"><v probe="a/b > c">1</v></c></row>',
    '<row probe="a/b > c" r="3"><c probe="a/b > c" r="A3" t="inlineStr"><is probe="a/b > c"><r><t probe="a/b > c" /></r><r><t probe="a/b > c"></t></r></is></c></row>',
    '<row probe="a/b > c" r="4"><c probe="a/b > c" r="A4"><v probe="a/b > c">0</v></c></row>',
    "</sheetData>",
  ].join("");
  assert.equal(countWorksheetDataRows(worksheetXml, sharedStringHasValue), 1);
  assert.equal(countWorksheetDataRows(worksheetXml, sharedStringHasValue, 1), 1);
});

test("XLSX data-row scanning separates character data and decodes bounded XML references once", () => {
  const sharedStringHasValue = createSharedStringValueLookup([
    "<sst>",
    "<si><t><!-- no text --></t></si>",
    "<si><t><?probe no-text?></t></si>",
    "<si><t><![CDATA[]]></t></si>",
    "<si><t><![CDATA[visible]]></t></si>",
    "<si><t> </t></si>",
    "</sst>",
  ].join(""));
  assert.deepEqual([0, 1, 2, 3, 4].map(sharedStringHasValue), [false, false, false, true, true]);

  const header = '<row r="1" />';
  const cases = [
    ['<row r="&#50;"><c t="str"><v><!-- split -->0</v></c></row>', 1],
    ['<row r="&#x32;"><c t="&#x73;"><v>&#51;</v></c></row>', 1],
    ['<row r="2"><c t="str"><v><!-- no text --></v></c></row>', 0],
    ['<row r="2"><c t="str"><v><?probe no-text?></v></c></row>', 0],
    ['<row r="2"><c t="str"><v><![CDATA[]]></v></c></row>', 0],
    ['<row r="2"><c t="str"><v><![CDATA[visible]]></v></c></row>', 1],
    ['<row r="2"><c><f><!-- no text --></f><v /></c></row>', 0],
    ['<row r="2"><c><f><?probe?>SUM(A1)</f><v /></c></row>', 1],
    ['<row r="2"><c><f><![CDATA[SUM(A1)]]></f><v /></c></row>', 1],
    ['<row r="2"><c t="inlineStr"><is><t><![CDATA[ ]]></t></is></c></row>', 1],
    ['<row r="&#x110000;"><c><v>visible</v></c></row>', 0],
    ['<row r="&amp;#50;"><c><v>visible</v></c></row>', 0],
    ['<row r="2"><c t="&writer;"><v>visible</v></c></row>', 0],
    ['<row r="2"><c t="&#0;"><v>visible</v></c></row>', 0],
    ['<row r="2"><c t="s"><v>&#xZZ;</v></c></row>', 0],
    ['<row r="2"><c t="s"><v>&amp;#51;</v></c></row>', 0],
    ['<row r="2"><c t="s"><v><![CDATA[3]]></v></c></row>', 1],
    ['<row r="2"><c t="s"><v><![CDATA[&#51;]]></v></c></row>', 0],
  ] as const;
  for (const [row, expected] of cases) {
    assert.equal(countWorksheetDataRows(`<sheetData>${header}${row}</sheetData>`, sharedStringHasValue), expected, row);
  }
});

test("generated report integrity accepts normal, mixed, and customWidth=true reports", async (context) => {
  const normal = reportArrayBuffer(await writeXlsxReport({ sheets: [{ name: "Data", headers: ["Value"], rows: [["visible"]] }] }));
  const mixed = reportArrayBuffer(await writeXlsxReport({ sheets: [
    { name: "Empty", headers: ["Value"], rows: [] },
    { name: "Data", headers: ["Value"], rows: [[0], [false]] },
  ] }));
  const customWidthTrue = await replaceCustomWidthWithTrue(normal);
  for (const [name, bytes, expectedRows] of [
    ["normal", normal, 1],
    ["mixed", mixed, 2],
    ["customWidth=true", customWidthTrue, 1],
  ] as const) {
    await context.test(name, async () => {
      assert.equal(await countReopenedPopulatedDataRows(bytes), expectedRows);
      assert.equal((await assertVisibleXlsxReport(bytes)).dataRows, expectedRows);
      await assert.doesNotReject(() => assertGeneratedXlsxReport(bytes));
    });
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
  compared.records[0].leftValue = " leading\uFFFE\uD800";
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
  assert.ok(workbook.worksheets.some((sheet) => sheet.getColumn(10).values.includes(" leading��")));
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

function reportArrayBuffer(value: ExcelJS.Buffer) {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice().buffer;
  throw new Error("Unexpected report buffer type.");
}

async function countReopenedPopulatedDataRows(bytes: ArrayBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  let populatedRows = 0;
  for (const sheet of workbook.worksheets) {
    populatedRows += countWorksheetPopulatedDataRows(sheet);
  }
  return populatedRows;
}

function countWorksheetPopulatedDataRows(sheet: ExcelJS.Worksheet | undefined) {
  assert.ok(sheet);
  let populatedRows = 0;
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 1) return;
    let populated = false;
    row.eachCell((cell) => {
      if (cell.value !== null && cell.value !== undefined && cell.value !== "") populated = true;
    });
    if (populated) populatedRows += 1;
  });
  return populatedRows;
}

function matrixSharedStringsXml(values: readonly { name: string; value: string | number | boolean }[]) {
  const entries = values.map((value) => {
    const probe = matrixAttributeValue(`${value.name}/${String(value.value)}>shared`);
    return `<si probe="${probe}"><t probe="${probe}">${matrixTextValue(value.value)}</t></si>`;
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${entries.length}" uniqueCount="${entries.length}" probe="a/b > shared">${entries.join("")}</sst>`;
}

function matrixSheetDataXml(
  matrixCase: {
    cellKind: "self-closing" | "empty-c" | "v" | "shared" | "inline" | "formula";
    placement: "same-row-before" | "same-row-after" | "skipped-row" | "attribute-only-row";
    value: { name: string; value: string | number | boolean };
    valueIndex: number;
  },
  caseIndex: number,
) {
  const probe = matrixAttributeValue(`${matrixCase.value.name}/${String(matrixCase.value.value)}>case-${caseIndex}`);
  const header = `<row probe="header/a > b" r="1"><c r="A1" t="inlineStr"><is><t>Header</t></is></c></row>`;
  const structuralCell = (reference: string) => `<c probe="${probe}" r="${reference}" s="1"\n />`;
  const targetCell = (reference: string) => matrixCellXml(matrixCase, reference, probe, caseIndex);
  if (matrixCase.placement === "same-row-before") {
    return `<sheetData>${header}<row probe="${probe}" r="2">${structuralCell("A2")}${targetCell("B2")}</row></sheetData>`;
  }
  if (matrixCase.placement === "same-row-after") {
    return `<sheetData>${header}<row r = '2' probe="${probe}">${targetCell("A2")}${structuralCell("B2")}</row></sheetData>`;
  }
  if (matrixCase.placement === "skipped-row") {
    return `<sheetData>${header}<row probe="${probe}" r="2">${structuralCell("A2")}</row><row r = '4' probe="${probe}">${targetCell("B4")}</row></sheetData>`;
  }
  return `<sheetData>${header}<row probe="${probe}" r="2" /><row probe="${probe}" r = '4'>${targetCell("A4")}</row></sheetData>`;
}

function matrixCellXml(
  matrixCase: {
    cellKind: "self-closing" | "empty-c" | "v" | "shared" | "inline" | "formula";
    value: { name: string; value: string | number | boolean };
    valueIndex: number;
  },
  reference: string,
  probe: string,
  caseIndex: number,
) {
  const referenceAttribute = caseIndex % 2 === 0 ? `r="${reference}"` : `r = '${reference}'`;
  const attributes = `probe="${probe}" ${referenceAttribute}`;
  if (matrixCase.cellKind === "self-closing") return `<c ${attributes} s="1"\n />`;
  if (matrixCase.cellKind === "empty-c") return `<c ${attributes}></c>`;
  if (matrixCase.cellKind === "shared") return `<c ${attributes} t = 's'><v probe="${probe}">${matrixCase.valueIndex}</v></c>`;
  if (matrixCase.cellKind === "inline") {
    return `<c ${attributes} t="inlineStr"><is probe="${probe}"><t probe="${probe}">${matrixTextValue(matrixCase.value.value)}</t></is></c>`;
  }
  if (matrixCase.cellKind === "formula") {
    const type = typeof matrixCase.value.value === "string" ? ' t="str"' : matrixCase.value.value === false ? ' t="b"' : "";
    return `<c ${attributes}${type}><f probe="${probe}">${matrixFormula(matrixCase.value.value)}</f><v probe="${probe}">${matrixTextValue(matrixCase.value.value)}</v></c>`;
  }
  const type = typeof matrixCase.value.value === "string" ? ' t="str"' : matrixCase.value.value === false ? ' t="b"' : "";
  return `<c ${attributes}${type}><v probe="${probe}">${matrixTextValue(matrixCase.value.value)}</v></c>`;
}

function matrixFormula(value: string | number | boolean) {
  if (typeof value === "string") return matrixTextValue(`="${value.replaceAll('"', '""')}"`);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value);
}

function matrixTextValue(value: string | number | boolean) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function matrixAttributeValue(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
}

async function replaceCustomWidthWithTrue(bytes: ArrayBuffer) {
  const archive = await JSZip.loadAsync(bytes);
  let replacements = 0;
  for (const worksheet of Object.values(archive.files)) {
    if (worksheet.dir || !/^xl\/worksheets\/sheet\d+\.xml$/u.test(worksheet.name)) continue;
    const xml = await worksheet.async("string");
    replacements += xml.match(/customWidth="1"/gu)?.length ?? 0;
    archive.file(worksheet.name, xml.replaceAll('customWidth="1"', 'customWidth="true"'));
  }
  assert.ok(replacements > 0);
  return archive.generateAsync({ type: "arraybuffer" });
}
