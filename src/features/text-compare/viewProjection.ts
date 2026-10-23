import type { TextRow, TextLine, TextMark } from "./resultTypes.ts";
export type TextViewEntry = { kind: "row"; row: TextRow } | { kind: "fold"; id: string; count: number };
export interface TextDisplayStyle { palette:"standard"|"contrast"; bold:boolean; underline:boolean; syntax:"plain"|"json"|"javascript" }
export const MAX_TEXT_RENDER_PIECES=512;
export function syntaxSpans(text:string,syntax:TextDisplayStyle['syntax'],limit=MAX_TEXT_RENDER_PIECES) {
  if(syntax==="plain")return [];
  const pattern=syntax==="json"?/"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g
    :/\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:const|let|var|function|return|if|else|class|new|async|await|true|false|null|undefined|import|export|from)\b|\b\d+(?:\.\d+)?\b/g;
  const spans=[];
  for(const match of text.matchAll(pattern)){spans.push({start:match.index!,end:match.index!+match[0].length,kind:match[0].startsWith('/')?'comment':/^["']/.test(match[0])?'string':/^-?\d/.test(match[0])?'number':'keyword'});if(spans.length>limit)break;}
  return spans;
}
export function textRenderPieces(line:TextLine,marks:TextMark[],mode:TextDisplayStyle['syntax']) {
  const plain=()=>({coarse:true,pieces:[{start:line.start,text:line.raw,mark:undefined as TextMark['kind']|undefined,syntax:undefined as string|undefined}]});
  if(marks.length*2+1>MAX_TEXT_RENDER_PIECES)return plain();
  const syntax=syntaxSpans(line.raw,mode,Math.floor(MAX_TEXT_RENDER_PIECES/2)).map(s=>({...s,start:s.start+line.start,end:s.end+line.start}));
  if((marks.length+syntax.length)*2+1>MAX_TEXT_RENDER_PIECES)return plain();
  const ordered=[...marks].sort((a,b)=>a.start-b.start||a.end-b.end),boundaries=new Set([line.start,line.end]);
  for(const span of [...ordered,...syntax]){boundaries.add(span.start);boundaries.add(span.end);}
  const points=[...boundaries].sort((a,b)=>a-b);let mi=0,si=0;
  const pieces=points.slice(0,-1).map((start,i)=>{
    const end=points[i+1];while(mi<ordered.length&&ordered[mi].end<=start)mi++;while(si<syntax.length&&syntax[si].end<=start)si++;
    return {start,text:line.raw.slice(start-line.start,end-line.start),mark:ordered[mi]?.start<=start&&ordered[mi]?.end>=end?ordered[mi].kind:undefined,syntax:syntax[si]?.start<=start&&syntax[si]?.end>=end?syntax[si].kind:undefined};
  });
  return {coarse:false,pieces};
}
export function projectTextRows(rows: TextRow[], fold: boolean, expanded: ReadonlySet<string>, search: string): TextViewEntry[] {
  const query=search.toLocaleLowerCase();
  if(query)return rows.filter(r=>`${r.left?.raw??""}\n${r.right?.raw??""}`.toLocaleLowerCase().includes(query)).map(row=>({kind:"row",row}));
  const result:TextViewEntry[]=[];
  for(let i=0;i<rows.length;) {
    let end=i+1;
    if(fold&&rows[i].kind==="equal")while(end<rows.length&&rows[end].kind==="equal")end++;
    const id=rows[i].id;
    if(fold&&end-i>10&&!expanded.has(id)) {
      result.push(...rows.slice(i,i+3).map(row=>({kind:"row" as const,row})),{kind:"fold",id,count:end-i-6},...rows.slice(end-3,end).map(row=>({kind:"row" as const,row})));
    } else for(let n=i;n<end;n++)result.push({kind:"row",row:rows[n]});
    i=end;
  }
  return result;
}
