import test from'node:test';import assert from'node:assert/strict';
import{compareImages,proposeAlignment}from'../src/features/image-compare/client.ts';import{DEFAULT_PIXEL_OPTIONS,IDENTITY_TRANSFORM,IMAGE_LIMITS}from'../src/features/image-compare/types.ts';
const tick=()=>new Promise(resolve=>setImmediate(resolve));const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const file=read=>({name:'input.png',size:32,arrayBuffer:read});
const paths={compare:(a,b,signal)=>compareImages(a,b,DEFAULT_PIXEL_OPTIONS,IDENTITY_TRANSFORM,signal,()=>{}),alignment:(a,b,signal)=>proposeAlignment(a,b,'affine','read-test',0,signal,()=>{})};
for(const[name,run]of Object.entries(paths)){
 for(const failedSide of [0,1])test(`${name}: first read error waits for delayed sibling and disposes its late buffer before retry`,async()=>{
  const hold=deferred(),first=new DOMException('cannot read','NotReadableError'),late=new ArrayBuffer(32);let settled=false,reads=0,retryReads=0;
  const files=[0,1].map(side=>file(()=>{reads++;return side===failedSide?Promise.reject(first):hold.promise;}));
  const task=run(...files,new AbortController().signal);const observed=task.then(()=>{settled=true;throw Error('unexpected success');},error=>{settled=true;assert.equal(error,first);});
  const retry=observed.then(async()=>{const retryError=new Error('retry read');await assert.rejects(run(file(()=>{retryReads++;assert.equal(late.byteLength,0);return Promise.reject(retryError);}),file(()=>{retryReads++;return Promise.resolve(new ArrayBuffer(1));}),new AbortController().signal),error=>error===retryError);});
  await tick();assert.equal(reads,2);assert.equal(settled,false);assert.equal(retryReads,0);hold.resolve(late);await retry;assert(settled);assert.equal(late.byteLength,0);assert.equal(retryReads,2);
 });
 test(`${name}: aborted read waits for both native reads, discards both and gates queued retry`,async()=>{
  const a=deferred(),b=deferred(),abort=new AbortController(),buffers=[new ArrayBuffer(32),new ArrayBuffer(32)];let settled=false,retried=false;
  const task=run(file(()=>a.promise),file(()=>b.promise),abort.signal);const observed=assert.rejects(task,error=>error.name==='AbortError').then(()=>{settled=true;});const queued=observed.then(()=>{retried=true;assert(buffers.every(buffer=>buffer.byteLength===0));});
  abort.abort();a.resolve(buffers[0]);await tick();assert.equal(settled,false);assert.equal(retried,false);b.resolve(buffers[1]);await queued;assert(settled&&retried);
 });
 test(`${name}: temporal first error survives sibling rejection and abort; fulfilled sibling is discarded`,async()=>{
  const a=deferred(),b=deferred(),abort=new AbortController(),first=new Error('right first'),second=new Error('left second');const task=run(file(()=>a.promise),file(()=>b.promise),abort.signal);const checked=assert.rejects(task,error=>error===first);b.reject(first);await tick();abort.abort();a.reject(second);await checked;
  const buffer=new ArrayBuffer(32),error=new Error('synchronous read failure');await assert.rejects(run(file(()=>buffer),file(()=>{throw error;}),new AbortController().signal),caught=>caught===error);assert.equal(buffer.byteLength,0);
 });
 test(`${name}: both-file size and existing-abort admission still precede every read`,async()=>{let reads=0;const a=file(()=>{reads++;return new ArrayBuffer(1);}),b={...a,size:IMAGE_LIMITS.fileBytes+1};await assert.rejects(run(a,b,new AbortController().signal),/IMAGE_FILE_LIMIT/);const abort=new AbortController();abort.abort();await assert.rejects(run(a,a,abort.signal),error=>error.name==='AbortError');assert.equal(reads,0);});
}
