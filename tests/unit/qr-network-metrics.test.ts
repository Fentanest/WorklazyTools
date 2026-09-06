import assert from "node:assert/strict";
import test from "node:test";
import { readNetLogResponses, attachTransferBytes } from "../qr-network-metrics.mjs";

test("QR worker transfer includes encoded body even when CDP captured only headers", () => {
  const source = { id: 7 };
  const headers = ["HTTP/1.1 200 OK", "Content-Encoding: gzip"];
  const responses = readNetLogResponses({ constants: { logEventTypes: {
    URL_REQUEST_START_JOB: 1, HTTP_TRANSACTION_READ_RESPONSE_HEADERS: 2, URL_REQUEST_JOB_BYTES_READ: 3,
  } }, events: [
    { type: 1, source, params: { url: "http://localhost/qr.worker.js" } },
    { type: 2, source, params: { headers } },
    { type: 3, source, params: { byte_count: 100 } },
    { type: 3, source, params: { byte_count: 23 } },
  ] });
  const requests = [{ url: "http://localhost/qr.worker.js", transferBytes: 0 }];
  attachTransferBytes(requests, responses);
  assert.equal(requests[0].encodedBodyBytes, 123);
  assert.equal(requests[0].transferBytes, 123 + Buffer.byteLength(headers.join("\r\n") + "\r\n\r\n"));
  assert.throws(() => attachTransferBytes(requests, []), /Missing NetLog/);
  assert.throws(() => attachTransferBytes(requests, [{ ...responses[0], bodyEvents: 0 }]), /Missing encoded/);
});

test("QR identity response uses unchanged filtered bytes, without counting decoded gzip bytes", () => {
  const source = { id: 8 };
  const responses = readNetLogResponses({ constants: { logEventTypes: {
    URL_REQUEST_START_JOB: 1, HTTP_TRANSACTION_READ_RESPONSE_HEADERS: 2, URL_REQUEST_JOB_FILTERED_BYTES_READ: 3,
  } }, events: [
    { type: 1, source, params: { url: "http://localhost/small.js" } },
    { type: 2, source, params: { headers: ["HTTP/1.1 200 OK", "Content-Length: 7"] } },
    { type: 3, source, params: { byte_count: 7 } },
  ] });
  assert.equal(responses[0].bodyBytes, 7);
  const requests = [{ url: "http://localhost/small.js", transferBytes: 0 }];
  assert.doesNotThrow(() => attachTransferBytes(requests, responses));
  assert.equal(requests[0].contentEncoding, "identity");
});
