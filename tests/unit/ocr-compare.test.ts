import {imageMemoryEstimate} from '../../src/features/image-compare/memory.ts';
import assert from 'node:assert/strict';import test from 'node:test';
import {adaptTesseract,comparisonText,ocrMemoryEstimate,projectOcrComparison} from '../../src/features/ocr-compare/model.ts';
const context={width:100,height:50,sourceTransform:[1,0,-3,0,1,-4,0,0,1] as [number,number,number,number,number,number,number,number,number],sourceRunId:'run',side:'left',language:'kor+eng' as const};
const native=(text:string,confidence:number|null=40)=>({text,confidence:80,__nativeHeapPeakBytes:32*1024*1024,blocks:[{paragraphs:[{lines:[{words:[{text,confidence,bbox:{x0:5,y0:10,x1:50,y1:30}}]}]}]}]});
test('raw recognition and compatibility characters remain unchanged; comparison normalization is explicit',()=>{const raw='Ａ ① 가\n';const page=adaptTesseract(native(raw),context);assert.equal(page.rawText,raw);assert.equal(page.comparisonText,raw);assert.equal(page.words[0].rawText,raw);assert.equal(comparisonText(raw,'none'),raw);assert.equal(comparisonText(raw,'nfc'),'Ａ ① 가\n');assert.equal(comparisonText(raw,'whitespace'),'Ａ ① 가');});
test('low, unknown and zero scores are retained with review flags and inverse source coordinates',()=>{for(const score of [null,0,40,99]){const page=adaptTesseract(native('word',score),context);assert.equal(page.words.length,1);assert.equal(page.words[0].reviewRequired,score===null||score<70);assert.deepEqual(page.words[0].sourcePolygon[0],{x:2,y:6});assert.equal(page.confidenceScale,'0–100 provider score, not probability');}});
test('empty is a typed provider result; canceled/invalid array output cannot become empty success',()=>{const empty=adaptTesseract({text:'',blocks:null,__nativeHeapPeakBytes:20*1024*1024},context);assert.equal(empty.status,'empty');assert.equal(empty.rawText,'');assert.throws(()=>adaptTesseract([],context),/RESULT_INVALID/);assert.throws(()=>adaptTesseract({text:''},context),/RESULT_INVALID/);const bad=native('word');bad.blocks[0].paragraphs[0].lines[0].words[0].bbox.x1=500;assert.throws(()=>adaptTesseract(bad,context),/BBOX_INVALID/);});
test('OCR admission includes originals and rejects unsafe dimensions before worker/input copies',()=>{assert.ok(ocrMemoryEstimate(640*240,10000)<=256*1024*1024);assert.throws(()=>ocrMemoryEstimate(500000),/MEMORY_LIMIT/);assert.throws(()=>ocrMemoryEstimate(400000,32*1024*1024),/MEMORY_LIMIT/);});

test('corrected transcripts are source-bound, opt-in and never inherit OCR word coordinates',()=>{const page=adaptTesseract(native('raw'),context),pair={sourceRunId:'run',left:page,right:page,elapsedMs:1};const annotation={kind:'corrected-transcript' as const,sourceRunId:'run',side:'left' as const,language:'kor+eng' as const,providerVersion:'7.0.0' as const,modelVersion:'4.0.0_best_int' as const,text:'edited',coordinateAttribution:'none' as const};assert.equal(projectOcrComparison(pair,'none',{left:annotation}).left.comparisonText,'raw');const projection=projectOcrComparison(pair,'none',{left:annotation},true);assert.equal(projection.left.comparisonText,'edited');assert.equal(projection.left.rawText,'raw');assert.equal('words' in projection.left,false);assert.equal(page.rawText,'raw');assert.equal(page.words[0].rawText,'raw');assert.throws(()=>projectOcrComparison(pair,'none',{left:{...annotation,sourceRunId:'other'}},true),/SOURCE_MISMATCH/);});

test('completed OCR session reservation remains counted during subsequent CV/view stages',()=>{const a=imageMemoryEstimate(100,100,10),b=imageMemoryEstimate(100,100,10,0,32*1024*1024);for(const stage of ['decode','comparison','views','regions'] as const)assert.equal(b.stages[stage]-a.stages[stage],32*1024*1024);});

test('region history is charged in reverse admission at 0/1/3 passes; deleting/clearing releases only its reservation',()=>{
 const base=ocrMemoryEstimate(400000,0,0);assert.equal(base,266881024);
 for(const count of [1,3])assert.throws(()=>ocrMemoryEstimate(400000,0,count),/OCR_MEMORY_LIMIT/);
 const small=ocrMemoryEstimate(100000,0,0);for(const count of [1,3])assert.equal(ocrMemoryEstimate(100000,0,count)-small,count*8*1024*1024);
 assert.equal(ocrMemoryEstimate(400000,0,0),base); // same raster after deleting all passes
 assert.throws(()=>ocrMemoryEstimate(400000,0,-1),/OCR_MEMORY_LIMIT/);assert.throws(()=>ocrMemoryEstimate(400000,0,4),/OCR_MEMORY_LIMIT/);
});

test('raster adapter rejects retained-history overflow before reading/copying pixels or starting workers',async()=>{
 const {recognizeRasterOcrPair}=await import('../../src/features/ocr-compare/client.ts');let reads=0,workers=0;
 const originalWorker=globalThis.Worker;Object.defineProperty(globalThis,'Worker',{configurable:true,value:class{constructor(){workers++;throw new Error('must not start');}}});
 try{for(const count of [1,3,undefined]){
  const input={runId:'boundary',width:800,height:500,encodedBytes:0,retainedRegionPasses:count,retainedCallerBytes:0,leftTransform:[1,0,0,0,1,0,0,0,1],rightTransform:[1,0,0,0,1,0,0,0,1],get left(){reads++;throw new Error('must not read');},get right(){reads++;throw new Error('must not read');}};
  await assert.rejects(recognizeRasterOcrPair(input as never,'eng','paragraphs',new AbortController().signal,()=>{}),/OCR_MEMORY_LIMIT/);
 }assert.equal(reads,0);assert.equal(workers,0);}finally{Object.defineProperty(globalThis,'Worker',{configurable:true,value:originalWorker});}
});
