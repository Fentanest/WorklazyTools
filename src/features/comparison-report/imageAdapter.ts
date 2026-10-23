import {pixelOptionMeaning} from "../image-compare/optionMeaning.ts";
import type { ImageCompareResult } from '../image-compare/types.ts';
import { IMAGE_LIMITS } from '../image-compare/types.ts';
import { discardOwnedBuffer } from '../image-compare/memory.ts';
import { assertReport, createExportSnapshot, REPORT_LIMITS, type Json, type ExportSnapshot } from './snapshot.ts';
import type { CapturedView } from './png.ts';
export type ImageExportProjection = 'left'|'right'|'highlight'|'subtract';
export function imageReportReservation(result: ImageCompareResult, retainedBytes=0) {
  const pixels=result.width*result.height;
  assertReport(pixels>0&&pixels<=REPORT_LIMITS.pngPixels&&result.width<=8192&&result.height<=8192,'REPORT_CAPTURE_LIMIT');
  // Existing views44/output pixel, metadata for cached region passes/OCR, plus conservative
  // export canvas/ImageData/encoder/Blob copies32/output pixel. CV/OCR/comparison is excluded while leased.
  const extra=pixels*32+2*1024**2,live=pixels*44+3*(result.sources.left.bytes+result.sources.right.bytes)+retainedBytes;
  assertReport(Number.isSafeInteger(retainedBytes)&&retainedBytes>=0&&live+extra<=IMAGE_LIMITS.memoryBytes,'IMAGE_MEMORY_LIMIT');return extra;
}
export function imageExportSnapshot(result: ImageCompareResult, revision: number, projection: ImageExportProjection, language:'ko'|'en') {
  const quality=structuredClone(result.quality) as unknown as Json;
  return createExportSnapshot({language,tool:'image-compare',sources:(['left','right']as const).map(side=>({id:side,revision:`${revision}:${result.runId}`,label:result.sources[side].name})),
    appliedOptions:{comparison:(result.optionMeaning??pixelOptionMeaning(result.options)).applied as unknown as Json,requestedComparison:(result.optionMeaning??pixelOptionMeaning(result.options)).requested as unknown as Json,inactiveOptions:[...(result.optionMeaning??pixelOptionMeaning(result.options)).inactive],transform:result.geometry.rightTransform as unknown as Json,quality,projection},
    coordinates:{unit:'working-pixels',workingExtent:{width:result.width,height:result.height},originalCanvasExtent:{width:result.quality.originalWidth,height:result.quality.originalHeight},sources:result.sources as unknown as Json,originalCanvasOrigin:{unit:'original-transformed-pixels',x:result.geometry.originX,y:result.geometry.originY},sourceMatrixInputUnit:'decoded-original-image-pixels',leftSourceToWorking:result.geometry.leftMatrix as unknown as Json,rightSourceToWorking:(result.geometry.rightProjective??result.geometry.rightMatrix)as unknown as Json,rightMatrixKind:result.geometry.rightProjective?'projective3':'affine6'},
    warnings:[...(result.quality.scale<1?[language==='ko'?'크기를 줄여 비교한 결과입니다. 원본 파일이나 원본 픽셀이 같다는 뜻은 아닙니다.':'Resized for comparison; this does not prove identical original files or pixels.']:[]),language==='ko'?'비교 이미지 전체를 저장합니다. 영역 상자·잘라보기·OCR 표시는 포함하지 않습니다.':'Saves the full comparison image, excluding region boxes, crop and OCR displays.'],completion:'complete',scope:{kind:'all',label:language==='ko'?'전체 비교 이미지':'Full comparison image'},
    rows:[{id:'working-metrics',status:'working-pixel-metrics',left:JSON.stringify({changed:result.changedPixelCount,comparable:result.comparablePixelCount,ratio:result.differenceRatio,addedBoundary:result.addedBoundaryPixelCount,removedBoundary:result.removedBoundaryPixelCount}),right:'',metadata:{quality}}],
    view:{width:result.width,height:result.height,alpha:'preserved',renderOptions:{projection,screenThemeApplied:false,colorSpace:'8-bit sRGB',pixelUnits:'working-pixels',quality,regionBoxes:false,focusCrop:false,ocr:false}} });
}
/** Copies the existing authoritative raster synchronously before any await/input event can dispose it. */
export function captureImageReport(snapshot: ExportSnapshot, result:ImageCompareResult, projection:ImageExportProjection, signal:AbortSignal): CapturedView {
  signal.throwIfAborted();const pixels=projection==='left'?result.left:projection==='right'?result.right:projection==='highlight'?result.overlay:result.subtract;
  assertReport(pixels.length===result.width*result.height*4&&snapshot.view?.width===result.width&&snapshot.view.height===result.height,'REPORT_STALE_CAPTURE');
  const canvas=document.createElement('canvas');canvas.width=result.width;canvas.height=result.height;
  try{const context=canvas.getContext('2d');assertReport(context,'REPORT_CAPTURE');const data=new ImageData(Uint8ClampedArray.from(pixels),result.width,result.height);
    try{context.putImageData(data,0,0);}finally{discardOwnedBuffer(data.data.buffer);}return{canvas,snapshotId:snapshot.id,view:snapshot.view,release(){canvas.width=canvas.height=0;}};
  }catch(error){canvas.width=canvas.height=0;throw error;}
}
