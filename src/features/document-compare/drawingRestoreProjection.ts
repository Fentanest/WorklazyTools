import { formattingGroup } from './formattingMask.ts';
import type { ComparisonDecision, DocumentComparisonManifest, DocumentSourceReference, PropertyFact } from './comparisonManifest.ts';
const key=(ref:DocumentSourceReference)=>JSON.stringify([ref.part,ref.path]);
const empty:PropertyFact={supported:{},unsupported:{},history:false};
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
export function buildDrawingRestoreProjections(manifest:DocumentComparisonManifest) {
  const visit=(decisions:ComparisonDecision[])=>{for(const decision of decisions){
    visit(decision.children??[]);
    const events=decision.objectEvents;
    if(!events)continue;
    events.deletedDrawingStyles=[];
    for(const before of events.before.filter(ref=>ref.objectEvent!.kind==='drawing' && !events.drawingProperties.some(pair=>key(pair.before)===key(ref)))) {
      const beforeFact=manifest.sources.before.find(ref=>ref.part===before.part && JSON.stringify(ref.path)===JSON.stringify(before.objectEvent!.runPath))?.normalizedProperties?.rPr??empty;
      if(!decision.after.length){events.deletedDrawingStyles.push({before,beforeFact,policy:'restore-before-unpaired'});continue;}
      if(decision.after.length!==1){events.propertiesSupported=false;continue;}
      const afterParagraph=decision.after[0];
      // Same codepoint cursor and next/previous rule as deleted text. No source
      // outside this paragraph may supply revised formatting.
      const cursor=sourceEventBoundary(decision,before.objectEvent!.start);
      const length=Array.from(manifest.sources.after.find(ref=>key(ref)===key(afterParagraph))?.rawText??'').length;
      const at=(position:number)=>manifest.sources.after.find(ref=>ref.kind==='r' && ref.part===afterParagraph.part && JSON.stringify(ref.paragraphPath)===JSON.stringify(afterParagraph.path) && ref.textRange && ref.textRange[0]<=position && position<ref.textRange[1]);
      const source=at(cursor)??at(Math.min(cursor,length)-1);
      const afterFact=source?.normalizedProperties?.rPr??empty;
      const families=[...new Set([...Object.keys(beforeFact.supported),...Object.keys(afterFact.supported)])].filter(name=>manifest.formattingMask.effective[formattingGroup('rPr',name)]);
      events.deletedDrawingStyles.push({before,beforeFact,policy:source?'copy-revised-run':'inherit-after-default',afterParagraph,afterFact,cursor,families,...(source?{source}:{})});
    }
  }};
  visit(manifest.decisions);
}
