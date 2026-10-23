import type { MappedText, RemovedSpan, TextOptions } from "./resultTypes.ts";

// Literal matches are found against the ORIGINAL text, then unioned. Removing
// one match must never create a new match for another rule in the same run.
export function literalSpans(raw: string, rules: string[]): RemovedSpan[] {
  if (rules.length > 100 || rules.some(rule => !rule.length || rule.length > 512)) throw new Error("IGNORE_RULE_INVALID");
  const found: RemovedSpan[] = [];
  Array.from(new Set(rules)).forEach((rule, id) => {
    let offset = raw.indexOf(rule);
    while (offset >= 0) {
      found.push({ start: offset, end: offset + rule.length, rules: [id] });
      if (found.length > 100_000) throw new Error("IGNORE_MATCH_LIMIT");
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
      if (options.ignoreWhitespace && /^[\t \v\f]$/.test(value)) value = "";
      if (options.normalizeLineEndings && value === "\r") value = raw[end] === "\n" ? "" : "\n";
      if (options.ignoreQuotes) value = value.replace(/[‘’‚‛]/g, "'").replace(/[“”„‟]/g, '"');
      if (options.ignoreDashes) value = value.replace(/[‐‑‒–—―−]/g, "-");
      if (options.ignoreCase) value = value.toLowerCase();
    }
    pieces.push(value);
    for (let i = 0; i < value.length; i++) { starts.push(offset); ends.push(end); }
    offset = end;
  }
  return { raw, value: pieces.join(""), starts, ends, removed };
}
