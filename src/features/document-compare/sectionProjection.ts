import type {ComparisonDecision,DocumentComparisonManifest,DocumentSourceReference} from './comparisonManifest.ts';
import type {StoryFacts} from './storyProjection.ts';
export interface SectionPair {id:string;before?:StoryFacts['sections'][number];after?:StoryFacts['sections'][number];ownerDecisionId?:string;final:boolean}
export const sourceKey=(ref:DocumentSourceReference)=>JSON.stringify([ref.part,ref.path]);
export function buildSectionPairs(manifest:DocumentComparisonManifest,a:StoryFacts,b:StoryFacts){
 const pairs:SectionPair[]=[],reasons:string[]=[];
 if(!manifest.options.metadata&&!manifest.options.formatting)return {pairs,reasons};
 const decisions:ComparisonDecision[]=[];const visit=(items:ComparisonDecision[])=>{for(const item of items){decisions.push(item);visit(item.children??[]);}};visit(manifest.decisions);
 for(const section of a.sections.filter(section=>!section.final)){
  const source=section.source;
  const owner=manifest.sources.before.find(ref=>ref.kind==='p'&&ref.part===source.part&&source.path.length===ref.path.length+2&&ref.path.every((v,i)=>source.path[i]===v));
  const decision=owner&&decisions.find(item=>item.type==='paragraph'&&item.before.some(ref=>sourceKey(ref)===sourceKey(owner)));
  const directBody=owner&&manifest.sources.before.some(ref=>ref.kind==='body'&&ref.part===owner.part&&sourceKey(ref)===sourceKey({...owner,path:owner.path.slice(0,-1)}));
  if(!directBody||!decision||decision.moved||decision.before.length!==1||decision.after.length!==1){reasons.push('unsupported-section-boundary');continue;}
  const target=decision.after[0];
  if(!manifest.sources.after.some(ref=>ref.kind==='body'&&ref.part===target.part&&sourceKey(ref)===sourceKey({...target,path:target.path.slice(0,-1)}))){reasons.push('unsupported-section-envelope');continue;}
  const candidates=b.sections.filter(next=>!next.final&&next.source.part===target.part&&next.source.path.length===target.path.length+2&&target.path.every((v,i)=>next.source.path[i]===v));
  if(candidates.length!==1){reasons.push('unsupported-section-boundary');continue;}
  pairs.push({id:'section:'+decision.id,before:section,after:candidates[0],ownerDecisionId:decision.id,final:false});
 }
 const old=a.sections.filter(section=>section.final),next=b.sections.filter(section=>section.final);
 if(old.length>1||next.length>1)reasons.push('ambiguous-final-section');
 if(old.length||next.length)pairs.push({id:'section:final-body',before:old[0],after:next[0],final:true});
 for(const side of ['before','after'] as const){const facts=side==='before'?a:b;if(JSON.stringify(facts.sections.map(section=>sourceKey(section.source)))!==JSON.stringify(pairs.flatMap(pair=>pair[side]?[sourceKey(pair[side]!.source)]:[])))reasons.push('changed-section-order-or-count');}
 if(manifest.options.metadata&&pairs.some(pair=>!pair.final)&&(!old.length||!next.length))reasons.push('implicit-final-multisection');
 if(manifest.options.metadata&&a.settings?.evenAndOddHeaders!==b.settings?.evenAndOddHeaders)reasons.push('changed-story-activation');
 if(manifest.options.metadata&&pairs.some(pair=>!pair.final))for(const pair of pairs)if(JSON.stringify(pair.before?.activation)!==JSON.stringify(pair.after?.activation))reasons.push('changed-section-activation');
 return {pairs,reasons};
}
