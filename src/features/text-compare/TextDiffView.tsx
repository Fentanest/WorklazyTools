import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { projectTextRows, textRenderPieces, type TextDisplayStyle } from "./viewProjection.ts";
import type { TextLine, TextMark, TextResult } from "./resultTypes.ts";

type Translate=(key:string,values?:Record<string,unknown>)=>string;
export function TextDiffView({result,unified,wrap,fold,search,stale,onMerge,t,focusId,display,focusRequest}:{result:TextResult;unified:boolean;wrap:boolean;fold:boolean;search:string;stale:boolean;onMerge:(id:string,side:"left"|"right")=>void;t:Translate;focusId?:string;focusRequest:number;display:TextDisplayStyle}) {
  const [expanded,setExpanded]=useState(new Set<string>()),[top,setTop]=useState(0),[measureVersion,setMeasureVersion]=useState(0);
  const container=useRef<HTMLDivElement>(null),heights=useRef(new Map<string,number>());
  const entries=useMemo(()=>projectTextRows(result.rows,fold,expanded,search),[result,fold,expanded,search]);
  const keyOf=(index:number)=>entries[index].kind==="row"?entries[index].row.id:`fold:${entries[index].id}`;
  const offsets=useMemo(()=>{const values=[0];entries.forEach((_,i)=>values.push(values.at(-1)!+(heights.current.get(keyOf(i))??48)));return values;},[entries,measureVersion,wrap,unified]);
  let low=0,high=entries.length;while(low<high){const mid=(low+high)>>>1;if(offsets[mid+1]<top)low=mid+1;else high=mid;}
  const start=Math.max(0,low-8);let end=low;while(end<entries.length&&offsets[end]<top+900)end++;end=Math.min(entries.length,end+8);
  useLayoutEffect(()=>{
    heights.current.clear();setMeasureVersion(v=>v+1);setTop(0);if(container.current)container.current.scrollTop=0;
  },[result,wrap,unified,fold,search]);
  useLayoutEffect(()=>{if(!focusId)return;const index=entries.findIndex(entry=>entry.kind==="row"&&entry.row.id===focusId);if(index>=0&&container.current){container.current.scrollTop=offsets[index];setTop(offsets[index]);}},[focusId,focusRequest]);
  useLayoutEffect(()=>{
    if(!container.current)return;
    const observer=new ResizeObserver(records=>{
      let changed=false;for(const record of records){const key=(record.target as HTMLElement).dataset.measureKey!;const height=record.target.getBoundingClientRect().height;if(heights.current.get(key)!==height){heights.current.set(key,height);changed=true;}}
      if(changed)setMeasureVersion(v=>v+1);
    });
    container.current.querySelectorAll('[data-measure-key]').forEach(node=>observer.observe(node));return()=>observer.disconnect();
  },[entries,start,end,wrap,unified]);
  return <div ref={container} style={{height:Math.min(560,Math.max(120,offsets.at(-1)??0))}} className="overflow-auto rounded-xl border border-border bg-background" tabIndex={0} role="region" aria-label={t("result")} onScroll={event=>setTop(event.currentTarget.scrollTop)} data-testid="text-diff-view">
    {!entries.length&&<p className="p-4">{t("noRows")}</p>}
    <div style={{height:offsets[start]}} aria-hidden="true" />
    {entries.slice(start,end).map((entry,index)=>{
      const key=keyOf(start+index);
      if(entry.kind==="fold")return <div key={key} data-measure-key={key} className="border-b border-border p-2 text-center"><Button variant="ghost" onClick={()=>setExpanded(old=>new Set([...old,entry.id]))}>{t("expandLines",{count:entry.count})}</Button></div>;
      const row=entry.row;
      return <div key={key} data-measure-key={key} data-row-id={row.id} data-kind={row.kind} className={`border-b border-border ${unified?"":"grid grid-cols-2"} ${focusId===row.id?"ring-2 ring-inset ring-primary":""}`}>
        {(["left","right"] as const).map(side=><div key={side} className="min-w-0 border-r border-border px-2 py-2" data-side={side}>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{t(side)} {row[side]?.number??"—"}{row[side]&&row[side]!.lastNumber>row[side]!.number?`–${row[side]!.lastNumber}`:""} · {t(`kind.${row.kind}`)}</span>{row.kind!=="equal"&&<button type="button" className="rounded border border-border px-2 disabled:opacity-40" disabled={stale} onClick={()=>onMerge(row.id,side)} aria-label={t(side==="left"?"copyRight":"copyLeft")}>{side==="left"?"←":"→"}</button>}</div>
          <MarkedLine line={row[side]} marks={side==="left"?row.leftMarks:row.rightMarks} side={side} display={display} wrap={wrap} note={t("denseLine")}/>
        </div>)}
      </div>;
    })}
    <div style={{height:offsets.at(-1)!-offsets[end]}} aria-hidden="true" />
  </div>;
}
function MarkedLine({line,marks,side,display,wrap,note}:{line?:TextLine;marks:TextMark[];side:"left"|"right";display:TextDisplayStyle;wrap:boolean;note:string}) {
  if(!line)return null;
  const rendered=textRenderPieces(line,marks,display.syntax);
  return <>{rendered.coarse&&<p className="text-xs text-muted-foreground" data-testid="text-render-coarse">{note}</p>}<pre className={`m-0 min-h-6 font-mono text-sm ${wrap?"whitespace-pre-wrap break-words":"whitespace-pre overflow-x-auto"}`}>{rendered.pieces.map(({start,text,mark:kind,syntax:syntaxKind})=>{
    const color=kind==="changed"?(display.palette==="contrast"?(side==="left"?"bg-orange-100 text-orange-950 dark:bg-orange-950 dark:text-orange-100":"bg-blue-100 text-blue-950 dark:bg-blue-950 dark:text-blue-100"):(side==="left"?"bg-red-100 text-red-950 dark:bg-red-950 dark:text-red-100":"bg-green-100 text-green-950 dark:bg-green-950 dark:text-green-100")):kind==="ignored"?"bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200":syntaxKind==="string"?"text-emerald-800 dark:text-emerald-300":syntaxKind==="number"?"text-orange-800 dark:text-orange-300":syntaxKind==="keyword"?"text-violet-800 dark:text-violet-300":syntaxKind==="comment"?"text-muted-foreground":"";
    return <span key={start} className={`${color} ${kind==="changed"&&display.bold?"font-bold":""} ${kind==="changed"&&display.underline?"underline":""}`}>{text}</span>;
  })}</pre></>;
}
