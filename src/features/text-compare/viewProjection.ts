import {TEXT_VIEW_DEFAULTS} from "./viewDefaults.ts";
import {rawSearchMatches,type RawSearchMatch} from "./search.ts";
import type { TextRow, TextLine, TextMark } from "./resultTypes.ts";
import { highlighterLoaded, highlightSpans, type SyntaxLanguage } from "./syntaxHighlight.ts";
export type TextViewEntry = { kind: "row"; row: TextRow; search?:{left:RawSearchMatch[];right:RawSearchMatch[];truncated:boolean} } | { kind: "fold"; id: string; count: number };
export interface TextDisplayStyle { palette:"standard"|"contrast"; bold:boolean; underline:boolean; syntax:"plain"|SyntaxLanguage }
export const MAX_TEXT_RENDER_PIECES=512;
export function syntaxSpans(text:string,syntax:TextDisplayStyle['syntax'],limit=MAX_TEXT_RENDER_PIECES) {
  if(syntax==="plain")return [];
  // highlight.js (Diffchecker's 21 languages) once loaded; until then JSON and JavaScript use the built-in tokenizer.
  if(highlighterLoaded())return highlightSpans(text,syntax,limit);
  if(syntax!=="json"&&syntax!=="javascript")return [];
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
export function textRenderPieces(line:TextLine,marks:TextMark[],mode:TextDisplayStyle['syntax'],search:RawSearchMatch[]=[]) {
  const plain=()=>({coarse:true,searchLimited:search.length>0,pieces:[{start:line.start,text:line.raw,mark:undefined as TextMark['kind']|undefined,syntax:undefined as string|undefined,search:false}]});
  if(marks.length*2+1>MAX_TEXT_RENDER_PIECES)return plain();
  const syntax=syntaxSpans(line.raw,mode,Math.floor(MAX_TEXT_RENDER_PIECES/2)).map(s=>({...s,start:s.start+line.start,end:s.end+line.start}));
  if((marks.length+syntax.length)*2+1>MAX_TEXT_RENDER_PIECES)return plain();
  const shownSearch=search.slice(0,Math.max(0,Math.floor((MAX_TEXT_RENDER_PIECES-1)/2)-marks.length-syntax.length));
  const ordered=[...marks].sort((a,b)=>a.start-b.start||a.end-b.end),boundaries=new Set([line.start,line.end]);
  for(const span of [...ordered,...syntax,...shownSearch]){boundaries.add(span.start);boundaries.add(span.end);}
  const points=[...boundaries].sort((a,b)=>a-b);let mi=0,si=0,qi=0;
  const pieces=points.slice(0,-1).map((start,i)=>{
    const end=points[i+1];while(mi<ordered.length&&ordered[mi].end<=start)mi++;while(si<syntax.length&&syntax[si].end<=start)si++;while(qi<shownSearch.length&&shownSearch[qi].end<=start)qi++;
    return {start,text:line.raw.slice(start-line.start,end-line.start),search:!!(shownSearch[qi]?.start<=start&&shownSearch[qi]?.end>=end),mark:ordered[mi]?.start<=start&&ordered[mi]?.end>=end?ordered[mi].kind:undefined,syntax:syntax[si]?.start<=start&&syntax[si]?.end>=end?syntax[si].kind:undefined};
  });
  return {coarse:false,searchLimited:shownSearch.length<search.length,pieces};
}
export function projectTextRows(rows: TextRow[], fold: boolean, expanded: ReadonlySet<string>, search: string): TextViewEntry[] {
  const query=search.toLocaleLowerCase();
  if(query){
    let remaining=TEXT_VIEW_DEFAULTS.maxSearchMatches;
    const matches:TextViewEntry[]=[];
    for(const row of rows){const left=rawSearchMatches(row.left?.raw??"",query,row.left?.start??0,remaining);remaining-=left.ranges.length;const right=rawSearchMatches(row.right?.raw??"",query,row.right?.start??0,remaining);remaining-=right.ranges.length;
      if(left.matched||right.matched)matches.push({kind:"row",row,search:{left:left.ranges,right:right.ranges,truncated:left.truncated||right.truncated}});
    }
    return matches;
  }
  const result:TextViewEntry[]=[];
  for(let i=0;i<rows.length;) {
    let end=i+1;
    if(fold&&rows[i].kind==="equal")while(end<rows.length&&rows[end].kind==="equal")end++;
    const id=rows[i].id;
    if(fold&&end-i>TEXT_VIEW_DEFAULTS.foldMinEqualLines&&!expanded.has(id)) {
      result.push(...rows.slice(i,i+TEXT_VIEW_DEFAULTS.contextLines).map(row=>({kind:"row" as const,row})),{kind:"fold",id,count:end-i-2*TEXT_VIEW_DEFAULTS.contextLines},...rows.slice(end-TEXT_VIEW_DEFAULTS.contextLines,end).map(row=>({kind:"row" as const,row})));
    } else for(let n=i;n<end;n++)result.push({kind:"row",row:rows[n]});
    i=end;
  }
  return result;
}
