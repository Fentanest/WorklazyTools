import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {PDFDocument} from 'pdf-lib';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5480';const out='/tmp/sol-u5send/failure';await fs.mkdir(out,{recursive:true});
const doc=await PDFDocument.create();doc.addPage([64,64]);const pdf=Buffer.from(await doc.save());
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
async function setup(){const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:940}});await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());await context.addInitScript(()=>window.__documentMarker=crypto.randomUUID());const page=await context.newPage();page.setDefaultTimeout(45000);page.on('dialog',d=>d.accept());return {context,page};}
async function clickSend(page){await page.getByTestId('pdf-send-to-images').click();try{await page.getByTestId('unsaved-leave').waitFor({state:'visible',timeout:1000});await page.getByTestId('unsaved-leave').click();}catch{}}
async function source(page){await page.goto(`${base}/en/tools/pdf-editor/`,{waitUntil:'networkidle'});await page.locator('.pdf-tool-page input[type="file"]').first().setInputFiles({name:'synthetic.pdf',mimeType:'application/pdf',buffer:pdf});await page.locator('.pdf-page-card').waitFor();await page.locator('.pdf-output-action-zone [data-ui-component="primary-button"]').click();await page.getByTestId('pdf-download').waitFor({timeout:90000});}
try{
 await test('preload network failure keeps the source result downloadable and retries after restore',async()=>{
  const {context,page}=await setup();try{
   await source(page);const marker=await page.evaluate(()=>window.__documentMarker);let blocked=0;
   await page.route('**/src/features/pdf-converter/PdfConverterPage.tsx*',r=>{blocked++;return r.abort();});
   await clickSend(page);await page.getByRole('alert').filter({hasText:'Could not transfer the result'}).waitFor();assert.ok(blocked>0);assert.ok(new URL(page.url()).pathname.endsWith('/pdf-editor/'));assert.equal(await page.evaluate(()=>window.__documentMarker),marker);
   const download=page.waitForEvent('download');await page.getByTestId('pdf-download').click();assert.equal((await PDFDocument.load(await fs.readFile(await(await download).path()))).getPageCount(),1);
   await page.unroute('**/src/features/pdf-converter/PdfConverterPage.tsx*');await clickSend(page);await page.waitForURL('**/pdf-converter/pdf-to-image',{timeout:15000});await page.locator('[data-tool-page="pdf-converter"]').waitFor();assert.equal(await page.evaluate(()=>window.__documentMarker),marker);
  }finally{await context.close();}
 });
 for(const sourceKind of ['image','pdf'])await test(`${sourceKind} preflight CSS failure retains download and retries`,async()=>{
  const {context,page}=await setup();try{
   await page.route('**/src/app/routePreload.ts*',async route=>{const response=await route.fetch(),body=await response.text();assert.ok(body.includes('switch (receiverId) {'));await route.fulfill({response,body:body.replace('switch (receiverId) {','if (window.__failCSS) { window.__failCSS=false; throw new Error("Unable to preload CSS: synthetic"); } switch (receiverId) {')});});
   if(sourceKind==='pdf')await source(page);else{await page.goto(`${base}/en/tools/image-studio/`,{waitUntil:'networkidle'});await page.getByTestId('image-send-to-pdf').waitFor();}
   const marker=await page.evaluate(()=>window.__documentMarker);await page.evaluate(()=>window.__failCSS=true);
   if(sourceKind==='pdf')await clickSend(page);else{await page.getByTestId('image-send-to-pdf').click();await page.getByTestId('unsaved-leave').click();}
   await page.getByRole('alert').filter({hasText:'Could not transfer the result'}).waitFor();assert.equal(await page.evaluate(()=>window.__documentMarker),marker);assert.ok(!new URL(page.url()).pathname.includes('/pdf-converter/'));
   const event=page.waitForEvent('download');if(sourceKind==='pdf')await page.getByTestId('pdf-download').click();else await page.getByRole('button',{name:'Download the result being transferred',exact:true}).click();const bytes=await fs.readFile(await(await event).path());assert.ok(bytes.length>0);
   if(sourceKind==='pdf')await clickSend(page);else{await page.getByRole('button',{name:'Try sending again',exact:true}).click();try{await page.getByTestId('unsaved-leave').waitFor({state:'visible',timeout:1000});await page.getByTestId('unsaved-leave').click();}catch{}}
   await page.waitForURL(`**/pdf-converter/${sourceKind==='pdf'?'pdf-to-image':'image-to-pdf'}`);assert.equal(await page.evaluate(()=>window.__documentMarker),marker);
  }finally{await context.close();}
 });
 for(const sourceKind of ['image','pdf'])for(const phase of ['before','after'])for(const kind of ['JS','CSS'])await test(`${sourceKind} ${kind} failure ${phase} claim transfers generated bytes to recovery`,async()=>{
  const {context,page}=await setup();try{
   const message=kind==='CSS'?'Unable to preload CSS: synthetic-u5':'synthetic-u5-JS';
   await context.addInitScript(({phase,message})=>{
    window.__u5Fail=phase==='before';window.__u5Error=message;
    const Original=window.File;
    window.File=new Proxy(Original,{construct(target,args){const file=Reflect.construct(target,args);if(window.__delayGenerated){const read=file.arrayBuffer.bind(file);file.arrayBuffer=()=>new Promise(resolve=>{window.__parserWaiting=true;window.__releaseParser=()=>resolve(read());});}return file;}});
   },{phase,message});
   const fn=sourceKind==='image'?'ImagesToPdf':'PdfToImages';
   await page.route('**/src/features/pdf-editor/PdfImagePanel.tsx*',async route=>{
    const response=await route.fetch(),text=await response.text();const signature=`function ${fn}() {`;assert.ok(text.includes(signature),'fixture matches real receiver module');
    await route.fulfill({response,body:text.replace(signature,`${signature} if (window.__u5Fail) throw new Error(window.__u5Error);`)});
   });
   if(sourceKind==='pdf')await source(page);else{
    await page.goto(`${base}/en/tools/image-studio/`,{waitUntil:'networkidle'});const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=','base64');await page.locator('[data-image-owner="editor"] input[type="file"]').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:png});await page.waitForFunction(()=>!document.querySelector('[data-testid="image-send-to-pdf"]')?.disabled);
   }
   const marker=await page.evaluate(()=>window.__documentMarker);if(phase==='after')await page.evaluate(()=>window.__delayGenerated=true);
   if(sourceKind==='pdf')await clickSend(page);else{await page.getByTestId('image-send-to-pdf').click();await page.getByTestId('unsaved-leave').click();}
   if(phase==='after'){
    await page.waitForFunction(()=>window.__parserWaiting);await page.evaluate(async()=>{window.__u5Fail=true;(await import('/src/app/memoryHandoff.ts')).purgeExpiredHandoffs();});
   }
   const recovery=page.locator('[data-handoff-recovery]');await recovery.waitFor();assert.equal(await page.evaluate(()=>window.__documentMarker),marker);assert.equal(await page.evaluate(async()=> (await import('/src/app/chunkRecovery.ts')).isAutoReloadHeld()),true);assert.equal(await page.evaluate(async()=> (await import('/src/app/memoryHandoff.ts')).getRecovery()?.files.length),1);
   if(phase==='after'){await page.evaluate(()=>window.__releaseParser());await page.waitForTimeout(300);assert.ok(await recovery.isVisible());}
   if(sourceKind==='image'&&phase==='after'&&kind==='JS'){await page.locator('.sidebar a[href="/en/"]').first().click();await page.getByTestId('unsaved-stay').click();assert.ok(await recovery.isVisible());}
   if(sourceKind==='image'&&kind==='CSS'&&phase==='after')await recovery.getByRole('button',{name:'Discard',exact:true}).click();else{
    const event=page.waitForEvent('download');await recovery.getByRole('button',{name:'Download the result being transferred',exact:true}).click();const bytes=await fs.readFile(await(await event).path());if(sourceKind==='pdf')assert.equal((await PDFDocument.load(bytes)).getPageCount(),1);else assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
   }
   try { await page.waitForURL('**/en/error/'); } catch (error) { if (!String(error).includes('ERR_ABORTED')) throw error; await page.waitForURL('**/en/error/',{waitUntil:'domcontentloaded'}); } assert.equal(await page.evaluate(async()=> (await import('/src/app/chunkRecovery.ts')).isAutoReloadHeld()),false);
  }finally{await context.close();}
 });
}finally{await browser.close();}
