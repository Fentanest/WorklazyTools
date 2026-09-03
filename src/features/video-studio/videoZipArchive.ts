import type { BlobWriter } from "@zip.js/zip.js";

import { createUniqueSafeFileName, SafeFileNameRegistry } from "../../utils/fileNameSafety.ts";
import { writeZipArchive, type ZipArchiveProgress } from "../../utils/zipArchive.ts";

export interface VideoZipArchiveSource {
  fileName: string;
  blob: Blob;
}

/** @deprecated New callers should validate names and use writeZipArchive directly. */
export function writeVideoZipArchive(
  files: VideoZipArchiveSource[],
  writable: WritableStream | BlobWriter,
  signal?: AbortSignal,
  onProgress?: (progress: ZipArchiveProgress) => void,
  onFinalizing?: () => void,
) {
  const names = new SafeFileNameRegistry();
  return writeZipArchive(files.map((file) => ({
    fileName: createUniqueSafeFileName(file.fileName, names, "video"),
    blob: file.blob,
  })), writable, signal, onProgress, onFinalizing);
}
