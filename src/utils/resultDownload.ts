import { BlobReader, BlobWriter, ZipReader } from "@zip.js/zip.js";
import { createSafeFileName } from "./fileNameSafety.ts";
import { createZipArchiveBlob, type ZipArchiveOptions, type ZipArchiveProgress } from "./zipArchive.ts";

export interface DownloadSource { fileName: string; blob: Blob }

/** Decide by final file count, never by input count. Keep document containers intact. */
export async function createResultDownload(
  files: DownloadSource[], archiveName: string, signal?: AbortSignal,
  onProgress?: (progress: ZipArchiveProgress) => void, options?: ZipArchiveOptions,
): Promise<DownloadSource> {
  signal?.throwIfAborted();
  if (!files.length) throw new Error("NO_DOWNLOAD_RESULTS");
  if (files.length === 1) return { blob: files[0].blob, fileName: createSafeFileName(files[0].fileName) };
  const blob = await createZipArchiveBlob(files, signal, onProgress, undefined, options);
  signal?.throwIfAborted();
  return { blob, fileName: createSafeFileName(archiveName) };
}

/** Only explicitly marked, app-generated bundles are unpacked, never DOCX/XLSX/HWPX. */
export async function combineResultDownloads(
  results: Array<DownloadSource & { archive?: boolean }>, archiveName: string,
  signal?: AbortSignal, maxBytes = Infinity,
): Promise<DownloadSource> {
  const files: DownloadSource[] = [];
  let bytes = 0;
  const add = (file: DownloadSource) => {
    bytes += file.blob.size;
    if (bytes > maxBytes) throw new Error("DOWNLOAD_SIZE_LIMIT");
    files.push(file);
  };
  for (const [index, result] of results.entries()) {
    signal?.throwIfAborted();
    if (!result.archive) { add(result); continue; }
    const reader = new ZipReader(new BlobReader(result.blob), { useWebWorkers: false });
    try {
      for await (const entry of reader.getEntriesGenerator()) {
        signal?.throwIfAborted();
        if (entry.directory) continue;
        if (/\.zip$/i.test(entry.filename)) throw new Error("NESTED_DOWNLOAD_ARCHIVE");
        if (bytes + entry.uncompressedSize > maxBytes) throw new Error("DOWNLOAD_SIZE_LIMIT");
        const blob = await entry.getData(new BlobWriter(), { signal, useWebWorkers: false });
        // Input index distinguishes same-named PDFs; the shared ZIP writer reserves collisions.
        add({ fileName: `${index + 1}-${result.fileName.replace(/\.zip$/i, "")}-${entry.filename}`, blob });
      }
    } finally { await reader.close(); }
  }
  return createResultDownload(files, archiveName, signal);
}
