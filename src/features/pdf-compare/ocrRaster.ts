import {ocrWorkingPixelLimit,rasterOcrAdmission} from '../ocr-compare/model.ts';
import type {RasterOcrPairInput} from '../ocr-compare/client.ts';
import {discardOwnedBuffer} from '../image-compare/memory.ts';
import type {ComparisonResult,SelectedPreview} from './types.ts';
/** Conservative reservation for compact PDF text/rows retained beside OCR; not measured RSS. */
export function pdfResultReservation(result:ComparisonResult){
 let bytes=2*1024*1024;
 for(const pair of result.pairs){bytes+=512+4*(pair.beforeName.length+pair.afterName.length);for(const page of pair.pages){bytes+=1024+4*(page.beforeText.length+page.afterText.length);for(const segment of page.segments)bytes+=256+4*segment.text.length;}}
 return bytes;
}
export function pdfOcrGeometry(width:number,height:number,retainedCallerBytes:number,encodedBytes:number){
 const limit=ocrWorkingPixelLimit(retainedCallerBytes,encodedBytes);
 if(!Number.isSafeInteger(width)||width<1||!Number.isSafeInteger(height)||height<1||limit<4096)throw new Error('OCR_MEMORY_LIMIT');
 const scale=Math.min(1,Math.sqrt(limit/(width*height)));
 const w=Math.max(1,Math.floor(width*scale)),h=Math.max(1,Math.floor(height*scale));
 rasterOcrAdmission({width:w,height:h,encodedBytes,retainedCallerBytes,retainedRegionPasses:0});
 return {width:w,height:h,scaleX:width/w,scaleY:height/h,reduced:w<width||h<height};
}
/** Uses the same selected page canvases. No PDF parsing, rematching or pixel-stat recomputation. */
export function createPdfOcrRaster(preview:SelectedPreview,runId:string,encodedBytes:number,resultBytes:number){
 const canvases=[preview.before,preview.after,preview.overlay];
 if(!preview.before&&!preview.after)throw new DOMException('Stale preview','AbortError');
 let privateBytes=resultBytes;
 for(const canvas of canvases)if(canvas)privateBytes+=canvas.width*canvas.height*4;
 for(const item of [...preview.beforeItems,...preview.afterItems])privateBytes+=256+item.str.length*4+item.transform.length*8;
 const geometry=pdfOcrGeometry(preview.geometry.width,preview.geometry.height,privateBytes,encodedBytes);
 const raster=(source:HTMLCanvasElement|null)=>{
  const canvas=document.createElement('canvas');canvas.width=geometry.width;canvas.height=geometry.height;
  try{const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('OCR_RASTER_FAILED');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);if(source)context.drawImage(source,0,0,canvas.width,canvas.height);return context.getImageData(0,0,canvas.width,canvas.height).data;}
  finally{canvas.width=canvas.height=0;}
 };
 let left:Uint8ClampedArray|undefined,right:Uint8ClampedArray|undefined;
 try{
  left=raster(preview.before);right=raster(preview.after);
  const transform:[number,number,number,number,number,number,number,number,number]=[geometry.scaleX,0,0,0,geometry.scaleY,0,0,0,1];
  const input:RasterOcrPairInput={runId,width:geometry.width,height:geometry.height,left,right,leftTransform:[...transform],rightTransform:[...transform],encodedBytes,retainedRegionPasses:0,retainedCallerBytes:privateBytes};
  const sources={before:preview.beforeSource,after:preview.afterSource,renderDpi:preview.geometry.dpi,coordinateSpace:'rendered-page-pixels' as const};
  return {input,geometry,sources,release(){discardOwnedBuffer(input.left.buffer);discardOwnedBuffer(input.right.buffer);}};
 }catch(error){if(left)discardOwnedBuffer(left.buffer);if(right)discardOwnedBuffer(right.buffer);throw error;}
}
export type PdfOcrRaster=ReturnType<typeof createPdfOcrRaster>;
