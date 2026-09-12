import { BlobReader, type BlobWriter, type Reader, ZipWriter } from "@zip.js/zip.js";

import {
  reserveSafeFileName,
  reserveSafeZipEntryPath,
  SafeFileNameRegistry,
  SafeZipEntryPathRegistry,
  createUniqueSafeFileName,
  validateSafeZipEntryPath,
  type SafeFileName,
  type SafeZipEntryPath,
} from "./fileNameSafety.ts";

export interface ZipArchiveSource {
  fileName: SafeFileName;
  blob: Blob;
}

export function createSafeZipArchiveSources(files: Array<{ fileName: string; blob: Blob }>): ZipArchiveSource[] {
  const names = new SafeFileNameRegistry();
  return files.map(({ fileName, blob }, index) => ({
    fileName: createUniqueSafeFileName(fileName, names, `result-${index + 1}`),
    blob,
  }));
}

export interface ZipArchiveProgress {
  entryIndex: number;
  entryCount: number;
  loadedBytes: number;
  totalBytes: number;
}

export interface IncrementalZipArchiveWriter {
  add(fileName: SafeFileName | SafeZipEntryPath, blob: Blob, onProgress?: (loadedBytes: number) => void): Promise<void>;
  close(): Promise<unknown>;
  discard(): Promise<void>;
}

export interface ZipArchiveOptions {
  useWebWorkers?: boolean;
  readerFactory?: (blob: Blob) => Reader<Blob>;
}

export function createIncrementalZipArchiveWriter(
  writable: WritableStream | BlobWriter,
  signal?: AbortSignal,
  options: ZipArchiveOptions = {},
): IncrementalZipArchiveWriter {
  const names = new SafeZipEntryPathRegistry();
  const readerFactory = options.readerFactory ?? ((blob: Blob) => new BlobReader(blob));
  const zipWriter = new ZipWriter(writable, {
    bufferedWrite: false,
    dataDescriptor: true,
    level: 0,
    signal,
    useWebWorkers: options.useWebWorkers,
    zip64: true,
  });
  let closed = false;

  return {
    async add(fileName, blob, onProgress) {
      if (closed) throw new Error("ZIP_WRITER_CLOSED");
      if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
      const entryPath = reserveSafeZipEntryPath(validateSafeZipEntryPath(fileName), names);
      await zipWriter.add(entryPath, readerFactory(blob), {
        bufferedWrite: false,
        dataDescriptor: true,
        level: 0,
        signal,
        useWebWorkers: options.useWebWorkers,
        zip64: true,
        useUnicodeFileNames: true,
        onprogress: (loaded) => onProgress?.(loaded),
      });
    },
    async close() {
      if (closed) throw new Error("ZIP_WRITER_CLOSED");
      closed = true;
      return zipWriter.close(undefined, { zip64: true });
    },
    async discard() {
      if (closed) return;
      closed = true;
      await zipWriter.close(undefined, { zip64: true }).catch(() => undefined);
    },
  };
}

export async function writeZipArchive(
  files: ZipArchiveSource[],
  writable: WritableStream | BlobWriter,
  signal?: AbortSignal,
  onProgress?: (progress: ZipArchiveProgress) => void,
  onFinalizing?: () => void,
  options?: ZipArchiveOptions,
) {
  const names = new SafeFileNameRegistry();
  files.forEach((file) => reserveSafeFileName(file.fileName, names));
  const zipWriter = createIncrementalZipArchiveWriter(writable, signal, options);
  let completedBytes = 0;
  const totalBytes = Math.max(1, files.reduce((sum, file) => sum + file.blob.size, 0));

  try {
    for (let index = 0; index < files.length; index += 1) {
      if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
      const file = files[index];
      const entryStartBytes = completedBytes;
      await zipWriter.add(file.fileName, file.blob, (loaded) => onProgress?.({
          entryIndex: index,
          entryCount: files.length,
          loadedBytes: Math.min(totalBytes, entryStartBytes + loaded),
          totalBytes,
        }));
      completedBytes += file.blob.size;
    }
    onFinalizing?.();
    return await zipWriter.close();
  } catch (error) {
    await zipWriter.discard();
    throw error;
  }
}
