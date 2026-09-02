import assert from "node:assert/strict";
import test from "node:test";

import type { VideoResultStorageSession, VideoWorkerOutput } from "../../src/features/video-studio/types.ts";
import { VideoOutputQueue } from "../../src/features/video-studio/videoOutputQueue.ts";
import {
  VIDEO_RESULT_QUOTA_BLOB_FALLBACK_BYTES,
  VIDEO_RESULT_SESSION_TTL_MS,
  VIDEO_RESULT_STORAGE_ROOT,
  canFallbackToBlobAfterQuotaFailure,
  cleanupPartialVideoResults,
  cleanupStaleVideoResultSessions,
  createOpfsResultReference,
  createVideoResultStorageSession,
  estimateVideoStorageQuota,
  releaseVideoResultStorageSession,
  resolveVideoResultFile,
} from "../../src/features/video-studio/videoResultStorage.ts";
import {
  createVideoResultWritableTarget,
  persistVideoWorkerResult,
  VideoResultQuotaError,
} from "../../src/features/video-studio/videoResultStorage.worker.ts";

test("video result sessions fall back to memory when browser file storage is unavailable", async () => {
  const session = await createVideoResultStorageSession({
    now: 100,
    createId: idSequence("session", "owner"),
    storage: {},
  });
  assert.equal(session.mode, "memory");
  assert.equal(session.sessionId, "session");
});

test("video result session cleanup removes only expired owned directories", async () => {
  const storage = new FakeStorageManager();
  installStorage(storage);
  const first = await createVideoResultStorageSession({ now: 1_000, createId: idSequence("first", "owner-first"), storage });
  const second = await createVideoResultStorageSession({ now: 2_000, createId: idSequence("second", "owner-second"), storage });
  const root = await storage.root.getDirectoryHandle(VIDEO_RESULT_STORAGE_ROOT) as FakeDirectoryHandle;

  const removed = await cleanupStaleVideoResultSessions(root as unknown as FileSystemDirectoryHandle, VIDEO_RESULT_SESSION_TTL_MS + 1_500);
  assert.equal(removed, 1);
  assert.equal(root.children.has(first.sessionDirectoryName), false);
  assert.equal(root.children.has(second.sessionDirectoryName), true);
  assert.equal(storage.root.children.has(VIDEO_RESULT_STORAGE_ROOT), true, "cleanup must not delete the shared root");
});

test("completed OPFS results resolve as Files and cancellation cleanup removes only partial files", async () => {
  const storage = new FakeStorageManager();
  installStorage(storage);
  const session = await createVideoResultStorageSession({ now: 5_000, createId: idSequence("kept-session", "kept-owner"), storage });
  assert.equal(session.mode, "opfs");

  const stored = await persistVideoWorkerResult(new Uint8Array([1, 2, 3, 4]), "clip.mp4", "video/mp4", session);
  assert.equal(stored.output.data.kind, "opfs");
  assert.equal(stored.transfer.length, 0);
  const completedEntry = stored.output.data.kind === "opfs" ? stored.output.data.entryName : "";
  const sessionDirectory = await getSessionDirectory(storage, session);
  const partial = await sessionDirectory.getFileHandle("result-interrupted.mp4", { create: true }) as FakeFileHandle;
  partial.bytes = new Uint8Array([9, 9]);

  assert.equal(await cleanupPartialVideoResults(session, [completedEntry]), 1);
  assert.equal(sessionDirectory.children.has(completedEntry), true);
  assert.equal(sessionDirectory.children.has("result-interrupted.mp4"), false);
  const file = await resolveVideoResultFile(stored.output);
  assert.equal(file.name, "clip.mp4");
  assert.equal(file.type, "video/mp4");
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()), new Uint8Array([1, 2, 3, 4]));
});

test("canceling an active result write discards its partial file", async () => {
  const storage = new FakeStorageManager();
  installStorage(storage);
  const session = await createVideoResultStorageSession({ now: 6_000, createId: idSequence("cancel-session", "cancel-owner"), storage });
  const target = await createVideoResultWritableTarget(session, "interrupted.mp4", 4);
  const writer = target.writable.getWriter();
  await writer.write(new Uint8Array([7, 7]));
  await writer.abort();
  await target.discard();

  const sessionDirectory = await getSessionDirectory(storage, session);
  assert.equal(sessionDirectory.children.has(target.entryName), false);
});

test("quota shortage uses the bounded Blob fallback and rejects large temporary results", async () => {
  const storage = new FakeStorageManager({ quota: 32 * 1024 * 1024, usage: 31 * 1024 * 1024 });
  installStorage(storage);
  const session = await createVideoResultStorageSession({ now: 7_000, createId: idSequence("quota-session", "quota-owner"), storage });
  assert.equal(await estimateVideoStorageQuota(2 * 1024 * 1024, storage), "insufficient");

  const small = await persistVideoWorkerResult(new Uint8Array([5, 6, 7]), "small.mp4", "video/mp4", session);
  assert.equal(small.output.data.kind, "buffer");
  assert.equal(small.transfer.length, 1);
  assert.equal(canFallbackToBlobAfterQuotaFailure(VIDEO_RESULT_QUOTA_BLOB_FALLBACK_BYTES), true);
  assert.equal(canFallbackToBlobAfterQuotaFailure(VIDEO_RESULT_QUOTA_BLOB_FALLBACK_BYTES + 1), false);

  await assert.rejects(
    () => import("../../src/features/video-studio/videoResultStorage.worker.ts").then(({ createVideoResultWritableTarget }) =>
      createVideoResultWritableTarget(session, "large.mp4", VIDEO_RESULT_QUOTA_BLOB_FALLBACK_BYTES + 1)),
    VideoResultQuotaError,
  );
});

test("memory and File result variants preserve the common output contract", async () => {
  const bufferOutput: VideoWorkerOutput = {
    data: { kind: "buffer", buffer: new Uint8Array([4, 3, 2, 1]).buffer },
    fileName: "buffer.mp4",
    mimeType: "video/mp4",
    size: 4,
  };
  const fileOutput: VideoWorkerOutput = {
    data: { kind: "file", file: new File(["audio"], "source.mp3", { type: "audio/mpeg" }) },
    fileName: "file.mp3",
    mimeType: "audio/mpeg",
    size: 5,
  };
  assert.equal((await resolveVideoResultFile(bufferOutput)).name, "buffer.mp4");
  assert.equal((await resolveVideoResultFile(fileOutput)).name, "source.mp3");
});

test("an OPFS ownership or write failure preserves the legacy buffer fallback", async () => {
  const storage = new FakeStorageManager();
  installStorage(storage);
  const session = await createVideoResultStorageSession({ now: 8_000, createId: idSequence("fallback-session", "fallback-owner"), storage });
  const failedSession = { ...session, ownerId: "mismatched-owner" };
  const result = await persistVideoWorkerResult(new Uint8Array([8, 0, 0, 8]), "fallback.mp4", "video/mp4", failedSession);
  assert.equal(result.output.data.kind, "buffer");
  assert.equal(result.transfer.length, 1);
});

test("video output callbacks run serially and wait for async storage completion", async () => {
  const queue = new VideoOutputQueue();
  const events: string[] = [];
  let releaseFirst!: () => void;
  const firstStored = new Promise<void>((resolve) => { releaseFirst = resolve; });
  queue.enqueue(async () => {
    events.push("first-start");
    await firstStored;
    events.push("first-stored");
  });
  queue.enqueue(() => { events.push("second-stored"); });
  let resolved = false;
  const result = queue.wait().then(() => { resolved = true; });
  await Promise.resolve();
  assert.equal(resolved, false, "the final result must not resolve before storage finishes");
  assert.deepEqual(events, ["first-start"]);
  releaseFirst();
  await result;
  assert.deepEqual(events, ["first-start", "first-stored", "second-stored"]);
});

test("a session can only be released by its owner", async () => {
  const storage = new FakeStorageManager();
  installStorage(storage);
  const session = await createVideoResultStorageSession({ now: 9_000, createId: idSequence("release-session", "release-owner"), storage });
  const wrongOwner = { ...session, ownerId: "another-tab" };
  assert.equal(await releaseVideoResultStorageSession(wrongOwner), false);
  assert.equal(await releaseVideoResultStorageSession(session), true);
});

function idSequence(...ids: string[]) {
  let index = 0;
  return () => ids[index++] || `id-${index}`;
}

function installStorage(storage: FakeStorageManager) {
  Object.defineProperty(globalThis.navigator, "storage", { configurable: true, value: storage });
}

async function getSessionDirectory(storage: FakeStorageManager, session: VideoResultStorageSession) {
  const root = await storage.root.getDirectoryHandle(session.rootDirectoryName) as FakeDirectoryHandle;
  return root.getDirectoryHandle(session.sessionDirectoryName) as Promise<FakeDirectoryHandle>;
}

class FakeStorageManager {
  readonly root = new FakeDirectoryHandle("root");
  private readonly quota: StorageEstimate;

  constructor(quota: StorageEstimate = { quota: 1024 * 1024 * 1024, usage: 0 }) { this.quota = quota; }

  async getDirectory() { return this.root as unknown as FileSystemDirectoryHandle; }
  async estimate() { return this.quota; }
}

class FakeDirectoryHandle {
  readonly kind = "directory";
  readonly children = new Map<string, FakeDirectoryHandle | FakeFileHandle>();
  readonly name: string;

  constructor(name: string) { this.name = name; }

  async getDirectoryHandle(name: string, options: { create?: boolean } = {}) {
    const existing = this.children.get(name);
    if (existing instanceof FakeDirectoryHandle) return existing;
    if (existing || !options.create) throw new DOMException("Missing directory", "NotFoundError");
    const directory = new FakeDirectoryHandle(name);
    this.children.set(name, directory);
    return directory;
  }

  async getFileHandle(name: string, options: { create?: boolean } = {}) {
    const existing = this.children.get(name);
    if (existing instanceof FakeFileHandle) return existing;
    if (existing || !options.create) throw new DOMException("Missing file", "NotFoundError");
    const file = new FakeFileHandle(name);
    this.children.set(name, file);
    return file;
  }

  async removeEntry(name: string) {
    if (!this.children.delete(name)) throw new DOMException("Missing entry", "NotFoundError");
  }

  async *entries(): AsyncIterableIterator<[string, FileSystemHandle]> {
    for (const [name, handle] of this.children) yield [name, handle as unknown as FileSystemHandle];
  }
}

class FakeFileHandle {
  readonly kind = "file";
  bytes = new Uint8Array();
  readonly name: string;

  constructor(name: string) { this.name = name; }

  async getFile() { return new File([this.bytes], this.name); }

  async createWritable() {
    const chunks: BlobPart[] = [];
    return {
      write: async (value: BlobPart) => { chunks.push(value); },
      close: async () => { this.bytes = new Uint8Array(await new Blob(chunks).arrayBuffer()); },
      abort: async () => undefined,
    };
  }

  async createSyncAccessHandle() {
    return {
      truncate: (size: number) => { this.bytes = this.bytes.slice(0, size); },
      write: (value: ArrayBufferView, options: { at?: number } = {}) => {
        const source = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        const at = options.at ?? 0;
        if (this.bytes.byteLength < at + source.byteLength) {
          const expanded = new Uint8Array(at + source.byteLength);
          expanded.set(this.bytes);
          this.bytes = expanded;
        }
        this.bytes.set(source, at);
        return source.byteLength;
      },
      flush: () => undefined,
      close: () => undefined,
    };
  }
}
