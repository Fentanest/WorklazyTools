import { useEffect, useRef, useState } from 'react';
import type { MaskRect, PageSize } from './types';
import { clampMask, clientDelta } from './uiState';

interface Props {
  page: PageSize; masks: MaskRect[]; selected: number; labels: Record<string, string>;
  disabled?: boolean; onSelect(index: number): void; onCommit(masks: MaskRect[]): void;
}

export function MaskEditor({ page, masks, selected, labels, disabled, onSelect, onCommit }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<MaskRect[] | null>(null);
  const draftRef = useRef<MaskRect[] | null>(null);
  const shown = draft ?? masks;
  const drag = useRef<{ index:number; x:number; y:number; start:MaskRect; resize:boolean } | null>(null);
  useEffect(() => { draftRef.current=null; setDraft(null); }, [masks]);
  const update = (index:number, mask:MaskRect) => onCommit(masks.map((old, i) => i === index ? clampMask(mask, page) : old));
  return <div ref={root} className="redactor-mask-layer" aria-label={labels.canvas}>
    {shown.map((mask, index) => <div key={index} className={`redactor-mask ${selected === index ? 'is-selected' : ''}`}
      style={{ left:`${mask.x*100}%`, top:`${mask.y*100}%`, width:`${mask.w*100}%`, height:`${mask.h*100}%` }}
      role="button" tabIndex={disabled ? -1 : 0} aria-label={`${labels.mask} ${index+1}`}
      onFocus={() => onSelect(index)} onPointerDown={event => {
        if (disabled) return; event.preventDefault(); onSelect(index); event.currentTarget.setPointerCapture(event.pointerId);
        drag.current={index,x:event.clientX,y:event.clientY,start:{...mask},resize:(event.target as HTMLElement).dataset.resize==='true'};
      }} onPointerMove={event => {
        const state=drag.current; const box=root.current?.getBoundingClientRect(); if(!state||!box) return;
        const delta=clientDelta(event.clientX-state.x,event.clientY-state.y,box,page);
        const next=state.resize?{...state.start,w:state.start.w+delta.x,h:state.start.h+delta.y}:{...state.start,x:state.start.x+delta.x,y:state.start.y+delta.y};
        const nextMasks=masks.map((old,i)=>i===state.index?clampMask(next,page):old);draftRef.current=nextMasks;setDraft(nextMasks);
      }} onPointerUp={() => { if(draftRef.current) onCommit(draftRef.current); drag.current=null; draftRef.current=null;setDraft(null); }}
      onPointerCancel={() => { drag.current=null; draftRef.current=null;setDraft(null); }}
      onKeyDown={event => {
        if (disabled) return;
        if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();onCommit(masks.filter((_,i)=>i!==index));return;}
        const amount=event.shiftKey?.01:.001; const delta={ArrowLeft:[-amount,0],ArrowRight:[amount,0],ArrowUp:[0,-amount],ArrowDown:[0,amount]}[event.key];
        if(delta){event.preventDefault(); update(index,{...mask,x:mask.x+delta[0],y:mask.y+delta[1]});}
      }}><span data-resize="true" className="redactor-mask-handle" aria-hidden="true" /></div>)}
  </div>;
}
