import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
import {PDFDocument} from 'pdf-lib';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5480',output=process.env.U5_RECEIVER_OUTPUT||'/tmp/sol-u5send/receiver';await fs.mkdir(output,{recursive:true});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=','base64');
const pdfDoc=await PDFDocument.create();pdfDoc.addPage([64,64]);const pdf=Buffer.from(await pdfDoc.save());
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
async function fixture(id,files,{delayed=false}={}){
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:940}});await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(base).origin?r.continue():r.abort());const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(45000);await page.goto(`${base}/en/`,{waitUntil:'networkidle'});await page.locator('[data-testid="home-dropzone"]').waitFor();
 const token=await page.evaluate(async({id,files,delayed})=>{
  const {stageHandoff}=await import('/src/app/memoryHandoff.ts');window.__incomingReads=0;window.__workers=0;
  const WorkerClass=window.Worker;window.Worker=new Proxy(WorkerClass,{construct(target,args){window.__workers++;return Reflect.construct(target,args);}});
  const values=files.map(({name,type,bytes},index)=>{const file=new File([new Uint8Array(bytes)],name,{type});const read=file.arrayBuffer.bind(file);file.arrayBuffer=()=>{window.__incomingReads++;return delayed&&index===0?new Promise(resolve=>{window.__releaseInput=()=>resolve(read());}):read();};return file;});
  const path=id==='image-privacy'?'/tools/image-privacy':`/tools/pdf-converter/${id}`;
  const token=stageHandoff({receiverId:id,entryPath:path,files:values,origin:'generated',source:'fixture'});
  history.pushState({usr:{wlHandoff:token},key:crypto.randomUUID(),idx:(history.state?.idx??0)+1},'',`/en${path}`);dispatchEvent(new PopStateEvent('popstate',{state:history.state}));return token;
 },{id,files:files.map(file=>({...file,bytes:[...file.bytes]})),delayed});
 return {context,page,errors,token};
}
const input=id=>id==='image-to-pdf'?{name:'incoming.png',type:'image/png',bytes:png}:{name:'incoming.pdf',type:'application/pdf',bytes:pdf};
try{
 for(const id of ['image-to-pdf','pdf-to-image','pdf-to-document']){
  await test(`${id} StrictMode applies actual parser once and does not run conversion`,async()=>{
   const {context,page,errors,token}=await fixture(id,[input(id)]);try{
    await page.waitForFunction(async token=>{const h=await import('/src/app/memoryHandoff.ts');return !h.getDelivery(token.id)&&!history.state?.usr?.wlHandoff;},token);
    if(id==='image-to-pdf')await page.locator('[data-image-status="ready"]').waitFor();else await page.locator('.pdf-page-card').waitFor();
    assert.equal(await page.evaluate(()=>window.__incomingReads),1);assert.equal(await page.locator('[data-testid="pdf-download"]').count(),0);assert.deepEqual(errors,[]);
   }finally{await context.close();}
  });
  await test(`${id} corrupt input stays downloadable and protected`,async()=>{
   const {context,page,errors}=await fixture(id,[{...input(id),bytes:Buffer.from('synthetic corrupt input')}]);try{
    const recovery=page.locator('[data-pdf-send-recovery]');await recovery.waitFor();assert.ok((await recovery.innerText()).includes(input(id).name));assert.equal(await page.evaluate(async()=> (await import('/src/app/toolState.ts')).hasUnsavedWork()),true);
    const download=page.waitForEvent('download');await recovery.getByRole('button',{name:'Download received files',exact:true}).click();assert.equal((await fs.readFile(await(await download).path())).toString(),'synthetic corrupt input');await recovery.waitFor({state:'detached'});assert.deepEqual(errors,[]);
   }finally{await context.close();}
  });
  await test(`${id} real 30s timeout ignores delayed parser after a newer manual input`,async()=>{
   const {context,page,errors}=await fixture(id,[input(id)],{delayed:true});try{
    await page.waitForFunction(()=>window.__incomingReads===1);await page.locator('[data-pdf-send-recovery]').waitFor({timeout:40000});
    const name=id==='image-to-pdf'?'newer.png':'newer.pdf';await page.locator('input[type="file"]').first().setInputFiles({name,mimeType:input(id).type,buffer:input(id).bytes});
    if(id==='image-to-pdf')await page.locator('[data-image-status="ready"]').waitFor();else await page.locator('.pdf-page-card').waitFor();
    await page.evaluate(()=>window.__releaseInput());await page.waitForTimeout(500);
    const list=page.locator(id==='image-to-pdf'?'.pdf-image-card':'[data-ui-component="file-list"]');assert.ok((await list.innerText()).includes(name));assert.ok(!(await list.innerText()).includes(input(id).name));assert.ok(await page.locator('[data-pdf-send-recovery]').isVisible());assert.deepEqual(errors,[]);
   }finally{await context.close();}
  });
 }
 await test('image privacy partial recovery survives a newer manual selection; no processing on receive',async()=>{
  const {context,page,errors}=await fixture('image-privacy',[{name:'valid.png',type:'image/png',bytes:png},{name:'rejected.txt',type:'text/plain',bytes:Buffer.from('private synthetic')}]);try{
   const recovery=page.locator('[data-handoff-recovery]');await recovery.waitFor();assert.ok((await recovery.innerText()).includes('rejected.txt'));assert.equal(await page.evaluate(()=>window.__workers),0);
   await page.locator('input[type="file"]').setInputFiles({name:'manual.png',mimeType:'image/png',buffer:png});assert.ok(await recovery.isVisible());assert.ok((await recovery.innerText()).includes('rejected.txt'));assert.equal(await page.evaluate(()=>window.__workers),0);assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
}finally{await browser.close();}
