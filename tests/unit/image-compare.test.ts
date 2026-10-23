import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { mkdtemp, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { compareRgba } from "../../src/features/image-compare/kernel.ts";
import { workingGeometry, transformMatrix, inverseMatrix, applyMatrix, validateDimensions, sourcePolygon } from "../../src/features/image-compare/geometry.ts";
import { inspectImageHeader } from "../../src/features/image-compare/input.ts";
import { detectRegions, type RegionCv } from "../../src/features/image-compare/regions.ts";
import { DEFAULT_PIXEL_OPTIONS, DEFAULT_REGION_OPTIONS, IDENTITY_TRANSFORM } from "../../src/features/image-compare/types.ts";
const rgba = (...values: number[]) => Uint8ClampedArray.from(values);
const compare = (a: Uint8ClampedArray, b: Uint8ClampedArray) => compareRgba(a, b, a.length / 4, 1, new Uint8Array(a.length / 4).fill(1), new Uint8Array(a.length / 4).fill(1), DEFAULT_PIXEL_OPTIONS);

test("RGBA comparison separates alpha changes and ignores fully transparent hidden RGB", () => {
  assert.equal(compare(rgba(255,0,0,0), rgba(0,255,0,0)).changedPixelCount, 0);
  assert.equal(compare(rgba(20,30,40,0), rgba(20,30,40,1)).changedPixelCount, 1);
  assert.equal(compare(rgba(0,0,0,255), rgba(255,0,0,255)).changedPixelCount, 1);
  const a = rgba(2,3,4,255), b = a.slice(); compare(a,b); assert.deepEqual(a,b);
  assert.throws(() => compareRgba(a,b,1,1,new Uint8Array([1]),new Uint8Array([1]),{ ...DEFAULT_PIXEL_OPTIONS, threshold: 2 }), /INVALID_THRESHOLD/);
});
test("valid coverage defines denominator and counts added/removed boundaries separately", () => {
  const a = rgba(0,0,0,255,0,0,0,255,0,0,0,255), b = a.slice();
  const result = compareRgba(a,b,3,1,new Uint8Array([1,1,0]),new Uint8Array([1,0,1]),DEFAULT_PIXEL_OPTIONS);
  assert.equal(result.comparablePixelCount,1); assert.equal(result.addedBoundaryPixelCount,1); assert.equal(result.removedBoundaryPixelCount,1); assert.equal(result.changedPixelCount,0);
});
test("manual geometry is reversible, bounded and always expressed against source coordinates", () => {
  const matrix = transformMatrix(100,80,{ ...IDENTITY_TRANSFORM, x: -3, degrees: 37, flipX: true, scale: 1.2 });
  const transformed = applyMatrix(matrix,4,7), original = applyMatrix(inverseMatrix(matrix),transformed.x,transformed.y);
  assert.ok(Math.abs(original.x-4)<1e-10 && Math.abs(original.y-7)<1e-10);
  assert.deepEqual(workingGeometry(10,10,10,10,IDENTITY_TRANSFORM),{ width:10,height:10,originX:0,originY:0,leftMatrix:[1,0,0,1,0,0],rightMatrix:[1,0,0,1,0,0] });
  assert.deepEqual(sourcePolygon([1,0,0,1,3,4],{ x:7,y:11,width:2,height:3 }),[{x:4,y:7},{x:6,y:7},{x:6,y:10},{x:4,y:10}]);
  assert.equal(workingGeometry(10,10,10,10,{ ...IDENTITY_TRANSFORM,degrees:90 }).width,10);
  assert.throws(() => validateDimensions(100000,100000),/IMAGE_SIZE_LIMIT/);
  assert.throws(() => inverseMatrix([0,0,0,0,0,0]),/INVALID_TRANSFORM/);
  assert.throws(() => workingGeometry(10,10,10,10,{ ...IDENTITY_TRANSFORM, x:1e9 }),/IMAGE_SIZE_LIMIT/);
});
test("headers reject disguised containers and bound PNG decode before allocation", () => {
  const buffer = new ArrayBuffer(33), bytes = new Uint8Array(buffer), view = new DataView(buffer);
  bytes.set([137,80,78,71,13,10,26,10]); view.setUint32(8,13); view.setUint32(12,0x49484452); view.setUint32(16,32); view.setUint32(20,20); bytes[24]=16;
  const metadata = inspectImageHeader("sample.png",buffer); assert.equal(metadata.bitDepth,16); assert.equal(metadata.width,32);
  view.setUint32(16,100000); assert.throws(() => inspectImageHeader("sample.png",buffer),/IMAGE_SIZE_LIMIT/);
  assert.throws(() => inspectImageHeader("fake.png",new TextEncoder().encode("<svg/>").buffer),/IMAGE_FORMAT_UNSUPPORTED/);
});
test("actual bundled OpenCV preserves sparse-pixel bbox/count distinction and bounded oversize", async () => {
  const directory = await mkdtemp(path.join(tmpdir(),"image-regions-cv-"));
  try {
    const base = path.resolve("vendor/comparison/opencv/4.13.0-dev");
    await writeFile(path.join(directory,"opencv.cjs"),await readFile(path.join(base,"opencv.js")));
    await copyFile(path.join(base,"opencv_js.wasm"),path.join(directory,"opencv_js.wasm"));
    const cv = await createRequire(import.meta.url)(path.join(directory,"opencv.cjs")) as RegionCv;
    const sparse = new Uint8Array(900); sparse[14*30+8]=255; sparse[14*30+18]=255;
    const pass = detectRegions(cv,sparse,30,30,{ ...DEFAULT_REGION_OPTIONS, minArea:0,maxAreaFraction:1 },"scan-A");
    assert.equal(pass.rawChangedPixelCount,2); assert.equal(pass.regions.length,1); assert.equal(pass.regions[0].bboxArea,375); assert.equal(pass.regions[0].changedPixelCount,2);
    const split = detectRegions(cv,sparse,30,30,DEFAULT_REGION_OPTIONS,"scan-split"); assert.equal(split.regions.length,2); assert.ok(split.regions.every((region) => region.bboxArea === 81 && region.changedPixelCount === 1 && region.satisfiedMaxArea));
    const solid = new Uint8Array(900).fill(255);
    const oversize = detectRegions(cv,solid,30,30,{ ...DEFAULT_REGION_OPTIONS,minArea:0,maxAreaFraction:0.01 },"scan-B");
    assert.equal(oversize.regions[0].satisfiedMaxArea,false); assert.equal(oversize.regions[0].changedPixelCount,900);
    assert.equal(pass.regions[0].sourcePassId,"scan-A"); assert.equal(pass.regions[0].bboxArea,375);
  } finally { await rm(directory,{recursive:true,force:true}); }
});
