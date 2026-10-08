import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import JSZip from 'jszip';
import {PDFDocument} from 'pdf-lib';
import {test} from 'node:test';
await test('PDF conversion engines preserve source content, order, images and OCR behavior',async()=>{
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4188';
const root=path.resolve('tests/fixtures/document-conversion-engines');
const out=process.env.EVIDENCE_DIR||await fs.mkdtemp('/tmp/worklazy-pdf-conversion-engines-');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--disable-dev-shm-usage'],chromiumSandbox:true});
const context=await browser.newContext({serviceWorkers:'block'});const external=[],requests=[],errors=[];
await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===new URL(base).origin||['data:','blob:'].includes(u.protocol)){requests.push(u.pathname);return route.continue();}external.push(u.href);return route.abort();});
const page=await context.newPage();await page.routeWebSocket('**',socket=>socket.close());page.on('pageerror',err=>errors.push(err.message));page.on('console',msg=>{if(msg.type()==='error')console.error(msg.text().slice(0,800));});
const tests=[
 {id:'digital-docx-off',input:'rich.pdf',format:'docx',expectedText:['한글','FIRST PAGE','SECOND PAGE','42'],minImages:1,minTables:1},
 {id:'restricted-order-docx-off',input:'restricted-rich.pdf',format:'docx',selectedPageIndexes:[1,0],expectedOrder:[1,0],expectedText:['FIRST PAGE','SECOND PAGE','42'],expectedOrderedText:['SECOND PAGE','FIRST PAGE'],minImages:1},
 {id:'scan-docx-off-default',input:'scan-none.pdf',format:'docx',minImages:1,expectedPageStatus:'image-preserved'},
 ...['docx','pptx','hwpx'].map(format=>({id:`scan-${format}-off-image`,input:'scan-none.pdf',format,outputMode:'page-image',minImages:1})),
 ...['docx','pptx','hwpx'].map(format=>({id:`ordered-${format}-image`,input:'mixed-five.pdf',format,outputMode:'page-image',selectedPageIndexes:[4,1,0,4],expectedOrder:[4,1,0],minImages:3})),
 {id:'blank-preserved-docx',input:'mixed-five.pdf',format:'docx',outputMode:'page-image',selectedPageIndexes:[2],minImages:1},
 {id:'rotated-crop-docx',input:'rotated-cropped-annotation.pdf',format:'docx',outputMode:'page-image',minImages:1},
 {id:'type3-existing-ocr-docx',input:'scan-type3.pdf',format:'docx',expectedText:['SCAN BODY','FIRST PAGE','Apples','42'],minImages:1},
 {id:'corrupt-image-docx-reject',input:'review-badimage.pdf',format:'docx',expectError:'IMAGE_DECODE'},
 {id:'opacity-existing-ocr-docx',input:'scan-opacity0.pdf',format:'docx',expectedText:['SCAN BODY','FIRST PAGE','Apples','42'],minImages:1},
 {id:'digital-xlsx',input:'ocr-oracle-digital.pdf',format:'xlsx',expectedText:['Apples','42']},
 {id:'mixed-partial-xlsx-auto',input:'mixed-five.pdf',format:'xlsx',ocrMode:'auto',selectedPageIndexes:[0,1],expectedText:['한글','42'],expectedPartialPage:1},
 {id:'empty-xlsx-reject',input:'scan-none.pdf',format:'xlsx',expectError:'OCR_REQUIRED_FOR_TABLES'},
 {id:'auto-scan-xlsx-reject',input:'scan-none.pdf',format:'xlsx',ocrMode:'auto',expectError:'SCAN_TABLE_UNAVAILABLE'},
 {id:'scan-txt-off-reject',input:'scan-none.pdf',format:'txt',expectError:'NO_TEXT'},
 {id:'empty-selection-reject',input:'rich.pdf',format:'docx',selectedPageIndexes:[],expectError:'INVALID_RANGE'},
 {id:'auto-scan-docx',input:'scan-none.pdf',format:'docx',ocrMode:'auto',expectedText:['SCAN BODY','FIRST PAGE','42'],minImages:1},
 {id:'auto-short-title-docx',input:'short-title-scan.pdf',format:'docx',ocrMode:'auto',expectedText:['SHORT TITLE','FIRST PAGE','42']},
 {id:'auto-mixed-docx',input:'mixed-five.pdf',format:'docx',ocrMode:'auto',expectedText:['한글','FIRST PAGE','SHORT TITLE','42'],expectedImageText:'SECOND PAGE',expectedFallbackPage:4,expectedOrder:[0,1,2,3,4]},
 {id:'searchable-scan-auto',input:'scan-none.pdf',format:'searchable-pdf',ocrMode:'auto',expectedText:['SCAN BODY','FIRST PAGE','Apples','42']},
 {id:'searchable-existing-auto',input:'scan-type3.pdf',format:'searchable-pdf',ocrMode:'auto',expectedText:['SCAN BODY','FIRST PAGE','Apples','42'],expectedPageStatus:'existing-ocr'},
 {id:'searchable-scan-off',input:'scan-none.pdf',format:'searchable-pdf'},
 {id:'highres-pptx-image',input:'high-resolution-six.pdf',format:'pptx',outputMode:'page-image',minImages:6},
];
const selected=process.env.PROBE_FILTER?tests.filter(t=>new RegExp(process.env.PROBE_FILTER).test(t.id)):tests;const results=[];
try {
await page.goto(base+'/en/tools/pdf-converter/pdf-to-document/');await page.locator('input[type=file]').waitFor();
// Warm Vite dependency transforms before handing source data to the conversion core.
await page.evaluate(async()=>{await import('/src/features/pdf-editor/pdfConversionCore.ts');});
for(const test of selected){
 console.log('START',test.id);const source=await fs.readFile(path.join(['rich.pdf','review-badimage.pdf'].includes(test.input)?'tests/fixtures/document-converters':root,test.input));
 const before=requests.length;
 const data=await page.evaluate(async({input,test})=>{
 const {convertPdfDocument}=await import('/src/features/pdf-editor/pdfConversionCore.ts');const source=new File([new Uint8Array(input)],test.input,{type:'application/pdf'});const controller=new AbortController();const start=performance.now();let last=start,maxDelay=0;const progress=[];
 const beat=setInterval(()=>{const now=performance.now();maxDelay=Math.max(maxDelay,now-last-50);last=now;},50);const timeout=setTimeout(()=>controller.abort(),240000);
 try {const r=await convertPdfDocument({source,fileName:test.id,format:test.format,selectedPageIndexes:test.selectedPageIndexes,ocrMode:test.ocrMode||'off',ocrLanguage:'kor+eng',ocrLayout:'sparse',outputMode:test.outputMode||'editable',language:'en',signal:controller.signal,onProgress:(value,message)=>progress.push({value,message,ms:performance.now()-start})});return {ok:true,fileName:r.fileName,mimeType:r.mimeType,warnings:r.warnings,pages:r.pages,bytes:Array.from(new Uint8Array(await r.blob.arrayBuffer())),ms:performance.now()-start,maxDelay,heap:performance.memory?.usedJSHeapSize,progress};}
 catch(e){return {ok:false,error:String(e),ms:performance.now()-start,progress,maxDelay};}finally{clearInterval(beat);clearTimeout(timeout);const {releasePdf}=await import('/src/features/pdf-editor/pdfPreview.ts');await releasePdf(source);}
 },{input:[...source],test});
 let text='',media=[],tables=0;
 try{
 if(test.expectError){assert.equal(data.ok,false,'must reject this input');assert.match(data.error,new RegExp(test.expectError));}
 else{
 assert.equal(data.ok,true,data.error);const bytes=Buffer.from(data.bytes);await fs.writeFile(path.join(out,`${test.id}.${test.format}`),bytes);
 if(test.expectedPageStatus)assert.equal(data.pages[0]?.status,test.expectedPageStatus);
 if(test.expectedPartialPage!==undefined){assert.equal(data.pages[test.expectedPartialPage]?.status,'no-table');assert.ok(data.pages[test.expectedPartialPage]?.warnings.length,'partial XLSX page needs warning');}
 if(test.expectedFallbackPage!==undefined){assert.equal(data.pages[test.expectedFallbackPage]?.status,'image-preserved');assert.ok(data.pages[test.expectedFallbackPage]?.warnings.length,'page fallback needs a warning');}
 if(test.format==='searchable-pdf'){
  const doc=await PDFDocument.load(bytes);assert.equal(doc.getPageCount(),test.selectedPageIndexes?.length||1);
  const pdf=path.join(out,`${test.id}.${test.format}`);const reopened=execFileSync('pdftotext',[pdf,'-'],{encoding:'utf8'});
  for(const word of test.expectedText||[])assert.ok(reopened.includes(word),`searchable PDF missing ${word}`);
  assert.match(execFileSync('pdfimages',['-list',pdf],{encoding:'utf8'}),/image/);
  if(test.id==='searchable-scan-off')assert.doesNotMatch(reopened,/SCAN BODY/);
 }else{
 const zip=await JSZip.loadAsync(bytes);const xmlPaths=Object.keys(zip.files).filter(p=>test.format==='docx'?p==='word/document.xml':test.format==='pptx'?/^ppt\/slides\/slide\d+\.xml$/.test(p):test.format==='hwpx'?/^Contents\/section\d+\.xml$/.test(p):/^xl\/.*\.xml$/.test(p));
 const xml=(await Promise.all(xmlPaths.map(p=>zip.file(p).async('string')))).join('\n');text=xml.replace(/<[^>]*>/g,'');tables=(xml.match(/<w:tbl>/g)||[]).length;
 media=Object.keys(zip.files).filter(p=>!zip.files[p].dir&&(/^(word|ppt)\/media\//.test(p)||/^BinData\//.test(p)));
 for(const word of test.expectedText||[])assert.ok(text.includes(word),`missing ${word}`);if(test.minImages)assert.ok(media.length>=test.minImages,`images ${media.length}<${test.minImages}`);if(test.minTables)assert.ok(tables>=test.minTables,`tables ${tables}<${test.minTables}`);
 if(test.expectedOrderedText)assert.ok(text.indexOf(test.expectedOrderedText[0])<text.indexOf(test.expectedOrderedText[1]),'source page order changed');
 if(test.expectedOrder)assert.deepEqual(data.pages.map(p=>p.sourcePageIndex),test.expectedOrder);
 if(!test.ocrMode||test.ocrMode==='off'||test.id==='searchable-existing-auto'){assert.deepEqual(requests.slice(before).filter(p=>/tesseract|traineddata/.test(p)),[],'OCR off or existing layer must not load OCR runtime');}
 if(test.format==='docx'||test.format==='pptx'){
 const dest=path.join(out,'reopened');await fs.mkdir(dest,{recursive:true});
 execFileSync('libreoffice',[`-env:UserInstallation=file://${path.resolve(out,'lo-profile')}`,'--headless','--convert-to','pdf','--outdir',dest,path.join(out,`${test.id}.${test.format}`)],{timeout:90000,stdio:'pipe'});
 const pdf=path.join(dest,`${test.id}.pdf`);assert.ok((await fs.stat(pdf)).size>0);
 if(test.outputMode==='page-image'){const expected=test.selectedPageIndexes?new Set(test.selectedPageIndexes).size:(await PDFDocument.load(source)).getPageCount();const actual=(await PDFDocument.load(await fs.readFile(pdf))).getPageCount();assert.equal(actual,expected,'page-image output adds/drops a page');}
 if(test.expectedText){const reopened=execFileSync('pdftotext',[pdf,'-'],{encoding:'utf8'});for(const word of test.expectedText)assert.ok(reopened.includes(word),`reopened missing ${word}`);}
 if(test.expectedImageText){const image=path.join(dest,`${test.id}-fallback`);execFileSync('pdftoppm',['-f',String(test.expectedFallbackPage+1),'-l',String(test.expectedFallbackPage+1),'-singlefile','-scale-to','1000','-png',pdf,image]);const recognized=execFileSync('tesseract',[`${image}.png`,'stdout','-l','eng','--psm','1'],{encoding:'utf8',stdio:['ignore','pipe','ignore']});assert.match(recognized,/SECOND PAGE/i,'rendered fallback lost rotated source text');}
 }
 }
 }
 data.verdict='PASS';
 }catch(e){data.verdict='FAIL';data.assertion=String(e);}
 delete data.bytes;Object.assign(data,{id:test.id,input:test.input,format:test.format,mediaCount:media.length,tables,xmlText:text.slice(0,1200),workerURLs:page.workers().map(w=>w.url())});results.push(data);await fs.writeFile(path.join(out,'results.json'),JSON.stringify({base,results,external,errors},null,2));console.log(data.verdict,test.id,data.ms,data.error||data.assertion||'');
}
}finally{await browser.close();}
console.log('Evidence:',out,'scenarios:',selected.length);
assert.equal(results.filter(t=>t.verdict!=='PASS').length,0,JSON.stringify(results.filter(t=>t.verdict!=='PASS').map(t=>({id:t.id,error:t.error,assertion:t.assertion}))));
assert.deepEqual(external,[]);
assert.deepEqual(errors,[]);
});
