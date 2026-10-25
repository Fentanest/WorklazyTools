import {TEXT_NORMALIZATION_POLICY} from "./normalizationPolicy.ts";
import { diffText } from "../document-compare/documentComparison.ts";
import { alignSequenceWithBudget, type SequenceAlignmentPair } from "../../utils/sequenceAlignment.ts";
import { myersAlign } from "../../utils/myersDiff.ts";
import { mapText } from "./ignore.ts";
import { annotateMoves } from "./moves.ts";
import type { MappedText, TextLine, TextMark, TextOptions, TextResult, TextRow } from "./resultTypes.ts";

type Segment = { type: "equal" | "deleted" | "added"; text: string };
const CELL_BUDGET = 1_500_000;
// Myers' cost grows with (N+M)*D; differences past this bound use the cell-budgeted alignment.
const editLimit = (items: number) => Math.max(64, Math.floor(CELL_BUDGET * 8 / (items + 1)));
// Lines compare as integer hashes first, so the line pass affords four times the distance.
const lineEditLimit = (items: number) => Math.max(64, Math.floor(CELL_BUDGET * 32 / (items + 1)));
// A line's content without its terminator: appending after a last line without one is an added line.
const lineContent = (line: TextLine) => line.key.endsWith("\n") ? line.key.slice(0, -1) : line.key;
// Lines longer than this (both sides together) are diffed between their common prefix and suffix.
const LONG_LINE = 10_000;
let sharedSegmenter: Intl.Segmenter | undefined;
const graphemeSegmenter = () => sharedSegmenter ??= new Intl.Segmenter(undefined, { granularity: "grapheme" });
// Below U+0300 there are no combining marks, surrogates or joiners: each code unit is its own
// grapheme cluster except a CR LF pair.
const simpleGraphemes = (text: string) => /^[\u0000-\u02ff]*$/u.test(text) && !text.includes("\r\n");
const graphemes = (text: string) => simpleGraphemes(text) ? text.split("") : Array.from(graphemeSegmenter().segment(text), item => item.segment);
// Code units below U+0300 and precomposed Hangul syllables never join each other (UAX #29: a
// syllable joins only following conjoining jamo), except CR LF: between two of them is always a
// boundary, and segmentation may start there without losing context.
const plainUnit = (code: number) => code < 0x300 || code >= 0xac00 && code <= 0xd7a3;
const safeBoundary = (text: string, index: number) => {
  const before = text.charCodeAt(index - 1), after = text.charCodeAt(index);
  return plainUnit(before) && plainUnit(after) && !(before === 13 && after === 10);
};
let boundaryCache: { text: string; start: number; end: number; starts: Set<number> }[] = [];
/** Whether `index` is a grapheme cluster boundary of `text`. A break depends only on what precedes
 * it and the next code unit, so segmentation from the nearest safe boundary before is exact. */
function graphemeBoundary(text: string, index: number) {
  if (index <= 0 || index >= text.length || safeBoundary(text, index)) return true;
  for (const cached of boundaryCache) if (cached.text === text && cached.start <= index && index < cached.end) return cached.starts.has(index);
  let start = index - 1;
  while (start > 0 && !safeBoundary(text, start)) start--;
  const end = Math.min(text.length, index + 256), starts = new Set<number>();
  for (const item of graphemeSegmenter().segment(text.slice(start, end))) starts.add(start + item.index);
  boundaryCache = [{ text, start, end, starts }, ...boundaryCache.slice(0, 3)];
  return starts.has(index);
}
const wordCharacter = (character: string | undefined) => character !== undefined && /[\p{L}\p{N}_]/u.test(character);
/** Common prefix and suffix lengths of two lines, cut on grapheme boundaries of both and, for word
 * comparison, outside words when a word boundary is near, so a small change inside a very long
 * line is diffed exactly. */
function commonEnds(left: string, right: string, words: boolean): [number, number] {
  const limit = Math.min(left.length, right.length);
  // Moves a cut back to the nearest position that satisfies `ok`; words give up after 256 units.
  const cut = (position: number, ok: (at: number) => boolean, reach: number) => {
    for (let at = position; at >= 0 && position - at <= reach; at--) if (ok(at)) return at;
    return undefined;
  };
  const graphemesAt = (l: number, r: number) => graphemeBoundary(left, l) && graphemeBoundary(right, r);
  let prefix = 0;
  while (prefix < limit && left.charCodeAt(prefix) === right.charCodeAt(prefix)) prefix++;
  const prefixOk = (at: number) => at === 0 || graphemesAt(at, at);
  const prefixWord = (at: number) => at === 0 || !(wordCharacter(left[at - 1]) && (wordCharacter(left[at]) || wordCharacter(right[at])));
  prefix = (words ? cut(prefix, at => prefixWord(at) && prefixOk(at), 256) : undefined) ?? cut(prefix, prefixOk, prefix)!;
  let suffix = 0;
  while (suffix < limit - prefix && left.charCodeAt(left.length - 1 - suffix) === right.charCodeAt(right.length - 1 - suffix)) suffix++;
  const suffixOk = (at: number) => at === 0 || graphemesAt(left.length - at, right.length - at);
  const suffixWord = (at: number) => at === 0 || !(wordCharacter(left[left.length - at]) && (wordCharacter(left[left.length - at - 1]) || wordCharacter(right[right.length - at - 1])));
  suffix = (words ? cut(suffix, at => suffixWord(at) && suffixOk(at), 256) : undefined) ?? cut(suffix, suffixOk, suffix)!;
  return [prefix, suffix];
}
export function mappedLines(mapped: MappedText): TextLine[] {
  const lines: TextLine[] = []; let rawStart = 0, number = 1;
  const matches = [...mapped.value.matchAll(/[^\n]*\n|[^\n]+$/g)];
  if (!matches.length && mapped.raw) return [{ raw: mapped.raw, key: "", start: 0, end: mapped.raw.length, number: 1, lastNumber: mapped.raw.split("\n").length, normalizedStart: 0 }];
  for (const match of matches) {
    const index = match.index!; const next = index + match[0].length;
    const rawEnd = next < mapped.starts.length ? mapped.starts[next] : mapped.raw.length;
    const raw = mapped.raw.slice(rawStart, rawEnd), breaks = (raw.match(/\n/g) ?? []).length;
    lines.push({ raw, key: match[0], start: rawStart, end: rawEnd, number, lastNumber: number + breaks - (raw.endsWith("\n") ? 1 : 0), normalizedStart: index });
    rawStart = rawEnd; number += breaks;
  }
  return lines;
}
function graphemeDiff(left: string, right: string, check: () => void): { segments: Segment[]; coarse: boolean } {
  if(left.length+right.length>100_000)return {segments:[...(left?[{type:"deleted" as const,text:left}]:[]),...(right?[{type:"added" as const,text:right}]:[])],coarse:true};
  if (!Intl.Segmenter) throw new Error("GRAPHEME_UNAVAILABLE");
  const a = graphemes(left), b = graphemes(right);
  const exact = myersAlign(a, b, (x, y) => x === y, editLimit(a.length + b.length), check);
  const aligned = exact ? { pairs: exact, budgetFallback: false } : alignSequenceWithBudget(a, b, { signature: x => x, equals: (x,y) => x===y, score: (x,y) => x===y?3:-3, acceptsPair: (x,y)=>x===y, cellBudget: CELL_BUDGET, checkCanceled: check });
  const segments: Segment[] = [];
  const push = (type: Segment['type'], text: string) => { if (!text) return; const previous=segments.at(-1); if(previous?.type===type) previous.text+=text; else segments.push({type,text}); };
  for (const pair of aligned.pairs) {
    const x = pair.beforeIndex === null ? "" : a[pair.beforeIndex], y = pair.afterIndex === null ? "" : b[pair.afterIndex];
    if (x && x === y) push("equal",x); else { push("deleted",x); push("added",y); }
  }
  return { segments, coarse: aligned.budgetFallback };
}
function marks(mapped: MappedText, line: TextLine | undefined, segments: Segment[], side: "left"|"right"): TextMark[] {
  if (!line) return [];
  const result: TextMark[] = []; let position=line.normalizedStart;
  for (const segment of segments) {
    if ((side==="left" && segment.type==="added") || (side==="right" && segment.type==="deleted")) continue;
    const end=position+segment.text.length;
    if (segment.type!=="equal") for(let i=position;i<end;i++) {
      const start=mapped.starts[i],rawEnd=mapped.ends[i],previous=result.at(-1);
      if(previous?.kind==="changed"&&start<=previous.end)previous.end=Math.max(previous.end,rawEnd);
      else result.push({start,end:rawEnd,kind:"changed"});
    }
    position=end;
  }
  for (const removed of mapped.removed) if(removed.start<line.end && removed.end>line.start) result.push({start:Math.max(removed.start,line.start),end:Math.min(removed.end,line.end),kind:"ignored",ruleIds:[...removed.rules]});
  return result;
}
/** Word-level segments with every boundary on a grapheme cluster boundary of both texts: an emoji
 * sequence or a letter with combining marks is never split between equal and changed text. */
function snapToGraphemes(segments: Segment[]): Segment[] {
  if (!Intl.Segmenter) return segments;
  const left = segments.filter(s => s.type !== "added").map(s => s.text).join(""), right = segments.filter(s => s.type !== "deleted").map(s => s.text).join("");
  if (simpleGraphemes(left) && simpleGraphemes(right)) return segments;
  // Boundaries are checked only where equal runs start and end.
  const both = (l: number, r: number) => graphemeBoundary(left, l) && graphemeBoundary(right, r);
  const result: Segment[] = [];
  const push = (type: Segment["type"], text: string) => { if (!text) return; const previous = result.at(-1); if (previous?.type === type) previous.text += text; else result.push({ type, text }); };
  // Changed text gathered since the last equal run: [deleted, added].
  let deleted = "", added = "", l = 0, r = 0;
  const flush = () => { push("deleted", deleted); push("added", added); deleted = added = ""; };
  for (const segment of segments) {
    if (segment.type === "deleted") { deleted += segment.text; l += segment.text.length; continue; }
    if (segment.type === "added") { added += segment.text; r += segment.text.length; continue; }
    // Trim the equal run to positions that are cluster boundaries on both sides.
    let start = 0, end = segment.text.length;
    while (start < end && !both(l + start, r + start)) start++;
    while (end > start && !both(l + end, r + end)) end--;
    if (start > 0) { deleted += segment.text.slice(0, start); added += segment.text.slice(0, start); }
    if (end > start) { flush(); push("equal", segment.text.slice(start, end)); }
    if (end < segment.text.length) { deleted += segment.text.slice(Math.max(start, end)); added += segment.text.slice(Math.max(start, end)); }
    l += segment.text.length; r += segment.text.length;
  }
  flush();
  return result;
}
/** Lines paired exactly where they are equal (Myers), and each run between equal lines aligned
 * by the cell-budgeted alignment so a modified line still pairs with its counterpart. */
function alignLines(a: TextLine[], b: TextLine[], check: () => void): { pairs: SequenceAlignmentPair[]; budgetFallback: boolean } {
  // Inside a run, a line whose content differs only by indentation or trailing space pairs first.
  const score = (x: TextLine, y: TextLine) => lineContent(x) === lineContent(y) ? 5 : lineContent(x).trim() === lineContent(y).trim() ? 4 : 0;
  const options = { signature: (x: TextLine) => lineContent(x), equals: (x: TextLine, y: TextLine) => lineContent(x) === lineContent(y), score, acceptsPair: () => true, cellBudget: CELL_BUDGET, checkCanceled: check };
  // Equal lines are anchored by Myers (a longest common subsequence, unlike patience anchors), which
  // compares lines O((N+M)·D) times: a hash of each line's content is compared before the content.
  const hash = (line: TextLine) => {
    let value = 0x811c9dc5;
    for (let i = 0, end = line.key.length - (line.key.endsWith("\n") ? 1 : 0); i < end; i++) value = Math.imul(value ^ line.key.charCodeAt(i), 0x01000193);
    return value;
  };
  const ha = Int32Array.from(a, hash), hb = Int32Array.from(b, hash);
  const sameLine = (x: number, y: number) => ha[x] === hb[y] && lineContent(a[x]) === lineContent(b[y]);
  const anchors = myersAlign(Array.from(a, (_, i) => i), Array.from(b, (_, i) => i), sameLine, lineEditLimit(a.length + b.length), check);
  if (!anchors) return alignSequenceWithBudget(a, b, options);
  const pairs: SequenceAlignmentPair[] = []; let budgetFallback = false, gapA: number[] = [], gapB: number[] = [];
  const flush = () => {
    // One line against one line always pairs (as the budgeted alignment does), without its setup.
    if (gapA.length === 1 && gapB.length === 1) pairs.push({ beforeIndex: gapA[0], afterIndex: gapB[0] });
    else if (gapA.length && gapB.length) {
      const gap = alignSequenceWithBudget(gapA.map(i => a[i]), gapB.map(i => b[i]), options);
      budgetFallback ||= gap.budgetFallback;
      for (const pair of gap.pairs) pairs.push({ beforeIndex: pair.beforeIndex === null ? null : gapA[pair.beforeIndex], afterIndex: pair.afterIndex === null ? null : gapB[pair.afterIndex] });
    } else {
      for (const index of gapA) pairs.push({ beforeIndex: index, afterIndex: null });
      for (const index of gapB) pairs.push({ beforeIndex: null, afterIndex: index });
    }
    gapA = []; gapB = [];
  };
  for (const pair of anchors) {
    if (pair.beforeIndex !== null && pair.afterIndex !== null) { flush(); pairs.push(pair); }
    else if (pair.beforeIndex !== null) gapA.push(pair.beforeIndex); else gapB.push(pair.afterIndex!);
  }
  flush();
  return { pairs, budgetFallback };
}
export function compareTexts(left: string, right: string, options: TextOptions, revision=0, deadlineMs=5000): TextResult {
  boundaryCache = [];
  if (left.length+right.length>4_000_000) throw new Error("TEXT_TOO_LARGE");
  for(const text of [left,right]){let breaks=0;for(let i=0;i<text.length;i++)if(text.charCodeAt(i)===10&&++breaks>200_000)throw new Error("TEXT_LINE_LIMIT");if(breaks+(text.endsWith("\n")?0:1)>200_000)throw new Error("TEXT_LINE_LIMIT");}
  const deadline=performance.now()+deadlineMs, check=()=>{if(performance.now()>deadline) throw new Error("TEXT_TIMEOUT");};
  const lm=mapText(left,options), rm=mapText(right,options); check();
  const a=mappedLines(lm),b=mappedLines(rm);
  if (!lm.value && !rm.value && (left || right)) {
    const empty:TextLine={raw:"",key:"",start:0,end:0,number:1,lastNumber:1,normalizedStart:0};
    if(!a.length)a.push(empty);if(!b.length)b.push(empty);
  }
  const aligned=alignLines(a,b,check);
  let coarse=aligned.budgetFallback;
  const counts={changed:0,added:0,deleted:0,ignored:0,equal:0};
  const rows=aligned.pairs.map<TextRow>((pair,index)=>{
    check(); const l=pair.beforeIndex===null?undefined:a[pair.beforeIndex],r=pair.afterIndex===null?undefined:b[pair.afterIndex];
    // Lines pair on their content; a final line terminator present on one side only is still a change.
    const lastPair=pair.beforeIndex===a.length-1&&pair.afterIndex===b.length-1;
    const kind=!l?"added":!r?"deleted":lineContent(l)===lineContent(r)?(lastPair&&l.key.endsWith("\n")!==r.key.endsWith("\n")?"changed":l.raw.replace(/\n$/u,"")===r.raw.replace(/\n$/u,"")?"equal":"ignored"):"changed";
    counts[kind]++;
    let segments:Segment[];
    if (kind==="equal"||kind==="ignored") segments=[{type:"equal",text:l?.key??r?.key??""}];
    else {
      const full=[l?.key??"",r?.key??""];
      const [prefix,suffix]=full[0].length+full[1].length>LONG_LINE?commonEnds(full[0],full[1],options.mode!=="character"):[0,0];
      const lv=full[0].slice(prefix,full[0].length-suffix),rv=full[1].slice(prefix,full[1].length-suffix);
      segments=diffLine(lv,rv);
      if(prefix)segments.unshift({type:"equal",text:full[0].slice(0,prefix)});
      if(suffix)segments.push({type:"equal",text:full[0].slice(full[0].length-suffix)});
    }
    return {id:`${revision}:${index}`,kind,left:l,right:r,leftMarks:marks(lm,l,segments,"left"),rightMarks:marks(rm,r,segments,"right")};
  });
  function diffLine(lv:string,rv:string):Segment[] {
    let segments:Segment[];
    if (options.mode==="character") { const result=graphemeDiff(lv,rv,check);segments=result.segments;coarse ||=result.coarse; }
    else {
      const tokens=(text:string)=>(text.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu)??[]).length;
      if ((tokens(lv)+1)*(tokens(rv)+1)>CELL_BUDGET) coarse=true;
      segments=snapToGraphemes(diffText(lv,rv));
      if(options.mode==="smart") {
        const refined:Segment[]=[];
        for(let i=0;i<segments.length;) {
          if(segments[i].type==="equal") {refined.push(segments[i++]);continue;}
          let deleted="",added="";
          while(i<segments.length&&segments[i].type!=="equal") {const s=segments[i++];if(s.type==="deleted")deleted+=s.text;else added+=s.text;}
          if(deleted&&added&&Math.max(deleted.length,added.length)<=4000) {const result=graphemeDiff(deleted,added,check);refined.push(...result.segments);coarse ||=result.coarse;}
          else {
            // A replacement too long to refine stays whole; that is a summarized result.
            if(deleted&&added)coarse=true;
            if(deleted)refined.push({type:"deleted",text:deleted});if(added)refined.push({type:"added",text:added});
          }
        }
        segments=refined;
      }
    }
    return segments;
  }
  const moves=annotateMoves(rows);
  const mapping=(value:MappedText)=>({rawLength:value.raw.length,normalizedLength:value.value.length,starts:Uint32Array.from(value.starts),ends:Uint32Array.from(value.ends),removedSpans:value.removed.map(span=>({...span,rules:[...span.rules]}))});
  const provenance={policyVersion:TEXT_NORMALIZATION_POLICY.version,rules:options.ignoreRules.map((literal,id)=>({id,literal})),left:mapping(lm),right:mapping(rm)};
  return {revision,provenance,options:structuredClone(options),rows,counts,moves,quality:coarse?"line-coarse":"full",reasons:coarse?["COMPARISON_BUDGET"]:[]};
}
