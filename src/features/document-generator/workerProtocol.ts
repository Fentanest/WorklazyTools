import type { SpreadsheetBookData } from '../spreadsheet-core/inputAdapter.ts';
import type { GeneratorErrorCode } from './types.ts';
export type GeneratorWorkerRequest = { id: number } & (
  | { type: 'inspect'; buffer: ArrayBuffer }
  | { type: 'parse'; buffer: ArrayBuffer; fileName: string }
  | { type: 'render'; buffer: ArrayBuffer; values: Readonly<Record<string, string>> }
);
export type GeneratorWorkerResponse = { id: number } & (
  | { type: 'progress'; phase: 'rendering' }
  | { type: 'error'; code: GeneratorErrorCode }
  | { type: 'inspect'; variables: string[] }
  | { type: 'parse'; book: SpreadsheetBookData }
  | { type: 'render'; buffer: ArrayBuffer }
);
