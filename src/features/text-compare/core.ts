import { diffText } from "../document-compare/documentComparison.ts";
import { alignSequenceWithBudget } from "../../utils/sequenceAlignment.ts";
import { mapText } from "./ignore.ts";
import type { MappedText, TextLine, TextMark, TextOptions, TextResult, TextRow } from "./resultTypes.ts";

type Segment = { type: "equal" | "deleted" | "added"; text: string };
const CELL_BUDGET = 1_500_000;
export function mappedLines(mapped: MappedText): TextLine[] {
  const lines: TextLine[] = []; let rawStart = 0, number = 1;
  const matches = [...mapped.value.matchAll(/[^\n]*\n|[^\n]+$/g)];
  if (!matches.length && mapped.raw) return [{ raw: mapped.raw, key: "", start: 0, end: mapped.raw.length, number: 1, lastNumber: mapped.raw.split("\n").length, normalizedStart: 0 }];
  for (const match of matches) {
    const index = match.index!; const next = index + match[0].length;
    const rawEnd = next < mapped.starts.length ? mapped.starts[next] : mapped.raw.length;
    const raw = mapped.raw.slice(rawStart, rawEnd), breaks = (raw.match(/\n/g) ?? []).length;
    lines.push({ raw, key: match[0], start: rawStart, end: rawEnd, number, lastNumber: number + breaks - (raw.endsWith("\n") ? 1 : 0), normalizedStart: index });
    rawStart = rawEnd; number += breaks;
  }
  return lines;
}
function graphemeDiff(left: string, right: string, check: () => void): { segments: Segment[]; coarse: boolean } {
  if(left.length+right.length>100_000)return {segments:[...(left?[{type:"deleted" as const,text:left}]:[]),...(right?[{type:"added" as const,text:right}]:[])],coarse:true};
  if (!Intl.Segmenter) throw new Error("GRAPHEME_UNAVAILABLE");
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const a = Array.from(segmenter.segment(left), item => item.segment), b = Array.from(segmenter.segment(right), item => item.segment);
  const aligned = alignSequenceWithBudget(a, b, { signature: x => x, equals: (x,y) => x===y, score: (x,y) => x===y?3:-3, acceptsPair: (x,y)=>x===y, cellBudget: CELL_BUDGET, checkCanceled: check });
  const segments: Segment[] = [];
  const push = (type: Segment['type'], text: string) => { if (!text) return; const previous=segments.at(-1); if(previous?.type===type) previous.text+=text; else segments.push({type,text}); };
  for (const pair of aligned.pairs) {
    const x = pair.beforeIndex === null ? "" : a[pair.beforeIndex], y = pair.afterIndex === null ? "" : b[pair.afterIndex];
    if (x && x === y) push("equal",x); else { push("deleted",x); push("added",y); }
  }
  return { segments, coarse: aligned.budgetFallback };
}
function marks(mapped: MappedText, line: TextLine | undefined, segments: Segment[], side: "left"|"right"): TextMark[] {
  if (!line) return [];
  const result: TextMark[] = []; let position=line.normalizedStart;
  for (const segment of segments) {
    if ((side==="left" && segment.type==="added") || (side==="right" && segment.type==="deleted")) continue;
    const end=position+segment.text.length;
    if (segment.type!=="equal") for(let i=position;i<end;i++) {
      const start=mapped.starts[i],rawEnd=mapped.ends[i],previous=result.at(-1);
      if(previous?.kind==="changed"&&start<=previous.end)previous.end=Math.max(previous.end,rawEnd);
      else result.push({start,end:rawEnd,kind:"changed"});
    }
    position=end;
  }
  for (const removed of mapped.removed) if(removed.start<line.end && removed.end>line.start) result.push({start:Math.max(removed.start,line.start),end:Math.min(removed.end,line.end),kind:"ignored"});
  return result;
}
export function compareTexts(left: string, right: string, options: TextOptions, revision=0, deadlineMs=5000): TextResult {
  if (left.length+right.length>4_000_000) throw new Error("TEXT_TOO_LARGE");
  for(const text of [left,right]){let breaks=0;for(let i=0;i<text.length;i++)if(text.charCodeAt(i)===10&&++breaks>200_000)throw new Error("TEXT_LINE_LIMIT");if(breaks+(text.endsWith("\n")?0:1)>200_000)throw new Error("TEXT_LINE_LIMIT");}
  const deadline=performance.now()+deadlineMs, check=()=>{if(performance.now()>deadline) throw new Error("TEXT_TIMEOUT");};
  const lm=mapText(left,options), rm=mapText(right,options); check();
  const a=mappedLines(lm),b=mappedLines(rm);
  if (!lm.value && !rm.value && (left || right)) {
    const empty:TextLine={raw:"",key:"",start:0,end:0,number:1,lastNumber:1,normalizedStart:0};
    if(!a.length)a.push(empty);if(!b.length)b.push(empty);
  }
  const aligned=alignSequenceWithBudget(a,b,{signature:x=>x.key,equals:(x,y)=>x.key===y.key,score:(x,y)=>x.key===y.key?5:0,acceptsPair:()=>true,cellBudget:CELL_BUDGET,checkCanceled:check});
  let coarse=aligned.budgetFallback;
  const counts={changed:0,added:0,deleted:0,ignored:0,equal:0};
  const rows=aligned.pairs.map<TextRow>((pair,index)=>{
    check(); const l=pair.beforeIndex===null?undefined:a[pair.beforeIndex],r=pair.afterIndex===null?undefined:b[pair.afterIndex];
    const kind=!l?"added":!r?"deleted":l.key===r.key?(l.raw===r.raw?"equal":"ignored"):"changed";
    counts[kind]++;
    let segments:Segment[];
    if (kind==="equal"||kind==="ignored") segments=[{type:"equal",text:l?.key??r?.key??""}];
    else if (options.mode==="character") { const result=graphemeDiff(l?.key??"",r?.key??"",check);segments=result.segments;coarse ||=result.coarse; }
    else {
      const lv=l?.key??"",rv=r?.key??"";
      const tokens=(text:string)=>(text.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu)??[]).length;
      if ((tokens(lv)+1)*(tokens(rv)+1)>CELL_BUDGET) coarse=true;
      segments=diffText(lv,rv);
      if(options.mode==="smart") {
        const refined:Segment[]=[];
        for(let i=0;i<segments.length;) {
          if(segments[i].type==="equal") {refined.push(segments[i++]);continue;}
          let deleted="",added="";
          while(i<segments.length&&segments[i].type!=="equal") {const s=segments[i++];if(s.type==="deleted")deleted+=s.text;else added+=s.text;}
          if(deleted&&added&&Math.max(deleted.length,added.length)<=4000) {const result=graphemeDiff(deleted,added,check);refined.push(...result.segments);coarse ||=result.coarse;}
          else {if(deleted)refined.push({type:"deleted",text:deleted});if(added)refined.push({type:"added",text:added});}
        }
        segments=refined;
      }
    }
    return {id:`${revision}:${index}`,kind,left:l,right:r,leftMarks:marks(lm,l,segments,"left"),rightMarks:marks(rm,r,segments,"right")};
  });
  return {revision,options:structuredClone(options),rows,counts,quality:coarse?"line-coarse":"full",reasons:coarse?["COMPARISON_BUDGET"]:[]};
}
