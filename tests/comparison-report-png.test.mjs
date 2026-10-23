import test from 'node:test';import assert from 'node:assert/strict';import {PNG}from'pngjs';
import {createExportSnapshot,REPORT_LIMITS}from'../src/features/comparison-report/snapshot.ts';
import {writeSnapshotPng}from'../src/features/comparison-report/png.ts';
const base=()=>({language:'en',tool:'image',sources:[{id:'image',revision:'r1',label:'image.png'}],appliedOptions:{threshold:0.1,zoom:2},coordinates:{matrix:[1,0,0,1,-1,0],unit:'working-pixels'},warnings:['reduced-resolution'],completion:'partial',rows:[],view:{width:2,height:1,alpha:'preserved',renderOptions:{view:'overlay',opacity:0.5}}});
function canvas(alpha=0){const data=new PNG({width:2,height:1});data.data.set([255,0,0,alpha,0,255,0,255]);return{width:2,height:1,toBlob(resolve){resolve(new Blob([PNG.sync.write(data)],{type:'image/png'}));},getContext(){return{getImageData:()=>({data:new Uint8ClampedArray(data.data)})};}};}
test('PNG preserves actual raster alpha/dimensions and embeds complete immutable provenance',async()=>{
 const s=createExportSnapshot(base());let releases=0;const blob=await writeSnapshotPng(s,new AbortController().signal,async()=>({canvas:canvas(),view:s.view,snapshotId:s.id,release(){releases++;}}));
 const bytes=Buffer.from(await blob.arrayBuffer()),decoded=PNG.sync.read(bytes);assert.equal(decoded.width,2);assert.equal(decoded.height,1);assert.equal(decoded.data[3],0);assert.equal(decoded.data[7],255);assert.equal(releases,1);
 let position=8,metadata;while(position<bytes.length){const length=bytes.readUInt32BE(position),kind=bytes.toString('ascii',position+4,position+8);if(kind==='iTXt'){const payload=bytes.subarray(position+8,position+8+length);metadata=JSON.parse(payload.subarray(Buffer.byteLength('WorklazyReport')+5).toString('utf8'));}position+=length+12;}
 assert.equal(metadata.scope.kind,'all');assert.equal(metadata.completion,'partial');assert.deepEqual(metadata.warnings,['reduced-resolution']);assert.deepEqual(metadata.appliedOptions,s.appliedOptions);assert.deepEqual(metadata.coordinates,s.coordinates);assert.deepEqual(metadata.view,s.view);
});
test('stale captures, flattened-alpha mismatch and output dimensions reject with cleanup',async()=>{
 for(const kind of ['stale','alpha','dimensions']){const data=base();if(kind==='alpha')data.view={...data.view,alpha:'flattened',background:'#ffffff'};const s=createExportSnapshot(data);let released=0;
 const source=canvas();if(kind==='dimensions')source.width=3;
 await assert.rejects(writeSnapshotPng(s,new AbortController().signal,async()=>({canvas:source,view:s.view,snapshotId:kind==='stale'?'old':s.id,release(){released++;}})),/REPORT_(STALE_CAPTURE|CAPTURE_ALPHA)/);assert.equal(released,1);}
});
test('capture admission and canceled noninterruptible raster encoding never publish partial bytes',async()=>{
 const oversized=createExportSnapshot({...base(),view:{...base().view,width:REPORT_LIMITS.pngPixels+1}});let opened=false;
 await assert.rejects(writeSnapshotPng(oversized,new AbortController().signal,async()=>{opened=true;}),/CAPTURE_LIMIT/);assert.equal(opened,false);
 const s=createExportSnapshot(base()),control=new AbortController();let finish,released=0;const source=canvas();const original=source.toBlob;source.toBlob=resolve=>{finish=()=>original(resolve);};
 const pending=writeSnapshotPng(s,control.signal,async()=>({canvas:source,view:s.view,snapshotId:s.id,release(){released++;}}));await new Promise(r=>setImmediate(r));control.abort();finish();await assert.rejects(pending,{name:'AbortError'});assert.equal(released,1);
});

test('capture ownership remains active until asynchronous release settles',async()=>{
 const s=createExportSnapshot(base());let finish,settled=false;
 const pending=writeSnapshotPng(s,new AbortController().signal,async()=>({canvas:canvas(),view:s.view,snapshotId:s.id,release:()=>new Promise(resolve=>{finish=resolve;})})).then(value=>{settled=true;return value;});
 await new Promise(r=>setImmediate(r));assert.equal(settled,false);assert.equal(typeof finish,'function');finish();assert((await pending).size>0);
});
