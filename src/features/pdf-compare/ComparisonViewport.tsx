import { useEffect, useRef, useState } from "react";
import type { SelectedPreview } from "./types.ts";
export type PdfComparisonView="side"|"overlay"|"fade"|"flicker"|"slider"|"subtract";
/** Display projections of the existing render. Pixel metrics are never recomputed. */
export function ComparisonViewport({preview,view,amount,labels,speed=1,held=null,playing=true}:{preview:SelectedPreview;view:PdfComparisonView;amount:number;labels:{before:string;after:string;none:string;overlay:string;slider:string;subtract:string;fade:string;flicker:string};speed?:number;held?:"before"|"after"|null;playing?:boolean}){
  // Flicker alternates every `speed` seconds (Diffchecker: 0.1-1 s, default 1) unless a side is held.
  const [showAfter,setShowAfter]=useState(false);
  useEffect(()=>{if(view!=="flicker"||held||!playing)return;const timer=setInterval(()=>setShowAfter(value=>!value),1000*speed);return()=>clearInterval(timer);},[view,speed,held,playing]);
  if(view==="flicker"){const after=held?held==="after":showAfter;const canvas=after?preview.after??preview.before:preview.before??preview.after;
    return <div className="mx-auto max-w-full overflow-hidden rounded-2xl bg-white" style={{width:preview.geometry.width}} data-testid="pdf-comparison-viewport" data-view={view} data-showing={after?"after":"before"}><CanvasSlot canvas={canvas} label={after?labels.after:labels.before} none={labels.none}/></div>;}
  if(view==="side")return <div className="grid gap-3 sm:grid-cols-2" data-testid="pdf-comparison-viewport" data-view={view}><CanvasSlot canvas={preview.before} label={labels.before} none={labels.none}/><CanvasSlot canvas={preview.after} label={labels.after} none={labels.none}/></div>;
  const paired=!!preview.before&&!!preview.after;
  const top=view==="overlay"?preview.overlay:paired?preview.after:null;
  // Fade shows the after page over the before page at `amount` opacity.
  const style=view==="overlay"||view==="fade"?{opacity:amount}:view==="slider"?{clipPath:`inset(0 ${(1-amount)*100}% 0 0)`}:{mixBlendMode:"difference" as const};
  return <div className="relative mx-auto max-w-full overflow-hidden rounded-2xl bg-white" style={{width:preview.geometry.width,isolation:"isolate"}} data-testid="pdf-comparison-viewport" data-view={view} aria-label={labels[view]}>
    <CanvasSlot canvas={preview.before??preview.after} label={preview.before?labels.before:labels.after} none={labels.none}/>
    {top&&<div className="pointer-events-none absolute inset-0" style={style}><CanvasSlot canvas={top} label={labels[view]} none={labels.none}/></div>}
    {view==="slider"&&paired&&<div className="pointer-events-none absolute inset-y-0 border-l-2 border-blue-600" style={{left:`${amount*100}%`}}/>}
  </div>;
}
function CanvasSlot({canvas,label,none}:{canvas:HTMLCanvasElement|null;label:string;none:string}){
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{const host=ref.current;if(canvas&&host){host.replaceChildren(canvas);canvas.style.maxWidth="100%";canvas.style.height="auto";canvas.style.display="block";}return()=>{if(host&&canvas?.parentElement===host)host.removeChild(canvas);};},[canvas]);
  return <div className="min-w-0 overflow-auto" ref={ref} role="img" aria-label={label}>{!canvas&&<p className="p-4 text-muted-foreground">{none}</p>}</div>;
}
