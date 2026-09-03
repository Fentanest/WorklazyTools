import { Buffer } from "buffer";
import ExcelJS from "exceljs";
import Papa from "papaparse";

import { appendXlsxReportSheets, writeUntrustedText, type XlsxReportSheet } from "../../utils/xlsxReport.ts";
import type { SpreadsheetScalar } from "../spreadsheet-core/inputAdapter.ts";
import type { CleanerCell, CleanerSheetModel, ExcelCleanerEngineResult, ExcelCleanerOutput, ExcelCleanerPipeline } from "./types.ts";

export interface ExcelCleanerOutputContext {
  fileName: string;
  language: "ko" | "en";
  pipeline: ExcelCleanerPipeline;
  csvSafeMode: boolean;
}

const CSV_RISK = /^[=+\-@\t\r\n ]/u;

export async function buildExcelCleanerOutputs(result: ExcelCleanerEngineResult, context: ExcelCleanerOutputContext, output: "xlsx" | "csv" | "both") {
  const outputs: ExcelCleanerOutput[] = [];
  if (output === "xlsx" || output === "both") outputs.push(await buildXlsx(result, context));
  if (output === "csv" || output === "both") {
    result.sheets.forEach((sheet) => outputs.push(buildCsv(sheet, context)));
  }
  return outputs;
}

async function buildXlsx(result: ExcelCleanerEngineResult, context: ExcelCleanerOutputContext): Promise<ExcelCleanerOutput> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Worklazy Tools";
  workbook.created = new Date();
  workbook.modified = new Date();
  result.sheets.forEach((model) => writeCleanedSheet(workbook, model));
  appendXlsxReportSheets(workbook, reportSheets(result, context));
  const buffer = transferable(await workbook.xlsx.writeBuffer());
  return { kind: "xlsx", suggestedName: `${fileStem(context.fileName)}-cleaned.xlsx`, byteLength: buffer.byteLength, buffer };
}

function writeCleanedSheet(workbook: ExcelJS.Workbook, model: CleanerSheetModel) {
  const sheet = workbook.addWorksheet(safeWorksheetName(model.name, workbook));
  const header = sheet.getRow(model.headerRow);
  model.columns.forEach((column, index) => writeUntrustedText(header.getCell(index + 1), column.name));
  header.font = { bold: true };
  model.rows.forEach((row, rowIndex) => model.columns.forEach((column, columnIndex) => {
    const source = row.cells[column.id];
    if (!source) return;
    const target = sheet.getCell(model.headerRow + rowIndex + 1, columnIndex + 1);
    writeCleanedCell(target, source);
  }));
  model.merges.forEach((range) => { try { sheet.mergeCells(range); } catch { /* Preflight keeps unsupported merge topology out of structural runs. */ } });
  sheet.views = [{ state: "frozen", ySplit: model.headerRow }];
  model.columns.forEach((_column, index) => { sheet.getColumn(index + 1).width = 16; });
}

function writeCleanedCell(target: ExcelJS.Cell, source: CleanerCell) {
  if (source.formula && !source.formulaDegraded) {
    target.value = { formula: source.formula, result: formulaResult(source.cachedValue) };
  } else target.value = excelValue(source.formula ? source.cachedValue : source.value);
  if (source.style) target.style = structuredClone(source.style) as Partial<ExcelJS.Style>;
  if (source.numberFormat) target.numFmt = source.numberFormat;
}

function buildCsv(sheet: CleanerSheetModel, context: ExcelCleanerOutputContext): ExcelCleanerOutput {
  let csvRiskCount = 0;
  const protect = (value: unknown) => {
    const text = scalarText(value);
    if (!CSV_RISK.test(text)) return text;
    csvRiskCount += 1;
    return context.csvSafeMode ? `'${text}` : text;
  };
  const rows = [sheet.columns.map((column) => protect(column.name)), ...sheet.rows.map((row) => sheet.columns.map((column) => protect(decisionValue(row.cells[column.id]))))];
  const bytes = new TextEncoder().encode(`\ufeff${Papa.unparse(rows, { newline: "\r\n" })}`);
  const buffer = bytes.slice().buffer;
  return { kind: "csv", sheetName: sheet.name, suggestedName: `${fileStem(context.fileName)}-${sheet.name}.csv`, byteLength: buffer.byteLength, buffer, csvRiskCount };
}

function reportSheets(result: ExcelCleanerEngineResult, context: ExcelCleanerOutputContext): XlsxReportSheet[] {
  const ko = context.language === "ko";
  const summaryRows = Object.entries(result.summary).map(([key, value]) => [key, value]);
  const ruleRows = result.ruleStats.map((stats, index) => [index + 1, stats.ruleId, stats.type, JSON.stringify(context.pipeline.rules[index]), stats.changedCells, stats.deletedRows, stats.deletedColumns, stats.duplicates, stats.conversionFailures, stats.excludedRows]);
  ruleRows.unshift([0, "settings", "csv-mode", context.csvSafeMode ? "apostrophe-prefix" : "original-with-warning", 0, 0, 0, 0, 0, 0]);
  const issues = (values: typeof result.errors, truncated: number) => {
    const rows: unknown[][] = values.map((item) => [item.sheet, item.ruleId, item.ruleType, item.sourceRow ?? "", item.address ?? "", item.reason, item.values]);
    if (truncated) rows.push(["", "", "", "", "", ko ? `${truncated}개 행은 상한을 넘어 생략되었습니다.` : `${truncated} rows were omitted after the report limit.`, ""]);
    return rows;
  };
  return [
    { name: ko ? "변경 요약" : "Change Summary", headers: [ko ? "항목" : "Metric", ko ? "값" : "Value"], rows: summaryRows },
    { name: ko ? "처리 규칙" : "Processing Rules", headers: ["#", ko ? "규칙 ID" : "Rule ID", ko ? "종류" : "Type", ko ? "설정" : "Settings", ko ? "변경 셀" : "Changed Cells", ko ? "삭제 행" : "Deleted Rows", ko ? "삭제 열" : "Deleted Columns", ko ? "중복" : "Duplicates", ko ? "변환 실패" : "Conversion Failures", ko ? "제외 행" : "Excluded Rows"], rows: ruleRows },
    { name: ko ? "오류 행" : "Error Rows", headers: [ko ? "시트" : "Sheet", "Rule ID", ko ? "규칙" : "Rule", ko ? "원본 행" : "Source Row", ko ? "위치" : "Address", ko ? "사유" : "Reason", ko ? "값" : "Values"], rows: issues(result.errors, result.summary.errorRowsTruncated) },
    { name: ko ? "제외 행" : "Excluded Rows", headers: [ko ? "시트" : "Sheet", "Rule ID", ko ? "규칙" : "Rule", ko ? "원본 행" : "Source Row", ko ? "위치" : "Address", ko ? "사유" : "Reason", ko ? "규칙 직전 원문" : "Values Before Rule"], rows: issues(result.excluded, result.summary.excludedRowsTruncated) },
  ];
}

export function hasCsvInjectionRisk(value: unknown) { return CSV_RISK.test(scalarText(value)); }
export function protectCsvValue(value: unknown) { const text = scalarText(value); return CSV_RISK.test(text) ? `'${text}` : text; }
function decisionValue(value: CleanerCell | undefined) { return value?.formula ? value.cachedValue : value?.value; }
function scalarText(value: unknown) { return value instanceof Date ? value.toISOString() : value === null || value === undefined ? "" : String(value); }
function excelValue(value: SpreadsheetScalar | undefined): ExcelJS.CellValue { return value ?? null; }
function formulaResult(value: SpreadsheetScalar | undefined): ExcelJS.CellFormulaValue["result"] { return value ?? ""; }
function fileStem(value: string) { return value.replace(/\.[^.]+$/u, ""); }
function safeWorksheetName(value: string, workbook: ExcelJS.Workbook) {
  const base = (value.replace(/[\\/*?:\[\]]/gu, " ").trim() || "Sheet").slice(0, 31);
  if (!workbook.getWorksheet(base)) return base;
  for (let index = 2; ; index += 1) { const suffix = ` (${index})`; const candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`; if (!workbook.getWorksheet(candidate)) return candidate; }
}
function transferable(value: ExcelJS.Buffer) {
  if (value instanceof ArrayBuffer) return value;
  const bytes = new Uint8Array(value as Buffer);
  return bytes.slice().buffer;
}
