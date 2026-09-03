import { BlobReader, type BlobWriter, ZipWriter } from "@zip.js/zip.js";

import { reserveSafeFileName, SafeFileNameRegistry, type SafeFileName } from "./fileNameSafety.ts";

export interface ZipArchiveSource {
  fileName: SafeFileName;
  blob: Blob;
}

export interface ZipArchiveProgress {
  entryIndex: number;
  entryCount: number;
  loadedBytes: number;
  totalBytes: number;
}

export async function writeZipArchive(
  files: ZipArchiveSource[],
  writable: WritableStream | BlobWriter,
  signal?: AbortSignal,
  onProgress?: (progress: ZipArchiveProgress) => void,
  onFinalizing?: () => void,
) {
  const names = new SafeFileNameRegistry();
  files.forEach((file) => reserveSafeFileName(file.fileName, names));
  const zipWriter = new ZipWriter(writable, {
    bufferedWrite: false,
    dataDescriptor: true,
    level: 0,
    signal,
    zip64: true,
  });
  let completedBytes = 0;
  const totalBytes = Math.max(1, files.reduce((sum, file) => sum + file.blob.size, 0));

  try {
    for (let index = 0; index < files.length; index += 1) {
      if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
      const file = files[index];
      const entryStartBytes = completedBytes;
      await zipWriter.add(file.fileName, new BlobReader(file.blob), {
        bufferedWrite: false,
        dataDescriptor: true,
        level: 0,
        signal,
        zip64: true,
        onprogress: (loaded) => onProgress?.({
          entryIndex: index,
          entryCount: files.length,
          loadedBytes: Math.min(totalBytes, entryStartBytes + loaded),
          totalBytes,
        }),
      });
      completedBytes += file.blob.size;
    }
    onFinalizing?.();
    return await zipWriter.close(undefined, { zip64: true });
  } catch (error) {
    await zipWriter.close(undefined, { zip64: true }).catch(() => undefined);
    throw error;
  }
}
