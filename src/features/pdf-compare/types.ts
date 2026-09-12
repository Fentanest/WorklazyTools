export type PixelThreshold = 0 | 16 | 32;
export interface PageMapping { before: number | null; after: number | null }
export interface PdfCompareInput { id: string; before: File; after: File; mapping?: PageMapping[] }
export type PdfCompareErrorCode = 'password' | 'invalid-pdf' | 'read-failed' | 'render-failed' | 'invalid-mapping';
export type DiffSegment = { type: 'equal' | 'added' | 'deleted'; text: string };
export interface PageText { text: string; available: boolean }
export interface SelectedTextItem { str: string; hasEOL: boolean; transform: number[]; width: number; height: number; pageIndex: number }
export interface RenderGeometry {
  width: number; height: number; beforeWidth: number; beforeHeight: number; afterWidth: number; afterHeight: number;
  scaleFactor: number; dpi: number; reducedResolution: boolean; pageSizeChanged: boolean;
}
export interface PageComparison {
  mapping: PageMapping; status: 'complete' | 'unknown' | 'canceled'; error?: PdfCompareErrorCode;
  beforeTextAvailable: boolean; afterTextAvailable: boolean; beforeText: string; afterText: string;
  textComparison: 'equal-extracted-text' | 'different-extracted-text' | 'unavailable'; segments: DiffSegment[];
  visualComparison: 'equal-pixels' | 'different-pixels' | 'added' | 'deleted' | 'unknown';
  pixelCount: number | null; pixelRatio: number | null; threshold: PixelThreshold; geometry: RenderGeometry | null;
  warnings: ('extraction-limit' | 'reduced-resolution')[];
}
export interface PairComparison {
  id: string; beforeName: string; afterName: string; beforePageCount: number; afterPageCount: number;
  mappingSource: 'page-number' | 'manual'; status: 'complete' | 'failed' | 'canceled'; error?: PdfCompareErrorCode;
  pages: PageComparison[]; partial: boolean;
}
export interface ComparisonResult { runId: number; pairs: PairComparison[]; canceled: boolean }
export interface CompareProgress { pairIndex: number; pairCount: number; completedPages: number; totalPages: number }
export interface SelectedPreview {
  before: HTMLCanvasElement | null; after: HTMLCanvasElement | null; overlay: HTMLCanvasElement | null;
  beforeItems: SelectedTextItem[]; afterItems: SelectedTextItem[]; geometry: RenderGeometry; release(): void;
}
