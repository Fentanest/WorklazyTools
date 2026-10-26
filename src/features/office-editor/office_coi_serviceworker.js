/*! Based on coi-serviceworker 0.1.7 by Guido Zuidhof and contributors, MIT. */
'use strict';

if (typeof window === 'undefined') {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
  self.addEventListener('message', (event) => {
    if (event.data?.type !== 'deregister') return;
    event.waitUntil(self.registration.unregister()
      .then(() => self.clients.matchAll())
      .then((clients) => clients.forEach((client) => client.navigate(client.url))));
  });
  self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;
    const url = new URL(request.url);
    const isOfficeAsset = url.origin === self.location.origin
      && /(?:^|\/)vendor\/zetaoffice(?:\/|$)/.test(url.pathname);
    const responsePromise = isOfficeAsset
      ? caches.match(request).then((cached) => cached || fetch(request))
      : fetch(request);
    event.respondWith(responsePromise.then((response) => {
      if (response.status === 0) return response;
      const headers = new Headers(response.headers);
      headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
      headers.set('Cross-Origin-Opener-Policy', 'same-origin');
      headers.set('Cross-Origin-Resource-Policy', 'same-origin');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }));
  });
} else {
  const configuration = {
    shouldRegister: () => true,
    doReload: () => window.location.reload(),
    quiet: false,
    ...window.coi,
  };
  const scriptUrl = document.currentScript.src;
  const reloadKey = `worklazy_coi_reload:${new URL(scriptUrl).pathname}`;
  const reloadTarget = `${window.location.pathname}${window.location.search}`;
  const chunkTarget = `chunk:${reloadTarget}`;
  const isolationReady = window.crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined';
  let reloading = false;
  let chunkFailurePending = false;
  const reloadOnce = (chunkFailure = false) => {
    try {
      const used = sessionStorage.getItem(reloadKey);
      if (reloading) {
        // A chunk rejection can join the preparation reload already in flight.
        if (chunkFailure && used !== chunkTarget) sessionStorage.setItem(reloadKey, chunkTarget);
        return true;
      }
      if (used === reloadTarget || used === chunkTarget) return false;
      sessionStorage.setItem(reloadKey, chunkFailure ? chunkTarget : reloadTarget);
    } catch {
      // An unavailable guard must never cause repeated document reloads.
      return false;
    }
    reloading = true;
    configuration.doReload();
    return true;
  };
  const reloadWhenActivated = (worker) => new Promise((resolve) => {
    if (!worker) { resolve(false); return; }
    const check = () => {
      if (worker.state !== 'activated' && worker.state !== 'redundant') return;
      worker.removeEventListener?.('statechange', check);
      resolve(worker.state === 'activated' && reloadOnce(chunkFailurePending));
    };
    if (worker.state === 'activated' || worker.state === 'redundant') check();
    else worker.addEventListener('statechange', check);
  });
  const preparation = isolationReady ? Promise.resolve(true)
    : configuration.shouldRegister() && window.isSecureContext && navigator.serviceWorker
      ? navigator.serviceWorker.register(scriptUrl).then((registration) => {
        if (!configuration.quiet) console.log('Document preparation registered', registration.scope);
        if (registration.active || registration.waiting || registration.installing) {
          return reloadWhenActivated(registration.active || registration.waiting || registration.installing);
        }
        return new Promise((resolve) => registration.addEventListener('updatefound', () => {
          resolve(reloadWhenActivated(registration.installing));
        }, { once: true }));
      }, () => false)
      : Promise.resolve(false);
  window.worklazyDocumentRecovery = {
    reloadForChunk: async () => {
      chunkFailurePending = true;
      // Share the preparation reload, after activation; never spend its budget
      // on a new document that is still unable to use the isolated workspace.
      return Boolean(await preparation) && reloadOnce(true);
    },
    confirmToolReady: () => {
      if (!isolationReady || reloading) return;
      try { sessionStorage.removeItem(reloadKey); } catch { /* Recovery remains manual. */ }
    },
  };
  if (isolationReady) {
    // Isolation success releases preparation only. A chunk retry must survive
    // this document's startup until React confirms the actual tool is ready.
    try {
      if (!sessionStorage.getItem(reloadKey)?.startsWith('chunk:')) sessionStorage.removeItem(reloadKey);
    } catch { /* Storage is optional after successful isolation. */ }
  }
}
