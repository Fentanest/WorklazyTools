/// <reference lib="webworker" />
import {createWorker,type Worker as TesseractWorker} from 'tesseract.js';
import {simd,relaxedSimd} from 'wasm-feature-detect';
import manifest from './assets.manifest.json';
import {adaptTesseract,ocrMemoryEstimate} from './model.ts';
import {discardOwnedBuffer} from '../image-compare/memory.ts';
import type {Matrix3} from '../image-compare/alignmentTypes.ts';
import type {OcrLanguage,OcrPair} from './types.ts';
const scope=self as unknown as DedicatedWorkerGlobalScope,children=new Set<Worker>(),NativeWorker=(scope as unknown as {Worker:typeof Worker}).Worker;
Object.defineProperty(scope,'Worker',{value:new Proxy(NativeWorker,{construct(target,args){const child=Reflect.construct(target,args) as Worker;children.add(child);return child;}})});
let runtime:TesseractWorker|undefined,disposed=false;const urls:string[]=[];
async function close(){disposed=true;for(const child of children)child.terminate();children.clear();if(runtime)await runtime.terminate().catch(()=>{});runtime=undefined;for(const url of urls)URL.revokeObjectURL(url);urls.length=0;}
async function asset(path:string,base:string){const entry=manifest.files.find(f=>f.path===path);if(!entry)throw new Error('OCR_ASSET_UNKNOWN');const response=await fetch(new URL(manifest.base+path,base));if(!response.ok)throw new Error('OCR_ASSET_UNAVAILABLE');const bytes=await response.arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');if(!((bytes.byteLength===entry.bytes&&hash===entry.sha256)||('decodedBytes' in entry&&bytes.byteLength===entry.decodedBytes&&hash===entry.decodedSha256)))throw new Error('OCR_ASSET_INTEGRITY');return bytes;}
function scriptUrl(bytes:ArrayBuffer,type='application/javascript'){const url=URL.createObjectURL(new Blob([bytes],{type}));urls.push(url);return url;}
scope.onmessage=async({data}:MessageEvent<{type:'recognize';encodedBytes:number;width:number;height:number;left:Uint8ClampedArray;right:Uint8ClampedArray;leftTransform:Matrix3;rightTransform:Matrix3;sourceRunId:string;language:OcrLanguage;layout:'paragraphs'|'sparse';base:string}|{type:'dispose'}>)=>{
 if(data.type==='dispose'){await close();await new Promise(resolve=>setTimeout(resolve,150));scope.postMessage({type:'disposed'});scope.close();return;}
 try{
  if(new URL(data.base).origin!==scope.location.origin)throw new Error("OCR_INPUT_INVALID");ocrMemoryEstimate(data.width*data.height,data.encodedBytes);if(!['eng','kor','kor+eng'].includes(data.language)||data.left.length!==data.width*data.height*4||data.right.length!==data.left.length)throw new Error('OCR_INPUT_INVALID');
  const start=performance.now(),variant=await relaxedSimd()?'relaxedsimd-':await simd()?'simd-':'';
  const [workerScript,core,...models]=await Promise.all([asset('worker.min.js',data.base),asset(`core/tesseract-core-${variant}lstm.wasm.js`,data.base),...data.language.split('+').map(lang=>asset(`lang/${lang}.traineddata.gz`,data.base))]);if(disposed)return;
  const workerUrl=scriptUrl(workerScript),coreUrl=scriptUrl(core)+'#core.js',modelUrls=Object.fromEntries(data.language.split('+').map((code,i)=>[code,scriptUrl(models[i],'application/octet-stream')]));
  runtime=await createWorker(data.language.split('+'),undefined,{workerPath:new URL(`vendor/comparison/ocr-child-v1.worker.js?script=${encodeURIComponent(workerUrl)}&models=${encodeURIComponent(JSON.stringify(modelUrls))}`,data.base).href,workerBlobURL:false,corePath:coreUrl,langPath:new URL(manifest.base+'lang/',data.base).href,cacheMethod:'none',errorHandler:()=>undefined,logger:message=>{if(!disposed)scope.postMessage({type:'progress',progress:Math.round((message.progress??0)*80)});}});if(disposed){await close();return;}
  await runtime.setParameters({tessedit_pageseg_mode:(data.layout==='sparse'?'11':'3') as import('tesseract.js').PSM});
  const pages=[];
  for(const side of ['left','right'] as const){const canvas=new OffscreenCanvas(data.width,data.height),context=canvas.getContext('2d');if(!context)throw new Error('OCR_CANVAS_UNAVAILABLE');let image:Blob;try{context.putImageData(new ImageData(data[side] as Uint8ClampedArray<ArrayBuffer>,data.width,data.height),0,0);context.globalCompositeOperation='destination-over';context.fillStyle='white';context.fillRect(0,0,data.width,data.height);image=await canvas.convertToBlob({type:'image/png'});}finally{canvas.width=canvas.height=1;discardOwnedBuffer(data[side].buffer);}if(disposed)return;
   const recognized=await runtime.recognize(image,{pdfTextOnly:false},{text:true,blocks:true,hocr:false});if(disposed)return;
   pages.push(adaptTesseract(recognized.data,{width:data.width,height:data.height,sourceTransform:side==='left'?data.leftTransform:data.rightTransform,sourceRunId:data.sourceRunId,side,language:data.language}));
  }
  const result:OcrPair={sourceRunId:data.sourceRunId,left:pages[0],right:pages[1],elapsedMs:performance.now()-start};await close();scope.postMessage({type:'result',result});
 }catch(error){await close();scope.postMessage({type:'error',code:error instanceof Error&&/^[A-Z_]+$/u.test(error.message)?error.message:'OCR_RECOGNITION_FAILED'});}
};
