import { GeneratorError } from './errors.ts';
export const GENERATOR_MEMORY_LIMIT = 200 * 1024 * 1024;
export interface GeneratorStorage {
  kind: 'memory' | 'opfs';
  fallback: boolean;
  /** Advisory estimate captured at creation; not an actual quota/heap guarantee. */
  availableBytes?: number;
  write(key: string, blob: Blob): Promise<void>;
  read(key: string): Promise<Blob>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}
export function assertGeneratorMemoryCapacity(current: number, incoming: number) {
  if (!Number.isSafeInteger(current) || !Number.isSafeInteger(incoming) || current < 0 || incoming < 0 || current + incoming > GENERATOR_MEMORY_LIMIT) {
    throw new GeneratorError('STORAGE_LIMIT');
  }
}
export function createGeneratorMemoryStorage(fallback = true): GeneratorStorage {
  const blobs = new Map<string, Blob>();
  let bytes = 0;
  let cleared = false;
  return {
    kind: 'memory', fallback,
    async write(key, blob) {
      if (cleared || blobs.has(key)) throw new GeneratorError('STORAGE_WRITE');
      assertGeneratorMemoryCapacity(bytes, blob.size);
      blobs.set(key, blob); bytes += blob.size;
    },
    async read(key) { const blob = blobs.get(key); if (!blob || cleared) throw new GeneratorError('STORAGE_READ'); return blob; },
    async remove(key) { const blob = blobs.get(key); if (blob) bytes -= blob.size; blobs.delete(key); },
    async clear() { cleared = true; blobs.clear(); bytes = 0; },
  };
}
export interface GeneratorStoragePlatform {
  getDirectory?(): Promise<FileSystemDirectoryHandle>;
  estimate?(): Promise<StorageEstimate>;
}
export async function createGeneratorStorage(platform: GeneratorStoragePlatform | undefined = globalThis.navigator?.storage): Promise<GeneratorStorage> {
  let parent: FileSystemDirectoryHandle;
  let run: FileSystemDirectoryHandle;
  const runName = `run-${crypto.randomUUID()}`;
  const estimate = await platform?.estimate?.().catch(() => undefined);
  try {
    if (!platform?.getDirectory) return createGeneratorMemoryStorage();
    const root = await platform.getDirectory();
    parent = await root.getDirectoryHandle('worklazy-document-generator', {create: true});
    run = await parent.getDirectoryHandle(runName, {create: true});
  } catch { return createGeneratorMemoryStorage(); }
  let cleared = false;
  const keys = new Set<string>();
  const active = new Set<Promise<unknown>>();
  function own<T>(promise: Promise<T>): Promise<T> {
    active.add(promise);
    void promise.finally(() => active.delete(promise)).catch(() => undefined);
    return promise;
  }
  return {
    kind: 'opfs', fallback: false,
    availableBytes: estimate?.quota === undefined ? undefined : Math.max(0, estimate.quota - (estimate.usage ?? 0)),
    write(key, blob) {
      return own((async () => {
        if (cleared || keys.has(key) || !/^row-\d+$/.test(key)) throw new GeneratorError('STORAGE_WRITE');
        let writable: FileSystemWritableFileStream | undefined;
        try {
          const file = await run.getFileHandle(key, {create: true});
          writable = await file.createWritable();
          await writable.write(blob);
          await writable.close();
          if (cleared) { await run.removeEntry(key); throw new GeneratorError('STORAGE_WRITE'); }
          keys.add(key);
        } catch (error) {
          await writable?.abort().catch(() => undefined);
          await run.removeEntry(key).catch(() => undefined);
          throw new GeneratorError(error instanceof DOMException && error.name === 'QuotaExceededError' ? 'STORAGE_LIMIT' : 'STORAGE_WRITE');
        }
      })());
    },
    read(key) {
      return own((async () => {
        if (cleared || !keys.has(key)) throw new GeneratorError('STORAGE_READ');
        try { return await (await run.getFileHandle(key)).getFile(); }
        catch { throw new GeneratorError('STORAGE_READ'); }
      })());
    },
    async remove(key) { keys.delete(key); if (!cleared) await run.removeEntry(key).catch(() => undefined); },
    async clear() {
      if (cleared) return;
      cleared = true;
      // File writes cannot be assumed canceled: keep ownership until settlement.
      await Promise.allSettled([...active]);
      keys.clear();
      await parent.removeEntry(runName, {recursive: true}).catch(() => undefined);
    },
  };
}
