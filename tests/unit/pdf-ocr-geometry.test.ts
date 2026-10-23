import test from 'node:test';
import assert from 'node:assert/strict';
import {pdfOcrGeometry,pdfResultReservation,createPdfOcrRaster} from '../../src/features/pdf-compare/ocrRaster.ts';
import {rasterOcrAdmission} from '../../src/features/ocr-compare/model.ts';
import type {SelectedPreview} from '../../src/features/pdf-compare/types.ts';
test('PDF OCR downsamples only its private rasters after charging retained PDF bytes',()=>{
 const small=pdfOcrGeometry(600,250,4*1024*1024,100000);assert.deepEqual(small,{width:600,height:250,scaleX:1,scaleY:1,reduced:false});
 for(const [width,height,retainedCallerBytes,encodedBytes] of [[4096,2000,16*1024*1024,0],[800,1200,8*1024*1024,1e6],[2000,3000,24*1024*1024,1e6]]){
  const g=pdfOcrGeometry(width,height,retainedCallerBytes,encodedBytes);assert.ok(g.reduced);assert.ok(g.width*g.height<=400000);assert.equal(g.width*g.scaleX,width);assert.equal(g.height*g.scaleY,height);
  assert.ok(rasterOcrAdmission({...g,encodedBytes,retainedCallerBytes,retainedRegionPasses:0})<=256*1024*1024);
 }
});
test('PDF retained preview rejection precedes any raster pixel reads or canvas allocation',()=>{
 const canvas={width:2000,height:2000,getContext(){throw new Error('PIXELS_READ');}};
 const preview={before:canvas,after:canvas,overlay:canvas,beforeItems:[],afterItems:[],geometry:{width:2000,height:2000}} as unknown as SelectedPreview;
 assert.throws(()=>createPdfOcrRaster(preview,'large',10,2*1024*1024),/OCR_MEMORY_LIMIT/);
 assert.throws(()=>pdfOcrGeometry(100,100,0,32*1024*1024),/OCR_MEMORY_LIMIT/);
 assert.throws(()=>pdfOcrGeometry(100,100,-1,0),/OCR_MEMORY_LIMIT/);
});
test('PDF result reservation includes both raw text and retained diff pieces',()=>{
 const empty={runId:1,canceled:false,pairs:[]};const baseline=pdfResultReservation(empty);
 const extended={...empty,pairs:[{beforeName:'before',afterName:'after',pages:[{beforeText:'a'.repeat(1000),afterText:'b'.repeat(1000),segments:[{text:'a'.repeat(1000)}]}]}]} as unknown as Parameters<typeof pdfResultReservation>[0];
 assert.ok(pdfResultReservation(extended)>=baseline+12000);
});
