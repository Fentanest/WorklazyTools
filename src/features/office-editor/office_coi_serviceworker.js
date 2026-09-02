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
  const isolationReady = window.crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined';
  const reloadOnce = () => {
    if (sessionStorage.getItem(reloadKey) === reloadTarget) return;
    sessionStorage.setItem(reloadKey, reloadTarget);
    configuration.doReload();
  };
  const reloadWhenActivated = (worker) => {
    if (!worker || worker.state === 'redundant') return;
    if (worker.state === 'activated') {
      reloadOnce();
      return;
    }
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated') reloadOnce();
    });
  };
  if (isolationReady) sessionStorage.removeItem(reloadKey);
  if (!isolationReady && configuration.shouldRegister() && window.isSecureContext && navigator.serviceWorker) {
    navigator.serviceWorker.register(scriptUrl).then((registration) => {
      if (!configuration.quiet) console.log('Document preparation registered', registration.scope);
      if (registration.active) reloadOnce();
      else if (registration.waiting || registration.installing) reloadWhenActivated(registration.waiting || registration.installing);
      else registration.addEventListener('updatefound', () => reloadWhenActivated(registration.installing));
    }, () => undefined);
  }
}
