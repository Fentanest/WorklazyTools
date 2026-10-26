import type { DocumentComparisonManifest } from './comparisonManifest';
const labels:Record<string,[string,string]>={pagination:['쪽 번호','Page number'], 'automatic-date':['자동 날짜','Automatic date'], 'table-of-contents':['목차·색인','Contents or index'], 'reference-numbering':['참조·연속 번호','Reference or sequence'],value:['문서 값','Document value'],other:['기타 필드','Other field'],incomplete:['불완전한 필드','Incomplete field']};
export function DocumentFieldNotes({manifest,language}:{manifest?:Pick<DocumentComparisonManifest,'fields'>;language:'ko'|'en'}){
 const fields=(['before','after'] as const).flatMap(side=>(manifest?.fields?.[side]??[]).map((field,index)=>({side,field,index})));
 if(!fields.length)return null;
 const en=language==='en';
 return <details className="mt-3 rounded-xl border border-border bg-card p-3 text-sm"><summary className="cursor-pointer font-semibold">{en?'Word fields: stored values':'Word 필드: 저장된 값'} ({fields.length})</summary><p className="my-2">{en?'Fields are not recalculated or silently excluded. Their stored text remains part of the comparison.':'필드를 다시 계산하거나 자동 제외하지 않습니다. 저장된 텍스트도 비교에 포함됩니다.'}</p><ul className="space-y-2">{fields.map(({side,field,index})=><li key={`${side}:${index}`} className="break-words"><strong>{side==='before'?(en?'Before':'수정 전'):(en?'After':'수정 후')} · {labels[field.kind]?.[en?1:0]??labels.other[en?1:0]}</strong><div className="whitespace-pre-wrap"><code>{field.instruction}</code> → {field.cachedText}</div></li>)}</ul></details>;
}
