import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import {chromium} from 'playwright';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4199';const out=process.env.DIRECT_ENTRY_OUTPUT||'/tmp/worklazy-u9-core/browser';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const c=await b.newContext();const p=await c.newPage();p.setDefaultTimeout(30000);const checks=[];const errors=[];p.on('pageerror',e=>errors.push(e.message));
await c.addInitScript(()=>{
 const read=File.prototype.arrayBuffer;const seen=new WeakSet();window.__releaseInputs=[];window.__blockedInputs=0;window.__readAttempts=0;
 File.prototype.arrayBuffer=async function(){if(this.name.startsWith('delayed.')){window.__readAttempts++;if(!seen.has(this)){seen.add(this);window.__blockedInputs++;await new Promise(resolve=>window.__releaseInputs.push(resolve));}}return read.call(this);};
 const descriptor=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');window.__holdImage=false;window.__blockedImages=0;
 Object.defineProperty(HTMLImageElement.prototype,'src',{...descriptor,set(value){if(window.__holdImage&&String(value).startsWith('blob:')){window.__holdImage=false;window.__blockedImages++;return;}return descriptor.set.call(this,value);}});
});
const nav=async route=>p.evaluate(route=>{history.pushState({},'',route);dispatchEvent(new PopStateEvent('popstate'));},route);
const accept=async()=>{await p.locator('[data-testid=direct-entry-confirm][open]').waitFor();await p.locator('[data-testid=direct-entry-accept]').click();};
try{
 for(const [start,target] of [['merge','rotate'],['convert','ocr']]){
  await p.goto(`${base}/en/tools/pdf-editor/${start}/`);await p.locator('[data-direct-purpose]').waitFor();await p.locator('input[type=file]').first().setInputFiles({name:'delayed.pdf',mimeType:'application/pdf',buffer:await fs.readFile(path.join(out,'input.pdf'))});await p.waitForFunction(()=>window.__blockedInputs===1);await nav(`/en/tools/pdf-editor/${target}/`);await accept();await p.evaluate(()=>window.__releaseInputs.splice(0).forEach(resolve=>resolve()));
  await p.locator('.pdf-page-card').nth(2).waitFor();assert.equal(await p.locator('.pdf-page-card').count(),3);assert.ok(await p.evaluate(()=>window.__readAttempts>=2));assert.equal(await p.locator('[data-direct-purpose]').getAttribute('data-direct-purpose'),target);
  if(target==='rotate')assert.equal(await p.locator('.pdf-page-card').first().getAttribute('data-rotation'),'0');
  checks.push(`PDF ${start}->${target}: delayed selected File reacquired with exactly three pages`);
 }
 await p.goto(`${base}/en/tools/audio-studio/`);await p.locator('input[type=file]').first().waitFor();await p.locator('input[type=file]').first().setInputFiles({name:'delayed.wav',mimeType:'audio/wav',buffer:await fs.readFile(path.join(out,'input.wav'))});await p.waitForFunction(()=>window.__blockedInputs===1);await nav('/en/tools/audio-studio/trim/');await accept();await p.evaluate(()=>window.__releaseInputs.splice(0).forEach(resolve=>resolve()));await p.locator('[data-testid=audio-export-actions]').waitFor();assert.equal(await p.getByRole('switch',{name:'Export selection only',exact:true}).getAttribute('aria-checked'),'true');assert.ok(await p.evaluate(()=>window.__readAttempts>=2));checks.push('Audio delayed decode reacquires same selected File and enables trim export after selection commit');
 await p.goto(`${base}/en/tools/image-studio/resize/`);await p.locator('[data-testid=image-editor-options-panel]').waitFor();await p.evaluate(()=>window.__holdImage=true);await p.locator('[data-image-owner=editor] input[type=file]').setInputFiles(path.join(out,'input.png'));await p.waitForFunction(()=>window.__blockedImages===1);await nav('/en/tools/image-studio/mosaic/');await accept();await p.locator('[data-image-owner=editor]').getByText('1 files selected',{exact:true}).waitFor();await p.locator('[data-testid=image-editor-options-panel][data-panel=effect]').waitFor();checks.push('Image delayed load aborts and reacquires same input under approved mosaic purpose');
 assert.deepEqual(errors,[]);
 console.log(checks.join('\n'));
}finally{await fs.writeFile(path.join(out,'pending-report.json'),JSON.stringify({checks,errors},null,2));await b.close();}
