// Textarea values/selection offsets normalize CRLF and CR to LF. Keep the raw
// working copy separate so typing one letter cannot rewrite every line ending.
export function editorText(raw:string){return raw.replace(/\r\n?/g,"\n");}
export function rawEditorOffset(raw:string,editorOffset:number){
  let position=0,offset=0;
  while(position<raw.length&&offset<editorOffset){position+=raw[position]==="\r"&&raw[position+1]==="\n"?2:1;offset++;}
  return position;
}
export function preferredLineEnding(raw:string):"\r\n"|"\r"|"\n" {
  const crlf=(raw.match(/\r\n/g)??[]).length,cr=(raw.match(/\r(?!\n)/g)??[]).length,lf=(raw.match(/(?<!\r)\n/g)??[]).length;
  return crlf&&crlf>=cr&&crlf>=lf?"\r\n":cr>lf?"\r":"\n";
}
export function applyEditorChange(raw:string,next:string,lineEnding=preferredLineEnding(raw)){
  const previous=editorText(raw);if(previous===next)return raw;
  let prefix=0,suffix=0;
  while(prefix<previous.length&&prefix<next.length&&previous[prefix]===next[prefix])prefix++;
  while(suffix<previous.length-prefix&&suffix<next.length-prefix&&previous[previous.length-1-suffix]===next[next.length-1-suffix])suffix++;
  const start=rawEditorOffset(raw,prefix),end=rawEditorOffset(raw,previous.length-suffix);
  return raw.slice(0,start)+next.slice(prefix,next.length-suffix).replace(/\n/g,lineEnding)+raw.slice(end);
}
