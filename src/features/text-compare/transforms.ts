export type TextTransform="lowercase"|"sort"|"trim"|"removeEmpty"|"lineSpaces";
// Explicit operations adapted from extracted module79063. Preserve raw terminators
// when changing line contents; sorting reuses the original terminator positions.
// TextTools is unchanged. The approved line policy remains LF/CRLF; lone CR is content.
export function transformText(text:string,action:TextTransform,start=0,end=text.length) {
  const selected=text.slice(start,end);
  let changed:string;
  if(action==="lowercase")changed=selected.toLowerCase();
  else if(action==="lineSpaces")changed=selected.replace(/\r\n|\n/g," ");
  else {
    const lines=Array.from(selected.matchAll(/[^\n]*\n|[^\n]+$/g),match=>{
      const raw=match[0],ending=raw.match(/\r?\n$/)?.[0]??"";
      return {body:raw.slice(0,raw.length-ending.length),ending};
    });
    if(action==="sort"){
      const bodies=lines.map(line=>line.body).sort();
      changed=lines.map((line,index)=>bodies[index]+line.ending).join("");
    }else changed=lines.filter(line=>action!=="removeEmpty"||line.body.trim()!=="").map(line=>(action==="trim"?line.body.trim():line.body)+line.ending).join("");
  }
  return text.slice(0,start)+changed+text.slice(end);
}
