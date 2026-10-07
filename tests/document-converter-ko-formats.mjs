import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import JSZip from 'jszip';
import {PDFDocument} from 'pdf-lib';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4197';
const fixtures=path.join(import.meta.dirname,'fixtures/document-converters');
const output=await fs.mkdtemp('/tmp/worklazy-ko-formats-');
let browser,context,page;const external=[];
before(async()=>{browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});context=await browser.newContext({reducedMotion:'reduce'});await context.addInitScript(()=>localStorage.setItem('worklazy_privacy_consent_v2','denied'));await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===new URL(base).origin||['blob:','data:'].includes(u.protocol))return r.continue();external.push(u.href);return r.abort();});page=await context.newPage();page.setDefaultTimeout(150000);});
after(async()=>{await browser?.close();console.log('Evidence:',output);});
async function visit(route){await page.goto(base+'/ko/tools/'+route+'/');await page.locator('[data-tool-page]').waitFor();}
async function bytes(id,file){await page.getByTestId(id).waitFor();assert.deepEqual(await page.getByRole('alert').allTextContents(),[]);const b=Buffer.from(await page.getByTestId(id).evaluate(async a=>Array.from(new Uint8Array(await(await fetch(a.href)).arrayBuffer()))));await fs.writeFile(path.join(output,file),b);await page.getByTestId(id).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,file+'.png')});return b;}
for(const ext of ['doc','docx','xls','xlsx','ppt','pptx'])test('KO '+ext+' to PDF',async()=>{if(ext==='doc')await visit('pdf-converter/document-to-pdf');await page.locator('input[type=file]').setInputFiles(path.join(fixtures,'sample.'+ext));await page.getByRole('button',{name:'PDF 만들기',exact:true}).click();const file='office-'+ext+'.pdf',b=await bytes('document-pdf-download',file);assert.equal((await PDFDocument.load(b)).getPageCount(),1);assert.match(execFileSync('pdftotext',[path.join(output,file),'-'],{encoding:'utf8'}),/한글/);});
for(const ext of ['docx','xls','xlsx','pptx','pdf'])test('KO '+ext+' to actual MarkItDown output',async()=>{if(ext==='docx')await visit('document-markdown');await page.locator('input[type=file]').setInputFiles(path.join(fixtures,'sample.'+ext));await page.getByRole('button',{name:'Markdown 만들기',exact:true}).click();const b=await bytes('markdown-download','markdown-'+ext+'.md'),expected=JSON.parse(await fs.readFile(path.join(fixtures,'markdown-expected.json'),'utf8'));assert.equal(b.toString(),expected[ext]);});
for(const format of ['DOCX','XLSX','TXT','PPTX','HWPX','검색 PDF'])test('KO PDF to '+format,async()=>{await visit('pdf-converter/pdf-to-document');await page.locator('input[type=file]').setInputFiles(path.join(fixtures,'rich.pdf'));await page.getByRole('radio',{name:new RegExp('^'+format)}).click();const label=format==='검색 PDF'?"OCR PDF 만들기":format+'로 변환';await page.getByRole('button',{name:label,exact:true}).click();const ext=format==='검색 PDF'?'pdf':format.toLowerCase(),file='pdf-output.'+ext,b=await bytes('pdf-download',file);
 if(ext==='txt')assert.match(b.toString(),/한글/);else if(ext==='pdf'){assert.equal((await PDFDocument.load(b)).getPageCount(),2);assert.match(execFileSync('pdftotext',[path.join(output,file),'-'],{encoding:'utf8'}),/FIRST PAGE/);}else{const zip=await JSZip.loadAsync(b);const paths=Object.keys(zip.files).filter(n=>/^(word\/document|xl\/sharedStrings|ppt\/slides\/slide\d+|Contents\/section\d+)\.xml$/.test(n));assert.ok(paths.length);assert.match((await Promise.all(paths.map(n=>zip.file(n).async('string')))).join(''),/한글/);}
});
for(const lang of ['ko','en'])test(lang+' thumbnail TypeError has safe localized recovery text',async()=>{
 await page.goto(base+'/'+lang+'/tools/pdf-converter/pdf-to-document/');await page.locator('[data-tool-page]').waitFor();
 await page.evaluate(()=>{const original=HTMLCanvasElement.prototype.getContext;window.__restoreThumbnail=()=>HTMLCanvasElement.prototype.getContext=original;window.__thumbnailHits=0;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='2d'&&this.width===160&&this.height===80){window.__thumbnailHits++;throw new TypeError('SDK_PRIVATE_SENTINEL createImageData');}return original.call(this,type,...args);};});
 try{await page.locator('input[type=file]').setInputFiles(path.join(fixtures,'rich.pdf'));const error=page.locator('.pdf-thumbnail-error').first();await error.waitFor();const message=await error.innerText();assert.doesNotMatch(message,/SDK_PRIVATE_SENTINEL|TypeError|createImageData/);assert.match(message,lang==='ko'?/미리보기/:/preview/);assert.ok(await page.evaluate(()=>window.__thumbnailHits));await page.screenshot({path:path.join(output,'thumbnail-error-'+lang+'.png')});}finally{await page.evaluate(()=>window.__restoreThumbnail());}
 await page.locator('input[type=file]').setInputFiles(path.join(fixtures,'sample.pdf'));await page.locator('.pdf-thumbnail-frame img').first().waitFor();assert.equal(await page.locator('.pdf-thumbnail-error').count(),0);
});
test('all synthetic KO conversions made no external request',()=>assert.deepEqual(external,[]));
