import assert from 'node:assert/strict';
import {before, after, test} from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import JSZip from 'jszip';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4197';
const baseline=process.env.EXPECT_RAW_ERRORS==='1';
const output=await fs.mkdtemp('/tmp/worklazy-conversion-errors-');
const fixture=path.join(import.meta.dirname,'fixtures/document-converters/rich.pdf');
const records=[];let browser,context,page;
const sha=b=>createHash('sha256').update(b).digest('hex');
before(async()=>{browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});});
after(async()=>{await browser?.close();await fs.writeFile(path.join(output,'errors.json'),JSON.stringify({baseline,records},null,2));console.log('Evidence:',output);});
async function open(lang){context=await browser.newContext();await context.addInitScript(()=>localStorage.setItem('worklazy_privacy_consent_v2','denied'));
 await context.route('**/*',r=>{const u=new URL(r.request().url());return u.origin===new URL(base).origin||['blob:','data:'].includes(u.protocol)?r.continue():r.abort();});
 page=await context.newPage();page.setDefaultTimeout(60000);await page.goto(base+'/'+lang+'/tools/pdf-converter/pdf-to-document/');
 await page.locator('input[type=file]').setInputFiles(fixture);await page.locator('.pdf-page-card').first().waitFor();
 await page.waitForFunction(()=>[...document.querySelectorAll('[data-testid=pdf-output-card] button')].some(b=>/로 변환|Convert to/.test(b.textContent)&&!b.disabled));}
async function convert(lang,format){await page.getByRole('radio',{name:new RegExp('^'+format)}).click();await page.getByRole('button',{name:lang==='ko'?format+'로 변환':'Convert to '+format,exact:true}).click();}
async function reject(lang,kind,format){await convert(lang,format);await page.getByTestId('pdf-error').waitFor();const alert=await page.getByTestId('pdf-error').innerText();const progress=await page.locator('.ui-operation-progress').allTextContents();
 assert.equal(await page.getByTestId('pdf-download').count(),0);
 if(baseline)assert.match(alert,/Image canvas unavailable|SDK_PRIVATE_SENTINEL|sectionCount|TypeError|createImageData/);
 else{assert.doesNotMatch(alert+' '+progress.join(' '),/Image canvas unavailable|SDK_PRIVATE_SENTINEL|sectionCount|TypeError|createImageData|__worklazy_i18n__/);assert.match(alert,lang==='ko'?/못했|중단/:/could not|couldn't|unable/i);}
 await page.getByTestId('pdf-error').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,lang+'-'+kind+'.png'),fullPage:false});return {lang,kind,alert,progress};}
async function retry(lang,format){await convert(lang,format);await page.getByTestId('pdf-download').waitFor();assert.equal(await page.getByTestId('pdf-error').count(),0);const bytes=Buffer.from(await page.getByTestId('pdf-download').evaluate(async a=>Array.from(new Uint8Array(await(await fetch(a.href)).arrayBuffer()))));const zip=await JSZip.loadAsync(bytes);assert.ok(Object.keys(zip.files).some(n=>/^(BinData\/|ppt\/media\/).*\.png$/.test(n)));return sha(bytes);}
for(const lang of ['ko','en'])for(const kind of ['canvas-null','canvas-typeerror','sdk-blank','sdk-picture','sdk-export'])test(lang+' '+kind+' is localized, produces no partial download and retries',async()=>{
 await open(lang);let injection,restore;const format=kind.startsWith('sdk')?'HWPX':'PPTX';
 try{if(kind.startsWith('canvas')){
 await page.evaluate(kind=>{const original=HTMLCanvasElement.prototype.getContext;window.__faultHits=0;window.__restoreCanvas=()=>HTMLCanvasElement.prototype.getContext=original;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='2d'&&this.width===160&&this.height===80){window.__faultHits++;if(kind==='canvas-typeerror')throw new TypeError('SDK_PRIVATE_SENTINEL createImageData');return null;}return original.call(this,type,...args);};},kind);restore=()=>page.evaluate(()=>window.__restoreCanvas());
 }else{
 const needles={'sdk-blank':/createBlankDocument\(\)\{/,'sdk-picture':/insertPicture\([^)]*\)\{/,'sdk-export':/exportHwpx\(\)\{/};
 const payloads={'sdk-blank':'return JSON.stringify({sectionCount:0,private:"SDK_PRIVATE_SENTINEL"});','sdk-picture':'return JSON.stringify({ok:false,private:"SDK_PRIVATE_SENTINEL"});','sdk-export':'throw new TypeError("SDK_PRIVATE_SENTINEL");'};
 const handler=async route=>{const response=await route.fetch(),source=await response.text();const re=needles[kind];const matches=[...source.matchAll(new RegExp(re.source,'g'))];assert.equal(matches.length,1,'target SDK method must occur once');const changed=source.replace(re,m=>m+payloads[kind]);injection={method:re.source,matches:matches.length,original:sha(source),injected:sha(changed)};await route.fulfill({response,body:changed,headers:{...response.headers(),'content-type':'text/javascript'}});};
 await context.route('**/pdfOffice.worker-*.js',handler);restore=()=>context.unroute('**/pdfOffice.worker-*.js',handler);
 }
 const row=await reject(lang,kind,format);if(kind.startsWith('canvas')){row.hits=await page.evaluate(()=>window.__faultHits);assert.ok(row.hits>0);}else{assert.ok(injection);row.injection=injection;}
 await restore();restore=null;row.retryOutputSha256=await retry(lang,format);records.push(row);
 }finally{await restore?.();await context.close();}
});
