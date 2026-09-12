import assert from "node:assert/strict";
import test from "node:test";

import { BlobWriter, Reader } from "@zip.js/zip.js";
import JSZip from "jszip";

import { createIncrementalZipArchiveWriter, writeZipArchive } from "../../src/utils/zipArchive.ts";
import { validateSafeFileName } from "../../src/utils/fileNameSafety.ts";

class StreamingBlobReader extends Reader<Blob> {
  readonly sourceBlob: Blob;
  streamReads = 0;
  randomReads = 0;

  constructor(sourceBlob: Blob) {
    super(sourceBlob);
    this.sourceBlob = sourceBlob;
    this.size = sourceBlob.size;
  }

  override createReadable() {
    this.streamReads += 1;
    return this.sourceBlob.stream();
  }

  override async readUint8Array(offset: number, length: number) {
    this.randomReads += 1;
    return new Uint8Array(await this.sourceBlob.slice(offset, offset + length).arrayBuffer());
  }
}

class FailingBlobReader extends Reader<Blob> {
  constructor(sourceBlob: Blob) {
    super(sourceBlob);
    this.size = sourceBlob.size;
  }

  override createReadable() {
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error("TEST_READER_FAILURE"));
      },
    });
  }

  override async readUint8Array() {
    throw new Error("TEST_RANDOM_READ_NOT_EXPECTED");
  }
}

test("per-writer options consume the supplied base Reader with workers disabled", async () => {
  const output = new BlobWriter("application/zip");
  const readers: StreamingBlobReader[] = [];
  const source = new Blob(["owned reader payload"]);
  const writer = createIncrementalZipArchiveWriter(output, undefined, {
    useWebWorkers: false,
    readerFactory(blob) {
      assert.equal(blob, source);
      const reader = new StreamingBlobReader(blob);
      readers.push(reader);
      return reader;
    },
  });

  await writer.add(validateSafeFileName("result.txt"), source);
  await writer.close();

  assert.equal(readers.length, 1);
  assert.equal(readers[0].sourceBlob, source);
  assert.equal(readers[0].streamReads, 1, "the injected Reader.createReadable path must be consumed");
  assert.equal(readers[0].randomReads, 0, "the native stream path must not be mistaken for readUint8Array accounting");
  const outputBlob = await output.getData();
  const archive = await JSZip.loadAsync(new Uint8Array(await outputBlob.arrayBuffer()));
  assert.equal(await archive.file("result.txt")?.async("string"), "owned reader payload");
});

test("writeZipArchive settles a failing custom reader before rejecting", async () => {
  const output = new BlobWriter("application/zip");
  let factoryCalls = 0;
  await assert.rejects(
    writeZipArchive(
      [{ fileName: validateSafeFileName("failed.txt"), blob: new Blob(["failure"]), }],
      output,
      undefined,
      undefined,
      undefined,
      {
        useWebWorkers: false,
        readerFactory(blob) {
          factoryCalls += 1;
          return new FailingBlobReader(blob);
        },
      },
    ),
    /TEST_READER_FAILURE/,
  );
  assert.equal(factoryCalls, 1);
  await assert.doesNotReject(output.getData(), "discard must settle the owned output writer before rejection returns");
});

test("a pre-aborted archive never allocates a custom reader", async () => {
  const controller = new AbortController();
  controller.abort(new DOMException("Aborted", "AbortError"));
  let factoryCalls = 0;
  await assert.rejects(
    writeZipArchive(
      [{ fileName: validateSafeFileName("canceled.txt"), blob: new Blob(["canceled"]) }],
      new BlobWriter("application/zip"),
      controller.signal,
      undefined,
      undefined,
      { readerFactory(blob) { factoryCalls += 1; return new StreamingBlobReader(blob); } },
    ),
    (error) => error instanceof DOMException && error.name === "AbortError",
  );
  assert.equal(factoryCalls, 0);
});
