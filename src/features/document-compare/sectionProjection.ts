import type {ComparisonDecision,DocumentComparisonManifest,DocumentSourceReference} from './comparisonManifest.ts';
import type {StoryFacts} from './storyProjection.ts';
/** `blankOwner`: both section breaks sit on empty paragraphs, which the comparison omits and the
 * tracked document keeps from the revision; such breaks pair by order instead of by decision. */
/** `oneSided`: the break sits in a paragraph that only one side has (deleted or inserted whole);
 * it is recorded with that paragraph and its stories follow the neighbouring revised section. */
export interface SectionPair {id:string;before?:StoryFacts['sections'][number];after?:StoryFacts['sections'][number];ownerDecisionId?:string;final:boolean;blankOwner?:boolean;oneSided?:boolean}
export const sourceKey=(ref:DocumentSourceReference)=>JSON.stringify([ref.part,ref.path]);
export function buildSectionPairs(manifest:DocumentComparisonManifest,a:StoryFacts,b:StoryFacts){
 const pairs:SectionPair[]=[],reasons:string[]=[];
 if(!manifest.options.metadata&&!manifest.options.formatting)return {pairs,reasons};
 const decisions:ComparisonDecision[]=[];const visit=(items:ComparisonDecision[])=>{for(const item of items){decisions.push(item);visit(item.children??[]);}};visit(manifest.decisions);
 const blank:{before:StoryFacts['sections'];after:StoryFacts['sections']}={before:[],after:[]};
 const blankOwner=(side:'before'|'after',section:StoryFacts['sections'][number])=>{
  const source=section.source,refs=manifest.sources[side];
  const owner=refs.find(ref=>ref.kind==='p'&&ref.part===source.part&&source.path.length===ref.path.length+2&&ref.path.every((v,i)=>source.path[i]===v));
  if(!owner||owner.rawText?.trim()||owner.opaqueSignature||decisions.some(item=>item[side].some(ref=>sourceKey(ref)===sourceKey(owner))))return false;
  return refs.some(ref=>ref.kind==='body'&&ref.part===owner.part&&sourceKey(ref)===sourceKey({...owner,path:owner.path.slice(0,-1)}));
 };
 for(const section of b.sections.filter(section=>!section.final))if(blankOwner('after',section))blank.after.push(section);
 for(const section of a.sections.filter(section=>!section.final)){
  if(blankOwner('before',section)){blank.before.push(section);continue;}
  const source=section.source;
  const owner=manifest.sources.before.find(ref=>ref.kind==='p'&&ref.part===source.part&&source.path.length===ref.path.length+2&&ref.path.every((v,i)=>source.path[i]===v));
  const decision=owner&&decisions.find(item=>item.type==='paragraph'&&item.before.some(ref=>sourceKey(ref)===sourceKey(owner)));
  const directBody=owner&&manifest.sources.before.some(ref=>ref.kind==='body'&&ref.part===owner.part&&sourceKey(ref)===sourceKey({...owner,path:owner.path.slice(0,-1)}));
  if(directBody&&decision&&!decision.moved&&decision.type==='paragraph'&&decision.before.length===1&&!decision.after.length){pairs.push({id:'section:'+decision.id,before:section,ownerDecisionId:decision.id,final:false,oneSided:true});continue;}
  if(!directBody||!decision||decision.moved||decision.before.length!==1||decision.after.length!==1){reasons.push('unsupported-section-boundary');continue;}
  const target=decision.after[0];
  if(!manifest.sources.after.some(ref=>ref.kind==='body'&&ref.part===target.part&&sourceKey(ref)===sourceKey({...target,path:target.path.slice(0,-1)}))){reasons.push('unsupported-section-envelope');continue;}
  const candidates=b.sections.filter(next=>!next.final&&next.source.part===target.part&&next.source.path.length===target.path.length+2&&target.path.every((v,i)=>next.source.path[i]===v));
  if(candidates.length!==1){reasons.push('unsupported-section-boundary');continue;}
  pairs.push({id:'section:'+decision.id,before:section,after:candidates[0],ownerDecisionId:decision.id,final:false});
 }
 // Breaks in wholly inserted paragraphs are recorded with that paragraph.
 for(const section of b.sections.filter(section=>!section.final)){
  if(pairs.some(pair=>pair.after&&sourceKey(pair.after.source)===sourceKey(section.source))||blank.after.includes(section))continue;
  const source=section.source;
  const owner=manifest.sources.after.find(ref=>ref.kind==='p'&&ref.part===source.part&&source.path.length===ref.path.length+2&&ref.path.every((v,i)=>source.path[i]===v));
  const decision=owner&&decisions.find(item=>item.type==='paragraph'&&item.after.some(ref=>sourceKey(ref)===sourceKey(owner)));
  const directBody=owner&&manifest.sources.after.some(ref=>ref.kind==='body'&&ref.part===owner.part&&sourceKey(ref)===sourceKey({...owner,path:owner.path.slice(0,-1)}));
  if(directBody&&decision&&!decision.moved&&decision.after.length===1&&!decision.before.length)pairs.push({id:'section:'+decision.id,after:section,ownerDecisionId:decision.id,final:false,oneSided:true});
 }
 // Breaks on omitted empty paragraphs pair in order when both sides have the same such breaks
 // and every other break paired through its paragraph decision.
 if(blank.before.length||blank.after.length){
  if(blank.before.length!==blank.after.length)reasons.push('unsupported-section-boundary');
  else blank.before.forEach((section,index)=>pairs.push({id:'section:blank:'+index,before:section,after:blank.after[index],final:false,blankOwner:true}));
 }
 // Order breaks so each side's breaks keep document order: merge both orders, emitting a paired
 // break once both reach it and a one-sided break where its own side has it.
 {
  const keyed=(side:'before'|'after')=>new Map(pairs.filter(pair=>pair[side]).map(pair=>[sourceKey(pair[side]!.source),pair]));
  const byBefore=keyed('before'),byAfter=keyed('after'),orderB=a.sections.filter(s=>!s.final).map(s=>sourceKey(s.source)),orderA=b.sections.filter(s=>!s.final).map(s=>sourceKey(s.source));
  const merged:SectionPair[]=[],seen=new Set<SectionPair>();let i=0,j=0;
  while(i<orderB.length||j<orderA.length){
   const x=i<orderB.length?byBefore.get(orderB[i]):undefined,y=j<orderA.length?byAfter.get(orderA[j]):undefined;
   if(i<orderB.length&&(!x||seen.has(x))){i++;continue;}
   if(j<orderA.length&&(!y||seen.has(y))){j++;continue;}
   const next=x&&(x===y||!x.after||!y)?x:y&&!y.before?y:x!;
   merged.push(next);seen.add(next);
  }
  pairs.splice(0,pairs.length,...merged,...pairs.filter(pair=>!seen.has(pair)));
 }
 const old=a.sections.filter(section=>section.final),next=b.sections.filter(section=>section.final);
 if(old.length>1||next.length>1)reasons.push('ambiguous-final-section');
 if(old.length||next.length)pairs.push({id:'section:final-body',before:old[0],after:next[0],final:true});
 for(const side of ['before','after'] as const){const facts=side==='before'?a:b;if(JSON.stringify(facts.sections.map(section=>sourceKey(section.source)))!==JSON.stringify(pairs.flatMap(pair=>pair[side]?[sourceKey(pair[side]!.source)]:[])))reasons.push('changed-section-order-or-count');}
 if(manifest.options.metadata&&pairs.some(pair=>!pair.final)&&(!old.length||!next.length))reasons.push('implicit-final-multisection');
 if(manifest.options.metadata&&a.settings?.evenAndOddHeaders!==b.settings?.evenAndOddHeaders)reasons.push('changed-story-activation');
 if(manifest.options.metadata&&pairs.some(pair=>!pair.final))for(const pair of pairs)if(!pair.oneSided&&JSON.stringify(pair.before?.activation)!==JSON.stringify(pair.after?.activation))reasons.push('changed-section-activation');
 return {pairs,reasons};
}
