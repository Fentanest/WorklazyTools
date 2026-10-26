import test from 'node:test';
import assert from 'node:assert/strict';
import { FolderRun } from '../src/features/folder-compare/core.ts';
import { FolderOwner } from '../src/features/folder-compare/owner.ts';
const zero = {id:'zero',rawPath:'zero',size:0,directory:false,open(){const reader=new ReadableStream({start(c){c.close();}}).getReader();return {reader,done:Promise.resolve(),close:async()=>{await reader.cancel();reader.releaseLock();}};}};
test('50k zero-byte rows publish deltas without per-file full-array copies', async t => {
  const count=50000; let iterated=0,updates=0,final=false;
  const values=Array.from({length:count},(_,i)=>({key:String(i),left:[zero],right:[zero],pairing:'matched',content:'pending',integrity:'pending'}));
  const rows=new Proxy(values,{get(target,key,receiver){if(key===Symbol.iterator)return function*(){for(const row of target){iterated++;yield row;}};return Reflect.get(target,key,receiver);}});
  const start=performance.now(); await new FolderRun().compare(rows,(changed,complete)=>{updates++;if(complete){final=true;assert.equal(changed,undefined);}else assert.equal(changed.content,'equal');});
  assert.equal(iterated,count);assert.equal(updates,count+1);assert(final);assert(values.every(r=>r.content==='equal'));
  t.diagnostic(JSON.stringify({rows:count,iterated,updates,durationMs:performance.now()-start}));
});
test('real owner admits 50k empty File inputs with throttling before full snapshot maps', async t => {
  const files=Array.from({length:25000},(_,i)=>new File([],`file-${i}`)); const owner=new FolderOwner();
  let snapshots=0,last,largeMaps=0;const map=Array.prototype.map;const start=performance.now();
  Array.prototype.map=function(...args){if(this.length===25000)largeMaps++;return Reflect.apply(map,this,args);};
  try { await owner.compare(1,{kind:'files',files},{kind:'files',files},{},view=>{snapshots++;last=view;}); }
  finally {Array.prototype.map=map;await owner.clear(2);}
  assert.equal(last.phase,'done');assert.equal(last.rows.length,25000);assert.equal(last.completed,25000);assert(last.rows.every(r=>r.content==='equal'));
  assert(largeMaps<=snapshots+5,`full maps ${largeMaps} exceed emitted snapshots ${snapshots}`);
  t.diagnostic(JSON.stringify({inputs:50000,rows:last.rows.length,snapshots,largeMaps,durationMs:performance.now()-start}));
});
