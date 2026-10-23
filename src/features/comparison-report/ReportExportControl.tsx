import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/button';
import { UtilityNotice, UtilitySelect } from '../../components/UtilitySurface';
import { ReportSession, downloadReport } from './session.ts';
import { writeSnapshotXlsx, writeSnapshotTxt, writeSnapshotZip } from './writers.ts';
import { writeSnapshotPng, type CaptureView } from './png.ts';
import { writeSnapshotPdf } from './pdf.ts';
import { ReportError, type ExportSnapshot } from './snapshot.ts';
export const REPORT_COPY = {
  en: { unsupportedGlyph:'This PDF font cannot preserve one or more characters. Choose Raw records (TXT) to keep all text.',all:'All results',selected:'Selected results',complete:'Complete',partial:'Partial',canceled:'Canceled',export:'Export report',format:'Report format',cancel:'Cancel export',busy:'Preparing report…',error:'Could not export this report. Check the size, font coverage and current result. Raw TXT preserves all supplied records.',scope:'Save the current comparison in the selected format.',txt:'Raw records (TXT)',xlsx:'Spreadsheet (XLSX)',pdf:'PDF report',png:'Current image view (PNG)',zip:'Report bundle (ZIP)' },
  ko: { unsupportedGlyph:'PDF 글꼴로 일부 글자를 보존할 수 없습니다. 원문 기록 (TXT)을 선택하면 모든 문자를 유지합니다.',all:'전체 결과',selected:'선택한 결과',complete:'완료',partial:'부분 결과',canceled:'취소된 결과',export:'보고서 내보내기',format:'보고서 형식',cancel:'내보내기 취소',busy:'보고서를 만드는 중…',error:'보고서를 내보내지 못했습니다. 크기·지원 글자·현재 결과를 확인하세요. 원문 TXT는 제공된 기록 전체를 보존합니다.',scope:'현재 비교 결과를 선택한 형식으로 저장합니다.',txt:'원문 기록 (TXT)',xlsx:'스프레드시트 (XLSX)',pdf:'PDF 보고서',png:'현재 이미지 보기 (PNG)',zip:'보고서 묶음 (ZIP)' }
} as const;
export type ReportFormat='txt'|'xlsx'|'pdf'|'png'|'zip';
export function ReportExportControl({ snapshot, isCurrent, capture, language='ko', formats, sessionOwner }: { snapshot: ExportSnapshot; isCurrent: (snapshot: ExportSnapshot) => boolean; capture?: CaptureView; language?: 'ko'|'en'; formats?:readonly ReportFormat[];sessionOwner?:ReportSession }) {
  const [format,setFormat]=useState<'txt'|'xlsx'|'pdf'|'png'|'zip'>('txt'),[busy,setBusy]=useState(false),[error,setError]=useState<false|'generic'|'glyph'>(false);
  const available=(['txt','xlsx','pdf','png','zip']as const).filter(value=>(!formats||formats.includes(value))&&(value!=='png'||!!capture&&!!snapshot.view));
  const session=useRef(sessionOwner??new ReportSession()),revision=useRef(0),check=useRef(isCurrent);check.current=isCurrent;const copy=REPORT_COPY[language];
  useEffect(()=>{revision.current++;session.current.cancel();setBusy(false);setError(false);return()=>{revision.current++;void session.current.dispose();};},[snapshot]);
  useEffect(()=>{if(!available.includes(format))setFormat(available[0]??'txt');},[capture,snapshot,format,formats]);
  const start=()=>{
    const version=++revision.current;setBusy(true);setError(false);
    const writer=async(signal:AbortSignal):Promise<Blob>=>{
      if(format==='txt')return writeSnapshotTxt(snapshot);
      if(format==='xlsx')return writeSnapshotXlsx(snapshot,signal);
      if(format==='pdf')return writeSnapshotPdf(snapshot,signal);
      if(format==='png'){if(!capture)throw new Error('REPORT_CAPTURE');return writeSnapshotPng(snapshot,signal,capture);}
      return writeSnapshotZip(snapshot,[{name:'results.xlsx',write:()=>writeSnapshotXlsx(snapshot,signal)}],signal);
    };
    void session.current.run(snapshot,value=>check.current(value),writer,blob=>downloadReport(blob,`comparison-report.${format}`)).catch(reason=>{if(version===revision.current)setError(reason instanceof ReportError&&reason.message==='REPORT_UNSUPPORTED_GLYPH'?'glyph':'generic');}).finally(()=>{if(version===revision.current)setBusy(false);});
  };
  return <div className="my-3"><p className="mb-2 text-sm">{copy.scope} · {copy[snapshot.scope.kind]} · {copy[snapshot.completion]}</p><div className="flex flex-wrap gap-2"><UtilitySelect aria-label={copy.format} value={format} disabled={busy} onChange={e=>setFormat(e.target.value as typeof format)}>{available.map(value=><option key={value} value={value}>{copy[value]}</option>)}</UtilitySelect><Button disabled={busy||!available.length} onClick={start}>{copy.export}</Button><Button variant="outline" disabled={!busy} onClick={()=>{revision.current++;session.current.cancel();setBusy(false);}}>{copy.cancel}</Button></div>{busy&&<p role="status">{copy.busy}</p>}{error&&<UtilityNotice kind="error">{error==='glyph'?copy.unsupportedGlyph:copy.error}</UtilityNotice>}</div>;
}
