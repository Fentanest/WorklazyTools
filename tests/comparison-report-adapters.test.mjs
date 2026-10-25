import test from 'node:test';import assert from 'node:assert/strict';
import {compareTexts}from'../src/features/text-compare/core.ts';import{DEFAULT_TEXT_OPTIONS}from'../src/features/text-compare/resultTypes.ts';
import{compareRgba}from'../src/features/image-compare/kernel.ts';import{DEFAULT_PIXEL_OPTIONS,IDENTITY_TRANSFORM,IMAGE_LIMITS}from'../src/features/image-compare/types.ts';import{imageMemoryEstimate,disposeImageResult}from'../src/features/image-compare/memory.ts';
import{textExportSnapshot}from'../src/features/comparison-report/textAdapter.ts';import{imageExportSnapshot,imageReportReservation,captureImageReport}from'../src/features/comparison-report/imageAdapter.ts';import{ImageReportOwner}from'../src/features/comparison-report/ImageReportOwner.ts';
const state=()=>({left:'ONE\r\nanchor\r\n',right:'one\r\nchanged\r\n',options:{...DEFAULT_TEXT_OPTIONS,ignoreCase:true},revision:7});
function image(){const left=new Uint8ClampedArray([0,0,0,255,0,0,0,0]),right=new Uint8ClampedArray([0,0,0,255,255,0,0,255]),leftValid=new Uint8Array([1,0]),rightValid=new Uint8Array([1,1]);const source={bytes:8,mime:'image/png',width:8,height:4,decodedWidth:8,decodedHeight:4,bitDepth:8,exifOrientation:1,decodeOrientation:'from-image',workingColorSpace:'8-bit sRGB'};
return{...compareRgba(left,right,2,1,leftValid,rightValid,DEFAULT_PIXEL_OPTIONS),left,right,leftValid,rightValid,width:2,height:1,quality:{mode:'reduced-resolution',scale:0.25,originalWidth:8,originalHeight:4,workingWidth:2,workingHeight:1,resizePasses:1,samplingPassesPerSource:1,pixelUnits:'working-pixels',resources:imageMemoryEstimate(64,2,16)},sources:{left:{...source,name:'left.png'},right:{...source,name:'right.png'}},options:DEFAULT_PIXEL_OPTIONS,geometry:{originX:-4,originY:0,leftMatrix:[0.25,0,0,0.25,1,0],rightMatrix:[0.25,0,0,0.25,1,0],rightProjective:[0.25,0,1,0,0.25,0,0,0,1],rightTransform:IDENTITY_TRANSFORM},runId:'image-run',engine:'pixelmatch-7.1.0-rgba-v1'};}
test('Text report consumes exact existing raw rows/marks/options/UTF16 coordinates and original text',()=>{
 const source=state(),result=compareTexts(source.left,source.right,source.options,7);const snapshot=textExportSnapshot(result,source,'en');
 assert.equal(snapshot.rows.length,result.rows.length);assert.equal(snapshot.rawSources.left,source.left);assert.equal(snapshot.rawSources.right,source.right);
 for(let i=0;i<result.rows.length;i++){assert.equal(snapshot.rows[i].status,result.rows[i].kind);assert.equal(snapshot.rows[i].left,result.rows[i].left?.raw??'');assert.deepEqual(snapshot.rows[i].metadata.leftMarks,result.rows[i].leftMarks);if(result.rows[i].left)assert.equal(snapshot.rows[i].coordinates.left.start,result.rows[i].left.start);}
 assert.deepEqual(snapshot.appliedOptions.comparison,result.options);assert.equal(snapshot.sources[0].revision,'7');assert(Object.isFrozen(snapshot.rows[0]));
});
test('Text changed-row scope is explicit, keeps producer classifications, omits full originals and rejects stale revisions/options',()=>{
 const source=state(),result=compareTexts(source.left,source.right,source.options,7);const selected=textExportSnapshot(result,source,'en','changed');
 assert.equal(selected.scope.kind,'selected');assert.equal(selected.rawSources,undefined);assert(selected.rows.every(row=>['changed','added','deleted'].includes(row.status)));
 assert.deepEqual(selected.rows.map(r=>r.id),result.rows.filter(r=>['changed','added','deleted'].includes(r.kind)).map(r=>r.id));
 assert.throws(()=>textExportSnapshot(result,{...source,revision:8},'en'),/REPORT_STALE/);assert.throws(()=>textExportSnapshot(result,{...source,options:{...source.options,ignoreCase:false}},'en'),/REPORT_STALE/);
 const coarse={...result,quality:'line-coarse',reasons:['COMPARISON_BUDGET']};assert.equal(textExportSnapshot(coarse,source,'en').completion,'partial');
});
test('Image snapshot retains working/source dimensions, projective authority, scale and warnings before original disposal',()=>{
 const result=image(),snapshot=imageExportSnapshot(result,4,'highlight','en');disposeImageResult(result);
 assert.equal(snapshot.coordinates.unit,'working-pixels');assert.equal(snapshot.coordinates.originalCanvasExtent.width,8);assert.equal(snapshot.view.width,2);assert.equal(snapshot.appliedOptions.quality.scale,0.25);assert.equal(snapshot.appliedOptions.quality.resizePasses,1);
 assert.equal(snapshot.coordinates.rightMatrixKind,'projective3');assert.deepEqual(snapshot.coordinates.rightSourceToWorking,[0.25,0,1,0,0.25,0,0,0,1]);assert.equal(snapshot.coordinates.originalCanvasOrigin.unit,'original-transformed-pixels');assert(snapshot.warnings.some(w=>w.includes('does not prove identical original files or pixels')));
 assert.equal(snapshot.rows[0].status,'working-pixel-metrics');assert.equal(snapshot.view.alpha,'preserved');assert.throws(()=>captureImageReport(snapshot,result,'highlight',new AbortController().signal),/REPORT_STALE_CAPTURE/);
});
test('Image export admits extra memory before capture and rejects over-budget work',()=>{
 const result=image();assert(imageReportReservation(result)>0);assert.throws(()=>imageReportReservation(result,IMAGE_LIMITS.memoryBytes),/IMAGE_MEMORY_LIMIT/);assert.throws(()=>imageReportReservation({...result,width:9000,height:9000}),/REPORT_CAPTURE_LIMIT/);disposeImageResult(result);
});
test('Image lease blocks a second heavy job through writer and URL lifetime; cancel/drain releases it',async()=>{
 const result=image(),snapshot=imageExportSnapshot(result,4,'left','en'),owner=new ImageReportOwner(),events=[];let finishWriter,finishLease;
 const lease={done:new Promise(resolve=>{finishLease=resolve;}),release(){events.push('revoke');finishLease();}};
 const task=owner.run(snapshot,()=>true,async()=>{await new Promise(resolve=>{finishWriter=resolve;});return new Blob(['png']);},()=>lease,123,busy=>events.push(busy));task.catch(()=>{});
 assert(owner.busy);assert.equal(owner.retainedBytes,123);assert.throws(()=>owner.run(snapshot,()=>true,async()=>new Blob(['other']),()=>lease,123,()=>{}),/REPORT_BUSY/);
 finishWriter();await new Promise(resolve=>setImmediate(resolve));assert(owner.busy);await owner.drain();await task;assert(!owner.busy);assert.equal(owner.retainedBytes,0);assert(events.includes('revoke'));disposeImageResult(result);
});

test('Text displayed scope uses only supplied producer-view IDs; full export remains independent of the projection',()=>{
 const source=state(),result=compareTexts(source.left,source.right,source.options,7),ids=[result.rows.at(-1).id];const displayed=textExportSnapshot(result,source,'en',{displayedIds:ids}),full=textExportSnapshot(result,source,'en');
 assert.deepEqual(displayed.rows.map(r=>r.id),ids);assert.equal(displayed.rawSources,undefined);assert.equal(displayed.appliedOptions.exportScope,'displayed');assert.equal(full.rows.length,result.rows.length);assert.equal(full.appliedOptions.exportStyle.screenThemeApplied,false);
 assert.throws(()=>textExportSnapshot(result,source,'en',{displayedIds:['old-result-row']}),/REPORT_INVALID_SCOPE/);assert.throws(()=>textExportSnapshot(result,source,'en',{displayedIds:[]}),/REPORT_INVALID_SCOPE/);
});

test('future normalization provenance copies policy/rules and row rule IDs without retaining map buffers',()=>{
 const source=state(),result=compareTexts(source.left,source.right,source.options,7);result.provenance={policyVersion:'p1',rules:[{id:0,literal:'ONE'}],left:{starts:new Uint32Array([0,1]),ends:new Uint32Array([1,2])},right:{starts:new Uint32Array([0]),ends:new Uint32Array([1])}};result.rows[0].leftMarks=[{start:0,end:3,kind:'ignored',ruleIds:[0]}];
 const snapshot=textExportSnapshot(result,source,'en');assert.deepEqual(snapshot.appliedOptions.normalizationProvenance,{policyVersion:'p1',rules:[{id:0,literal:'ONE'}]});assert.deepEqual(snapshot.rows[0].metadata.leftMarks[0].ruleIds,[0]);assert(!JSON.stringify(snapshot).includes('\"starts\"'));assert.equal(result.provenance.left.starts.byteLength,8);
});

test('a newly mounted observer sees an outstanding export until canceled writer cleanup completes',async()=>{
 const result=image(),snapshot=imageExportSnapshot(result,4,'left','en'),owner=new ImageReportOwner();let finish,current=true;const observed=[];
 const job=owner.run(snapshot,()=>current,async()=>{await new Promise(resolve=>{finish=resolve;});return new Blob(['late']);},()=>assert.fail('stale download'),10,()=>{});job.catch(()=>{});
 const unsubscribe=owner.subscribe(busy=>observed.push(busy));assert.deepEqual(observed,[true]);current=false;owner.cancel();assert(owner.busy);finish();await assert.rejects(job);await owner.drain();assert.deepEqual(observed,[true,false]);unsubscribe();disposeImageResult(result);
});
