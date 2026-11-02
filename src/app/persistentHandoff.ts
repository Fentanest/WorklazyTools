// Same database/store are retained when additional isolated receivers are added.
const DATABASE_NAME = "worklazy-office-handoff";
const DATABASE_VERSION = 2;
const STORE_NAME = "records";
export const HANDOFF_TTL_MS = 15 * 60 * 1000;
export const HANDOFF_LIMIT = 20;
export const OFFICE_HANDOFF_PATH = "/tools/office-editor/app";
export interface PersistentHandoffToken { id: string; nonce: string }
interface PersistentHandoffRecord extends PersistentHandoffToken {
  receiverId: "office-editor";
  entryPath: string;
  schema: 1;
  file: File;
  createdAt: number;
  expiresAt: number;
}
export class PersistentHandoffError extends Error {
  constructor(public readonly code: "blocked" | "full" | "unavailable" | "notReceived") {
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
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "id" });
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

export function stagePersistentHandoff(file: File): Promise<PersistentHandoffToken> {
  if (!(file instanceof File)) return Promise.reject(new PersistentHandoffError("unavailable"));
  const token = { id: crypto.randomUUID(), nonce: crypto.randomUUID() };
  return inTransaction<PersistentHandoffToken | undefined>((store, result) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const now = Date.now();
      const records = request.result as PersistentHandoffRecord[];
      const expired = records.filter((record) => record.expiresAt < now).sort((a, b) => a.expiresAt - b.expiresAt);
      for (const record of expired) store.delete(record.id);
      if (records.length - expired.length >= HANDOFF_LIMIT) {
        // Commit the expired-record cleanup but leave all live records untouched.
        result(undefined);
        return;
      }
      store.add({ ...token, receiverId: "office-editor", entryPath: OFFICE_HANDOFF_PATH, schema: 1,
        file, createdAt: now, expiresAt: now + HANDOFF_TTL_MS } satisfies PersistentHandoffRecord);
      result(token);
    };
  }).then((staged) => {
    if (!staged) throw new PersistentHandoffError("full");
    return staged;
  });
}

export function consumePersistentHandoff(token: PersistentHandoffToken, receiverId = "office-editor", entryPath = OFFICE_HANDOFF_PATH): Promise<File | undefined> {
  return inTransaction((store, result) => {
    result(undefined);
    const request = store.get(token.id);
    request.onsuccess = () => {
      const record = request.result as PersistentHandoffRecord | undefined;
      if (!record || record.id !== token.id || record.nonce !== token.nonce || record.receiverId !== receiverId
        || record.entryPath !== entryPath || record.schema !== 1 || !Number.isFinite(record.createdAt)
        || record.expiresAt !== record.createdAt + HANDOFF_TTL_MS || record.expiresAt < Date.now()
        || !(record.file instanceof File)) return;
      store.delete(record.id);
      result(record.file);
    };
  });
}

export function purgeExpired(): Promise<void> {
  return inTransaction((store, result) => {
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) { result(undefined); return; }
      if (cursor.value.expiresAt < Date.now()) cursor.delete();
      cursor.continue();
    };
  });
}

export function cancelPersistentHandoff(token: PersistentHandoffToken): Promise<void> {
  return inTransaction((store, result) => {
    const request = store.get(token.id);
    request.onsuccess = () => {
      if (request.result?.nonce === token.nonce) store.delete(token.id);
      result(undefined);
    };
  });
}
