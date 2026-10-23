import type { WordDiffSegment, WordTableAxisPair } from "../excel-merger/types";

/** Paths address actual XML children (including property nodes), never filtered paragraph indexes. */
export interface DocumentSourceReference {
  part: string;
  path: number[];
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
}
export interface DocumentComparisonManifest {
  version: 1;
  policyVersion: "worklazy-document-1";
  inputRevision: { before?: string; after?: string };
  options: { formatting: boolean; tables: boolean; metadata: boolean };
  preservation: { comments: "preserve-after-existing-contract"; existingRevisions: "preserve-after-history" };
  decisions: ComparisonDecision[];
  sources: { before: DocumentSourceReference[]; after: DocumentSourceReference[] };
  exclusions: { formatting: "compare" | "preserve-after"; tables: DocumentSourceReference[]; metadata: DocumentSourceReference[] };
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
