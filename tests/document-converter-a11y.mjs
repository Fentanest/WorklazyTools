import assert from 'node:assert/strict';
import {test,before,after} from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4197';
const out=await fs.mkdtemp('/tmp/worklazy-converter-a11y-');let browser;
const rows=[];
before(async()=>{browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});});
after(async()=>{await browser?.close();await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(rows,null,2));console.log('Evidence:',out);});
for(const lang of ['ko','en'])for(const route of ['pdf-converter/image-to-pdf','pdf-converter/document-to-pdf','pdf-converter/pdf-to-document','document-markdown','vendor'])test(lang+' '+route+' accessible names and measured contrast',async()=>{
 const context=await browser.newContext({reducedMotion:"reduce",viewport:route==='vendor'?{width:1280,height:800}:{width:390,height:844}});
 try{await context.addInitScript(()=>localStorage.setItem('worklazy_privacy_consent_v2','denied'));await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());
 const page=await context.newPage();await page.goto(base+(route==='vendor'?'/vendor/rhwp-studio/0.8.7/index.html?embed=1&lang='+lang:'/'+lang+'/tools/'+route+'/'));
 if(route==='vendor')await page.locator('#sb-message').filter({hasText:lang==='ko'?'페이지':'Page'}).waitFor({timeout:90000});else await page.locator('[data-tool-page]').waitFor();
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
 await page.evaluate(await fs.readFile(path.join(import.meta.dirname,'../node_modules/axe-core/axe.min.js'),'utf8'));
 const result=await page.evaluate(vendor=>axe.run(vendor?document:document.querySelector('[data-tool-page]')),route==='vendor');
 await fs.writeFile(path.join(out,lang+'-'+route.replaceAll('/','-')+'.json'),JSON.stringify(result,null,2));
 const row={lang,route,violations:result.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})),incomplete:result.incomplete.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))};rows.push(row);
 await page.screenshot({path:path.join(out,lang+'-'+route.replaceAll('/','-')+'.png'),fullPage:false});
 assert.deepEqual(result.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);
 }finally{await context.close();}
});
for(const lang of ['ko','en'])for(const route of ['pdf-converter/pdf-to-document','pdf-converter/document-to-pdf','document-markdown'])test(lang+' '+route+' loaded and result/dialog accessibility',async()=>{
 const context=await browser.newContext({reducedMotion:'reduce',viewport:{width:1280,height:900}});
 try{await context.addInitScript(()=>localStorage.setItem('worklazy_privacy_consent_v2','denied'));await context.route('**/*',r=>{const u=new URL(r.request().url());return u.origin===new URL(base).origin||['blob:','data:'].includes(u.protocol)?r.continue():r.abort();});
 const page=await context.newPage();page.setDefaultTimeout(120000);await page.goto(base+'/'+lang+'/tools/'+route+'/');
 const hwp=route.endsWith('document-to-pdf'),md=route==='document-markdown';
 await page.locator('input[type=file]').setInputFiles(path.join(import.meta.dirname,'fixtures/document-converters',hwp?'sample.hwpx':md?'sample.docx':'rich.pdf'));
 const button=page.getByRole('button',{name:hwp?(lang==='ko'?'인쇄 창에서 PDF 저장':'Save PDF using print'):md?(lang==='ko'?'Markdown 만들기':'Create Markdown'):(lang==='ko'?'DOCX로 변환':'Convert to DOCX'),exact:true});
 await page.waitForFunction(()=>[...document.querySelectorAll('[data-ui-component=primary-button]')].some(b=>!b.disabled));
 await page.evaluate(await fs.readFile(path.join(import.meta.dirname,'../node_modules/axe-core/axe.min.js'),'utf8'));
 async function check(target,phase,selector){await target.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});const result=await target.evaluate(selector=>axe.run(document.querySelector(selector)),selector);const name=lang+'-'+route.replaceAll('/','-')+'-'+phase;await fs.writeFile(path.join(out,name+'.json'),JSON.stringify(result,null,2));rows.push({lang,route,phase,violations:result.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})),incomplete:result.incomplete.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});assert.deepEqual(result.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),[]);}
 await check(page,'loaded','[data-tool-page]');await button.click();
 if(hwp){const frame=page.frames().find(f=>f.url().includes('/vendor/rhwp-studio/'));await frame.getByTestId('pdf-print-dialog').waitFor();await frame.evaluate(await fs.readFile(path.join(import.meta.dirname,'../node_modules/axe-core/axe.min.js'),'utf8'));await check(frame,'print-dialog','[role=dialog]');await frame.getByRole('button',{name:lang==='ko'?'취소':'Cancel',exact:true}).click();assert.equal(await page.getByTestId('document-pdf-download').count(),0);}
 else{await page.getByTestId(md?'markdown-download':'pdf-download').waitFor();await check(page,'result','[data-tool-page]');}
 await page.screenshot({path:path.join(out,lang+'-'+route.replaceAll('/','-')+'-state.png')});
 }finally{await context.close();}
});
