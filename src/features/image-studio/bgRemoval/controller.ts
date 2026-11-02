import { acquireAssets, assetsFor, CACHE_NAME, manifest, prepareAssets, type BgMode } from './assets.ts';
import { BgRemovalError, cancelled, normalizeError, messages } from './errors.ts';
import type { Diagnostic, WorkerRequest, WorkerResponse } from './protocol.ts';
export interface ConsentInfo { mode: BgMode; label: string; downloadBytes: number; programFilesNote: string }
export interface RemovalOptions { mode?: BgMode; signal?: AbortSignal; progress?: (key: string, current: number, total: number) => void }
export interface ControllerOptions {
  baseUrl?: string;
  language?: 'ko' | 'en';
  confirm: (info: ConsentInfo) => boolean | Promise<boolean>;
  notice?: (message: string) => void;
  diagnostic?: (event: Diagnostic) => void;
  /** Explicit test probes; they never change the production asset expectations. */
  auditRuntime?: boolean;
  cacheStorage?: CacheStorage | null;
  fetcher?: typeof fetch;
  workerFactory?: () => Worker;
  productSupported?: () => Promise<boolean>;
}
export async function productSupported(): Promise<boolean> {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ features: { has(name: string): boolean } } | null> } }).gpu;
    return !!(await gpu?.requestAdapter())?.features.has('shader-f16');
  } catch { return false; }
}
export class BackgroundRemovalController {
  private generation = 0;
  private active?: AbortController;
  private worker?: Worker;
  private readonly options: ControllerOptions;
  constructor(options: ControllerOptions) { this.options = options; }
  async defaultMode(): Promise<BgMode> { return await (this.options.productSupported ?? productSupported)() ? 'product' : 'person'; }
  cancel(): void { this.generation++; this.active?.abort(); this.worker?.terminate(); this.worker = undefined; }
  onImageReplaced(): void { this.cancel(); }
  dispose(): void { this.cancel(); }
  async clearStoredModels(): Promise<boolean> {
    this.cancel();
    try { const storage = this.storage(); if (!storage) { this.notice(); return false; } await storage.delete(CACHE_NAME); return true; }
    catch { this.notice(); return false; }
  }
  private storage(): CacheStorage | null {
    return this.options.cacheStorage === undefined ? (typeof caches === 'undefined' ? null : caches) : this.options.cacheStorage;
  }
  private notice(): void { this.options.notice?.(messages[this.options.language ?? 'ko']['cache-unavailable']); }
  async removeBackground(input: Blob | string, settings: RemovalOptions = {}): Promise<Blob> {
    this.cancel(); const runId = ++this.generation;
    const abort = new AbortController(); this.active = abort;
    const parentAbort = () => abort.abort(); settings.signal?.addEventListener('abort', parentAbort, { once: true });
    if (settings.signal?.aborted) abort.abort();
    const ensureCurrent = () => { cancelled(abort.signal); if (runId !== this.generation) throw new BgRemovalError('ai-cancelled'); };
    let worker: Worker | undefined;
    try {
      ensureCurrent();
      let blob = input;
      if (typeof input === 'string') {
        if (!/^(data:|blob:)/i.test(input)) throw new BgRemovalError('bg-unsupported');
        try { blob = await (await fetch(input, { signal: abort.signal })).blob(); }
        catch (error) { cancelled(abort.signal); throw new BgRemovalError('bg-unsupported'); }
      }
      ensureCurrent();
      const mode = settings.mode ?? await this.defaultMode(); ensureCurrent();
      if (mode === 'product' && !(await (this.options.productSupported ?? productSupported)())) throw new BgRemovalError('bg-unsupported');
      const baseUrl = this.options.baseUrl ?? new URL(import.meta.env.BASE_URL, location.href).href;
      const plan = await prepareAssets(assetsFor(mode, baseUrl), this.storage(), abort.signal); ensureCurrent();
      const language = this.options.language ?? 'ko';
      const info: ConsentInfo = { mode, label: manifest.models.find(item => item.id === mode)!.name[language], downloadBytes: plan.missingBytes, programFilesNote: manifest.programFilesNotice[language] };
      this.options.diagnostic?.({ type: 'plan', runId, mode, downloadBytes: info.downloadBytes, cached: [...plan.cached.keys()] });
      if (info.downloadBytes > 0 && !(await withAbort(Promise.resolve(this.options.confirm(info)), abort.signal))) throw new BgRemovalError('ai-cancelled');
      ensureCurrent();
      const verified = await acquireAssets(plan, abort.signal, (id, current, total) => settings.progress?.(`fetch:${id}`, current, total), () => this.notice(), this.options.fetcher);
      ensureCurrent();
      worker = this.options.workerFactory?.() ?? new Worker(new URL('./bgRemoval.worker.ts', import.meta.url), { type: 'module' });
      this.worker = worker;
      this.options.diagnostic?.({ type: 'worker-created', runId });
      const result = await new Promise<Blob>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new BgRemovalError('bg-inference-failed')), 180_000);
        const stop = () => { clearTimeout(timeout); reject(new BgRemovalError('ai-cancelled')); };
        abort.signal.addEventListener('abort', stop, { once: true });
        worker!.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
          if (data.runId !== runId || this.generation !== runId || abort.signal.aborted) return;
          if (data.type === 'progress') settings.progress?.(data.stage, data.current, data.total);
          else if (data.type === 'audit') this.options.diagnostic?.({ ...data.data, runId });
          else { clearTimeout(timeout); abort.signal.removeEventListener('abort', stop); if (data.type === 'result') resolve(data.blob); else reject(new BgRemovalError(data.code)); }
        };
        worker!.onerror = () => { clearTimeout(timeout); abort.signal.removeEventListener('abort', stop); reject(new BgRemovalError('bg-inference-failed')); };
        const request: WorkerRequest = { runId, input: blob as Blob, mode, assets: verified, auditRuntime: this.options.auditRuntime };
        worker!.postMessage(request, verified.map(item => item.buffer));
      });
      ensureCurrent(); return result;
    } catch (error) { throw normalizeError(error); }
    finally {
      settings.signal?.removeEventListener('abort', parentAbort); worker?.terminate();
      if (this.generation === runId) { this.worker = undefined; this.active = undefined; }
    }
  }
}
/** Fork-compatible backgroundRemovalLoader adapter; no editor replacement or eager model load. */
export function createBackgroundRemovalLoader(controller: BackgroundRemovalController, mode: () => BgMode) {
  return async () => ({ removeBackground: (blob: Blob | string, options?: { progress?: RemovalOptions['progress'] }) => controller.removeBackground(blob, { mode: mode(), progress: options?.progress }) });
}
export function requestDownloadConsent(info: ConsentInfo): boolean {
  return window.confirm(`${info.label}\n${info.downloadBytes.toLocaleString()} bytes\n${info.programFilesNote}`);
}

function withAbort<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = () => reject(new BgRemovalError('ai-cancelled'));
    signal.addEventListener('abort', stop, { once: true });
    if (signal.aborted) stop();
    pending.then(value => { signal.removeEventListener('abort', stop); resolve(value); }, error => { signal.removeEventListener('abort', stop); reject(error); });
  });
}
