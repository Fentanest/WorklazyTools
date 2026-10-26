import {useEffect,useMemo,useState} from 'react';
import {useTranslation} from 'react-i18next';
import {RasterOcrComparePanel} from '../ocr-compare/OcrComparePanel.tsx';
import type {ImageT} from '../image-compare/ImageViews.tsx';
import {Button} from '../../components/ui/button';
import {createPdfOcrRaster,type PdfOcrRaster} from './ocrRaster.ts';
import type {SelectedPreview} from './types.ts';
import type {PdfCompareSession} from './session.ts';
export const pdfOcrCopy={
 ko:{title:'페이지 이미지의 글자 비교',description:'선택한 두 페이지 화면에서 글자를 인식합니다. 위의 PDF 추출 텍스트와 픽셀 차이 결과는 그대로 유지됩니다.',coordinates:'렌더된 페이지 좌표',reduced:'인식용 이미지를 {{width}} × {{height}} 픽셀로 줄였습니다. 작은 글자의 정확도가 낮아질 수 있습니다. 위의 화면 비교 해상도는 바뀌지 않습니다.',memory:'현재 PDF와 페이지 화면을 보관한 상태에서는 글자를 인식할 공간이 부족합니다. 필요한 페이지만 담은 더 작은 PDF 사본으로 다시 비교하세요.',failed:'인식용 페이지 화면을 준비하지 못했습니다. 페이지를 다시 선택하세요.',text:'인식 글자 비교',boxes:'인식 위치 보기',preparing:'인식할 페이지 화면을 준비하고 있습니다.',busy:'진행 중인 페이지 작업이 끝난 뒤 다시 시도하세요.'},
 en:{title:'Compare text in page images',description:'Recognize text from the two selected page images. The extracted PDF text and pixel-difference results above stay unchanged.',coordinates:'Rendered page coordinates',reduced:'Recognition images were reduced to {{width}} × {{height}} pixels. Small text may be less accurate. The visual comparison resolution above stays unchanged.',memory:'There is not enough processing space while these PDFs and page previews are retained. Compare smaller PDF copies containing only the pages you need.',failed:'The page images could not be prepared for recognition. Select the page again.',text:'Recognized text',boxes:'Recognition positions',preparing:'Preparing page images for recognition.',busy:'Wait for the current page task to finish, then try again.'}
} as const;
export function PdfOcrPanel({preview,session,runId,encodedBytes,resultBytes,language}:{preview:SelectedPreview;session:PdfCompareSession;runId:string;encodedBytes:number;resultBytes:number;language:'ko'|'en'}){
 const {t:translate}=useTranslation(),c=pdfOcrCopy[language];const i18nT=translate as unknown as ImageT;
 const [raster,setRaster]=useState<PdfOcrRaster>(),[error,setError]=useState(''),[mode,setMode]=useState<'text'|'boxes'>('text');
 const execute=useMemo(()=>session.runAuxiliary.bind(session),[session]);
 useEffect(()=>{
  const controller=new AbortController();let release:(()=>void)|undefined;
  setRaster(undefined);setError('');
  void session.runAuxiliary(async()=>{const next=createPdfOcrRaster(preview,runId,encodedBytes,resultBytes);release=session.ownPreviewResource(preview,next.release);return next;},controller.signal)
   .then(next=>{if(!controller.signal.aborted)setRaster(next);})
   .catch(caught=>{if(!controller.signal.aborted&&!(caught instanceof DOMException&&caught.name==='AbortError'))setError(caught instanceof Error&&caught.message==='OCR_MEMORY_LIMIT'?'memory':'failed');});
  return()=>{controller.abort();release?.();};
 },[preview,session,runId,encodedBytes,resultBytes]);
 const t:ImageT=(key,values)=>key==='ocr.title'?c.title:key==='ocr.description'?c.description:key==='ocr.memoryLimit'?c.memory:key==='ocr.applyFirst'?c.busy:i18nT(`features:imageCompare.${key==='working'?'processing':key}`,values);
 return <section className="mt-5" data-testid="pdf-ocr" data-coordinate-space="rendered-page-pixels" data-before-page={raster?.sources.before?.pageIndex} data-after-page={raster?.sources.after?.pageIndex}>
 {error?<p role="status" className="rounded-xl border p-3 text-sm">{c[error as 'memory'|'failed']}</p>:!raster?<p role="status">{c.preparing}</p>:<>
 <div className="flex flex-wrap gap-2">{(['text','boxes'] as const).map(value=><Button key={value} variant={mode===value?'default':'outline'} onClick={()=>setMode(value)}>{c[value]}</Button>)}</div>
 {raster.geometry.reduced&&<p className="mt-2 text-xs text-muted-foreground" data-testid="pdf-ocr-resolution">{c.reduced.replace('{{width}}',String(raster.input.width)).replace('{{height}}',String(raster.input.height))}</p>}
 <RasterOcrComparePanel input={raster.input} mode={mode} active enabled t={t} sourceCoordinateLabel={c.coordinates} execute={execute}/></>}
 </section>;
}
