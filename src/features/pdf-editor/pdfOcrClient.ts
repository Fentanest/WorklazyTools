import type { RecognizeResult } from "tesseract.js";

type Language = "kor" | "eng" | "kor+eng";
type Reply = { id: number; type: "progress"; status: string; value: number } | { id: number; type: "result"; data: RecognizeResult["data"] } | { id: number; type: "error"; code: string } | { id: number; type: "disposed" };
let worker: Worker | undefined;
let sequence = 0;
let queue = Promise.resolve();
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let current: { cancel: () => Promise<void> } | undefined;
const disposals = new WeakMap<Worker, Promise<void>>();

/** BentoPDF tesseract-runtime.ts asset configuration, hosted by a terminable
 * parent Worker so a loading or recognizing OCR job can be stopped immediately. */
export function releasePdfOcrSession(): Promise<void> {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = undefined;
  if (current) return current.cancel();
  return worker ? disposeWorker(worker) : Promise.resolve();
}

function disposeWorker(active: Worker): Promise<void> {
  const pending = disposals.get(active);
  if (pending) return pending;
  if (worker === active) worker = undefined;
  const id = ++sequence;
  const disposal = new Promise<void>(resolve => {
    let closed = false;
    const done = () => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      active.removeEventListener("message", receive);
      active.terminate();
      resolve();
    };
    const receive = (event: MessageEvent<Reply>) => { if (event.data?.type === "disposed" && event.data.id === id) done(); };
    const timer = setTimeout(done, 2_000);
    active.addEventListener("message", receive);
    try { active.postMessage({ id, type: "dispose" }); } catch { done(); }
  });
  disposals.set(active, disposal);
  return disposal;
}

export function recognizePdfPage(image: Blob, language: Language, layout: "sparse" | "paragraphs", searchablePdf: boolean, signal?: AbortSignal, onProgress?: (status: string, value: number) => void) {
  const previous = queue;
  let release!: () => void;
  queue = new Promise<void>(resolve => { release = resolve; });
  const job = waitTurn(previous, signal).then(() => run(image, language, layout, searchablePdf, signal, onProgress));
  void previous.then(() => { void job.then(release, release); });
  return job;
}

function waitTurn(previous: Promise<void>, signal?: AbortSignal) {
  if (!signal) return previous;
  if (signal.aborted) return Promise.reject(new DOMException("OCR cancelled", "AbortError"));
  return new Promise<void>((resolve, reject) => {
    const abort = () => { signal.removeEventListener("abort", abort); reject(new DOMException("OCR cancelled", "AbortError")); };
    signal.addEventListener("abort", abort, { once: true });
    void previous.then(() => { signal.removeEventListener("abort", abort); resolve(); });
  });
}

function run(image: Blob, language: Language, layout: "sparse" | "paragraphs", searchablePdf: boolean, signal?: AbortSignal, onProgress?: (status: string, value: number) => void): Promise<RecognizeResult["data"]> {
  if (signal?.aborted) return Promise.reject(new DOMException("OCR cancelled", "AbortError"));
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = undefined;
  const active = worker ??= new Worker(new URL("./pdfOcr.worker.ts", import.meta.url), { type: "module" });
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => { signal?.removeEventListener("abort", abort); clearTimeout(timeout); active.removeEventListener("message", message); active.removeEventListener("error", failure); if (current?.cancel === abort) current = undefined; };
    const finish = (action: () => void, discard = false): Promise<void> => {
      if (settled) return Promise.resolve();
      settled = true; cleanup();
      if (discard) return disposeWorker(active).then(action);
      if (worker === active) idleTimer = setTimeout(() => { void releasePdfOcrSession(); }, 60_000);
      action(); return Promise.resolve();
    };
    const abort = () => finish(() => reject(new DOMException("OCR cancelled", "AbortError")), true);
    const failure = () => finish(() => reject(new Error("OCR_RUNTIME_UNAVAILABLE")), true);
    const message = (event: MessageEvent<Reply>) => {
      const reply = event.data;
      if (reply?.id !== id) return;
      if (reply.type === "progress") { onProgress?.(reply.status, reply.value); return; }
      if (reply.type === "disposed") return;
      if (reply.type === "error") finish(() => reject(new Error(reply.code)), true);
      else finish(() => resolve(reply.data));
    };
    const timeout = setTimeout(() => finish(() => reject(new Error("OCR_TIMEOUT")), true), 5 * 60_000);
    current = { cancel: abort };
    signal?.addEventListener("abort", abort, { once: true });
    active.addEventListener("message", message);
    active.addEventListener("error", failure);
    active.postMessage({ id, type: "recognize", image, language, layout, searchablePdf });
  });
}
