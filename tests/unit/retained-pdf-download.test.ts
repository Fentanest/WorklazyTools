import assert from "node:assert/strict";
import test from "node:test";
import { downloadRetainedPdf } from "../../src/features/pdf-editor/retainedPdfDownload.ts";

test("retained download owns a fresh URL through the delayed browser save", context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const blobs: Blob[] = [], revoked: string[] = [], clicks: string[] = [];
  context.mock.method(URL, "createObjectURL", (blob: Blob) => { blobs.push(blob); return `blob:${blobs.length}`; });
  context.mock.method(URL, "revokeObjectURL", (url: string) => revoked.push(url));
  const original = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => {
    const anchor = { href: "", download: "", click() { clicks.push(`${anchor.href}/${anchor.download}`); } };
    return anchor;
  } } });
  try {
    const blob = new Blob(["pdf bytes"]);
    downloadRetainedPdf(blob, "result.pdf");
    downloadRetainedPdf(blob, "retry.pdf");
    assert.deepEqual(blobs, [blob, blob]);
    assert.deepEqual(clicks, ["blob:1/result.pdf", "blob:2/retry.pdf"]);
    context.mock.timers.tick(29_999);
    assert.deepEqual(revoked, []);
    context.mock.timers.tick(1);
    assert.deepEqual(revoked, ["blob:1", "blob:2"]);
  } finally {
    if (original) Object.defineProperty(globalThis, "document", original);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
