import type { AlignmentMatch, Matrix3, Point } from "./alignmentTypes.ts";
import { overlapRatio, projectPoint, projectiveGeometry, warpedCorners } from "./projective.ts";
function spread(points:Point[],width:number,height:number){
  if(!points.length)return {area:0,bins:0};
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),bins=new Set(points.map(p=>`${Math.min(3,Math.max(0,Math.floor(p.x/width*4)))}:${Math.min(3,Math.max(0,Math.floor(p.y/height*4)))}`));
  return {area:(Math.max(...xs)-Math.min(...xs))*(Math.max(...ys)-Math.min(...ys))/(width*height),bins:bins.size};
}
export function validateAlignment(matrix:Matrix3,inlierMatches:AlignmentMatch[],holdout:AlignmentMatch[],dimensions:{lw:number;lh:number;rw:number;rh:number},encodedBytes=0){
  const {lw,lh,rw,rh}=dimensions;projectiveGeometry(lw,lh,rw,rh,matrix,encodedBytes);
  const source=spread(inlierMatches.map(m=>m.source),rw,rh),target=spread(inlierMatches.map(m=>m.target),lw,lh);
  if(source.area<.12||target.area<.12||source.bins<6||target.bins<6)throw new Error("ALIGNMENT_DISTRIBUTION");
  const errors=holdout.map(m=>{const p=projectPoint(matrix,m.source);return Math.hypot(p.x-m.target.x,p.y-m.target.y);}).sort((a,b)=>a-b);
  const median=errors[Math.floor(errors.length/2)]??Infinity;
  if(errors.length<4||median>1.5||errors.filter(e=>e<=3).length/errors.length<.8)throw new Error("ALIGNMENT_HOLDOUT");
  const overlap=overlapRatio(warpedCorners(matrix,rw,rh),lw,lh);if(!Number.isFinite(overlap)||overlap<.35)throw new Error("ALIGNMENT_OVERLAP");
  return {holdoutCount:errors.length,holdoutMedianError:median,sourceCoverage:source.area,targetCoverage:target.area,overlapRatio:overlap};
}
