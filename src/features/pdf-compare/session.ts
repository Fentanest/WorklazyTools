import { comparePdfPairs, loadSelectedPreview } from './engine.ts';
import { checkAbort } from './kernel.ts';
import type { CompareProgress, ComparisonResult, PageMapping, PdfCompareInput, PixelThreshold, SelectedPreview } from './types.ts';
import { suggestPdfPages } from './candidateRuntime.ts';
/** One UI owner. New run/input invalidates prior output immediately; cancellation preserves completed pages. */
export class PdfCompareSession {
  private generation = 0;
  private controller?: AbortController;
  private previewController?: AbortController;
  private preview?: SelectedPreview;
  private tail: Promise<unknown> = Promise.resolve();
  private previewTail: Promise<unknown> = Promise.resolve();
  private candidateTail: Promise<unknown> = Promise.resolve();
  private candidateController?: AbortController;
  private auxiliaryTail: Promise<unknown> = Promise.resolve();
  private auxiliaryController?: AbortController;
  private resourceTail: Promise<unknown> = Promise.resolve();
  private previewResources = new Set<() => void>();
  private disposed = false;
  result: ComparisonResult | null = null;
  invalidate() {
    this.generation++; this.controller?.abort(); this.candidateController?.abort(); this.clearPreview(); this.result = null;
  }
  cancel() { this.controller?.abort(); this.candidateController?.abort(); this.clearPreview(); }
  clearPreview() {
    this.previewController?.abort(); this.auxiliaryController?.abort();
    this.preview?.release(); this.preview = undefined;
    for (const release of [...this.previewResources]) release();
  }
  /** Parent-owned OCR/provider work must settle before another PDF is opened/rendered. */
  async runAuxiliary<T>(work: (signal: AbortSignal) => Promise<T>, callerSignal: AbortSignal): Promise<T> {
    if (this.disposed || callerSignal.aborted) throw new DOMException('Canceled', 'AbortError');
    this.auxiliaryController?.abort();
    const controller = this.auxiliaryController = new AbortController(), generation = this.generation;
    const abort = () => controller.abort(); callerSignal.addEventListener('abort', abort, { once: true });
    const previous = [this.tail, this.previewTail, this.candidateTail, this.auxiliaryTail, this.resourceTail];
    const task = (async () => {
      try {
        await Promise.allSettled(previous); checkAbort(controller.signal);
        if (this.disposed || generation !== this.generation) throw new DOMException('Canceled', 'AbortError');
        const value = await work(controller.signal); checkAbort(controller.signal); return value;
      } finally { callerSignal.removeEventListener('abort', abort); }
    })();
    this.auxiliaryTail = task; return task;
  }
  /** Release caller-owned OCR buffers only after the active provider has disposed its copies. */
  ownPreviewResource(preview: SelectedPreview, dispose: () => void) {
    if (this.preview !== preview || this.disposed) { dispose(); throw new DOMException('Stale preview', 'AbortError'); }
    let released = false;
    const release = () => {
      if (released) return; released = true; this.previewResources.delete(release);
      this.resourceTail = Promise.allSettled([this.resourceTail, this.auxiliaryTail]).then(() => { dispose(); });
    };
    this.previewResources.add(release); return release;
  }
  async run(inputs: readonly PdfCompareInput[], threshold: PixelThreshold = 16, onProgress?: (progress: CompareProgress) => void) {
    if (this.disposed) throw new DOMException('Disposed', 'AbortError');
    this.invalidate(); const generation = this.generation;
    const controller = this.controller = new AbortController();
    const snapshot = inputs.map(input => ({ ...input, mapping: input.mapping?.map(row => ({ ...row })) }));
    const previous = this.tail; const priorPreview = this.previewTail; const priorCandidate=this.candidateTail; const auxiliary=this.auxiliaryTail,resources=this.resourceTail;
    const task = (async () => {
      await Promise.allSettled([previous, priorPreview, priorCandidate, auxiliary, resources]);
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
    this.clearPreview(); this.candidateController?.abort(); const controller = this.previewController = new AbortController();
    const previous = this.previewTail; const run = this.tail; const candidates=this.candidateTail; const auxiliary=this.auxiliaryTail,resources=this.resourceTail;
    const task = (async () => {
      await Promise.allSettled([previous, run, candidates, auxiliary, resources]); checkAbort(controller.signal);
      const preview = await loadSelectedPreview(input, { ...mapping }, threshold, controller.signal);
      if (controller.signal.aborted || this.disposed) { preview.release(); checkAbort(controller.signal); throw new DOMException('Disposed', 'AbortError'); }
      this.preview = preview; return preview;
    })();
    this.previewTail = task; return task;
  }
  async suggest(input:PdfCompareInput,onProgress?:(done:number,total:number)=>void){
    if(this.disposed)throw new DOMException('Disposed','AbortError');
    // Suggestions do not change the applied mapping or discard a completed report.
    this.generation++;this.controller?.abort();this.candidateController?.abort();this.clearPreview();
    const generation=this.generation,controller=this.candidateController=new AbortController();
    const previous=[this.tail,this.previewTail,this.candidateTail,this.auxiliaryTail,this.resourceTail];
    const task=(async()=>{
      await Promise.allSettled(previous);checkAbort(controller.signal);
      const result=await suggestPdfPages(input.before,input.after,controller.signal,(done,total)=>{if(!controller.signal.aborted&&generation===this.generation)onProgress?.(done,total);});
      checkAbort(controller.signal);return !this.disposed&&generation===this.generation?result:null;
    })();
    this.candidateTail=task;return task;
  }
  async dispose() { this.disposed = true; this.invalidate(); await Promise.allSettled([this.tail, this.previewTail,this.candidateTail,this.auxiliaryTail,this.resourceTail]); }
}
