import { comparisonSourceSlices } from './restoreStyleProjection.ts';
import type { ComparisonDecision, DocumentComparisonManifest, DocumentSourceReference, ObjectEventContext } from './comparisonManifest.ts';
import { eventSources, findSource, sourceTextLength } from './manifestIndex.ts';
const key=(ref:DocumentSourceReference)=>JSON.stringify([ref.part,ref.path]);
/** Only a complete same-kind boundary ordinal has an unambiguous split schedule.
 * Source XML order partitions a prefix into the left paragraph and the rest
 * into the right. IDs and note content never participate. */
export function splitBoundaryNoteContexts(manifest:DocumentComparisonManifest,decision:ComparisonDecision,before:DocumentSourceReference[],after:DocumentSourceReference[]) {
  const assigned=new Map<string,number>();
  if(decision.before.length!==1||decision.after.length!==2)return assigned;
  const boundary=decision.splitSlices![0][1],leftLength=Array.from(findSource(manifest,'after',decision.after[0])?.rawText??'').length;
  const old=before.filter(ref=>ref.objectEvent?.kind==='note'&&ref.objectEvent.start===boundary);
  const at=(index:number,position:number)=>after.filter(ref=>ref.objectEvent?.kind==='note'&&ref.objectEvent.start===position&&ref.part===decision.after[index].part&&JSON.stringify(ref.objectEvent.paragraphPath)===JSON.stringify(decision.after[index].path));
  const left=at(0,leftLength),right=at(1,0);
  const foreign=eventSources(manifest,'before',decision.before[0].part,decision.before[0].path).some(ref=>ref.objectEvent!.kind!=='note'&&ref.objectEvent!.start===boundary);
  if(!foreign&&old.length>1&&left.length&&right.length&&left.length+right.length===old.length&&old.every((ref,index)=>ref.objectEvent!.signature===[...left,...right][index].objectEvent!.signature))old.forEach((ref,index)=>assigned.set(key(ref),index<left.length?1:2));
  return assigned;
}
/** Source-event boundaries use the same raw codepoint diff as text emission. */
export function sourceEventBoundary(decision:ComparisonDecision,position:number) {
  if(position===Array.from(decision.beforeText).length)return Array.from(decision.afterText).length;
  let old=0,next=0;
  for(const segment of decision.comparisons[0].segments){const size=Array.from(segment.text).length;
    if(segment.type==='equal' && old<=position && position<=old+size)return next+position-old;
    if(segment.type==='deleted' && old<=position && position<old+size)return next;
    if(segment.type!=='added')old+=size;if(segment.type!=='deleted')next+=size;
  }
  return next;
}
/** Every revised position an original boundary may stand for: text inserted right at the boundary
 * leaves an object anywhere across that insertion (a note reference typed after new text). The
 * single position `sourceEventBoundary` gives is always inside. */
export function sourceEventRange(decision:ComparisonDecision,position:number):[number,number] {
  const candidates:number[]=[];let old=0,next=0;
  for(const segment of decision.comparisons[0].segments){const size=Array.from(segment.text).length;
    if(old===position)candidates.push(next);
    if(segment.type==='equal' && old<position && position<old+size)return [next+position-old,next+position-old];
    if(segment.type==='deleted' && old<position && position<old+size)return [next,next];
    if(segment.type!=='added')old+=size;if(segment.type!=='deleted')next+=size;
  }
  if(old===position)candidates.push(next);
  const point=sourceEventBoundary(decision,position);candidates.push(point);
  return [Math.min(...candidates),Math.max(...candidates)];
}
export function buildObjectEventContexts(manifest:DocumentComparisonManifest,decision:ComparisonDecision,before:DocumentSourceReference[],after:DocumentSourceReference[]):ObjectEventContext[] {
  const indexes=decision.before.length===1 && decision.after.length===2?[1,2]:decision.before.length===2&&decision.after.length===1?[1]:[0];
  const assigned=splitBoundaryNoteContexts(manifest,decision,before,after);
  let offset=0;
  return indexes.map(comparisonIndex=>{
    const comparison=decision.comparisons[comparisonIndex],slices=comparisonSourceSlices(manifest,decision,comparisonIndex);
    const events=(side:'before'|'after')=>slices[side].flatMap((slice,sliceIndex)=>(side==='before'?before:after).filter(ref=>ref.part===slice.source.part && JSON.stringify(ref.objectEvent!.paragraphPath)===JSON.stringify(slice.source.path) && (side==='before'&&assigned.size&&assigned.has(key(ref))?assigned.get(key(ref))===comparisonIndex:ref.objectEvent!.start>=slice.range[0] && (ref.objectEvent!.start<slice.range[1] || ref.objectEvent!.start===slice.range[1] && (side==='after' || decision.before.length===2 || comparisonIndex===indexes.at(-1)) && slice.range[1]===sourceTextLength(manifest,side,slice.source)))).map(source=>({source,start:source.objectEvent!.start-slice.range[0]+slices[side].slice(0,sliceIndex).reduce((sum,item)=>sum+item.range[1]-item.range[0]+(decision.before.length===2&&decision.after.length===1?0:1),0),end:source.objectEvent!.end-slice.range[0]+slices[side].slice(0,sliceIndex).reduce((sum,item)=>sum+item.range[1]-item.range[0]+(decision.before.length===2&&decision.after.length===1?0:1),0)})));
    const context={comparisonIndex,offset,afterParagraph:slices.after[0]?.source,before:events('before'),after:events('after')};
    offset+=Array.from(comparison.after).length+1;
    return context;
  });
}
export function eventContext(decision:ComparisonDecision,side:'before'|'after',ref:DocumentSourceReference){return decision.objectEvents?.contexts.find(context=>context[side].some(event=>(event.source===ref||key(event.source)===key(ref))));}
/** `eventPosition` of an original event as the range of revised positions it may stand for. */
export function eventRange(decision:ComparisonDecision,contexts:ObjectEventContext[],ref:DocumentSourceReference):[number,number] {
  const context=contexts.find(item=>item.before.some(event=>(event.source===ref||key(event.source)===key(ref))));
  if(!context){const position=ref.objectEvent!.start;return [position,position];}
  const event=context.before.find(event=>(event.source===ref||key(event.source)===key(ref)))!;
  const comparison=decision.comparisons[context.comparisonIndex];
  const [low,high]=sourceEventRange({...decision,beforeText:comparison.before,afterText:comparison.after,comparisons:[comparison]},event.start);
  return [context.offset+low,context.offset+high];
}
/** Index of the revised event an original one pairs with, in source order: the one at its exact
 * position, else the first inside its range (`eventRange`); -1 when none qualifies. */
export function pairedEventIndex(decision:ComparisonDecision,contexts:ObjectEventContext[],ref:DocumentSourceReference,candidates:DocumentSourceReference[],accepts:(candidate:DocumentSourceReference)=>boolean) {
  const at=eventPosition(decision,contexts,'before',ref),[low,high]=eventRange(decision,contexts,ref);
  const exact=candidates.findIndex(candidate=>accepts(candidate)&&eventPosition(decision,contexts,'after',candidate)===at);
  if(exact>=0)return exact;
  return candidates.findIndex(candidate=>{if(!accepts(candidate))return false;const position=eventPosition(decision,contexts,'after',candidate);return low<=position&&position<=high;});
}
export function eventPosition(decision:ComparisonDecision,contexts:ObjectEventContext[],side:'before'|'after',ref:DocumentSourceReference,end=false) {
  const context=contexts.find(item=>item[side].some(event=>(event.source===ref||key(event.source)===key(ref))));
  if(!context)return ref.objectEvent![end?'end':'start'];
  const event=context[side].find(event=>(event.source===ref||key(event.source)===key(ref)))!;
  const position=event[end?'end':'start'];
  const comparison=decision.comparisons[context.comparisonIndex];
  return context.offset+(side==='after'?position:sourceEventBoundary({...decision,beforeText:comparison.before,afterText:comparison.after,comparisons:[comparison]},position));
}
