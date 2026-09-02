import { BlobReader, BlobWriter, ZipWriter } from "@zip.js/zip.js";

export interface VideoZipArchiveSource {
  fileName: string;
  blob: Blob;
}

export interface VideoZipArchiveProgress {
  entryIndex: number;
  entryCount: number;
  loadedBytes: number;
  totalBytes: number;
}

export async function writeVideoZipArchive(
  files: VideoZipArchiveSource[],
  writable: WritableStream | BlobWriter,
  signal?: AbortSignal,
  onProgress?: (progress: VideoZipArchiveProgress) => void,
  onFinalizing?: () => void,
) {
  const zipWriter = new ZipWriter(writable, {
    bufferedWrite: false,
    dataDescriptor: true,
    level: 0,
    signal,
    zip64: true,
  });
  const usedNames = new Set<string>();
  let completedBytes = 0;
  const totalBytes = Math.max(1, files.reduce((sum, file) => sum + file.blob.size, 0));

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const entryStartBytes = completedBytes;
    await zipWriter.add(uniqueVideoZipEntryName(file.fileName, usedNames), new BlobReader(file.blob), {
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
  return zipWriter.close(undefined, { zip64: true });
}

export function uniqueVideoZipEntryName(fileName: string, usedNames: Set<string>) {
  if (!usedNames.has(fileName)) {
    usedNames.add(fileName);
    return fileName;
  }
  const dot = fileName.lastIndexOf(".");
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const extension = dot > 0 ? fileName.slice(dot) : "";
  let sequence = 2;
  let candidate = `${base}-${sequence}${extension}`;
  while (usedNames.has(candidate)) candidate = `${base}-${sequence += 1}${extension}`;
  usedNames.add(candidate);
  return candidate;
}
