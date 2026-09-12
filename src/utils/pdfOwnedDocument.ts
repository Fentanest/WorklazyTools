import type { PDFDocumentLoadingTask } from "pdfjs-dist";
import { throwIfAborted } from "./cooperativeCancel.ts";
export function waitWithAbort<T>(promise: Promise<T>, signal?: AbortSignal, canceledMessage = "PDF loading cancelled") {
  throwIfAborted(signal, canceledMessage);
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new DOMException(canceledMessage, "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (reason) => {
        signal.removeEventListener("abort", abort);
        reject(reason);
      },
    );
  });
}

export async function settleOwnedPdfLoad(loadingTask: PDFDocumentLoadingTask, signal?: AbortSignal) {
  try {
    const document = await waitWithAbort(loadingTask.promise, signal, "PDF loading cancelled");
    throwIfAborted(signal, "PDF loading cancelled");
    return { document, loadingTask };
  } catch (error) {
    try { await loadingTask.destroy(); } catch { /* A failed owned load has no reusable resources. */ }
    throw error;
  }
}
