import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { writeVideoZipArchive } from "../../src/features/video-studio/videoZipArchive.ts";

const execFileAsync = promisify(execFile);

test("video ZIP streams inputs sequentially and emits a forced ZIP64 archive accepted by unzip", async () => {
  const payload = new Uint8Array(8 * 1024 * 1024 + 123);
  for (let index = 0; index < payload.length; index += 1) payload[index] = (index * 31 + 17) & 0xff;
  const source = new MeasuredBlob(payload);
  const outputChunks: Uint8Array[] = [];
  const outputMeasurements = { writes: 0, maxChunkBytes: 0, totalBytes: 0 };
  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      outputMeasurements.writes += 1;
      outputMeasurements.maxChunkBytes = Math.max(outputMeasurements.maxChunkBytes, chunk.byteLength);
      outputMeasurements.totalBytes += chunk.byteLength;
      outputChunks.push(chunk.slice());
    },
  });
  const progressEntries: number[] = [];

  await writeVideoZipArchive([
    { fileName: "payload.bin", blob: source },
    { fileName: "note.txt", blob: new Blob(["streamed zip64 fixture"]) },
  ], writable, undefined, ({ entryIndex }) => progressEntries.push(entryIndex));

  assert.equal(source.wholeArrayBufferReads, 0, "BlobReader must not load the entire input with arrayBuffer()");
  assert.ok(source.streamCalls >= 1, "the input must be consumed through Blob.stream()");
  assert.ok(source.chunkCount > 1, `expected bounded input chunks, got ${source.chunkCount}`);
  assert.ok(source.maxChunkBytes < source.size, `input chunk ${source.maxChunkBytes} unexpectedly equals the full ${source.size}-byte Blob`);
  assert.ok(outputMeasurements.writes > 2, `expected streamed output writes, got ${outputMeasurements.writes}`);
  assert.ok(outputMeasurements.maxChunkBytes < outputMeasurements.totalBytes, "ZIP output was buffered into one contiguous write");
  assert.ok(progressEntries.indexOf(1) === -1 || progressEntries.lastIndexOf(0) < progressEntries.indexOf(1), "ZIP entries must be added sequentially");

  const archive = concatenate(outputChunks, outputMeasurements.totalBytes);
  assert.ok(findSignature(archive, [0x50, 0x4b, 0x06, 0x06]) >= 0, "ZIP64 EOCD record is missing");
  assert.ok(findSignature(archive, [0x50, 0x4b, 0x06, 0x07]) >= 0, "ZIP64 EOCD locator is missing");
  assert.ok(findSignature(archive, [0x50, 0x4b, 0x05, 0x06]) >= 0, "classic EOCD record is missing");

  const directory = await mkdtemp(path.join(tmpdir(), "worklazy-video-zip64-"));
  const archivePath = path.join(directory, "video-results.zip");
  try {
    await writeFile(archivePath, archive);
    const integrity = await execFileAsync("unzip", ["-t", archivePath], { maxBuffer: 4 * 1024 * 1024 });
    assert.match(integrity.stdout, /No errors detected|OK/);
    const extracted = await execFileAsync("unzip", ["-p", archivePath, "payload.bin"], {
      encoding: "buffer",
      maxBuffer: payload.byteLength + 1024 * 1024,
    });
    assert.equal(sha256(extracted.stdout), sha256(payload));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

class MeasuredBlob extends Blob {
  wholeArrayBufferReads = 0;
  streamCalls = 0;
  chunkCount = 0;
  maxChunkBytes = 0;
  private readonly source: Uint8Array;

  constructor(source: Uint8Array) {
    super([source]);
    this.source = source;
  }

  override arrayBuffer() {
    this.wholeArrayBufferReads += 1;
    return Promise.resolve(this.source.slice().buffer);
  }

  override stream() {
    this.streamCalls += 1;
    let offset = 0;
    return new ReadableStream<Uint8Array>({
      pull: (controller) => {
        if (offset >= this.source.byteLength) {
          controller.close();
          return;
        }
        const value = this.source.slice(offset, Math.min(this.source.byteLength, offset + 64 * 1024));
        offset += value.byteLength;
        this.chunkCount += 1;
        this.maxChunkBytes = Math.max(this.maxChunkBytes, value.byteLength);
        controller.enqueue(value);
      },
    });
  }
}

function concatenate(chunks: Uint8Array[], totalBytes: number) {
  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function findSignature(bytes: Uint8Array, signature: number[]) {
  outer: for (let index = 0; index <= bytes.length - signature.length; index += 1) {
    for (let signatureIndex = 0; signatureIndex < signature.length; signatureIndex += 1) {
      if (bytes[index + signatureIndex] !== signature[signatureIndex]) continue outer;
    }
    return index;
  }
  return -1;
}

function sha256(value: Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}
