const retryPrefix = "worklazy_tool_reload:";

export function chunkRetryKey(location: Pick<Location, "pathname" | "search">) {
  // Directory redirects must not create another retry budget. The target route
  // and current document URL (including search) distinguish independent tools.
  const target = location.pathname.replace(/\/+$/, "") || "/";
  return `${retryPrefix}${JSON.stringify([target, `${target}${location.search}`])}`;
}

export function installChunkRecovery() {
  window.addEventListener("vite:preloadError", () => {
    // Document preparation owns reloads on these pages, including video COI.
    if (document.querySelector('meta[name="worklazy-office-isolation"], meta[name="worklazy-excel-preserve-isolation"], meta[name="worklazy-video-isolation"]')) return;
    try {
      const key = chunkRetryKey(window.location);
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "pending");
    } catch {
      // Without durable storage a reload could loop. Let React show its boundary.
      return;
    }
    // Do not preventDefault: if navigation is delayed/denied the error still
    // reaches the route boundary, and subsequent failures remain visible there.
    window.location.reload();
  });
}

export function confirmToolReady() {
  try { sessionStorage.removeItem(chunkRetryKey(window.location)); } catch { /* Recovery remains manual. */ }
}
