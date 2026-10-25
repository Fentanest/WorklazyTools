import type { TextOptions, TextResult } from "./resultTypes.ts";
import type { TextSource } from "./input.ts";
export interface TextSnapshot { left: string; right: string; options: TextOptions; revision: number; sources?:Partial<Record<"left"|"right",TextSource>> }
export class TextHistory {
  private past:TextSnapshot[]=[]; private future:TextSnapshot[]=[];
  private maxEntries:number;private maxBytes:number;
  constructor(maxEntries=20,maxBytes=64*1024*1024){this.maxEntries=maxEntries;this.maxBytes=maxBytes;}
  get canUndo(){return this.past.length>0;} get canRedo(){return this.future.length>0;}
  clear(){this.past=[];this.future=[];}
  record(snapshot:TextSnapshot) {
    this.past.push(structuredClone(snapshot));this.future=[];
    this.trim();
  }
  private trim(){
    // Bounded reservation for strings, rules and small record metadata; not measured heap/RSS.
    const size=(s:TextSnapshot)=>256+2*(s.left.length+s.right.length+(s.sources?.left?.text.length??0)+(s.sources?.right?.text.length??0)+(s.sources?.left?.name.length??0)+(s.sources?.right?.name.length??0))+s.options.ignoreRules.reduce((sum,rule)=>sum+64+2*rule.length,0);
    let bytes=[...this.past,...this.future].reduce((n,s)=>n+size(s),0);
    while(this.past.length+this.future.length>this.maxEntries||bytes>this.maxBytes){const removed=(this.past.length?this.past:this.future).shift()!;bytes-=size(removed);}
  }
  undo(current:TextSnapshot){const next=this.past.pop();if(next)this.future.push(structuredClone(current));this.trim();return next;}
  redo(current:TextSnapshot){const next=this.future.pop();if(next)this.past.push(structuredClone(current));this.trim();return next;}
}
export function mergeRow(snapshot:TextSnapshot,result:TextResult,rowId:string,target:"left"|"right"):TextSnapshot {
  if(snapshot.revision!==result.revision)throw new Error("STALE_COMPARISON");
  const rowIndex=result.rows.findIndex(row=>row.id===rowId);if(rowIndex<0)throw new Error("UNKNOWN_CHANGE");
  const row=result.rows[rowIndex],source=row[target==="left"?"right":"left"],current=row[target];
  const next=result.rows.slice(rowIndex+1).find(item=>item[target])?.[target];
  const text=snapshot[target];
  let start=current?.start??next?.start??text.length,end=current?.end??start;
  // The merged lines take the target's line ending; the target keeps its own terminator at the end.
  const eol=/\r\n/u.test(text)?"\r\n":"\n",ending=/\r?\n$/u;
  let insertion="";
  if(source){
    const body=source.raw.replace(ending,"").replace(/\r?\n/gu,eol);
    const terminated=current?ending.test(current.raw):start<text.length||ending.test(source.raw);
    insertion=body+(terminated?eol:"");
    if(start===text.length&&text&&!ending.test(text))insertion=eol+insertion;
  }else if(current&&end===text.length&&!ending.test(current.raw)){
    // Removing a last line without a terminator also removes the break before it.
    start=Math.max(0,start-(text.slice(0,start).match(/\r?\n$/u)?.[0].length??0));
  }
  return {...snapshot,[target]:text.slice(0,start)+insertion+text.slice(end),revision:snapshot.revision+1};
}
