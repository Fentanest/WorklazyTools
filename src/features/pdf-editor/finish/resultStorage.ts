import { MEMORY_RESULT_LIMIT_BYTES, checkMemoryResultRegistration } from "./canvasPolicy.ts";

const STORAGE_ROOT = "worklazy-pdf-finish-results-v1";

export type PdfFinishStorageMode = "memory" | "opfs";

export interface StoredPdfFinishResult {
  blob: Blob;
  mode: PdfFinishStorageMode;
  dispose: () => Promise<void>;
}

export interface PdfFinishResultStore {
  readonly mode: PdfFinishStorageMode;
  store: (bytes: Uint8Array, fileName: string, signal?: AbortSignal) => Promise<StoredPdfFinishResult>;
  dispose: () => Promise<void>;
}

export class PdfFinishStorageError extends Error {
  readonly reason: "memory-limit" | "opfs-write";

  constructor(reason: PdfFinishStorageError["reason"], cause?: unknown) {
    super(`PDF_FINISH_STORAGE_${reason.toUpperCase().replaceAll("-", "_")}`, cause === undefined ? undefined : { cause });
    this.name = "PdfFinishStorageError";
    this.reason = reason;
  }
}

interface StorageManagerLike {
  getDirectory?: () => Promise<FileSystemDirectoryHandle>;
}

export async function createPdfFinishResultStore(options: {
  storage?: StorageManagerLike;
  id?: string;
  memoryLimitBytes?: number;
} = {}): Promise<PdfFinishResultStore> {
  const storage = options.storage ?? (typeof navigator === "undefined" ? undefined : navigator.storage);
  const memoryLimit = options.memoryLimitBytes ?? MEMORY_RESULT_LIMIT_BYTES;
  if (storage?.getDirectory) {
    try {
      const storageRoot = await storage.getDirectory();
      const root = await storageRoot.getDirectoryHandle(STORAGE_ROOT, { create: true });
      const sessionName = `session-${options.id ?? crypto.randomUUID()}`;
      const session = await root.getDirectoryHandle(sessionName, { create: true });
      return opfsStore(root, session, sessionName);
    } catch {
      // OPFS unavailable before work starts is the only memory fallback point.
    }
  }
  return memoryStore(memoryLimit);
}

function memoryStore(limit: number): PdfFinishResultStore {
  let retained = 0;
  let disposed = false;
  const results = new Set<Blob>();
  return {
    mode: "memory",
    async store(bytes, _fileName, signal) {
      if (signal?.aborted) throw new DOMException("PDF result registration canceled", "AbortError");
      const decision = checkMemoryResultRegistration(retained, bytes.byteLength, limit);
      if (!decision.register) throw new PdfFinishStorageError("memory-limit");
      const blob = new Blob([bytes], { type: "application/pdf" });
      retained += blob.size;
      results.add(blob);
      return {
        blob,
        mode: "memory",
        dispose: async () => {
          if (results.delete(blob)) retained -= blob.size;
        },
      };
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      results.clear();
      retained = 0;
    },
  };
}

function opfsStore(
  root: FileSystemDirectoryHandle,
  session: FileSystemDirectoryHandle,
  sessionName: string,
): PdfFinishResultStore {
  let sequence = 0;
  let disposed = false;
  const entries = new Set<string>();
  const dispose = async () => {
    if (disposed) return;
    disposed = true;
    entries.clear();
    try { await root.removeEntry(sessionName, { recursive: true }); } catch { /* Already removed or unavailable. */ }
  };
  return {
    mode: "opfs",
    async store(bytes, _fileName, signal) {
      if (signal?.aborted) throw new DOMException("PDF result registration canceled", "AbortError");
      const entryName = `result-${++sequence}.pdf`;
      let writable: FileSystemWritableFileStream | undefined;
      try {
        const handle = await session.getFileHandle(entryName, { create: true });
        writable = await handle.createWritable();
        await writable.write(bytes);
        if (signal?.aborted) throw new DOMException("PDF result registration canceled", "AbortError");
        await writable.close();
        writable = undefined;
        const blob = await handle.getFile();
        entries.add(entryName);
        return { blob, mode: "opfs", dispose };
      } catch (error) {
        try { await writable?.abort(); } catch { /* Cancellation exceptions are ignored. */ }
        try { await session.removeEntry(entryName); } catch { /* Partial entry may not exist. */ }
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        throw new PdfFinishStorageError("opfs-write", error);
      }
    },
    dispose,
  };
}
