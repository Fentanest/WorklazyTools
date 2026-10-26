import {sanitizeXlsxText,writeXlsxReport,type XlsxReportDefinition} from '../../utils/xlsxReport.ts';
export const COMPARISON_XLSX_TEXT_UNSUPPORTED='COMPARISON_XLSX_TEXT_UNSUPPORTED';
export const XLSX_CELL_UNITS=32767;
/** RAW comparison-consumer strings only. V snapshots already have their own codec: never wrap them.
 * ST_Xstring requires CR and escape-start underscore protection (MS-OE376 2.1.1127).
 * Bound original UTF16 units conservatively to32767; encoded XML wire length is NOT cell length.
 * Tab/LF stay literal in text nodes; DEL is shielded from ExcelJS XmlStream stripping.
 * Text a cell cannot hold degrades in that cell only, never by rejecting the report: lone surrogates
 * and U+FFFE/U+FFFF become U+FFFD (as the shared writer does) and over-long text is cut with a marker.
 */
export function truncationMarker(units:number){return ` [truncated: original ${units} characters]`;}
export function fitXlsxCellText(raw:string){
 // Control characters stay: they are escaped losslessly below. Only scalars XML cannot carry are replaced.
 const text=raw.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]|[￾￿]/g,'�');
 if(text.length<=XLSX_CELL_UNITS)return text;
 const marker=truncationMarker(text.length);
 let end=XLSX_CELL_UNITS-marker.length;
 const unit=text.charCodeAt(end-1);if(unit>=0xD800&&unit<=0xDBFF)end-=1;
 return text.slice(0,end)+marker;
}
export function encodeSourceXlsxText(value:unknown){
 const raw=fitXlsxCellText(String(value??''));
 const wire=raw.replace(/_(?=x[0-9a-fA-F]{4}_)/g,'_x005F_').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g,char=>`_x${char.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0')}_`);
 if(sanitizeXlsxText(wire)!==wire||wire.replace(/_x([0-9A-F]{4})_/g,(_,hex:string)=>String.fromCharCode(Number.parseInt(hex,16)))!==raw)throw new Error(COMPARISON_XLSX_TEXT_UNSUPPORTED);
 return wire;
}
export function writeSourceFaithfulXlsxReport(definition:XlsxReportDefinition){
 return writeXlsxReport({...definition,sheets:definition.sheets.map(sheet=>({...sheet,headers:sheet.headers.map(encodeSourceXlsxText),rows:sheet.rows.map(row=>row.map(encodeSourceXlsxText))}))});
}
