export type QrBulkStorageKind = "opfs" | "memory";

export interface QrBulkResultStorage {
  kind: QrBulkStorageKind;
  write(key: string, blob: Blob): Promise<void>;
  read(key: string): Promise<Blob>;
  clear(): Promise<void>;
}

export interface QrBulkStorageCapability {
  kind: QrBulkStorageKind;
  availableBytes?: number;
}

export async function inspectQrBulkStorage(): Promise<QrBulkStorageCapability> {
  const estimate = await navigator.storage?.estimate?.().catch(() => undefined);
  const availableBytes = estimate?.quota === undefined ? undefined : Math.max(0, estimate.quota - (estimate.usage ?? 0));
  try {
    if (!navigator.storage?.getDirectory) throw new Error("OPFS_UNAVAILABLE");
    const root = await navigator.storage.getDirectory();
    const probe = `.worklazy-qr-probe-${crypto.randomUUID()}`;
    await root.getDirectoryHandle(probe, { create: true });
    await root.removeEntry(probe, { recursive: true });
    return { kind: "opfs", availableBytes };
  } catch {
    return { kind: "memory" };
  }
}

export async function createQrBulkResultStorage(kind: QrBulkStorageKind): Promise<QrBulkResultStorage> {
  if (kind === "memory") return createMemoryStorage();
  const root = await navigator.storage.getDirectory();
  const parent = await root.getDirectoryHandle("worklazy-qr-bulk", { create: true });
  const runName = `run-${crypto.randomUUID()}`;
  const run = await parent.getDirectoryHandle(runName, { create: true });
  let cleared = false;
  return {
    kind,
    async write(key, blob) {
      if (cleared) throw new Error("RESULT_STORAGE_CLEARED");
      const file = await run.getFileHandle(key, { create: true });
      const writable = await file.createWritable();
      try {
        await writable.write(blob);
        await writable.close();
      } catch (error) {
        await writable.abort().catch(() => undefined);
        await run.removeEntry(key).catch(() => undefined);
        throw error;
      }
    },
    async read(key) {
      if (cleared) throw new Error("RESULT_STORAGE_CLEARED");
      return (await run.getFileHandle(key)).getFile();
    },
    async clear() {
      if (cleared) return;
      cleared = true;
      await parent.removeEntry(runName, { recursive: true }).catch(() => undefined);
    },
  };
}

function createMemoryStorage(): QrBulkResultStorage {
  const blobs = new Map<string, Blob>();
  return {
    kind: "memory",
    async write(key, blob) { blobs.set(key, blob); },
    async read(key) {
      const blob = blobs.get(key);
      if (!blob) throw new Error("RESULT_NOT_FOUND");
      return blob;
    },
    async clear() { blobs.clear(); },
  };
}
