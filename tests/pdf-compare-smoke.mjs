import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire}from'node:module';
const root=process.cwd(),require=createRequire(root+'/package.json');const {createServer}=await import(require.resolve('vite'));const {chromium}=require('playwright');
const out=process.env.PDF_COMPARE_EVIDENCE||path.join(root,'evidence');await fs.mkdir(out,{recursive:true});
await fs.access(path.join(root,'evidence/corpus/fixtures/manifest.json')).catch(()=>{const run=require('node:child_process').spawnSync(process.execPath,['tests/helpers/pdf-compare-fixtures.mjs',path.join(root,'evidence/corpus')],{cwd:root,encoding:'utf8'});if(run.status!==0)throw new Error(run.stderr||'Synthetic fixture generation failed');});
const mutation=process.env.PDF_COMPARE_MUTATION;
const plugins=mutation==='late-registration'?[{name:'late-registration-negative',enforce:'pre',transform(code,id){if(id.endsWith('/pdf-compare/engine.ts')){const from='await new Promise<void>(resolve => setTimeout(resolve, 0)); checkAbort(signal);';assert.ok(code.includes(from));return code.replace(from,'await new Promise<void>(resolve => setTimeout(resolve, 0));');}}}]:[];
const server=await createServer({root,plugins,configFile:false,cacheDir:path.join(out,'vite-cache'),resolve:{alias:{'@':path.join(root,'src')}},optimizeDeps:{entries:['tests/helpers/pdf-compare-harness.html']},server:{host:'127.0.0.1',port:0,watch:null},logLevel:'error'});await server.listen();const url=server.resolvedUrls.local[0];
const browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>console.log('browser:',m.text()));
try{await page.goto(url+'tests/helpers/pdf-compare-harness.html');await page.waitForFunction(()=>window.pdfCompare);const result=await page.evaluate(async()=>{
 const api=window.pdfCompare;const file=async name=>new File([await(await fetch('/evidence/corpus/fixtures/'+name+'.pdf')).arrayBuffer()],name+'.pdf',{type:'application/pdf'});
 const normal=await file('normal-ascii'), multi=await file('multi');const pair={id:'pair',before:multi,after:multi};
 const partialController=new AbortController();const progress=[];
 const partial=await api.comparePdfPairs([pair],{signal:partialController.signal,onProgress:p=>{progress.push(p.completedPages);if(p.completedPages===1)partialController.abort();}});
 const bad=new File(['not a PDF'],'=1+1.pdf');const isolated=await api.comparePdfPairs([{id:'bad',before:bad,after:normal},{id:'good',before:normal,after:normal}],{signal:new AbortController().signal});
 const NativeWorker=window.Worker;const lateController=new AbortController();let scheduled=0,terminated=0;
 window.Worker=class extends NativeWorker{constructor(url,options){super(url,options);if(String(url).includes('pdf-compare.worker')){this.addEventListener('message',()=>{scheduled++;setTimeout(()=>lateController.abort(),0);});}}terminate(){terminated++;return super.terminate();}};
 let late;try{late=await api.comparePdfPairs([{id:'late',before:normal,after:normal}],{signal:lateController.signal});}finally{window.Worker=NativeWorker;}
 const workerController=new AbortController();let pixelWorkerStarted=0;
 window.Worker=class extends NativeWorker{constructor(url,options){super(url,options);if(String(url).includes('pdf-compare.worker')){pixelWorkerStarted++;setTimeout(()=>workerController.abort(),0);}}};
 let workerCancel;try{workerCancel=await api.comparePdfPairs([{id:'worker',before:normal,after:normal}],{signal:workerController.signal});}finally{window.Worker=NativeWorker;}
 const renderController=new AbortController();const lifecycle=[];
 const warm=await api.openComparisonPdf(normal,new AbortController().signal);const warmPage=await warm.document.getPage(1);const pageProto=Object.getPrototypeOf(warmPage);const taskProto=Object.getPrototypeOf(warm.document.loadingTask);await warm.close();
 const originalRender=pageProto.render,originalCleanup=pageProto.cleanup,originalDestroy=taskProto.destroy;
 pageProto.render=function(...args){const task=originalRender.apply(this,args);lifecycle.push('render');const cancel=task.cancel.bind(task);task.cancel=(...a)=>{lifecycle.push('cancel');return cancel(...a);};task.promise.then(()=>lifecycle.push('settled'),()=>lifecycle.push('settled'));queueMicrotask(()=>renderController.abort());return task;};
 pageProto.cleanup=function(...args){lifecycle.push('cleanup');return originalCleanup.apply(this,args);};taskProto.destroy=function(...args){lifecycle.push('destroy');return originalDestroy.apply(this,args);};
 let renderCancel;try{renderCancel=await api.comparePdfPairs([{id:'render',before:normal,after:normal}],{signal:renderController.signal});}finally{pageProto.render=originalRender;pageProto.cleanup=originalCleanup;taskProto.destroy=originalDestroy;}
 const loadController=new AbortController();let readResolved=false;
 const delayedFile=new File([await normal.arrayBuffer()],'delayed.pdf');delayedFile.arrayBuffer=()=>new Promise(resolve=>setTimeout(async()=>{readResolved=true;resolve(await normal.arrayBuffer());},50));
 setTimeout(()=>loadController.abort(),0);const loadCancel=await api.comparePdfPairs([{id:'load',before:delayedFile,after:normal}],{signal:loadController.signal});const loadReturnedBeforeRead=!readResolved;
 const textController=new AbortController();const originalText=pageProto.getTextContent;let textStarted=0;
 pageProto.getTextContent=async function(...args){textStarted++;const content=await originalText.apply(this,args);setTimeout(()=>textController.abort(),0);return new Promise(resolve=>setTimeout(()=>resolve(content),50));};
 let textCancel;try{textCancel=await api.comparePdfPairs([{id:'text',before:normal,after:normal}],{signal:textController.signal});}finally{pageProto.getTextContent=originalText;}
 const session=new api.PdfCompareSession();const old=session.run([pair]);const current=session.run([{id:'new',before:normal,after:normal}]);const superseded=await old;const latest=await current;
 const preview=await session.select(pair,{before:2,after:0});const previewText=[preview.beforeItems.map(x=>x.str).join(''),preview.afterItems.map(x=>x.str).join('')];const previewCanvas=preview.before;session.clearPreview();const previewReleased=previewCanvas.width===0&&preview.beforeItems.length===0;
 session.invalidate();const invalidated=session.result===null;await session.dispose();
 const enc=async blob=>{const bytes=new Uint8Array(await blob.arrayBuffer());let s='';for(let i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);return btoa(s);};
 const outputs=[];for(const [name,p]of [['partial',partial.pairs[0]],['empty-failed',isolated.pairs[0]],['unchanged',isolated.pairs[1]]]){const r=await api.writePairReport(p,'en');outputs.push({name,fileName:r.fileName,base64:await enc(r.blob)});}
 const zip=await api.writeComparisonReports([partial.pairs[0],isolated.pairs[1]],'ko');outputs.push({name:'multi',fileName:zip.fileName,base64:await enc(zip.blob)});
 const preAbort=new AbortController();preAbort.abort();let exportAborted=false;try{await api.writePairReport(partial.pairs[0],'en',preAbort.signal);}catch(e){exportAborted=e.name==='AbortError';}
 return {partial,progress,isolated,late,scheduled,terminated,workerCancel,pixelWorkerStarted,renderCancel,lifecycle,loadCancel,loadReturnedBeforeRead,textCancel,textStarted,superseded,latest,previewText,previewReleased,invalidated,outputs,exportAborted};
});
for(const output of result.outputs){await fs.writeFile(path.join(out,output.name+(output.name==='multi'?'.zip':'.xlsx')),Buffer.from(output.base64,'base64'));delete output.base64;}
await fs.writeFile(path.join(out,'smoke-results.json'),JSON.stringify({browser:browser.version(),result,errors},null,2));
assert.equal(result.partial.canceled,true);assert.equal(result.partial.pairs[0].partial,true);assert.deepEqual(result.partial.pairs[0].pages.map(p=>p.status),['complete','canceled','unknown']);assert.deepEqual(result.progress,[0,1]);
assert.equal(result.isolated.pairs[0].status,'failed');assert.equal(result.isolated.pairs[1].status,'complete');assert.equal(result.scheduled,1);assert.ok(result.terminated>0);assert.equal(result.late.pairs[0].pages[0].status,'canceled');assert.equal(result.late.pairs[0].pages[0].pixelCount,null);
assert.equal(result.loadCancel.canceled,true);assert.ok(result.loadReturnedBeforeRead);assert.equal(result.textCancel.canceled,true);assert.equal(result.textStarted,1);
assert.equal(result.renderCancel.pairs[0].pages[0].status,'canceled');assert.ok(result.lifecycle.indexOf('cancel')<result.lifecycle.indexOf('settled'));assert.ok(result.lifecycle.indexOf('settled')<result.lifecycle.indexOf('cleanup'));assert.ok(result.lifecycle.indexOf('cleanup')<result.lifecycle.indexOf('destroy'));
assert.equal(result.pixelWorkerStarted,1);assert.equal(result.workerCancel.pairs[0].pages[0].status,'canceled');assert.equal(result.superseded,null);assert.equal(result.latest.pairs[0].id,'new');assert.deepEqual(result.previewText,['한글 라벨 주소','ABC xyz']);assert.ok(result.previewReleased&&result.invalidated&&result.exportAborted);
const ExcelJS=require('exceljs');const wb=new ExcelJS.Workbook();await wb.xlsx.readFile(path.join(out,'partial.xlsx'));const sheet=wb.worksheets[0];assert.equal(sheet.rowCount,4);assert.equal(sheet.getCell('G2').value,'Complete');assert.equal(sheet.getCell('G3').value,'Canceled');assert.equal(sheet.getCell('G4').value,'Unknown');assert.equal(sheet.getCell('V2').value,'true');
const failed=new ExcelJS.Workbook();await failed.xlsx.readFile(path.join(out,'empty-failed.xlsx'));assert.equal(failed.worksheets[0].rowCount,2);assert.equal(failed.worksheets[0].getCell('A2').value,'=1+1.pdf');assert.equal(typeof failed.worksheets[0].getCell('A2').value,'string');
const unchanged=new ExcelJS.Workbook();await unchanged.xlsx.readFile(path.join(out,'unchanged.xlsx'));assert.equal(unchanged.worksheets[0].rowCount,2);
const zip=await require('jszip').loadAsync(await fs.readFile(path.join(out,'multi.zip')));const entries=Object.values(zip.files).filter(f=>!f.dir);assert.equal(entries.length,2);for(const entry of entries){const w=new ExcelJS.Workbook();await w.xlsx.load(await entry.async('nodebuffer'));assert.ok(w.worksheets[0].rowCount>=2);}
assert.deepEqual(errors,[]);console.log('PASS partial/cancel/late publication/worker terminate/isolation/session/preview; XLSX3 + ZIP2 reopened');
}finally{await browser.close();await server.close();}
