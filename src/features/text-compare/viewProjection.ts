import type { TextRow, TextLine, TextMark } from "./resultTypes.ts";
export type TextViewEntry = { kind: "row"; row: TextRow } | { kind: "fold"; id: string; count: number };
export interface TextDisplayStyle { palette:"standard"|"contrast"; bold:boolean; underline:boolean; syntax:"plain"|"json"|"javascript" }
export const MAX_TEXT_RENDER_PIECES=512;
export function syntaxSpans(text:string,syntax:TextDisplayStyle['syntax'],limit=MAX_TEXT_RENDER_PIECES) {
  if(syntax==="plain")return [];
  const spans:Array<{start:number;end:number;kind:string}>=[];
  const words=new Set(syntax==="json"?["true","false","null"]:["const","let","var","function","return","if","else","class","new","async","await","true","false","null","undefined","import","export","from"]);
  const digit=(c:string|undefined)=>c!==undefined&&c>="0"&&c<="9";
  const identifier=(c:string|undefined)=>c!==undefined&&/^[A-Za-z0-9_$]$/.test(c);
  let i=0;
  while(i<text.length){
    const start=i,c=text[i];let kind:string|undefined;
    if(syntax==="javascript"&&c==="/"&&text[i+1]==="/"){const end=text.indexOf("\n",i+2);i=end<0?text.length:end;kind="comment";}
    else if(syntax==="javascript"&&c==="/"&&text[i+1]==="*"){const end=text.indexOf("*/",i+2);i=end<0?text.length:end+2;kind="comment";}
    else if(c==='"'||syntax==="javascript"&&(c==="'"||c==="`")){i++;while(i<text.length){if(text[i]==="\\"){i=Math.min(text.length,i+2);continue;}if(text[i++]===c)break;}kind="string";}
    else if(digit(c)||c==="-"&&digit(text[i+1])){
      if(c==="-")i++;while(digit(text[i]))i++;
      if(text[i]==="."&&digit(text[i+1])){i++;while(digit(text[i]))i++;}
      if(text[i]==="e"||text[i]==="E"){let j=i+1;if(text[j]==="+"||text[j]==="-")j++;if(digit(text[j])){i=j+1;while(digit(text[i]))i++;}}
      kind="number";
    }else if(identifier(c)){i++;while(identifier(text[i]))i++;if(words.has(text.slice(start,i)))kind="keyword";}
    else i++;
    if(kind){spans.push({start,end:i,kind});if(spans.length>limit)break;}
  }
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
