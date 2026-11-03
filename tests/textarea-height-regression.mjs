import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {PDFDocument} from 'pdf-lib';
import {PNG} from 'pngjs';
import {tools} from '../src/app/toolRegistry.ts';
import {seoByPath} from '../src/app/seo.ts';
import {isVideoUnavailablePath} from '../src/app/publicService.ts';
import {isComparisonPathPublished} from '../src/app/publicServiceConfig.mjs';
import {startRecoveryServer} from './recovery-server.mjs';
import {stateWith} from './fixtures/product-banner/state.ts';
import {saveProjectJson} from '../src/features/product-banner/projectJson.ts';
import {createDefaultSettings} from '../src/features/product-banner/settings.ts';

const output=path.resolve(process.env.TEXTAREA_OUTPUT||'scratch/focus-partial/audit/heights');
const baseline=process.env.TEXTAREA_BASELINE_DIST;
if(!baseline)throw Error('TEXTAREA_BASELINE_DIST must identify the build before the focus changes');
const source=await fs.readFile('src/app/App.tsx','utf8');
const candidates=[...new Set([...tools.map(t=>t.path),...Object.keys(seoByPath),...[...source.matchAll(/<Route\s+path="(tools\/[^"]+)"/g)].map(m=>'/'+m[1])])];
let routes=candidates.filter(p=>p.startsWith('/tools/')&&!/[*:]/.test(p)&&!isVideoUnavailablePath(p)&&isComparisonPathPublished(p)).map(p=>p.replace(/\/$/,''));
routes=[...new Set(routes)].sort();
if(process.env.TEXTAREA_ROUTES){const selected=new Set(process.env.TEXTAREA_ROUTES.split(','));routes=routes.filter(p=>selected.has(p.split('/').at(-1)));}
assert.ok(routes.length>0);
const views=[{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844}];
let browser,servers,contexts,pdf;const records=[];
async function save(){await fs.writeFile(path.join(output,'results.json'),JSON.stringify({routes,views,baseline,after:process.env.TEXTAREA_DIST||'dist',records},null,2));}
before(async()=>{
 await fs.mkdir(output,{recursive:true});
 servers=[await startRecoveryServer({root:baseline,port:0}),await startRecoveryServer({root:process.env.TEXTAREA_DIST||'dist',port:0})];
 browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 contexts=new Map();const png=new PNG({width:24,height:24});png.data.fill(200);const image=PNG.sync.write(png);
 for(const view of views)for(let phase=0;phase<2;phase++){
  const context=await browser.newContext({viewport:{width:view.width,height:view.height},deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addInitScript(()=>localStorage.setItem('worklazy-theme','light-coral'));
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(!/^https?:$/.test(u.protocol))return route.continue();
   if(u.origin!==servers[phase].url)return route.request().resourceType()==='image'?route.fulfill({contentType:'image/png',body:image}):route.abort();
   if(route.request().resourceType()==='document'&&/\/(office-editor\/app|excel-merger\/xls-preserve)\/?$/.test(u.pathname)){
    const response=await route.fetch();return route.fulfill({response,headers:{...response.headers(),'cross-origin-opener-policy':'same-origin','cross-origin-embedder-policy':'require-corp'}});
   }
   return route.continue();
  });contexts.set(`${view.name}-${phase}`,context);
 }
 const doc=await PDFDocument.create();doc.addPage([300,400]);pdf=Buffer.from(await doc.save());
});
after(async()=>{await browser?.close();for(const s of servers||[])await s.close();await save();});
async function settle(page){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));let old='',stable=0;for(let n=0;n<90;n++){await new Promise(requestAnimationFrame);const next=[...document.querySelectorAll('textarea')].map(e=>`${getComputedStyle(e).minHeight}:${e.offsetHeight}`).join('|');stable=next===old?stable+1:0;old=next;if(stable>=5)return;}throw Error('Textarea layout did not settle');});}
async function measure(page,state){await settle(page);return{state,url:new URL(page.url()).pathname,rows:await page.locator('textarea').evaluateAll(elements=>elements.map((e,index)=>({index,id:e.id,testId:e.getAttribute('data-testid'),label:e.getAttribute('aria-label'),rows:e.rows,slot:e.getAttribute('data-slot'),className:e.className,minHeight:getComputedStyle(e).minHeight,offsetHeight:e.offsetHeight,visible:e.getClientRects().length>0}))) };}
async function capture(context,server,lang,route){
 const page=await context.newPage();page.setDefaultTimeout(45000);page.on('dialog',d=>d.accept());
 try{
  await page.goto(`${server.url}/${lang}${route}/`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!document.querySelector('[data-route-error]')&&!!document.querySelector('[data-tool-page],main .tool-page')&&!document.querySelector('.tool-route-loading'));
  assert.equal(await page.locator('[data-route-error]').count(),0);
  assert.equal(await page.evaluate(()=>devicePixelRatio),1,'normal 100% layout');
  const scenes=[await measure(page,'initial')];
  if(route==='/tools/document-markdown'){
   await page.locator('input[type=file]').setInputFiles('tests/fixtures/document-converters/sample.docx');
   await page.getByRole('button',{name:lang==='ko'?'Markdown 만들기':'Create Markdown',exact:true}).click();
   await page.locator('textarea[rows="14"]').waitFor({timeout:120000});scenes.push(await measure(page,'docx-result'));
  }
  if(route==='/tools/product-banner'){
   const project=stateWith(3).project;const defaults=createDefaultSettings(lang,project.settings.design);project.settings={...project.settings,language:lang,affiliateNotice:defaults.affiliateNotice};
   await page.locator('input[accept=".json"]').setInputFiles({name:'height-synthetic.json',mimeType:'application/json',buffer:Buffer.from(saveProjectJson(project))});
   await page.getByTestId('banner-product').first().waitFor();
  }
  if(/^\/tools\/pdf-editor\/(finish|page-numbers|header-footer|watermark|stamp)$/.test(route)){
   await page.locator('[data-testid=pdf-finish-ready] input[accept*="application/pdf"]').setInputFiles({name:'height-synthetic.pdf',mimeType:'application/pdf',buffer:pdf});
   await page.locator('[data-testid=pdf-finish-canvas-area] canvas').first().waitFor();scenes.push(await measure(page,'pdf-loaded'));
  }
  const opened=await page.evaluate(()=>{let n=0;for(const d of document.querySelectorAll('details'))if(d.querySelector('textarea')&&!d.open){d.open=true;n++;}return n;});
  if(opened||route==='/tools/product-banner')scenes.push(await measure(page,'textarea-details-open'));
  return scenes;
 }finally{await page.close();}
}
for(const lang of ['ko','en'])for(const view of views)for(const route of routes){
 test(`${lang} ${view.name} ${route}: original textarea min-height and offsetHeight`,{timeout:300000},async()=>{
  const record={lang,view:view.name,viewport:{width:view.width,height:view.height},route};
  try{
   record.before=await capture(contexts.get(`${view.name}-0`),servers[0],lang,route);
   record.after=await capture(contexts.get(`${view.name}-1`),servers[1],lang,route);
   assert.equal(record.before.length,record.after.length,'same prepared UI states');
   record.differences=[];
   for(let s=0;s<record.before.length;s++){
    const a=record.before[s],b=record.after[s];assert.equal(a.rows.length,b.rows.length,`${a.state}: same textarea count`);
    for(let i=0;i<a.rows.length;i++){
     const x=a.rows[i],y=b.rows[i];assert.deepEqual([x.id,x.testId,x.label,x.rows,x.slot],[y.id,y.testId,y.label,y.rows,y.slot],'same control identity');
     if(x.minHeight!==y.minHeight||x.offsetHeight!==y.offsetHeight)record.differences.push({state:a.state,index:i,label:x.label,testId:x.testId,before:{minHeight:x.minHeight,offsetHeight:x.offsetHeight},after:{minHeight:y.minHeight,offsetHeight:y.offsetHeight}});
    }
   }
   assert.deepEqual(record.differences,[],'normal viewports must preserve every original textarea height');record.passed=true;
  }catch(error){record.passed=false;record.error=error.message;throw error;}
  finally{records.push(record);await save();}
 });
}
