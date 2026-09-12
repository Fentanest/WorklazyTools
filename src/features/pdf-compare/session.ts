import { comparePdfPairs, loadSelectedPreview } from './engine.ts';
import { checkAbort } from './kernel.ts';
import type { CompareProgress, ComparisonResult, PageMapping, PdfCompareInput, PixelThreshold, SelectedPreview } from './types.ts';
/** One UI owner. New run/input invalidates prior output immediately; cancellation preserves completed pages. */
export class PdfCompareSession {
  private generation = 0;
  private controller?: AbortController;
  private previewController?: AbortController;
  private preview?: SelectedPreview;
  private tail: Promise<unknown> = Promise.resolve();
  private previewTail: Promise<unknown> = Promise.resolve();
  private disposed = false;
  result: ComparisonResult | null = null;
  invalidate() {
    this.generation++; this.controller?.abort(); this.clearPreview(); this.result = null;
  }
  cancel() { this.controller?.abort(); this.clearPreview(); }
  clearPreview() { this.previewController?.abort(); this.preview?.release(); this.preview = undefined; }
  async run(inputs: readonly PdfCompareInput[], threshold: PixelThreshold = 16, onProgress?: (progress: CompareProgress) => void) {
    if (this.disposed) throw new DOMException('Disposed', 'AbortError');
    this.invalidate(); const generation = this.generation;
    const controller = this.controller = new AbortController();
    const snapshot = inputs.map(input => ({ ...input, mapping: input.mapping?.map(row => ({ ...row })) }));
    const previous = this.tail; const priorPreview = this.previewTail;
    const task = (async () => {
      await Promise.allSettled([previous, priorPreview]);
      const result = await comparePdfPairs(snapshot, { threshold, signal: controller.signal, runId: generation, onProgress: progress => {
        if (!controller.signal.aborted && this.generation === generation && !this.disposed) onProgress?.(progress);
      } });
      if (this.generation !== generation || this.disposed) return null;
      this.result = result; return result;
    })();
    this.tail = task; return task;
  }
  async select(input: PdfCompareInput, mapping: PageMapping, threshold: PixelThreshold = 16) {
    if (this.disposed) throw new DOMException('Disposed', 'AbortError');
    this.clearPreview(); const controller = this.previewController = new AbortController();
    const previous = this.previewTail; const run = this.tail;
    const task = (async () => {
      await Promise.allSettled([previous, run]); checkAbort(controller.signal);
      const preview = await loadSelectedPreview(input, { ...mapping }, threshold, controller.signal);
      if (controller.signal.aborted || this.disposed) { preview.release(); checkAbort(controller.signal); throw new DOMException('Disposed', 'AbortError'); }
      this.preview = preview; return preview;
    })();
    this.previewTail = task; return task;
  }
  async dispose() { this.disposed = true; this.invalidate(); await Promise.allSettled([this.tail, this.previewTail]); }
}
