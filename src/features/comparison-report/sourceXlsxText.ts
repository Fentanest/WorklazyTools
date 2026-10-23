import {sanitizeXlsxText,writeXlsxReport,type XlsxReportDefinition} from '../../utils/xlsxReport.ts';
export const COMPARISON_XLSX_TEXT_UNSUPPORTED='COMPARISON_XLSX_TEXT_UNSUPPORTED';
/** RAW comparison-consumer strings only. V snapshots already have their own codec: never wrap them.
 * ST_Xstring requires CR and escape-start underscore protection (MS-OE376 2.1.1127).
 * Bound original UTF16 units conservatively to32767; encoded XML wire length is NOT cell length.
 * Tab/LF stay literal in text nodes; DEL is shielded from ExcelJS XmlStream stripping.
 * Reject lone surrogates/FFFE/FFFF rather than silently inherit the global writer's replacement.
 */
export function encodeSourceXlsxText(value:unknown){
 const raw=String(value??'');if(raw.length>32767)throw new Error(COMPARISON_XLSX_TEXT_UNSUPPORTED);
 const wire=raw.replace(/_(?=x[0-9a-fA-F]{4}_)/g,'_x005F_').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g,char=>`_x${char.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0')}_`);
 if(sanitizeXlsxText(wire)!==wire||wire.replace(/_x([0-9A-F]{4})_/g,(_,hex:string)=>String.fromCharCode(Number.parseInt(hex,16)))!==raw)throw new Error(COMPARISON_XLSX_TEXT_UNSUPPORTED);
 return wire;
}
export function writeSourceFaithfulXlsxReport(definition:XlsxReportDefinition){
 return writeXlsxReport({...definition,sheets:definition.sheets.map(sheet=>({...sheet,headers:sheet.headers.map(encodeSourceXlsxText),rows:sheet.rows.map(row=>row.map(encodeSourceXlsxText))}))});
}
