export interface TextOptions {
  mode: "smart" | "word" | "character";
  ignoreCase: boolean;
  ignoreWhitespace: boolean;
  ignoreQuotes: boolean;
  ignoreDashes: boolean;
  normalizeLineEndings: boolean;
  ignoreRules: string[];
}
export const DEFAULT_TEXT_OPTIONS: TextOptions = { mode: "smart", ignoreCase: false, ignoreWhitespace: false, ignoreQuotes: false, ignoreDashes: false, normalizeLineEndings: false, ignoreRules: [] };
export interface RemovedSpan { start: number; end: number; rules: number[] }
export interface MappedText { raw: string; value: string; starts: number[]; ends: number[]; removed: RemovedSpan[] }
export interface TextLine { raw: string; key: string; start: number; end: number; number: number; lastNumber: number; normalizedStart: number }
export interface TextMark { start: number; end: number; kind: "changed" | "ignored"; ruleIds?: number[] }
export interface TextRow {
  id: string;
  kind: "equal" | "ignored" | "changed" | "added" | "deleted";
  left?: TextLine; right?: TextLine;
  leftMarks: TextMark[]; rightMarks: TextMark[];
}
export interface TextSourceMapping {
  rawLength:number; normalizedLength:number;
  starts:Uint32Array; ends:Uint32Array; removedSpans:RemovedSpan[];
}
export interface TextResult {
  revision: number;
  provenance: {policyVersion:string;rules:{id:number;literal:string}[];left:TextSourceMapping;right:TextSourceMapping};
  options: TextOptions;
  rows: TextRow[];
  counts: { changed: number; added: number; deleted: number; ignored: number; equal: number };
  quality: "full" | "line-coarse";
  reasons: string[];
}
