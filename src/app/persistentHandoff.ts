// Same database/store are retained when additional isolated receivers are added.
const DATABASE_NAME = "worklazy-office-handoff";
const DATABASE_VERSION = 3;
const STORE_NAME = "records";
export const HANDOFF_TTL_MS = 15 * 60 * 1000;
export const HANDOFF_LIMIT = 20;
export const OFFICE_HANDOFF_PATH = "/tools/office-editor/app";
export const PERSISTENT_RECEIVERS = {
  "office-editor": OFFICE_HANDOFF_PATH,
  "document-redactor": "/tools/document-redactor",
  "document-to-pdf": "/tools/pdf-converter/document-to-pdf",
  "xls-preserve": "/tools/excel-merger/xls-preserve",
} as const;
export type PersistentReceiverId = keyof typeof PERSISTENT_RECEIVERS;
export const HANDOFF_FILE_LIMIT = 20;
export const HANDOFF_RECORD_BYTES = 500 * 1024 * 1024;
export const HANDOFF_TOTAL_BYTES = 1024 * 1024 * 1024;
export interface PersistentHandoffInput {
  receiverId: PersistentReceiverId; entryPath: string; files: File[];
}
export interface PersistentHandoffToken { id: string; nonce: string }
interface PersistentHandoffRecord extends PersistentHandoffToken {
  receiverId: PersistentReceiverId;
  entryPath: string;
  schema: 1;
  file?: File; // Existing Office schema-1 records remain readable without migration.
  files?: File[];
  createdAt: number;
  expiresAt: number;
}
export class PersistentHandoffError extends Error {
  constructor(public readonly code: "blocked" | "full" | "unavailable" | "notReceived" | "invalid") {
    super(code);
    this.name = "PersistentHandoffError";
  }
}

const pendingOpens = new Map<IDBOpenDBRequest, () => void>();
let upgradeBlocked = false;
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (upgradeBlocked) return reject(new PersistentHandoffError("blocked"));
    if (!globalThis.indexedDB) return reject(new PersistentHandoffError("unavailable"));
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    let abandoned = false;
    pendingOpens.set(request, () => {
      abandoned = true;
      reject(new PersistentHandoffError("blocked"));
    });
    const finished = () => {
      pendingOpens.delete(request);
      if (!pendingOpens.size) upgradeBlocked = false;
    };
    request.onblocked = () => {
      // Other local opens may already be queued behind this un-cancellable request.
      // Reject them as well instead of leaving a sender waiting indefinitely.
      upgradeBlocked = true;
      for (const abandon of pendingOpens.values()) abandon();
    };
    request.onupgradeneeded = () => {
      // An open request cannot be cancelled at blocked. Never perform a late upgrade
      // for an operation that already told the user to retry.
      if (abandoned) { request.transaction?.abort(); return; }
      const database = request.result;
      if (database.objectStoreNames.contains("pending-files")) database.deleteObjectStore("pending-files");
      const store = database.objectStoreNames.contains(STORE_NAME)
        ? request.transaction!.objectStore(STORE_NAME) : database.createObjectStore(STORE_NAME, { keyPath: "id" });
      if (!store.indexNames.contains("expiresAt")) store.createIndex("expiresAt", "expiresAt");
    };
    request.onsuccess = () => {
      finished();
      const database = request.result;
      database.onversionchange = () => database.close();
      if (abandoned) database.close();
      else resolve(database);
    };
    request.onerror = () => { finished(); reject(new PersistentHandoffError("unavailable")); };
  });
}

async function inTransaction<T>(action: (store: IDBObjectStore, result: (value: T) => void) => void): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      let value: T;
      let failure: unknown;
      transaction.oncomplete = () => resolve(value);
      transaction.onabort = () => reject(failure ?? new PersistentHandoffError("unavailable"));
      // Request errors abort by default; only the committed transaction can succeed.
      try { action(transaction.objectStore(STORE_NAME), (next) => { value = next; }); }
      catch (error) { failure = error; transaction.abort(); }
    });
  } finally { database.close(); }
}

function destinationMatches(receiverId: PersistentReceiverId, entryPath: string): boolean {
  return Object.hasOwn(PERSISTENT_RECEIVERS, receiverId) && PERSISTENT_RECEIVERS[receiverId] === entryPath;
}
function recordFiles(record: PersistentHandoffRecord): File[] | undefined {
  const files = record.receiverId === "office-editor" ? [record.file] : record.files;
  return Array.isArray(files) && files.length > 0 && files.every(file => file instanceof File) ? files as File[] : undefined;
}
function payloadFits(receiverId: PersistentReceiverId, files: readonly File[]): boolean {
  return files.length > 0 && files.length <= (receiverId === "office-editor" ? 1 : HANDOFF_FILE_LIMIT)
    && files.every(file => file instanceof File)
    && (receiverId === "office-editor" || files.reduce((sum, file) => sum + file.size, 0) <= HANDOFF_RECORD_BYTES);
}

// Invalid expiry values cannot be consumed and must not occupy quota forever.
function shouldPurge(record: PersistentHandoffRecord, now: number): boolean {
  return !Number.isFinite(record.expiresAt) || record.expiresAt < now;
}

/** Stage only after the sender's leave confirmation. Storage failure must prevent navigation. */
export function stagePersistentFiles(input: PersistentHandoffInput): Promise<PersistentHandoffToken> {
  const { receiverId, entryPath } = input;
  const files = [...input.files];
  if (!destinationMatches(receiverId, entryPath) || !payloadFits(receiverId, files))
    return Promise.reject(new PersistentHandoffError("invalid"));
  const bytes = files.reduce((sum, file) => sum + file.size, 0);
  const token = { id: crypto.randomUUID(), nonce: crypto.randomUUID() };
  return inTransaction<PersistentHandoffToken | undefined>((store, result) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const now = Date.now();
      const records = request.result as PersistentHandoffRecord[];
      const expired = records.filter(record => shouldPurge(record, now));
      for (const record of expired) store.delete(record.id);
      const live = records.filter(record => !shouldPurge(record, now));
      // Unknown/corrupt payloads cannot make the global byte cap undercount.
      const storedBytes = live.reduce((sum, record) => {
        const payload = recordFiles(record);
        return sum + (payload ? payload.reduce((size, file) => size + file.size, 0) : HANDOFF_TOTAL_BYTES);
      }, 0);
      if (live.length >= HANDOFF_LIMIT || storedBytes + bytes > HANDOFF_TOTAL_BYTES) {
        result(undefined); // Commit expired cleanup, preserving every live record.
        return;
      }
      store.add({ ...token, receiverId, entryPath, schema: 1,
        ...(receiverId === "office-editor" ? { file: files[0] } : { files }),
        createdAt: now, expiresAt: now + HANDOFF_TTL_MS } satisfies PersistentHandoffRecord);
      result(token);
    };
  }).then(staged => {
    if (!staged) throw new PersistentHandoffError("full");
    return staged;
  });
}

export function stagePersistentHandoff(file: File): Promise<PersistentHandoffToken> {
  // Preserve the Office public API and record shape.
  if (!(file instanceof File)) return Promise.reject(new PersistentHandoffError("unavailable"));
  return stagePersistentFiles({ receiverId: "office-editor", entryPath: OFFICE_HANDOFF_PATH, files: [file] });
}

export function consumePersistentFiles(token: PersistentHandoffToken, receiverId: PersistentReceiverId, entryPath: string): Promise<File[] | undefined> {
  if (!token || typeof token.id !== "string" || typeof token.nonce !== "string") return Promise.resolve(undefined);
  return inTransaction((store, result) => {
    result(undefined);
    const request = store.get(token.id);
    request.onsuccess = () => {
      const record = request.result as PersistentHandoffRecord | undefined;
      if (!destinationMatches(receiverId, entryPath) || !record || record.id !== token.id || record.nonce !== token.nonce || record.receiverId !== receiverId
        || record.entryPath !== entryPath || record.schema !== 1 || !Number.isFinite(record.createdAt)
        || record.expiresAt !== record.createdAt + HANDOFF_TTL_MS) return;
      const files = recordFiles(record);
      // Identity/metadata matched: retire the owned case even if its payload
      // is corrupt, so it cannot keep the shared quota occupied.
      store.delete(record.id);
      if (files && payloadFits(receiverId, files) && !(record.expiresAt < Date.now())) result(files);
    };
  });
}

export async function consumePersistentHandoff(token: PersistentHandoffToken, receiverId = "office-editor", entryPath = OFFICE_HANDOFF_PATH): Promise<File | undefined> {
  // This compatibility API must never consume a multi-file receiver's record.
  if (receiverId !== "office-editor") return undefined;
  return (await consumePersistentFiles(token, receiverId, entryPath))?.[0];
}

const tokenKey = (receiverId: PersistentReceiverId) => `worklazy-handoff-token:${receiverId}`;
/** H2 serializes send attempts. Retire the previous case before reserving quota
 * for its replacement; a failed cancellation keeps the original token usable.
 */
export async function cancelPendingPersistentHandoff(receiverId: PersistentReceiverId): Promise<void> {
  const key = tokenKey(receiverId);
  let raw: string | null;
  try { raw = sessionStorage.getItem(key); }
  catch { throw new PersistentHandoffError("unavailable"); }
  if (raw === null) return;
  let token: PersistentHandoffToken | undefined;
  try {
    const value = JSON.parse(raw);
    if (value && typeof value.id === "string" && typeof value.nonce === "string") token = value;
  } catch { /* A malformed token cannot identify a record to cancel. */ }
  if (token) await cancelPersistentHandoff(token, receiverId);
  try { if (sessionStorage.getItem(key) === raw) sessionStorage.removeItem(key); }
  catch { throw new PersistentHandoffError("unavailable"); }
}
export async function stagePendingPersistentHandoff(input: PersistentHandoffInput): Promise<void> {
  const receiverId = input.receiverId;
  const token = await stagePersistentFiles(input);
  try { sessionStorage.setItem(tokenKey(receiverId), JSON.stringify(token)); }
  catch {
    await cancelPersistentHandoff(token).catch(() => undefined);
    throw new PersistentHandoffError("unavailable");
  }
}
/** Removes the tab token synchronously, before starting any database work. */
export async function takePendingPersistentHandoff(receiverId: PersistentReceiverId, entryPath: string): Promise<File[] | undefined> {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(tokenKey(receiverId));
    sessionStorage.removeItem(tokenKey(receiverId));
  } catch { throw new PersistentHandoffError("unavailable"); }
  if (raw === null) return undefined;
  let token: PersistentHandoffToken;
  try {
    token = JSON.parse(raw);
    if (!token || typeof token.id !== "string" || typeof token.nonce !== "string") throw new Error();
  } catch { throw new PersistentHandoffError("notReceived"); }
  const files = await consumePersistentFiles(token, receiverId, entryPath);
  if (!files) throw new PersistentHandoffError("notReceived");
  return files;
}

export function purgeExpired(): Promise<void> {
  return inTransaction((store, result) => {
    // The expiry index omits missing keys and sorts non-numeric keys separately.
    // The store is bounded to 20 normal records; scan it to retire corrupt ones too.
    const now = Date.now();
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) { result(undefined); return; }
      if (shouldPurge(cursor.value, now)) cursor.delete();
      cursor.continue();
    };
  });
}

export function cancelPersistentHandoff(token: PersistentHandoffToken, receiverId?: PersistentReceiverId): Promise<void> {
  return inTransaction((store, result) => {
    const request = store.get(token.id);
    request.onsuccess = () => {
      if (request.result?.nonce === token.nonce && (receiverId === undefined || request.result.receiverId === receiverId)) store.delete(token.id);
      result(undefined);
    };
  });
}
