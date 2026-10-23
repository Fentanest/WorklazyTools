export type TextTransform="lowercase"|"sort"|"trim"|"removeEmpty"|"lineSpaces";
// Explicit operations adapted from extracted module 79063; never change TextTools.
export function transformText(text:string,action:TextTransform,start=0,end=text.length) {
  const selected=text.slice(start,end);
  const changed=action==="lowercase"?selected.toLowerCase():action==="sort"?selected.split("\n").sort().join("\n"):action==="trim"?selected.split("\n").map(line=>line.trim()).join("\n"):action==="removeEmpty"?selected.split("\n").filter(line=>line.trim()!=="").join("\n"):selected.replace(/\r\n|\n/g," ");
  return text.slice(0,start)+changed+text.slice(end);
}
