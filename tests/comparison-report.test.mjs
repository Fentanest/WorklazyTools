import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fontkit from '@pdf-lib/fontkit';
import { PNG } from 'pngjs';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { ZipWriter } from '@zip.js/zip.js';
import { createExportSnapshot, REPORT_LIMITS } from '../src/features/comparison-report/snapshot.ts';
import { writeSnapshotXlsx, writeSnapshotTxt, writeSnapshotZip, writeOriginalText } from '../src/features/comparison-report/writers.ts';
import { writeSnapshotPdf } from '../src/features/comparison-report/pdf.ts';
import { ReportSession } from '../src/features/comparison-report/session.ts';
const signal=()=>new AbortController().signal;
const input=()=>({language:'en',tool:'text',sources:[{id:'left',revision:'r1',label:'원본'},{id:'right',revision:'r2',label:'수정본'}],appliedOptions:{ignoreCase:false},coordinates:{unit:'utf16',origin:0},warnings:['부분 비교 경고'],completion:'partial',rows:[{id:'row1',status:'changed',left:'=SUM(A1:A2)',right:'+1',coordinates:{left:[0,11],right:[0,2]},metadata:{ocr:{raw:'읽기',corrected:'일기'}}}]});
const snapshot=()=>createExportSnapshot(input());
test('snapshot deep-freezes existing data, retains warnings/cancel/scope and never infers visible rows',()=>{
 const data=input(),all=createExportSnapshot(data);data.rows[0].left='mutated';assert.equal(all.rows[0].left,'=SUM(A1:A2)');assert(Object.isFrozen(all.rows[0]));
 const selected=createExportSnapshot({...input(),completion:'canceled',scope:{kind:'selected',ids:['row1']}});assert.equal(selected.completion,'canceled');assert.equal(selected.scope.kind,'selected');assert.deepEqual(selected.warnings,['부분 비교 경고']);
 assert.throws(()=>createExportSnapshot({...input(),scope:{kind:'selected',ids:['missing']}}),/REPORT_INVALID_SCOPE/);
 assert.throws(()=>createExportSnapshot({...input(),rows:[...input().rows,...input().rows]}),/INVALID_SNAPSHOT/);
 const subset=createExportSnapshot({...input(),rows:[...input().rows,{id:'secret',status:'unchanged',left:'do-not-export',right:'hidden'}],scope:{kind:'selected',ids:['row1']}});assert(!JSON.stringify(subset).includes('do-not-export'));
 assert.throws(()=>createExportSnapshot({...input(),scope:{kind:'selected',ids:['row1']},rawSources:{left:'full original',right:'full revised'}}),/INVALID_SCOPE/);
});
test('XLSX strings remain literal and exact on readback, oversized/unsafe cells reject with TXT fallback',async()=>{
 const model=snapshot(),blob=await writeSnapshotXlsx(model,signal()),wb=new ExcelJS.Workbook();await wb.xlsx.load(await blob.arrayBuffer());
 assert.equal(wb.getWorksheet('Results').getCell('C2').value,'=SUM(A1:A2)');assert.equal(wb.getWorksheet('Results').getCell('D2').type,ExcelJS.ValueType.String);
 assert.equal(wb.getWorksheet('Results').getCell('E2').value,JSON.stringify(model.rows[0].coordinates));
 assert(wb.getWorksheet('Metadata').getColumn(2).values.some(v=>String(v).includes('partial')));
 const huge=createExportSnapshot({...input(),rows:[{...input().rows[0],left:'가'.repeat(32768)}]});await assert.rejects(writeSnapshotXlsx(huge,signal()),/XLSX_LIMIT/);
 assert.equal(JSON.parse(await writeSnapshotTxt(huge).text()).rows[0].left,huge.rows[0].left);
 const unsafe=createExportSnapshot({...input(),rows:[{...input().rows[0],left:'a\ud800b'}]});await assert.rejects(writeSnapshotXlsx(unsafe,signal()),/XLSX_LIMIT/);
 assert.equal(JSON.parse(await writeSnapshotTxt(unsafe).text()).rows[0].left,'a\ud800b');
});
test('sequential ZIP exposes no artifact after producer or final close failures; originals stay full',async()=>{
 const model=createExportSnapshot({...input(),rawSources:{left:'한글\n원문 😀',right:'수정\t원문'}});
 const blob=await writeSnapshotZip(model,[{name:'results.xlsx',write:()=>writeSnapshotXlsx(model,signal())}],signal());
 const zip=await JSZip.loadAsync(await blob.arrayBuffer());assert.equal(await zip.file('original-left.txt').async('string'),model.rawSources.left);
 assert.equal(JSON.parse(await zip.file('snapshot.txt').async('string')).completion,'partial');
 await assert.rejects(writeSnapshotZip(model,[{name:'fail.txt',write:async()=>{throw new Error('producer failed');}}],signal()),/producer failed/);
 const close=ZipWriter.prototype.close;ZipWriter.prototype.close=async function(...args){await close.apply(this,args);throw new Error('finalization failed');};
 try{await assert.rejects(writeSnapshotZip(model,[],signal()),/finalization failed/);}finally{ZipWriter.prototype.close=close;}
 assert.equal(await writeOriginalText(model,'left').text(),model.rawSources.left);
});
test('latest export queue is serial and cannot deliver stale or canceled output',async()=>{
 const owner=new ReportSession(),model=snapshot();let release;let current=true;const delivered=[],events=[];
 const old=owner.run(model,()=>current,async()=>{events.push('old');await new Promise(r=>{release=r;});return new Blob(['old']);},b=>delivered.push(b));old.catch(()=>{});
 const skipped=owner.run(model,()=>current,async()=>{events.push('skipped');return new Blob(['skip']);},()=>{});skipped.catch(()=>{});
 const latest=owner.run(model,()=>current,async()=>{events.push('latest');return new Blob(['latest']);},b=>delivered.push(b));
 await assert.rejects(skipped,{name:'AbortError'});assert.deepEqual(events,['old']);release();await assert.rejects(old);await latest;assert.deepEqual(events,['old','latest']);assert.equal(await delivered[0].text(),'latest');
 let finish;const stale=owner.run(model,()=>current,async()=>{await new Promise(r=>{finish=r;});return new Blob(['late']);},()=>assert.fail('stale delivery'));current=false;finish();await assert.rejects(stale,/REPORT_STALE/);await owner.dispose();
});
test('PDF reuses CJK/CFF font, paginates every Korean/ligature marker and marks missing emoji without truncation',async t=>{
 const font=await fs.readFile('public/vendor/qr-label-font/noto-cjk-sans-2.004/NotoSansKR-Regular.otf');
 assert(fontkit.create(font).layout('office ffi').glyphs.some(g=>g.codePoints.length>1),'fixture must exercise shaped ligatures');
 const rows=Array.from({length:30},(_,i)=>({id:`row${i}`,status:'changed',left:`한글 비교 office ffi 원문${i}`,right:`수정 내용 한글${i}`}));
 const model=createExportSnapshot({...input(),warnings:['부분 비교 경고'],rows});const blob=await writeSnapshotPdf(model,signal(),font);
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const loading=pdfjs.getDocument({data:new Uint8Array(await blob.arrayBuffer()),disableFontFace:true}),document=await loading.promise;
 try{assert(document.numPages>1);let text='';for(let i=1;i<=document.numPages;i++){const page=await document.getPage(i);text+=(await page.getTextContent()).items.filter(x=>'str'in x).map(x=>x.str).join('');page.cleanup();}
 for(let i=0;i<30;i++){assert(text.includes(`원문${i}`));assert(text.includes(`한글${i}`));}assert(text.includes('office ffi'));assert(text.includes('부분 비교 경고'));
 }finally{await loading.destroy();}
 // A character missing from the font is marked in place; the attachment keeps the original.
 const pdfText=async blob=>{const loading=pdfjs.getDocument({data:new Uint8Array(await blob.arrayBuffer()),disableFontFace:true}),pdf=await loading.promise;try{let text='';for(let i=1;i<=pdf.numPages;i++)text+=(await(await pdf.getPage(i)).getTextContent()).items.filter(x=>'str'in x).map(x=>x.str).join('');return{text,data:Buffer.from(await pdf.getAttachmentContent('comparison-data.json')).toString()};}finally{await loading.destroy();}};
 const emoji=createExportSnapshot({...input(),rows:[{...input().rows[0],left:'unsupported 😀'}]});const shown=await pdfText(await writeSnapshotPdf(emoji,signal(),font));assert(shown.text.includes('unsupported [U+1F600]'));assert(shown.text.includes('[U+code]'));assert(JSON.parse(shown.data).rows[0].left.includes('😀'));assert(JSON.parse(await writeSnapshotTxt(emoji).text()).rows[0].left.includes('😀'));
 // Presentation-form ligatures are drawn as their letters.
 const ligature=createExportSnapshot({...input(),rows:[{...input().rows[0],left:'ﬃ'}]});const ligatureShown=await pdfText(await writeSnapshotPdf(ligature,signal(),font));assert(ligatureShown.text.includes('ffi'));assert(!ligatureShown.text.includes('[U+'));assert(JSON.parse(await writeSnapshotTxt(ligature).text()).rows[0].left==='ﬃ');
 const output=process.env.REPORT_TEST_PDF;if(output)await fs.writeFile(output,new Uint8Array(await blob.arrayBuffer()));
 t.diagnostic(JSON.stringify({bytes:blob.size}));
});

test('snapshot rejects oversized and cyclic input before cloning output jobs',()=>{
 const huge={...input(),rows:[{...input().rows[0],left:'x'.repeat(REPORT_LIMITS.textBytes+1)}]};assert.throws(()=>createExportSnapshot(huge),/REPORT_LIMIT/);
 const cyclic={};cyclic.self=cyclic;assert.throws(()=>createExportSnapshot({...input(),appliedOptions:cyclic}),/INVALID_SNAPSHOT/);
 assert.throws(()=>writeSnapshotTxt({...snapshot()}),/INVALID_SNAPSHOT/);
});
