import assert from 'node:assert/strict';
import {test,before,after} from 'node:test';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4198',out=process.env.HWP_OUTPUT||'/tmp/sol-hwp';
let browser,context,hwp,hwpx;
const external=[],errors=[];
before(async()=>{
 await fs.mkdir(out,{recursive:true});
 [hwp,hwpx]=await Promise.all(['hwp','hwpx'].map(ext=>fs.readFile(`tests/fixtures/document-converters/sample.${ext}`)));
 browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
 context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
 await context.addInitScript(()=>{
  window.__WORKLAZY_MOCK_PROVIDERS__=true;
  if(window!==window.top)return;
  let release;const barrier=new Promise(resolve=>release=resolve);window.__releaseHwpRead=release;
  const read=Blob.prototype.arrayBuffer;
  Blob.prototype.arrayBuffer=async function(){if(this instanceof File&&this.name.startsWith('LATE_'))await barrier;return read.call(this);};
  // Observe the real SDK boundary without substituting any parse/load result.
  const post=MessagePort.prototype.postMessage;
  window.__hwpRequests=[];
  MessagePort.prototype.postMessage=function(message,...rest){
   if(message?.type==='rhwp-request')window.__hwpRequests.push({method:message.method,name:message.params?.fileName});
   return post.call(this,message,...rest);
  };
 });
 await context.route('**/*',route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin===base||['blob:','data:'].includes(url.protocol))return route.continue();
  external.push({url:url.href,body:request.postData()||''});
  return route.abort();
 });
});
after(async()=>{await fs.writeFile(out+'/network.json',JSON.stringify({external,errors},null,2));await browser?.close();});
async function page(){const p=await context.newPage();p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());return p;}
async function drop(p,files,lang='en'){
 await p.goto(`${base}/${lang}/`);await p.getByTestId('home-dropzone').waitFor();
 const payload=files.map(({name,buffer})=>({name,bytes:[...buffer]}));
 await p.getByTestId('home-dropzone').evaluate((zone,payload)=>{
  const data=new DataTransfer();for(const item of payload)data.items.add(new File([new Uint8Array(item.bytes)],item.name,{type:'application/octet-stream'}));
  zone.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));
 },payload);
 await p.locator('[data-receiver]').first().waitFor();
}
async function open(p,name,buffer,lang='en'){
 await drop(p,[{name,buffer}],lang);
 assert.equal(await p.locator('[data-receiver]').first().getAttribute('data-receiver'),'hwp-editor');
 const label=await p.locator('[data-receiver=hwp-editor]').innerText();assert.doesNotMatch(label,/\$t\(|items\.|home\.dropzone/);
 if(lang==='en')assert.doesNotMatch(label,/[가-힣]/u);
 await p.locator('[data-receiver=hwp-editor]').click();await p.waitForURL(/\/tools\/hwp-editor\/?$/);
}
async function ready(p,name){
 await p.getByTestId('hwp-focus-document').waitFor();assert.ok((await p.getByTestId('hwp-focus-document').innerText()).includes(name));
 assert.equal(await p.locator('[data-handoff-recovery]').count(),0);
 assert.equal(await p.getByTestId('hwp-save').isEnabled(),true);
 assert.equal(await p.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;}),true);
 const requests=await p.evaluate(()=>window.__hwpRequests);assert.equal(requests.filter(row=>row.method==='loadFile').length,1);
 assert.ok(!requests.some(row=>/^export|notifySaved/.test(row.method)),'intake must not export/save');
}
for(const [ext,lang] of [['hwp','ko'],['hwpx','en']])test('home actual drop → primary editor → document opens: '+ext,async()=>{
 const p=await page();try{
  await open(p,'SYNTHETIC_input.'+ext,ext==='hwp'?hwp:hwpx,lang);await ready(p,'SYNTHETIC_input.'+ext);
  await p.screenshot({path:`${out}/opened-${ext}-${lang}.png`});
  const frame=p.frameLocator('[data-testid=hwp-editor-shell] iframe');
  assert.ok((await frame.locator('canvas').count())>0,'real Studio canvas is present');
 }finally{await p.close();}
});
test('handoff waits for delayed Studio readiness before acceptance',async()=>{
 const p=await page();let release;const barrier=new Promise(resolve=>release=resolve);let held=0;
 let started;const gateStarted=new Promise(resolve=>started=resolve);
 const gate=async route=>{held++;started();await barrier;await route.continue().catch(()=>{});};
 try{
  await context.route('**/vendor/rhwp-studio/**',gate);
  await open(p,'SYNTHETIC_wait.hwp',hwp);
  await Promise.race([gateStarted,new Promise((_,reject)=>setTimeout(()=>reject(Error('Studio request did not start')),15000))]);
  await p.waitForTimeout(1000);
  assert.ok(held>0);assert.equal(await p.getByTestId('hwp-focus-document').count(),0);assert.equal(await p.locator('[data-handoff-recovery]').count(),0);
  release();await ready(p,'SYNTHETIC_wait.hwp');
 }finally{release();await context.unroute('**/vendor/rhwp-studio/**',gate);await p.close();}
});
test('damaged HWP keeps exact recovery download and dismisses',async()=>{
 const p=await page();try{
  const bytes=Buffer.from('SYNTHETIC BROKEN HWP');await open(p,'broken.hwp',bytes,'ko');
  const chip=p.locator('[data-handoff-recovery]');await chip.waitFor();assert.ok((await chip.innerText()).includes('broken.hwp'));
  assert.equal(await p.getByTestId('hwp-focus-document').count(),0);
  await p.screenshot({path:out+'/rejected-hwp-ko.png',fullPage:true});
  const download=p.waitForEvent('download');await chip.getByRole('button',{name:'받은 파일 다운로드',exact:true}).click();
  assert.deepEqual(await fs.readFile(await(await download).path()),bytes);await chip.waitFor({state:'detached'});
  await p.locator('input[type=file]').first().setInputFiles({name:'manual.hwpx',buffer:hwpx,mimeType:'application/octet-stream'});
  await p.getByTestId('hwp-focus-document').waitFor();assert.match(await p.getByTestId('hwp-focus-document').innerText(),/manual.hwpx/);
 }finally{await p.close();}
});
for(const ext of ['hwp','hwpx'])test('same-format pair recommends document comparison: '+ext,async()=>{
 const p=await page();try{
  await drop(p,[{name:'before.'+ext,buffer:hwp},{name:'after.'+ext,buffer:hwp}]);
  assert.equal(await p.locator('[data-receiver=hwp-editor]').count(),0);
  assert.equal(await p.locator('[data-receiver=document-compare]').count(),1);
  assert.equal(await p.locator('[data-receiver=document-to-pdf]').count(),1);
 }finally{await p.close();}
});
test('real 30-second timeout rejects original; late read cannot replace newer manual document',async()=>{
 const p=await page();try{
  await open(p,'LATE_input.hwp',hwp);await p.locator('[data-handoff-recovery]').waitFor({timeout:40000});
  assert.equal(await p.getByTestId('hwp-focus-document').count(),0);
  await p.locator('input[type=file]').first().setInputFiles({name:'newer.hwpx',buffer:hwpx,mimeType:'application/octet-stream'});
  await p.getByTestId('hwp-focus-document').waitFor();assert.match(await p.getByTestId('hwp-focus-document').innerText(),/newer.hwpx/);
  await p.evaluate(()=>window.__releaseHwpRead());await p.waitForTimeout(1000);
  assert.match(await p.getByTestId('hwp-focus-document').innerText(),/newer.hwpx/);
  const requests=await p.evaluate(()=>window.__hwpRequests);assert.equal(requests.filter(row=>row.method==='loadFile').length,1,'timed-out bytes never enter the newer editor');
  await p.locator('[data-handoff-recovery]').getByRole('button',{name:'Close',exact:true}).click();
  assert.equal(await p.locator('[data-handoff-recovery]').count(),0);
 }finally{await p.close();}
});
test('file data never enters outbound requests and no page errors',()=>{
 for(const row of external)assert.doesNotMatch(row.url+row.body,/SYNTHETIC|LATE_input|broken\.hwp|newer\.hwpx/);
 assert.deepEqual(errors,[]);
});
