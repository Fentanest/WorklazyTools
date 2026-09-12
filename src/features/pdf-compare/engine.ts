import { checkAbort, indexMapping, pairedGeometry, pendingPage, PdfCompareError, validateMapping } from './kernel.ts';
import { errorCode, openComparisonPdf, readPage, renderComparisonPage, runPixelWorker } from './runtime.ts';
import type { OwnedPdf } from './runtime.ts';
import type { CompareProgress, ComparisonResult, PageComparison, PageMapping, PairComparison, PdfCompareInput, PixelThreshold, SelectedPreview } from './types.ts';
export interface CompareOptions { signal: AbortSignal; threshold?: PixelThreshold; runId?: number; onProgress?: (progress: CompareProgress) => void }
function closeCanvas(canvas?: HTMLCanvasElement | null) { if (canvas) canvas.width = canvas.height = 0; }
async function withPagePair(before: OwnedPdf, after: OwnedPdf, mapping: PageMapping, signal: AbortSignal, threshold: PixelThreshold, selected: boolean) {
  let a: Awaited<ReturnType<typeof readPage>> | undefined, b: Awaited<ReturnType<typeof readPage>> | undefined;
  let ac: HTMLCanvasElement | undefined, bc: HTMLCanvasElement | undefined, overlay: HTMLCanvasElement | null = null;
  let handedOff = false;
  try {
    if (mapping.before !== null) a = await readPage(before, mapping.before, signal, selected);
    checkAbort(signal);
    if (mapping.after !== null) b = await readPage(after, mapping.after, signal, selected);
    checkAbort(signal);
    const geometry = pairedGeometry(a?.page.getViewport({ scale: 96 / 72 }) ?? null, b?.page.getViewport({ scale: 96 / 72 }) ?? null);
    // During render, cancel + settle + page cleanup must precede owner destruction.
    before.deferAbortUntilRenderSettles(); after.deferAbortUntilRenderSettles();
    if (a) ac = await renderComparisonPage(a.page, geometry, signal);
    checkAbort(signal);
    if (b) bc = await renderComparisonPage(b.page, geometry, signal);
    checkAbort(signal);
    const page: PageComparison = { ...pendingPage(mapping, threshold), geometry, beforeText: a?.text.text ?? '', afterText: b?.text.text ?? '', beforeTextAvailable: a?.text.available ?? false, afterTextAvailable: b?.text.available ?? false };
    if (geometry.reducedResolution) page.warnings.push('reduced-resolution');
    if (ac && bc) {
      const texts = a!.text.available && b!.text.available ? { before: a!.text.text, after: b!.text.text } : undefined;
      const pixels = await runPixelWorker(ac, bc, threshold, signal, selected, texts);
      checkAbort(signal);
      page.pixelCount = pixels.count; page.pixelRatio = pixels.ratio;
      page.visualComparison = pixels.count ? 'different-pixels' : 'equal-pixels';
      if (texts) {
        page.segments = pixels.segments;
        page.textComparison = texts.before === texts.after ? 'equal-extracted-text' : 'different-extracted-text';
      }
      if (selected && pixels.diff) {
        overlay = document.createElement('canvas'); overlay.width = geometry.width; overlay.height = geometry.height;
        const context = overlay.getContext('2d'); if (!context) throw new PdfCompareError('render-failed');
        context.putImageData(new ImageData(pixels.diff as Uint8ClampedArray<ArrayBuffer>, geometry.width, geometry.height), 0, 0);
      }
    } else page.visualComparison = ac ? 'deleted' : 'added';
    checkAbort(signal); page.status = 'complete';
    const preview: SelectedPreview | undefined = selected ? {
      before: ac ?? null, after: bc ?? null, overlay, beforeItems: a?.selectedItems ?? [], afterItems: b?.selectedItems ?? [], geometry,
      release() { closeCanvas(this.before); closeCanvas(this.after); closeCanvas(this.overlay); this.before = this.after = this.overlay = null; this.beforeItems.length = this.afterItems.length = 0; },
    } : undefined;
    handedOff = selected;
    return { page, preview };
  } finally {
    a?.page.cleanup(); b?.page.cleanup();
    if (!handedOff) { closeCanvas(ac); closeCanvas(bc); closeCanvas(overlay); }
  }
}
export async function comparePdfPairs(inputs: readonly PdfCompareInput[], options: CompareOptions): Promise<ComparisonResult> {
  const { signal, onProgress } = options; const threshold = options.threshold ?? 16;
  if (![0, 16, 32].includes(threshold) || new Set(inputs.map(input => input.id)).size !== inputs.length) throw new PdfCompareError('invalid-mapping');
  const result: ComparisonResult = { runId: options.runId ?? 0, pairs: [], canceled: false };
  for (const [pairIndex, input] of inputs.entries()) {
    const pair: PairComparison = { id: input.id, beforeName: input.before.name, afterName: input.after.name, beforePageCount: 0, afterPageCount: 0, mappingSource: input.mapping ? 'manual' : 'page-number', status: 'complete', pages: [], partial: false };
    result.pairs.push(pair);
    let before: OwnedPdf | undefined, after: OwnedPdf | undefined;
    try {
      checkAbort(signal);
      before = await openComparisonPdf(input.before, signal); checkAbort(signal);
      after = await openComparisonPdf(input.after, signal); checkAbort(signal);
      pair.beforePageCount = before.document.numPages; pair.afterPageCount = after.document.numPages;
      const mapping = validateMapping(input.mapping ?? indexMapping(pair.beforePageCount, pair.afterPageCount), pair.beforePageCount, pair.afterPageCount);
      pair.pages = mapping.map(row => pendingPage(row, threshold));
      onProgress?.({ pairIndex, pairCount: inputs.length, completedPages: 0, totalPages: mapping.length });
      for (const [index, row] of mapping.entries()) {
        try {
          checkAbort(signal);
          const { page } = await withPagePair(before, after, row, signal, threshold, false);
          // Give queued abort/input events a chance before registering compact results.
          await new Promise<void>(resolve => setTimeout(resolve, 0)); checkAbort(signal);
          pair.pages[index] = page;
          onProgress?.({ pairIndex, pairCount: inputs.length, completedPages: index + 1, totalPages: mapping.length });
        } catch (error) {
          pair.pages[index].status = signal.aborted ? 'canceled' : 'unknown';
          if (!signal.aborted) pair.pages[index].error = errorCode(error, 'render-failed');
          throw error;
        }
      }
    } catch (error) {
      pair.status = signal.aborted ? 'canceled' : 'failed';
      if (!signal.aborted) pair.error = errorCode(error);
      pair.partial = pair.pages.some(page => page.status === 'complete');
      if (signal.aborted) result.canceled = true;
    } finally { await Promise.allSettled([before?.close(), after?.close()]); }
  }
  return result;
}
export async function loadSelectedPreview(input: PdfCompareInput, mapping: PageMapping, threshold: PixelThreshold, signal: AbortSignal): Promise<SelectedPreview> {
  let before: OwnedPdf | undefined, after: OwnedPdf | undefined;
  try {
    before = await openComparisonPdf(input.before, signal); checkAbort(signal);
    after = await openComparisonPdf(input.after, signal); checkAbort(signal);
    validateMapping([mapping], before.document.numPages, after.document.numPages);
    const { preview } = await withPagePair(before, after, mapping, signal, threshold, true);
    if (signal.aborted) { preview!.release(); checkAbort(signal); }
    return preview!;
  } finally { await Promise.allSettled([before?.close(), after?.close()]); }
}
