import assert from 'node:assert/strict';
import {test,before,after} from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {PDFDocument} from 'pdf-lib';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4193',out=process.env.H2_OUTPUT||'/tmp/sol-h2';
let browser,context,pdf,two,doc,xls;
const external=[],errors=[];
const ids=['document-redactor','document-to-pdf','xls-preserve'];
const names={'document-redactor':'input.pdf','document-to-pdf':'input.docx','xls-preserve':'input.xls'};
const fixtures=()=>({'document-redactor':pdf,'document-to-pdf':doc,'xls-preserve':xls});
before(async()=>{
 await fs.mkdir(out,{recursive:true});
 const makePdf=async count=>{const p=await PDFDocument.create();for(let i=0;i<count;i++)p.addPage([200,200]).drawText('SYNTHETIC PRIVATE H2 '+i);return Buffer.from(await p.save());};pdf=await makePdf(1);two=await makePdf(2);
 doc=await fs.readFile('tests/fixtures/document-converters/sample.docx');xls=await fs.readFile('tests/fixtures/document-converters/sample.xls');
 browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
 context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
 await context.addInitScript(({siteOrigin})=>{
  if(location.origin!==siteOrigin)return;
  window.__WORKLAZY_MOCK_PROVIDERS__=true;
  const read=Blob.prototype.arrayBuffer,slice=Blob.prototype.slice;
  let release;const barrier=new Promise(resolve=>release=resolve);window.__h2ReleaseReads=release;
  Blob.prototype.slice=function(...args){const next=slice.apply(this,args);if(this.__h2Late||(this instanceof File&&this.name.startsWith('LATE_')))next.__h2Late=true;return next;};
  Blob.prototype.arrayBuffer=async function(){if(this.__h2Late||(this instanceof File&&this.name.startsWith('LATE_')))await barrier;return read.call(this);};
  if(sessionStorage.getItem('__h2Expire')){sessionStorage.removeItem('__h2Expire');const now=Date.now;Date.now=()=>now()+900001;setTimeout(()=>Date.now=now,1500);}
 },{siteOrigin:base});
 await context.route('**/*',route=>{
  const request=route.request(),url=new URL(request.url());if(url.origin===base||['blob:','data:'].includes(url.protocol))return route.continue();
  external.push({url:url.href,body:request.postData()||''});
  const headers={'access-control-allow-origin':'*','cross-origin-resource-policy':'cross-origin'};
  let body='';if(url.hostname==='wcs.pstatic.net')body='window.wcs={event(){}};window.wcs_do=function(){}';if(url.hostname==='ads-partners.coupang.com')body='window.PartnersCoupang={G:function(){}}';
  if(/googletagmanager|pstatic|googlesyndication|coupang/.test(url.hostname))return route.fulfill({status:200,contentType:'text/javascript',headers,body});
  return route.abort();
 });
});
after(async()=>{await fs.writeFile(out+'/network.json',JSON.stringify({external,errors},null,2));await browser?.close();});
async function page(target=context){const p=await target.newPage();p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());return p;}
async function home(p,files,id,lang='en',expire=false){
 await p.goto(`${base}/${lang}/`);await p.getByTestId('home-dropzone').waitFor();
 await p.getByTestId('home-dropzone').locator('input[type=file]').setInputFiles(files.map(({name,buffer})=>({name,buffer,mimeType:'application/octet-stream'})));
 const button=p.locator(`[data-receiver="${id}"]`);await button.waitFor();
 if(expire)await p.evaluate(()=>sessionStorage.setItem('__h2Expire','1'));
 await button.click();await p.waitForURL(url=>url.pathname.includes(id==='xls-preserve'?'xls-preserve':id==='document-to-pdf'?'document-to-pdf':'document-redactor'));
}
async function ready(p,id,name,pages=1){
 if(id==='document-redactor'){await p.locator('.redactor-document-list li').first().waitFor();await p.waitForFunction(n=>document.querySelector('[data-testid=redactor-page-counter]')?.textContent===`1 / ${n}`,pages);}
 else if(id==='document-to-pdf')await p.getByText(name,{exact:true}).first().waitFor();
 else await p.locator('[data-testid=excel-file-status][data-state=ready], [data-testid=excel-file-status][data-state=degradedLegacy]').first().waitFor();
 assert.equal(await p.locator('[data-handoff-recovery]').count(),0);
 assert.equal(await p.locator('[data-testid=document-pdf-download], .redactor-results, [data-testid=excel-result]').count(),0,'intake must not run the main job');
 const protectedInput=await p.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;});assert.equal(protectedInput,true,'input protection must be installed');
}
async function records(p){return p.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('worklazy-office-handoff');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result;if(!db.objectStoreNames.contains('records')){db.close();resolve([]);return;}const tx=db.transaction('records'),q=tx.objectStore('records').getAll();tx.oncomplete=()=>{db.close();resolve(q.result.map(x=>({receiverId:x.receiverId,id:x.id})));};};}));}
test('warm actual XLS preservation input without merging',async()=>{const p=await page();try{await p.goto(base+'/en/tools/excel-merger/xls-preserve/');await p.waitForFunction(()=>crossOriginIsolated);await p.locator('input[type=file]').first().setInputFiles({name:'warm.xls',buffer:xls,mimeType:'application/vnd.ms-excel'});await p.locator('[data-testid=excel-file-status][data-state=ready]').waitFor({timeout:240000});}finally{await p.close();}});
test('manual XLS preparation cancel keeps the existing error/reset behavior',async()=>{
 const p=await page(),held=[];
 await p.goto(base+'/en/');await p.evaluate(async()=>{for(const key of await caches.keys())await caches.delete(key);});
 const gate=route=>held.push(route);await context.route('**/vendor/zetaoffice/**/soffice.wasm',gate);
 try{
  await home(p,[{name:'cancel.xls',buffer:xls}],'xls-preserve');
  await p.getByRole('button',{name:'Cancel XLS preparation',exact:true}).click();
  await p.locator('[data-handoff-recovery]').waitFor();
  assert.equal(await p.locator('[data-testid=excel-file-status][data-state=checking]').count(),0);
  assert.ok(await p.locator('[data-testid=excel-file-status][data-state=error]').count()>0);
 }finally{await context.unroute('**/vendor/zetaoffice/**/soffice.wasm',gate);for(const route of held)await route.abort().catch(()=>{});await p.close();}
});
for(const id of ids)test('home whole-document handoff succeeds: '+id,async()=>{const p=await page();try{
 await home(p,[{name:names[id],buffer:fixtures()[id]}],id);await ready(p,id,names[id]);assert.equal((await records(p)).length,0);
 const boundary=await p.evaluate(()=>({isolated:crossOriginIsolated,redactor:!!document.querySelector('meta[name=worklazy-redactor-isolation]'),office:!!document.querySelector('meta[name=worklazy-office-isolation]'),excel:!!document.querySelector('meta[name=worklazy-excel-preserve-isolation]'),tokens:Object.keys(sessionStorage).filter(x=>x.startsWith('worklazy-handoff-token:'))}));
 // Redactor isolates with its dedicated CSP; Office/XLS additionally require COEP.
 if(id!=='document-redactor')assert.equal(boundary.isolated,true);assert.equal(boundary.tokens.length,0);assert.equal(boundary[id==='document-redactor'?'redactor':id==='document-to-pdf'?'office':'excel'],true);if(id==='document-redactor'){
  const policy=await p.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  for(const part of ["object-src 'none'","form-action 'none'","base-uri 'self'","worker-src 'self' blob:"])assert.ok(policy.includes(part));
 }
 await p.screenshot({path:out+'/'+id+'-en.png',fullPage:true});
 }finally{await p.close();}});
for(const id of ids)test('home rejected input keeps exact download and dismisses: '+id,async()=>{const p=await page();try{
 const buffer=id==='xls-preserve'?Buffer.from([80,75,3,4,0,0,0,0,0,0,0,0]):Buffer.from('SYNTHETIC BROKEN H2 '+id);await home(p,[{name:'broken.'+(id==='document-redactor'?'pdf':id==='document-to-pdf'?'docx':'xls'),buffer}],id,'ko');
 const chip=p.locator('[data-handoff-recovery]');await chip.waitFor();assert.equal((await records(p)).length,0);
 await p.screenshot({path:out+'/'+id+'-ko-failed.png',fullPage:true});
 const download=p.waitForEvent('download');await chip.getByRole('button',{name:'받은 파일 다운로드',exact:true}).click();const value=await download;const file=await value.path();assert.deepEqual(await fs.readFile(file),buffer);await chip.waitFor({state:'detached'});
 }finally{await p.close();}});
for(const id of ids)test('partial intake retains only rejected original: '+id,async()=>{const p=await page();try{
 const suffix=id==='document-redactor'?'pdf':id==='document-to-pdf'?'docx':'xls';
 await home(p,[{name:'good.'+suffix,buffer:fixtures()[id]},{name:'bad.'+suffix,buffer:id==='xls-preserve'?Buffer.from([80,75,3,4,0,0,0,0,0,0,0,0]):Buffer.from('SYNTHETIC INVALID')}],id);
 const chip=p.locator('[data-handoff-recovery]');await chip.waitFor();assert.ok((await chip.innerText()).includes('bad.'+suffix));assert.ok(!(await chip.innerText()).includes('good.'+suffix));assert.equal((await records(p)).length,0);
 await chip.getByRole('button',{name:'Close',exact:true}).click();await chip.waitFor({state:'detached'});
 }finally{await p.close();}});
for(const id of ids)test('expired home handoff is deleted and asks for reselect: '+id,async()=>{const p=await page();try{await home(p,[{name:names[id],buffer:fixtures()[id]}],id,'en',true);await p.locator('[data-handoff-recovery]').waitFor();assert.match(await p.locator('[data-handoff-recovery]').innerText(),/select your files again/);assert.equal((await records(p)).length,0);}finally{await p.close();}});
for(const id of ids)test('two home tabs receive separate inputs: '+id,async()=>{const pages=await Promise.all([page(),page()]);try{
 const bytes=id==='xls-preserve'?await fs.readFile('tests/fixtures/document-converters/sample.xlsx'):fixtures()[id];
 await Promise.all(pages.map((p,i)=>home(p,[{name:`tab-${i}.`+(id==='document-redactor'?'pdf':id==='document-to-pdf'?'docx':'xls'),buffer:id==='document-redactor'&&i?two:bytes}],id)));
 await Promise.all(pages.map((p,i)=>ready(p,id,`tab-${i}.`+(id==='document-redactor'?'pdf':id==='document-to-pdf'?'docx':'xls'),id==='document-redactor'&&i?2:1)));
 if(id!=='document-redactor')for(let i=0;i<2;i++){assert.ok((await pages[i].locator('body').innerText()).includes('tab-'+i));assert.ok(!(await pages[i].locator('body').innerText()).includes('tab-'+(1-i)));}
 assert.equal((await records(pages[0])).length,0);
 }finally{await Promise.all(pages.map(p=>p.close()));}});
for(const id of ids)test('30-second timeout blocks late intake writes: '+id,async()=>{const p=await page();try{
 const suffix=id==='document-redactor'?'pdf':id==='document-to-pdf'?'doc':'xls';const bytes=id==='document-to-pdf'?await fs.readFile('tests/fixtures/document-converters/sample.doc'):fixtures()[id];
 await home(p,[{name:'LATE_input.'+suffix,buffer:bytes}],id);
 await p.locator('[data-handoff-recovery]').waitFor({timeout:40000});assert.equal((await records(p)).length,0);
 const newer=id==='document-redactor'?two:id==='document-to-pdf'?doc:await fs.readFile('tests/fixtures/document-converters/sample.xlsx');const name='newer.'+(id==='document-redactor'?'pdf':id==='document-to-pdf'?'docx':'xlsx');
 await p.locator('input[type=file]').first().setInputFiles({name,buffer:newer,mimeType:'application/octet-stream'});
 if(id==='document-redactor'){await p.evaluate(()=>window.__h2ReleaseReads());await p.waitForFunction(()=>document.querySelector('[data-testid=redactor-page-counter]')?.textContent==='1 / 2');}
 else await p.getByText(name,{exact:true}).first().waitFor();
 await p.evaluate(()=>window.__h2ReleaseReads());await p.waitForTimeout(500);
 if(id==='document-redactor')assert.equal(await p.getByTestId('redactor-page-counter').innerText(),'1 / 2');else assert.ok((await p.locator('body').innerText()).includes(name));
 await p.locator('[data-handoff-recovery]').getByRole('button',{name:'Close',exact:true}).click();assert.equal(await p.locator('[data-handoff-recovery]').count(),0);
 }finally{await p.close();}});
test('file data never enters outbound provider URL/body',()=>{for(const row of external)assert.doesNotMatch(row.url+row.body,/SYNTHETIC|LATE_input|broken\.|tab-0|tab-1|newer\./);assert.deepEqual(errors,[]);});


for (const fault of ['add', 'token', 'commit', 'none']) test(`P3E pending replacement at capacity: ${fault}`, async () => {
 const p = await page();
 try {
  await p.goto(base+'/en/');
  await p.getByTestId('home-dropzone').locator('input[type=file]').setInputFiles({name:'replacement.docx', buffer:doc, mimeType:'application/octet-stream'});
  await p.locator('[data-receiver="document-to-pdf"]').waitFor();
  await p.evaluate(async ({bytes, fault}) => {
   const key='worklazy-handoff-token:document-to-pdf', token={id:'owned',nonce:'owned-nonce'};
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('worklazy-office-handoff',3);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('records'))r.result.createObjectStore('records',{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   await new Promise((resolve,reject)=>{const tx=db.transaction('records','readwrite'),store=tx.objectStore('records');store.clear();
    for(let i=0;i<20;i++){const now=Date.now();store.add({id:i?'unrelated-'+i:token.id,nonce:i?'other-'+i:token.nonce,receiverId:'document-to-pdf',entryPath:'/tools/pdf-converter/document-to-pdf',schema:1,files:[new File([new Uint8Array(bytes)],i?'unrelated.docx':'old.docx')],createdAt:now,expiresAt:now+900000});}
    tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
   });db.close();sessionStorage.setItem(key,JSON.stringify(token));
   window.__p3eFault=fault;
   const add=IDBObjectStore.prototype.add, set=Storage.prototype.setItem;
   let active;
   IDBObjectStore.prototype.add=function(...args){
    if(this.name==='records'&&window.__p3eFault==='add')throw new DOMException('Synthetic quota','QuotaExceededError');
    active=this.transaction;return add.apply(this,args);
   };
   Storage.prototype.setItem=function(k,v){
    if(k===key&&window.__p3eFault==='token')throw new DOMException('Synthetic storage denial','QuotaExceededError');
    const result=set.call(this,k,v);
    if(k===key&&window.__p3eFault==='commit'){window.__p3eFault='';active.abort();}
    return result;
   };
  },{bytes:[...doc],fault});
  await p.locator('[data-receiver="document-to-pdf"]').click();
  if(fault!=='none'){
   await p.getByTestId('home-dropzone').getByRole('alert').waitFor();
   assert.equal(new URL(p.url()).pathname,'/en/');
   assert.deepEqual(await p.evaluate(()=>JSON.parse(sessionStorage.getItem('worklazy-handoff-token:document-to-pdf'))),{id:'owned',nonce:'owned-nonce'});
   const old=await p.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('worklazy-office-handoff');r.onsuccess=()=>{const db=r.result,tx=db.transaction('records'),q=tx.objectStore('records').get('owned');tx.oncomplete=async()=>{const record=q.result;db.close();resolve(record?{name:record.files[0].name,bytes:[...new Uint8Array(await record.files[0].arrayBuffer())]}:null);};};r.onerror=()=>reject(r.error);}));
   assert.equal(old.name,'old.docx');assert.deepEqual(old.bytes,[...doc]);assert.equal((await records(p)).length,20);
   await p.evaluate(()=>{window.__p3eFault='';});
   await p.locator('[data-receiver="document-to-pdf"]').click();
  }
  await p.waitForURL(url=>url.pathname.includes('document-to-pdf'));
  await ready(p,'document-to-pdf','replacement.docx');
  const remaining=await records(p);assert.equal(remaining.length,19);assert.ok(remaining.every(row=>row.id.startsWith('unrelated-')));
  assert.deepEqual(errors,[]);
 } finally {await p.close();}
});

// P3E review follow-up: two tabs replace their own pending case concurrently.
test('P3F two tabs replace the same receiver at capacity without stealing files or quota', async () => {
 // Navigation interception is part of this IDB-only fixture. A controlling
 // production service worker can handle the request before page.route sees it.
 const isolated=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
 await isolated.addInitScript(()=>{window.__WORKLAZY_MOCK_PROVIDERS__=true;});
 await isolated.route('**/*',route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin===base||['blob:','data:'].includes(url.protocol))return route.continue();
  external.push({url:url.href,body:request.postData()||''});
  const headers={'access-control-allow-origin':'*','cross-origin-resource-policy':'cross-origin'};
  let body='';if(url.hostname==='wcs.pstatic.net')body='window.wcs={event(){}};window.wcs_do=function(){}';if(url.hostname==='ads-partners.coupang.com')body='window.PartnersCoupang={G:function(){}}';
  if(/googletagmanager|pstatic|googlesyndication|coupang/.test(url.hostname))return route.fulfill({status:200,contentType:'text/javascript',headers,body});
  return route.abort();
 });
 const tabs = [await page(isolated), await page(isolated)];
 const observer = await page(isolated);
 const held = []; let bothStaged; const staged = new Promise(resolve=>{bothStaged=resolve;});
 const payloads = [doc, await fs.readFile('tests/fixtures/document-converters/rich.docx')];
 try {
  await observer.goto(base+'/en/');
  for (const [i,p] of tabs.entries()) {
   await p.goto(base+'/en/');
   await p.getByTestId('home-dropzone').locator('input[type=file]').setInputFiles({name:`concurrent-${i}.docx`,buffer:payloads[i],mimeType:'application/octet-stream'});
   await p.locator('[data-receiver="document-to-pdf"]').waitFor();
  }
  await tabs[0].evaluate(async bytes=>{
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('worklazy-office-handoff',3);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('records'))r.result.createObjectStore('records',{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   await new Promise((resolve,reject)=>{const tx=db.transaction('records','readwrite'),store=tx.objectStore('records');store.clear();
    for(let i=0;i<20;i++){const now=Date.now();store.add({id:i<2?'owned-'+i:'unrelated-'+i,nonce:i<2?'nonce-'+i:'other-'+i,receiverId:'document-to-pdf',entryPath:'/tools/pdf-converter/document-to-pdf',schema:1,files:[new File([new Uint8Array(bytes)],'old.docx')],createdAt:now,expiresAt:now+900000});}
    tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
   });db.close();
  },[...doc]);
  for (const [i,p] of tabs.entries()) await p.evaluate(i=>sessionStorage.setItem('worklazy-handoff-token:document-to-pdf',JSON.stringify({id:'owned-'+i,nonce:'nonce-'+i})),i);
  // Hold both receiving navigations so neither new record can be consumed
  // before both replacement transactions have committed at the 20-record cap.
  for (const p of tabs) {
   let heldFirst=false;
   await p.route('**/en/tools/pdf-converter/document-to-pdf*',route=>{
    if(heldFirst||!route.request().isNavigationRequest())return route.continue();
    heldFirst=true;held.push(route);if(held.length===2)bothStaged();
   });
  }
  const sending=Promise.all(tabs.map(p=>p.locator('[data-receiver="document-to-pdf"]').click()));
  void sending.catch(()=>{});
  let timer;
  try {await Promise.race([staged,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Both tabs must stage before receiving')),60000);})]);}
  finally {clearTimeout(timer);}
  const stagedRecords=await records(observer);
  assert.equal(stagedRecords.length,20);
  assert.equal(stagedRecords.filter(row=>row.id.startsWith('unrelated-')).length,18);
  assert.ok(stagedRecords.every(row=>!row.id.startsWith('owned-')));
  await Promise.all(held.map(route=>route.continue()));
  await sending;
  await Promise.all(tabs.map(async(p,i)=>{
   await p.waitForURL(url=>url.pathname.includes('document-to-pdf'));
   await ready(p,'document-to-pdf',`concurrent-${i}.docx`);
   assert.equal(await p.getByText(`concurrent-${1-i}.docx`,{exact:true}).count(),0);
   assert.equal(await p.evaluate(()=>sessionStorage.getItem('worklazy-handoff-token:document-to-pdf')),null);
  }));
  const remaining=await records(observer);
  assert.equal(remaining.length,18);
  assert.ok(remaining.every(row=>row.id.startsWith('unrelated-')),'both owned cases are consumed and unrelated quota is preserved');
  assert.deepEqual(errors,[]);
 } finally {await Promise.all(held.map(route=>route.abort().catch(()=>{})));await Promise.all([...tabs,observer].map(p=>p.close()));await isolated.close();}
});
