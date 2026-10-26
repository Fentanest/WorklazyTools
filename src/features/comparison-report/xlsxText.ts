import type { XlsxReportSheet } from '../../utils/xlsxReport.ts';
import { sanitizeXlsxText } from '../../utils/xlsxReport.ts';
import { assertReport, REPORT_LIMITS } from './snapshot.ts';
/** ExcelJS4.4 TextXform decodes _xHHHH_ once; XmlStream writes CR literally (XML normalizes it).
 * Protect EVERY original escape-start underscore, including overlapping _x005F_x0041_.
 * Only then introduce real SpreadsheetML control escapes. Never pre-sanitize the original text.
 */
export function encodeReportXlsxText(value: string): string {
  assertReport(typeof value === 'string' && value.length <= REPORT_LIMITS.xlsxCellUnits, 'REPORT_XLSX_LIMIT');
  const encoded = value.replace(/_(?=x[0-9a-fA-F]{4}_)/g, '_x005F_')
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, char => `_x${char.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0')}_`);
  // Bound the wire representation too. Unsupported XML scalars reject; TXT remains lossless.
  assertReport(encoded.length <= REPORT_LIMITS.xlsxCellUnits && sanitizeXlsxText(encoded) === encoded, 'REPORT_XLSX_LIMIT');
  const decoded=encoded.replace(/_x([0-9A-F]{4})_/g,(_,hex:string)=>String.fromCharCode(Number.parseInt(hex,16)));
  assertReport(decoded===value,'REPORT_XLSX_FIDELITY');
  return encoded;
}
export function encodeReportXlsxSheet(sheet: XlsxReportSheet): XlsxReportSheet {
  return { name: sheet.name, headers: sheet.headers.map(encodeReportXlsxText), rows: sheet.rows.map(row => row.map(value => {
    assertReport(typeof value === 'string', 'REPORT_XLSX_LIMIT'); return encodeReportXlsxText(value);
  })) };
}
