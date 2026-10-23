import type { WordDiffSegment, WordTableAxisPair } from "../excel-merger/types";

/** Paths address actual XML children (including property nodes), never filtered paragraph indexes. */
export interface DocumentSourceReference {
  part: string;
  path: number[];
  kind?: string;
  rawText?: string;
  opaqueSignature?: string;
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
  trackedRepresentation: "revision" | "preserve-after";
  trackedReason?: "existing-comment-contract";
  segments: WordDiffSegment[];
  /** Raw XML text differs from display text for generated numbering labels. */
  textSegments: WordDiffSegment[];
  comparisons: Array<{ before: string; after: string; segments: WordDiffSegment[] }>;
  beforeText: string;
  afterText: string;
  rows?: WordTableAxisPair[];
  columns?: WordTableAxisPair[];
  children?: ComparisonDecision[];
  splitSlices?: Array<[number, number]>;
}
export interface DocumentComparisonManifest {
  version: 1;
  policyVersion: "worklazy-document-1";
  inputRevision: { before?: string; after?: string };
  options: { formatting: boolean; tables: boolean; metadata: boolean };
  preservation: { comments: "preserve-after-existing-contract"; existingRevisions: "preserve-after-history" };
  decisions: ComparisonDecision[];
  sources: { before: DocumentSourceReference[]; after: DocumentSourceReference[] };
  coverage: { before: SourceCoverage[]; after: SourceCoverage[] };
  exclusions: { formatting: "compare" | "preserve-after"; tables: DocumentSourceReference[]; metadata: DocumentSourceReference[] };
}

export interface SourceCoverage {
  source: DocumentSourceReference;
  disposition: "decision" | "preserve-after" | "unsupported";
  decisionId?: string;
  reason?: "blank-paragraph" | "excluded-table" | "excluded-metadata" | "opaque-content" | "unmapped-source";
}

export function completeManifestCoverage(manifest: DocumentComparisonManifest) {
  const decisions: ComparisonDecision[] = [];
  const visit = (items: ComparisonDecision[]) => { for (const item of items) { decisions.push(item); visit(item.children ?? []); } };
  visit(manifest.decisions);
  const key = (ref: DocumentSourceReference) => JSON.stringify([ref.part, ref.path]);
  const descendant = (ref: DocumentSourceReference, parent: DocumentSourceReference) => ref.part === parent.part && parent.path.every((value, index) => ref.path[index] === value);
  for (const side of ["before", "after"] as const) {
    const sources = manifest.sources[side];
    const tables = sources.filter((source) => source.kind === "tbl");
    manifest.coverage[side] = sources.filter((source) => source.kind === "p" || source.kind === "tbl").map((source) => {
      const decision = decisions.find((item) => item[side].some((ref) => key(ref) === key(source)));
      if (!manifest.options.metadata && source.part !== "word/document.xml") return { source, disposition: "preserve-after", reason: "excluded-metadata" };
      if (!manifest.options.tables && tables.some((table) => descendant(source, table))) return { source, disposition: "preserve-after", reason: "excluded-table" };
      if (source.opaqueSignature) {
        const before = decision?.before.length === 1 ? manifest.sources.before.find((ref) => key(ref) === key(decision.before[0])) : undefined;
        const after = decision?.after.length === 1 ? manifest.sources.after.find((ref) => key(ref) === key(decision.after[0])) : undefined;
        if (!before || !after || before.opaqueSignature !== after.opaqueSignature) return { source, disposition: "unsupported", reason: "opaque-content" };
      }
      if (decision) return { source, disposition: "decision", decisionId: decision.id };
      if (source.kind === "p" && !source.rawText?.trim() && !source.opaqueSignature) return { source, disposition: "preserve-after", reason: "blank-paragraph" };
      return { source, disposition: "unsupported", reason: "unmapped-source" };
    });
  }
}

/** Freeze only after the screen projection has completed its cell annotations. */
export function freezeComparisonManifest<T extends DocumentComparisonManifest>(manifest: T): T {
  const freeze = (value: unknown) => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  };
  freeze(manifest);
  return manifest;
}
