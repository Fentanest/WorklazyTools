import { encodeReportXlsxSheet } from './xlsxText.ts';
import { REPORT_LABELS } from './labels.ts';
import { writeXlsxReport } from '../../utils/xlsxReport.ts';
import { assertGeneratedXlsxReport, assertReceivedXlsxReport } from '../excel-compare/reportIntegrity.ts';
import { createIncrementalZipArchiveWriter } from '../../utils/zipArchive.ts';
import { createSafeFileName } from '../../utils/fileNameSafety.ts';
import { BlobWriter } from '@zip.js/zip.js';
import { assertSnapshot, assertOutput, assertReport, rawReportText, reportMetadata, statusCounts, REPORT_LIMITS, type ExportSnapshot } from './snapshot.ts';
export async function writeSnapshotXlsx(snapshot: ExportSnapshot, signal: AbortSignal): Promise<Blob> {
  assertSnapshot(snapshot);signal.throwIfAborted(); assertReport(snapshot.rows.length <= REPORT_LIMITS.xlsxRows, 'REPORT_XLSX_LIMIT');
  const metadata = Object.entries({ ...reportMetadata(snapshot), statusCounts: statusCounts(snapshot) }).map(([key, value]) => [key, JSON.stringify(value)]);
  // Line numbers (as Diffchecker's text Excel shows them) come after the existing columns, which keep their positions.
  const lines = (value: unknown) => { const range = value && typeof value === 'object' ? value as { firstLine?: unknown; lastLine?: unknown } : undefined; const first = range?.firstLine, last = range?.lastLine;
    return typeof first === 'number' && Number.isSafeInteger(first) && first > 0 ? typeof last === 'number' && Number.isSafeInteger(last) && last > first ? `${first}–${last}` : String(first) : ''; };
  const side = (row: ExportSnapshot['rows'][number], key: 'left' | 'right') => row.coordinates && typeof row.coordinates === 'object' && !Array.isArray(row.coordinates) ? lines((row.coordinates as Record<string, unknown>)[key]) : '';
  const rows = snapshot.rows.map(row => [row.id, row.status, row.left, row.right, JSON.stringify(row.coordinates ?? null), JSON.stringify(row.metadata ?? null), side(row, 'left'), side(row, 'right')]);
  const labels=REPORT_LABELS[snapshot.language];
  const raw = await writeXlsxReport({ creator: 'Worklazy Tools', sheets: [{ name: labels.metadata, headers: [labels.field, labels.value], rows: metadata }, { name: labels.results, headers: [labels.id, labels.status, labels.left, labels.right, labels.coordinates, labels.metadata, labels.leftLine, labels.rightLine], rows }].map(encodeReportXlsxSheet) });
  signal.throwIfAborted(); const buffer = new Uint8Array(raw).slice().buffer;
  await assertGeneratedXlsxReport(buffer); assertReceivedXlsxReport(buffer, buffer.byteLength); signal.throwIfAborted();
  return assertOutput(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}
export function writeSnapshotTxt(snapshot: ExportSnapshot) { return assertOutput(new Blob([rawReportText(snapshot)], { type: 'text/plain;charset=utf-8' })); }
export async function writeSnapshotZip(snapshot: ExportSnapshot, writers: readonly { name: string; write: () => Promise<Blob> }[], signal: AbortSignal): Promise<Blob> {
  assertSnapshot(snapshot);assertReport(writers.length <= 8, 'REPORT_LIMIT'); signal.throwIfAborted();
  const sink = new BlobWriter('application/zip'), zip = createIncrementalZipArchiveWriter(sink, signal, { level: 0, useWebWorkers: false }); let total = 0;
  try {
    const add = async (name: string, blob: Blob) => { signal.throwIfAborted(); total += blob.size; assertReport(total <= REPORT_LIMITS.outputBytes, 'REPORT_OUTPUT_LIMIT'); await zip.add(createSafeFileName(name), blob); signal.throwIfAborted(); };
    await add('snapshot.txt', writeSnapshotTxt(snapshot));
    if(snapshot.rawSources){await add('original-left.txt',writeOriginalText(snapshot,'left'));await add('original-right.txt',writeOriginalText(snapshot,'right'));}
    for (const writer of writers) await add(writer.name, assertOutput(await writer.write()));
    await zip.close(); signal.throwIfAborted(); return assertOutput(await sink.getData());
  } catch (error) { await zip.discard(); throw error; }
}

export function writeOriginalText(snapshot: ExportSnapshot, side: 'left'|'right') {
  assertSnapshot(snapshot);assertReport(snapshot.rawSources,'REPORT_RAW_UNAVAILABLE');const text=snapshot.rawSources[side],bytes=new TextEncoder().encode(text);
  assertReport(new TextDecoder('utf-8',{fatal:true}).decode(bytes)===text,'REPORT_TEXT_ENCODING');
  return new Blob([bytes],{type:'text/plain;charset=utf-8'});
}
