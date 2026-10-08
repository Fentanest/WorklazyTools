type Format = "docx" | "xlsx";
export interface BentoPageProfile { pageIndex: number; rotation: number; width: number; height: number; imageCoverage: number; visibleCharacters: number; hiddenSpans: Array<{ text: string; bbox: [number, number, number, number]; type: number }>; visibleSpans: Array<{ text: string; bbox: [number, number, number, number]; type: number }> }
type Reply = { id: number; type: "progress"; value: number } | { id: number; type: "result"; blob: Blob; tableCount?: number; profiles?: BentoPageProfile[] } | { id: number; type: "error"; code: string };
let worker: Worker | undefined;
let current: { id: number; reject: (error: Error) => void; cleanup: () => void } | undefined;
let sequence = 0;
let queue = Promise.resolve();
let idleTimer: ReturnType<typeof setTimeout> | undefined;

export function releaseBentoPdfSession() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = undefined;
  worker?.terminate();
  worker = undefined;
  current?.reject(new Error("BENTO_SESSION_CLOSED"));
  current?.cleanup();
  current = undefined;
}

function getWorker() {
  worker ??= new Worker(new URL("./bentoPdf.worker.ts", import.meta.url), { type: "module" });
  return worker;
}

export function convertWithBentoPdf(pdf: Blob, format: Format, fileName: string, signal?: AbortSignal, onProgress?: (value: number) => void) {
  const job = queue.catch(() => undefined).then(() => run({ type: format, pdf, fileName }, signal, onProgress));
  queue = job.then(() => undefined, () => undefined);
  return job;
}

export function convertPageImagesWithBento(pages: Array<{ blob: Blob; width: number; height: number }>, signal?: AbortSignal, onProgress?: (value: number) => void) {
  const job = queue.catch(() => undefined).then(() => run({ type: "page-image-docx", pages }, signal, onProgress));
  queue = job.then(() => undefined, () => undefined);
  return job;
}

export function selectPagesWithBento(pdf: Blob, pages: number[], signal?: AbortSignal) {
  const job = queue.catch(() => undefined).then(() => run({ type: "select-pages", pdf, pages }, signal));
  queue = job.then(() => undefined, () => undefined);
  return job.then(result => result.blob);
}

export function profilePagesWithBento(pdf: Blob, pages: number[], signal?: AbortSignal) {
  const job = queue.catch(() => undefined).then(() => run({ type: "profile-pages", pdf, pages }, signal));
  queue = job.then(() => undefined, () => undefined);
  return job.then(result => result.profiles ?? []);
}

function run(request: { type: Format; pdf: Blob; fileName: string } | { type: "page-image-docx"; pages: Array<{ blob: Blob; width: number; height: number }> } | { type: "select-pages" | "profile-pages"; pdf: Blob; pages: number[] }, signal?: AbortSignal, onProgress?: (value: number) => void): Promise<{ blob: Blob; tableCount?: number; profiles?: BentoPageProfile[] }> {
  if (signal?.aborted) return Promise.reject(new DOMException("Conversion cancelled", "AbortError"));
  if (idleTimer) clearTimeout(idleTimer);
  const activeWorker = getWorker();
  const id = ++sequence;
  return new Promise<{ blob: Blob; tableCount?: number; profiles?: BentoPageProfile[] }>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      signal?.removeEventListener("abort", abort);
      clearTimeout(timeout);
      activeWorker.removeEventListener("message", message);
      activeWorker.removeEventListener("error", failure);
      if (current?.id === id) current = undefined;
    };
    const finish = (result: () => void) => { if (settled) return; settled = true; cleanup(); result(); };
    const abort = () => { activeWorker.terminate(); if (worker === activeWorker) worker = undefined; finish(() => reject(new DOMException("Conversion cancelled", "AbortError"))); };
    const failure = () => { activeWorker.terminate(); if (worker === activeWorker) worker = undefined; finish(() => reject(new Error("BENTO_WORKER_FAILED"))); };
    const message = (event: MessageEvent<Reply>) => {
      const reply = event.data;
      if (reply?.id !== id) return;
      if (reply.type === "progress") { onProgress?.(reply.value); return; }
      if (reply.type === "error") finish(() => reject(new Error(reply.code)));
      else finish(() => resolve({ blob: reply.blob, tableCount: reply.tableCount, profiles: reply.profiles }));
    };
    const timeout = setTimeout(() => { activeWorker.terminate(); if (worker === activeWorker) worker = undefined; finish(() => reject(new Error("CONVERSION_TIMEOUT"))); }, 10 * 60_000);
    current = { id, reject, cleanup };
    signal?.addEventListener("abort", abort, { once: true });
    activeWorker.addEventListener("message", message);
    activeWorker.addEventListener("error", failure);
    activeWorker.postMessage({ id, ...request });
  }).finally(() => {
    if (worker === activeWorker) idleTimer = setTimeout(releaseBentoPdfSession, 60_000);
  });
}
