import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {chromium} from 'playwright';
import {PDFDocument} from 'pdf-lib';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5480';
const out=process.env.U5_SEND_OUTPUT||'/tmp/sol-u5send/browser';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=','base64');
const doc=await PDFDocument.create();doc.addPage([64,64]);doc.addPage([64,64]);const pdf=Buffer.from(await doc.save());
async function setup(lang='en',width=1280){
 const context=await browser.newContext({viewport:{width,height:940},serviceWorkers:'block',reducedMotion:'reduce'});
 await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
 await context.addInitScript(()=>{window.__docProbe=crypto.randomUUID();window.__tokens=[];for(const method of ['pushState','replaceState']){const original=history[method].bind(history);history[method]=(state,...args)=>{if(state?.usr?.wlHandoff)window.__tokens.push({token:state.usr.wlHandoff,key:state.key});return original(state,...args);};}});
 const page=await context.newPage(),errors=[];page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 return {context,page,errors,lang};
}
async function clickSend(page,selector){await page.locator(selector).click();const leave=page.getByTestId('unsaved-leave');try{await leave.waitFor({state:'visible',timeout:1000});await leave.click();}catch{/* no work guard was needed */}}
async function editor(page,lang){await page.goto(`${base}/${lang}/tools/image-studio/`,{waitUntil:'networkidle'});await page.locator('[data-image-owner="editor"] input[type="file"]').setInputFiles({name:'synthetic-image.png',mimeType:'image/png',buffer:png});await page.waitForFunction(()=>!document.querySelector('[data-testid="image-send-to-privacy"]')?.disabled);}
async function organize(page,lang){await page.goto(`${base}/${lang}/tools/pdf-editor/`,{waitUntil:'networkidle'});await page.locator('.pdf-tool-page input[type="file"]').first().setInputFiles({name:'synthetic-source.pdf',mimeType:'application/pdf',buffer:pdf});await page.waitForFunction(()=>document.querySelectorAll('.pdf-page-card').length===2);await page.locator('.pdf-output-action-zone [data-ui-component="primary-button"]').click();await page.getByTestId('pdf-download').waitFor({timeout:90000});}
async function consumed(page,receiver,pathName){
 try { await page.waitForFunction(async({receiver,pathName})=>{const h=await import('/src/app/memoryHandoff.ts');const latest=window.__tokens.at(-1);return !!latest&&h.wasHandoffConsumed(latest.token,receiver,pathName,latest.key,location.pathname+location.search);},{receiver,pathName},{timeout:5000}); }
 catch(error){const details=await page.evaluate(async()=>{const h=await import('/src/app/memoryHandoff.ts');const latest=window.__tokens.at(-1),record=latest&&h.getDelivery(latest.token.id);return {latest,key:history.state?.key,path:location.pathname+location.search,record:record&&{receiver:record.entry.receiverId,entryPath:record.entry.entryPath,path:record.path,key:record.locationKey,status:record.result?.status,files:record.files.length}};});throw new Error(`Consumed identity mismatch: ${JSON.stringify(details)}`,{cause:error});}
 assert.ok(!page.url().includes('synthetic'));
}

try{
 for(const lang of ['ko','en']){
  await test(`${lang} image editor -> privacy -> editor; generated results and WebP gate`,async()=>{
   const {context,page,errors}=await setup(lang);try{
    await editor(page,lang);await page.getByRole('button',{name:'WebP',exact:true}).click();assert.equal(await page.getByTestId('image-send-to-pdf').isDisabled(),true);assert.ok((await page.locator('#image-send-webp-reason').innerText()).length>10);await page.getByRole('button',{name:'PNG',exact:true}).click();
    await page.getByTestId('image-editor-send-actions').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`${lang}-image-send.png`)});
    await clickSend(page,'[data-testid="image-send-to-privacy"]');await page.waitForURL('**/tools/image-privacy');await page.locator('[data-tool-page="image-privacy"] input[type="file"]').waitFor();assert.equal(await page.locator('[data-ui-component="file-drop-zone"] strong').innerText().then(v=>/1/.test(v)),true);await consumed(page,'image-privacy','/tools/image-privacy');
    await page.locator('[data-ui-component="primary-button"]').click();await page.getByTestId('privacy-send-to-image').waitFor();await page.getByTestId('privacy-send-to-image').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`${lang}-privacy-send.png`)});
    await clickSend(page,'[data-testid="privacy-send-to-image"]');await page.waitForURL('**/tools/image-studio');await page.waitForFunction(()=>/1/.test(document.querySelector('[data-image-owner="editor"] [data-ui-component="file-drop-zone"] strong')?.textContent||''));await consumed(page,'image-edit','/tools/image-studio');assert.deepEqual(errors,[]);
   }finally{await context.close();}
  });
  await test(`${lang} image editor -> image-to-pdf; actual inspection, no automatic PDF creation`,async()=>{
   const {context,page,errors}=await setup(lang);try{await editor(page,lang);await clickSend(page,'[data-testid="image-send-to-pdf"]');await page.waitForURL('**/pdf-converter/image-to-pdf');await page.locator('[data-image-status="ready"]').waitFor();await consumed(page,'image-to-pdf','/tools/pdf-converter/image-to-pdf');assert.equal(await page.getByTestId('pdf-download').count(),0);assert.equal(await page.locator('[data-image-id]').count(),1);await page.locator('[data-image-id]').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`${lang}-image-pdf-received.png`)});assert.deepEqual(errors,[]);}finally{await context.close();}
  });
  for(const target of ['document','images'])await test(`${lang} organize result -> PDF ${target} receiver`,async()=>{
   const {context,page,errors}=await setup(lang);try{await organize(page,lang);await page.getByTestId('pdf-organize-send-actions').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`${lang}-pdf-send.png`)});await clickSend(page,`[data-testid="pdf-send-to-${target}"]`);const id=target==='document'?'pdf-to-document':'pdf-to-image';await page.waitForURL(`**/pdf-converter/${id}`);await page.locator(`[data-tool-page="pdf-converter"] [data-pdf-mode="${id}"]`).waitFor();await page.waitForFunction(()=>document.querySelectorAll('.pdf-page-card').length===2);await consumed(page,id,`/tools/pdf-converter/${id}`);assert.equal(await page.locator('[data-tool-page="pdf-converter"] [data-testid="pdf-download"]').count(),0,JSON.stringify(await page.getByTestId('pdf-download').evaluateAll(items=>items.map(item=>({download:item.getAttribute('download'),tool:item.closest('[data-tool-page]')?.getAttribute('data-tool-page')})))));assert.deepEqual(errors,[]);}finally{await context.close();}
  });
  for (const count of [1,2]) await test(`${lang} selected PDF page images -> ${count===1?'editor':'batch'} without ZIP`,async()=>{
   const {context,page,errors}=await setup(lang);try{
    await page.goto(`${base}/${lang}/tools/pdf-converter/pdf-to-image/`,{waitUntil:'networkidle'});await page.locator('.pdf-tool-page input[type="file"]').setInputFiles({name:'synthetic-pages.pdf',mimeType:'application/pdf',buffer:pdf});await page.waitForFunction(()=>document.querySelectorAll('.pdf-page-card').length===2);await page.getByTestId('pdf-output-card').locator('[data-ui-component="primary-button"]').click();const grid=page.getByTestId('pdf-image-result-grid');await grid.waitFor({timeout:90000});assert.equal(await grid.locator('input').count(),2);
    if(count===1)await grid.locator('input').nth(1).uncheck();await grid.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`${lang}-pdf-image-selection-${count}.png`)});
    await clickSend(page,'[data-testid="pdf-images-send-to-studio"]');await page.waitForURL('**/tools/image-studio');await consumed(page,count===1?'image-edit':'image-batch','/tools/image-studio');
    if(count===2){await page.locator('[data-testid="image-batch-list"][data-count="2"]').waitFor();assert.ok(!(await page.getByTestId('image-batch-list').innerText()).includes('.zip'));}else {await page.waitForFunction(()=>/1/.test(document.querySelector('[data-image-owner="editor"] [data-ui-component="file-drop-zone"] strong')?.textContent||''));assert.equal(await page.locator('[data-image-owner="editor"] [data-ui-component="file-drop-zone"] strong').innerText().then(value=>/1/.test(value)),true);}assert.deepEqual(errors,[]);
   }finally{await context.close();}
  });
 }
 await test('PDF image chooser enforces 0/50/51 before any handoff',async()=>{
  const {context,page}=await setup();try{const large=await PDFDocument.create();for(let i=0;i<51;i++)large.addPage([16,16]);await page.goto(`${base}/en/tools/pdf-converter/pdf-to-image/`,{waitUntil:'networkidle'});await page.locator('input[type="file"]').setInputFiles({name:'boundary.pdf',mimeType:'application/pdf',buffer:Buffer.from(await large.save())});await page.waitForFunction(()=>document.querySelectorAll('.pdf-page-card').length===51);await page.getByTestId('pdf-output-card').locator('[data-ui-component="primary-button"]').click();const grid=page.getByTestId('pdf-image-result-grid');await grid.waitFor({timeout:90000});assert.equal(await grid.locator('input:checked').count(),50);const send=page.getByTestId('pdf-images-send-to-studio');assert.equal(await send.isDisabled(),false);await grid.locator('input').nth(50).check();assert.equal(await send.isDisabled(),true);await grid.locator('input').evaluateAll(items=>items.forEach(item=>{if(item.checked)item.click();}));await page.waitForFunction(()=>document.querySelectorAll('[data-testid="pdf-image-result-grid"] input:checked').length===0);assert.equal(await send.isDisabled(),true);}finally{await context.close();}
 });
 for(const lang of ['ko','en'])await test(`${lang} mobile result actions remain visible and wrap`,async()=>{
  const {context,page}=await setup(lang,390);try{
   await editor(page,lang);const actions=page.getByTestId('image-editor-send-actions');await actions.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`${lang}-mobile-image-send.png`)});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.goto(`${base}/${lang}/tools/pdf-editor/`,{waitUntil:'networkidle'});await page.locator('.pdf-tool-page input[type="file"]').first().setInputFiles({name:'mobile.pdf',mimeType:'application/pdf',buffer:pdf});await page.waitForFunction(()=>document.querySelectorAll('.pdf-page-card').length===2);await page.locator('.pdf-mobile-create').click();await page.locator('.pdf-mobile-download').waitFor();await page.locator('.pdf-mobile-output-summary').click();const pdfActions=page.getByTestId('pdf-organize-send-actions');await pdfActions.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`${lang}-mobile-pdf-send.png`)});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await page.getByTestId('pdf-send-to-document').isVisible());
  }finally{await context.close();}
 });
}catch(error){throw error;}finally{await browser.close();}
