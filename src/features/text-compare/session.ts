import type { TextOptions, TextResult } from "./resultTypes.ts";
import type { TextSource } from "./input.ts";
export interface TextSnapshot { left: string; right: string; options: TextOptions; revision: number; sources?:Partial<Record<"left"|"right",TextSource>> }
export class TextHistory {
  private past:TextSnapshot[]=[]; private future:TextSnapshot[]=[];
  private maxEntries:number;private maxBytes:number;
  constructor(maxEntries=20,maxBytes=64*1024*1024){this.maxEntries=maxEntries;this.maxBytes=maxBytes;}
  get canUndo(){return this.past.length>0;} get canRedo(){return this.future.length>0;}
  record(snapshot:TextSnapshot) {
    this.past.push(structuredClone(snapshot));this.future=[];
    this.trim();
  }
  private trim(){
    const size=(s:TextSnapshot)=>2*(s.left.length+s.right.length+(s.sources?.left?.text.length??0)+(s.sources?.right?.text.length??0));
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
  const start=current?.start??next?.start??snapshot[target].length,end=current?.end??start;
  return {...snapshot,[target]:snapshot[target].slice(0,start)+(source?.raw??"")+snapshot[target].slice(end),revision:snapshot.revision+1};
}
