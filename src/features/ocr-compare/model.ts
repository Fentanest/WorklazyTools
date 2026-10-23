import {projectPoint} from '../image-compare/projective.ts';
import type {Matrix3} from '../image-compare/alignmentTypes.ts';
import type {OcrPage,OcrNormalization,OcrLanguage,OcrWord} from './types.ts';
export const MAX_OCR_WORDS=5000,MAX_OCR_CHARACTERS=50000,OCR_RESULT_RESERVE_BYTES=32*1024*1024;
export function comparisonText(raw:string,normalization:OcrNormalization){return normalization==='nfc'?raw.normalize('NFC'):normalization==='whitespace'?raw.replace(/\s+/gu,' ').trim():raw;}
const confidence=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100?value:null;
/** Read native words directly; the searchable-PDF hOCR/NFKC transform is intentionally not used. */
export function adaptTesseract(data:unknown,context:{width:number;height:number;sourceTransform:Matrix3;sourceRunId:string;side:string;language:OcrLanguage}):OcrPage{
 const page=data as {text?:unknown;confidence?:unknown;blocks?:Array<{paragraphs?:Array<{lines?:Array<{words?:Array<{text?:unknown;confidence?:unknown;bbox?:{x0:number;y0:number;x1:number;y1:number}}>}>}>}>;__nativeHeapPeakBytes?:number};
 if(!page||typeof page.text!=='string'||page.text.length>MAX_OCR_CHARACTERS||!Number.isFinite(page.__nativeHeapPeakBytes)||page.__nativeHeapPeakBytes!>128*1024*1024||page.__nativeHeapPeakBytes!<=0)throw new Error('OCR_RESULT_INVALID');
 const words:OcrWord[]=[],warnings:string[]=[];let wordCharacters=0;
 for(const block of page.blocks??[])for(const paragraph of block.paragraphs??[])for(const line of paragraph.lines??[])for(const word of line.words??[]){
  if(typeof word.text!=='string')throw new Error('OCR_RESULT_INVALID');wordCharacters+=word.text.length;if(wordCharacters>MAX_OCR_CHARACTERS*2)throw new Error('OCR_OUTPUT_LIMIT');const b=word.bbox;
  if(!b||![b.x0,b.y0,b.x1,b.y1].every(Number.isFinite)||b.x0<0||b.y0<0||b.x1<=b.x0||b.y1<=b.y0||b.x1>context.width||b.y1>context.height)throw new Error('OCR_BBOX_INVALID');
  const score=confidence(word.confidence);words.push({id:`${context.sourceRunId}:${context.side}:${words.length}`,rawText:word.text,confidence:score,reviewRequired:score===null||score<70,bbox:{x:b.x0,y:b.y0,width:b.x1-b.x0,height:b.y1-b.y0},sourcePolygon:[{x:b.x0,y:b.y0},{x:b.x1,y:b.y0},{x:b.x1,y:b.y1},{x:b.x0,y:b.y1}].map(p=>projectPoint(context.sourceTransform,p))});
  if(words.length>MAX_OCR_WORDS)throw new Error('OCR_OUTPUT_LIMIT');
 }
 if(page.text.length&&!words.length)warnings.push('OCR_BOXES_UNAVAILABLE');
 return {rawText:page.text,comparisonText:page.text,words,confidence:confidence(page.confidence),status:page.text.trim().length||words.some(word=>word.rawText.trim().length)?'complete':'empty',warnings,background:'white',coordinateSpace:'comparison-working',provider:'tesseract.js',providerVersion:'7.0.0',modelVersion:'4.0.0_best_int',language:context.language,confidenceScale:'0–100 provider score, not probability',sourceTransform:context.sourceTransform,sourceRunId:context.sourceRunId,width:context.width,height:context.height,nativeHeapPeakBytes:page.__nativeHeapPeakBytes!};
}
/** Admission before caller raster allocation. Retained caller bytes exclude resources already in80*N. */
export function ocrWorkingPixelLimit(retainedCallerBytes:number,encodedBytes=0,retainedRegionPasses=0){
 if(!Number.isSafeInteger(retainedCallerBytes)||retainedCallerBytes<0||!Number.isSafeInteger(encodedBytes)||encodedBytes<0||!Number.isSafeInteger(retainedRegionPasses)||retainedRegionPasses<0||retainedRegionPasses>3)throw new Error('OCR_MEMORY_LIMIT');
 return Math.max(0,Math.min(400000,Math.floor((256*1024*1024-(128+64+32)*1024*1024-encodedBytes-retainedRegionPasses*8*1024*1024-retainedCallerBytes)/80)));
}
export function ocrMemoryEstimate(pixels:number,encodedBytes=0,retainedRegionPasses=0,retainedCallerBytes=0){if(!Number.isSafeInteger(pixels)||pixels<1||pixels>ocrWorkingPixelLimit(retainedCallerBytes,encodedBytes,retainedRegionPasses))throw new Error('OCR_MEMORY_LIMIT');return (128+64+32)*1024*1024+80*pixels+encodedBytes+retainedRegionPasses*8*1024*1024+retainedCallerBytes;}

export function rasterOcrAdmission(input:{width:number;height:number;encodedBytes:number;retainedRegionPasses:number;retainedCallerBytes:number}){
 if(!Number.isSafeInteger(input.retainedCallerBytes)||input.retainedCallerBytes<0||!Number.isSafeInteger(input.encodedBytes)||!Number.isSafeInteger(input.retainedRegionPasses)||!Number.isSafeInteger(input.width)||input.width<1||!Number.isSafeInteger(input.height)||input.height<1)throw new Error('OCR_MEMORY_LIMIT');
 return ocrMemoryEstimate(input.width*input.height,input.encodedBytes,input.retainedRegionPasses,input.retainedCallerBytes);
}

/** Edited transcript projection has no word boxes or confidence: coordinates belong only to raw OCR. */
export function projectOcrComparison(pair:import('./types.ts').OcrPair,normalization:OcrNormalization,annotations:Partial<Record<'left'|'right',import('./types.ts').OcrTranscriptAnnotation>>={},useCorrected=false){
 const project=(side:'left'|'right')=>{const raw=pair[side],annotation=useCorrected?annotations[side]:undefined;
  if(annotation&&(annotation.kind!=='corrected-transcript'||typeof annotation.text!=='string'||annotation.sourceRunId!==pair.sourceRunId||annotation.side!==side||annotation.language!==raw.language||annotation.providerVersion!==raw.providerVersion||annotation.modelVersion!==raw.modelVersion||annotation.text.length>MAX_OCR_CHARACTERS||annotation.coordinateAttribution!=='none'))throw new Error('OCR_ANNOTATION_SOURCE_MISMATCH');
  return {sourceRunId:pair.sourceRunId,rawText:raw.rawText,comparisonText:comparisonText(annotation?.text??raw.rawText,normalization),inputSource:annotation?'corrected-transcript':'raw-ocr',coordinateAttribution:'none' as const};};
 return {normalization,left:project('left'),right:project('right')};
}
