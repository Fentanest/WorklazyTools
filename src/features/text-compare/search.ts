export interface RawSearchMatch {start:number;end:number}
/** Whole-string locale lowercase keeps the previous search behavior. Only offset
 * mapping uses code points; expansions such as İ map back to the complete raw span. */
export function rawSearchMatches(raw:string,query:string,baseOffset=0,limit=2500){
 const needle=query.toLocaleLowerCase(),haystack=raw.toLocaleLowerCase();
 if(!needle)return {matched:false,ranges:[] as RawSearchMatch[],truncated:false};
 let at=haystack.indexOf(needle);if(at<0)return {matched:false,ranges:[] as RawSearchMatch[],truncated:false};
 if(limit<=0)return {matched:true,ranges:[] as RawSearchMatch[],truncated:true};
 const matches:{start:number;end:number}[]=[];
 while(at>=0&&matches.length<limit){matches.push({start:at,end:at+needle.length-1});at=haystack.indexOf(needle,at+needle.length);}
 const boundaries=matches.flatMap((match,index)=>[{offset:match.start,index,end:false},{offset:match.end,index,end:true}]);
 const ranges:RawSearchMatch[]=matches.map(()=>({start:0,end:0}));let rawOffset=0,normalizedOffset=0,boundary=0;
 for(const point of raw){const next=normalizedOffset+point.toLocaleLowerCase().length;
  while(boundary<boundaries.length&&boundaries[boundary].offset<next){const item=boundaries[boundary++];ranges[item.index][item.end?'end':'start']=baseOffset+rawOffset+(item.end?point.length:0);}
  rawOffset+=point.length;normalizedOffset=next;
 }
 // A locale with context-dependent length rules cannot receive invented positions.
 if(normalizedOffset!==haystack.length)return {matched:true,ranges:[] as RawSearchMatch[],truncated:true};
 return {matched:true,ranges:ranges.filter((range,index)=>!index||range.start!==ranges[index-1].start||range.end!==ranges[index-1].end),truncated:at>=0};
}
