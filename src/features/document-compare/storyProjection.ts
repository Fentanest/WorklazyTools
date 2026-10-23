import type {ComparisonDecision,DocumentComparisonManifest,DocumentSourceReference} from './comparisonManifest.ts';
export interface StoryFacts {policy:'worklazy-story-facts-1';parts:Array<{part:string;kind:'header'|'footer';sha256:string;contentType:string|null;active:boolean}>;sections:Array<{source:DocumentSourceReference;final:boolean;history:boolean}>;bindings:Array<{section:DocumentSourceReference;reference:DocumentSourceReference;kind:'header'|'footer';variant:string;ownerPart:string;rId:string;type:string;rawTarget:string;targetMode:string;targetPart:string}>;errors:string[]}
export interface StoryPair {id:string;kind:'header'|'footer';beforePart?:string;afterPart?:string;representation:'inline'|'unsupported-binding';decisionIds:string[];coverage:{before:DocumentSourceReference[];after:DocumentSourceReference[]}}
export interface StoryProjection {policy:'worklazy-story-projection-1';supported:boolean;reasons:string[];pairs:StoryPair[];bindings:Array<{id:string;kind:'header'|'footer';variant:string;before?:StoryFacts['bindings'][number];after?:StoryFacts['bindings'][number];storyId:string}>}
export function buildStoryProjection(manifest:DocumentComparisonManifest):StoryProjection {
 const a=manifest.storyFacts.before,b=manifest.storyFacts.after;
 const plan:StoryProjection={policy:'worklazy-story-projection-1',supported:true,reasons:[],pairs:[],bindings:[]};
 if(!manifest.options.metadata||!a||!b)return plan;
 plan.reasons.push(...a.errors,...b.errors);
 if((a.bindings.length||b.bindings.length)&&([...a.sections,...b.sections].some(section=>!section.final)||a.sections.length>1||b.sections.length>1))plan.reasons.push('complex-section-bindings');
 const slots=[...new Set([...a.bindings,...b.bindings].map(ref=>ref.kind+':'+ref.variant))].sort();
 for(const slot of slots){
  const old=a.bindings.find(ref=>ref.kind+':'+ref.variant===slot),next=b.bindings.find(ref=>ref.kind+':'+ref.variant===slot);
  const kind=(old??next)!.kind;
  let pair=plan.pairs.find(pair=>pair.beforePart===old?.targetPart&&pair.afterPart===next?.targetPart);
  if(!pair){pair={id:'story:'+JSON.stringify([kind,old?.targetPart??null,next?.targetPart??null]),kind,beforePart:old?.targetPart,afterPart:next?.targetPart,representation:old&&next?'inline':'unsupported-binding',decisionIds:[],coverage:{before:[],after:[]}};plan.pairs.push(pair);}
  plan.bindings.push({id:'binding:'+slot,kind,variant:(old??next)!.variant,before:old,after:next,storyId:pair.id});
 }
 // Preserve existing conventional orphan-story comparisons, scoped by part.
 for(const part of [...new Set([...a.parts,...b.parts].filter(part=>!part.active).map(part=>part.part))].sort()){
  if(plan.pairs.some(pair=>pair.beforePart===part||pair.afterPart===part))continue;
  const old=a.parts.find(item=>item.part===part&&!item.active),next=b.parts.find(item=>item.part===part&&!item.active);
  if(!old||!next)plan.reasons.push('unbound-unpaired-story');
  plan.pairs.push({id:'story:'+JSON.stringify([(old??next)!.kind,old?part:null,next?part:null]),kind:(old??next)!.kind,beforePart:old?part:undefined,afterPart:next?part:undefined,representation:old&&next?'inline':'unsupported-binding',decisionIds:[],coverage:{before:[],after:[]}});
 }
 for(const side of ['before','after'] as const){const parts=plan.pairs.map(pair=>pair[side+'Part' as 'beforePart'|'afterPart']).filter(Boolean);if(new Set(parts).size!==parts.length)plan.reasons.push('ambiguous-shared-story');}
 if(plan.bindings.some(binding=>Boolean(binding.before)!==Boolean(binding.after)))plan.reasons.push('unsupported-binding-presence-change');
 plan.supported=plan.reasons.length===0;
 return plan;
}
export function bindStoryDecisions(manifest:DocumentComparisonManifest,pair:StoryPair,decisions:ComparisonDecision[]) {
 const visit=(items:ComparisonDecision[])=>{for(const decision of items){pair.decisionIds.push(decision.id);visit(decision.children??[]);}};
 visit(decisions);
 for(const side of ['before','after'] as const)pair.coverage[side]=manifest.sources[side].filter(ref=>ref.part===pair[side+'Part' as 'beforePart'|'afterPart']&&['p','tbl'].includes(ref.kind??''));
}
export function emptyStoryBindingChanges(manifest:DocumentComparisonManifest,language:'ko'|'en') {
 return manifest.storyProjection.bindings.filter(binding=>!manifest.storyProjection.pairs.find(pair=>pair.id===binding.storyId)?.decisionIds.length && Boolean(binding.before)!==Boolean(binding.after)).map(binding=>{
  const label=(binding.kind==='header'?(language==='en'?'Header':'머리말'):(language==='en'?'Footer':'꼬리말'))+({'default':'','first':language==='en'?' (first page)':' (첫 쪽)','even':language==='en'?' (even pages)':' (짝수 쪽)'}[binding.variant]??'');
  const before=binding.before?label:'',after=binding.after?label:'';
  return {comparisonDecisionId:binding.id,kind:binding.before?'deleted' as const:'added' as const,section:'headerFooter' as const,blockType:'paragraph' as const,beforeLocation:before,afterLocation:after,before,after,segments:[{type:binding.before?'deleted' as const:'added' as const,text:label}],comments:[]};
 });
}
