export {rasterOcrAdmission} from './model.ts';
import {runModuleWorker} from '../../utils/workerLifecycle.ts';
import {discardOwnedBuffer} from '../image-compare/memory.ts';
import {invertProjective} from '../image-compare/projective.ts';
import {rasterOcrAdmission,MAX_OCR_WORDS,MAX_OCR_CHARACTERS} from './model.ts';
import type {ImageCompareResult,Matrix} from '../image-compare/types.ts';
import type {Matrix3} from '../image-compare/alignmentTypes.ts';
import type {OcrLanguage,OcrPair} from './types.ts';
const matrix3=([a,b,c,d,x,y]:Matrix):Matrix3=>[a,c,x,b,d,y,0,0,1];
/** Caller-owned RGBA rasters in a shared working coordinate space. Never detached by OCR.
 * Transforms map working coordinates to the original decoded raster; raw OCR retains them.
 * encodedBytes includes retained original file backing; region history must include ALL passes.
 * retainedCallerBytes is REQUIRED: other live preview/source/PDF buffers and canvases not
 * already represented by the supplied working RGBA or this OCR session's fixed reserves.
 * Keep array identity stable; change runId for any source-byte/page revision. Caller must not
 * mutate/detach arrays while mounted or busy. The client copies and owns only its transfers.
 */
export interface RasterOcrPairInput {runId:string;width:number;height:number;left:Uint8ClampedArray;right:Uint8ClampedArray;leftTransform:Matrix3;rightTransform:Matrix3;encodedBytes:number;retainedRegionPasses:number;retainedCallerBytes:number}
/** `retainedCallerBytes`: other page-held buffers (the alignment editor's previews) reserved beside OCR. */
export function imageOcrRasterInput(result:ImageCompareResult,retainedRegionPasses=0,retainedCallerBytes=0):RasterOcrPairInput{
 return {runId:result.runId,width:result.width,height:result.height,left:result.left,right:result.right,leftTransform:invertProjective(matrix3(result.geometry.leftMatrix)),rightTransform:invertProjective(result.geometry.rightProjective??matrix3(result.geometry.rightMatrix)),encodedBytes:result.sources.left.bytes+result.sources.right.bytes,retainedRegionPasses,retainedCallerBytes};
}
export function recognizeOcrPair(result:ImageCompareResult,language:OcrLanguage,layout:'paragraphs'|'sparse',signal:AbortSignal,onProgress:(value:number)=>void,retainedRegionPasses=0){
 return recognizeRasterOcrPair(imageOcrRasterInput(result,retainedRegionPasses),language,layout,signal,onProgress);
}
export async function recognizeRasterOcrPair(result:RasterOcrPairInput,language:OcrLanguage,layout:'paragraphs'|'sparse',signal:AbortSignal,onProgress:(value:number)=>void){
 if(signal.aborted)throw new DOMException('Canceled','AbortError');rasterOcrAdmission(result);
 if(!Number.isSafeInteger(result.width)||result.width<1||!Number.isSafeInteger(result.height)||result.height<1||result.left.length!==result.width*result.height*4||result.right.length!==result.left.length||![result.leftTransform,result.rightTransform].every(m=>Array.isArray(m)&&m.length===9&&m.every(Number.isFinite)))throw new Error('OCR_INPUT_INVALID');
 const left=result.left.slice(),right=result.right.slice(),{leftTransform,rightTransform}=result;
 let disposal=Promise.resolve();
 const factory=()=>{const worker=new Worker(new URL('./provider.worker.ts',import.meta.url),{type:'module'}),terminate=worker.terminate.bind(worker);let closing=false;
  worker.terminate=()=>{if(closing)return;closing=true;disposal=new Promise<void>(resolve=>{let ended=false;const finish=()=>{if(ended)return;ended=true;clearTimeout(timer);worker.removeEventListener('message',ack);terminate();resolve();};const ack=(event:MessageEvent)=>{if(event.data?.type==='disposed')finish();};const timer=setTimeout(finish,2000);worker.addEventListener('message',ack);try{worker.postMessage({type:'dispose'});}catch{finish();}});};return worker;};
 try{
  const pair=await runModuleWorker<object,OcrPair>(factory,{type:'recognize',left,right,encodedBytes:result.encodedBytes,retainedCallerBytes:result.retainedCallerBytes,retainedRegionPasses:result.retainedRegionPasses,width:result.width,height:result.height,leftTransform,rightTransform,sourceRunId:result.runId,language,layout,base:new URL(import.meta.env.BASE_URL,location.origin).href},{transfer:[left.buffer,right.buffer],signal,hardTimeoutMs:120000,inactivityTimeoutMs:30000,canceledMessage:'Canceled',startErrorMessage:'OCR_PROVIDER_UNAVAILABLE',resultErrorMessage:'OCR_RECOGNITION_FAILED',onProgress:({progress})=>onProgress(progress),validateResult:(value):value is OcrPair=>{
   const pair=value as OcrPair;if(!pair||pair.sourceRunId!==result.runId||!Number.isFinite(pair.elapsedMs))return false;
   return [pair.left,pair.right].every((page,index)=>!!page&&page.sourceRunId===result.runId&&page.language===language&&page.width===result.width&&page.height===result.height&&page.providerVersion==='7.0.0'&&page.modelVersion==='4.0.0_best_int'&&page.background==='white'&&page.coordinateSpace==='comparison-working'&&page.provider==='tesseract.js'&&Array.isArray(page.warnings)&&page.warnings.length<=5&&page.warnings.every(w=>typeof w==='string')&&['complete','empty'].includes(page.status)&&typeof page.rawText==='string'&&page.rawText.length<=MAX_OCR_CHARACTERS&&Array.isArray(page.words)&&page.words.length<=MAX_OCR_WORDS&&page.nativeHeapPeakBytes>0&&page.nativeHeapPeakBytes<=128*1024*1024&&Array.isArray(page.sourceTransform)&&page.sourceTransform.length===9&&page.sourceTransform.every((v,i)=>v===(index?rightTransform:leftTransform)[i])&&page.comparisonText===page.rawText&&page.words.every((word,i)=>word.id===`${result.runId}:${index?'right':'left'}:${i}`&&typeof word.rawText==='string'&&word.rawText.length<=MAX_OCR_CHARACTERS*2&&(word.confidence===null||Number.isFinite(word.confidence)&&word.confidence>=0&&word.confidence<=100)&&word.reviewRequired===(word.confidence===null||word.confidence<70)&&!!word.bbox&&[word.bbox.x,word.bbox.y,word.bbox.width,word.bbox.height].every(Number.isFinite)&&word.bbox.x>=0&&word.bbox.y>=0&&word.bbox.width>0&&word.bbox.height>0&&word.bbox.x+word.bbox.width<=result.width&&word.bbox.y+word.bbox.height<=result.height&&Array.isArray(word.sourcePolygon)&&word.sourcePolygon.length===4&&word.sourcePolygon.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))));
  }});await disposal;if(signal.aborted)throw new DOMException('Canceled','AbortError');return pair;
 }finally{await disposal;discardOwnedBuffer(left.buffer);discardOwnedBuffer(right.buffer);}
}
