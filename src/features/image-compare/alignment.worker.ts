/// <reference lib="webworker" />
import { loadCvRuntime } from "./cvRuntime.ts";
import { alignWithCv, type AlignmentCv } from "./alignment.ts";
import { inspectImageHeader } from "./input.ts";
import { assertAlignmentBudget, discardOwnedBuffer } from "./memory.ts";
import type { AlignmentCandidate } from "./alignmentTypes.ts";
const scope=self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage=async({data}:MessageEvent<{left:ArrayBuffer;right:ArrayBuffer;leftName:string;rightName:string;sourceRevision:string;mode:AlignmentCandidate['mode'];retainedBytes:number}>)=>{
  const owned:Uint8ClampedArray[]=[];
  try{
    const l=inspectImageHeader(data.leftName,data.left),r=inspectImageHeader(data.rightName,data.right),encoded=data.left.byteLength+data.right.byteLength;
    assertAlignmentBudget(l.width*l.height+r.width*r.height,encoded,data.retainedBytes);
    const {cv}=await loadCvRuntime<AlignmentCv>(()=>scope.postMessage({type:'progress',progress:20}));
    const decode=async(buffer:ArrayBuffer,mime:string)=>{let bitmap:ImageBitmap|undefined;const canvas=new OffscreenCanvas(1,1);try{bitmap=await createImageBitmap(new Blob([buffer],{type:mime}),{imageOrientation:'from-image',colorSpaceConversion:'default',premultiplyAlpha:'none'});canvas.width=bitmap.width;canvas.height=bitmap.height;const context=canvas.getContext('2d',{colorSpace:'srgb',willReadFrequently:true});if(!context)throw new Error('IMAGE_CANVAS_UNAVAILABLE');context.drawImage(bitmap,0,0);const rgba=context.getImageData(0,0,bitmap.width,bitmap.height).data;owned.push(rgba);return {rgba,width:bitmap.width,height:bitmap.height};}finally{bitmap?.close();canvas.width=canvas.height=1;}};
    const left=await decode(data.left,l.mime),right=await decode(data.right,r.mime);
    assertAlignmentBudget(left.width*left.height+right.width*right.height,encoded,data.retainedBytes);
    scope.postMessage({type:'progress',progress:40});
    const result=alignWithCv(cv,left,right,data.mode,data.sourceRevision,encoded);
    scope.postMessage({type:'result',result});
  }catch(error){scope.postMessage({type:'error',code:error instanceof Error&&/^[A-Z_]+$/u.test(error.message)?error.message:'ALIGNMENT_FAILED'});}
  finally{for(const array of owned)discardOwnedBuffer(array.buffer);scope.close();}
};
