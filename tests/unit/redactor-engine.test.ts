import assert from 'node:assert/strict';
import test from 'node:test';
import {PDFDocument,PDFName} from 'pdf-lib';
import {normalizedToPixelRect,rowIntervals,validateMasks} from '../../src/features/document-redactor/geometry.ts';
import {OwnedLedger,MiB} from '../../src/features/document-redactor/ledger.ts';
import {inspectPdfStructure} from '../../src/features/document-redactor/input.ts';

test('normalized union keeps page edge and overlapping mask interiors',()=>{
 assert.deepEqual(normalizedToPixelRect({width:10,height:10},{x:0,y:0,w:.1,h:.1}),{x0:0,y0:0,x1:3,y1:3});
 assert.deepEqual(rowIntervals([{x0:0,x1:5,y0:0,y1:3},{x0:4,x1:9,y0:1,y1:4}],2),[[0,9]]);
 for(const value of [{x:NaN,y:0,w:1,h:1},{x:0,y:0,w:0,h:1},{x:.9,y:0,w:.2,h:1}])assert.throws(()=>validateMasks([value]));
});
test('reserve precedes allocation, backing identity and disposal are distinct',async()=>{
 const ledger=new OwnedLedger();const original=await ledger.allocate('a','buffer','binary',16,()=>new Uint8Array(16));const alias=await ledger.allocate('a','alias','binary',0,()=>original.value.subarray(4));
 assert.equal(original.record.id,alias.record.id);assert.equal(ledger.totals.binary,16);
 const r=ledger.reserve('a','fill','binary',128*MiB-16);let called=false;await assert.rejects(ledger.allocate('a','plus1','binary',1,()=>{called=true;return new Uint8Array(1);}));assert.equal(called,false);ledger.close(r);ledger.releaseOwner('a');assert.deepEqual(ledger.totals,{binary:0,raw:0});
 let disposed=false;await assert.rejects(ledger.allocate('bad','over','raw',1,()=>({}),{size:2,dispose:()=>{disposed=true;}}));assert.equal(disposed,true);assert.equal(ledger.totals.raw,0);
});
test('PDF raw preflight rejects XFA, invalid geometry, repeated/cyclic tree and 101 leaves',async()=>{
 const base=await PDFDocument.create({updateMetadata:false});base.addPage([100,100]);const bytes=await base.save({useObjectStreams:false});
 for(const kind of ['xfa','crop','unit','duplicate','cycle','limit']){
  const p=await PDFDocument.load(bytes);const page=p.getPage(0);
  if(kind==='xfa')p.catalog.set(PDFName.of('AcroForm'),p.context.obj({XFA:p.context.obj('x')}));
  if(kind==='crop')page.node.set(PDFName.of('CropBox'),p.context.obj([1,1,0,0]));
  if(kind==='unit')page.node.set(PDFName.of('UserUnit'),p.context.obj(-1));
  if(kind==='duplicate')p.catalog.Pages().Kids().push(p.catalog.Pages().Kids().get(0));
  if(kind==='cycle')p.catalog.Pages().Kids().push(p.catalog.get(PDFName.of('Pages'))!);
  if(kind==='limit')for(let i=1;i<101;i++)p.addPage([10,10]);
  assert.throws(()=>inspectPdfStructure(p),undefined,kind);
 }
 assert.equal(inspectPdfStructure(await PDFDocument.load(bytes)),1);
});

test('production tracing is disabled while explicit test tracing preserves full coverage',async()=>{
 const normal=new OwnedLedger(),traced=new OwnedLedger({trace:true});
 for(const ledger of [normal,traced]){const h=await ledger.allocate('owner','test','binary',8,()=>new Uint8Array(8));ledger.release(h);}
 assert.equal(normal.snapshot().traceMode,'disabled');assert.equal(normal.events.length,0);assert.ok(traced.events.some(e=>e.type==='bind'));assert.equal(traced.snapshot().traceTruncated,false);
});

test('uncancellable allocation remains reserved until settlement and owner cleanup',async()=>{
 const ledger=new OwnedLedger({trace:true});let release!:()=>void;const barrier=new Promise<void>(r=>release=r);
 const pending=ledger.allocate('owner','pending','binary',8,async()=>{await barrier;return new Uint8Array(8);});let settled=false;const waiting=ledger.settleOwner('owner').then(()=>{settled=true;});await Promise.resolve();assert.equal(settled,false);assert.equal(ledger.totals.binary,8);release();await pending;await waiting;ledger.releaseOwner('owner');assert.equal(ledger.totals.binary,0);
});

test('canvas dimensions and resource admission preserve exact bounds without allocation',async()=>{
 const {dimensions,earlyAdmission}=await import('../../src/features/document-redactor/policy.ts');
 assert.deepEqual(dimensions({width:595.28,height:841.89},150/72),{width:1241,height:1754});
 assert.throws(()=>dimensions({width:4097,height:1},1));
 const ledger=new OwnedLedger();
 earlyAdmission({ledger,owner:'early'},dimensions({width:595.28,height:841.89},150/72),true);
 assert.throws(()=>earlyAdmission({ledger,owner:'early'},dimensions({width:595.28,height:841.89},300/72),true));
 assert.deepEqual(ledger.totals,{binary:0,raw:0});
});


test('page mask keys must match canonical numeric page lookup',async()=>{
 const {validatePageMasks}=await import('../../src/features/document-redactor/geometry.ts');
 const rect={x:0,y:0,w:.2,h:.2};
 validatePageMasks({0:[rect],1:[rect]},2);
 for(const key of ['00','01','-0','1.0','1e0',' 0','2','99999999999999999']) assert.throws(()=>validatePageMasks({[key]:[rect]},2),undefined,key);
 assert.throws(()=>validatePageMasks({0:[],1:[]},2));
});
