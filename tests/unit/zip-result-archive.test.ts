import assert from "node:assert/strict";
import test from "node:test";

import JSZip from "jszip";

import { createZipArchiveBlob } from "../../src/utils/zipArchive.ts";

test("result ZIP blobs preserve Unicode content and reserve colliding names", async () => {
  const progress: Array<{ loadedBytes: number; totalBytes: number }> = [];
  let finalized = false;
  const sources = [
    { fileName: "한글 결과.txt", blob: new Blob(["첫 번째 결과"]) },
    { fileName: "한글 결과.txt", blob: new Blob(["두 번째 결과"]) },
    { fileName: "unsafe:name.txt", blob: new Blob(["안전한 이름"]) },
  ];
  const blob = await createZipArchiveBlob(
    sources,
    undefined,
    ({ loadedBytes, totalBytes }) => progress.push({ loadedBytes, totalBytes }),
    () => { finalized = true; },
    { useWebWorkers: false },
  );

  assert.equal(blob.type, "application/zip");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.notEqual(bytes.findIndex((value, index) => value === 0x50 && bytes[index + 1] === 0x4b && bytes[index + 2] === 0x06 && bytes[index + 3] === 0x06), -1, "ZIP64 EOCD must be present");
  const archive = await JSZip.loadAsync(bytes);
  assert.deepEqual(Object.keys(archive.files), ["한글 결과.txt", "한글 결과-2.txt", "unsafe_name.txt"]);
  assert.equal(await archive.file("한글 결과.txt")?.async("string"), "첫 번째 결과");
  assert.equal(await archive.file("한글 결과-2.txt")?.async("string"), "두 번째 결과");
  assert.equal(await archive.file("unsafe_name.txt")?.async("string"), "안전한 이름");
  assert.equal(finalized, true);
  assert.ok(progress.length > 0);
  const totalBytes = sources.reduce((sum, source) => sum + source.blob.size, 0);
  assert.deepEqual(progress.at(-1), { loadedBytes: totalBytes, totalBytes });
  assert.ok(progress.every((value, index) => index === 0 || value.loadedBytes >= progress[index - 1].loadedBytes));
});

test("result ZIP blob creation rejects before reading when already canceled", async () => {
  const controller = new AbortController();
  controller.abort(new DOMException("Canceled", "AbortError"));
  await assert.rejects(
    createZipArchiveBlob(
      [{ fileName: "result.txt", blob: new Blob(["result"]) }],
      controller.signal,
      undefined,
      undefined,
      { useWebWorkers: false },
    ),
    (error) => error instanceof DOMException && error.name === "AbortError",
  );
});

test("result ZIP blob creation stops when canceled during an entry write", async () => {
  const controller = new AbortController();
  let progressCalls = 0;
  await assert.rejects(
    createZipArchiveBlob(
      [{ fileName: "large-result.bin", blob: new Blob([new Uint8Array(512 * 1024)]) }],
      controller.signal,
      ({ loadedBytes }) => {
        progressCalls += 1;
        if (loadedBytes > 0) controller.abort(new DOMException("Canceled", "AbortError"));
      },
      undefined,
      { level: 6, useWebWorkers: false },
    ),
    (error) => error instanceof DOMException && error.name === "AbortError",
  );
  assert.ok(progressCalls > 0);
});
