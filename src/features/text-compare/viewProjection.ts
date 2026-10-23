import type { TextRow } from "./resultTypes.ts";
export type TextViewEntry = { kind: "row"; row: TextRow } | { kind: "fold"; id: string; count: number };
export interface TextDisplayStyle { palette:"standard"|"contrast"; bold:boolean; underline:boolean; syntax:"plain"|"json"|"javascript" }
export function syntaxSpans(text:string,syntax:TextDisplayStyle['syntax']) {
  if(syntax==="plain")return [];
  const pattern=syntax==="json"?/"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g
    :/\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:const|let|var|function|return|if|else|class|new|async|await|true|false|null|undefined|import|export|from)\b|\b\d+(?:\.\d+)?\b/g;
  return [...text.matchAll(pattern)].map(match=>({start:match.index!,end:match.index!+match[0].length,kind:match[0].startsWith('/')?'comment':/^["']/.test(match[0])?'string':/^-?\d/.test(match[0])?'number':'keyword'}));
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
