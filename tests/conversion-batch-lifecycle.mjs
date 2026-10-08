import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4197';
const evidence=process.env.BATCH_EVIDENCE_DIR||await fs.mkdtemp('/tmp/worklazy-batch-lifecycle-');await fs.mkdir(evidence,{recursive:true});
let browser;before(async()=>{browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',chromiumSandbox:true,args:['--disable-dev-shm-usage']});});after(async()=>{await browser?.close();console.log('Evidence:',evidence);});
async function open(route,lang='en'){
 const context=await browser.newContext();await context.addInitScript(()=>localStorage.setItem('worklazy_privacy_consent_v2','denied'));
 const page=await context.newPage();page.setDefaultTimeout(120000);await page.goto(`${base}/${lang}/tools/${route}/`);return {page,context};
}
async function add(page,names){await page.locator('input[type=file]').setInputFiles(names.map(name=>path.join(import.meta.dirname,'fixtures/document-converters',name)));await page.getByTestId('conversion-batch').waitFor();}
async function settled(page){await page.waitForFunction(()=>document.querySelectorAll('[data-testid=batch-row][data-state=running],[data-testid=batch-row][data-state=pending]').length===0);}
for(const mode of ['pdf','markdown'])test(mode+' cancellation reaches a held worker, advances next file and retries without losing results',async()=>{
 const {page,context}=await open(mode==='pdf'?'pdf-converter/pdf-to-document':'document-markdown');
 try{
  const pattern=mode==='pdf'?'**/assets/pdfOffice.worker-*.js':'**/assets/markdown.worker-*.js';
  let held,resolveReached;const reached=new Promise(resolve=>{resolveReached=resolve;});
  await context.route(pattern,route=>{if(!held){held=route;resolveReached();}else void route.continue();});
  await add(page,mode==='pdf'?['rich.pdf','sample.pdf']:['sample.docx','sample.xlsx']);
  if(mode==='pdf'){await page.getByRole('combobox',{name:'Output format',exact:true}).selectOption('hwpx');await page.getByRole('combobox',{name:'OCR scope',exact:true}).selectOption('off');}
  await page.getByRole('button',{name:'Convert queued files',exact:true}).click();
  let timer;try{await Promise.race([reached,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Worker request not reached')),60000);})]);}finally{clearTimeout(timer);}
  await page.getByTestId('batch-row').first().getByRole('button',{name:'Cancel',exact:true}).click();await held.abort().catch(()=>{});await context.unroute(pattern);await settled(page);
  assert.deepEqual(await page.getByTestId('batch-row').evaluateAll(rows=>rows.map(r=>r.dataset.state)),['cancelled','success']);assert.equal(await page.getByTestId('batch-download').count(),1);
  await page.getByTestId('batch-row').first().getByRole('button',{name:'Queue again',exact:true}).click();await page.getByRole('button',{name:'Convert queued files',exact:true}).click();await settled(page);assert.equal(await page.getByTestId('batch-download').count(),2);
  const a=page.getByTestId('batch-row').first().getByTestId('batch-download');const bytes=Buffer.from(await a.evaluate(async a=>Array.from(new Uint8Array(await(await fetch(a.href)).arrayBuffer()))));
  if(mode==='pdf'){const z=await JSZip.loadAsync(bytes);assert.ok(Object.keys(z.files).some(n=>n.startsWith('BinData/')));assert.match(await z.file('Contents/section0.xml').async('string'),/한글/);}else assert.match(bytes.toString(),/한글/);
  await fs.writeFile(path.join(evidence,`retry.${mode==='pdf'?'hwpx':'md'}`),bytes);
 }finally{await context.close();}
});
test('batch loaded/result language switching preserves inputs, options and controlled localized errors',async()=>{
 const {page,context}=await open('pdf-converter/pdf-to-document','ko');
 try{
  await add(page,['rich.pdf','sample.pdf']);await page.getByRole('combobox',{name:'출력 형식',exact:true}).selectOption('hwpx');await page.getByRole('combobox',{name:'OCR 적용',exact:true}).selectOption('off');await page.getByLabel('파일별 페이지 범위',{exact:true}).fill('2');
  for(const lang of ['en','ko']){
   await page.locator('[data-ui-component=language-switcher]:visible').first().selectOption(lang);await page.waitForURL(new RegExp('/'+lang+'/'));
   assert.equal(await page.getByTestId('batch-row').count(),2);assert.equal(await page.getByRole('combobox',{name:lang==='ko'?'출력 형식':'Output format',exact:true}).inputValue(),'hwpx');assert.equal(await page.getByLabel(lang==='ko'?'파일별 페이지 범위':'Page range in each file',{exact:true}).inputValue(),'2');
  }
  await page.getByRole('button',{name:'대기 파일 변환',exact:true}).click();await settled(page);assert.deepEqual(await page.getByTestId('batch-row').evaluateAll(rows=>rows.map(r=>r.dataset.state)),['success','failed']);assert.match(await page.getByRole('alert').innerText(),/범위/);
  const oldUrl=await page.getByTestId('batch-download').getAttribute('href');await page.locator('[data-ui-component=language-switcher]:visible').first().selectOption('en');await page.waitForURL(/\/en\//);assert.equal(await page.getByTestId('batch-download').getAttribute('href'),oldUrl);assert.match(await page.getByRole('alert').innerText(),/page range/);assert.doesNotMatch(await page.getByRole('alert').innerText(),/[가-힣]/u);
  await page.screenshot({path:path.join(evidence,'switched-results.png'),fullPage:true});
 }finally{await context.close();}
});
test('OCR direct entry starts batch with searchable PDF and manual OCR options stay available',async()=>{
 const {page,context}=await open('pdf-converter/pdf-to-document/ocr');
 try {await add(page,['scanned.pdf','sample.pdf']);assert.equal(await page.getByRole('combobox',{name:'Output format',exact:true}).inputValue(),'searchable-pdf');assert.equal(await page.getByRole('combobox',{name:'OCR scope',exact:true}).inputValue(),'auto');await page.getByRole('combobox',{name:'OCR text layout',exact:true}).selectOption('paragraphs');await page.getByLabel('Page range in each file',{exact:true}).fill('1');await page.getByRole('button',{name:'Convert queued files',exact:true}).click();await settled(page);assert.equal(await page.getByTestId('batch-download').count(),2);}
 finally{await context.close();}
});
