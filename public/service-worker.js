self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  const isVideoResource = requestUrl.origin === self.location.origin
    && /(?:^|\/)tools\/video-studio(?:\/|$)/.test(requestUrl.pathname);
  const isOfficeResource = requestUrl.origin === self.location.origin
    && (/(?:^|\/)tools\/office-editor\/app(?:\/|$)/.test(requestUrl.pathname)
      || /(?:^|\/)tools\/excel-merger\/xls-preserve(?:\/|$)/.test(requestUrl.pathname)
      || /(?:^|\/)vendor\/zetaoffice(?:\/|$)/.test(requestUrl.pathname));
  const isWorkerResource = requestUrl.origin === self.location.origin
    && (event.request.destination === "worker" || event.request.destination === "sharedworker");
  if (!isVideoResource && !isOfficeResource && !isWorkerResource) return;

  const responsePromise = isOfficeResource && /(?:^|\/)vendor\/zetaoffice(?:\/|$)/.test(requestUrl.pathname)
    ? caches.match(event.request).then((cached) => cached || fetch(event.request))
    : fetch(event.request);
  event.respondWith(responsePromise.then((response) => {
    if (response.status === 0) return response;
    const headers = new Headers(response.headers);
    headers.set("Cross-Origin-Embedder-Policy", isOfficeResource || isWorkerResource ? "require-corp" : "credentialless");
    headers.set("Cross-Origin-Opener-Policy", "same-origin");
    headers.set("Cross-Origin-Resource-Policy", isOfficeResource || isWorkerResource ? "same-origin" : "cross-origin");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }));
});
