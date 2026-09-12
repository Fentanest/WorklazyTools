import { GeneratorError, checkAbort } from './errors.ts';
import type { GeneratorWorkerRequest, GeneratorWorkerResponse } from './workerProtocol.ts';

export interface GeneratorWorkerBridge {
  request(request: Omit<Extract<GeneratorWorkerRequest, {type: 'inspect'}>, 'id'>
    | Omit<Extract<GeneratorWorkerRequest, {type: 'parse'}>, 'id'>
    | Omit<Extract<GeneratorWorkerRequest, {type: 'render'}>, 'id'>, signal?: AbortSignal): Promise<GeneratorWorkerResponse>;
  terminate(): void;
}
export function createGeneratorWorkerBridge(factory = () => new Worker(new URL('./generator.worker.ts', import.meta.url), {type: 'module'})): GeneratorWorkerBridge {
  let worker: Worker | undefined;
  let sequence = 0;
  let pending: { reject(error: unknown): void; cleanup(): void } | undefined;
  function terminate() {
    worker?.terminate(); worker = undefined;
    const active = pending; pending = undefined;
    active?.cleanup(); active?.reject(new GeneratorError('CANCELED'));
  }
  return {
    terminate,
    async request(request, signal) {
      checkAbort(signal);
      if (pending) throw new GeneratorError('BUSY');
      worker ??= factory();
      const current = worker;
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        const cleanup = () => { signal?.removeEventListener('abort', terminate); current.removeEventListener('message', onMessage); current.removeEventListener('error', onError); };
        const finish = () => { if (pending?.cleanup !== cleanup) return false; pending = undefined; cleanup(); return true; };
        const onMessage = ({data}: MessageEvent<GeneratorWorkerResponse>) => {
          if (data.id !== id || data.type === 'progress' || !finish()) return;
          if (data.type === 'error') reject(new GeneratorError(data.code));
          else if (data.type !== request.type) reject(new GeneratorError('GENERATION_FAILED'));
          else resolve(data);
        };
        const onError = (event: ErrorEvent) => { event.preventDefault(); if (finish()) reject(new GeneratorError('GENERATION_FAILED')); current.terminate(); if (worker === current) worker = undefined; };
        pending = {reject, cleanup};
        current.addEventListener('message', onMessage);
        current.addEventListener('error', onError);
        signal?.addEventListener('abort', terminate, {once: true});
        if (signal?.aborted) { terminate(); return; }
        try { current.postMessage({...request, id}, [request.buffer]); }
        catch { if (finish()) reject(new GeneratorError('GENERATION_FAILED')); }
      });
    },
  };
}
