self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  const isVideoResource = requestUrl.origin === self.location.origin
    && /(?:^|\/)tools\/video-studio(?:\/|$)/.test(requestUrl.pathname);
  if (!isVideoResource) return;

  event.respondWith(fetch(event.request).then((response) => {
    if (response.status === 0) return response;
    const headers = new Headers(response.headers);
    headers.set("Cross-Origin-Embedder-Policy", "credentialless");
    headers.set("Cross-Origin-Opener-Policy", "same-origin");
    headers.set("Cross-Origin-Resource-Policy", "cross-origin");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }));
});
