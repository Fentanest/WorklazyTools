import type { TextResult } from '../text-compare/resultTypes.ts';
import type { TextSnapshot } from '../text-compare/session.ts';
import { canonical, createExportSnapshot, assertReport, type Json, type ExportSnapshot } from './snapshot.ts';
/** Projection of the authoritative compared rows. Search, folding and display order never re-align data. */
export type TextExportScope='all'|'changed'|{displayedIds:readonly string[]};
export function textExportSnapshot(result: TextResult, source: TextSnapshot, language: 'ko'|'en', scope:TextExportScope = 'all') {
  assertReport(result.revision === source.revision && canonical(result.options) === canonical(source.options), 'REPORT_STALE');
  const provenance=(result as TextResult&{provenance?:{policyVersion:string;rules:readonly {id:number;literal:string}[]}}).provenance;
  const provenanceSummary=provenance?{policyVersion:provenance.policyVersion,rules:provenance.rules.map(rule=>({id:rule.id,literal:rule.literal}))}:null;
  const ids = typeof scope==='object'?[...scope.displayedIds]:scope==='changed'?result.rows.filter(row => ['changed','added','deleted'].includes(row.kind)).map(row => row.id):undefined;
  return createExportSnapshot({ language, tool:'text-compare', sources: (['left','right'] as const).map(side => ({ id:source.sources?.[side]?.sourceRevision??side, revision:String(source.revision), label:source.sources?.[side]?.name ?? (language==='ko'?(side==='left'?'원본 텍스트':'수정본 텍스트'):(side==='left'?'Original text':'Revised text')) })),
    appliedOptions:{normalizationProvenance:provenanceSummary,exportScope:typeof scope==='object'?'displayed':scope,exportStyle:{pdf:{background:'white',textRgb:[0.08,0.08,0.1],layout:'plain-records'},xlsx:{cells:'literal-text'},txt:{encoding:'utf-8',layout:'lossless-json-records'},screenThemeApplied:false},comparison:result.options as unknown as Json,originalInputs:{left:source.sources?.left?{revision:source.sources.left.sourceRevision??null,bytes:source.sources.left.bytes??null,mime:source.sources.left.mime??null}:null,right:source.sources?.right?{revision:source.sources.right.sourceRevision??null,bytes:source.sources.right.bytes??null,mime:source.sources.right.mime??null}:null},encoding:{left:source.sources?.left?.encoding??'utf-8',right:source.sources?.right?.encoding??'utf-8',leftBom:source.sources?.left?.bom??false,rightBom:source.sources?.right?.bom??false}},
    coordinates:{unit:'utf16-code-units',origin:0,coordinateSpace:'working-text',sourceRevision:source.revision,workingRevision:source.revision,originalSourceRevisions:{left:source.sources?.left?.sourceRevision??null,right:source.sources?.right?.sourceRevision??null}}, warnings:[...result.reasons,...(result.quality==='full'?[]:[language==='ko'?'처리 한도로 일부 세부 차이를 요약한 결과입니다.':'Some fine-grained differences were summarized because the comparison limit was reached.'])], completion:result.quality==='full'?'complete':'partial',
    scope:ids?{kind:'selected',ids,label:typeof scope==='object'?(language==='ko'?'현재 표시 범위(접힌 줄 제외)':'Displayed rows (excluding folded lines)'):(language==='ko'?'변경·추가·삭제 행':'Changed, added and deleted rows')}:{kind:'all'},
    ...(scope!=='all'?{}:{rawSources:{left:source.left,right:source.right}}),
    rows:result.rows.map(row=>({id:row.id,status:row.kind,left:row.left?.raw??'',right:row.right?.raw??'',coordinates:{left:row.left?{start:row.left.start,end:row.left.end,firstLine:row.left.number,lastLine:row.left.lastNumber}:null,right:row.right?{start:row.right.start,end:row.right.end,firstLine:row.right.number,lastLine:row.right.lastNumber}:null},metadata:{leftMarks:row.leftMarks as unknown as Json,rightMarks:row.rightMarks as unknown as Json}})) });
}

export function textDisplayedScopeCurrent(snapshot:ExportSnapshot,ids:readonly string[]|undefined){
 if((snapshot.appliedOptions as Record<string,unknown>).exportScope!=='displayed')return true;
 return !!ids&&snapshot.scope.ids?.length===ids.length&&snapshot.scope.ids.every((id,index)=>id===ids[index]);
}
