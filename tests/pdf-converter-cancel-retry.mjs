import assert from 'node:assert/strict';
import {test} from 'node:test';
import {chromium} from 'playwright';
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:4189';
for(const lang of ['ko','en']) test(lang+' cancel aborts a held PDF document worker and allows a clean retry',async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const context=await browser.newContext();await context.addInitScript(()=>localStorage.setItem('worklazy_privacy_consent_v2','denied'));
  let held, resolveHeld;const requested=new Promise(resolve=>resolveHeld=resolve);
  await context.route('**/assets/pdfOffice.worker-*.js',route=>{held=route;resolveHeld();});
  const page=await context.newPage();page.setDefaultTimeout(60000);await page.goto(base+'/'+lang+'/tools/pdf-converter/pdf-to-document/');
  await page.locator('input[type=file]').setInputFiles(new URL('fixtures/document-converters/rich.pdf',import.meta.url).pathname);
  await page.getByRole('radio',{name:/^PPTX/}).click();await page.getByRole('button',{name:lang==='ko'?'PPTX로 변환':'Convert to PPTX',exact:true}).click();
  await Promise.race([requested,new Promise((_,reject)=>setTimeout(()=>reject(Error('Worker request not reached')),30000))]);
  await page.getByRole('button',{name:lang==='ko'?'변환 취소':'Cancel conversion',exact:true}).click();
  assert.equal(await page.getByTestId('pdf-download').count(),0);assert.equal(await page.getByRole('button',{name:lang==='ko'?'PPTX로 변환':'Convert to PPTX',exact:true}).isEnabled(),true);
  await context.unroute('**/assets/pdfOffice.worker-*.js');await held.abort().catch(()=>{});
  await page.getByRole('button',{name:lang==='ko'?'PPTX로 변환':'Convert to PPTX',exact:true}).click();await page.getByTestId('pdf-download').waitFor();assert.deepEqual(await page.getByRole('alert').allTextContents(),[]);
 }finally{await browser.close();}
});
