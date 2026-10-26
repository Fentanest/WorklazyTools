import {effectiveRegionOptions} from '../../src/features/image-compare/regionOptions.ts';
import assert from 'node:assert/strict';import test from 'node:test';
import {workingGeometry,applyMatrix,inverseMatrix,sourcePolygon} from '../../src/features/image-compare/geometry.ts';
import {projectiveGeometry,projectPoint,invertProjective,IDENTITY_PROJECTIVE} from '../../src/features/image-compare/projective.ts';
import {selectWorkingResolution,imageMemoryEstimate} from '../../src/features/image-compare/memory.ts';
import {IDENTITY_TRANSFORM,IMAGE_LIMITS} from '../../src/features/image-compare/types.ts';
test('HD to UHD use full resolution; larger photos use admitted reduced working pixels, original decode overflow rejects',()=>{
 for(const [w,h] of [[1280,720],[1920,1080],[2560,1440],[3840,2160],[5600,4000]]){const g=workingGeometry(w,h,w,h,IDENTITY_TRANSFORM,10000);assert.ok(g.scale>0&&g.scale<=1);assert.equal(g.originalWidth,w);assert.equal(g.originalHeight,h);assert.equal(g.width,Math.ceil(w*g.scale));assert.ok(imageMemoryEstimate(w*h*2,g.width*g.height,10000).estimatedPeakBytes<=IMAGE_LIMITS.memoryBytes);if(w<=3840)assert.equal(g.scale,1);else assert.ok(g.scale<1);}
 assert.throws(()=>selectWorkingResolution(70_000_000,1,1,0),/MEMORY_LIMIT/);
});
test('scaled affine and projective matrices retain decoded-original authority and source polygons',()=>{
 const g=workingGeometry(1920,1080,1920,1080,{...IDENTITY_TRANSFORM,x:80,y:-20});const source={x:123,y:456},working=applyMatrix(g.rightMatrix,source.x,source.y),back=applyMatrix(inverseMatrix(g.rightMatrix),working.x,working.y);assert.ok(Math.abs(back.x-source.x)<1e-8&&Math.abs(back.y-source.y)<1e-8);
 const corner=sourcePolygon(g.leftMatrix,{x:g.leftMatrix[4],y:g.leftMatrix[5],width:10*g.scale,height:10*g.scale});assert.ok(Math.abs(corner[2].x-10)<1e-8);
 const m=[1,.01,20,.005,1,30,.00001,0,1] as typeof IDENTITY_PROJECTIVE,p=projectiveGeometry(5600,4000,5600,4000,m),q=projectPoint(p.rightProjective,source),b=projectPoint(invertProjective(p.rightProjective),q);assert.ok(p.scale<1);assert.ok(Math.abs(b.x-source.x)<1e-8&&Math.abs(b.y-source.y)<1e-8);
});

test('original-unit region requests scale radius linearly and area quadratically; scale1 remains exact',()=>{
 const options={diffThreshold:20,groupingRadius:7,minArea:53.4,maxAreaFraction:.15};assert.deepEqual(effectiveRegionOptions(options,1),options);assert.deepEqual(effectiveRegionOptions(options,.5),{...options,groupingRadius:4,minArea:13});assert.equal(options.minArea,53.4);
 assert.deepEqual(effectiveRegionOptions({...options,groupingRadius:0,minArea:0},.1),{...options,groupingRadius:0,minArea:0});assert.equal(effectiveRegionOptions({...options,groupingRadius:1,minArea:.1},.1).minArea,1);
 assert.throws(()=>effectiveRegionOptions({...options,groupingRadius:-.1},.1),/INVALID_REGION_OPTIONS/);assert.throws(()=>effectiveRegionOptions({...options,minArea:-1},.1),/INVALID_REGION_OPTIONS/);
});
