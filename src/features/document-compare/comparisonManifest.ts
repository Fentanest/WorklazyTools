import type {StoryFacts,StoryProjection} from "./storyProjection.ts";
import type { DocumentCapabilities, DocumentProvenance } from "./documentCapabilities.ts";
import type { FormattingMask } from "./formattingMask.ts";
import type { WordDiffSegment, WordTableAxisPair } from "../excel-merger/types";
import { findSource } from "./manifestIndex.ts";

/** Paths address actual XML children (including property nodes), never filtered paragraph indexes. */
export interface PropertyFact { supported: Record<string, string[]>; unsupported: Record<string, string[]>; history: boolean }
export interface XmlPropertyTree { name: string; attributes: Record<string, string>; text: string; children: XmlPropertyTree[] }
export interface ObjectEventContext { comparisonIndex:number; offset:number; afterParagraph?:DocumentSourceReference; before:Array<{source:DocumentSourceReference;start:number;end:number}>; after:Array<{source:DocumentSourceReference;start:number;end:number}> }
export interface DeletedDrawingStyleProjection { before:DocumentSourceReference; beforeFact:PropertyFact; policy:"restore-before-unpaired"|"copy-revised-run"|"inherit-after-default"; afterParagraph?:DocumentSourceReference; afterFact?:PropertyFact; cursor?:number; families?:string[]; source?:DocumentSourceReference }
export interface DrawingPropertyProjection { representation:"revision"|"preserve-after-history"; before: DocumentSourceReference; after: DocumentSourceReference; beforeFact: PropertyFact; afterFact: PropertyFact; families: string[]; excludedFamilies: string[] }
export interface ObjectSourceEvent {kind:"drawing"|"hyperlink"|"note";start:number;end:number;signature:string;supported:boolean;target:string;paragraphPath:number[];runPath:number[]}
export interface DocumentSourceReference {
  objectEvent?: ObjectSourceEvent;
  objectEventsSupported?: boolean;
  unsupportedObjectQName?: boolean;
  part: string;
  path: number[];
  kind?: string;
  rawText?: string;
  opaqueSignature?: string;
  copySignature?: string;
  propertySnapshots?: Record<string, XmlPropertyTree | null>;
  normalizedProperties?: Record<string, PropertyFact>;
  paragraphPath?: number[];
  textRange?: [number, number];
  attributes?: Record<string, string>;
  label?: string;
}
export interface ManifestRecord {
  source?: DocumentSourceReference;
  text: string;
  rawText?: string;
  paragraphs?: ManifestRecord[];
}
export interface ComparisonDecision {
  id: string;
  type: "paragraph" | "table";
  before: DocumentSourceReference[];
  after: DocumentSourceReference[];
  moved: boolean;
  gridProjection?:import("./tableGridProjection.ts").TableGridProjection;
  mergeProjection?: {policy:"worklazy-merge-1";beforeBoundary:number;afterBoundary:number;properties:Array<{before:DocumentSourceReference;after:DocumentSourceReference;beforeFact:PropertyFact;afterFact:PropertyFact;families:string[];history:boolean}>;beforeEvents:Array<{source:DocumentSourceReference;side:number}>;afterEvents:Array<{source:DocumentSourceReference;side:number}>};
  objectEvents?: {unchangedDrawings:Array<{before:DocumentSourceReference;after:DocumentSourceReference}>;contexts:ObjectEventContext[];deletedDrawingStyles:DeletedDrawingStyleProjection[];drawingProperties:DrawingPropertyProjection[];unchangedLinks:Array<{before:DocumentSourceReference;after:DocumentSourceReference}>;propertiesSupported:boolean;policy:"worklazy-source-events-5";before:DocumentSourceReference[];after:DocumentSourceReference[];changed:boolean};
  screenFormattingFamilies?: string[];
  deletedFormattingPolicy?: "restore-before-unpaired" | "paired-revised";
  wholeRestoreStyles?: Array<{ before: DocumentSourceReference; afterParagraph: DocumentSourceReference; projections: RestoreStyleProjection[] }>;
  noteId?:string;
  /** "replace": recorded in the tracked DOCX as the whole original block deleted and the whole revised block inserted. */
  trackedRepresentation: "revision" | "preserve-after" | "note-reference" | "replace";
  trackedReason?: "existing-comment-contract" | "paragraph-shape" | "opaque-content";
  segments: WordDiffSegment[];
  /** Raw XML text differs from display text for generated numbering labels. */
  textSegments: WordDiffSegment[];
  comparisons: TextComparison[];
  beforeText: string;
  afterText: string;
  rows?: WordTableAxisPair[];
  columns?: WordTableAxisPair[];
  children?: ComparisonDecision[];
  splitSlices?: Array<[number, number]>;
}
export interface FormattingScope { id: string; before: DocumentSourceReference; after: DocumentSourceReference; property: string; beforeFact: PropertyFact; afterFact: PropertyFact; families: string[]; excludedFamilies: string[]; comparisonId?: string; beforeStart?: number; afterStart?: number; length?: number }
export interface FormattingSpan { beforeStart: number; afterStart: number; length: number; families: string[]; history: boolean; scopeId: string }
export interface PropertyAction { id: string; before: DocumentSourceReference; after: DocumentSourceReference; property: string; families: string[]; representation: "revision" | "preserve-after-history" | "whole-node-revision"; decisionId?: string; scopeId: string }
export interface SourceSlices { before: Array<{ source: DocumentSourceReference; range: [number, number] }>; after: Array<{ source: DocumentSourceReference; range: [number, number] }> }
export interface RestoreStyleProjection { beforeStart: number; afterStart: number; length: number; kind: "equal" | "deleted"; policy: "copy-revised-run" | "inherit-after-default"; source?: DocumentSourceReference }
export interface TextComparison { sourceSlices?: SourceSlices; restoreStyles?: RestoreStyleProjection[]; before: string; after: string; segments: WordDiffSegment[]; formatting?: { paragraphFamilies: string[]; paragraphHistory: boolean; paragraphScopeId: string; beforeSlices: Array<{ source: DocumentSourceReference; range: [number, number] }>; afterSlices: Array<{ source: DocumentSourceReference; range: [number, number] }>; spans: FormattingSpan[]; history: boolean } }
export interface DocumentComparisonManifest {
  noteFacts:{before?:import("./noteProjection.ts").NoteFacts;after?:import("./noteProjection.ts").NoteFacts};
  noteProjection:import("./noteProjection.ts").NoteProjection;
  storyFacts:{before?:StoryFacts;after?:StoryFacts};
  storyProjection:StoryProjection;
  nativeSources: {before:Array<{format:"doc"|"hwp";story:string;paragraph:number;section?:number;control?:number}>;after:Array<{format:"doc"|"hwp";story:string;paragraph:number;section?:number;control?:number}>};
  capabilities: {before?:DocumentCapabilities;after?:DocumentCapabilities};
  provenance: {before?:DocumentProvenance;after?:DocumentProvenance};
  fields: {before:Array<{kind:string;instruction:string;cachedText:string;sources:DocumentSourceReference[]}>;after:Array<{kind:string;instruction:string;cachedText:string;sources:DocumentSourceReference[]}>};
  version: 1;
  policyVersion: "worklazy-document-1";
  inputRevision: { before?: string; after?: string };
  options: { formatting: boolean; tables: boolean; metadata: boolean };
  preservation: { comments: "preserve-after-existing-contract"; existingRevisions: "preserve-after-history" };
  decisions: ComparisonDecision[];
  formattingMask: { version: "worklazy-formatting-mask-1"; requested: FormattingMask; inactiveRequested?: FormattingMask; effective: FormattingMask };
  formattingPolicyVersion: "worklazy-formatting-2";
  formattingScopes: FormattingScope[];
  restoreStylePolicyVersion: "worklazy-restore-style-1";
  restorePropertyPairs: Array<{ before: DocumentSourceReference; after: DocumentSourceReference; property: string }>;
  propertyExclusions: Array<{ side: "before" | "after"; source: DocumentSourceReference; property: string; reason: "unpaired-style" }>;
  propertyActions: PropertyAction[];
  formattingExcluded: string[];
  sources: { before: DocumentSourceReference[]; after: DocumentSourceReference[] };
  coverage: { before: SourceCoverage[]; after: SourceCoverage[] };
  exclusions: { formatting: "compare" | "preserve-after"; tables: DocumentSourceReference[]; metadata: DocumentSourceReference[] };
}

export interface SourceCoverage {
  source: DocumentSourceReference;
  noteId?:string;
  /** "nested": a paragraph or table inside another owned paragraph (text box content) or table (a table in a cell), carried by that block's decision. */
  disposition: "decision" | "preserve-after" | "unsupported" | "note-reference" | "note-special" | "nested";
  decisionId?: string;
  reason?: "blank-paragraph" | "excluded-table" | "excluded-metadata" | "opaque-content" | "unmapped-source" | "existing-comment-contract" | "note-separator";
}

export function completeManifestCoverage(manifest: DocumentComparisonManifest) {
  const decisions: ComparisonDecision[] = [];
  const unsafeAncestors = new Set<string>();
  const visit = (items: ComparisonDecision[], unsafe = false) => { for (const item of items) {
    decisions.push(item);
    if (unsafe) unsafeAncestors.add(item.id);
    visit(item.children ?? [], unsafe || item.moved || item.before.length !== 1 || item.after.length !== 1);
  } };
  visit(manifest.decisions);
  const key = (ref: DocumentSourceReference) => JSON.stringify([ref.part, ref.path]);
  const descendant = (ref: DocumentSourceReference, parent: DocumentSourceReference) => ref.part === parent.part && parent.path.every((value, index) => ref.path[index] === value);
  for (const side of ["before", "after"] as const) {
    const sources = manifest.sources[side];
    const tables = sources.filter((source) => source.kind === "tbl");
    // First decision (in visit order) that owns each source, as `decisions.find` did per source.
    const owners = new Map<string, ComparisonDecision>();
    for (const item of decisions) for (const ref of item[side]) { const id = key(ref); if (!owners.has(id)) owners.set(id, item); }
    manifest.coverage[side] = sources.filter((source) => source.kind === "p" || source.kind === "tbl").map((source) => {
      const decision = owners.get(key(source));
      if (!manifest.options.metadata && source.part !== "word/document.xml") return { source, disposition: "preserve-after", reason: "excluded-metadata" };
      if (!manifest.options.tables && tables.some((table) => descendant(source, table))) return { source, disposition: "preserve-after", reason: "excluded-table" };
      const note=manifest.noteProjection.pairs.find(pair=>pair[side]&&pair[side]!.source.part===source.part&&pair[side]!.source.path.every((value,index)=>source.path[index]===value));
      if(note&&(!note.before||!note.after))return {source,disposition:'note-reference',noteId:note.id};
      if(side==='before'&&manifest.noteProjection.partActions?.some(action=>action.create&&action.specials.some(note=>descendant(source,note.source))))return {source,disposition:'note-special',reason:'note-separator'};
      if(!note&&manifest.noteFacts[side]?.containers.some(note=>note.type!=='normal'&&note.source.part===source.part&&note.source.path.every((value,index)=>source.path[index]===value)))return {source,disposition:'preserve-after',reason:'note-separator'};
      if (decision?.trackedRepresentation === "preserve-after") return { source, disposition: "decision", decisionId: decision.id };
      const commentOwner = source.part === "word/comments.xml" ? decisions.find((item) => item.trackedReason === "existing-comment-contract" && item[side].some((ref) => descendant(source, ref))) : undefined;
      if (commentOwner) return { source, disposition: "preserve-after", decisionId: commentOwner.id, reason: "existing-comment-contract" };
      if (!decision) for (let length = source.path.length - 1; length > 0; length--) {
        const ancestor = findSource(manifest, side, { part: source.part, path: source.path.slice(0, length) });
        const carrier = ancestor?.kind === "p" || ancestor?.kind === "tbl" ? owners.get(key(ancestor)) : undefined;
        if (carrier) return { source, disposition: "nested", decisionId: carrier.id };
      }
      if (source.opaqueSignature && !source.objectEventsSupported) {
        const before = decision?.before.length === 1 ? findSource(manifest, "before", decision.before[0]) : undefined;
        const after = decision?.after.length === 1 ? findSource(manifest, "after", decision.after[0]) : undefined;
        if (decision?.trackedRepresentation !== "replace" && (!before || !after || (decision && unsafeAncestors.has(decision.id)) || decision?.moved || before.rawText !== after.rawText || before.copySignature !== after.copySignature || before.opaqueSignature !== after.opaqueSignature)) return { source, disposition: "unsupported", reason: "opaque-content" };
      }
      if (decision) return { source, disposition: "decision", decisionId: decision.id };
      if (source.kind === "p" && !source.rawText?.trim() && !source.opaqueSignature) return { source, disposition: "preserve-after", reason: "blank-paragraph" };
      return { source, disposition: "unsupported", reason: "unmapped-source" };
    });
  }
}

/** Freeze only after the screen projection has completed its cell annotations. */
export function freezeComparisonManifest<T extends DocumentComparisonManifest>(manifest: T): T {
  // Iterative and without per-object value arrays: the manifest holds every source fact of both documents.
  const stack: object[] = [manifest];
  const pending: object[] = [];
  while (stack.length) {
    const value = stack.pop()!;
    if (Object.isFrozen(value)) continue;
    pending.push(value);
    if (Array.isArray(value)) { for (let index = 0; index < value.length; index++) { const child: unknown = value[index]; if (child && typeof child === "object") stack.push(child); } }
    else for (const key of Object.keys(value)) { const child = (value as Record<string, unknown>)[key]; if (child && typeof child === "object") stack.push(child); }
  }
  // Children first, as before: an object is frozen only after everything below it.
  for (let index = pending.length - 1; index >= 0; index--) Object.freeze(pending[index]);
  return manifest;
}
