import {validateFeatureRoi} from './alignmentRoi.ts';
import {applyMatrix} from './geometry.ts';
import {projectPoint} from './projective.ts';
import type {ImageCompareResult,Bounds} from './types.ts';
import type {Point} from './alignmentTypes.ts';
export type RoiOverlay={status:'absent'}|{status:'invalid'}|{status:'projected';points:Point[]};
/** Draft coordinates are untrusted UI state. A failed overlay must never invalidate the result. */
export function projectFeatureRoiOverlay(result:ImageCompareResult,side:'left'|'right',draft:Bounds|undefined):RoiOverlay{
 if(!draft)return {status:'absent'};
 try{
  const source=result.sources[side],roi=validateFeatureRoi(draft,source.decodedWidth??source.width,source.decodedHeight??source.height);
  const corners=[[roi.x,roi.y],[roi.x+roi.width,roi.y],[roi.x+roi.width,roi.y+roi.height],[roi.x,roi.y+roi.height]];
  const projective=side==='right'?result.geometry.rightProjective:undefined;
  if(projective&&corners.some(([x,y])=>!Number.isFinite(projective[6]*x+projective[7]*y+projective[8])||projective[6]*x+projective[7]*y+projective[8]<=1e-8))return {status:'invalid'};
  const points=corners.map(([x,y])=>projective?projectPoint(projective,{x,y}):applyMatrix(side==='left'?result.geometry.leftMatrix:result.geometry.rightMatrix,x,y));
  return points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))?{status:'projected',points}:{status:'invalid'};
 }catch{return {status:'invalid'};}
}
