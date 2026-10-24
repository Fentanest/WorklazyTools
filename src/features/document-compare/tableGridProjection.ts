import type {ComparisonDecision,DocumentComparisonManifest,DocumentSourceReference} from './comparisonManifest.ts';
const W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}';
const empty=JSON.stringify([W+'gridCol',[],'',[]]);
export interface TableGridProjection {policy:'worklazy-table-grid-1';mode:'paired'|'before-unpaired'|'after-unpaired'|'after-history';beforeCount:number;afterCount:number;restore:Array<{side:'before'|'after';index:number;implicit:boolean}>;changed:boolean;supported:boolean;reason?:string}
const key=(ref:DocumentSourceReference)=>JSON.stringify([ref.part,ref.path]);
export function buildTableGridProjections(manifest:DocumentComparisonManifest){
 const visit=(items:ComparisonDecision[])=>{for(const decision of items){visit(decision.children??[]);if(decision.type!=='table'||decision.trackedRepresentation!=='revision'||!decision.before.length&&!decision.after.length)continue;
  const refs={before:manifest.sources.before.find(ref=>key(ref)===key(decision.before[0]??{part:'',path:[]})),after:manifest.sources.after.find(ref=>key(ref)===key(decision.after[0]??{part:'',path:[]}))};
  const values=(side:'before'|'after')=>refs[side]?.normalizedProperties?.tblGrid?.supported[W+'gridCol']??[];
  const columns=(side:'before'|'after')=>refs[side]?.propertySnapshots?.tblGrid?.children.filter(child=>child.name===W+'gridCol')??[];
  const count=(side:'before'|'after')=>Math.max(columns(side).length,...(decision.columns??[]).map(pair=>(side==='before'?pair.beforeIndex:pair.afterIndex)===null?0:(side==='before'?pair.beforeIndex:pair.afterIndex)!+1),0);
  const beforeCount=count('before'),afterCount=count('after'),layout=manifest.formattingMask.effective.paragraph;
  const mode=!refs.before?'after-unpaired':!refs.after?'before-unpaired':'paired';
  const restore=Array.from({length:beforeCount},(_,index)=>{const pair=decision.columns?.find(pair=>pair.beforeIndex===index);const side:'before'|'after'=mode==='paired'&&!layout&&pair?.afterIndex!==null&&pair?.afterIndex!==undefined?'after':'before';const sourceIndex=side==='after'?pair!.afterIndex!:index;return {side,index:sourceIndex,implicit:sourceIndex>=columns(side).length};});
  let target=restore.map(entry=>values(entry.side)[entry.index]??empty),current=Array.from({length:afterCount},(_,index)=>values('after')[index]??empty);
  const footprint=(side:'before'|'after')=>manifest.sources[side].filter(ref=>refs[side]&&ref.part===refs[side]!.part&&refs[side]!.path.every((v,i)=>ref.path[i]===v)).flatMap(ref=>[...Object.entries(ref.normalizedProperties?.tcPr?.supported??{}).filter(([name])=>[W+'gridSpan',W+'vMerge'].includes(name)),...Object.entries(ref.normalizedProperties?.trPr?.unsupported??{}).filter(([name])=>[W+'gridBefore',W+'gridAfter'].includes(name))]);
  const structural=JSON.stringify(footprint('before'))!==JSON.stringify(footprint('after'))||decision.moved||beforeCount!==afterCount||(decision.columns??[]).some(pair=>pair.beforeIndex===null||pair.afterIndex===null||pair.beforeIndex!==pair.afterIndex);
  const history=!!refs.after?.normalizedProperties?.tblGrid?.history;
  const projection:TableGridProjection={policy:'worklazy-table-grid-1',mode,beforeCount,afterCount,restore,changed:mode==='paired'&&JSON.stringify(target)!==JSON.stringify(current),supported:true};
  if(mode==='paired'&&history&&!structural){projection.mode='after-history';projection.restore=Array.from({length:afterCount},(_,index)=>({side:'after' as const,index,implicit:index>=columns('after').length}));projection.changed=false;}
  if(mode==='paired'&&(projection.changed||structural)){
   const unsafe=history||!layout&&restore.some(entry=>entry.side==='before'&&!decision.columns?.some(pair=>pair.beforeIndex===entry.index&&pair.afterIndex===null))||(['before','after'] as const).some(side=>{
    const root=refs[side];if(root?.normalizedProperties?.tblGrid&&Object.keys(root.normalizedProperties.tblGrid.unsupported).length)return true;
    if(manifest.sources[side].some(ref=>root&&ref.part===root.part&&root.path.every((v,i)=>ref.path[i]===v)&&Object.entries(ref.normalizedProperties?.trPr?.unsupported??{}).some(([name,values])=>[W+'gridBefore',W+'gridAfter'].includes(name)&&values.some(value=>!JSON.parse(value)[1].some(([attribute,value]:[string,string])=>attribute===W+'val'&&value==='0')))))return true;
    return manifest.sources[side].some(ref=>root&&ref.part===root.part&&root.path.every((v,i)=>ref.path[i]===v)&&Object.entries(ref.normalizedProperties?.tcPr?.supported??{}).some(([name,values])=>name===W+'vMerge'||name===W+'gridSpan'&&values.some(value=>!JSON.parse(value)[1].some(([attribute,value]:[string,string])=>attribute===W+'val'&&value==='1'))));
   });
   if(unsafe){projection.supported=false;projection.reason='unsupported-grid-geometry-or-history';}
  }
  decision.gridProjection=projection;
 }};visit(manifest.decisions);
}
