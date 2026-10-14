import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'image-worker-test-'));
const target=path.join(dir,'worker.mjs');
buildSync({stdin:{contents:'export { PDFDocument } from "pdf-lib"; import "./src/features/pdf-editor/pdf.worker.ts";',resolveDir:process.cwd(),loader:'ts'},outfile:target,bundle:true,platform:'node',format:'esm',logLevel:'silent'});
const messages: any[]=[];
const previous=(globalThis as any).self;
const worker={postMessage:(message:any)=>messages.push(message),onmessage:null as any};
(globalThis as any).self=worker;
const {PDFDocument}=await import(pathToFileURL(target).href);
test.after(()=>{(globalThis as any).self=previous;fs.rmSync(dir,{recursive:true,force:true});});
const input={id:'stable-id',name:'example.jpg',buffer:new Uint8Array([255,216,255,224]).buffer};
test('image embed failure retains file ID, stage and original error name through worker envelope',async()=>{
 const create=PDFDocument.create;PDFDocument.create=async()=>({embedJpg:async()=>{throw new DOMException('injected','EncodingError');}});
 try{await worker.onmessage({data:{type:'images-to-pdf',inputs:[input],pageMode:'a4',fileName:'x',language:'ko'}});
  const error=messages.at(-1).error;assert.equal(error.stage,'embed');assert.equal(error.imageId,'stable-id');assert.equal(error.errorName,'EncodingError');assert.equal(error.code,'INVALID_IMAGE');
  assert.ok(error.message.includes('example.jpg'));assert.ok(error.message.includes('pdf.imageInput.embedFailure'));
 }finally{PDFDocument.create=create;}
});
test('PDF save failure is distinct from a per-file decode/embed failure',async()=>{
 const create=PDFDocument.create;PDFDocument.create=async()=>({embedJpg:async()=>({width:80,height:60}),addPage:()=>({drawImage:()=>{}}),save:async()=>{throw new RangeError('injected allocation failure');}});
 try{await worker.onmessage({data:{type:'images-to-pdf',inputs:[input],pageMode:'image',fileName:'x'}});
  const error=messages.at(-1).error;assert.equal(error.stage,'save');assert.equal(error.imageId,undefined);assert.equal(error.errorName,'RangeError');assert.equal(error.code,'PDF_SAVE_FAILED');
 }finally{PDFDocument.create=create;}
});
