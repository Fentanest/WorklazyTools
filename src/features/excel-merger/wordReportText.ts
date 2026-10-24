import ExcelJS from 'exceljs';
import {encodeSourceXlsxText,COMPARISON_XLSX_TEXT_UNSUPPORTED} from '../comparison-report/sourceXlsxText.ts';
/** Final pass over this RAW Word/HWP report only. Never run over V-encoded cells. */
export function encodeWordReportCells(workbook:ExcelJS.Workbook){
 workbook.eachSheet(sheet=>sheet.eachRow(row=>row.eachCell(cell=>{
  // Merged slaves delegate writes to their master; revisiting would double-encode it.
  if(cell.type===ExcelJS.ValueType.Merge)return;
  const value=cell.value;
  if(typeof value==='string')cell.value=encodeSourceXlsxText(value);
  else if(value&&typeof value==='object'&&'richText'in value){
   const units=value.richText.reduce((total,run)=>total+run.text.length,0);
   if(units>32767)throw new Error(COMPARISON_XLSX_TEXT_UNSUPPORTED);
   cell.value={...value,richText:value.richText.map(run=>({...run,text:encodeSourceXlsxText(run.text)}))};
  }
 })));
}
