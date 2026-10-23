import type { TextOptions, TextResult } from "./resultTypes.ts";
export interface TextSnapshot { left: string; right: string; options: TextOptions; revision: number }
export class TextHistory {
  private past:TextSnapshot[]=[]; private future:TextSnapshot[]=[];
  get canUndo(){return this.past.length>0;} get canRedo(){return this.future.length>0;}
  record(snapshot:TextSnapshot) {
    this.past.push(structuredClone(snapshot));this.future=[];
    let bytes=this.past.reduce((n,s)=>n+2*(s.left.length+s.right.length),0);
    while(this.past.length>20||bytes>64*1024*1024) {const removed=this.past.shift()!;bytes-=2*(removed.left.length+removed.right.length);}
  }
  undo(current:TextSnapshot){const next=this.past.pop();if(next)this.future.push(structuredClone(current));return next;}
  redo(current:TextSnapshot){const next=this.future.pop();if(next)this.past.push(structuredClone(current));return next;}
}
export function mergeRow(snapshot:TextSnapshot,result:TextResult,rowId:string,target:"left"|"right"):TextSnapshot {
  if(snapshot.revision!==result.revision)throw new Error("STALE_COMPARISON");
  const rowIndex=result.rows.findIndex(row=>row.id===rowId);if(rowIndex<0)throw new Error("UNKNOWN_CHANGE");
  const row=result.rows[rowIndex],source=row[target==="left"?"right":"left"],current=row[target];
  const next=result.rows.slice(rowIndex+1).find(item=>item[target])?.[target];
  const start=current?.start??next?.start??snapshot[target].length,end=current?.end??start;
  return {...snapshot,[target]:snapshot[target].slice(0,start)+(source?.raw??"")+snapshot[target].slice(end),revision:snapshot.revision+1};
}
