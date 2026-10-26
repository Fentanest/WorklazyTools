const retryPrefix = "worklazy_tool_reload:";

declare global {
  interface Window {
    worklazyDocumentRecovery?: { reloadForChunk: (prepare?: () => Promise<boolean>) => Promise<boolean>; confirmToolReady: () => void };
  }
}

// Vite and React receive the same rejection. Only that failure may share a
// pending navigation; another error or route must still consult its budget.
let pending: { key: string; error: unknown; result: boolean | Promise<boolean> } | undefined;
let failedPreload: string | undefined;
let resolvePreloadFailure: ((href: string) => void) | undefined;

export function isChunkLoadError(error: unknown) {
  const message = error && typeof error === "object" && "message" in error ? error.message : error;
  return typeof message === "string" && /^(Failed to fetch dynamically imported module:|Importing a module script failed\.?$|error loading dynamically imported module:|Unable to preload CSS for )/i.test(message);
}

export function chunkRetryKey(location: Pick<Location, "pathname" | "search">) {
  // Directory redirects must not create another retry budget. The target route
  // and current document URL (including search) distinguish independent tools.
  const target = location.pathname.replace(/\/+$/, "") || "/";
  return `${retryPrefix}${JSON.stringify([target, `${target}${location.search}`])}`;
}

export function installChunkRecovery() {
  window.addEventListener("error", (event) => {
    const link = event.target as HTMLLinkElement | null;
    if (link?.tagName === "LINK" && link.rel === "modulepreload") {
      failedPreload = link.href;
      resolvePreloadFailure?.(link.href);
      resolvePreloadFailure = undefined;
    }
  }, true);
  window.addEventListener("vite:preloadError", (event) => {
    // Keep the rejection available to React so exhausted retries show its
    // boundary. preventDefault would turn Vite's rejected import into success.
    recoverChunkError((event as Event & { payload: unknown }).payload, true);
  });
}

export function recoverChunkError(error: unknown, preloadError = false): boolean | Promise<boolean> {
  const key = chunkRetryKey(window.location);
  if (pending?.key === key) return pending.error === error ? pending.result : false;
  if (!preloadError && !isChunkLoadError(error)) return false;
  // COI preparation remains the only reload owner on these documents.
  // Redactor has CSP isolation only, so it uses ordinary chunk recovery.
  if (document.querySelector('meta[name="worklazy-video-isolation"]')) return false;
  // WebKit bug 270357: reload reuses a failed modulepreload in MemoryCache.
  // A reload-mode fetch replaces that entry. Its failure is the terminal second
  // attempt; do not reload past it. Other engines keep their existing path.
  const message = error instanceof Error ? error.message : (error as { message?: string })?.message;
  const prepare = /^Importing a module script failed\.?$/.test(message || "")
    && (failedPreload || (preloadError && document.querySelector('link[rel="modulepreload"]')))
    ? async () => {
      // WebKit rejects import() before dispatching the preload link's error.
      // Wait for that event itself; a timer can race it on a busy document.
      const preload = failedPreload || await new Promise<string>((resolve) => { resolvePreloadFailure = resolve; });
      if (chunkRetryKey(window.location) !== key) return false;
      return fetch(preload, { cache: "reload" })
        .then((response) => response.ok && chunkRetryKey(window.location) === key, () => false);
    }
    : undefined;
  let result: boolean | Promise<boolean>;
  if (document.querySelector('meta[name="worklazy-office-isolation"], meta[name="worklazy-excel-preserve-isolation"]')) {
    if (!window.worklazyDocumentRecovery) return false;
    result = window.worklazyDocumentRecovery.reloadForChunk(prepare).catch(() => false);
  } else {
    try {
      if (sessionStorage.getItem(key)) return false;
      sessionStorage.setItem(key, "pending");
    } catch {
      // Without durable storage a reload could loop. Let React show its boundary.
      return false;
    }
    const reload = () => { window.location.reload(); return true; };
    result = prepare ? prepare().then((ready) => ready && reload()) : reload();
  }
  pending = { key, error, result };
  return result;
}

export function confirmToolReady() {
  failedPreload = undefined;
  const key = chunkRetryKey(window.location);
  if (pending?.key === key) pending = undefined;
  try { sessionStorage.removeItem(key); } catch { /* Recovery remains manual. */ }
  window.worklazyDocumentRecovery?.confirmToolReady();
}
