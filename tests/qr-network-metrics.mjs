// Chromium's public CDP worker session can report only headers for the initial
// worker script. NetLog records the encoded body even before target attachment.
export function readNetLogResponses(netlog) {
  const names = new Map(Object.entries(netlog.constants.logEventTypes).map(([name, value]) => [value, name]));
  const responses = new Map();
  for (const event of netlog.events) {
    const name = names.get(event.type);
    if (name === "URL_REQUEST_START_JOB" && event.params?.url) {
      responses.set(event.source.id, { url: event.params.url, bodyBytes: 0, headerBytes: 0, bodyEvents: 0, filteredBodyBytes: 0, filteredBodyEvents: 0, cacheRead: false });
    }
    const response = responses.get(event.source.id);
    if (!response) continue;
    if (name === "HTTP_TRANSACTION_READ_RESPONSE_HEADERS") {
      response.headerBytes += Buffer.byteLength(`${event.params.headers.join("\r\n")}\r\n\r\n`);
      response.headers = event.params.headers;
    }
    if (name === "URL_REQUEST_JOB_BYTES_READ") {
      response.bodyBytes += event.params.byte_count;
      response.bodyEvents += 1;
    }
    if (name === "URL_REQUEST_JOB_FILTERED_BYTES_READ") {
      response.filteredBodyBytes += event.params.byte_count;
      response.filteredBodyEvents += 1;
    }
    if (name === "HTTP_CACHE_READ_DATA") response.cacheRead = true;
  }
  return [...responses.values()].filter(({ headerBytes, cacheRead }) => headerBytes > 0 || cacheRead).map((response) => {
    // With identity encoding Chromium logs only the filtered (identical) bytes.
    if (!response.bodyEvents && !response.headers?.some((header) => /^content-encoding:/i.test(header))) {
      response.bodyBytes = response.filteredBodyBytes;
      response.bodyEvents = response.filteredBodyEvents;
    }
    return response;
  });
}

export function attachTransferBytes(requests, responses) {
  const remaining = [...responses];
  for (const request of requests) {
    if (!/^https?:/.test(request.url)) continue;
    const index = remaining.findIndex(({ url }) => url === request.url);
    if (index < 0) throw new Error(`Missing NetLog response: ${request.url}`);
    const response = remaining.splice(index, 1)[0];
    if (request.url.endsWith(".js") && !response.cacheRead && !response.bodyEvents) {
      throw new Error(`Missing encoded JavaScript body bytes: ${request.url}`);
    }
    request.status ??= Number(response.headers?.[0]?.split(" ")[1]);
    request.cdpTransferBytes = request.transferBytes;
    request.transferBytes = response.cacheRead ? 0 : response.headerBytes + response.bodyBytes;
    request.responseHeaderBytes = response.headerBytes;
    request.encodedBodyBytes = response.bodyBytes;
    request.transferSource = "NetLog encoded response body + HTTP headers (excludes HTTP chunk framing)";
    request.netlogCacheRead = response.cacheRead;
    request.contentEncoding = response.headers?.find((header) => /^content-encoding:/i.test(header))?.split(":").slice(1).join(":").trim() || "identity";
  }
}
