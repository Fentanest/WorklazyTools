/// <reference lib="webworker" />

import type { VideoResultStorageSession, VideoWorkerOutput } from "./types";
import {
  canFallbackToBlobAfterQuotaFailure,
  createOpfsResultReference,
  createVideoResultEntryName,
  estimateVideoStorageQuota,
  isStorageQuotaError,
  openVideoResultSessionDirectory,
  refreshVideoResultStorageSession,
} from "./videoResultStorage.ts";

interface SyncAccessHandleLike {
  write: (buffer: ArrayBufferView, options?: { at?: number }) => number;
  truncate: (size: number) => void;
  flush: () => void;
  close: () => void;
}

export class VideoResultQuotaError extends Error {
  constructor() {
    super("Temporary result storage quota is insufficient");
    this.name = "VideoResultQuotaError";
  }
}

export interface VideoResultWritableTarget {
  entryName: string;
  writable: WritableStream<Uint8Array>;
  complete: (fileName: string, mimeType: string) => Promise<VideoWorkerOutput>;
  discard: () => Promise<void>;
}

export async function persistVideoWorkerResult(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string,
  session: VideoResultStorageSession | undefined,
): Promise<{ output: VideoWorkerOutput; transfer: Transferable[] }> {
  if (!session || session.mode !== "opfs") return memoryResult(bytes, fileName, mimeType);

  let target: VideoResultWritableTarget | undefined;
  let writer: WritableStreamDefaultWriter<Uint8Array> | undefined;
  try {
    target = await createVideoResultWritableTarget(session, fileName, bytes.byteLength);
    writer = target.writable.getWriter();
    await writer.write(bytes);
    await writer.close();
    writer = undefined;
    return { output: await target.complete(fileName, mimeType), transfer: [] };
  } catch (error) {
    await writer?.abort().catch(() => undefined);
    await target?.discard().catch(() => undefined);
    if (error instanceof VideoResultQuotaError || isStorageQuotaError(error)) {
      if (!canFallbackToBlobAfterQuotaFailure(bytes.byteLength)) throw new VideoResultQuotaError();
    }
    return memoryResult(bytes, fileName, mimeType);
  }
}

export async function createVideoResultWritableTarget(
  session: VideoResultStorageSession,
  fileName: string,
  expectedSize: number,
): Promise<VideoResultWritableTarget> {
  if (session.mode !== "opfs") throw new Error("Persistent browser result storage is unavailable");
  if (await estimateVideoStorageQuota(expectedSize) === "insufficient") throw new VideoResultQuotaError();

  const sessionDirectory = await openVideoResultSessionDirectory(session);
  const entryName = createVideoResultEntryName(fileName);
  const fileHandle = await sessionDirectory.getFileHandle(entryName, { create: true });
  let syncAccessHandle: SyncAccessHandleLike | undefined;
  let discarded = false;
  try {
    const createSyncAccessHandle = (fileHandle as unknown as { createSyncAccessHandle?: () => Promise<SyncAccessHandleLike> }).createSyncAccessHandle;
    let writable: WritableStream<Uint8Array>;
    if (createSyncAccessHandle) {
      try {
        const result = await createSyncWritableStream(createSyncAccessHandle.bind(fileHandle));
        syncAccessHandle = result.accessHandle;
        writable = result.writable;
      } catch (error) {
        if (isStorageQuotaError(error)) throw error;
        writable = await fileHandle.createWritable() as WritableStream<Uint8Array>;
      }
    } else {
      writable = await fileHandle.createWritable() as WritableStream<Uint8Array>;
    }

    return {
      entryName,
      writable,
      complete: async (completedFileName, mimeType) => {
        syncAccessHandle = undefined;
        const file = await fileHandle.getFile();
        await refreshVideoResultStorageSession(session).catch(() => undefined);
        return {
          data: createOpfsResultReference(session, entryName),
          fileName: completedFileName,
          mimeType,
          size: file.size,
        };
      },
      discard: async () => {
        if (discarded) return;
        discarded = true;
        try { syncAccessHandle?.close(); } catch { /* already closed */ }
        syncAccessHandle = undefined;
        await sessionDirectory.removeEntry(entryName).catch(() => undefined);
      },
    };
  } catch (error) {
    try { syncAccessHandle?.close(); } catch { /* already closed */ }
    await sessionDirectory.removeEntry(entryName).catch(() => undefined);
    throw error;
  }
}

function memoryResult(bytes: Uint8Array, fileName: string, mimeType: string) {
  const buffer = transferableBuffer(bytes);
  return {
    output: {
      data: { kind: "buffer" as const, buffer },
      fileName,
      mimeType,
      size: bytes.byteLength,
    },
    transfer: [buffer] satisfies Transferable[],
  };
}

async function createSyncWritableStream(createSyncAccessHandle: () => Promise<SyncAccessHandleLike>) {
  const accessHandle = await createSyncAccessHandle();
  try {
    accessHandle.truncate(0);
  } catch (error) {
    try { accessHandle.close(); } catch { /* already closed */ }
    throw error;
  }
  let position = 0;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    accessHandle.flush();
    accessHandle.close();
  };
  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      let written = 0;
      while (written < chunk.byteLength) {
        const count = accessHandle.write(chunk.subarray(written), { at: position });
        if (!Number.isFinite(count) || count <= 0) throw new Error("Unable to write result data");
        written += count;
        position += count;
      }
    },
    close,
    abort() {
      try { close(); } catch { /* cleanup continues below */ }
    },
  });
  return { writable, accessHandle };
}

function transferableBuffer(bytes: Uint8Array) {
  if (bytes.buffer instanceof ArrayBuffer && bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength) return bytes.buffer;
  return bytes.slice().buffer;
}
