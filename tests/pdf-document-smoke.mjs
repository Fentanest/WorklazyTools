import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:4188';
const fixture=path.join(import.meta.dirname,'fixtures/document-converters');
let browser,page;const external=[],errors=[];
before(async()=>{
 browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
 await context.addInitScript(()=>localStorage.setItem('worklazy_privacy_consent_v2','denied'));
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===new URL(base).origin||['blob:','data:'].includes(u.protocol))return route.continue();external.push(u.href);return route.abort();});
 page=await context.newPage();page.setDefaultTimeout(120000);page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/en/tools/pdf-converter/pdf-to-document/');
 await page.locator('input[type=file]').waitFor();
 assert.equal(await page.locator('.pdf-tool-navigation a').count(),4);
 await page.locator('input[type=file]').setInputFiles(path.join(fixture,'rich.pdf'));
 await page.locator('.pdf-page-card').first().waitFor();
});
after(async()=>{await browser?.close();});
async function convert(format){
 await page.getByRole('radio',{name:new RegExp('^'+format.toUpperCase())}).click();
 await page.getByRole('button',{name:'Convert to '+format.toUpperCase(),exact:true}).click();
 const link=page.getByTestId('pdf-download');await link.waitFor();
 return Buffer.from(await link.evaluate(async a=>Array.from(new Uint8Array(await(await fetch(a.href)).arrayBuffer()))));
}
test('PDF to DOCX extracts Korean text across both pages, with explicit layout limitations',async()=>{
 const zip=await JSZip.loadAsync(await convert('docx'));const xml=await zip.file('word/document.xml').async('string');
 assert.match(xml,/한글/);assert.match(xml,/FIRST PAGE/);assert.match(xml,/SECOND PAGE/);assert.match(xml,/42/);
 assert.match(await page.locator('[data-pdf-mode=pdf-to-document]').innerText(),/does not guarantee restoration/);
});
test('PDF to XLSX extracts cells into two sheets',async()=>{
 const book=new ExcelJS.Workbook();await book.xlsx.load(await convert('xlsx'));assert.equal(book.worksheets.length,2);
 const text=JSON.stringify(book.worksheets.map(s=>s.getSheetValues()));assert.match(text,/한글/);assert.match(text,/42/);assert.match(text,/SECOND PAGE/);
});
test('page range keeps only requested page in the exported document',async()=>{
 await page.getByTestId('pdf-output-card').locator('input').first().fill('2');
 const zip=await JSZip.loadAsync(await convert('docx'));const xml=await zip.file('word/document.xml').async('string');
 assert.match(xml,/SECOND PAGE/);assert.doesNotMatch(xml,/FIRST PAGE/);
});
test('scanned PDF fails clearly with OCR off and yields text with OCR on',async()=>{
 await page.locator('input[type=file]').setInputFiles(path.join(fixture,'scanned.pdf'));
 await page.getByTestId('pdf-output-card').locator('input').first().fill('');
 await page.getByRole('button',{name:'Off',exact:true}).click();
 await page.getByRole('button',{name:'Convert to DOCX',exact:true}).click();
 await page.getByRole('alert').first().waitFor();assert.equal(await page.getByTestId('pdf-download').count(),0);
 await page.getByRole('button',{name:'Auto',exact:true}).click();
 const zip=await JSZip.loadAsync(await convert('docx'));const xml=await zip.file('word/document.xml').async('string');
 assert.match(xml,/FIRST PAGE/);assert.match(xml,/42/);
});
test('processing makes no external request or uncaught browser error',async()=>{assert.deepEqual(external,[]);assert.deepEqual(errors,[]);});
