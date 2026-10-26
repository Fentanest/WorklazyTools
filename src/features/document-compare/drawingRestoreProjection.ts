import { eventContext, sourceEventBoundary } from './objectEventContext.ts';
import { formattingGroup } from './formattingMask.ts';
import type { ComparisonDecision, DocumentComparisonManifest, DocumentSourceReference, PropertyFact } from './comparisonManifest.ts';
const key=(ref:DocumentSourceReference)=>JSON.stringify([ref.part,ref.path]);
const empty:PropertyFact={supported:{},unsupported:{},history:false};
export function buildDrawingRestoreProjections(manifest:DocumentComparisonManifest) {
  const visit=(decisions:ComparisonDecision[])=>{for(const decision of decisions){
    visit(decision.children??[]);
    const events=decision.objectEvents;
    if(!events)continue;
    events.deletedDrawingStyles=[];
    for(const before of events.before.filter(ref=>(ref.objectEvent!.kind==='drawing'||manifest.options.metadata&&ref.objectEvent!.kind==='note') && !events.drawingProperties.some(pair=>key(pair.before)===key(ref)))) {
      const beforeFact=manifest.sources.before.find(ref=>ref.part===before.part && JSON.stringify(ref.path)===JSON.stringify(before.objectEvent!.runPath))?.normalizedProperties?.rPr??empty;
      if(!decision.after.length){events.deletedDrawingStyles.push({before,beforeFact,policy:'restore-before-unpaired'});continue;}
      const context=eventContext(decision,'before',before);
      const afterParagraph=context?.afterParagraph;
      if(!afterParagraph){events.propertiesSupported=false;continue;}
      // Same codepoint cursor and next/previous rule as deleted text. No source
      // outside this paragraph may supply revised formatting.
      const comparison=decision.comparisons[context!.comparisonIndex];
      const local=context!.before.find(event=>key(event.source)===key(before))!.start;
      const cursor=sourceEventBoundary({...decision,beforeText:comparison.before,afterText:comparison.after,comparisons:[comparison]},local);
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
