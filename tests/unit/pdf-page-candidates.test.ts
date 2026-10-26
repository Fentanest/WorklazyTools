import assert from "node:assert/strict";
import test from "node:test";
import { pageFingerprint, pageHashDistance, selectPageCandidates, readCandidateBytes } from "../../src/features/pdf-compare/pageCandidates.ts";
const hash=(seed:number)=>Uint8Array.from({length:128},(_,i)=>((i*41+seed*23)^(i>>2)^seed)&255);
test("page candidates reject missing hashes, max-distance and ambiguous ties",()=>{
  assert.equal(selectPageCandidates([null],[hash(1)]).matches.length,0);
  assert.equal(selectPageCandidates([new Uint8Array(128)],[new Uint8Array(128).fill(255)]).matches.length,0);
  assert.equal(selectPageCandidates([hash(1)],[hash(1),hash(1)]).matches.length,0);
  assert.equal(selectPageCandidates([hash(1),hash(1)],[hash(1)]).matches.length,0);
});
test("only mutual unambiguous best matches reorder pages; every page remains accounted for",()=>{
  const result=selectPageCandidates([hash(1),hash(2),null],[hash(2),null,hash(1)]);
  assert.deepEqual(result.matches,[{before:0,after:2,distance:0},{before:1,after:0,distance:0}]);
  assert.deepEqual(result.unmatchedBefore,[2]);assert.deepEqual(result.unmatchedAfter,[1]);
  assert.deepEqual(result.mapping,[{before:0,after:2},{before:1,after:0},{before:2,after:null},{before:null,after:1}]);
});
test("blank and translucent page pixels are not reliable fingerprints",()=>{
  assert.equal(pageFingerprint(new Uint8ClampedArray(128*128*4).fill(255)),null);
  assert.equal(pageFingerprint(new Uint8ClampedArray(128*128*4)),null);
});
test("low-frequency fingerprint is deterministic and tolerates small brightness changes",()=>{
  const pixels=new Uint8ClampedArray(128*128*4).fill(255),brighter=pixels.slice();
  for(let y=14;y<91;y++)for(let x=23;x<78;x++)for(let c=0;c<3;c++){pixels[(y*128+x)*4+c]=20;brighter[(y*128+x)*4+c]=40;}
  const first=pageFingerprint(pixels)!,second=pageFingerprint(brighter)!;
  assert.equal(first.length,128);assert.deepEqual(first,pageFingerprint(pixels));assert.ok(pageHashDistance(first,second)<32);
});
test("candidate reads reject sizes before reading and settle actual canceled reads",async()=>{
  let reads=0;const signal=new AbortController();
  await assert.rejects(readCandidateBytes({size:33*1024*1024,arrayBuffer:async()=>{reads++;return new ArrayBuffer(0);}},signal.signal),/PAGE_CANDIDATE_LIMIT/);assert.equal(reads,0);
  let release!:(value:ArrayBuffer)=>void,settled=false;
  const pending=readCandidateBytes({size:4,arrayBuffer:()=>new Promise(resolve=>{release=resolve;})},signal.signal);
  pending.finally(()=>{settled=true;}).catch(()=>{});signal.abort();await Promise.resolve();assert.equal(settled,false);
  const bytes=new ArrayBuffer(4);release(bytes);await assert.rejects(pending,{name:"AbortError"});assert.equal(bytes.byteLength,0);
});
