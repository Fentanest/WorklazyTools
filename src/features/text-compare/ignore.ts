import {TEXT_NORMALIZATION_POLICY as policy} from "./normalizationPolicy.ts";
import type { MappedText, RemovedSpan, TextOptions } from "./resultTypes.ts";

// Literal matches are found against the ORIGINAL text, then unioned. Removing
// one match must never create a new match for another rule in the same run.
export function literalSpans(raw: string, rules: string[]): RemovedSpan[] {
  if (rules.length > 100 || rules.some(rule => !rule.length || rule.length > 512)) throw new Error("IGNORE_RULE_INVALID");
  const found: RemovedSpan[] = [];
  const seen=new Set<string>();
  rules.forEach((rule, id) => {
    if(seen.has(rule))return;seen.add(rule);
    let offset = raw.indexOf(rule);
    while (offset >= 0) {
      // A match touching this rule's previous one extends it (a run of matches is one span).
      const last = found.at(-1);
      if (last && last.rules[0] === id && offset <= last.end) last.end = Math.max(last.end, offset + rule.length);
      else found.push({ start: offset, end: offset + rule.length, rules: [id] });
      if (found.length > 2_000_000) throw new Error("IGNORE_MATCH_LIMIT");
      offset = raw.indexOf(rule, offset + 1);
    }
  });
  found.sort((a, b) => a.start - b.start || a.end - b.end);
  const union: RemovedSpan[] = [];
  for (const span of found) {
    const last = union.at(-1);
    if (last && span.start <= last.end) { last.end = Math.max(last.end, span.end); last.rules = [...new Set([...last.rules, ...span.rules])]; }
    else union.push({ ...span });
  }
  return union;
}
export function mapText(raw: string, options: TextOptions): MappedText {
  const removed = literalSpans(raw, options.ignoreRules);
  const starts: number[] = [], ends: number[] = [], pieces: string[] = [];
  let span = 0;
  for (let offset = 0; offset < raw.length;) {
    const point = String.fromCodePoint(raw.codePointAt(offset)!); const end = offset + point.length;
    while (removed[span] && removed[span].end <= offset) span++;
    let value = point;
    if (removed[span] && removed[span].start < end && removed[span].end > offset) value = "";
    else {
      if (options.ignoreWhitespace && policy.whitespace.includes(value)) value = "";
      if (options.normalizeLineEndings && value === "\r") value = raw[end] === "\n" ? "" : "\n";
      if (options.ignoreQuotes && value) value = policy.singleQuotes.includes(value) ? "'" : policy.doubleQuotes.includes(value) ? '"' : value;
      if (options.ignoreDashes && value) value = policy.dashes.includes(value) ? "-" : value;
    }
    pieces.push(value);
    for (let i = 0; i < value.length; i++) { starts.push(offset); ends.push(end); }
    offset = end;
  }
  const value=pieces.join("");
  if(!options.ignoreCase)return { raw, value, starts, ends, removed };
  // Lowercase the complete string: final Greek sigma depends on surrounding
  // letters. Map expansions (e.g. İ -> i + dot) back to their original span.
  const lower=value.toLowerCase(),lowerStarts:number[]=[],lowerEnds:number[]=[];
  let position=0;
  for(const point of value){
    for(let i=0;i<point.toLowerCase().length;i++){lowerStarts.push(starts[position]);lowerEnds.push(ends[position+point.length-1]);}
    position+=point.length;
  }
  if(lowerStarts.length!==lower.length)throw new Error("CASE_MAPPING_UNAVAILABLE");
  return {raw,value:lower,starts:lowerStarts,ends:lowerEnds,removed};
}
