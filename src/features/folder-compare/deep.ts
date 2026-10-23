import type { ExcelComparePairOptions } from '../excel-compare/types.ts';
export type DeepKind = 'text' | 'excel' | 'image' | 'pdf' | 'word';
export type DeepResult =
  | { kind: 'text'; value: import('../text-compare/resultTypes.ts').TextResult }
  | { kind: 'excel'; value: import('../excel-compare/types.ts').ExcelComparePairResult }
  | { kind: 'image'; value: Pick<import('../image-compare/types.ts').ImageCompareResult, 'changedPixelCount' | 'differenceRatio' | 'width' | 'height'> }
  | { kind: 'pdf'; value: import('../pdf-compare/types.ts').ComparisonResult }
  | { kind: 'word'; value: import('../word-compare/wordWorkerClient.ts').WordWorkerPairResult[] };
export const deepLimit = (kind: DeepKind) => (kind === 'text' ? 4 : 16) * 1024 ** 2;
/** All heavy engines are existing consumers. PDF runs here on the main thread with DOM canvas. */
export async function compareSelected(kind: DeepKind, files: readonly [File, File], signal: AbortSignal, language: 'ko' | 'en', excel?: ExcelComparePairOptions): Promise<DeepResult> {
  signal.throwIfAborted(); if (files.some(f => f.size > deepLimit(kind))) throw new Error('selected-limit');
  const [left, right] = files;
  if (kind === 'text') {
    const [{ readText }, { DEFAULT_TEXT_OPTIONS }, { runModuleWorker }] = await Promise.all([import('../text-compare/input.ts'), import('../text-compare/resultTypes.ts'), import('../../utils/workerLifecycle.ts')]);
    const a = await readText(left), b = await readText(right); signal.throwIfAborted();
    const value = await runModuleWorker<object, import('../text-compare/resultTypes.ts').TextResult>(() => new Worker(new URL('../text-compare/textCompare.worker.ts', import.meta.url), { type: 'module' }), { left: a.text, right: b.text, options: DEFAULT_TEXT_OPTIONS, revision: 0 }, { signal, hardTimeoutMs: 10000, canceledMessage: 'Canceled', startErrorMessage: 'Comparison failed', resultErrorMessage: 'Comparison failed', timeoutMessage: 'Comparison timed out' });
    return { kind, value };
  }
  if (kind === 'excel') {
    if (!excel || !excel.left.sheetName || !excel.right.sheetName || !Number.isInteger(excel.left.headerRow) || excel.left.headerRow < 1 || !Number.isInteger(excel.right.headerRow) || excel.right.headerRow < 1) throw new Error('sheet-selection-required');
    const { runExcelComparePair } = await import('../excel-compare/excelCompareClient.ts');
    return { kind, value: await runExcelComparePair(left, right, excel, language, signal) };
  }
  if (kind === 'image') {
    const [{ compareImages }, { DEFAULT_PIXEL_OPTIONS, IDENTITY_TRANSFORM }] = await Promise.all([import('../image-compare/client.ts'), import('../image-compare/types.ts')]);
    const result = await compareImages(left, right, DEFAULT_PIXEL_OPTIONS, IDENTITY_TRANSFORM, signal, () => {});
    return { kind, value: { changedPixelCount: result.changedPixelCount, differenceRatio: result.differenceRatio, width: result.width, height: result.height } };
  }
  if (kind === 'pdf') {
    if (typeof document === 'undefined') throw new Error('canvas-required');
    const { comparePdfPairs } = await import('../pdf-compare/engine.ts');
    return { kind, value: await comparePdfPairs([{ id: 'selected', before: left, after: right }], { signal }) };
  }
  const [{ sniffDocumentFormat, validateDocumentPairFormats }, { compareWordFilePairs }] = await Promise.all([import('../document-compare/documentFormat.ts'), import('../word-compare/wordWorkerClient.ts')]);
  const before = await left.arrayBuffer(); signal.throwIfAborted(); const after = await right.arrayBuffer(); signal.throwIfAborted();
  if (validateDocumentPairFormats(sniffDocumentFormat(before), sniffDocumentFormat(after), language).family !== 'word') throw new Error('unsupported-document');
  return { kind, value: await compareWordFilePairs([{ beforeFile: left, afterFile: right }], { formatting: true, tables: true, metadata: true, trackedDocument: false, rewriteRevisionAuthor: false, revisionAuthor: '' }, undefined, language, signal) };
}
/** Serializes materialization, inspections and main-thread consumers across row/source replacements. */
export class DeepSession {
  private tail: Promise<void> = Promise.resolve(); private control?: AbortController; private generation = 0;
  get currentId() { return this.generation; }
  cancel(id = this.generation) { if (id === this.generation) this.control?.abort(); }
  async clear() { this.cancel(); await this.tail; }
  run<T>(task: (signal: AbortSignal) => Promise<T>): Promise<T> {
    this.cancel(); this.generation++; const control = new AbortController(); this.control = control;
    const work = this.tail.then(async () => { control.signal.throwIfAborted(); return task(control.signal); });
    this.tail = work.then(() => {}, () => {}); return work;
  }
}
