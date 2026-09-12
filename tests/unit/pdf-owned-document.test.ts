import assert from 'node:assert/strict';
import test from 'node:test';
import type {PDFDocumentLoadingTask} from 'pdfjs-dist';
import {settleOwnedPdfLoad} from '../../src/utils/pdfOwnedDocument.ts';
test('owned PDF successful load returns original identity without destroying shared runtime',async()=>{
 let destroyed=0;const document={};const task={promise:Promise.resolve(document),destroy:async()=>{destroyed++;}} as unknown as PDFDocumentLoadingTask;
 assert.equal((await settleOwnedPdfLoad(task)).document,document);assert.equal(destroyed,0);
});
test('owned PDF failure preserves raw error for existing caller normalization and awaits destroy',async()=>{
 const error=Error('synthetic');let destroyed=0;const task={promise:Promise.reject(error),destroy:async()=>{destroyed++;}} as unknown as PDFDocumentLoadingTask;
 await assert.rejects(settleOwnedPdfLoad(task),e=>e===error);assert.equal(destroyed,1);
});
test('owned PDF cancellation cannot settle before loading task destruction',async()=>{
 let finish!:()=>void,started!:()=>void;const destroyStarted=new Promise<void>(r=>started=r),destroyed=new Promise<void>(r=>finish=r);const controller=new AbortController();
 const task={promise:new Promise(()=>{}),destroy:async()=>{started();await destroyed;}} as unknown as PDFDocumentLoadingTask;
 let settled=false;const result=settleOwnedPdfLoad(task,controller.signal).catch(e=>{settled=true;return e;});controller.abort();await destroyStarted;assert.equal(settled,false);finish();assert.equal((await result).name,'AbortError');
});
