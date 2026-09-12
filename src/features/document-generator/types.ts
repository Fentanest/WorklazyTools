import type { SpreadsheetBookData } from '../spreadsheet-core/inputAdapter.ts';
import type { SafeFileName } from '../../utils/fileNameSafety.ts';

export type GeneratorLanguage = 'ko' | 'en';
export type GeneratorErrorCode = 'CANCELED' | 'BUSY' | 'DISPOSED' | 'UNSUPPORTED_DATA' | 'DAMAGED_DATA'
  | 'UNSUPPORTED_TEMPLATE' | 'DAMAGED_TEMPLATE' | 'UNSUPPORTED_TAG' | 'MISSING_MAPPING' | 'INVALID_ALIAS'
  | 'INVALID_SELECTION' | 'CELL_ERROR' | 'MISSING_CACHE' | 'INVALID_VALUE' | 'INVALID_NAME' | 'NAME_COLLISION'
  | 'STORAGE_LIMIT' | 'STORAGE_WRITE' | 'STORAGE_READ' | 'GENERATION_FAILED' | 'EXPORT_FAILED' | 'NO_RESULTS';
export interface GeneratorSource { id: string; fileName: string; book: SpreadsheetBookData }
export interface GeneratorSelection {
  source: GeneratorSource;
  sheetName: string;
  headerRow: number;
  /** Physical 1-based column -> exact variable alias. Blank/duplicate headers require explicit aliases. */
  aliases?: Readonly<Record<number, string>>;
}
export interface RowOrigin { sourceId: string; sourceFile: string; sheet: string; row: number }
export type GeneratorRowStatus = 'not-started' | 'success' | 'failed' | 'canceled';
export interface GeneratorRow extends RowOrigin {
  id: string;
  values: Readonly<Record<string, string>>;
  fileName?: SafeFileName;
  error?: GeneratorErrorCode;
}
export interface GeneratorTemplate { file: File; variables: readonly string[] }
export interface GeneratorPlan { template: GeneratorTemplate; rows: readonly GeneratorRow[] }
export interface GeneratorManifestRow extends RowOrigin {
  id: string; fileName: string; status: GeneratorRowStatus; bytes: number; error?: GeneratorErrorCode;
}
export interface GeneratorResult extends RowOrigin { id: string; fileName: SafeFileName; bytes: number }
export interface GeneratorAttempt { id: number; rows: readonly GeneratorManifestRow[]; storageKind?: 'memory' | 'opfs'; fallback?: boolean }
export interface GeneratorSnapshot {
  state: 'idle' | 'preparing' | 'generating' | 'exporting' | 'canceling' | 'disposed';
  version: number;
  resultAttemptId?: number;
  results: readonly GeneratorResult[];
  attempt?: GeneratorAttempt;
  zip?: Blob;
}
export interface GeneratorDownload {
  blob: Blob;
  url: string;
  /** Caller releases after download's next task, or when removing its link. Client also releases at retirement/dispose. */
  release(): void;
}
