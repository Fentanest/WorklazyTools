import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {PDFDocument} from 'pdf-lib';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5273';
const doc=await PDFDocument.create();doc.addPage([100,100]).drawText('same',{x:10,y:40,size:12});const bytes=Array.from(await doc.save());
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try{
 const context=await browser.newContext({serviceWorkers:'block'});await context.addInitScript(()=>{window.__WORKLAZY_MOCK_PROVIDERS__=true;});
 await context.route('**/*',route=>{const u=new URL(route.request().url());return ['http:','https:'].includes(u.protocol)&&u.origin!==new URL(base).origin?route.abort():route.continue();});
 const page=await context.newPage();await page.goto(`${base}/en/tools/pdf-compare/`);await page.locator('[data-tool-page="pdf-compare"]').waitFor();
 const findings=await page.evaluate(async bytes=>{
  const {runPixelWorker}=await import('/src/features/pdf-compare/runtime.ts');
  const a=document.createElement('canvas'),b=document.createElement('canvas');a.width=a.height=b.width=b.height=1;
  for(const c of [a,b]){const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,1,1);}
  const Native=Worker,observations=[];
  try{
   for(const mode of ['messageerror','malformed','post','abort-late','valid']){
    let terminations=0;const control=new AbortController();
    window.Worker=class{postMessage(){const handler=this.onmessage;if(mode==='post')throw Error('clone');if(mode==='abort-late')control.abort();queueMicrotask(()=>{if(mode==='messageerror')this.onmessageerror?.({});else handler?.({data:mode==='malformed'?null:{count:0,ratio:0,segments:[]}});});}terminate(){terminations++;}};
    let status='resolved';try{await runPixelWorker(a,b,16,control.signal);}catch(error){status=error.name;}
    observations.push({mode,status,terminations});
   }
  }finally{window.Worker=Native;a.width=a.height=b.width=b.height=0;}
  const {PdfCompareSession}=await import('/src/features/pdf-compare/session.ts');
  const session=new PdfCompareSession(),original=File.prototype.arrayBuffer,reads=[];let start,release;
  const begun=new Promise(resolve=>{start=resolve;}),gate=new Promise(resolve=>{release=resolve;});
  File.prototype.arrayBuffer=async function(){reads.push(this.name);if(this.name==='old.pdf'){start();await gate;}return original.call(this);};
  try{
   const old=new File([new Uint8Array(bytes)],'old.pdf',{type:'application/pdf'});
   const previous=session.suggest({id:'old',before:old,after:old}).then(()=>null,error=>error.name);
   await begun;
   const next=session.run([{id:'new',before:new File([new Uint8Array(bytes)],'new-before.pdf'),after:new File([new Uint8Array(bytes)],'new-after.pdf')}]);
   await new Promise(resolve=>setTimeout(resolve,30));const beforeRelease=reads.slice();release();const canceled=await previous;const result=await next;
   return {observations,beforeRelease,canceled,status:result?.pairs[0].status,finalReads:reads.slice()};
  }finally{release?.();File.prototype.arrayBuffer=original;await session.dispose();}
 },bytes);
 for(const row of findings.observations){assert.equal(row.terminations,1);assert.equal(row.status,row.mode==='valid'?'resolved':row.mode==='abort-late'?'AbortError':row.mode==='post'?'Error':'PdfCompareError');}
 assert.deepEqual(findings.beforeRelease,['old.pdf']);assert.equal(findings.canceled,'AbortError');assert.equal(findings.status,'complete');assert.deepEqual(findings.finalReads,['old.pdf','new-before.pdf','new-after.pdf']);
 console.log(JSON.stringify({status:'passed',checks:14,findings}));await context.close();
}finally{await browser.close();}
