import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRgba } from '../src/features/image-compare/kernel.ts';
import { DEFAULT_PIXEL_OPTIONS, IDENTITY_TRANSFORM } from '../src/features/image-compare/types.ts';
import { imageMemoryEstimate } from '../src/features/image-compare/memory.ts';
import { compactImageResult } from '../src/features/folder-compare/imageProjection.ts';
import { DeepSession } from '../src/features/folder-compare/deep.ts';
function actual(removed = false) {
  let left = new Uint8ClampedArray([20,30,40,255,0,0,0,0]), right = new Uint8ClampedArray([20,30,40,255,20,30,40,255]);
  let leftValid = new Uint8Array([1,0]), rightValid = new Uint8Array([1,1]);
  if (removed) { [left,right]=[right,left]; [leftValid,rightValid]=[rightValid,leftValid]; }
  const source = { bytes:8,mime:'image/png',height:1,bitDepth:8,exifOrientation:1,decodeOrientation:'from-image',workingColorSpace:'8-bit sRGB' };
  return { ...compareRgba(left,right,2,1,leftValid,rightValid,DEFAULT_PIXEL_OPTIONS), left,right,leftValid,rightValid,width:2,height:1,
    quality:{mode:'full-resolution',scale:1,resources:imageMemoryEstimate(3,2,16)}, sources:{left:{...source,name:'left',width:removed?2:1},right:{...source,name:'right',width:removed?1:2}},
    runId:'actual',engine:'pixelmatch-7.1.0-rgba-v1',options:DEFAULT_PIXEL_OPTIONS,geometry:{originX:0,originY:0,leftMatrix:[1,0,0,1,0,0],rightMatrix:[1,0,0,1,0,0],rightTransform:IDENTITY_TRANSFORM} };
}
const buffers = result => ['left','right','leftValid','rightValid','changedMask','channelDelta','overlay','subtract'].map(key => result[key].buffer);
test('actual equal-overlap kernel preserves added coverage and retires all eight buffers', async () => {
  const result = actual(), owned = buffers(result); const sourceFile = new File([result.left], 'source.png'); const before = await sourceFile.arrayBuffer();
  const projected = compactImageResult(result);
  assert.equal(projected.changedPixelCount,0); assert.equal(projected.differenceRatio,0); assert.equal(projected.comparablePixelCount,1);
  assert.equal(projected.addedBoundaryPixelCount,1); assert.equal(projected.removedBoundaryPixelCount,0);
  assert.equal(projected.sources.left.width,1); assert.equal(projected.sources.right.width,2); assert.equal(projected.quality.mode,'full-resolution');
  assert.deepEqual(owned.map(b => b.byteLength), Array(8).fill(0)); assert.equal('left' in projected,false);
  assert.deepEqual(await sourceFile.arrayBuffer(),before); assert.deepEqual(structuredClone(projected),projected);
});
test('projection error and canceled completion both retire successful engine buffers', () => {
  const bad = actual(), badBuffers = buffers(bad); Object.defineProperty(bad,'quality',{get(){throw new Error('projection failed');}});
  assert.throws(() => compactImageResult(bad),/projection failed/); assert(badBuffers.every(b => b.byteLength===0));
  const canceled = actual(), canceledBuffers = buffers(canceled), control = new AbortController(); control.abort();
  assert.throws(() => compactImageResult(canceled,control.signal),{name:'AbortError'}); assert(canceledBuffers.every(b=>b.byteLength===0));
});
test('serial consumer starts only after preceding projection explicitly detaches ownership', async () => {
  const session = new DeepSession(), result = actual(), owned = buffers(result);
  await session.run(async s => compactImageResult(result,s));
  await session.run(async () => { assert(owned.every(b=>b.byteLength===0)); }); await session.clear();
});

test('reverse unequal coverage preserves removed pixels instead of treating zero overlap changes as equality', () => {
  const result=actual(true), owned=buffers(result), projected=compactImageResult(result);
  assert.equal(projected.changedPixelCount,0);assert.equal(projected.comparablePixelCount,1);assert.equal(projected.addedBoundaryPixelCount,0);assert.equal(projected.removedBoundaryPixelCount,1);
  assert.equal(projected.sources.left.width,2);assert.equal(projected.sources.right.width,1);assert(owned.every(b=>b.byteLength===0));
});
test('compact result keeps bounded previews where a lone changed pixel survives downscaling', async () => {
  const { imagePreview, IMAGE_PREVIEW_SIDE } = await import('../src/features/folder-compare/imageProjection.ts');
  const width = 2000, height = 1000, left = new Uint8ClampedArray(width * height * 4).fill(255), right = left.slice();
  right.set([0, 0, 0, 255], (500 * width + 1234) * 4);
  const valid = new Uint8Array(width * height).fill(1);
  const result = { ...compareRgba(left, right, width, height, valid, valid, DEFAULT_PIXEL_OPTIONS), left, right, width, height };
  const preview = imagePreview(result);
  assert.deepEqual([preview.width, preview.height], [IMAGE_PREVIEW_SIDE, 400]);
  assert.equal(preview.highlight.length, preview.width * preview.height * 4);
  const colored = []; for (let i = 0; i < preview.highlight.length; i += 4) if (preview.highlight[i + 3] === 255) colored.push(i / 4);
  assert.equal(colored.length, 1);
  assert.deepEqual([colored[0] % preview.width, Math.floor(colored[0] / preview.width)], [Math.floor(1234 * 0.4), 200]);
  // Small images keep full size.
  assert.deepEqual([imagePreview(actual()).width, imagePreview(actual()).height], [2, 1]);
});
