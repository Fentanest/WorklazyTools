import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { PDFDocument, PDFName, decodePDFRawStream } from 'pdf-lib';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5187';
const out=path.resolve(process.env.IMAGE_TEST_OUTPUT||'docs/jobs/todo/image-pdf-mobile/browser');await fs.mkdir(out,{recursive:true});
const fixtureDir=process.env.IMAGE_PDF_FIXTURES;
const report={cases:[],metrics:{},browser:'',actualAndroid:false};
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});report.browser=browser.version();
const context=await browser.newContext({viewport:{width:1280,height:900}});
await context.route('**/*',r=>{const u=new URL(r.request().url());return /^https?:$/.test(u.protocol)&&u.origin!==base?r.abort():r.continue();});
await context.addInitScript(()=>{
 window.__WORKLAZY_MOCK_PROVIDERS__=true;
 const m=window.__imageMetrics={urls:[],bitmaps:0,maxBitmaps:0,decodes:0,maxDecodes:0,encodes:[],reads:[],workerInputs:[],workers:0,phase:'preview'};
 const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
 URL.createObjectURL=b=>{const u=create(b);m.urls.push(u);return u;};URL.revokeObjectURL=u=>{m.urls=m.urls.filter(x=>x!==u);revoke(u);};
 const bitmap=window.createImageBitmap.bind(window);
 window.createImageBitmap=async(...args)=>{m.decodes++;m.maxDecodes=Math.max(m.maxDecodes,m.decodes);try{const b=await bitmap(...args);m.bitmaps++;m.maxBitmaps=Math.max(m.maxBitmaps,m.bitmaps);const close=b.close.bind(b);let closed=false;b.close=()=>{if(!closed){closed=true;m.bitmaps--;}close();};return b;}finally{m.decodes--;}};
 const encode=HTMLCanvasElement.prototype.toBlob;
 HTMLCanvasElement.prototype.toBlob=function(...args){m.encodes.push({phase:m.phase,w:this.width,h:this.height,mime:args[1]});return encode.apply(this,args);};
 const read=File.prototype.arrayBuffer;
 File.prototype.arrayBuffer=async function(){const start=performance.now();try{return await read.call(this);}finally{m.reads.push({name:this.name,size:this.size,ms:performance.now()-start,phase:m.phase});}};
 const Native=window.Worker;
 window.Worker=class extends Native{constructor(...args){super(...args);m.workers++;let ended=false;const term=this.terminate.bind(this);this.terminate=()=>{if(!ended){ended=true;m.workers--;}term();};const post=this.postMessage.bind(this);this.postMessage=(data,...rest)=>{if(data.type==='images-to-pdf'){m.workerInputs=data.inputs.map(x=>{const entry={name:x.name,hash:''};crypto.subtle.digest('SHA-256',x.buffer.slice(0)).then(b=>entry.hash=Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,'0')).join(''));return entry;});m.workerStart=performance.now();}post(data,...rest);};}};
});
const page=await context.newPage();page.setDefaultTimeout(30000);
page.on('pageerror',e=>{console.error('PAGEERROR',String(e));});
const route='/ko/tools/pdf-converter/image-to-pdf/';
async function open(){await page.goto(base+route);await page.locator('input[type=file]').waitFor();}
async function ready(n){await page.waitForFunction(n=>document.querySelectorAll('[data-image-status="ready"]').length===n,n);await page.waitForFunction(()=>!document.querySelector('input[type=file]').disabled);}
async function convert(){await page.evaluate(()=>{window.__imageMetrics.phase='pdf';window.__imageMetrics.pdfStart=performance.now();});await page.getByRole('button',{name:'PDF 만들기',exact:true}).click();await page.getByTestId('pdf-download').waitFor();const b=await page.getByTestId('pdf-download').evaluate(async e=>{const blob=await(await fetch(e.href)).blob();return new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.readAsDataURL(blob);});});return Buffer.from(b,'base64');}
function imageHashes(doc){return doc.getPages().map(p=>{const x=p.node.Resources().lookup(PDFName.of('XObject'));const stream=x.lookup(x.keys()[0]);assert.equal(stream.dict.get(PDFName.of('Filter')).toString(),'/DCTDecode');return hash(stream.contents);});}
const hash=b=>createHash('sha256').update(b).digest('hex');
async function test(name,fn){if(process.env.IMAGE_TEST_FILTER&&!new RegExp(process.env.IMAGE_TEST_FILTER).test(name))return;const start=performance.now();try{await fn();report.cases.push({name,status:'PASS',ms:performance.now()-start});console.log('PASS',name);}catch(e){report.cases.push({name,status:'FAIL',error:String(e),stack:e.stack});console.error('FAIL',name,e);await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}
let synthetic;
await open();
synthetic=await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=160;c.height=100;const x=c.getContext('2d');x.fillStyle='red';x.fillRect(0,0,80,50);x.fillStyle='lime';x.fillRect(80,0,80,50);x.fillStyle='blue';x.fillRect(0,50,80,50);x.fillStyle='yellow';x.fillRect(80,50,80,50);return Array.from(new Uint8Array(await (await new Promise(r=>c.toBlob(r,'image/jpeg',.98))).arrayBuffer()));});
// Canvas JPEGs carry ICC on Chromium; use a plain RGB fixture for the direct path.
const profiledSynthetic = [...synthetic];
{ const b=Buffer.from(synthetic), chunks=[b.subarray(0,2)];let at=2;
  while(at<b.length){const marker=b[at+1];if(marker===218){chunks.push(b.subarray(at));break;}const end=at+2+b.readUInt16BE(at+2);if(marker!==226&&marker!==238)chunks.push(b.subarray(at,end));at=end;}
  synthetic=[...Buffer.concat(chunks)];
}
const sample={name:'same.jpg',mimeType:'',buffer:Buffer.from(synthetic)};
await test('synthetic duplicate selection, same names, retained bytes and final PDF',async()=>{
 await page.locator('input[type=file]').setInputFiles([sample,{...sample,mimeType:'image/png',buffer:Buffer.concat([sample.buffer,Buffer.from([0])])}]);await ready(2);
 await page.locator('input[type=file]').setInputFiles(sample);await ready(3);
 const ids=await page.locator('.pdf-image-card').evaluateAll(es=>es.map(e=>e.dataset.imageId));assert.equal(new Set(ids).size,3);
 const b=await convert();const doc=await PDFDocument.load(b);assert.deepEqual(imageHashes(doc),[hash(sample.buffer),hash(Buffer.concat([sample.buffer,Buffer.from([0])])),hash(sample.buffer)]);
 const m=await page.evaluate(()=>window.__imageMetrics);assert.equal(m.encodes.filter(x=>x.phase==='pdf').length,0);assert.equal(m.workers,0);assert.equal(m.bitmaps,0);assert.equal(m.maxDecodes,1);
 await page.getByRole('button',{name:'이미지 크기',exact:true}).click();assert.equal(await page.getByTestId('pdf-download').count(),0);
 const imagePdf=await PDFDocument.load(await convert());assert.deepEqual(imagePdf.getPages()[0].getSize(),{width:120,height:75});
 await fs.writeFile(path.join(out,'synthetic.pdf'),await imagePdf.save());
});
await test('bad/empty inputs expose metadata stage and block conversion; deleting clears block',async()=>{
 await open();await page.locator('input[type=file]').setInputFiles([{name:'empty.jpg',mimeType:'image/jpeg',buffer:Buffer.alloc(0)},{name:'bad.png',mimeType:'image/png',buffer:Buffer.from('broken')}]);
 await page.waitForFunction(()=>document.querySelectorAll('[data-image-status="failed"]').length===2);
 assert.equal(await page.getByRole('button',{name:'PDF 만들기',exact:true}).isDisabled(),true);assert.match(await page.locator('.pdf-image-card').first().innerText(),/형식·메타데이터/);
 await page.locator('.pdf-image-remove').first().click();await page.locator('.pdf-image-remove').first().click();
 await page.locator('input[type=file]').setInputFiles(sample);await ready(1);assert.equal((await PDFDocument.load(await convert())).getPageCount(),1);
});
if(fixtureDir){
 const names=(await fs.readdir(fixtureDir)).filter(n=>/\.jpg$/i.test(n)).sort();const files=names.map(n=>path.join(fixtureDir,n));const expected=await Promise.all(files.map(async p=>hash(await fs.readFile(p))));assert.equal(files.length,17);
 await test('user ZIP 17 together: 400px thumbnails, original JPEG streams, A4 pages',async()=>{
  await open();const start=performance.now();await page.locator('input[type=file]').setInputFiles(files);await ready(17);const previewMs=performance.now()-start;
  for(const img of await page.locator('.pdf-image-preview img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(e=>e.decode());assert.ok(await img.evaluate(e=>Math.max(e.naturalWidth,e.naturalHeight)<=400));}
  const pdfStart=performance.now(),b=await convert(),pdfMs=performance.now()-pdfStart;const doc=await PDFDocument.load(b);
  assert.deepEqual(imageHashes(doc),expected);for(const p of doc.getPages()){
    assert.deepEqual(p.getSize(),{width:841.89,height:595.28});
    const contents=p.node.Contents().asArray().map(ref=>Buffer.from(decodePDFRawStream(doc.context.lookup(ref)).decode()).toString()).join('');
    const transforms=[...contents.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) cm/g)].map(m=>m.slice(1).map(Number));
    const translation=transforms.find(m=>m[4]>0&&m[5]>0),scale=transforms.find(m=>m[0]>1&&m[3]>1);
    assert.ok(translation&&scale);assert.ok(translation[4]>=28&&translation[5]>=28);assert.ok(translation[4]+scale[0]<=841.89-28+.01);assert.ok(translation[5]+scale[3]<=595.28-28+.01);assert.ok(Math.abs(scale[0]/scale[3]-4/3)<.00001);
  }
  const m=await page.evaluate(()=>window.__imageMetrics);assert.equal(m.encodes.filter(e=>e.phase==='pdf').length,0);assert.equal(m.maxDecodes,1);assert.equal(m.bitmaps,0);assert.equal(m.workers,0);
  assert.deepEqual(m.workerInputs.map(e=>e.hash),expected);
  report.metrics.current={previewMs,pdfMs,pdfBytes:b.length,fileReadMs:m.reads.filter(r=>r.phase==='preview').reduce((n,r)=>n+r.ms,0),preprocessMs:m.workerStart-m.pdfStart,thumbnailEncodes:m.encodes.filter(e=>e.phase==='preview').length,pdfEncodes:0,urls:m.urls.length,bitmaps:m.bitmaps,workers:m.workers};
  await fs.writeFile(path.join(out,'private-17-a4.pdf'),b);
 });
 await test('user ZIP 17 one at a time: no recopies; delete, readd, reorder and page order',async()=>{
  await open();for(let i=0;i<files.length;i++){await page.locator('input[type=file]').setInputFiles(files[i]);await ready(i+1);}
  assert.equal((await page.evaluate(()=>window.__imageMetrics.reads)).length,17);
  await page.locator('.pdf-image-remove').nth(3).click();await page.locator('input[type=file]').setInputFiles(files[3]);await ready(17);
  // Exercise the installed Sortable callback with exactly the DOM mutation Sortable performs.
  await page.evaluate(async()=>{const list=document.querySelector('.pdf-image-grid');const sortable=list[Object.keys(list).find(k=>k.startsWith('Sortable'))];list.prepend(list.lastElementChild);sortable.option('onEnd')({oldIndex:16,newIndex:0});});
  const order=[expected[3],...expected.filter((_,i)=>i!==3)];const b=await convert();assert.deepEqual(imageHashes(await PDFDocument.load(b)),order);
  await fs.writeFile(path.join(out,'private-17-reordered.pdf'),b);
  while(await page.locator('.pdf-image-remove').count())await page.locator('.pdf-image-remove').first().click();
  const resources=await page.evaluate(()=>({urls:window.__imageMetrics.urls.length,bitmaps:window.__imageMetrics.bitmaps,workers:window.__imageMetrics.workers}));assert.deepEqual(resources,{urls:0,bitmaps:0,workers:0});report.metrics.afterRemoval=resources;
 });
}
await test('provider read failure is localized, input resets; reselect succeeds',async()=>{
 await open();await page.evaluate(()=>{const native=File.prototype.arrayBuffer;let fail=true;File.prototype.arrayBuffer=function(){if(fail&&this.name==='same.jpg'){fail=false;return Promise.reject(new DOMException('provider gone','NotReadableError'));}return native.call(this);};});
 await page.locator('input[type=file]').setInputFiles(sample);await page.waitForFunction(()=>document.querySelector('[data-image-status="failed"]'));
 assert.match(await page.locator('.pdf-image-card').innerText(),/파일 읽기/);assert.equal(await page.locator('input[type=file]').inputValue(),'');assert.equal(await page.getByRole('button',{name:'PDF 만들기',exact:true}).isDisabled(),true);
 await page.locator('.pdf-image-remove').click();await page.locator('input[type=file]').setInputFiles(sample);await ready(1);await convert();
});
await test('late acquisition after deletion, preparation cancel and route exit cannot restore items',async()=>{
 for(const action of ['delete','cancel','exit']){
  await open();await page.evaluate(()=>{const native=File.prototype.arrayBuffer;let first=true;File.prototype.arrayBuffer=function(){if(first){first=false;return new Promise((resolve,reject)=>{window.__releaseRead=()=>native.call(this).then(resolve,reject);});}return native.call(this);};});
  await page.locator('input[type=file]').setInputFiles(sample);await page.waitForFunction(()=>!!window.__releaseRead);
  if(action==='delete')await page.locator('.pdf-image-remove').click();
  if(action==='cancel')await page.getByRole('button',{name:'이미지 준비 취소',exact:true}).click();
  if(action==='exit')await page.getByRole('link',{name:'모든 도구',exact:true}).first().click();
  await page.waitForFunction(()=>document.querySelectorAll('.pdf-image-card').length===0);
  await page.evaluate(()=>window.__releaseRead());await page.waitForTimeout(150);
  assert.equal(await page.locator('.pdf-image-card').count(),0,action);assert.equal(await page.evaluate(()=>window.__imageMetrics.urls.length),0,action);
  if(action!=='exit'){await page.locator('input[type=file]').setInputFiles(sample);await ready(1);}
 }
});
await test('thumbnail encoding/display failure is recoverable and distinct from unreadable original',async()=>{
 await open();await page.evaluate(()=>{const native=HTMLCanvasElement.prototype.toBlob;let first=true;HTMLCanvasElement.prototype.toBlob=function(cb,...args){if(first){first=false;cb(null);return;}return native.call(this,cb,...args);};});
 await page.locator('input[type=file]').setInputFiles(sample);await page.waitForFunction(()=>document.querySelector('[data-image-status="failed"]'));
 assert.match(await page.locator('.pdf-image-card').innerText(),/썸네일/);assert.equal(await page.getByRole('button',{name:'PDF 만들기',exact:true}).isEnabled(),true);
 await page.getByRole('button',{name:'미리보기 재시도',exact:true}).click();await ready(1);
 await page.locator('.pdf-image-preview img').dispatchEvent('error');await page.getByRole('button',{name:'미리보기 재시도',exact:true}).click();await ready(1);
 assert.equal(await page.evaluate(()=>window.__imageMetrics.urls.length),1);await convert();
});
await test('cancel during non-abortable preprocessing holds retry until disposal, then succeeds',async()=>{
 await open();const png=await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=100;c.height=200;const x=c.getContext('2d');x.fillStyle='red';x.fillRect(0,0,40,60);return Array.from(new Uint8Array(await(await new Promise(r=>c.toBlob(r,'image/png'))).arrayBuffer()));});
 await page.locator('input[type=file]').setInputFiles({name:'transparent.png',mimeType:'',buffer:Buffer.from(png)});await ready(1);
 await page.evaluate(()=>{const native=window.createImageBitmap;let first=true;window.createImageBitmap=(...args)=>{if(first){first=false;return new Promise((resolve,reject)=>{window.__releaseBitmap=()=>native(...args).then(resolve,reject);});}return native(...args);};});
 await page.getByRole('button',{name:'PDF 만들기',exact:true}).click();await page.waitForFunction(()=>!!window.__releaseBitmap);
 assert.equal(await page.locator('.pdf-image-remove').isDisabled(),true);assert.equal(await page.locator('input[type=file]').isDisabled(),true);assert.equal(await page.getByRole('button',{name:'이미지 크기',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'변환 취소',exact:true}).click();assert.equal(await page.getByRole('button',{name:'PDF 만들기',exact:true}).isDisabled(),true);
 await page.evaluate(()=>window.__releaseBitmap());await page.waitForFunction(()=>!document.querySelector('[data-ui-component="primary-button"]').disabled);
 assert.equal(await page.getByTestId('pdf-download').count(),0);const b=await convert();const doc=await PDFDocument.load(b);assert.deepEqual(doc.getPages()[0].getSize(),{width:595.28,height:841.89});
 const x=doc.getPages()[0].node.Resources().lookup(PDFName.of('XObject'));const stream=x.lookup(x.keys()[0]);assert.ok(stream.dict.get(PDFName.of('SMask')),'PNG transparency soft mask retained');
 await fs.writeFile(path.join(out,'transparent.pdf'),b);
});
await test('canceling a thumbnail retry removes the previous PDF and discards the late thumbnail',async()=>{
 await open();await page.locator('input[type=file]').setInputFiles(sample);await ready(1);await convert();
 await page.locator('.pdf-image-preview img').dispatchEvent('error');
 await page.evaluate(()=>{const native=window.createImageBitmap;window.createImageBitmap=(...args)=>new Promise((resolve,reject)=>{window.__releaseRetry=()=>native(...args).then(resolve,reject);});});
 await page.getByRole('button',{name:'미리보기 재시도',exact:true}).click();await page.waitForFunction(()=>!!window.__releaseRetry);
 await page.getByRole('button',{name:'이미지 준비 취소',exact:true}).click();
 assert.equal(await page.locator('.pdf-image-card').count(),0);assert.equal(await page.getByTestId('pdf-download').count(),0);
 await page.evaluate(()=>window.__releaseRetry());await page.waitForFunction(()=>window.__imageMetrics.decodes===0);
 assert.equal(await page.getByTestId('pdf-download').count(),0);assert.equal(await page.locator('.pdf-image-card').count(),0);
 assert.equal(await page.evaluate(()=>window.__imageMetrics.urls.length),0);assert.equal(await page.evaluate(()=>window.__imageMetrics.bitmaps),0);
});
await test('shared drop zone retains legacy sync/async, single/multiple/drop and reset contracts',async()=>{
 await open();await page.evaluate(async()=>{
  const {mountDropHarness}=await import('/tests/helpers/pdf-image-drop-harness.tsx');window.__drop=mountDropHarness();
 });
 const input=page.locator('#drop-harness input');await input.setInputFiles({name:'new.txt',mimeType:'text/plain',buffer:Buffer.from('b')});assert.deepEqual(await page.evaluate(()=>window.__drop.received.at(-1)),['old.txt','new.txt']);
 await page.evaluate(()=>window.__drop.render(false,true));await input.setInputFiles({name:'new.txt',mimeType:'text/plain',buffer:Buffer.from('b')});assert.deepEqual(await page.evaluate(()=>window.__drop.received.at(-1)),['new.txt']);assert.notEqual(await input.inputValue(),'');assert.equal(await input.isDisabled(),true);
 await page.evaluate(()=>window.__drop.release());await page.waitForFunction(()=>document.querySelector('#drop-harness input').value==='');
 await page.evaluate(()=>window.__drop.render(true,false,true));await input.setInputFiles({name:'new.txt',mimeType:'text/plain',buffer:Buffer.from('b')});assert.deepEqual(await page.evaluate(()=>window.__drop.received.at(-1)),['new.txt']);
 await page.evaluate(()=>window.__drop.render(true,false));await page.locator('#drop-harness [data-ui-part="drop-target"]').evaluate(e=>{const dt=new DataTransfer();dt.items.add(new File(['c'],'drop.txt'));e.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:dt}));});assert.deepEqual(await page.evaluate(()=>window.__drop.received.at(-1)),['old.txt','drop.txt']);
 await page.evaluate(()=>window.__drop.unmount());
});

await test('EXIF 1–8 and absent: asymmetric pixel oracle in final PDF, bitmap and fallback',async()=>{
 await open();
 for(const fallback of [false,true]){
  const result=await page.evaluate(async({jpeg,fallback})=>{
   const {imagesToPdf}=await import('/src/features/pdf-editor/pdfWorkerClient.ts');
   const original=window.createImageBitmap;if(fallback)window.createImageBitmap=async()=>{throw new Error('force image fallback');};
   const files=[];
   for(let o=1;o<=8;o++){
    const segment=new Uint8Array(36);segment.set([255,225,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,o,0,0,0,0,0,0,0]);
    files.push(new File([new Uint8Array(jpeg.slice(0,2)),segment,new Uint8Array(jpeg.slice(2))],`o${o}.jpg`,{type:'image/jpeg'}));
   }
   files.push(new File([new Uint8Array(jpeg)],'absent.jpg'));
   try{const r=await imagesToPdf(files,'image','orientation.pdf');return Array.from(new Uint8Array(r.buffer));}finally{window.createImageBitmap=original;}
  },{jpeg:synthetic,fallback});
  const pdfPath=path.join(out,`orientations-${fallback?'fallback':'bitmap'}.pdf`);await fs.writeFile(pdfPath,Buffer.from(result));
  const doc=await PDFDocument.load(Buffer.from(result));assert.equal(doc.getPageCount(),9);doc.getPages().forEach((p,i)=>assert.deepEqual(p.getSize(),i>=4&&i<=7?{width:75,height:120}:{width:120,height:75}));
  const {execFileSync}=await import('node:child_process');execFileSync('pdftoppm',['-png','-scale-to','160',pdfPath,path.join(out,'orientation')]);
  const {PNG}=await import('pngjs');const expected=[[0,1,2,3],[1,0,3,2],[3,2,1,0],[2,3,0,1],[0,2,1,3],[2,0,3,1],[3,1,2,0],[1,3,0,2],[0,1,2,3]],colors=[[255,0,0],[0,255,0],[0,0,255],[255,255,0]];
  for(let i=0;i<9;i++){const png=PNG.sync.read(await fs.readFile(path.join(out,`orientation-${i+1}.png`)));const corners=[[.25,.25],[.75,.25],[.25,.75],[.75,.75]].map(([x,y])=>{const at=(Math.floor(y*png.height)*png.width+Math.floor(x*png.width))*4;const actual=[...png.data.subarray(at,at+3)];return colors.map(c=>c.reduce((n,v,k)=>n+(v-actual[k])**2,0)).reduce((best,v,k,all)=>v<all[best]?k:best,0);});assert.deepEqual(corners,expected[i],`orientation ${i+1}, fallback ${fallback}`);}
 }
});

await test('PNG eXIf orientation uses decoded aspect ratio for thumbnail and final PDF',async()=>{
 await open();const {PNG}=await import('pngjs');const png=new PNG({width:160,height:100});
 for(let y=0;y<100;y++)for(let x=0;x<160;x++)png.data.set([[255,0,0,255],[0,255,0,255],[0,0,255,255],[255,255,0,255]][(y>=50?2:0)+(x>=80?1:0)],(y*160+x)*4);
 const raw=PNG.sync.write(png),tiff=Buffer.from([73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0]);
 const body=Buffer.concat([Buffer.from('eXIf'),tiff]);let crc=0xffffffff;
 for(const byte of body){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
 const chunk=Buffer.alloc(body.length+8);chunk.writeUInt32BE(tiff.length);body.copy(chunk,4);chunk.writeUInt32BE((crc^0xffffffff)>>>0,chunk.length-4);
 const bytes=Buffer.concat([raw.subarray(0,33),chunk,raw.subarray(33)]);
 await page.locator('input[type=file]').setInputFiles({name:'oriented.png',mimeType:'',buffer:bytes});await ready(1);
 assert.deepEqual(await page.locator('.pdf-image-preview img').evaluate(async e=>{await e.decode();return [e.naturalWidth,e.naturalHeight];}),[100,160]);
 await page.getByRole('button',{name:'이미지 크기',exact:true}).click();const output=await convert();assert.deepEqual((await PDFDocument.load(output)).getPages()[0].getSize(),{width:75,height:120});
 const pdfPath=path.join(out,'png-exif.pdf');await fs.writeFile(pdfPath,output);
 const {execFileSync}=await import('node:child_process');execFileSync('pdftoppm',['-png','-scale-to','160',pdfPath,path.join(out,'png-exif')]);
 const rendered=PNG.sync.read(await fs.readFile(path.join(out,'png-exif-1.png')));const at=(40*rendered.width+25)*4;
 assert.ok(rendered.data[at+2]>240&&rendered.data[at]<15&&rendered.data[at+1]<15,'orientation 6 top-left is blue');
});
await test('Korean/English tablet and phone visual states with synthetic inputs',async()=>{
 for(const [lang,width,dark] of [['ko',800,false],['en',800,true],['ko',390,false],['en',1280,true]]){
  await page.setViewportSize({width,height:1000});await page.goto(base+`/${lang}/tools/pdf-converter/image-to-pdf/`);await page.locator('input[type=file]').waitFor();
  await page.evaluate(async dark=>{const {applyTheme}=await import('/src/theme.ts');applyTheme(dark?'dark-coral':'light-coral');},dark);
  assert.equal(await page.locator('html').getAttribute('data-theme'),dark?'dark-coral':'light-coral');
  await page.locator('input[type=file]').setInputFiles(sample);await ready(1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:path.join(out,`visual-${lang}-${width}-${dark?'dark':'light'}.png`),fullPage:true});
 }
});
await context.close();await browser.close();console.log(`# tests ${report.cases.length}`);console.log(`# pass ${report.cases.filter(x=>x.status==='PASS').length}`);console.log(`# fail ${report.cases.filter(x=>x.status==='FAIL').length}`);if(!report.cases.length||report.cases.some(x=>x.status==='FAIL'))process.exitCode=1;
