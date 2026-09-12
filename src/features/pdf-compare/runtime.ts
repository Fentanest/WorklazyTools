import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { openOwnedPdfDocument } from '../pdf-editor/pdfPreview.ts';
import { waitForPdfRender } from '../pdf-editor/pdfRenderLifecycle.ts';
import { waitWithAbort } from '../../utils/pdfOwnedDocument.ts';
import { featureMessage } from '../../i18n/featureMessages.ts';
import { checkAbort, PdfCompareError, textFromItems } from './kernel.ts';
import type { DiffSegment, PageText, PixelThreshold, RenderGeometry, SelectedTextItem } from './types.ts';
export interface OwnedPdf { document: PDFDocumentProxy; deferAbortUntilRenderSettles(): void; close(): Promise<void> }
export function errorCode(error: unknown, fallback: 'read-failed' | 'render-failed' = 'read-failed') {
  if (error instanceof PdfCompareError) return error.code;
  if (error instanceof Error) {
    if (error.name === 'PasswordException' || error.message === featureMessage('en', 'pdf.messages.pdfPreview.thisPdfIsPasswordProtectedTryAgainWith')) return 'password';
    if (error.name === 'InvalidPDFException') return 'invalid-pdf';
  }
  return fallback;
}
export async function openComparisonPdf(file: File, signal: AbortSignal): Promise<OwnedPdf> {
  checkAbort(signal);
  let bytes: ArrayBuffer;
  try { bytes = await waitWithAbort(file.arrayBuffer(), signal); } catch (error) { checkAbort(signal); throw new PdfCompareError(errorCode(error)); }
  checkAbort(signal);
  // PDF.js performs parsing; do not apply pdf-lib's editing admission policy.
  if (!new TextDecoder('latin1').decode(bytes.slice(0, 1024)).includes('%PDF-')) throw new PdfCompareError('invalid-pdf');
  let owner: Awaited<ReturnType<typeof openOwnedPdfDocument>>;
  try { owner = await openOwnedPdfDocument(bytes, 'en', signal); } catch (error) { checkAbort(signal); throw new PdfCompareError(errorCode(error)); }
  let closing: Promise<void> | undefined;
  let rendering = false;
  const close = () => { signal.removeEventListener('abort', abort); return closing ??= owner.loadingTask.destroy(); };
  const abort = () => { if (!rendering) void close().catch(() => undefined); };
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) { await close(); checkAbort(signal); }
  return { document: owner.document, deferAbortUntilRenderSettles() { rendering = true; }, close };
}
export async function readPage(owner: OwnedPdf, index: number, signal: AbortSignal, selected = false) {
  checkAbort(signal);
  const page = await waitWithAbort(owner.document.getPage(index + 1), signal);
  try {
    checkAbort(signal);
    const content = await waitWithAbort(page.getTextContent(), signal);
    checkAbort(signal);
    const items = content.items.filter(item => 'str' in item);
    const text: PageText = textFromItems(items);
    const selectedItems: SelectedTextItem[] = selected ? items.map(item => ({ str: item.str, hasEOL: item.hasEOL, transform: [...item.transform], width: item.width, height: item.height, pageIndex: index })) : [];
    return { page, text, selectedItems };
  } catch (error) { page.cleanup(); throw error; }
}
export async function renderComparisonPage(page: PDFPageProxy, geometry: RenderGeometry, signal: AbortSignal) {
  checkAbort(signal);
  const canvas = document.createElement('canvas'); canvas.width = geometry.width; canvas.height = geometry.height;
  try {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new PdfCompareError('render-failed');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    const viewport = page.getViewport({ scale: (96 / 72) * geometry.scaleFactor });
    const task = page.render({ canvas, canvasContext: context, viewport, background: 'rgb(255,255,255)', annotationMode: 1 });
    await waitForPdfRender(task, page, { signal, cleanupOnCancel: false });
    checkAbort(signal);
    return canvas;
  } catch (error) { canvas.width = canvas.height = 0; throw error; }
}
export interface PixelReply { count: number; ratio: number; diff?: Uint8ClampedArray; segments: DiffSegment[] }
export function runPixelWorker(before: HTMLCanvasElement, after: HTMLCanvasElement, threshold: PixelThreshold, signal: AbortSignal, overlay = false, texts?: { before: string; after: string }): Promise<PixelReply> {
  checkAbort(signal);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./pdf-compare.worker.ts', import.meta.url), { type: 'module' });
    const finish = () => { signal.removeEventListener('abort', abort); worker.terminate(); };
    const abort = () => { finish(); reject(new DOMException('Aborted', 'AbortError')); };
    signal.addEventListener('abort', abort, { once: true });
    worker.onerror = () => { finish(); reject(new PdfCompareError('render-failed')); };
    worker.onmessage = (event: MessageEvent<PixelReply & { error?: string }>) => {
      finish();
      if (signal.aborted) reject(new DOMException('Aborted', 'AbortError'));
      else if (event.data.error) reject(new PdfCompareError('render-failed'));
      else resolve(event.data);
    };
    try {
      checkAbort(signal);
      const a = before.getContext('2d')!.getImageData(0, 0, before.width, before.height).data;
      const b = after.getContext('2d')!.getImageData(0, 0, after.width, after.height).data;
      worker.postMessage({ before: a, after: b, threshold, overlay, beforeText: texts?.before, afterText: texts?.after }, [a.buffer, b.buffer]);
    } catch (error) { finish(); reject(error); }
  });
}
