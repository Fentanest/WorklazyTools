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
export interface EditorIntent { start:number; end:number; inputType:string }
export function applyEditorChange(raw:string,next:string,lineEnding=preferredLineEnding(raw),intent?:EditorIntent){
  const previous=editorText(raw);if(previous===next)return raw;
  if(intent){
    let start=intent.start,end=intent.end;
    if(start===end&&intent.inputType.startsWith("delete")){
      const removed=previous.length-next.length;
      if(intent.inputType.endsWith("Backward"))start-=removed;
      else if(intent.inputType.endsWith("Forward"))end+=removed;
    }
    const inserted=next.length-previous.length+end-start;
    if(start>=0&&end>=start&&end<=previous.length&&inserted>=0&&previous.slice(0,start)===next.slice(0,start)&&previous.slice(end)===next.slice(start+inserted)){
      return raw.slice(0,rawEditorOffset(raw,start))+next.slice(start,start+inserted).replace(/\n/g,lineEnding)+raw.slice(rawEditorOffset(raw,end));
    }
  }
  let prefix=0,suffix=0;
  while(prefix<previous.length&&prefix<next.length&&previous[prefix]===next[prefix])prefix++;
  while(suffix<previous.length-prefix&&suffix<next.length-prefix&&previous[previous.length-1-suffix]===next[next.length-1-suffix])suffix++;
  const start=rawEditorOffset(raw,prefix),end=rawEditorOffset(raw,previous.length-suffix);
  return raw.slice(0,start)+next.slice(prefix,next.length-suffix).replace(/\n/g,lineEnding)+raw.slice(end);
}
