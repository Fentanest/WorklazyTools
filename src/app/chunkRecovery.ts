const retryPrefix = "worklazy_tool_reload:";

declare global {
  interface Window {
    worklazyDocumentRecovery?: { reloadForChunk: () => Promise<boolean>; confirmToolReady: () => void };
  }
}

// Vite and React receive the same rejection. Only that failure may share a
// pending navigation; another error or route must still consult its budget.
let pending: { key: string; error: unknown; result: boolean | Promise<boolean> } | undefined;

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
  let result: boolean | Promise<boolean>;
  if (document.querySelector('meta[name="worklazy-office-isolation"], meta[name="worklazy-excel-preserve-isolation"]')) {
    if (!window.worklazyDocumentRecovery) return false;
    result = window.worklazyDocumentRecovery.reloadForChunk().catch(() => false);
  } else {
    try {
      if (sessionStorage.getItem(key)) return false;
      sessionStorage.setItem(key, "pending");
    } catch {
      // Without durable storage a reload could loop. Let React show its boundary.
      return false;
    }
    window.location.reload();
    result = true;
  }
  pending = { key, error, result };
  return result;
}

export function confirmToolReady() {
  const key = chunkRetryKey(window.location);
  if (pending?.key === key) pending = undefined;
  try { sessionStorage.removeItem(key); } catch { /* Recovery remains manual. */ }
  window.worklazyDocumentRecovery?.confirmToolReady();
}
