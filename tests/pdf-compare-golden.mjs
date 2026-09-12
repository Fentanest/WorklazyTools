import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire}from'node:module';
const root=process.cwd(),require=createRequire(root+'/package.json');const {createServer}=await import(require.resolve('vite'));const {chromium}=require('playwright');
const out=process.env.PDF_COMPARE_EVIDENCE||path.join(root,'evidence');await fs.mkdir(out,{recursive:true});
await fs.access(path.join(root,'evidence/corpus/fixtures/manifest.json')).catch(()=>{const run=require('node:child_process').spawnSync(process.execPath,['tests/helpers/pdf-compare-fixtures.mjs',path.join(root,'evidence/corpus')],{cwd:root,encoding:'utf8'});if(run.status!==0)throw new Error(run.stderr||'Synthetic fixture generation failed');});
const server=await createServer({root,configFile:false,cacheDir:path.join(out,'vite-cache'),resolve:{alias:{'@':path.join(root,'src')}},optimizeDeps:{entries:['tests/helpers/pdf-compare-harness.html']},server:{host:'127.0.0.1',port:0,watch:null},logLevel:'error'});await server.listen();const url=server.resolvedUrls.local[0];
const browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>console.log('browser:',m.text()));
try{await page.goto(url+'tests/helpers/pdf-compare-harness.html');await page.waitForFunction(()=>window.pdfCompare);const result=await page.evaluate(async()=>{
 const api=window.pdfCompare;const file=async name=>new File([await(await fetch('/evidence/corpus/fixtures/'+name+'.pdf')).arrayBuffer()],name+'.pdf',{type:'application/pdf'});
 const make=async(a,b,id='pair',mapping)=>({id,before:await file(a),after:await file(b),mapping});
 const run=async(a,b,mapping)=>(console.log('START',a,b),api.comparePdfPairs([await make(a,b,'pair',mapping)],{signal:new AbortController().signal}));
 const records={};
 for(const name of ['normal-ascii','normal-ko','normal-number','historical','blank','image']) records[name]=await run(name,name);
 for(const [a,b]of [['normal-ascii','changed-word'],['normal-ko','changed-ko'],['normal-number','changed-number'],['normal-ascii','changed-color'],['blank','image'],['blank','small-blank'],['large-blank','small-blank'],['normal-ascii','blank']])records[a+'--'+b]=await run(a,b);
 records.mapping=await run('multi','normal-ascii');records.manual=await run('multi','multi',[{before:2,after:0},{before:0,after:null},{before:null,after:2}]);
 const input=await make('normal-ascii','normal-number');const preview=await api.loadSelectedPreview(input,{before:0,after:0},16,new AbortController().signal);
 const hashes=async canvas=>{const bytes=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');};
 const independentlyRender=async f=>{const pdfjs=await import(api.pdfDisplayUrl);pdfjs.GlobalWorkerOptions.workerSrc=api.pdfWorkerUrl;const task=pdfjs.getDocument({data:new Uint8Array(await f.arrayBuffer()),isOffscreenCanvasSupported:false,isImageDecoderSupported:false,useSystemFonts:true});const doc=await task.promise;const p=await doc.getPage(1);const viewport=p.getViewport({scale:96/72});const c=document.createElement('canvas');c.width=Math.ceil(viewport.width);c.height=Math.ceil(viewport.height);const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);await p.render({canvas:c,canvasContext:ctx,viewport,background:'rgb(255,255,255)',annotationMode:1}).promise;const hash=await hashes(c);c.width=c.height=0;p.cleanup();await task.destroy();return hash;};
 records.previewOracle={beforeHash:await independentlyRender(input.before),afterHash:await independentlyRender(input.after)};
 records.preview={beforeItems:preview.beforeItems.map(x=>x.str).join(''),afterItems:preview.afterItems.map(x=>x.str).join(''),beforeHash:await hashes(preview.before),afterHash:await hashes(preview.after),hasOverlay:!!preview.overlay};
 const canvases=[preview.before,preview.after,preview.overlay];preview.release();records.preview.released=canvases.every(c=>c.width===0&&c.height===0)&&preview.beforeItems.length===0&&preview.afterItems.length===0;
 return records;
});await fs.writeFile(path.join(out,'golden-results.json'),JSON.stringify({browser:browser.version(),result,errors},null,2));
const first=name=>result[name].pairs[0].pages[0];
for(const name of ['normal-ascii','normal-ko','normal-number','historical','blank','image'])for(const p of result[name].pairs[0].pages){assert.equal(p.status,'complete',name);assert.equal(p.pixelCount,0,name);assert.ok(p.warnings.includes('extraction-limit'));assert.ok(!('extractionExact'in p));}
for(const [name,expected]of [['normal-ascii','ABC xyz'],['normal-ko','한글 라벨 주소'],['normal-number','ABC 123']])assert.equal(first(name).beforeText,expected);
assert.deepEqual(result.historical.pairs[0].pages.map(p=>p.beforeText),['김민수堺서울堺강남구堺테헤란로 123','한글堺라벨堺주소堺품목堺설명','ABC 塨塩塪 填塬塭 office ffi']);
for(const name of ['blank','image','normal-ascii--blank'])assert.equal(first(name).textComparison,'unavailable');
for(const name of ['normal-ascii--changed-word','normal-ko--changed-ko','normal-number--changed-number','normal-ascii--changed-color'])assert.ok(first(name).pixelCount>0,name);
assert.ok(first('blank--image').pixelCount>0,'image content must differ from blank');
assert.equal(first('normal-ascii--changed-color').textComparison,'equal-extracted-text');
assert.ok(first('normal-number--changed-number').segments.some(s=>s.type==='deleted'&&s.text.includes('123')));
assert.equal(first('blank--small-blank').pixelCount,0);assert.equal(first('blank--small-blank').geometry.pageSizeChanged,true);
assert.ok(first('large-blank--small-blank').geometry.reducedResolution);assert.equal(first('large-blank--small-blank').geometry.width,4096);
assert.equal(result.mapping.pairs[0].pages.length,3);assert.equal(result.mapping.pairs[0].pages[1].pixelRatio,null);assert.equal(result.mapping.pairs[0].pages[1].visualComparison,'deleted');
assert.equal(result.manual.pairs[0].pages[0].beforeText,'한글 라벨 주소');assert.equal(result.manual.pairs[0].pages[0].afterText,'ABC xyz');
assert.equal(result.preview.beforeItems,'ABC xyz');assert.equal(result.preview.afterItems,'ABC 123');assert.notEqual(result.preview.beforeHash,result.preview.afterHash);assert.equal(result.preview.beforeHash,result.previewOracle.beforeHash);assert.equal(result.preview.afterHash,result.previewOracle.afterHash);assert.ok(result.preview.hasOverlay&&result.preview.released);assert.deepEqual(errors,[]);
console.log('PASS 16 engine scenarios, 3 historical raw goldens, selected preview ownership/content');
}finally{await browser.close();await server.close();}
