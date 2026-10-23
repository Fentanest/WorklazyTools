import fs from 'node:fs/promises';import test from 'node:test';import assert from 'node:assert/strict';import ExcelJS from 'exceljs';import JSZip from 'jszip';
import {createExportSnapshot,reportMetadata}from'../src/features/comparison-report/snapshot.ts';
import {writeSnapshotXlsx,writeSnapshotTxt}from'../src/features/comparison-report/writers.ts';
import {writeXlsxReport}from'../src/utils/xlsxReport.ts';
import {encodeReportXlsxSheet}from'../src/features/comparison-report/xlsxText.ts';
const cases=['_x0041_','_x000D_','_x005F_','_x005F_x0041_','_x0041_x0042_','_x005F_x005F_x0041_','_x005F__x0041_','__x0041_','_x00ab_','_X0041_','_x005f_x0041_','a\rb','a\r\nb','a\nb','a\tb','\t lead \t','  spaces  ','=SUM(A1:A2)','+1','-1','@SUM(A1)','<>&"\'','한글 😀 가','a\u2028b','\u0085\u009F',String.fromCharCode(...Array.from({length:32},(_,i)=>i)),'\u007f','_x0000_\0_x007F_\u007f','\r_x000D_\r\nx0041_'];
const signal=()=>new AbortController().signal;
function snapshot(){return createExportSnapshot({language:'en',tool:'_x0041_\r\ntool',sources:[{id:'_x005F_',revision:'_x000D_',label:'source_x0041_\rname'}],appliedOptions:{'_x0041_':'_x005F_x0041_',line:'a\r\nb'},coordinates:{unit:'_x0041_',label:'row\rcolumn'},warnings:['_x000D_\rwarning'],completion:'partial',rows:cases.map((left,i)=>({id:`id_x0041_${i}`,status:'_x000D_',left,right:left,coordinates:{token:'_x0041_',index:i},metadata:{ocr:{raw:'_x005F_x0041_',corrected:'_x000D_'}}}))});}
test('actual report XLSX readback preserves every raw string, metadata and formula-like cell exactly',async t=>{
 const model=snapshot(),blob=await writeSnapshotXlsx(model,signal()),bytes=await blob.arrayBuffer(),wb=new ExcelJS.Workbook();await wb.xlsx.load(bytes);const sheet=wb.getWorksheet('Results');
 assert.deepEqual(sheet.getRow(1).values.slice(1),['ID','Status','Original','Revised','Coordinates','Metadata']);
 model.rows.forEach((row,i)=>{const expected=[row.id,row.status,row.left,row.right,JSON.stringify(row.coordinates),JSON.stringify(row.metadata)];for(let column=0;column<expected.length;column++){const cell=sheet.getCell(i+2,column+1);assert.equal(cell.value,expected[column],`row${i},column${column}`);assert.equal(cell.type,ExcelJS.ValueType.String);}});
 const meta=wb.getWorksheet('Metadata');const fields=new Map();meta.eachRow((r,i)=>{if(i>1)fields.set(r.getCell(1).value,r.getCell(2).value);});
 for(const[key,value]of Object.entries(reportMetadata(model)))assert.equal(fields.get(key),JSON.stringify(value),key);
 if(process.env.REPORT_TEST_XLSX){await fs.writeFile(process.env.REPORT_TEST_XLSX,new Uint8Array(bytes));await fs.writeFile(process.env.REPORT_TEST_XLSX+'.expected.json',JSON.stringify({rows:model.rows,metadata:reportMetadata(model)},null,2));}
 t.diagnostic(JSON.stringify({cases:cases.length,rawCellAssertions:model.rows.length*6,metadataFields:Object.keys(reportMetadata(model)).length}));
 const archive=await JSZip.loadAsync(bytes),xml=await archive.file('xl/sharedStrings.xml').async('string');assert(xml.includes('_x005F_'));assert(xml.includes('_x000D_'));assert(!xml.includes('\r'));assert(!xml.includes('\0'));
});
test('private adapter covers escape-shaped headers and overlapping literal underscore starts',async()=>{
 const headers=['_x0041_','_x005F_x0041_','CR\rLF\r\n','_x005F_'];const buffer=await writeXlsxReport({sheets:[encodeReportXlsxSheet({name:'Headers',headers,rows:[headers]})]});
 const wb=new ExcelJS.Workbook();await wb.xlsx.load(buffer);assert.deepEqual(wb.getWorksheet('Headers').getRow(1).values.slice(1),headers);assert.deepEqual(wb.getWorksheet('Headers').getRow(2).values.slice(1),headers);
});
test('expanded wire length and unsupported Unicode reject explicitly while TXT retains originals',async()=>{
 for(const left of ['\r'.repeat(5000),'_x0041_'.repeat(3000),'\ud800','\ufffe','\uffff']){
  const model=createExportSnapshot({language:'en',tool:'text',sources:[],appliedOptions:{},coordinates:{},warnings:[],completion:'complete',rows:[{id:'a',status:'changed',left,right:''}]});
  await assert.rejects(writeSnapshotXlsx(model,signal()),/REPORT_XLSX_LIMIT/);assert.equal(JSON.parse(await writeSnapshotTxt(model).text()).rows[0].left,left);
 }
});
