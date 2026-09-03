export interface ModuleWorkerProgress {
  progress: number;
  phase?: string;
  ruleId?: string;
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
    inactivityTimeoutMs?: number;
    timeoutMessage?: string;
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
    let lastRuleId: string | undefined;
    let inactivityTimer: ReturnType<typeof setTimeout> | undefined;
    const armInactivityTimer = () => {
      if (!options.inactivityTimeoutMs) return;
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        if (!finish()) return;
        const error = new Error(options.timeoutMessage ?? options.resultErrorMessage) as Error & { code?: string; ruleId?: string };
        error.code = "WORKER_TIMEOUT";
        error.ruleId = lastRuleId;
        reject(error);
      }, options.inactivityTimeoutMs);
    };
    const finish = () => {
      if (terminal) return false;
      terminal = true;
      if (inactivityTimer) clearTimeout(inactivityTimer);
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
    armInactivityTimer();
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as { type: "progress" | "rule-start" | "heartbeat" | "result" | "error"; progress?: number; phase?: string; ruleId?: string; result?: TResult; code?: string; details?: string[] };
      if (data.type === "progress" || data.type === "rule-start" || data.type === "heartbeat") {
        if (terminal) return;
        if (data.ruleId) lastRuleId = data.ruleId;
        armInactivityTimer();
        options.onProgress?.({ progress: data.progress ?? 0, phase: data.phase, ruleId: data.ruleId });
        return;
      }
      if (!finish()) return;
      if (data.type === "result") resolve(data.result as TResult);
      else {
        const error = new Error(options.resultErrorMessage) as Error & { code?: string; ruleId?: string; details?: string[] };
        error.code = data.code;
        error.ruleId = data.ruleId;
        error.details = data.details;
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
