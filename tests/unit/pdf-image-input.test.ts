import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectImage, ownImage, ImageInputError } from '../../src/features/pdf-editor/imageInput.ts';
function jpeg(orientation?: number, little = true, components = 3) {
  const exif = Buffer.alloc(32); exif.write('Exif\0\0'); exif.write(little ? 'II' : 'MM',6);
  const u16=(n:number,p:number)=>little?exif.writeUInt16LE(n,p):exif.writeUInt16BE(n,p);
  const u32=(n:number,p:number)=>little?exif.writeUInt32LE(n,p):exif.writeUInt32BE(n,p);
  u16(42,8);u32(8,10);u16(1,14);u16(274,16);u16(3,18);u32(1,20);u16(orientation??1,24);
  const app = orientation === undefined ? Buffer.alloc(0) : Buffer.concat([Buffer.from([255,225,0,34]),exif]);
  const frame=Buffer.from([255,192,0,8+components*3,8,0,60,0,80,components,...Array(components*3).fill(1)]);
  const b=Buffer.concat([Buffer.from([255,216]),app,frame,Buffer.from([255,218,0,2,1,255,217])]);
  return b.buffer.slice(b.byteOffset,b.byteOffset+b.length);
}
test('JPEG orientation absent and 1 preserve bytes; 2–8 normalize, both byte orders',()=>{
  assert.equal(inspectImage(jpeg()).directJpeg,true);
  for(const little of [true,false])for(let o=1;o<=8;o++){
    const m=inspectImage(jpeg(o,little));assert.equal(m.orientation,o);assert.equal(m.directJpeg,o===1);
  }
});
test('invalid EXIF offsets, values, duplicates and colour transforms never direct embed',()=>{
  for(const o of [0,9,65535])assert.equal(inspectImage(jpeg(o)).directJpeg,false);
  const bad=jpeg(1);new DataView(bad).setUint32(16,0xffffffff,true);
  assert.equal(inspectImage(bad).malformedExif,true);
  assert.equal(inspectImage(jpeg(1,true,4)).directJpeg,false);
  const b=new Uint8Array(jpeg()), c=new Uint8Array(b.length+4);c.set(b.subarray(0,2));c.set([255,226,0,2],2);c.set(b.subarray(2),6);
  assert.equal(inspectImage(c.buffer).directJpeg,false);
});
test('truncation, empty, wrong signature and marker length rejected without range escapes',()=>{
  const b=jpeg(1);
  for(let n=0;n<b.byteLength-2;n++) assert.throws(()=>inspectImage(b.slice(0,n)),ImageInputError);
  assert.throws(()=>inspectImage(new Uint8Array([1,2,3]).buffer),ImageInputError);
});
test('ownership reads bytes once, preserves metadata, ignores misleading MIME and does not depend on source',async()=>{
  const b=jpeg(1);const source=new File([b],'same.png',{type:'image/png',lastModified:123});
  let reads=0;source.arrayBuffer=async()=>{reads++;return b;};
  const {file}=await ownImage(source); source.arrayBuffer=async()=>{throw new DOMException('provider expired','NotReadableError');};
  assert.equal(reads,1);assert.equal(file.name,'same.png');assert.equal(file.lastModified,123);assert.equal(file.type,'image/jpeg');
  assert.deepEqual(await file.arrayBuffer(),b);
});
test('read failure keeps original error and stage; aborted acquisition never returns an owned file',async()=>{
  const f=new File([],'bad.jpg');f.arrayBuffer=async()=>{throw new DOMException('unavailable','NotReadableError');};
  await assert.rejects(ownImage(f),(e:ImageInputError)=>e.stage==='read' && (e.cause as Error).name==='NotReadableError');
  const c=new AbortController();let release!:(b:ArrayBuffer)=>void;
  f.arrayBuffer=()=>new Promise(r=>{release=r;});const job=ownImage(f,c.signal);c.abort();release(jpeg());
  await assert.rejects(job,{name:'AbortError'});
});
test('PNG signature controls type and dimensions even when MIME is empty',async()=>{
  const b=new Uint8Array(33);b.set([137,80,78,71,13,10,26,10]);const v=new DataView(b.buffer);v.setUint32(8,13);v.setUint32(12,0x49484452);v.setUint32(16,80);v.setUint32(20,60);
  const {file,metadata}=await ownImage(new File([b],'x.jpg'));
  assert.equal(file.type,'image/png');assert.equal(metadata.width,80);assert.equal(metadata.directJpeg,false);
});
