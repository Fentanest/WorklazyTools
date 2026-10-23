import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {mkdtemp,readFile,writeFile,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {alignWithCv} from '../../src/features/image-compare/alignment.ts';
import {validateAlignment} from '../../src/features/image-compare/alignmentPolicy.ts';
import {projectiveGeometry,projectPoint,invertProjective,warpRgba,IDENTITY_PROJECTIVE} from '../../src/features/image-compare/projective.ts';
import {assertAlignmentBudget} from '../../src/features/image-compare/memory.ts';
import type {Matrix3,AlignmentMatch} from '../../src/features/image-compare/alignmentTypes.ts';
function texture(seed:number,width=640,height=400){let value=seed;const rgba=new Uint8ClampedArray(width*height*4);for(let i=0;i<width*height;i++){value=(Math.imul(value,1664525)+1013904223)>>>0;const c=value>>>24;rgba.set([c,c,c,255],i*4);}return {rgba,width,height};}
const points:AlignmentMatch[]=Array.from({length:16},(_,i)=>({source:{x:40+(i%4)*150,y:40+Math.floor(i/4)*90},target:{x:40+(i%4)*150,y:40+Math.floor(i/4)*90}}));
test('independent gates reject holdout false matches, concentrated features, folding and empty overlap',()=>{
  assert.ok(validateAlignment(IDENTITY_PROJECTIVE,points,points.slice(0,4),{lw:640,lh:400,rw:640,rh:400}).overlapRatio>.99);
  assert.throws(()=>validateAlignment(IDENTITY_PROJECTIVE,points,points.slice(0,4).map(p=>({...p,target:{x:p.target.x+20,y:p.target.y}})),{lw:640,lh:400,rw:640,rh:400}),/HOLDOUT/);
  assert.throws(()=>validateAlignment(IDENTITY_PROJECTIVE,points.slice(0,4),points.slice(0,4),{lw:640,lh:400,rw:640,rh:400}),/DISTRIBUTION/);
  assert.throws(()=>projectiveGeometry(640,400,640,400,[-1,0,640,0,1,0,0,0,1]),/GEOMETRY/);
  assert.throws(()=>assertAlignmentBudget(2_000_000,0,100*1024*1024),/MEMORY_LIMIT/);
});
test('CPU projective rendering samples original RGBA, keeps coverage distinct and inverse coordinates',()=>{
  const m:Matrix3=[1,0,1,0,1,0,0,0,1],source=new Uint8ClampedArray([255,0,0,128,0,255,0,255]);
  const result=warpRgba(source,2,1,3,1,m);assert.deepEqual([...result.valid],[0,1,1]);assert.deepEqual([...result.rgba.slice(4,8)],[255,0,0,128]);assert.deepEqual([...source],[255,0,0,128,0,255,0,255]);assert.deepEqual(projectPoint(invertProjective(m),{x:2,y:0}),{x:1,y:0});
});
test('actual CV ORB/RANSAC aligns translated synthetic originals; blank and unrelated frames reject',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'alignment-cv-'));
 try{const base=path.resolve('vendor/comparison/opencv/4.13.0-dev');await writeFile(path.join(directory,'cv.cjs'),await readFile(path.join(base,'opencv.js')));await copyFile(path.join(base,'opencv_js.wasm'),path.join(directory,'opencv_js.wasm'));const cv=await createRequire(import.meta.url)(path.join(directory,'cv.cjs'));
  const left=texture(7),right={...left,rgba:new Uint8ClampedArray(left.rgba.length).fill(255)};
  for(let y=0;y<left.height;y++)for(let x=0;x<left.width;x++){const sx=x-8,sy=y+5;if(sx>=0&&sy<left.height)right.rgba.set(left.rgba.subarray((sy*left.width+sx)*4,(sy*left.width+sx)*4+4),(y*left.width+x)*4);}
  for(const mode of ['affine','homography'] as const){const candidate=alignWithCv(cv,left,right,mode,'revision-1');assert.equal(candidate.sourceRevision,'revision-1');assert.ok(Math.abs(candidate.matrix[2]+8)<1.5);assert.ok(Math.abs(candidate.matrix[5]-5)<1.5);assert.ok(candidate.holdoutMedianError<1.5);assert.ok(candidate.inliers>=8);}
  const rois={left:{x:80,y:60,width:480,height:280},right:{x:88,y:55,width:480,height:280}};
  for(const mode of ['affine','homography'] as const){const candidate=alignWithCv(cv,left,right,mode,'roi',0,rois);assert.equal(candidate.coverageReference,'feature-roi');assert.deepEqual(candidate.featureRois,rois);assert.ok(Math.abs(candidate.matrix[2]+8)<1.5&&Math.abs(candidate.matrix[5]-5)<1.5);assert.ok(candidate.holdoutSourceCoverage!>=.12&&candidate.holdoutTargetCoverage!>=.12);}
  assert.throws(()=>alignWithCv(cv,left,right,'affine','outside',0,{left:{x:600,y:0,width:80,height:100}}),/ALIGNMENT_ROI/);
  const blankRoi={...left,rgba:left.rgba.slice()};for(let y=0;y<100;y++)for(let x=0;x<100;x++)blankRoi.rgba.set([255,255,255,255],(y*640+x)*4);assert.throws(()=>alignWithCv(cv,blankRoi,blankRoi,'affine','blank-roi',0,{left:{x:0,y:0,width:80,height:80},right:{x:0,y:0,width:80,height:80}}),/ALIGNMENT_/);
  const perspective:Matrix3=[1,0,0,0,1,0,.00006,-.00002,1],perspectiveFrame={...left,rgba:warpRgba(left.rgba,640,400,640,400,perspective).rgba};
  const perspectiveFit=alignWithCv(cv,left,perspectiveFrame,'homography','perspective'),probe={x:200,y:150},expected=projectPoint(invertProjective(perspective),probe),actual=projectPoint(perspectiveFit.matrix,probe);assert.ok(Math.hypot(actual.x-expected.x,actual.y-expected.y)<2);
  const grid={...left,rgba:new Uint8ClampedArray(left.rgba.length)};for(let y=0;y<400;y++)for(let x=0;x<640;x++){const c=(Math.floor(x/20)+Math.floor(y/20))%2?255:0;grid.rgba.set([c,c,c,255],(y*640+x)*4);}assert.throws(()=>alignWithCv(cv,grid,grid,'homography','repeat'),/ALIGNMENT_/);
  const mirror={...left,rgba:new Uint8ClampedArray(left.rgba.length)};for(let y=0;y<400;y++)for(let x=0;x<640;x++)mirror.rgba.set(left.rgba.subarray((y*640+639-x)*4,(y*640+639-x)*4+4),(y*640+x)*4);assert.throws(()=>alignWithCv(cv,left,mirror,'affine','mirror'),/ALIGNMENT_/);
  const negative={...left,rgba:Uint8ClampedArray.from(left.rgba,(v,i)=>i%4===3?v:255-v)};assert.equal(alignWithCv(cv,left,negative,'affine','negative').inverted,true);
  const blank={...left,rgba:new Uint8ClampedArray(left.rgba.length).fill(255)};assert.throws(()=>alignWithCv(cv,blank,blank,'affine','blank'),/ALIGNMENT_/);assert.throws(()=>alignWithCv(cv,left,texture(9),'homography','unrelated'),/ALIGNMENT_/);
 }finally{await rm(directory,{recursive:true,force:true});}
});
