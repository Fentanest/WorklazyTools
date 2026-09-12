import { isRedactorDocument, isRedactorPath } from "../app/redactorIsolation";
export function registerServiceWorker() {
  if (isRedactorDocument() || isRedactorPath(location.pathname)) return;
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
    const scriptUrl = new URL("service-worker.js", baseUrl);
    void navigator.serviceWorker.register(scriptUrl, { scope: baseUrl.pathname }).catch(() => undefined);
  }, { once: true });
}
