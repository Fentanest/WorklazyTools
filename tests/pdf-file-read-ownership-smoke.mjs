import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {PDFDocument} from 'pdf-lib';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5273',doc=await PDFDocument.create();doc.addPage([100,100]);const bytes=Array.from(await doc.save());
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try{
 const context=await browser.newContext({serviceWorkers:'block'});await context.addInitScript(()=>window.__WORKLAZY_MOCK_PROVIDERS__=true);
 await context.route('**/*',route=>{const u=new URL(route.request().url());return ['http:','https:'].includes(u.protocol)&&u.origin!==new URL(base).origin?route.abort():route.continue();});
 const page=await context.newPage();await page.goto(`${base}/en/tools/pdf-compare/`);await page.locator('[data-tool-page="pdf-compare"]').waitFor();
 const rows=await page.evaluate(async bytes=>{
  const {PdfCompareSession}=await import('/src/features/pdf-compare/session.ts'),original=File.prototype.arrayBuffer,rows=[];
  for(const action of ['run','select','suggest']){
   let begin,release,oldBytes;const started=new Promise(r=>begin=r),gate=new Promise(r=>release=r),reads=[],session=new PdfCompareSession();
   File.prototype.arrayBuffer=async function(){reads.push(this.name);if(this.name==='old.pdf'){begin();await gate;return oldBytes=new Uint8Array(bytes).buffer;}return original.call(this);};
   const input={id:'old',before:new File([new Uint8Array(bytes)],'old.pdf'),after:new File([new Uint8Array(bytes)],'old-after.pdf')};
   try{
    const previous=(action==='run'?session.run([input]):action==='select'?session.select(input,{before:0,after:0}):session.suggest(input)).catch(e=>e.name);
    await started;const next=session.run([{id:'new',before:new File([new Uint8Array(bytes)],'new-before.pdf'),after:new File([new Uint8Array(bytes)],'new-after.pdf')}]);
    await new Promise(r=>setTimeout(r,20));const blocked=reads.join(',')==='old.pdf';release();await previous;const result=await next;
    rows.push({action,blocked,detached:oldBytes.byteLength===0,reads,status:result?.pairs[0].status});
   }finally{release();await session.dispose();File.prototype.arrayBuffer=original;}
  }
  return rows;
 },bytes);
 for(const row of rows){assert.equal(row.blocked,true);assert.equal(row.detached,true);assert.equal(row.status,'complete');assert.deepEqual(row.reads,['old.pdf','new-before.pdf','new-after.pdf']);}
 console.log(JSON.stringify({status:'passed',checks:12,rows}));await context.close();
}finally{await browser.close();}
