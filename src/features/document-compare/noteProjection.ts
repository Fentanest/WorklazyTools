import {maskedSourceFormatting} from './formattingMask.ts';
import {buildObjectEventContexts,eventPosition,splitBoundaryNoteContexts} from './objectEventContext.ts';
import type {ComparisonDecision,DocumentComparisonManifest,DocumentSourceReference} from './comparisonManifest.ts';
export interface NoteContainer {source:DocumentSourceReference;kind:string;id:string;type:string;contentSignature?:string;specialRevisionShape?:string[]}
export interface NoteFacts {policy:'worklazy-note-facts-1';parts:string[];containers:NoteContainer[];references:Array<{source:DocumentSourceReference;kind:string;id:string}>;errors:string[]}
export interface NotePair {id:string;kind:string;before?:NoteContainer;after?:NoteContainer;decisionIds:string[];coverage:{before:DocumentSourceReference[];after:DocumentSourceReference[]}}
export interface NoteProjection {policy:'worklazy-note-projection-1';supported:boolean;reasons:string[];pairs:NotePair[];specialChecks?:Array<{part:string;role:string;before:NoteContainer[];after:NoteContainer[];includedEqual:boolean;redline:boolean}>;partActions?:Array<{part:string;kind:string;before:boolean;after:boolean;create:boolean;specials:NoteContainer[]}>;references:Array<{decisionId:string;before?:DocumentSourceReference;after?:DocumentSourceReference;noteId:string}>}
const key=(ref:DocumentSourceReference)=>JSON.stringify([ref.part,ref.path]);
export function buildNoteProjection(manifest:DocumentComparisonManifest):NoteProjection {
 const a=manifest.noteFacts.before,b=manifest.noteFacts.after,plan:NoteProjection={policy:'worklazy-note-projection-1',supported:true,reasons:[],pairs:[],references:[]};
 if(!manifest.options.metadata||!a||!b)return plan;
 plan.partActions=['footnote','endnote'].filter(kind=>a.parts.includes('word/'+kind+'s.xml')||b.parts.includes('word/'+kind+'s.xml')).map(kind=>{const part='word/'+kind+'s.xml';return {part,kind,before:a.parts.includes(part),after:b.parts.includes(part),create:!b.parts.includes(part),specials:b.parts.includes(part)?[]:a.containers.filter(note=>note.source.part===part&&note.type!=='normal')};});
 plan.reasons.push(...a.errors,...b.errors);
 plan.specialChecks=[];
 for(const action of plan.partActions.filter(action=>action.before&&action.after)){
  const special=(facts:NoteFacts)=>facts.containers.filter(note=>note.source.part===action.part&&note.type!=='normal');
  const old=special(a),next=special(b);
  for(const role of new Set([...old,...next].map(note=>note.type))){
   const x=old.filter(note=>note.type===role),y=next.filter(note=>note.type===role);
   const includedEqual=x.length===1&&y.length===1&&x[0].contentSignature===y[0].contentSignature&&maskedSourceFormatting(manifest.sources.before,x[0].source,manifest.formattingMask.effective)===maskedSourceFormatting(manifest.sources.after,y[0].source,manifest.formattingMask.effective);
   const redline=x.length===1&&y.length===1&&Boolean(x[0].specialRevisionShape)&&JSON.stringify(x[0].specialRevisionShape)===JSON.stringify(y[0].specialRevisionShape);
   plan.specialChecks.push({part:action.part,role,before:x,after:y,includedEqual,redline});
   if(!includedEqual&&!redline)plan.reasons.push('unsupported-paired-note-special');
  }
 }

 const add=(old:NoteContainer|undefined,next:NoteContainer|undefined)=>{
  const id='note:'+JSON.stringify([old?.source??null,next?.source??null]);let pair=plan.pairs.find(pair=>pair.id===id);
  if(!pair){pair={id,kind:(old??next)!.kind,before:old,after:next,decisionIds:[],coverage:{before:[],after:[]}};plan.pairs.push(pair);}return pair;
 };
 for(const check of plan.specialChecks??[])if(check.redline)add(check.before[0],check.after[0]);
 const visit=(items:ComparisonDecision[])=>{for(const decision of items){visit(decision.children??[]);if(decision.type!=='paragraph'||decision.trackedRepresentation!=='revision')continue;
  const refs=(side:'before'|'after')=>(side==='before'?a:b).references.filter(ref=>decision[side].some(parent=>parent.part===ref.source.part&&JSON.stringify(parent.path)===JSON.stringify(ref.source.objectEvent!.paragraphPath)));
  const old=refs('before'),next=refs('after'),contexts=buildObjectEventContexts(manifest,decision,old.map(ref=>ref.source),next.map(ref=>ref.source));
  // Refuse only boundary ordinals without a complete source-order schedule.
  if(decision.before.length===1&&decision.after.length===2){
   const boundary=decision.splitSlices![0][1];
   const leftLength=Array.from(manifest.sources.after.find(ref=>key(ref)===key(decision.after[0]))?.rawText??'').length;
   if(old.filter(ref=>ref.source.objectEvent!.start===boundary).length>1&&splitBoundaryNoteContexts(manifest,decision,old.map(ref=>ref.source),next.map(ref=>ref.source)).size!==old.filter(ref=>ref.source.objectEvent!.start===boundary).length&&next.some(ref=>ref.source.objectEvent!.start===leftLength&&JSON.stringify(ref.source.objectEvent!.paragraphPath)===JSON.stringify(decision.after[0].path))&&next.some(ref=>ref.source.objectEvent!.start===0&&JSON.stringify(ref.source.objectEvent!.paragraphPath)===JSON.stringify(decision.after[1].path)))plan.reasons.push('ambiguous-split-note-order');
  }
  const available=[...next];
  for(const ref of old){const index=available.findIndex(candidate=>candidate.kind===ref.kind&&eventPosition(decision,contexts,'before',ref.source)===eventPosition(decision,contexts,'after',candidate.source));
   const target=index<0?undefined:available.splice(index,1)[0];const before=a.containers.find(note=>note.kind===ref.kind&&note.id===ref.id&&note.type==='normal'),after=target?b.containers.find(note=>note.kind===target.kind&&note.id===target.id&&note.type==='normal'):undefined;
   if(!before||target&&!after){plan.reasons.push('missing-note-target');continue;}const pair=add(before,after);plan.references.push({decisionId:decision.id,before:ref.source,after:target?.source,noteId:pair.id});
  }
  for(const ref of available){const after=b.containers.find(note=>note.kind===ref.kind&&note.id===ref.id&&note.type==='normal');if(after)plan.references.push({decisionId:decision.id,after:ref.source,noteId:add(undefined,after).id});else plan.reasons.push('missing-note-target');}
 }};visit(manifest.decisions);
 // Legacy unreferenced note fixtures retain their established path/ID contract;
 // anchored notes never select correspondence using these identifiers.
 for(const old of a.containers.filter(note=>note.type==='normal'&&!plan.pairs.some(pair=>pair.before&&key(pair.before.source)===key(note.source)))){
  const next=b.containers.find(note=>note.type==='normal'&&note.kind===old.kind&&note.id===old.id&&key(note.source)===key(old.source)&&!plan.pairs.some(pair=>pair.after&&key(pair.after.source)===key(note.source)));
  if(!a.references.some(ref=>ref.kind===old.kind&&ref.id===old.id)&&next&&!b.references.some(ref=>ref.kind===next.kind&&ref.id===next.id))add(old,next);else plan.reasons.push('unmapped-note-container');
 }
 for(const side of ['before','after'] as const){const containers=plan.pairs.flatMap(pair=>pair[side]?[key(pair[side]!.source)]:[]);if(new Set(containers).size!==containers.length)plan.reasons.push('ambiguous-note-correspondence');}
 if(b.containers.some(note=>note.type==='normal'&&!plan.pairs.some(pair=>pair.after&&key(pair.after.source)===key(note.source))))plan.reasons.push('unmapped-note-container');
 plan.supported=plan.reasons.length===0;return plan;
}
export function bindNoteDecisions(manifest:DocumentComparisonManifest,pair:NotePair,decisions:ComparisonDecision[]) {
 const visit=(items:ComparisonDecision[])=>{for(const decision of items){pair.decisionIds.push(decision.id);if(!pair.before||!pair.after){decision.trackedRepresentation='note-reference';decision.noteId=pair.id;}visit(decision.children??[]);}};visit(decisions);
 for(const side of ['before','after'] as const){const root=pair[side]?.source;pair.coverage[side]=root?manifest.sources[side].filter(ref=>ref.part===root.part&&root.path.every((item,index)=>ref.path[index]===item)&&['p','tbl'].includes(ref.kind??'')):[];}
}
