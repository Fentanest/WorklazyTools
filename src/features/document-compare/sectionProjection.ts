import type {ComparisonDecision,DocumentComparisonManifest,DocumentSourceReference} from './comparisonManifest.ts';
import type {StoryFacts} from './storyProjection.ts';
import {findSource} from './manifestIndex.ts';
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
 // Indexed forms of the former linear scans (same first match: an inventory entry is the only one with its part and path).
 const sourceAt=(side:'before'|'after',part:string,path:number[])=>findSource(manifest,side,{part,path});
 const ownerOf=(side:'before'|'after',source:{part:string;path:number[]})=>{const owner=source.path.length>=2?sourceAt(side,source.part,source.path.slice(0,-2)):undefined;return owner?.kind==='p'?owner:undefined;};
 const decided={before:new Set<string>(),after:new Set<string>()},paragraphDecision={before:new Map<string,ComparisonDecision>(),after:new Map<string,ComparisonDecision>()};
 for(const item of decisions)for(const side of ['before','after'] as const)for(const ref of item[side]){const key=sourceKey(ref);decided[side].add(key);if(item.type==='paragraph'&&!paragraphDecision[side].has(key))paragraphDecision[side].set(key,item);}
 // A section-break paragraph sits directly in the body or in a body-level content control.
 const inBodyEnvelope=(side:'before'|'after',owner:DocumentSourceReference)=>{
  const at=(path:number[])=>sourceAt(side,owner.part,path);
  const parent=at(owner.path.slice(0,-1));
  if(parent?.kind==='body')return true;
  return parent?.kind==='sdtContent'&&at(owner.path.slice(0,-2))?.kind==='sdt'&&at(owner.path.slice(0,-3))?.kind==='body';
 };
 const hasBreak=(facts:StoryFacts,owner:DocumentSourceReference)=>facts.sections.some(section=>!section.final&&section.source.part===owner.part&&section.source.path.length===owner.path.length+2&&owner.path.every((v,i)=>section.source.path[i]===v));
 const blankOwner=(side:'before'|'after',section:StoryFacts['sections'][number])=>{
  const owner=ownerOf(side,section.source);
  if(!owner||owner.rawText?.trim()||owner.opaqueSignature||decided[side].has(sourceKey(owner)))return false;
  return sourceAt(side,owner.part,owner.path.slice(0,-1))?.kind==='body';
 };
 for(const section of b.sections.filter(section=>!section.final))if(blankOwner('after',section))blank.after.push(section);
 for(const section of a.sections.filter(section=>!section.final)){
  if(blankOwner('before',section)){blank.before.push(section);continue;}
  const owner=ownerOf('before',section.source);
  const decision=owner&&paragraphDecision.before.get(sourceKey(owner));
  const directBody=owner&&inBodyEnvelope('before',owner);
  if(directBody&&decision&&!decision.moved&&decision.type==='paragraph'&&decision.before.length===1&&(!decision.after.length||decision.after.length===1&&!hasBreak(b,decision.after[0]))){pairs.push({id:'section:'+decision.id,before:section,ownerDecisionId:decision.id,final:false,oneSided:true});continue;}
  if(!directBody||!decision||decision.moved||decision.before.length!==1||decision.after.length!==1){reasons.push('unsupported-section-boundary');continue;}
  const target=decision.after[0];
  if(!inBodyEnvelope('after',target)){reasons.push('unsupported-section-envelope');continue;}
  const candidates=b.sections.filter(next=>!next.final&&next.source.part===target.part&&next.source.path.length===target.path.length+2&&target.path.every((v,i)=>next.source.path[i]===v));
  if(candidates.length!==1){reasons.push('unsupported-section-boundary');continue;}
  pairs.push({id:'section:'+decision.id,before:section,after:candidates[0],ownerDecisionId:decision.id,final:false});
 }
 // Breaks in wholly inserted paragraphs are recorded with that paragraph.
 for(const section of b.sections.filter(section=>!section.final)){
  if(pairs.some(pair=>pair.after&&sourceKey(pair.after.source)===sourceKey(section.source))||blank.after.includes(section))continue;
  const owner=ownerOf('after',section.source);
  const decision=owner&&paragraphDecision.after.get(sourceKey(owner));
  const directBody=owner&&inBodyEnvelope('after',owner);
  if(directBody&&decision&&!decision.moved&&decision.after.length===1&&(!decision.before.length||decision.before.length===1&&!hasBreak(a,decision.before[0])))pairs.push({id:'section:'+decision.id,after:section,ownerDecisionId:decision.id,final:false,oneSided:true});
 }
 // Breaks on omitted empty paragraphs pair in order within the same gap between paired
 // paragraphs; a break only one side has there is recorded with its empty paragraph.
 if(blank.before.length||blank.after.length){
  const comparePaths=(x:number[],y:number[])=>{for(let i=0;i<Math.min(x.length,y.length);i++)if(x[i]!==y[i])return x[i]-y[i];return x.length-y.length;};
  const anchors=decisions.filter(item=>item.before.length&&item.after.length&&!item.moved).map(item=>({before:item.before[0],after:item.after[0]}));
  const gap=(side:'before'|'after',section:StoryFacts['sections'][number])=>{const owner=section.source.path.slice(0,-2);return anchors.filter(anchor=>anchor[side].part===section.source.part&&comparePaths(anchor[side].path,owner)<0).length;};
  const groups=new Map<number,{before:StoryFacts['sections'];after:StoryFacts['sections']}>();
  for(const side of ['before','after'] as const)for(const section of blank[side]){const key=gap(side,section);const group=groups.get(key)??{before:[],after:[]};group[side].push(section);groups.set(key,group);}
  let index=0;
  for(const key of [...groups.keys()].sort((x,y)=>x-y)){
   const group=groups.get(key)!,shared=Math.min(group.before.length,group.after.length);
   for(let k=0;k<shared;k++)pairs.push({id:'section:blank:'+index++,before:group.before[k],after:group.after[k],final:false,blankOwner:true});
   for(const section of group.before.slice(shared))pairs.push({id:'section:blank:'+index++,before:section,final:false,blankOwner:true,oneSided:true});
   for(const section of group.after.slice(shared))pairs.push({id:'section:blank:'+index++,after:section,final:false,blankOwner:true,oneSided:true});
  }
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
 // A changed even/odd header setting is not a story change: the tracked file keeps the revised
 // setting (Word does not track it) and the worker warns about it.
 if(manifest.options.metadata&&pairs.some(pair=>!pair.final))for(const pair of pairs)if(!pair.oneSided&&JSON.stringify(pair.before?.activation)!==JSON.stringify(pair.after?.activation))reasons.push('changed-section-activation');
 return {pairs,reasons};
}
