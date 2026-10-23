import type {Matrix3} from '../image-compare/alignmentTypes.ts';
export type OcrLanguage='eng'|'kor'|'kor+eng';
export type OcrNormalization='none'|'nfc'|'whitespace';
export interface OcrWord {id:string;rawText:string;confidence:number|null;reviewRequired:boolean;bbox:{x:number;y:number;width:number;height:number};sourcePolygon:Array<{x:number;y:number}>}
export interface OcrPage {rawText:string;comparisonText:string;words:OcrWord[];confidence:number|null;status:'complete'|'empty';background:'white';coordinateSpace:'comparison-working';warnings:string[];provider:'tesseract.js';providerVersion:'7.0.0';modelVersion:'4.0.0_best_int';language:OcrLanguage;confidenceScale:'0–100 provider score, not probability';sourceTransform:Matrix3;sourceRunId:string;width:number;height:number;nativeHeapPeakBytes:number}
export interface OcrPair {sourceRunId:string;left:OcrPage;right:OcrPage;elapsedMs:number}
export interface OcrAnnotation {wordId:string;text:string}
export interface OcrTranscriptAnnotation {kind:'corrected-transcript';sourceRunId:string;side:'left'|'right';language:OcrLanguage;providerVersion:'7.0.0';modelVersion:'4.0.0_best_int';text:string;coordinateAttribution:'none'}
