import {snapshotFeatureRois} from "./alignmentRoi.ts";
import type { AlignmentCandidate, AlignmentMatch, Matrix3, AlignmentFeatureRois } from "./alignmentTypes.ts";
import { validateAlignment } from "./alignmentPolicy.ts";
// Native OpenCV binding boundary; every returned object with native ownership is deleted below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AlignmentCv=Record<string,any>;
export function alignWithCv(cv:AlignmentCv,left:{rgba:Uint8ClampedArray;width:number;height:number},right:{rgba:Uint8ClampedArray;width:number;height:number},mode:AlignmentCandidate['mode'],sourceRevision:string,encodedBytes=0,featureRois?:AlignmentFeatureRois):AlignmentCandidate{
  if(mode!=='affine'&&mode!=='homography')throw new Error('ALIGNMENT_OPTIONS');
  const rois=snapshotFeatureRois(featureRois,left.width,left.height,right.width,right.height);
  const base:Array<{delete():void}>=[];const own=<T extends {delete():void}>(value:T)=>{base.push(value);return value;};
  try{
    const images=[left,right].map((image,index)=>{const rgba=own(new cv.Mat(image.height,image.width,cv.CV_8UC4)),gray=own(new cv.Mat()),mask=own(new cv.Mat(image.height,image.width,cv.CV_8UC1));rgba.data.set(image.rgba);const maskData=mask.data,roi=index?rois.right:rois.left;for(let p=0;p<image.width*image.height;p++){const x=p%image.width,y=Math.floor(p/image.width);maskData[p]=image.rgba[p*4+3]>=16&&(!featureRois||x>=roi.x&&y>=roi.y&&x<roi.x+roi.width&&y<roi.y+roi.height)?255:0;}cv.cvtColor(rgba,gray,cv.COLOR_RGBA2GRAY);return {gray,mask};});
    let lastError='ALIGNMENT_NO_FEATURES';
    for(const inverted of [false,true])for(const profile of ['strict','lenient'] as const){
      const objects:Array<{delete():void}>=[];const take=<T extends {delete():void}>(value:T)=>{objects.push(value);return value;};
      try{
        const gray=take(new cv.Mat());if(inverted)cv.bitwise_not(images[1].gray,gray);else images[1].gray.copyTo(gray);
        const detector=take(new cv.ORB(profile==='strict'?1500:3200,1.4,8,31,0,2,cv.ORB_HARRIS_SCORE,40,profile==='strict'?32:15));
        const keypoints=[take(new cv.KeyPointVector()),take(new cv.KeyPointVector())],descriptors=[take(new cv.Mat()),take(new cv.Mat())];
        detector.detectAndCompute(images[0].gray,images[0].mask,keypoints[0],descriptors[0]);detector.detectAndCompute(gray,images[1].mask,keypoints[1],descriptors[1]);
        if(keypoints.some(points=>points.size()<16))throw new Error('ALIGNMENT_NO_FEATURES');
        const matcher=take(new cv.BFMatcher(cv.NORM_HAMMING,false)),matches=take(new cv.DMatchVectorVector());matcher.knnMatch(descriptors[0],descriptors[1],matches,2);
        const selected:AlignmentMatch[]=[],used=new Set<number>();
        for(let i=0;i<matches.size()&&selected.length<(profile==='strict'?400:1000);i++){const row=matches.get(i);try{if(row.size()<2)continue;const first=row.get(0),second=row.get(1);if(!Number.isFinite(first.distance)||!Number.isFinite(second.distance)||second.distance<=first.distance||first.distance>=(profile==='strict'?20:32)||first.distance/second.distance>=(profile==='strict'?.6:.78)||used.has(first.trainIdx)||first.queryIdx<0||first.queryIdx>=keypoints[0].size()||first.trainIdx<0||first.trainIdx>=keypoints[1].size())continue;used.add(first.trainIdx);selected.push({source:{...keypoints[1].get(first.trainIdx).pt},target:{...keypoints[0].get(first.queryIdx).pt}});}finally{row.delete();}}
        const holdout=selected.filter((_,i)=>i%4===0),training=selected.filter((_,i)=>i%4!==0);
        if(training.length<(mode==='homography'?10:8)||holdout.length<4)throw new Error('ALIGNMENT_MATCHES');
        const src=training.flatMap(m=>[m.source.x,m.source.y]),dst=training.flatMap(m=>[m.target.x,m.target.y]);
        let matrix:Matrix3,inlierFlags:number[];
        if(mode==='affine'){
          const fitted=cv.estimateAffinePartial2D_js(src,dst,1,5,2000,.95,10);if(!Array.isArray(fitted?.matrix)||fitted.matrix.length<6)throw new Error('ALIGNMENT_FIT');matrix=[...fitted.matrix.slice(0,6),0,0,1] as Matrix3;inlierFlags=Array.from(fitted.inliers??[]);
        }else{
          const a=take(cv.matFromArray(training.length,1,cv.CV_32FC2,src)),b=take(cv.matFromArray(training.length,1,cv.CV_32FC2,dst)),mask=take(new cv.Mat()),fit=take(cv.findHomography(a,b,cv.RANSAC,5,mask));if(fit.empty())throw new Error('ALIGNMENT_FIT');matrix=Array.from(fit.data64F) as Matrix3;inlierFlags=Array.from(mask.data);
        }
        const inlierMatches=training.filter((_,i)=>inlierFlags[i]);
        if(inlierMatches.length<(mode==='homography'?Math.max(10,Math.ceil(training.length*(profile==='strict'?.15:.1))):8))throw new Error('ALIGNMENT_INLIERS');
        const metrics=validateAlignment(matrix,inlierMatches,holdout,{lw:left.width,lh:left.height,rw:right.width,rh:right.height},encodedBytes,featureRois?rois:undefined);
        return {featureRois:featureRois?rois:undefined,coverageReference:featureRois?"feature-roi":"full-frame",originalDimensions:{left:{width:left.width,height:left.height},right:{width:right.width,height:right.height}},id:crypto.randomUUID(),sourceRevision,mode,profile,inverted,matrix,matches:selected.length,trainingMatches:training.length,inliers:inlierMatches.length,inlierRatio:inlierMatches.length/training.length,...metrics};
      }catch(error){if(error instanceof Error&&['IMAGE_MEMORY_LIMIT','IMAGE_SIZE_LIMIT'].includes(error.message))throw error;lastError=error instanceof Error&&error.message.startsWith('ALIGNMENT_')?error.message:'ALIGNMENT_FIT';}
      finally{for(const object of objects.reverse())object.delete();}
    }
    throw new Error(lastError);
  }finally{for(const object of base.reverse())object.delete();}
}
