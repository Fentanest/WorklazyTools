const DATABASE_NAME = "worklazy-office-handoff";
const STORE_NAME = "pending-files";
const PENDING_KEY = "office-editor";
const MAX_PENDING_AGE_MS = 15 * 60 * 1000;

interface PendingOfficeFile {
  file: File;
  createdAt: number;
}

export async function stagePendingOfficeFile(file: File) {
  const database = await openDatabase();
  try {
    await transactionPromise(database, "readwrite", (store) => store.put({ file, createdAt: Date.now() } satisfies PendingOfficeFile, PENDING_KEY));
  } finally {
    database.close();
  }
}

export async function takePendingOfficeFile() {
  const database = await openDatabase();
  try {
    const pending = await transactionPromise<PendingOfficeFile | undefined>(database, "readwrite", (store) => {
      const request = store.get(PENDING_KEY);
      store.delete(PENDING_KEY);
      return request;
    });
    if (!pending || !(pending.file instanceof File) || Date.now() - pending.createdAt > MAX_PENDING_AGE_MS) return undefined;
    return pending.file;
  } finally {
    database.close();
  }
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("browser-storage-unavailable"));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("browser-storage-unavailable"));
  });
}

function transactionPromise<T = IDBValidKey>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T> | undefined,
) {
  return new Promise<T | undefined>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    let request: IDBRequest<T> | undefined;
    try {
      request = action(transaction.objectStore(STORE_NAME));
    } catch {
      reject(new Error("browser-storage-unavailable"));
      return;
    }
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onerror = () => reject(new Error("browser-storage-unavailable"));
    transaction.onabort = () => reject(new Error("browser-storage-unavailable"));
  });
}
