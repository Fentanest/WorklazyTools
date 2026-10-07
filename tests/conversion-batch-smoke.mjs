import assert from 'node:assert/strict';
import { test, before, after, beforeEach, afterEach } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import AxeBuilder from '@axe-core/playwright';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4197';
const fixtures = path.join(import.meta.dirname, 'fixtures/document-converters');
const evidence = process.env.BATCH_EVIDENCE_DIR || await fs.mkdtemp('/tmp/worklazy-batch-');
await fs.mkdir(evidence, {recursive:true});
let browser;
beforeEach(async context=>{await fs.appendFile(path.join(evidence,'progress.log'),`START ${context.name}\n`);});
afterEach(async context=>{await fs.appendFile(path.join(evidence,'progress.log'),`END ${context.name}\n`);});
before(async()=> { browser = await chromium.launch({executablePath:'/usr/bin/google-chrome', args:['--disable-dev-shm-usage'], chromiumSandbox:true}); });
after(async()=> { await browser?.close(); console.log('Evidence:', evidence); });
async function open(lang, route) {
 const context = await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
 await context.addInitScript(()=>localStorage.setItem('worklazy_privacy_consent_v2','denied'));
 const external=[]; await context.route('**/*', r=>{ const u=new URL(r.request().url()); if(u.origin===new URL(base).origin||['blob:','data:'].includes(u.protocol)) return r.continue(); external.push(u.href); return r.abort(); });
 const page=await context.newPage();page.setDefaultTimeout(180000);
 await page.goto(`${base}/${lang}/tools/${route}/`);await page.locator('input[type=file]').waitFor({state:'attached'});
 return {context,page,external};
}
async function add(page,names) { await page.locator('input[type=file]').setInputFiles(await Promise.all(names.map(async original=>{const name=original.startsWith('duplicate-')?original.slice(10):original;return {name,mimeType:'application/octet-stream',buffer:name.startsWith('damaged.')?Buffer.from('Deliberately damaged synthetic input'):await fs.readFile(path.join(fixtures,name))};})));await page.getByTestId('conversion-batch').waitFor(); }
async function start(page,lang) { await page.getByRole('button',{name:lang==='ko'?'대기 파일 변환':'Convert queued files',exact:true}).click(); await page.waitForFunction(()=>document.querySelectorAll('[data-testid=batch-row][data-state=running],[data-testid=batch-row][data-state=pending]').length===0); }
async function save(page, link, name) { const [download]=await Promise.all([page.waitForEvent('download'),link.click()]);const out=path.join(evidence,name);await download.saveAs(out);return out; }
async function archive(page,lang,name) {
 await page.getByRole('button',{name:lang==='ko'?'전체 ZIP 만들기':'Create combined ZIP',exact:true}).click();
 const out=await save(page,page.getByTestId('batch-zip-download'),name);return JSZip.loadAsync(await fs.readFile(out));
}
for(const lang of ['ko','en']) {
 test(`${lang}: PDF batch keeps page range, failures, duplicate names, retry and ZIP`,async()=>{
  const {page,context,external}=await open(lang,'pdf-converter/pdf-to-document');
  try {
   await add(page,['rich.pdf','damaged.pdf','duplicate-rich.pdf']);
   await page.getByRole('combobox',{name:lang==='ko'?'출력 형식':'Output format',exact:true}).selectOption('hwpx');
   await page.getByRole('combobox',{name:lang==='ko'?'OCR 적용':'OCR scope',exact:true}).selectOption('off');
   await page.getByLabel(lang==='ko'?'파일별 페이지 범위':'Page range in each file',{exact:true}).fill('1');await start(page,lang);
   assert.deepEqual(await page.getByTestId('batch-row').evaluateAll(rows=>rows.map(row=>row.dataset.state)),['success','failed','success']);
   const zip=await archive(page,lang,`${lang}-pdf-hwpx.zip`);const files=Object.keys(zip.files); assert.equal(files.length,2);assert.notEqual(files[0].toLowerCase(),files[1].toLowerCase());
   for(const name of files){const hwpx=await JSZip.loadAsync(await zip.file(name).async('nodebuffer'));assert.ok(Object.keys(hwpx.files).some(n=>n.startsWith('BinData/')));assert.match(await hwpx.file('Contents/section0.xml').async('string'),/한글/);}
   await page.getByTestId('batch-row').nth(1).getByRole('button',{name:lang==='ko'?'다시 대기':'Queue again',exact:true}).click();await start(page,lang);assert.equal(await page.getByTestId('batch-download').count(),2);
   await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   const axe=await new AxeBuilder({page}).include('[data-testid=conversion-batch]').analyze();await fs.writeFile(path.join(evidence,`${lang}-batch-axe.json`),JSON.stringify(axe.violations,null,2));assert.deepEqual(axe.violations.filter(v=>['serious','critical'].includes(v.impact)),[]);
   await page.screenshot({path:path.join(evidence,`${lang}-batch-mobile.png`),fullPage:true});assert.deepEqual(external,[]);
  }finally{await context.close();}
 });
 test(`${lang}: PDF image batch produces distinct per-document ZIPs with requested range`,async()=>{
  const {page,context}=await open(lang,'pdf-converter/pdf-to-image');try {
   await add(page,['rich.pdf','duplicate-rich.pdf']);await page.getByRole('combobox',{name:lang==='ko'?'이미지 형식':'Image format',exact:true}).selectOption('jpeg');await page.getByRole('combobox',{name:lang==='ko'?'해상도':'Resolution',exact:true}).selectOption('96');await page.getByLabel(lang==='ko'?'파일별 페이지 범위':'Page range in each file',{exact:true}).fill('2');await start(page,lang);
   const zip=await archive(page,lang,`${lang}-images.zip`);assert.equal(Object.keys(zip.files).length,2);
   for(const file of Object.values(zip.files)){const inner=await JSZip.loadAsync(await file.async('nodebuffer'));assert.deepEqual(Object.keys(inner.files),['rich-002.jpg']);}
  }finally{await context.close();}
 });
 test(`${lang}: MarkItDown batch isolates damaged file and preserves Korean Markdown`,async()=>{
  const {page,context,external}=await open(lang,'document-markdown');try {
   await add(page,['sample.docx','damaged.docx','sample.xlsx','duplicate-sample.docx']);await start(page,lang);
   assert.deepEqual(await page.getByTestId('batch-row').evaluateAll(rows=>rows.map(row=>row.dataset.state)),['success','failed','success','success']);
   const zip=await archive(page,lang,`${lang}-markdown.zip`);assert.equal(Object.keys(zip.files).length,3);for(const entry of Object.values(zip.files))assert.match(await entry.async('string'),/한글/);assert.deepEqual(external,[]);
  }finally{await context.close();}
 });
}
test('Office batch converts six input formats and retains HWP as manual print only',async()=>{
 const {page,context,external}=await open('en','pdf-converter/document-to-pdf');try {
  await add(page,['sample.doc','sample.docx','encrypted.docx','sample.xls','sample.xlsx','sample.ppt','sample.pptx','sample.hwp','sample.hwpx']);await start(page,'en');
  assert.deepEqual(await page.getByTestId('batch-row').evaluateAll(rows=>rows.map(row=>row.dataset.state)),['success','success','failed','success','success','success','success','print-needed','print-needed']);
  const zip=await archive(page,'en','office-six.zip');assert.equal(Object.keys(zip.files).length,6);
  let index=0;for(const entry of Object.values(zip.files)){const buf=await entry.async('nodebuffer');assert.equal((await PDFDocument.load(buf)).getPageCount(),1);const file=path.join(evidence,`office-${index++}.pdf`);await fs.writeFile(file,buf);assert.match(execFileSync('pdftotext',[file,'-'],{encoding:'utf8'}),/한글/);}
  assert.equal(await page.locator('iframe[data-office-pdf-engine]').count(),0);
  for(const index of [7,8]) { await page.getByTestId('batch-row').nth(index).getByRole('button',{name:'Print this document',exact:true}).click();await page.getByRole('button',{name:'Save PDF using print',exact:true}).waitFor();await page.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Save PDF using print'));return b&&!b.disabled;});await page.getByRole('button',{name:'Finish print review and return to list',exact:true}).click();assert.equal(await page.getByTestId('batch-row').nth(index).getAttribute('data-state'),'print-reviewed');assert.equal(await page.getByTestId('batch-row').nth(index).getByTestId('batch-download').count(),0); }
  assert.deepEqual(external,[]);
 }finally{await context.close();}
});
test('active Office worker cancellation destroys the frame and workers, then next file succeeds',async()=>{
 const {page,context}=await open('en','pdf-converter/document-to-pdf');
 try {
  let held; let ready;const reached=new Promise(resolve=>{ready=resolve;});
  await context.route('**/vendor/zetaoffice/**/office_thread.js',route=>{if(!held && route.request().resourceType()==='script'){held=route;ready();}else void route.continue();});
  await add(page,['rich.docx','sample.xlsx']);await page.getByRole('button',{name:'Convert queued files',exact:true}).click();
  let timer; try { await Promise.race([reached,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Office worker not reached')),120000);})]); } finally { clearTimeout(timer); }
  const before=page.workers().map(worker=>worker.url());assert.ok(before.length>0);
  await page.getByTestId('batch-row').first().getByRole('button',{name:'Cancel',exact:true}).click();await context.unroute('**/vendor/zetaoffice/**/office_thread.js');await held.abort().catch(()=>{});
  await page.waitForFunction(()=>document.querySelectorAll('[data-testid=batch-row][data-state=running],[data-testid=batch-row][data-state=pending]').length===0);
  assert.deepEqual(await page.getByTestId('batch-row').evaluateAll(rows=>rows.map(row=>row.dataset.state)),['cancelled','success']);
  await page.waitForFunction(()=>document.querySelectorAll('iframe[data-office-pdf-engine]').length===0);
  await new Promise(resolve=>setTimeout(resolve,200));assert.equal(page.workers().filter(worker=>before.includes(worker.url())).length,0);
  const saved=await save(page,page.getByTestId('batch-download'),'office-after-cancel.pdf');assert.match(execFileSync('pdftotext',[saved,'-'],{encoding:'utf8'}),/한글/);
  await fs.writeFile(path.join(evidence,'office-worker-cancel.json'),JSON.stringify({before,after:page.workers().map(worker=>worker.url()),states:await page.getByTestId('batch-row').evaluateAll(rows=>rows.map(row=>row.dataset.state))},null,2));
 }finally{await context.close();}
});
