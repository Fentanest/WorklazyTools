import type {ExportSnapshot,Json} from './snapshot.ts';
export const PDF_COPY={
 ko:{title:'텍스트 비교 보고서',genericTitle:'비교 보고서',scope:'비교 범위',all:'전체 비교 결과',selected:'선택한 비교 결과',completion:'완료 상태',complete:'완료',partial:'일부 결과',canceled:'취소된 작업의 결과',rows:'비교 행 수',left:'원본',right:'수정본',source:'입력 파일',results:'비교 내용',row:'행',lines:'줄',warning:'안내',unknownWarning:'추가 안내가 있습니다. 첨부된 비교 데이터에서 확인할 수 있습니다.',layout:'읽기 쉽도록 탭은 공백 4개로, 줄 끝은 줄바꿈으로 표시합니다. 원래 문자와 줄 끝은 첨부파일에 그대로 보존됩니다.',attachment:'자세한 비교 데이터는 이 PDF의 comparison-data.json 첨부파일에 있습니다. 원문 전체, 비교 설정, 위치와 식별 정보를 확인할 수 있습니다. 일부 PDF 뷰어는 첨부파일 보기를 지원하지 않습니다.',selectedAttachment:'첨부파일에는 선택한 범위의 데이터가 들어 있습니다.',glyphFallback:'글꼴에 없는 문자는 [U+코드] 형식으로 표시했습니다. 원래 문자는 첨부파일에 그대로 보존됩니다.',budget:'처리 한도로 일부 세부 차이를 요약했습니다.',statuses:{equal:'같음',changed:'변경',added:'추가',deleted:'삭제',ignored:'설정에 따라 무시',moved:'이동',unknown:'비교 행'}},
 en:{title:'Text comparison report',genericTitle:'Comparison report',scope:'Comparison scope',all:'Full comparison result',selected:'Selected comparison result',completion:'Completion',complete:'Complete',partial:'Partial result',canceled:'Result of a canceled job',rows:'Compared rows',left:'Original',right:'Revised',source:'Source file',results:'Comparison details',row:'Row',lines:'Lines',warning:'Note',unknownWarning:'Additional notes are available in the attached comparison data.',layout:'For readability, tabs appear as four spaces and line endings appear as line breaks. Original characters and line endings are preserved in the attachment.',attachment:'Detailed comparison data is attached to this PDF as comparison-data.json, including original text, comparison settings, locations and identifiers. Some PDF viewers do not show attachments.',selectedAttachment:'The attachment contains data for the selected scope.',glyphFallback:'Characters missing from the font appear as [U+code]. The original characters are preserved in the attachment.',budget:'Some fine-grained differences were summarized because the comparison limit was reached.',statuses:{equal:'Equal',changed:'Changed',added:'Added',deleted:'Deleted',ignored:'Ignored by settings',moved:'Moved',unknown:'Compared row'}}
}as const;
function object(value:Json|undefined):Readonly<Record<string,Json>>|undefined{return value&&typeof value==='object'&&!Array.isArray(value)?value as Readonly<Record<string,Json>>:undefined;}
/** Display only known coordinates. Full machine coordinates remain in the attachment. */
function lineRange(value:Json|undefined,label:string){const v=object(value),first=v?.firstLine,last=v?.lastLine;if(typeof first!=='number'||!Number.isSafeInteger(first)||first<1)return '';return ` (${label} ${first}${typeof last==='number'&&Number.isSafeInteger(last)&&last>first?`–${last}`:''})`;}
/** Visible blocks in reading order; a PDF leaves one blank line between blocks. */
export function readablePdfBlocks(snapshot:ExportSnapshot,options:{glyphFallback?:boolean}={}):string[][]{
 const c=PDF_COPY[snapshot.language],blocks:string[][]=[[snapshot.tool==='text-compare'?c.title:c.genericTitle]];
 const summary=snapshot.sources.map((source,i)=>`${i===0?c.left:i===1?c.right:`${c.source} ${i+1}`}: ${source.label.split(/[\\/]/u).at(-1)??source.label}`);
 summary.push(`${c.scope}: ${snapshot.scope.label??(snapshot.scope.kind==='all'?c.all:c.selected)}`,`${c.completion}: ${c[snapshot.completion]}`,`${c.rows}: ${snapshot.rows.length}`);
 blocks.push(summary);
 // Human prose can be visible; codes, JSON and diagnostic paths stay in the complete attachment.
 const warnings=snapshot.warnings.map(warning=>`${c.warning}: ${warning==='COMPARISON_BUDGET'?c.budget:/[{}\\]|(?:https?:|\/home\/)|^[A-Z0-9_:-]+$|\p{Extended_Pictographic}/u.test(warning)?c.unknownWarning:warning}`);
 if(warnings.length)blocks.push(warnings);
 blocks.push([c.layout,...(options.glyphFallback?[c.glyphFallback]:[])],[c.attachment,...(snapshot.scope.kind==='selected'?[c.selectedAttachment]:[])],[c.results]);
 snapshot.rows.forEach((row,index)=>{const coordinates=object(row.coordinates),status=c.statuses[row.status as keyof typeof c.statuses]??c.statuses.unknown;
  blocks.push([`${c.row} ${index+1} · ${status}`,c.left+lineRange(coordinates?.left,c.lines)+':',row.left,c.right+lineRange(coordinates?.right,c.lines)+':',row.right]);
 });return blocks;
}
export function readablePdfFields(snapshot:ExportSnapshot):string[]{return readablePdfBlocks(snapshot).flat();}
