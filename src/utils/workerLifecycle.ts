export interface ModuleWorkerProgress {
  progress: number;
  phase?: string;
}

export function runModuleWorker<TRequest, TResult>(
  createWorker: () => Worker,
  request: TRequest,
  options: {
    transfer?: Transferable[];
    signal?: AbortSignal;
    onProgress?: (progress: ModuleWorkerProgress) => void;
    canceledMessage: string;
    startErrorMessage: string;
    resultErrorMessage: string;
  },
) {
  return new Promise<TResult>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = createWorker();
    } catch {
      reject(new Error(options.startErrorMessage));
      return;
    }
    let terminal = false;
    const finish = () => {
      if (terminal) return false;
      terminal = true;
      options.signal?.removeEventListener("abort", abort);
      worker.terminate();
      return true;
    };
    const abort = () => {
      if (!finish()) return;
      reject(new DOMException(options.canceledMessage, "AbortError"));
    };
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) { abort(); return; }
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as { type: "progress" | "result" | "error"; progress?: number; phase?: string; result?: TResult; code?: string };
      if (data.type === "progress") {
        if (!terminal) options.onProgress?.({ progress: data.progress ?? 0, phase: data.phase });
        return;
      }
      if (!finish()) return;
      if (data.type === "result") resolve(data.result as TResult);
      else {
        const error = new Error(options.resultErrorMessage) as Error & { code?: string };
        error.code = data.code;
        reject(error);
      }
    };
    worker.onerror = (event) => {
      if (!finish()) return;
      event.preventDefault();
      reject(new Error(options.startErrorMessage));
    };
    try {
      worker.postMessage(request, options.transfer ?? []);
    } catch {
      if (finish()) reject(new Error(options.startErrorMessage));
    }
  });
}
