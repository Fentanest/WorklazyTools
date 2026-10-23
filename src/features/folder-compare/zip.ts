import { BlobReader, ZipReader, type FileEntry } from '@zip.js/zip.js';
import { Admission, LIMITS, checkAbort, pathIssue, validSize } from './core.ts';
import type { FolderEntry, FolderSource, OpenedBytes } from './core.ts';
/** zip.js allocates its central directory before yielding entries. Guard every random read first. */
export class BoundedZipReader extends BlobReader {
  private readonly signal: AbortSignal;
  constructor(blob: Blob, signal: AbortSignal) { super(blob); this.signal = signal; }
  override async readUint8Array(index: number, length: number): Promise<Uint8Array> {
    checkAbort(this.signal);
    if (!validSize(index) || !validSize(length) || length > LIMITS.allocation || index + length > this.size) throw new Error('zip-allocation-limit');
    const bytes = await super.readUint8Array(index, length); checkAbort(this.signal); return bytes;
  }
}
export async function zipSource(blob: Blob, revision: string, admission: Admission, signal: AbortSignal): Promise<FolderSource> {
  if (!validSize(blob.size) || blob.size > LIMITS.archive) throw new Error('archive-limit');
  const reader = new ZipReader(new BoundedZipReader(blob, signal), { strictness: 'balanced', filenameValidation: 'strict',
    checkCrc32: true, checkAuthenticationCode: true, checkLocalDirectory: true, checkOverlappingEntry: true, useWebWorkers: false });
  const pending = new Set<Promise<void>>();
  const entries: FolderEntry[] = []; const active = new Set<AbortController>();
  try {
    for await (const entry of reader.getEntriesGenerator()) {
      checkAbort(signal); admission.add(entry.uncompressedSize);
      const issue = pathIssue(entry.filename) ?? (entry.encrypted ? 'encrypted-unsupported' : entry.symlink ? 'symlink-unsupported' : undefined);
      const source: FolderEntry = Object.freeze({ id: `${revision}:zip:${entries.length}`, rawPath: entry.filename,
        rawFilename: entry.rawFilename.slice(), size: entry.uncompressedSize, directory: entry.directory, issue,
        open(jobSignal: AbortSignal): OpenedBytes {
          if (issue || entry.directory) throw new Error(issue ?? 'directory');
          const controller = new AbortController(); active.add(controller);
          const abort = () => controller.abort();
          signal.addEventListener('abort', abort, { once: true }); jobSignal.addEventListener('abort', abort, { once: true });
          if (signal.aborted || jobSignal.aborted) abort();
          let count = 0;
          // A zero-queue transform propagates consumer backpressure through getData's awaited writes.
          const stream = new TransformStream<Uint8Array, Uint8Array>({ transform(chunk, sink) {
            checkAbort(controller.signal); count += chunk.byteLength;
            if (chunk.byteLength > LIMITS.chunk || count > entry.uncompressedSize || count > LIMITS.entry) throw new Error('expanded-size-limit');
            sink.enqueue(chunk);
          } }, { highWaterMark: 1 }, { highWaterMark: 0 });
          const cleanup = () => { active.delete(controller); signal.removeEventListener('abort', abort); jobSignal.removeEventListener('abort', abort); };
          const done = (entry as FileEntry).getData(stream.writable, { signal: controller.signal, checkCrc32: true, checkAuthenticationCode: true,
            checkLocalDirectory: true, checkOverlappingEntry: true, useWebWorkers: false }).then(() => {
              if (count !== entry.uncompressedSize) throw new Error('expanded-size-mismatch');
            }).finally(cleanup);
          pending.add(done);
          done.finally(() => pending.delete(done)).catch(() => {});
          done.catch(() => {});
          const output = stream.readable.getReader();
          return { reader: output, done, close: async () => { controller.abort(); await output.cancel().catch(() => {});
            await pending.add(done);
          done.finally(() => pending.delete(done)).catch(() => {});
          done.catch(() => {}); output.releaseLock(); cleanup(); } };
        } });
      entries.push(source);
    }
    return { entries: Object.freeze(entries), warnings: ['empty-directory-metadata-unavailable'], close: async () => {
      for (const controller of active) controller.abort(); await Promise.allSettled([...pending]); await reader.close();
    } };
  } catch (error) { await reader.close(); throw error; }
}
