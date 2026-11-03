import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4196',out=process.env.IE1_SEND_OUTPUT||'/tmp/sol-ie1/integration';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
async function fixture(){
 const context=await browser.newContext({serviceWorkers:'block'});await context.route('**/*',r=>r.request().url().startsWith(base+'/')||/^(blob:|data:)/.test(r.request().url())?r.continue():r.abort());
 await context.route('**/src/components/AppShell.tsx*',async route=>{
  const response=await route.fetch();let code=await response.text();const preload='await preloadReceiver(input.receiverId);';assert.ok(code.includes(preload));
  code=code.replace(preload,"{ if(window.__ie1FailSend) throw new Error('synthetic preload failure'); if(window.__ie1HoldSend) await new Promise(resolve=>window.__ie1ReleaseSend=resolve); await preloadReceiver(input.receiverId); }");
  const nav='navigate(to, { state: { wlHandoff: token } });';assert.ok(code.includes(nav));
  code=code.replace(nav,"if(window.__ie1KeepSource){window.__ie1Dispatched=(window.__ie1Dispatched||0)+1;queueMicrotask(()=>cancelStagedHandoff(token));}else "+nav);
  await route.fulfill({response,body:code});
 });
 const page=await context.newPage();page.setDefaultTimeout(45000);page.on('dialog',d=>d.accept());const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/en/tools/image-studio/');await page.waitForFunction(()=>{const button=document.querySelector('[data-testid=image-send-to-privacy]');return button&&!button.disabled},{},{timeout:15000}).catch(async error=>{await fs.writeFile(out+'/fixture-ready-debug.json',JSON.stringify({errors,body:await page.locator('body').innerText()},null,2));throw error});
 return{context,page,errors};
}
async function dispatch(page){await page.getByTestId('image-send-to-privacy').click();await page.getByTestId('unsaved-leave').waitFor();await page.getByTestId('unsaved-leave').click();}
async function edit(page){
 if(await page.locator('[data-testid=library-image-editor]').count()) {await page.locator('.asp-rail__slot > button').filter({hasText:/^Text$/}).first().click();await page.locator('#asp-text-input').fill('New scene');await page.locator('.asp-text-add .asp-btn-accent').click();}
 else {await page.getByTestId('image-editor-panel-text').click();await page.getByTestId('image-editor-text-input').fill('New scene');await page.getByTestId('image-editor-add-text').click();}
}
try{
 await test('prepared result clears after successful dispatch without clearing unrelated work',async()=>{
  for(const withInput of [false,true]) {
   const{context,page,errors}=await fixture();try{
    if(withInput){await page.locator('[data-image-owner=editor] input[type=file]').first().setInputFiles('tests/fixtures/redaction-export/photo.png');await page.getByText('1 files selected',{exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('[data-testid=image-send-to-privacy]').disabled);}
    await page.evaluate(()=>window.__ie1KeepSource=true);await dispatch(page);await page.waitForFunction(()=>window.__ie1Dispatched===1);await page.waitForFunction(()=>document.querySelector('[data-testid=image-editor-send-actions]').dataset.preparedSend==='false');
    await page.waitForFunction(async expected=>(await import('/src/app/toolState.ts')).hasUnsavedWork()===expected,withInput);assert.deepEqual(errors,[]);
   }finally{await context.close()}
  }
 });
 await test('failed prepared result cannot be retried or downloaded after an edit',async()=>{
  const{context,page,errors}=await fixture();try{await page.evaluate(()=>window.__ie1FailSend=true);await dispatch(page);await page.getByRole('button',{name:'Try sending again',exact:true}).waitFor();await edit(page);await page.waitForFunction(()=>document.querySelector('[data-testid=image-editor-send-actions]').dataset.preparedSend==='false');assert.equal(await page.getByRole('button',{name:'Try sending again',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Download the created result',exact:true}).count(),0);assert.deepEqual(errors,[]);}finally{await context.close()}
 });
 await test('late preload of A never dispatches or clears the newer prepared result B',async()=>{
  const{context,page,errors}=await fixture();try{
   await page.evaluate(()=>{window.__ie1KeepSource=true;window.__ie1HoldSend=true});await dispatch(page);await page.waitForFunction(()=>typeof window.__ie1ReleaseSend==='function');
   // Changing format invalidates A. A second explicit request prepares B while
   // A is held; busy is recoverable and must not erase B.
   await page.getByRole('button',{name:'JPG',exact:true}).click();await page.getByTestId('image-send-to-privacy').click();await page.getByRole('button',{name:'Try sending again',exact:true}).waitFor();
   await page.evaluate(()=>{window.__ie1HoldSend=false;window.__ie1ReleaseSend()});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.__ie1Dispatched||0),0);assert.equal(await page.getByTestId('image-editor-send-actions').getAttribute('data-prepared-send'),'true');
   await page.getByRole('button',{name:'Try sending again',exact:true}).click();await page.getByTestId('unsaved-leave').click();await page.waitForFunction(()=>window.__ie1Dispatched===1);await page.waitForFunction(()=>document.querySelector('[data-testid=image-editor-send-actions]').dataset.preparedSend==='false');assert.deepEqual(errors,[]);
  }finally{await context.close()}
 });
}finally{await browser.close()}
