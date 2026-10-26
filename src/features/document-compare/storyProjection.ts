import {buildSectionPairs,sourceKey,type SectionPair} from './sectionProjection.ts';
import type {ComparisonDecision,DocumentComparisonManifest,DocumentSourceReference} from './comparisonManifest.ts';
export interface StoryFacts {policy:'worklazy-story-facts-1';parts:Array<{part:string;kind:'header'|'footer';sha256:string;contentType:string|null;active:boolean}>;sections:Array<{source:DocumentSourceReference;final:boolean;history:boolean;activation?:{type:string;titlePage:boolean}}>;bindings:Array<{section:DocumentSourceReference;reference:DocumentSourceReference;kind:'header'|'footer';variant:string;ownerPart:string;rId:string;type:string;rawTarget:string;targetMode:string;targetPart:string}>;settings?:{evenAndOddHeaders:boolean};errors:string[]}
export interface StoryPair {id:string;kind:'header'|'footer';beforePart?:string;afterPart?:string;representation:'inline'|'unsupported-binding'|'section-only';decisionIds:string[];coverage:{before:DocumentSourceReference[];after:DocumentSourceReference[]}}
export interface StoryProjection {policy:'worklazy-story-projection-2';supported:boolean;reasons:string[];sections:SectionPair[];routes:Array<{sectionId:string;kind:'header'|'footer';variant:string;before:{explicit:boolean;donorSectionId?:string;part?:string};after:{explicit:boolean;donorSectionId?:string;part?:string};storyId?:string}>;pairs:StoryPair[];bindings:Array<{id:string;sectionId:string;kind:'header'|'footer';variant:string;before?:StoryFacts['bindings'][number];after?:StoryFacts['bindings'][number];storyId:string}>}
export function buildStoryProjection(manifest:DocumentComparisonManifest):StoryProjection {
 const a=manifest.storyFacts.before,b=manifest.storyFacts.after;
 const plan:StoryProjection={policy:'worklazy-story-projection-2',supported:true,reasons:[],sections:[],routes:[],pairs:[],bindings:[]};
 if(!a||!b)return plan;
 const sections=buildSectionPairs(manifest,a,b);plan.sections=sections.pairs;plan.reasons.push(...sections.reasons);
 if(!manifest.options.metadata){plan.supported=!plan.reasons.length;return plan;}
 plan.reasons.push(...a.errors,...b.errors);
 const slots=[...new Set([...a.bindings,...b.bindings].map(ref=>ref.kind+':'+ref.variant))].sort();
 const donors:{before:Record<string,{donorSectionId:string;part:string}>;after:Record<string,{donorSectionId:string;part:string}>}={before:{},after:{}};
 // A section shows its own story or inherits the previous section's on its side; a removed or
 // added section takes part in that inheritance on its own side but owns no binding. Stories pair
 // by what each section shows, so a link that only changed between explicit and inherited keeps
 // one compared story; each revised story pairs with one original story.
 const shownWith=new Map<string,string|undefined>(),shownBefore=new Map<string,string|undefined>();
 for(const section of plan.sections)for(const slot of slots){
  const old=a.bindings.find(ref=>section.before&&sourceKey(ref.section)===sourceKey(section.before.source)&&ref.kind+':'+ref.variant===slot),next=b.bindings.find(ref=>section.after&&sourceKey(ref.section)===sourceKey(section.after.source)&&ref.kind+':'+ref.variant===slot);
  const [kind,variant]=slot.split(':') as ['header'|'footer',string];
  if(old)donors.before[slot]={donorSectionId:section.id,part:old.targetPart};if(next)donors.after[slot]={donorSectionId:section.id,part:next.targetPart};
  if(section.oneSided)continue;
  const before={explicit:!!old,...donors.before[slot]},after={explicit:!!next,...donors.after[slot]};
  // A story shown on one side only is compared with an empty story: the tracked document gives
  // the section an explicit reference to it (an original-only story is copied in, all deleted).
  // A revised story shown with two different original stories (or the reverse) is unsupported;
  // no second pair is created, so no source is compared twice.
  if((after.part&&shownWith.has(after.part)&&shownWith.get(after.part)!==before.part)||(before.part&&shownBefore.has(before.part)&&shownBefore.get(before.part)!==after.part)){plan.reasons.push('changed-story-inheritance');plan.routes.push({sectionId:section.id,kind,variant,before,after});continue;}
  if(after.part)shownWith.set(after.part,before.part);if(before.part)shownBefore.set(before.part,after.part);
  let pair=plan.pairs.find(pair=>pair.beforePart===before.part&&pair.afterPart===after.part);
  if((before.part||after.part)&&!pair){pair={id:'story:'+JSON.stringify([kind,before.part??null,after.part??null]),kind,beforePart:before.part,afterPart:after.part,representation:before.part&&after.part?'inline':'unsupported-binding',decisionIds:[],coverage:{before:[],after:[]}};plan.pairs.push(pair);}
  if((old||next)&&pair)plan.bindings.push({id:'binding:'+section.id+':'+slot,sectionId:section.id,kind,variant,before:old,after:next,storyId:pair.id});
  plan.routes.push({sectionId:section.id,kind,variant,before,after,storyId:pair?.id});
 }
 // A story only a removed or added section refers to is not compared; the break keeps the
 // neighbouring revised section's stories on both sides.
 const oneSidedSources={before:new Set(plan.sections.filter(section=>section.oneSided&&section.before).map(section=>sourceKey(section.before!.source))),after:new Set(plan.sections.filter(section=>section.oneSided&&section.after).map(section=>sourceKey(section.after!.source)))};
 for(const [side,facts] of [['before',a],['after',b]] as const)for(const part of [...new Set(facts.bindings.filter(ref=>oneSidedSources[side].has(sourceKey(ref.section))).map(ref=>ref.targetPart))].sort()){
  if(plan.pairs.some(pair=>pair[side==='before'?'beforePart':'afterPart']===part))continue;
  const kind=facts.parts.find(item=>item.part===part)?.kind??'header';
  plan.pairs.push({id:'story:'+JSON.stringify([kind,side==='before'?part:null,side==='after'?part:null]),kind,beforePart:side==='before'?part:undefined,afterPart:side==='after'?part:undefined,representation:'section-only',decisionIds:[],coverage:{before:[],after:[]}});
 }
 // Preserve existing conventional orphan-story comparisons, scoped by part.
 for(const part of [...new Set([...a.parts,...b.parts].filter(part=>!part.active).map(part=>part.part))].sort()){
  if(plan.pairs.some(pair=>pair.beforePart===part||pair.afterPart===part))continue;
  const old=a.parts.find(item=>item.part===part&&!item.active),next=b.parts.find(item=>item.part===part&&!item.active);
  if(!old||!next)plan.reasons.push('unbound-unpaired-story');
  plan.pairs.push({id:'story:'+JSON.stringify([(old??next)!.kind,old?part:null,next?part:null]),kind:(old??next)!.kind,beforePart:old?part:undefined,afterPart:next?part:undefined,representation:old&&next?'inline':'unsupported-binding',decisionIds:[],coverage:{before:[],after:[]}});
 }
 for(const side of ['before','after'] as const){const parts=plan.pairs.map(pair=>pair[side+'Part' as 'beforePart'|'afterPart']).filter(Boolean);if(new Set(parts).size!==parts.length)plan.reasons.push('ambiguous-shared-story');}
 if(plan.bindings.some(binding=>!plan.pairs.some(pair=>pair.id===binding.storyId)))plan.reasons.push('unsupported-binding-presence-change');
 plan.supported=plan.reasons.length===0;
 return plan;
}
export function bindStoryDecisions(manifest:DocumentComparisonManifest,pair:StoryPair,decisions:ComparisonDecision[]) {
 const visit=(items:ComparisonDecision[])=>{for(const decision of items){pair.decisionIds.push(decision.id);visit(decision.children??[]);}};
 visit(decisions);
 for(const side of ['before','after'] as const)pair.coverage[side]=manifest.sources[side].filter(ref=>ref.part===pair[side+'Part' as 'beforePart'|'afterPart']&&['p','tbl'].includes(ref.kind??''));
}
export function emptyStoryBindingChanges(manifest:DocumentComparisonManifest,language:'ko'|'en') {
 return manifest.storyProjection.bindings.filter(binding=>{const pair=manifest.storyProjection.pairs.find(pair=>pair.id===binding.storyId);return !pair?.decisionIds.length && pair?.representation!=='inline' && Boolean(binding.before)!==Boolean(binding.after);}).map(binding=>{
  const label=(binding.kind==='header'?(language==='en'?'Header':'머리말'):(language==='en'?'Footer':'꼬리말'))+({'default':'','first':language==='en'?' (first page)':' (첫 쪽)','even':language==='en'?' (even pages)':' (짝수 쪽)'}[binding.variant]??'');
  const before=binding.before?label:'',after=binding.after?label:'';
  return {comparisonDecisionId:binding.id,kind:binding.before?'deleted' as const:'added' as const,section:'headerFooter' as const,blockType:'paragraph' as const,beforeLocation:before,afterLocation:after,before,after,segments:[{type:binding.before?'deleted' as const:'added' as const,text:label}],comments:[]};
 });
}
