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

export function writeUntrustedText(cell: ExcelJS.Cell, value: unknown) {
  cell.value = String(value ?? "");
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
  definition.sheets.forEach((definitionSheet) => {
    const sheet = workbook.addWorksheet(definitionSheet.name);
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
      sheet.getColumn(index + 1).width = Math.min(48, Math.max(12, ...sheet.getColumn(index + 1).values.map((value) => String(value ?? "").length + 2)));
    });
  });
  return workbook;
}

export async function writeXlsxReport(definition: XlsxReportDefinition) {
  return buildXlsxReport(definition).xlsx.writeBuffer();
}
