export type MergeMode = "sheets" | "vertical" | "horizontal";
export type SheetNameRule = "file-sheet" | "sheet-file" | "sheet";
export type SheetSelectionMode = "all" | "positions" | "custom";

export interface ExcelInputPayload {
  id: string;
  name: string;
  displayName?: string;
  preservedLegacy?: boolean;
  buffer: ArrayBuffer;
  password?: string;
  selectedSheetNames?: string[];
  csvEncoding?: "auto" | "utf-8" | "euc-kr";
  retention?: ExcelRetentionOptions;
}

export interface ExcelRetentionOptions {
  formulas: boolean;
  formatting: boolean;
}

export interface ExcelMergeOptions {
  mergeMode: MergeMode;
  trimEmptyEdges: boolean;
  sheetTrimRows: boolean;
  sheetTrimColumns: boolean;
  sheetTrimThreshold: number;
  skipHeaderRows: number;
  sheetNameRule: SheetNameRule;
  outputPassword?: string;
}

export interface ExcelMergeResult {
  buffer: ArrayBuffer;
  fileCount: number;
  sheetCount: number;
  outputSheetCount: number;
  encrypted: boolean;
  warnings: string[];
}

export interface ExcelInspectionResult {
  id: string;
  encrypted: boolean;
  sheetNames: string[];
  error?: string;
}

export type WordChangeKind = "added" | "deleted" | "changed" | "format" | "moved";
export type WordRecordKind = "body" | "table" | "headerFooter" | "comment" | "note";
export type WordViewKind = WordChangeKind | "comment" | "unchanged";

export interface WordDiffSegment {
  type: "equal" | "added" | "deleted";
  text: string;
}

export interface WordDiffItem {
  kind: WordChangeKind;
  section: WordRecordKind;
  location: string;
  beforeLocation: string;
  afterLocation: string;
  before: string;
  after: string;
  segments: WordDiffSegment[];
  moved?: boolean;
}

export interface WordCommentViewItem {
  kind: "added" | "deleted" | "changed" | "unchanged";
  beforeId: string;
  afterId: string;
  beforeAuthor: string;
  afterAuthor: string;
  before: string;
  after: string;
  segments: WordDiffSegment[];
}

export interface WordDocumentViewItem {
  kind: WordViewKind;
  section: WordRecordKind;
  blockType: "paragraph" | "table";
  tableIndex?: number;
  beforeLocation: string;
  afterLocation: string;
  before: string;
  after: string;
  segments: WordDiffSegment[];
  comments: WordCommentViewItem[];
  moved?: boolean;
}

export interface WordCellComment {
  id: string;
  author: string;
  text: string;
}

export interface WordTableCell {
  text: string;
  format: string;
  location: string;
  segments: WordDiffSegment[];
  comments: WordCellComment[];
}

export interface WordTableAxisPair {
  beforeIndex: number | null;
  afterIndex: number | null;
}

export interface WordTableComparison {
  index: number;
  kind: "added" | "deleted" | "changed" | "unchanged";
  beforeIndex: number | null;
  afterIndex: number | null;
  before: WordTableCell[][];
  after: WordTableCell[][];
  rowPairs: WordTableAxisPair[];
  columnPairs: WordTableAxisPair[];
  beforeKinds: WordViewKind[][];
  afterKinds: WordViewKind[][];
}

export interface WordCompareResult {
  beforeName: string;
  afterName: string;
  summary: {
    added: number;
    deleted: number;
    changed: number;
    format: number;
    unchanged: number;
    moved?: number;
  };
  changes: WordDiffItem[];
  tables: WordTableComparison[];
  views: {
    document: WordDocumentViewItem[];
    headerFooter: WordDocumentViewItem[];
    note: WordDocumentViewItem[];
  };
  warnings: string[];
}
