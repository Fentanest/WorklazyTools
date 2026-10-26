import { selectWorkingResolution } from "./memory.ts";
import { validateDimensions } from "./geometry.ts";
import type { Matrix3, Point } from "./alignmentTypes.ts";
export const IDENTITY_PROJECTIVE: Matrix3 = [1,0,0,0,1,0,0,0,1];
export function projectPoint(m: Matrix3, p: Point): Point {
  const d=m[6]*p.x+m[7]*p.y+m[8];
  if (!Number.isFinite(d)||Math.abs(d)<1e-8) throw new Error("ALIGNMENT_GEOMETRY");
  return {x:(m[0]*p.x+m[1]*p.y+m[2])/d,y:(m[3]*p.x+m[4]*p.y+m[5])/d};
}
export function invertProjective(m: Matrix3): Matrix3 {
  const [a,b,c,d,e,f,g,h,i]=m;
  const det=a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g);
  if (!m.every(Number.isFinite)||!Number.isFinite(det)||Math.abs(det)<1e-8) throw new Error("ALIGNMENT_GEOMETRY");
  return [e*i-f*h,c*h-b*i,b*f-c*e,f*g-d*i,a*i-c*g,c*d-a*f,d*h-e*g,b*g-a*h,a*e-b*d].map(v=>v/det) as Matrix3;
}
export function polygonArea(points: Point[]) { return Math.abs(points.reduce((s,p,i)=>{const q=points[(i+1)%points.length];return s+p.x*q.y-q.x*p.y;},0))/2; }
export function warpedCorners(m: Matrix3,width: number,height: number) { return [{x:0,y:0},{x:width,y:0},{x:width,y:height},{x:0,y:height}].map(p=>projectPoint(m,p)); }
export function overlapRatio(points: Point[],width: number,height: number) {
  let polygon=points;
  for(const [axis,bound,greater] of [["x",0,true],["x",width,false],["y",0,true],["y",height,false]] as const){
    const input=polygon;polygon=[];if(!input.length)break;
    for(let i=0;i<input.length;i++){const a=input[i],b=input[(i+1)%input.length],insideA=greater?a[axis]>=bound:a[axis]<=bound,insideB=greater?b[axis]>=bound:b[axis]<=bound;
      if(insideA)polygon.push(a);if(insideA!==insideB){const t=(bound-a[axis])/(b[axis]-a[axis]);polygon.push({x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)});}}
  }
  return polygonArea(polygon)/Math.min(width*height,polygonArea(points));
}
export function projectiveGeometry(lw:number,lh:number,rw:number,rh:number,matrix:Matrix3,encodedBytes=0,previousViewBytes=0){
  validateDimensions(lw,lh);validateDimensions(rw,rh);invertProjective(matrix);
  const original=[{x:0,y:0},{x:rw,y:0},{x:rw,y:rh},{x:0,y:rh}];
  if(original.some(p=>matrix[6]*p.x+matrix[7]*p.y+matrix[8]<=1e-6))throw new Error("ALIGNMENT_GEOMETRY");
  const corners=warpedCorners(matrix,rw,rh);
  for(let i=0;i<4;i++){const a=corners[i],b=corners[(i+1)%4],c=corners[(i+2)%4];const stretch=Math.hypot(b.x-a.x,b.y-a.y)/(i%2?rh:rw);if(stretch<.25||stretch>4||(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x)<=1e-6)throw new Error("ALIGNMENT_GEOMETRY");}
  const area=polygonArea(corners)/(rw*rh);if(area<.25||area>4)throw new Error("ALIGNMENT_GEOMETRY");
  const originX=Math.floor(Math.min(0,...corners.map(p=>p.x))),originY=Math.floor(Math.min(0,...corners.map(p=>p.y)));
  const width=Math.ceil(Math.max(lw,...corners.map(p=>p.x)))-originX,height=Math.ceil(Math.max(lh,...corners.map(p=>p.y)))-originY;
  if(![width,height].every(v=>Number.isSafeInteger(v)&&v>0&&v<=160000))throw new Error('IMAGE_SIZE_LIMIT');
  const working=selectWorkingResolution(lw*lh+rw*rh,width,height,encodedBytes,previousViewBytes);
  const shifted=matrix.slice() as Matrix3;
  for(let j=0;j<3;j++){shifted[j]-=originX*matrix[6+j];shifted[3+j]-=originY*matrix[6+j];}
  for(let j=0;j<6;j++)shifted[j]*=working.scale;
  return {...working,originalWidth:width,originalHeight:height,originX,originY,leftMatrix:[working.scale,0,0,working.scale,(-originX||0)*working.scale,(-originY||0)*working.scale] as [number,number,number,number,number,number],rightMatrix:[shifted[0],shifted[3],shifted[1],shifted[4],shifted[2],shifted[5]] as [number,number,number,number,number,number],rightProjective:shifted};
}
/** CPU inverse bilinear/premultiplied-alpha sampling preserves RGBA; validity is geometric coverage, separate from alpha. */
export function warpRgba(source:Uint8ClampedArray,sw:number,sh:number,width:number,height:number,matrix:Matrix3){
  const inverse=invertProjective(matrix),rgba=new Uint8ClampedArray(width*height*4),valid=new Uint8Array(width*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const px=x+.5,py=y+.5,d=inverse[6]*px+inverse[7]*py+inverse[8];if(Math.abs(d)<1e-8)continue;
    const sx=(inverse[0]*px+inverse[1]*py+inverse[2])/d,sy=(inverse[3]*px+inverse[4]*py+inverse[5])/d;
    if(sx<.5||sy<.5||sx>sw-.5||sy>sh-.5)continue;
    const ix=Math.floor(sx-.5),iy=Math.floor(sy-.5),fx=sx-.5-ix,fy=sy-.5-iy;let red=0,green=0,blue=0,alpha=0;
    for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const index=(Math.min(sh-1,Math.max(0,iy+dy))*sw+Math.min(sw-1,Math.max(0,ix+dx)))*4,weight=(dx?fx:1-fx)*(dy?fy:1-fy),a=source[index+3]/255*weight;alpha+=a;red+=source[index]*a;green+=source[index+1]*a;blue+=source[index+2]*a;}
    const out=(y*width+x)*4;rgba[out]=alpha?red/alpha:0;rgba[out+1]=alpha?green/alpha:0;rgba[out+2]=alpha?blue/alpha:0;rgba[out+3]=alpha*255;valid[y*width+x]=1;
  }
  return {rgba,valid};
}
