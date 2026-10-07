import assert from 'node:assert/strict';
import {test,before,after} from 'node:test';
import path from 'node:path';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4197';const output=await fs.mkdtemp('/tmp/worklazy-converter-input-errors-');let browser;
before(async()=>{browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});});
after(async()=>{await browser?.close();console.log('Evidence:',output);});
for(const lang of ['ko','en'])for(const kind of ['encrypted','damaged','display-load'])test(lang+' '+kind+' retains safe recovery instructions',async()=>{
 const context=await browser.newContext();try{await context.addInitScript(()=>localStorage.setItem('worklazy_privacy_consent_v2','denied'));const page=await context.newPage();page.setDefaultTimeout(60000);let hits=0;
 if(kind==='display-load')await context.route('**/assets/pdf-*.mjs',route=>{hits++;return route.abort();});
 await page.goto(base+'/'+lang+'/tools/pdf-converter/pdf-to-document/');
 const input=kind==='encrypted'?path.join(import.meta.dirname,'fixtures/pdf-finish/encrypted/encrypted-r6-open.pdf'):kind==='damaged'?{name:'damaged.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7 broken SDK_PRIVATE_SENTINEL')}:path.join(import.meta.dirname,'fixtures/document-converters/sample.pdf');
 await page.locator('input[type=file]').setInputFiles(input);await page.getByTestId('pdf-error').waitFor();const text=await page.getByTestId('pdf-error').innerText();assert.doesNotMatch(text,/SDK_PRIVATE_SENTINEL|InvalidPDFException|PasswordException|TypeError|__worklazy_i18n__/);
 if(kind==='encrypted')assert.match(text,lang==='ko'?/암호/:/password-protected/);if(kind==='display-load'){assert.ok(hits>0);await page.getByTestId('pdf-display-reload').waitFor();}
 assert.equal(await page.getByTestId('pdf-download').count(),0);await fs.writeFile(path.join(output,lang+'-'+kind+'.txt'),text);await page.getByTestId('pdf-error').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,lang+'-'+kind+'.png')});
 if(kind==='display-load'){await context.unroute('**/assets/pdf-*.mjs');await Promise.all([page.waitForEvent('load'),page.getByTestId('pdf-display-reload').click()]);}
 await page.locator('input[type=file]').setInputFiles(path.join(import.meta.dirname,'fixtures/document-converters/sample.pdf'));await page.getByRole('button',{name:lang==='ko'?'DOCX로 변환':'Convert to DOCX',exact:true}).click();await page.getByTestId('pdf-download').waitFor();assert.equal(await page.getByTestId('pdf-error').count(),0);
 }finally{await context.close();}
});
