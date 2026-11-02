import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import {chromium} from 'playwright';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4199',out=process.env.DIRECT_ENTRY_OUTPUT||'/tmp/worklazy-u9-core/feature-final';const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const c=await b.newContext();await c.addInitScript(()=>{localStorage.setItem('worklazy_privacy_consent_v2','denied');const d=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');window.__holdRestore=false;window.__heldRestore=0;Object.defineProperty(HTMLImageElement.prototype,'src',{...d,set(value){if(window.__holdRestore&&String(value).startsWith('blob:')){window.__holdRestore=false;window.__heldRestore++;return;}d.set.call(this,value);}});});await c.route('**/*',route=>{const url=route.request().url();return url.startsWith(base)||url.startsWith('blob:')||url.startsWith('data:')?route.continue():route.abort();});const p=await c.newPage();p.setDefaultTimeout(30000);const acceptNativeDialog=dialog=>dialog.accept();p.on('dialog',acceptNativeDialog);const errors=[];p.on('pageerror',e=>errors.push(e.message));
// Synthetic popstate also reaches AppShell's Back sentinel. Close its stay
// dialog after testing the direct-entry decision; real link navigation has no popstate.
const settleSyntheticBack = async () => {
 const stay=p.locator('[data-testid=unsaved-stay]');
 if(await p.locator('[data-testid=unsaved-work-dialog][open]').count()) await stay.click();
};
try{
 if(process.env.TEST_W2 === "1") { await testW2(p); assert.deepEqual(errors,[]); } else {
 await fs.mkdir(out,{recursive:true});const {PNG}=await import('pngjs');const fixture=new PNG({width:320,height:200});fixture.data.fill(255);await fs.writeFile(path.join(out,'input.png'),PNG.sync.write(fixture));
 await p.goto(`${base}/en/tools/image-studio/resize/`);await p.locator('[data-testid=image-editor-panel-text]').click();await p.locator('[data-testid=image-editor-text-input]').fill('Options only');await p.evaluate(()=>{history.pushState({},'','/en/tools/image-studio/mosaic/');dispatchEvent(new PopStateEvent('popstate'));});await p.locator('[data-testid=image-editor-options-panel][data-panel=effect]').waitFor();assert.equal(await p.locator('[data-testid=direct-entry-confirm][open]').count(),0);
 await p.locator('[data-testid=image-editor-panel-text]').click();await p.locator('[data-testid=image-editor-text-input]').fill('HistoryOnly');await p.locator('[data-testid=image-editor-add-text]').click();await p.waitForFunction(()=>!document.querySelector('[data-testid=image-editor-undo]').disabled);await p.locator('[data-testid=image-editor-undo]').click();await p.waitForFunction(()=>!document.querySelector('[data-testid=image-editor-redo]').disabled&&document.querySelector('[data-testid=image-editor-undo]').disabled);assert.equal(await p.locator('input[type=file]').first().evaluate(e=>e.files.length),0);
 const toWatermark=()=>p.evaluate(()=>{history.pushState({},'','/en/tools/image-studio/watermark/');dispatchEvent(new PopStateEvent('popstate'));});await toWatermark();await p.locator('[data-testid=direct-entry-confirm][open]').waitFor();await p.locator('[data-testid=direct-entry-reject]').click();await settleSyntheticBack();await p.waitForFunction(()=>location.pathname.endsWith('/mosaic/'));assert.equal(await p.locator('[data-testid=image-editor-redo]').isEnabled(),true);await toWatermark();await p.locator('[data-testid=direct-entry-confirm][open]').waitFor();await p.locator('[data-testid=direct-entry-accept]').click();await settleSyntheticBack();await p.locator('[data-testid=image-editor-options-panel][data-panel=text]').waitFor();await p.locator('[data-testid=image-editor-panel-layers]').click();assert.equal(await p.locator('[data-layer-id]').count(),0);
 await p.goto(`${base}/en/tools/image-studio/watermark/`);await p.locator('[data-testid=image-editor-text-input]').waitFor();await p.locator('input[type=file]').first().setInputFiles(path.join(out,'input.png'));await p.getByText('1 files selected',{exact:true}).waitFor();await p.locator('[data-testid=image-editor-text-input]').fill('U9 layer');await p.locator('[data-testid=image-editor-add-text]').click();await p.waitForFunction(()=>!document.querySelector('[data-testid=image-editor-undo]').disabled);await p.locator('[data-testid=image-editor-minibar-duplicate]').click();await p.locator('[data-testid=image-editor-panel-layers]').click();await p.waitForFunction(()=>document.querySelectorAll('[data-layer-id]').length===3);
 await p.locator('[data-testid=image-editor-undo]').click();await p.waitForFunction(()=>document.querySelectorAll('[data-layer-id]').length===2);await p.locator('[data-testid=image-editor-redo]').click();await p.waitForFunction(()=>document.querySelectorAll('[data-layer-id]').length===3);
 await p.evaluate(()=>window.__holdRestore=true);await p.locator('[data-testid=image-editor-undo]').click();await p.waitForFunction(()=>window.__heldRestore===1);await p.evaluate(()=>{history.pushState({},'','/en/tools/image-studio/mosaic/');dispatchEvent(new PopStateEvent('popstate'));});await p.locator('[data-testid=direct-entry-confirm][open]').waitFor();await p.locator('[data-testid=direct-entry-accept]').click();await settleSyntheticBack();await p.locator('[data-testid=image-editor-options-panel][data-panel=effect]').waitFor();await p.locator('[data-testid=image-editor-panel-layers]').click();assert.equal(await p.locator('[data-layer-id]').count(),3);assert.deepEqual(errors,[]);
 await fs.writeFile(path.join(out,'image-history.json'),JSON.stringify({optionsOnlyConfirm:0,undoOnlyConfirm:true,undoOnlyRejectPreservedRedo:true,undoOnlyAcceptLayers:0,cloneLayers:3,undoLayers:2,redoLayers:3,cancelledRestoreLayers:3,errors},null,2));console.log('Image clone/undo/redo preserve objects; approved preset aborts held restore without late canvas mutation');
 }
}finally{await b.close();}

async function testW2(page) {
 const { default: test } = await import('node:test');
 const { PNG } = await import('pngjs');
 const { default: JSZip } = await import('jszip');
 const png = new PNG({width: 32, height: 24}); png.data.fill(255);
 const buffer = PNG.sync.write(png);
 const input = {name:'w2-input.png',mimeType:'image/png',buffer};
 const editor = page.locator('[data-image-owner=editor]');
 const batch = page.locator('[data-image-owner=batch]');
 const add = page.locator('[data-testid=image-editor-add-to-batch]');
 const list = page.locator('[data-testid=image-batch-list]');
 const tab = async name => page.locator('[data-testid=image-studio-tabs] button').nth(name === 'batch' ? 1 : 0).click();
 const count = async n => assert.equal(await list.getAttribute('data-count'),String(n));
 const fresh = async () => { await page.goto(`${base}/en/tools/image-studio/`); await page.locator('.upper-canvas').waitFor(); };
 const put = async n => { await tab('batch'); await batch.locator('input[type=file]').first().setInputFiles(Array.from({length:n},(_,i)=>({...input,name:`input-${i}.png`}))); };
 const addOne = async () => { await tab('editor'); await add.click(); await page.waitForFunction(()=>document.querySelector('[data-testid=image-editor-add-to-batch]').getAttribute('aria-disabled')!=='true'); };
 await fs.mkdir(out,{recursive:true});
 await test('W2 browser regression',async t=>{
  const scenario=(name,fn)=>t.test(name,{skip:process.env.TEST_W2_NEGATIVE==='1'&&!name.startsWith('10 rapid trusted mouse clicks 100ms')},fn);
  await scenario('direct resize/mosaic/watermark panels remain available',async()=>{
   for(const [route,panel] of [['resize','size'],['mosaic','effect'],['watermark','text']]) {
    await page.goto(`${base}/en/tools/image-studio/${route}/`);
    await page.locator(`[data-testid=image-editor-options-panel][data-panel=${panel}]`).waitFor();
   }
  });
  await scenario('one export File, source badge, preserved editor state and worker output',async()=>{
   await fresh(); await editor.locator('input[type=file]').first().setInputFiles(input);
   await page.getByText('1 files selected',{exact:true}).waitFor();
   await page.locator('[data-testid=image-editor-panel-text]').click();
   await page.locator('[data-testid=image-editor-text-input]').fill('W2 keep editing');
   await page.locator('[data-testid=image-editor-add-text]').click();
   await page.waitForFunction(()=>!document.querySelector('[data-testid=image-editor-undo]').disabled);
   const before=await page.locator('[data-testid=image-editor-export-result]').textContent();
   await addOne();
   assert.equal(await page.locator('[data-testid=image-editor-text-input]').inputValue(),'W2 keep editing');
   assert.equal(await page.locator('[data-testid=image-editor-export-result]').textContent(),before);
   assert.equal(await page.locator('[data-testid=image-editor-undo]').isEnabled(),true);
   await tab('batch');await count(1);assert.equal(await page.locator('[data-testid=image-batch-source]').textContent(),'Edited result');
   await batch.locator('select').first().selectOption('original');
   const download=page.waitForEvent('download',{timeout:90000}).catch(async error=>{ console.error('W2 worker failure state:',await page.locator('[data-ui-component=OperationProgress]').textContent().catch(()=>''),await page.locator('main').innerText());throw error;});await page.locator('[data-testid=image-batch-action] button').click();
   const saved=await download;const zip=await JSZip.loadAsync(await fs.readFile(await saved.path()));
   const entries=Object.values(zip.files).filter(f=>!f.dir);assert.equal(entries.length,1);
   assert.match(entries[0].name,/w2-input/);
   const data=await entries[0].async('nodebuffer');assert.ok(data.length>100);
   await fs.writeFile(path.join(out,'w2-batch-result.zip'),await fs.readFile(await saved.path()));
   await tab('editor');assert.equal(await page.locator('[data-testid=image-editor-text-input]').inputValue(),'W2 keep editing');
  });
  const cdp = await page.context().newCDPSession(page);
  const trustedResults = [];
  for (const [mode, gap] of [['mouse',100],['mouse',300],['Enter',100],['Space',100]]) {
   await scenario(`10 rapid trusted ${mode === 'mouse' ? 'mouse clicks' : mode + ' activations'} ${gap}ms apart enqueue one image`,async()=>{
    await fresh();await tab('batch');await tab('editor');await add.scrollIntoViewIfNeeded();
    if(process.env.TEST_EXPECT_DEV==='1'){const source=await (await page.request.get(`${base}/src/main.tsx`)).text();assert.match(source,/StrictMode/);assert.ok(await page.locator('script[src*="vite"]').count());}
    await add.evaluate(button=>{
     window.__w2TrustedClicks=[];window.__w2TrustedKeys=[];
     button.addEventListener('click',event=>window.__w2TrustedClicks.push({trusted:event.isTrusted,time:event.timeStamp,detail:event.detail}),{capture:true});
     button.addEventListener('keydown',event=>window.__w2TrustedKeys.push({trusted:event.isTrusted,key:event.key,repeat:event.repeat}),{capture:true});
    });
    const box=await add.boundingBox();assert.ok(box);
    const mouseClick=async()=>{for(const type of ['mousePressed','mouseReleased'])await cdp.send('Input.dispatchMouseEvent',{type,x:box.x+20,y:box.y+20,button:'left',clickCount:1});};
    if(mode!=='mouse')await add.focus();
    for(let i=0;i<10;i++){
     if(mode==='mouse')await mouseClick();
     else if(mode==='Enter')await page.keyboard.down('Enter');
     else await page.keyboard.press('Space');
     if(i<9)await new Promise(resolve=>setTimeout(resolve,gap));
    }
    if(mode==='Enter')await page.keyboard.up('Enter');
    // This assertion is first so the old candidate reports the actual duplicate count.
    await count(1);
    const inputs=await page.evaluate(()=>({clicks:window.__w2TrustedClicks,keys:window.__w2TrustedKeys}));
    assert.equal(inputs.clicks.length,10);assert.ok(inputs.clicks.every(event=>event.trusted));
    if(mode!=='mouse')assert.ok(inputs.keys.every(event=>event.trusted));
    if(mode==='Enter')assert.ok(inputs.keys.some(event=>event.repeat));
    assert.equal(await add.getAttribute('aria-disabled'),'true');
    assert.equal(await add.evaluate(button=>button.disabled),false);
    assert.ok(await add.evaluate(button=>Number(getComputedStyle(button).opacity)<1));
    await new Promise(resolve=>setTimeout(resolve,450));
    assert.equal(await add.getAttribute('aria-disabled'),'true');
    await new Promise(resolve=>setTimeout(resolve,250));
    assert.equal(await add.getAttribute('aria-disabled'),'false');
    await mouseClick();
    await page.waitForFunction(()=>document.querySelector('[data-testid=image-batch-list]').dataset.count==='2');
    await count(2);
    const after=await page.evaluate(()=>window.__w2TrustedClicks);
    const quietGap=after.at(-1).time-after.at(-2).time;
    assert.ok(quietGap>=600,`intentional addition came after ${quietGap}ms`);
    trustedResults.push({mode,gap,burstCount:1,clicks:inputs.clicks,keys:inputs.keys,afterQuietCount:2,quietGap});
    console.log('W2 trusted burst:',JSON.stringify({mode,gap,burstCount:1,trustedClicks:inputs.clicks.length,afterQuietCount:2,quietGap}));
   });
  }
  await cdp.detach();
  await fs.writeFile(path.join(out,'trusted-bursts.json'),JSON.stringify(trustedResults,null,2));
  await scenario('batch item can be removed',async()=>{
   await fresh();await addOne();await tab('batch');
   await page.locator('[data-testid=image-batch-edited-file] button').click();await count(0);
   assert.equal(await page.locator('[data-testid=image-batch-source]').count(),0);
  });
  await scenario('49 inputs plus one edited result succeeds; 51st is rejected with guidance',async()=>{
   await fresh();await put(49);await count(49);await addOne();await tab('batch');await count(50);
   assert.equal(await page.locator('[data-testid=image-batch-source]').count(),1);
   await addOne();assert.match(await page.locator('[data-testid=image-batch-notice]').textContent(),/50/);
   await tab('batch');await count(50);assert.equal(await page.locator('[data-testid=image-batch-source]').count(),1);
  });
  await scenario('file intake and clipboard share the same 50-image cap',async()=>{
   await fresh();await put(51);await count(50);
   assert.match(await batch.textContent(),/Images over the limit were not added/);
   await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=4;
    const blob=await new Promise(resolve=>canvas.toBlob(resolve));const transfer=new DataTransfer();
    transfer.items.add(new File([blob],'paste.png',{type:'image/png'}));
    document.activeElement?.blur();document.dispatchEvent(new ClipboardEvent('paste',{clipboardData:transfer,bubbles:true}));
   });await count(50);
  });
  await scenario('10 separate additions accumulate to ten; normal input can be removed',async()=>{
   await fresh();for(let i=0;i<10;i++)await addOne();await tab('batch');await count(10);
   await batch.locator('input[type=file]').first().setInputFiles(input);await count(11);
   await batch.locator('[data-ui-component=file-list] button').click();await count(10);
  });
  await scenario('handoff-only work guards navigation and direct-entry changes; removal clears guard',async()=>{
   await fresh();await addOne();
   await page.locator('.brand-card').click();await page.locator('[data-testid=unsaved-work-dialog][open]').waitFor();
   await page.locator('[data-testid=unsaved-stay]').click();assert.match(page.url(),/image-studio/);
   await page.evaluate(()=>{history.pushState({},'','/en/tools/image-studio/mosaic/');dispatchEvent(new PopStateEvent('popstate'));});
   await page.locator('[data-testid=direct-entry-confirm][open]').waitFor();await page.locator('[data-testid=direct-entry-reject]').click();if(await page.locator('[data-testid=unsaved-work-dialog][open]').count())await page.locator('[data-testid=unsaved-stay]').click();
   await page.waitForFunction(()=>location.pathname==='/en/tools/image-studio/');
   await tab('batch');await count(1);await page.locator('[data-testid=image-batch-edited-file] button').click();await count(0);
   await page.locator('.brand-card').click();await page.waitForURL(/\/en\/?$/);
   assert.equal(await page.locator('[data-testid=unsaved-work-dialog][open]').count(),0);
  });
  await scenario('native beforeunload cancellation preserves handoff and acceptance leaves',async()=>{
   await fresh();await addOne();await tab('batch');await count(1);
   page.off('dialog',acceptNativeDialog);
   const seen=[];const stay=dialog=>{seen.push(dialog.type());return dialog.dismiss();};
   page.on('dialog',stay);
   try {
    await assert.rejects(page.goto(`${base}/en/`));
    assert.deepEqual(seen,['beforeunload']);assert.match(page.url(),/image-studio/);await count(1);
   } finally {page.off('dialog',stay);page.on('dialog',acceptNativeDialog);}
   await page.goto(`${base}/en/`);await page.waitForURL(/\/en\/$/);
  });
  await scenario('ko/en light/dark desktop/mobile changed surfaces',async()=>{
   for(const language of ['ko','en'])for(const theme of ['light','dark'])for(const width of [1280,390]){
    await page.setViewportSize({width,height:900});
    await page.goto(`${base}/${language}/tools/image-studio/`);await page.locator('.upper-canvas').waitFor();
    await page.evaluate(theme=>{document.documentElement.classList.toggle('dark',theme==='dark');document.documentElement.dataset.theme=`${theme}-coral`;},theme);
    await addOne();
    assert.equal(await page.locator('html').getAttribute('data-theme'),`${theme}-coral`);
    assert.match(await add.textContent(),language==='ko'?/일괄 목록에 넣기 \(1\)/:/Add to batch list \(1\)/);
    await add.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`w2-${language}-${theme}-${width}-editor.png`)});
    await tab('batch');await count(1);
    assert.equal(await page.locator('[data-testid=image-batch-source]').textContent(),language==='ko'?'편집 결과':'Edited result');
    await page.locator('[data-testid=image-batch-source]').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`w2-${language}-${theme}-${width}-batch.png`)});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   }
  });
 });
}
