import {formattingGroup} from './formattingMask.ts';
import {sourceEventBoundary} from './objectEventContext.ts';
import type {ComparisonDecision,DocumentComparisonManifest,DocumentSourceReference,PropertyFact} from './comparisonManifest.ts';
const key=(ref:DocumentSourceReference)=>JSON.stringify([ref.part,ref.path]);
const empty:PropertyFact={supported:{},unsupported:{},history:false};
export function buildMergeProjections(manifest:DocumentComparisonManifest) {
 const visit=(decisions:ComparisonDecision[])=>{for(const decision of decisions){
  visit(decision.children??[]);
  if(decision.type!=='paragraph'||decision.trackedRepresentation!=='revision'||decision.before.length!==2||decision.after.length!==1)continue;
  const comparison=decision.comparisons[1];
  const beforeBoundary=Array.from(manifest.sources.before.find(ref=>key(ref)===key(decision.before[0]))?.rawText??'').length;
  const afterBoundary=sourceEventBoundary({...decision,beforeText:comparison.before,afterText:comparison.after,comparisons:[comparison]},beforeBoundary);
  const properties=decision.before.map(before=>{
   const old=manifest.sources.before.find(ref=>key(ref)===key(before))?.normalizedProperties?.pPr??empty;
   const next=manifest.sources.after.find(ref=>key(ref)===key(decision.after[0]))?.normalizedProperties?.pPr??empty;
   const families=[...new Set([...Object.keys(old.supported),...Object.keys(next.supported)])].filter(name=>manifest.formattingMask.effective[formattingGroup('pPr',name)]&&JSON.stringify(old.supported[name]??[])!==JSON.stringify(next.supported[name]??[]));
   return {before,after:decision.after[0],beforeFact:old,afterFact:next,families,history:next.history};
  });
  const beforeEvents=(decision.objectEvents?.before??[]).map(source=>({source,side:JSON.stringify(source.objectEvent!.paragraphPath)===JSON.stringify(decision.before[0].path)&&source.part===decision.before[0].part?0:1}));
  const afterEvents=(decision.objectEvents?.after??[]).map(source=>{
   const pair=decision.objectEvents!.drawingProperties.find(pair=>key(pair.after)===key(source));
   const side=pair?beforeEvents.find(entry=>key(entry.source)===key(pair.before))!.side:source.objectEvent!.start<afterBoundary?0:1;
   return {source,side};
  });
  decision.mergeProjection={policy:'worklazy-merge-1',beforeBoundary,afterBoundary,properties,beforeEvents,afterEvents};
 }};visit(manifest.decisions);
}
