import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import ExcelJS from "exceljs";

import { runExcelCleanerPipeline } from "../../src/features/excel-cleaner/engine.ts";
import { formulaNeedsValueDowngrade, transformFormulaReferences } from "../../src/features/excel-cleaner/formulaTransform.ts";
import { createCleanerSheetModels, ExcelCleanerError, preflightExcelCleaner, validatePipelineColumnLineage } from "../../src/features/excel-cleaner/model.ts";
import { buildExcelCleanerOutputs, hasCsvInjectionRisk, protectCsvValue } from "../../src/features/excel-cleaner/output.ts";
import { ExcelCleanerValidationError, validateExcelCleanerPipeline } from "../../src/features/excel-cleaner/schema.ts";
import { EXCEL_CLEANER_RULE_TYPES, type CleanerSheetModel, type ExcelCleanerPipeline, type ExcelCleanerRule } from "../../src/features/excel-cleaner/types.ts";
import { parseSpreadsheetInput, type SpreadsheetBookData } from "../../src/features/spreadsheet-core/inputAdapter.ts";
import { runModuleWorker } from "../../src/utils/workerLifecycle.ts";

const rid = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;

test("synthetic cleaner fixtures cover formula kinds, caches, names, tables, merges, and both date systems", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "worklazy-excel-cleaner-unit-"));
  try {
    const generation = execFileSync(process.execPath, ["scripts/generate-excel-cleaner-fixtures.mjs", directory], { encoding: "utf8" });
    assert.match(generation, /"complex-formula\.xlsx"/u);
    const parse = async (name: string) => {
      const bytes = await fs.readFile(path.join(directory, name));
      return parseSpreadsheetInput(name, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    };
    const formula = await parse("formula.xlsx");
    assert.deepEqual(formula.sheets[0].cells.filter((cell) => cell.formula).map((cell) => [cell.address, cell.formulaType, cell.cacheState, cell.cachedValue]), [
      ["D2", "normal", "present", 3], ["E2", "normal", "present", 3], ["F2", "normal", "present", 6], ["D3", "normal", "present", 9],
    ]);
    const complex = await parse("complex-formula.xlsx");
    assert.deepEqual(new Set(complex.sheets[0].cells.filter((cell) => cell.formula).map((cell) => cell.formulaType)), new Set(["shared", "array"]));
    assert.equal(complex.definedNames[0].name, "NamedInput");
    assert.equal(complex.sheets[0].tables[0].ref, "E1:E3");
    assert.equal(preflightExcelCleaner(complex, [{ sheetName: "Complex", headerRow: 1 }], pipeline([])).downgradeFormulas, true);
    const missing = await parse("missing-cache.xlsx");
    assert.throws(() => preflightExcelCleaner(missing, [{ sheetName: "Missing Cache", headerRow: 1 }], pipeline([])), (error: unknown) => error instanceof ExcelCleanerError && error.code === "FORMULA_CACHE_MISSING" && error.details[0] === "Missing Cache!B2");
    const merged = await parse("merged.xlsx");
    assert.deepEqual(merged.sheets[0].merges, ["A2:B3"]);
    const dates1900 = await parse("date-1900.xlsx");
    const dates1904 = await parse("date-1904.xlsx");
    assert.equal(dates1900.date1904, false);
    assert.equal(dates1904.date1904, true);
    const serial1900 = createCleanerSheetModels(dates1900, [{ sheetName: "Dates 1900", headerRow: 1 }], false)[0].rows[0].cells["column:2"].value;
    const serial1904 = createCleanerSheetModels(dates1904, [{ sheetName: "Dates 1904", headerRow: 1 }], false)[0].rows[0].cells["column:2"].value;
    assert.equal(serial1900, 45351);
    assert.equal(serial1904, 43889);
    const normalized1900 = runExcelCleanerPipeline(createCleanerSheetModels(dates1900, [{ sheetName: "Dates 1900", headerRow: 1 }], false), pipeline([{ type: "unify-date-format", id: rid(90), columnIds: ["column:2"], outputFormat: "yyyy-mm-dd", inputHint: "serial" }]), { date1904: false });
    const normalized1904 = runExcelCleanerPipeline(createCleanerSheetModels(dates1904, [{ sheetName: "Dates 1904", headerRow: 1 }], false), pipeline([{ type: "unify-date-format", id: rid(91), columnIds: ["column:2"], outputFormat: "yyyy-mm-dd", inputHint: "serial" }]), { date1904: true });
    assert.equal((normalized1900.sheets[0].rows[0].cells["column:2"].value as Date).toISOString(), "2024-02-29T00:00:00.000Z");
    assert.equal((normalized1904.sheets[0].rows[0].cells["column:2"].value as Date).toISOString(), "2024-02-29T00:00:00.000Z");
    const mismatched = await parse("header-mismatch.xlsx");
    assert.throws(() => createCleanerSheetModels(mismatched, [{ sheetName: "Valid", headerRow: 1 }, { sheetName: "Mismatch", headerRow: 1 }], false), (error: unknown) => error instanceof ExcelCleanerError && error.code === "HEADER_MISMATCH");
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("all 28 rule variants round-trip with fixed IDs, defaults, required keys, and unknown-key rejection", () => {
  const rules: ExcelCleanerRule[] = [
    { type: "trim-edge-empty", id: rid(1) }, { type: "remove-empty-rows", id: rid(2) }, { type: "remove-empty-columns", id: rid(3) },
    { type: "collapse-consecutive-empty", id: rid(4), axis: "rows", minRun: 1 }, { type: "unmerge-cells", id: rid(5) }, { type: "unmerge-fill-down", id: rid(6) },
    { type: "rename-column", id: rid(7), columnId: "column:1", newName: "Renamed" }, { type: "reorder-columns", id: rid(8), order: ["column:1"] },
    { type: "delete-columns", id: rid(9), columnIds: ["column:1"] }, { type: "combine-columns", id: rid(10), columnIds: ["column:1", "column:2"], outputColumnId: "out:10", outputName: "Combined" },
    { type: "split-column", id: rid(11), columnId: "column:1", mode: "delimiter", pattern: ",", maxParts: 2, outputColumnIds: ["out:11a", "out:11b"], outputNames: ["One", "Two"] },
    { type: "add-constant-column", id: rid(12), value: "fixed", outputColumnId: "out:12", outputName: "Fixed" }, { type: "add-row-number-column", id: rid(13), outputColumnId: "out:13", outputName: "Row" },
    { type: "trim-whitespace", id: rid(14) }, { type: "collapse-spaces", id: rid(15) }, { type: "normalize-newlines", id: rid(16) },
    { type: "remove-invisible-chars", id: rid(17) }, { type: "normalize-unicode", id: rid(18) }, { type: "find-replace", id: rid(19), find: "a" },
    { type: "regex-replace", id: rid(20), pattern: "a+" }, { type: "dedupe-rows", id: rid(21) }, { type: "dedupe-by-columns", id: rid(22), columnIds: ["column:1"], keep: "latest", dateColumnId: "column:2" },
    { type: "filter-rows", id: rid(23), mode: "keep", columnId: "column:1", operator: "empty" }, { type: "fill-empty-cells", id: rid(24), source: "constant", value: 0 },
    { type: "convert-numeric-strings", id: rid(25) }, { type: "unify-date-format", id: rid(26), columnIds: ["column:1"], outputFormat: "yyyy-mm-dd" },
    { type: "format-phone-number", id: rid(27), columnIds: ["column:1"] }, { type: "format-business-number", id: rid(28), columnIds: ["column:1"] },
  ];
  const parsed = validateExcelCleanerPipeline(JSON.stringify({ version: 1, rules }));
  assert.deepEqual(parsed.rules.map((rule) => rule.type), EXCEL_CLEANER_RULE_TYPES);
  assert.equal((parsed.rules[0] as Extract<ExcelCleanerRule, { type: "trim-edge-empty" }>).axis, "both");
  assert.equal((parsed.rules[9] as Extract<ExcelCleanerRule, { type: "combine-columns" }>).removeSources, true);
  assert.equal((parsed.rules[19] as Extract<ExcelCleanerRule, { type: "regex-replace" }>).flags, "g");
  parsed.rules.forEach((rule) => assert.throws(() => validateExcelCleanerPipeline({ version: 1, rules: [{ ...rule, ignored: true }] }), ExcelCleanerValidationError));
  const required: Partial<Record<ExcelCleanerRule["type"], string[]>> = {
    "collapse-consecutive-empty": ["axis", "minRun"], "rename-column": ["columnId", "newName"], "reorder-columns": ["order"], "delete-columns": ["columnIds"],
    "combine-columns": ["columnIds", "outputColumnId", "outputName"], "split-column": ["columnId", "mode", "pattern", "maxParts", "outputColumnIds", "outputNames"],
    "add-constant-column": ["value", "outputColumnId", "outputName"], "add-row-number-column": ["outputColumnId", "outputName"], "find-replace": ["find"], "regex-replace": ["pattern"],
    "dedupe-by-columns": ["columnIds", "keep", "dateColumnId"], "filter-rows": ["mode", "columnId", "operator"], "fill-empty-cells": ["source", "value"],
    "unify-date-format": ["columnIds", "outputFormat"], "format-phone-number": ["columnIds"], "format-business-number": ["columnIds"],
  };
  parsed.rules.forEach((rule) => (required[rule.type] ?? []).forEach((key) => {
    if (rule.type === "dedupe-by-columns" && key === "dateColumnId" && rule.keep !== "latest") return;
    if (rule.type === "fill-empty-cells" && key === "value" && rule.source !== "constant") return;
    const missing = { ...rule } as Record<string, unknown>;
    delete missing[key];
    assert.throws(() => validateExcelCleanerPipeline({ version: 1, rules: [missing] }), ExcelCleanerValidationError, `${rule.type}.${key}`);
  }));
  const defaults = validateExcelCleanerPipeline({ version: 1, rules: [
    { type: "trim-edge-empty", id: rid(51) },
    { type: "normalize-newlines", id: rid(52) },
    { type: "find-replace", id: rid(53), find: "x" },
    { type: "regex-replace", id: rid(54), pattern: "x" },
    { type: "add-row-number-column", id: rid(55), outputColumnId: "n", outputName: "N" },
    { type: "unify-date-format", id: rid(56), columnIds: ["column:1"], outputFormat: "yyyymmdd" },
    { type: "format-phone-number", id: rid(57), columnIds: ["column:1"] },
  ] }).rules;
  assert.deepEqual(defaults.map((rule) => {
    if (rule.type === "trim-edge-empty") return rule.axis;
    if (rule.type === "normalize-newlines") return rule.replaceWith;
    if (rule.type === "find-replace") return [rule.replace, rule.caseSensitive];
    if (rule.type === "regex-replace") return [rule.flags, rule.replace];
    if (rule.type === "add-row-number-column") return [rule.startAt, rule.position];
    if (rule.type === "unify-date-format") return rule.inputHint;
    if (rule.type === "format-phone-number") return rule.style;
  }), ["both", "space", ["", true], ["g", ""], [1, "start"], "auto", "dash"]);
  assert.throws(() => validateExcelCleanerPipeline({ version: 1, rules: [{ type: "regex-replace", id: rid(1), pattern: "a", flags: "y" }] }), ExcelCleanerValidationError);
  assert.doesNotThrow(() => validateExcelCleanerPipeline({ version: 1, rules: [{ type: "regex-replace", id: rid(58), pattern: "x".repeat(500), flags: "gimsu" }] }));
  assert.throws(() => validateExcelCleanerPipeline({ version: 1, rules: [{ type: "regex-replace", id: rid(58), pattern: "x".repeat(501) }] }), ExcelCleanerValidationError);
  assert.doesNotThrow(() => validateExcelCleanerPipeline({ version: 1, rules: [{ type: "collapse-consecutive-empty", id: rid(59), axis: "columns", minRun: 1000 }] }));
  assert.throws(() => validateExcelCleanerPipeline({ version: 1, rules: [{ type: "collapse-consecutive-empty", id: rid(59), axis: "rows", minRun: 0 }] }), ExcelCleanerValidationError);
  assert.throws(() => validateExcelCleanerPipeline({ version: 1, rules: [{ type: "collapse-consecutive-empty", id: rid(1), axis: "rows", minRun: 1001 }] }), ExcelCleanerValidationError);
  assert.throws(() => validateExcelCleanerPipeline({ version: 1, rules: [{ type: "split-column", id: rid(1), columnId: "a", mode: "delimiter", pattern: ",", maxParts: 2, outputColumnIds: ["x"], outputNames: ["X", "Y"] }] }), ExcelCleanerValidationError);
  assert.throws(() => validateExcelCleanerPipeline({ version: 1, rules: Array.from({ length: 101 }, (_, index) => ({ type: "dedupe-rows", id: rid(index + 100) })) }), ExcelCleanerValidationError);
});

test("column lineage persists generated IDs and rejects duplicates, deleted references, and incomplete reorder sets", () => {
  const columns = [{ id: "column:1", name: "A" }, { id: "column:2", name: "B" }];
  const valid = pipeline([
    { type: "combine-columns", id: rid(1), columnIds: ["column:1", "column:2"], outputColumnId: "combined", outputName: "Combined", removeSources: false },
    { type: "split-column", id: rid(2), columnId: "combined", mode: "delimiter", pattern: ",", maxParts: 2, outputColumnIds: ["left", "right"], outputNames: ["Left", "Right"] },
    { type: "trim-whitespace", id: rid(3), columnIds: ["left", "right"] },
  ]);
  assert.deepEqual(validatePipelineColumnLineage(columns, valid), ["left", "right", "column:1", "column:2"]);
  assert.throws(() => validatePipelineColumnLineage(columns, pipeline([{ type: "delete-columns", id: rid(4), columnIds: ["column:1"] }, { type: "trim-whitespace", id: rid(5), columnIds: ["column:1"] }])), (error: unknown) => error instanceof ExcelCleanerError && error.code === "COLUMN_ID_MISSING");
  assert.throws(() => validatePipelineColumnLineage(columns, pipeline([{ type: "add-constant-column", id: rid(6), value: "x", outputColumnId: "column:1", outputName: "bad" }])), (error: unknown) => error instanceof ExcelCleanerError && error.code === "COLUMN_ID_DUPLICATE");
  assert.throws(() => validatePipelineColumnLineage(columns, pipeline([{ type: "reorder-columns", id: rid(7), order: ["column:1"] }])), (error: unknown) => error instanceof ExcelCleanerError && error.code === "COLUMN_ORDER_INVALID");
});

test("token-aware formula transforms cover row/column delete, insert, reorder, absolute ranges, and #REF", () => {
  const rowDelete = transformFormulaReferences('A2+$B$3+SUM(C2:D5)+"A2"', { rows: [null, 1, null, 2, 3, 4] });
  assert.deepEqual(rowDelete, { formula: '#REF!+$B$2+SUM(C2:D4)+"A2"', degraded: false });
  assert.equal(transformFormulaReferences("B2+A2:C2", { columns: [null, 1, null, 2] }).formula, "#REF!+A2:B2");
  assert.equal(transformFormulaReferences("B2+A2:C2", { columns: [null, 1, 3, 4], expandInsertedColumns: true }).formula, "C2+A2:D2");
  assert.deepEqual(transformFormulaReferences("SUM(A2:B2)", { columns: [null, 1, 3] }), { formula: "SUM(A2:B2)", degraded: true, reason: "NONCONTIGUOUS_REFERENCE" });
  assert.equal(transformFormulaReferences("LOG10(A2)", { rows: [null, 1, 7] }).formula, "LOG10(A7)");
  assert.equal(formulaNeedsValueDowngrade("Other!A1"), true);
  assert.equal(formulaNeedsValueDowngrade("Table1[Amount]"), true);
  assert.equal(formulaNeedsValueDowngrade("INDIRECT(\"A1\")"), true);
});

test("preflight distinguishes missing caches and downgrade warnings and enforces unmerge-before-structure", () => {
  const value = book({ formula: "A2", cachedValue: 1, cacheState: "present", formulaType: "shared" });
  value.definedNames = [{ name: "Named", ranges: ["Data!$A$2"] }];
  value.sheets[0].tables = [{ name: "T", displayName: "T", ref: "A1:A2", columns: ["A"] }];
  assert.throws(() => preflightExcelCleaner({ ...value, sheets: [{ ...value.sheets[0], cells: [{ ...value.sheets[0].cells[0], cacheState: "missing" }] }] }, [{ sheetName: "Data", headerRow: 1 }], pipeline([])), (error: unknown) => error instanceof ExcelCleanerError && error.code === "FORMULA_CACHE_MISSING" && error.details[0] === "Data!A2");
  const checked = preflightExcelCleaner(value, [{ sheetName: "Data", headerRow: 1 }], pipeline([]));
  assert.equal(checked.downgradeFormulas, true);
  assert.deepEqual(new Set(checked.warnings), new Set(["SHARED_FORMULAS_TO_VALUES", "DEFINED_NAMES_TO_VALUES", "TABLE_FORMULAS_TO_VALUES"]));
  const legacy = preflightExcelCleaner({ ...value, format: "xls", definedNames: [], sheets: [{ ...value.sheets[0], tables: [], cells: value.sheets[0].cells.map((cell) => ({ ...cell, formulaType: "normal" })) }] }, [{ sheetName: "Data", headerRow: 1 }], pipeline([]));
  assert.deepEqual(legacy.warnings, ["LEGACY_FORMULAS_TO_VALUES"]);
  assert.throws(() => preflightExcelCleaner({ ...value, definedNames: [], sheets: [{ ...value.sheets[0], tables: [], merges: ["A2:B2"] }] }, [{ sheetName: "Data", headerRow: 1 }], pipeline([{ type: "delete-columns", id: rid(1), columnIds: ["column:1"] }, { type: "unmerge-cells", id: rid(2) }])), (error: unknown) => error instanceof ExcelCleanerError && error.code === "MERGE_RULE_ORDER");
});

test("text, regex, filter, dedupe, fill, number, date, phone, and business rules preserve failures and stored formula values", () => {
  const sheet = model([
    ["  A\u00a0  B\r\n", "001", "2026/09/03", "01012345678", "1234567890", "same", "2026-09-01"],
    ["aa    bb", "1,234.5", "bad", "bad", "bad", "same", "2026-09-02"],
    ["aab", "", "20260904", "021234567", "1112233333", "other", ""],
  ]);
  sheet.rows[0].cells["column:2"].numberFormat = "@";
  sheet.rows[0].cells["column:6"] = { value: 99, formula: "1+98", cachedValue: "same", cacheState: "present", formulaType: "normal" };
  const result = runExcelCleanerPipeline([sheet], pipeline([
    { type: "trim-whitespace", id: rid(1), columnIds: ["column:1"] },
    { type: "remove-invisible-chars", id: rid(2), columnIds: ["column:1"] },
    { type: "collapse-spaces", id: rid(3), columnIds: ["column:1"] },
    { type: "normalize-newlines", id: rid(4), columnIds: ["column:1"], replaceWith: "space" },
    { type: "find-replace", id: rid(5), columnIds: ["column:1"], find: "aa", replace: "A", caseSensitive: true },
    { type: "regex-replace", id: rid(6), columnIds: ["column:1"], pattern: "b", flags: "gi", replace: "B" },
    { type: "convert-numeric-strings", id: rid(7), columnIds: ["column:2"] },
    { type: "unify-date-format", id: rid(8), columnIds: ["column:3"], outputFormat: "yyyy-mm-dd" },
    { type: "format-phone-number", id: rid(9), columnIds: ["column:4"] },
    { type: "format-business-number", id: rid(10), columnIds: ["column:5"] },
    { type: "dedupe-by-columns", id: rid(11), columnIds: ["column:6"], keep: "latest", dateColumnId: "column:7" },
    { type: "fill-empty-cells", id: rid(12), columnIds: ["column:2"], source: "constant", value: "0" },
  ]));
  assert.equal(result.sheets[0].rows.length, 2);
  assert.equal(result.sheets[0].rows[0].cells["column:2"].value, 1234.5);
  assert.equal(result.sheets[0].rows[1].cells["column:2"].value, "0");
  assert.equal(result.sheets[0].rows[0].cells["column:4"].value, "bad");
  assert.equal(result.sheets[0].rows[1].cells["column:4"].value, "02-123-4567");
  assert.equal(result.summary.duplicates, 1);
  assert.equal(result.summary.excludedRows, 1);
  assert.equal(result.summary.conversionFailures, 3);
  assert.ok(result.errors.every((item) => item.reason === "CONVERSION_FAILED"));
  assert.equal(result.excluded[0].values.includes("same"), true);
});

test("structure kernels unmerge atomically, persist derived IDs, and downgrade only a noncontiguous formula cell", () => {
  const sheet = model([["a", "b", "c", "=cached"], ["d", "e", "f", 2]]);
  sheet.merges = ["A2:B2"];
  sheet.rows[0].cells["column:1"].value = "master";
  sheet.rows[0].cells["column:4"] = { value: 1, formula: "SUM(A2:B2)", cachedValue: 1, cacheState: "present", formulaType: "normal" };
  const result = runExcelCleanerPipeline([sheet], pipeline([
    { type: "unmerge-fill-down", id: rid(1) },
    { type: "reorder-columns", id: rid(2), order: ["column:1", "column:3", "column:2", "column:4"] },
    { type: "combine-columns", id: rid(3), columnIds: ["column:1", "column:2"], separator: "/", outputColumnId: "combined", outputName: "Combined", removeSources: false },
    { type: "split-column", id: rid(4), columnId: "combined", mode: "delimiter", pattern: "/", maxParts: 2, outputColumnIds: ["part-a", "part-b"], outputNames: ["Part A", "Part B"] },
    { type: "add-constant-column", id: rid(5), value: "x", outputColumnId: "constant", outputName: "Constant" },
    { type: "add-row-number-column", id: rid(6), startAt: 0, outputColumnId: "row-number", outputName: "Row" },
  ]));
  assert.equal(result.sheets[0].merges.length, 0);
  assert.equal(result.sheets[0].rows[0].cells["column:2"].value, "master");
  assert.equal(result.sheets[0].rows[0].cells["column:4"].formulaDegraded, true);
  assert.equal(result.errors[0].reason, "NONCONTIGUOUS_REFERENCE");
  assert.equal(result.sheets[0].rows[0].cells["part-a"].value, "master");
  assert.equal(result.sheets[0].rows[0].cells["part-b"].value, "master");
  assert.equal(result.sheets[0].rows[0].cells["row-number"].value, 0);
});

test("XLSX output appends four reports, reopens formulas, and CSV modes warn or prefix dangerous leading characters", async () => {
  const sheet = model([["=1+1", "+2"], ["safe", " leading"]]);
  sheet.name = "Change Summary";
  sheet.rows[1].cells["column:2"] = { value: 2, formula: "1+1", cachedValue: 2, cacheState: "present", formulaType: "normal" };
  const engine = runExcelCleanerPipeline([sheet], pipeline([]));
  const raw = await buildExcelCleanerOutputs(engine, { fileName: "input.xlsx", language: "en", pipeline: pipeline([]), csvSafeMode: false }, "both");
  assert.equal(raw.length, 2);
  assert.equal(raw[1].csvRiskCount, 2);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(raw[0].buffer);
  assert.equal(workbook.worksheets.length, 5);
  assert.equal(workbook.worksheets[0].name, "Change Summary");
  assert.equal(workbook.worksheets[1].name, "Change Summary (2)");
  assert.equal(workbook.worksheets[0].getCell("B3").formula, "1+1");
  const safe = await buildExcelCleanerOutputs(engine, { fileName: "input.xlsx", language: "en", pipeline: pipeline([]), csvSafeMode: true }, "csv");
  const csv = new TextDecoder().decode(safe[0].buffer);
  assert.match(csv, /'=1\+1/u);
  assert.equal(hasCsvInjectionRisk("\tcmd"), true);
  assert.equal(protectCsvValue("@cmd"), "'@cmd");

  const shifted = model([["remove", 1, 2, null], ["keep", 3, 4, null]]);
  shifted.rows[1].cells["column:4"] = { value: 7, formula: "B3+C3", cachedValue: 7, cacheState: "present", formulaType: "normal" };
  const shiftedResult = runExcelCleanerPipeline([shifted], pipeline([{ type: "filter-rows", id: rid(70), mode: "delete", columnId: "column:1", operator: "equals", value: "remove" }]));
  const shiftedOutput = await buildExcelCleanerOutputs(shiftedResult, { fileName: "shifted.xlsx", language: "en", pipeline: pipeline([{ type: "filter-rows", id: rid(70), mode: "delete", columnId: "column:1", operator: "equals", value: "remove" }]), csvSafeMode: false }, "xlsx");
  const shiftedWorkbook = new ExcelJS.Workbook();
  await shiftedWorkbook.xlsx.load(shiftedOutput[0].buffer);
  assert.equal(shiftedWorkbook.getWorksheet("Data")!.getCell("D2").formula, "B2+C2");
});

test("worker watchdog reports the active rule while user cancellation remains AbortError", async () => {
  const stalled = fakeWorker((worker) => setTimeout(() => worker.emit({ type: "rule-start", ruleId: rid(20), progress: 10 }), 1));
  await assert.rejects(runModuleWorker(() => stalled as unknown as Worker, {}, {
    inactivityTimeoutMs: 15, timeoutMessage: "timed out", canceledMessage: "canceled", startErrorMessage: "start", resultErrorMessage: "result",
  }), (error: unknown) => error instanceof Error && (error as Error & { code?: string; ruleId?: string }).code === "WORKER_TIMEOUT" && (error as Error & { ruleId?: string }).ruleId === rid(20));
  const controller = new AbortController();
  const canceled = runModuleWorker(() => fakeWorker(() => undefined) as unknown as Worker, {}, {
    signal: controller.signal, inactivityTimeoutMs: 50, canceledMessage: "canceled", startErrorMessage: "start", resultErrorMessage: "result",
  });
  controller.abort();
  await assert.rejects(canceled, (error: unknown) => error instanceof DOMException && error.name === "AbortError");
});

function pipeline(rules: ExcelCleanerRule[]): ExcelCleanerPipeline { return { version: 1, rules }; }
function model(values: unknown[][]): CleanerSheetModel {
  const width = Math.max(1, ...values.map((row) => row.length));
  const columns = Array.from({ length: width }, (_, index) => ({ id: `column:${index + 1}`, name: `C${index + 1}`, sourceColumn: index + 1 }));
  return { name: "Data", headerRow: 1, columns, merges: [], rows: values.map((valuesRow, rowIndex) => ({ id: `row:${rowIndex + 2}`, sourceRow: rowIndex + 2, cells: Object.fromEntries(columns.map((column, columnIndex) => [column.id, { value: (valuesRow[columnIndex] ?? null) as never, sourceRow: rowIndex + 2, sourceColumn: columnIndex + 1 }])) })) };
}
function book(formula: { formula: string; cachedValue: number; cacheState: "present" | "missing"; formulaType: "normal" | "shared" | "array" }): SpreadsheetBookData {
  return { format: "xlsx", date1904: false, supportsStyleComparison: true, definedNames: [], sheets: [{ name: "Data", rowCount: 2, columnCount: 1, merges: [], tables: [], rowLineage: [{ id: "row:1", sourceRow: 1 }, { id: "row:2", sourceRow: 2 }], columnLineage: [{ id: "column:1", sourceColumn: 1 }], cells: [{ row: 2, column: 1, address: "A2", type: "number", value: formula.cachedValue, ...formula, sourceRow: 2, sourceColumn: 1, rowLineageId: "row:2", columnLineageId: "column:1" }] }] };
}

function fakeWorker(post: (worker: { emit: (value: unknown) => void }) => void) {
  const worker = {
    onmessage: undefined as ((event: MessageEvent) => void) | undefined,
    onerror: undefined as ((event: ErrorEvent) => void) | undefined,
    postMessage: () => post({ emit: (value) => worker.onmessage?.({ data: value } as MessageEvent) }),
    terminate: () => undefined,
  };
  return worker;
}
