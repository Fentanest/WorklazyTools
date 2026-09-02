import type {
  VideoOpfsResultReference,
  VideoResultData,
  VideoResultStorageSession,
  VideoWorkerOutput,
} from "./types";

export const VIDEO_RESULT_STORAGE_ROOT = "worklazy-video-results-v1";
export const VIDEO_RESULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const VIDEO_RESULT_QUOTA_BLOB_FALLBACK_BYTES = 128 * 1024 * 1024;

const OWNER_FILE_NAME = ".owner.json";
const LEASE_FILE_NAME = ".lease.json";
const SESSION_PREFIX = "session-";
const QUOTA_RESERVE_BYTES = 16 * 1024 * 1024;

interface VideoResultOwnerRecord {
  sessionId: string;
  ownerId: string;
  createdAt: number;
}

interface VideoResultLeaseRecord {
  expiresAt: number;
}

interface StorageManagerLike {
  getDirectory?: () => Promise<FileSystemDirectoryHandle>;
  estimate?: () => Promise<StorageEstimate>;
}

interface DirectoryHandleWithEntries {
  entries?: () => AsyncIterableIterator<[string, FileSystemHandle]>;
}

export interface VideoResultStorageOptions {
  storage?: StorageManagerLike;
  now?: number;
  createId?: () => string;
}

export type VideoStorageQuotaState = "enough" | "insufficient" | "unknown";

export async function createVideoResultStorageSession(options: VideoResultStorageOptions = {}): Promise<VideoResultStorageSession> {
  const now = options.now ?? Date.now();
  const createId = options.createId ?? createStorageId;
  const sessionId = createId();
  const ownerId = createId();
  const session: VideoResultStorageSession = {
    mode: "memory",
    rootDirectoryName: VIDEO_RESULT_STORAGE_ROOT,
    sessionDirectoryName: `${SESSION_PREFIX}${now}-${sessionId}`,
    sessionId,
    ownerId,
    createdAt: now,
    expiresAt: now + VIDEO_RESULT_SESSION_TTL_MS,
  };
  const storage = options.storage ?? getBrowserStorageManager();
  if (!storage?.getDirectory) return session;

  let rootDirectory: FileSystemDirectoryHandle | undefined;
  try {
    const storageRoot = await storage.getDirectory();
    rootDirectory = await storageRoot.getDirectoryHandle(session.rootDirectoryName, { create: true });
    await cleanupStaleVideoResultSessions(rootDirectory, now);
    const sessionDirectory = await rootDirectory.getDirectoryHandle(session.sessionDirectoryName, { create: true });
    await writeJsonFile(sessionDirectory, OWNER_FILE_NAME, {
      sessionId: session.sessionId,
      ownerId: session.ownerId,
      createdAt: session.createdAt,
    } satisfies VideoResultOwnerRecord);
    await writeJsonFile(sessionDirectory, LEASE_FILE_NAME, { expiresAt: session.expiresAt } satisfies VideoResultLeaseRecord);
    return { ...session, mode: "opfs" };
  } catch {
    if (rootDirectory) await rootDirectory.removeEntry(session.sessionDirectoryName, { recursive: true }).catch(() => undefined);
    return session;
  }
}

export async function cleanupStaleVideoResultSessions(rootDirectory: FileSystemDirectoryHandle, now = Date.now()) {
  const entries = (rootDirectory as DirectoryHandleWithEntries).entries?.();
  if (!entries) return 0;
  let removed = 0;
  for await (const [name, handle] of entries) {
    if (handle.kind !== "directory" || !name.startsWith(SESSION_PREFIX)) continue;
    const sessionDirectory = handle as FileSystemDirectoryHandle;
    const owner = await readJsonFile<VideoResultOwnerRecord>(sessionDirectory, OWNER_FILE_NAME);
    const lease = await readJsonFile<VideoResultLeaseRecord>(sessionDirectory, LEASE_FILE_NAME);
    const createdAtFromName = Number(name.slice(SESSION_PREFIX.length).split("-", 1)[0]);
    const fallbackExpiry = Number.isFinite(createdAtFromName) ? createdAtFromName + VIDEO_RESULT_SESSION_TTL_MS : Number.POSITIVE_INFINITY;
    const expiresAt = Number.isFinite(lease?.expiresAt) ? lease!.expiresAt : Number.isFinite(owner?.createdAt) ? owner!.createdAt + VIDEO_RESULT_SESSION_TTL_MS : fallbackExpiry;
    if (expiresAt > now) continue;
    try {
      await rootDirectory.removeEntry(name, { recursive: true });
      removed += 1;
    } catch {
      // Another tab may have removed the same expired session first.
    }
  }
  return removed;
}

export async function refreshVideoResultStorageSession(session: VideoResultStorageSession, now = Date.now()) {
  if (session.mode !== "opfs") return session;
  const sessionDirectory = await openVideoResultSessionDirectory(session);
  const expiresAt = now + VIDEO_RESULT_SESSION_TTL_MS;
  await writeJsonFile(sessionDirectory, LEASE_FILE_NAME, { expiresAt } satisfies VideoResultLeaseRecord);
  session.expiresAt = expiresAt;
  return session;
}

export async function resolveVideoResultFile(output: VideoWorkerOutput): Promise<File> {
  if (output.data.kind === "file") return output.data.file;
  if (output.data.kind === "buffer") {
    return new File([output.data.buffer], output.fileName, { type: output.mimeType, lastModified: Date.now() });
  }
  const sessionDirectory = await openOwnedReferenceDirectory(output.data);
  const fileHandle = await sessionDirectory.getFileHandle(output.data.entryName);
  const file = await fileHandle.getFile();
  return new File([file], output.fileName, { type: output.mimeType || file.type, lastModified: file.lastModified });
}

export async function cleanupPartialVideoResults(session: VideoResultStorageSession, keepEntryNames: Iterable<string> = []) {
  if (session.mode !== "opfs") return 0;
  const sessionDirectory = await openVideoResultSessionDirectory(session);
  const entries = (sessionDirectory as DirectoryHandleWithEntries).entries?.();
  if (!entries) return 0;
  const keep = new Set([OWNER_FILE_NAME, LEASE_FILE_NAME, ...keepEntryNames]);
  let removed = 0;
  for await (const [name] of entries) {
    if (keep.has(name)) continue;
    if (await removeResultEntryAfterWorkerRelease(sessionDirectory, name)) removed += 1;
  }
  return removed;
}

async function removeResultEntryAfterWorkerRelease(directory: FileSystemDirectoryHandle, name: string) {
  for (const retryDelay of [0, 50, 150, 500]) {
    if (retryDelay) await new Promise<void>((resolve) => globalThis.setTimeout(resolve, retryDelay));
    try {
      await directory.removeEntry(name, { recursive: true });
      return true;
    } catch {
      // A terminated worker can retain its file lock briefly while the browser releases the worker scope.
    }
  }
  return false;
}

export async function releaseVideoResultStorageSession(session: VideoResultStorageSession) {
  if (session.mode !== "opfs") return false;
  const storage = getBrowserStorageManager();
  if (!storage?.getDirectory) return false;
  try {
    const storageRoot = await storage.getDirectory();
    const rootDirectory = await storageRoot.getDirectoryHandle(session.rootDirectoryName);
    const sessionDirectory = await rootDirectory.getDirectoryHandle(session.sessionDirectoryName);
    if (!await sessionDirectoryIsOwned(sessionDirectory, session)) return false;
    await rootDirectory.removeEntry(session.sessionDirectoryName, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

export async function estimateVideoStorageQuota(requiredBytes: number, storage: StorageManagerLike | undefined = getBrowserStorageManager()): Promise<VideoStorageQuotaState> {
  if (!storage?.estimate || !Number.isFinite(requiredBytes) || requiredBytes < 0) return "unknown";
  try {
    const estimate = await storage.estimate();
    if (!Number.isFinite(estimate.quota) || !Number.isFinite(estimate.usage)) return "unknown";
    const available = Math.max(0, estimate.quota! - estimate.usage!);
    const reserve = Math.max(QUOTA_RESERVE_BYTES, Math.ceil(requiredBytes * 0.05));
    return available >= requiredBytes + reserve ? "enough" : "insufficient";
  } catch {
    return "unknown";
  }
}

export function canFallbackToBlobAfterQuotaFailure(size: number) {
  return Number.isFinite(size) && size >= 0 && size <= VIDEO_RESULT_QUOTA_BLOB_FALLBACK_BYTES;
}

export function isStorageQuotaError(error: unknown) {
  const name = error instanceof DOMException ? error.name : error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  return name === "QuotaExceededError" || /quota|storage space|disk full|not enough space/i.test(message);
}

export function opfsEntryNames(outputs: Iterable<{ data: VideoResultData }>) {
  const names: string[] = [];
  for (const output of outputs) if (output.data.kind === "opfs") names.push(output.data.entryName);
  return names;
}

export function createOpfsResultReference(session: VideoResultStorageSession, entryName: string): VideoOpfsResultReference {
  return {
    kind: "opfs",
    rootDirectoryName: session.rootDirectoryName,
    sessionDirectoryName: session.sessionDirectoryName,
    sessionId: session.sessionId,
    ownerId: session.ownerId,
    entryName,
  };
}

export function createVideoResultEntryName(fileName: string, createId = createStorageId) {
  const extensionMatch = /\.([a-z0-9]{1,8})$/i.exec(fileName);
  const extension = extensionMatch ? `.${extensionMatch[1].toLowerCase()}` : "";
  return `result-${createId()}${extension}`;
}

async function openOwnedReferenceDirectory(reference: VideoOpfsResultReference) {
  return openVideoResultSessionDirectory({ ...reference, mode: "opfs", createdAt: 0, expiresAt: 0 });
}

export async function openVideoResultSessionDirectory(session: VideoResultStorageSession) {
  const storage = getBrowserStorageManager();
  if (!storage?.getDirectory) throw new Error("Video result storage is unavailable");
  const storageRoot = await storage.getDirectory();
  const rootDirectory = await storageRoot.getDirectoryHandle(session.rootDirectoryName);
  const sessionDirectory = await rootDirectory.getDirectoryHandle(session.sessionDirectoryName);
  if (!await sessionDirectoryIsOwned(sessionDirectory, session)) throw new Error("Video result storage ownership does not match");
  return sessionDirectory;
}

async function sessionDirectoryIsOwned(sessionDirectory: FileSystemDirectoryHandle, session: Pick<VideoResultStorageSession, "sessionId" | "ownerId">) {
  const owner = await readJsonFile<VideoResultOwnerRecord>(sessionDirectory, OWNER_FILE_NAME);
  return owner?.sessionId === session.sessionId && owner.ownerId === session.ownerId;
}

async function writeJsonFile(directory: FileSystemDirectoryHandle, name: string, value: unknown) {
  const fileHandle = await directory.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(JSON.stringify(value));
    await writable.close();
  } catch (error) {
    await writable.abort?.().catch(() => undefined);
    throw error;
  }
}

async function readJsonFile<Type>(directory: FileSystemDirectoryHandle, name: string): Promise<Type | undefined> {
  try {
    const fileHandle = await directory.getFileHandle(name);
    const file = await fileHandle.getFile();
    return JSON.parse(await file.text()) as Type;
  } catch {
    return undefined;
  }
}

function getBrowserStorageManager(): StorageManagerLike | undefined {
  return typeof navigator !== "undefined" ? navigator.storage : undefined;
}

function createStorageId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
