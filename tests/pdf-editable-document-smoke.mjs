import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import JSZip from 'jszip';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {PNG} from 'pngjs';
import {execFileSync} from 'node:child_process';
import initRhwp, {HwpDocument} from '@rhwp/core';
const output=await fs.mkdtemp('/tmp/worklazy-pdf-editable-');
await initRhwp({module_or_path:await fs.readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:4188';
const fixture=path.join(import.meta.dirname,'fixtures/document-converters');
let browser,page;const external=[],errors=[];
before(async()=>{
 browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
 await context.addInitScript(()=>{localStorage.setItem('worklazy_privacy_consent_v2','denied');window.print=()=>{window.top.__printCapture={html:document.documentElement.outerHTML,url:location.href};};});
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===new URL(base).origin||['blob:','data:'].includes(u.protocol))return route.continue();external.push(u.href);return route.abort();});
 page=await context.newPage();page.setDefaultTimeout(120000);page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/en/tools/pdf-converter/pdf-to-document/');
 await page.locator('input[type=file]').waitFor();
 assert.equal(await page.locator('.pdf-tool-navigation a').count(),4);
 await page.locator('input[type=file]').setInputFiles(path.join(fixture,'rich.pdf'));
 await page.locator('.pdf-page-card').first().waitFor();
});
after(async()=>{await browser?.close();console.log('Evidence:',output);});
async function convert(format){
 await page.getByRole('radio',{name:new RegExp('^'+format.toUpperCase())}).click();
 await page.getByRole('button',{name:'Convert to '+format.toUpperCase(),exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-testid=pdf-download], [role=alert]'));assert.deepEqual(await page.getByRole('alert').allTextContents(),[]);
 const link=page.getByTestId('pdf-download');await link.waitFor();
 return Buffer.from(await link.evaluate(async a=>Array.from(new Uint8Array(await(await fetch(a.href)).arrayBuffer()))));
}

for (const format of ['pptx','hwpx']) {
 test('PDF → '+format+' creates Korean editable text and separate images, then reopens',async()=>{
  const bytes=await convert(format);const file=path.join(output,'rich.'+format);await fs.writeFile(file,bytes);
  const zip=await JSZip.loadAsync(bytes);const textEntries=Object.keys(zip.files).filter(name=>format==='pptx'?/^ppt\/slides\/slide\d+\.xml$/.test(name):/^Contents\/section\d+\.xml$/.test(name));
  const xml=(await Promise.all(textEntries.map(name=>zip.file(name).async('string')))).join('');
  assert.match(xml,/한글/);assert.match(xml,/FIRST PAGE/);assert.match(xml,/SECOND PAGE/);assert.match(xml,/42/);
  const media=Object.keys(zip.files).filter(name=>format==='pptx'?/^ppt\/media\/.*\.png$/.test(name):/^BinData\//.test(name)&&!zip.files[name].dir);assert.ok(media.length>=1,media.join(','));const bitmap=PNG.sync.read(await zip.file(media[0]).async('nodebuffer'));assert.equal(bitmap.width,160);assert.equal(bitmap.height,80);assert.ok(bitmap.data[0]>150&&bitmap.data[1]<80);
  if(format==='hwpx'){
   const doc=new HwpDocument(bytes);try{assert.match(doc.getTextFileText(),/한글/);assert.ok(JSON.parse(doc.getPageSourceImageKeys(0)).keys.length>0,'HWPX image must render, not merely exist in ZIP');doc.insertText(0,0,0,'EDITED ');const again=new HwpDocument(doc.exportHwpx());try{assert.match(again.getTextFileText(),/EDITED/);assert.ok(JSON.parse(again.getPageSourceImageKeys(0)).keys.length>0);}finally{again.free();}}finally{doc.free();}
  }else{
   execFileSync('libreoffice',['-env:UserInstallation=file://'+output+'/lo-profile','--headless','--convert-to','pdf','--outdir',output,file],{timeout:90000});
   const text=execFileSync('pdftotext',[path.join(output,'rich.pdf'),'-'],{encoding:'utf8'});assert.match(text,/한글/);assert.match(text,/42/);assert.match(text,/SECOND PAGE/);
   assert.match(execFileSync('pdfimages',['-list',path.join(output,'rich.pdf')],{encoding:'utf8'}),/image/);
  }
 });
}
test('generated HWPX displays two readable pages and images in the existing rhwp preview',async()=>{
 const view=await page.context().newPage();view.setDefaultTimeout(90000);
 try{
  await view.goto(base+'/en/tools/pdf-converter/document-to-pdf/');await view.waitForFunction(()=>crossOriginIsolated);
  await view.locator('input[type=file]').setInputFiles(path.join(output,'rich.hwpx'));
  const button=view.getByRole('button',{name:'Save PDF using print',exact:true});await button.click();
  await view.frameLocator('[data-testid=hwp-pdf-preview] iframe').getByRole('button',{name:'Open print dialog',exact:true}).click();
  await view.waitForFunction(()=>window.__printCapture);const capture=await view.evaluate(()=>window.__printCapture);
  assert.match(capture.html,/data:image\/png/);
  const print=await page.context().newPage();try{
   await print.goto(capture.url);await print.setContent(capture.html,{waitUntil:'load'});await print.evaluate(()=>document.fonts.ready);
   const file=path.join(output,'hwpx-reopened.pdf');const bytes=await print.pdf({path:file,preferCSSPageSize:true,printBackground:true});assert.equal((await PDFDocument.load(bytes)).getPageCount(),2);
   const text=execFileSync('pdftotext',[file,'-'],{encoding:'utf8'});assert.match(text.split('\f')[0],/FIRST PAGE/);assert.match(text.split('\f')[0],/42/);assert.match(text.split('\f')[1],/SECOND PAGE/);assert.match(text,/한글/);
   execFileSync('pdftoppm',['-f','1','-singlefile','-scale-to','1000','-png',file,path.join(output,'hwpx-reopened')]);
  }finally{await print.close();}
 }finally{await view.close();}
});
test('selected source page alone is exported to PPTX',async()=>{
 await page.getByTestId('pdf-output-card').locator('input').first().fill('2');const zip=await JSZip.loadAsync(await convert('pptx'));
 const xml=(await Promise.all(Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).map(n=>zip.file(n).async('string')))).join('');assert.match(xml,/SECOND PAGE/);assert.doesNotMatch(xml,/FIRST PAGE/);
});
test('long extracted text continues on additional editable slides without loss',async()=>{
 const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica);const sheet=doc.addPage([595,3000]);
 for(let i=0;i<100;i++)sheet.drawText(`EDITABLE_LINE_${String(i).padStart(3,'0')}`,{x:40,y:2950-i*28,size:14,font});
 await page.locator('input[type=file]').setInputFiles({name:'long.pdf',mimeType:'application/pdf',buffer:Buffer.from(await doc.save())});
 const zip=await JSZip.loadAsync(await convert('pptx'));const slides=Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n));assert.ok(slides.length>1);const xml=(await Promise.all(slides.map(n=>zip.file(n).async('string')))).join('');for(let i=0;i<100;i++)assert.ok(xml.includes(`EDITABLE_LINE_${String(i).padStart(3,'0')}`));
});
test('image-only PDF with OCR off reopens as a pictured HWPX page',async()=>{
 await page.locator('input[type=file]').setInputFiles(path.join(fixture,'scanned.pdf'));await page.getByRole('button',{name:'Off',exact:true}).click();
 const bytes=await convert('hwpx');const doc=new HwpDocument(bytes);try{assert.ok(JSON.parse(doc.getPageSourceImageKeys(0)).keys.length>0);assert.match(await page.locator('[data-pdf-mode=pdf-to-document]').innerText(),/not editable/);}finally{doc.free();}
});
test('scanned HWPX contains separate OCR text including 42 and a visible scan image',async()=>{
 await page.getByRole('button',{name:'Auto',exact:true}).click();const bytes=await convert('hwpx');const doc=new HwpDocument(bytes);try{assert.match(doc.getTextFileText(),/FIRST PAGE/);assert.match(doc.getTextFileText(),/42/);assert.ok(JSON.parse(doc.getPageSourceImageKeys(0)).keys.length>0);}finally{doc.free();}
});
test('mobile controls fit; no external requests or uncaught browser errors',async()=>{
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth,undefined,{timeout:5000}).catch(async error=>{console.error(await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,class:e.className,right:e.getBoundingClientRect().right})).slice(0,20)})));await page.screenshot({path:path.join(output,'mobile-failure.png'),fullPage:true});throw error;});await page.screenshot({path:path.join(output,'mobile.png'),fullPage:true});assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
});
