import assert from "node:assert/strict";
import test from "node:test";
import { capCvMemory } from "../../src/features/image-compare/cvMemory.ts";
import { compareImages } from "../../src/features/image-compare/client.ts";
import { assertImageBudget, imageMemoryEstimate, CV_INITIAL_MEMORY_BYTES, MAX_REGION_PASSES, disposeImageResult } from "../../src/features/image-compare/memory.ts";
import { workingGeometry } from "../../src/features/image-compare/geometry.ts";
import { DEFAULT_PIXEL_OPTIONS, IDENTITY_TRANSFORM, IMAGE_LIMITS } from "../../src/features/image-compare/types.ts";

test("both file sizes are validated before either arrayBuffer reader runs", async () => {
  const OriginalWorker=globalThis.Worker;let workers=0;
  globalThis.Worker=class { constructor(){workers++;throw new Error("Unexpected Worker");} } as unknown as typeof Worker;
  try { for (const oversizedSide of [0,1]) {
    let reads=0;
    const files=[0,1].map((side)=>({name:"image.png",size:side===oversizedSide?IMAGE_LIMITS.fileBytes+1:1,arrayBuffer:async()=>{reads++;return new ArrayBuffer(1);}})) as unknown as [File,File];
    await assert.rejects(compareImages(files[0],files[1],DEFAULT_PIXEL_OPTIONS,IDENTITY_TRANSFORM,new AbortController().signal,()=>{}),/IMAGE_FILE_LIMIT/);
    assert.equal(reads,0);assert.equal(workers,0);
  } } finally { globalThis.Worker=OriginalWorker; }

});
test("256 MiB reservations include native source decode, RGBA copies, views and actual CV arena", () => {
  assert.equal(IMAGE_LIMITS.memoryBytes,256*1024*1024);
  assert.equal(CV_INITIAL_MEMORY_BYTES,128*1024*1024);
  assert.equal(MAX_REGION_PASSES,3);
  const result=imageMemoryEstimate(2_000_000,1_000_000,2_000_000);
  assert.equal(result.stages.comparison,3*2_000_000+24*2_000_000+48*1_000_000);
  assert.equal(result.cvHeapBytes,CV_INITIAL_MEMORY_BYTES);
  assert.ok(result.stages.regions>result.cvHeapBytes+46*1_000_000);
  assert.ok(assertImageBudget(640*400*2,640*400,10000).estimatedPeakBytes<=IMAGE_LIMITS.memoryBytes);
  assert.throws(()=>assertImageBudget(2*4000*4000,4000*4000,0),/IMAGE_MEMORY_LIMIT/);
  assert.throws(()=>assertImageBudget(12_000_000,10000,0),/IMAGE_MEMORY_LIMIT/); // Small working view cannot hide a huge decoded source.
  assert.throws(()=>assertImageBudget(100,100,2*IMAGE_LIMITS.fileBytes),/IMAGE_MEMORY_LIMIT/);
  assert.throws(()=>imageMemoryEstimate(Number.NaN,1,1),/INVALID_RESOURCE_ESTIMATE/);
});
test("transformed output worst-case is rejected by geometry before any bitmap or canvas exists", () => {
  assert.throws(()=>workingGeometry(1000,1000,1000,1000,{...IDENTITY_TRANSFORM,scale:4}),/IMAGE_MEMORY_LIMIT/);
  assert.throws(()=>workingGeometry(3000,3000,10,10,IDENTITY_TRANSFORM),/IMAGE_MEMORY_LIMIT/);
  assert.equal(workingGeometry(64,48,64,48,IDENTITY_TRANSFORM,1000).width,64);
});

test("CV allocator cannot grow beyond its reservation", () => {
  const memory=capCvMemory(new WebAssembly.Memory({initial:1,maximum:4}),2*65536);
  assert.equal(memory.grow(1),1);assert.equal(memory.buffer.byteLength,2*65536);
  assert.throws(()=>memory.grow(1),/REGION_MEMORY_LIMIT/);assert.equal(memory.buffer.byteLength,2*65536);
});

test("known encoded-only overflow is rejected before reading either otherwise size-valid file", async () => {
  let reads=0;const file={name:"image.png",size:IMAGE_LIMITS.fileBytes,arrayBuffer:async()=>{reads++;return new ArrayBuffer(1);}} as unknown as File;
  await assert.rejects(compareImages(file,file,DEFAULT_PIXEL_OPTIONS,IDENTITY_TRANSFORM,new AbortController().signal,()=>{}),/IMAGE_MEMORY_LIMIT/);assert.equal(reads,0);
});

test("disposed previous results detach every owned working buffer without changing source bytes", () => {
  const source=new Uint8Array([1,2,3,4]);
  const fields=["left","right","leftValid","rightValid","changedMask","channelDelta","overlay","subtract"];
  const result=Object.fromEntries(fields.map(key=>[key,source.slice()]));
  disposeImageResult(result as never);assert.ok(fields.every(key=>result[key].byteLength===0));assert.deepEqual([...source],[1,2,3,4]);
  disposeImageResult(result as never); // Idempotent after abort/unmount.
  assert.equal(imageMemoryEstimate(1,1,1,123).stages.comparison,imageMemoryEstimate(1,1,1).stages.comparison+123);
});

test("already canceled input is rejected before any read", async () => {
  const controller=new AbortController();controller.abort();let reads=0;
  const file={name:"image.png",size:1,arrayBuffer:async()=>{reads++;return new ArrayBuffer(1);}} as unknown as File;
  await assert.rejects(compareImages(file,file,DEFAULT_PIXEL_OPTIONS,IDENTITY_TRANSFORM,controller.signal,()=>{}),{name:"AbortError"});assert.equal(reads,0);
});
