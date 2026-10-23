import { comparisonSourceSlices } from './restoreStyleProjection.ts';
import type { ComparisonDecision, DocumentComparisonManifest, DocumentSourceReference, ObjectEventContext } from './comparisonManifest.ts';
const key=(ref:DocumentSourceReference)=>JSON.stringify([ref.part,ref.path]);
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
export function buildObjectEventContexts(manifest:DocumentComparisonManifest,decision:ComparisonDecision,before:DocumentSourceReference[],after:DocumentSourceReference[]):ObjectEventContext[] {
  const indexes=decision.before.length===1 && decision.after.length===2?[1,2]:[0];
  let offset=0;
  return indexes.map(comparisonIndex=>{
    const comparison=decision.comparisons[comparisonIndex],slices=comparisonSourceSlices(manifest,decision,comparisonIndex);
    const events=(side:'before'|'after')=>slices[side].flatMap((slice,sliceIndex)=>(side==='before'?before:after).filter(ref=>ref.part===slice.source.part && JSON.stringify(ref.objectEvent!.paragraphPath)===JSON.stringify(slice.source.path) && ref.objectEvent!.start>=slice.range[0] && (ref.objectEvent!.start<slice.range[1] || ref.objectEvent!.start===slice.range[1] && (side==='after' || comparisonIndex===indexes.at(-1)) && slice.range[1]===Array.from(manifest.sources[side].find(item=>key(item)===key(slice.source))?.rawText??'').length)).map(source=>({source,start:source.objectEvent!.start-slice.range[0]+slices[side].slice(0,sliceIndex).reduce((sum,item)=>sum+item.range[1]-item.range[0]+1,0),end:source.objectEvent!.end-slice.range[0]+slices[side].slice(0,sliceIndex).reduce((sum,item)=>sum+item.range[1]-item.range[0]+1,0)})));
    const context={comparisonIndex,offset,afterParagraph:slices.after[0]?.source,before:events('before'),after:events('after')};
    offset+=Array.from(comparison.after).length+1;
    return context;
  });
}
export function eventContext(decision:ComparisonDecision,side:'before'|'after',ref:DocumentSourceReference){return decision.objectEvents?.contexts.find(context=>context[side].some(event=>key(event.source)===key(ref)));}
export function eventPosition(decision:ComparisonDecision,contexts:ObjectEventContext[],side:'before'|'after',ref:DocumentSourceReference,end=false) {
  const context=contexts.find(item=>item[side].some(event=>key(event.source)===key(ref)));
  if(!context)return ref.objectEvent![end?'end':'start'];
  const event=context[side].find(event=>key(event.source)===key(ref))!;
  const position=event[end?'end':'start'];
  const comparison=decision.comparisons[context.comparisonIndex];
  return context.offset+(side==='after'?position:sourceEventBoundary({...decision,beforeText:comparison.before,afterText:comparison.after,comparisons:[comparison]},position));
}
