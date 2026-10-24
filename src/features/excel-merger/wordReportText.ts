import ExcelJS from 'exceljs';
import {encodeSourceXlsxText,truncationMarker,XLSX_CELL_UNITS} from '../comparison-report/sourceXlsxText.ts';
/** Final pass over this RAW Word/HWP report only. Never run over V-encoded cells. */
export function encodeWordReportCells(workbook:ExcelJS.Workbook){
 workbook.eachSheet(sheet=>sheet.eachRow(row=>row.eachCell(cell=>{
  // Merged slaves delegate writes to their master; revisiting would double-encode it.
  if(cell.type===ExcelJS.ValueType.Merge)return;
  const value=cell.value;
  if(typeof value==='string')cell.value=encodeSourceXlsxText(value);
  else if(value&&typeof value==='object'&&'richText'in value){
   cell.value={...value,richText:fitRichText(value.richText).map(run=>({...run,text:encodeSourceXlsxText(run.text)}))};
  }
 })));
}
/** Keep rich runs within the cell limit; the cut run carries the same marker as plain cells. */
function fitRichText(runs:ExcelJS.RichText[]){
 const units=runs.reduce((total,run)=>total+run.text.length,0);
 if(units<=XLSX_CELL_UNITS)return runs;
 const marker=truncationMarker(units);
 let budget=XLSX_CELL_UNITS-marker.length;
 const kept:ExcelJS.RichText[]=[];
 for(const run of runs){
  if(budget<=0)break;
  let text=run.text.slice(0,budget);
  const unit=text.charCodeAt(text.length-1);if(text.length<run.text.length&&unit>=0xD800&&unit<=0xDBFF)text=text.slice(0,-1);
  kept.push({...run,text});budget-=text.length;
 }
 const last=kept[kept.length-1];
 kept[kept.length-1]={...last,text:last.text+marker};
 return kept;
}
