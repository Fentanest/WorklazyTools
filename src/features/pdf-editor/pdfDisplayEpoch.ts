/**
 * pdfjs display-module epoch + worker-failure classification (G3-1/G3-2).
 *
 * Dependency-free on purpose: unit tests exercise these real functions in
 * plain node (no Vite `?url` imports, no DOM, no pdfjs).
 */

/** Hard cap on fresh pdfjs module instances per document (F4/G3-2). */
export const MAX_PDF_DISPLAY_EPOCHS = 8;

export interface DisplayEpochCounter {
  peek(): number;
  reset(): boolean;
  url(baseUrl: string): string;
}

/**
 * Monotonic epoch source. Each reset mints a new module URL so a poisoned
 * pdfjs runtime (cached fake-worker failure) is replaced instead of reused.
 * Old instances are dereferenced; the browser module map retains one entry
 * per minted URL, which is what the cap bounds.
 */
export function createDisplayEpochCounter(limit: number = MAX_PDF_DISPLAY_EPOCHS): DisplayEpochCounter {
  let epoch = 0;
  return {
    peek: () => epoch,
    reset: () => {
      if (epoch >= limit) return false;
      epoch += 1;
      return true;
    },
    url: (baseUrl: string) => {
      if (epoch === 0) return baseUrl;
      const separator = baseUrl.includes("?") ? "&" : "?";
      return `${baseUrl}${separator}w1-pdfjs=${epoch}`;
    },
  };
}

/** Process-wide counter backing the pdfjs display module (one per document). */
export const pdfDisplayEpoch = createDisplayEpochCounter();

/**
 * True when a PDF load failure means the shared pdfjs runtime itself cannot
 * run (worker/module unloadable) rather than the content being bad
 * (corrupt/encrypted file). Only the former can poison the module, so only
 * the former justifies spending a fresh epoch on retry (G3-2): content
 * failures must never accumulate module instances.
 */
export function isWorkerSetupFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ((error as { code?: unknown }).code === "pdf-display-load") return true;
  const message = error instanceof Error ? error.message : "";
  return /setting up fake worker failed|failed to fetch dynamically imported module/i.test(message);
}
