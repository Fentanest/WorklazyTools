import ExcelJS from "exceljs";

export interface XlsxReportSheet {
  name: string;
  headers: string[];
  rows: unknown[][];
}

export interface XlsxReportDefinition {
  creator?: string;
  sheets: XlsxReportSheet[];
}

const XML_REPLACEMENT_CHARACTER = "\uFFFD";

export function writeUntrustedText(cell: ExcelJS.Cell, value: unknown) {
  cell.value = sanitizeXlsxText(String(value ?? ""));
  cell.numFmt = "@";
  return cell;
}

export function writeTrustedNumber(cell: ExcelJS.Cell, value: number) {
  cell.value = Number.isFinite(value) ? value : 0;
  return cell;
}

export function buildXlsxReport(definition: XlsxReportDefinition) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = definition.creator ?? "Worklazy Tools";
  workbook.created = new Date();
  workbook.modified = new Date();
  appendXlsxReportSheets(workbook, definition.sheets);
  return workbook;
}

export function appendXlsxReportSheets(workbook: ExcelJS.Workbook, sheets: XlsxReportSheet[]) {
  const names: string[] = [];
  sheets.forEach((definitionSheet) => {
    const name = uniqueWorksheetName(workbook, definitionSheet.name);
    const sheet = workbook.addWorksheet(name);
    names.push(name);
    const header = sheet.addRow([]);
    definitionSheet.headers.forEach((value, index) => writeUntrustedText(header.getCell(index + 1), value));
    header.font = { bold: true };
    definitionSheet.rows.forEach((values) => {
      const row = sheet.addRow([]);
      values.forEach((value, index) => writeUntrustedText(row.getCell(index + 1), value));
    });
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    if (definitionSheet.headers.length) sheet.autoFilter = { from: "A1", to: header.getCell(definitionSheet.headers.length).address };
    definitionSheet.headers.forEach((_value, index) => {
      const column = sheet.getColumn(index + 1);
      const measuredWidth = measureColumnWidth(column.values);
      column.width = Number.isFinite(measuredWidth) && measuredWidth > 0 ? measuredWidth : 12;
    });
  });
  return names;
}

export async function writeXlsxReport(definition: XlsxReportDefinition) {
  return writeXlsxWorkbook(buildXlsxReport(definition));
}

export async function writeXlsxWorkbook(workbook: ExcelJS.Workbook) {
  assertXlsxWorkbookXmlTextSafe(workbook);
  return workbook.xlsx.writeBuffer();
}

export function sanitizeXlsxText(value: string) {
  if (!hasXml10DisallowedCharacter(value)) return value;
  let sanitized = "";
  let unchangedStart = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (isHighSurrogate(codeUnit) && isLowSurrogate(value.charCodeAt(index + 1))) {
      index += 1;
      continue;
    }
    if (!isXml10DisallowedCodeUnit(codeUnit)) continue;
    sanitized += value.slice(unchangedStart, index) + XML_REPLACEMENT_CHARACTER;
    unchangedStart = index + 1;
  }
  return sanitized + value.slice(unchangedStart);
}

export function assertXlsxWorkbookXmlTextSafe(workbook: ExcelJS.Workbook) {
  for (const worksheet of workbook.worksheets) {
    if (hasXml10DisallowedCharacter(worksheet.name)) throw xlsxReportIntegrityError();
    let unsafe = false;
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      if (unsafe) return;
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (cellValueHasXml10DisallowedCharacter(cell.value)) unsafe = true;
      });
    });
    if (unsafe) throw xlsxReportIntegrityError();
  }
}

function measureColumnWidth(values: readonly unknown[]) {
  let width = 12;
  values.forEach((value) => {
    const candidate = String(value ?? "").length + 2;
    if (Number.isFinite(candidate)) width = Math.max(width, candidate);
  });
  const bounded = Math.min(48, width);
  return Number.isFinite(bounded) ? bounded : 12;
}

export function uniqueWorksheetName(workbook: ExcelJS.Workbook, requested: string, fallback = "Report") {
  const cleaned = sanitizeXlsxText(String(requested)).replace(/[\\/*?:\[\]]/gu, " ").trim() || fallback;
  const base = truncateWorksheetName(cleaned, 31);
  const used = new Set(workbook.worksheets.map((sheet) => sheet.name.normalize("NFC").toLocaleLowerCase("en-US")));
  if (!used.has(base.normalize("NFC").toLocaleLowerCase("en-US"))) return base;
  for (let index = 2; ; index += 1) {
    const suffix = ` (${index})`;
    const candidate = `${truncateWorksheetName(base, 31 - suffix.length)}${suffix}`;
    if (!used.has(candidate.normalize("NFC").toLocaleLowerCase("en-US"))) return candidate;
  }
}

function hasXml10DisallowedCharacter(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (isHighSurrogate(codeUnit) && isLowSurrogate(value.charCodeAt(index + 1))) {
      index += 1;
      continue;
    }
    if (isXml10DisallowedCodeUnit(codeUnit)) return true;
  }
  return false;
}

function isXml10DisallowedCodeUnit(codeUnit: number) {
  return (codeUnit <= 0x08)
    || (codeUnit >= 0x0b && codeUnit <= 0x0c)
    || (codeUnit >= 0x0e && codeUnit <= 0x1f)
    || (codeUnit >= 0xd800 && codeUnit <= 0xdfff)
    || codeUnit === 0xfffe
    || codeUnit === 0xffff;
}

function isHighSurrogate(codeUnit: number) {
  return codeUnit >= 0xd800 && codeUnit <= 0xdbff;
}

function isLowSurrogate(codeUnit: number) {
  return codeUnit >= 0xdc00 && codeUnit <= 0xdfff;
}

function cellValueHasXml10DisallowedCharacter(value: unknown): boolean {
  if (typeof value === "string") return hasXml10DisallowedCharacter(value);
  if (Array.isArray(value)) return value.some(cellValueHasXml10DisallowedCharacter);
  if (!value || typeof value !== "object" || value instanceof Date) return false;
  return Object.values(value).some(cellValueHasXml10DisallowedCharacter);
}

function truncateWorksheetName(value: string, maximumLength: number) {
  let end = Math.min(maximumLength, value.length);
  if (end < value.length && isHighSurrogate(value.charCodeAt(end - 1)) && isLowSurrogate(value.charCodeAt(end))) end -= 1;
  return value.slice(0, end);
}

function xlsxReportIntegrityError() {
  const error = new Error("REPORT_INTEGRITY_FAILED") as Error & { code: string };
  error.code = "REPORT_INTEGRITY_FAILED";
  return error;
}
