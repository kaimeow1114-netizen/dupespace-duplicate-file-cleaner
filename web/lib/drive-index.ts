// Device-local, optional, encrypted metadata cache. Never store OAuth credentials.
export type CachedDriveIndex = { accountKey: string; snapshot: string; expiresAt: number };
const DB_NAME = "dupespace-drive-index-v1";
const STORE = "indices";
const EPOCH_KEY = "dupespace-index-epoch";
export const INDEX_CLEARED_EVENT = "dupespace-index-cleared";

export function cacheEpoch(): string {
  try { return localStorage.getItem(EPOCH_KEY) ?? "0"; } catch { return "disabled"; }
}

export function validDriveIndex(value: unknown, key: string): value is CachedDriveIndex {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CachedDriveIndex>;
  return item.accountKey === key && typeof item.snapshot === "string" && item.snapshot.length <= 8 * 1024 * 1024 &&
    typeof item.expiresAt === "number" && item.expiresAt > Date.now();
}

function openIndex(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Index storage unavailable"));
  });
}

export async function readDriveIndex(accountKey: string): Promise<CachedDriveIndex | null> {
  let db: IDBDatabase | undefined;
  try {
    db = await openIndex();
    const value: unknown = await new Promise((resolve, reject) => {
      const request = db!.transaction(STORE).objectStore(STORE).get(accountKey);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (validDriveIndex(value, accountKey)) return value;
    await clearDriveIndex();
  } catch { /* Cache failure must not prevent a fresh scan. */ }
  finally { db?.close(); }
  return null;
}

export async function writeDriveIndex(value: CachedDriveIndex, epoch: string): Promise<void> {
  if (!validDriveIndex(value, value.accountKey) || epoch === "disabled" || cacheEpoch() !== epoch) return;
  let db: IDBDatabase | undefined;
  try {
    db = await openIndex();
    if (cacheEpoch() !== epoch) return;
    await new Promise<void>((resolve, reject) => {
      const transaction = db!.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      store.clear(); // Do not retain metadata belonging to previously connected accounts.
      store.put(value, value.accountKey);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    if (cacheEpoch() !== epoch) await clearDriveIndex();
  } catch { /* Quota/private-mode failures only disable the optimization. */ }
  finally { db?.close(); }
}

export async function clearDriveIndex(notify = false, disconnected = false): Promise<void> {
  if (notify) {
    try { localStorage.setItem(EPOCH_KEY, `${disconnected ? "signed-out:" : "clear:"}${crypto.randomUUID()}`); } catch { /* Optional storage. */ }
    window.dispatchEvent(new CustomEvent(INDEX_CLEARED_EVENT, { detail: { disconnected } }));
  }
  let db: IDBDatabase | undefined;
  try {
    db = await openIndex();
    await new Promise<void>((resolve, reject) => {
      const transaction = db!.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch { /* A browser may already have removed the cache. */ }
  finally { db?.close(); }
}

export function isIndexEpochEvent(event: StorageEvent): boolean { return event.key === EPOCH_KEY; }

export function isSessionDisconnectEvent(event: Event): boolean {
  return event instanceof StorageEvent ? isIndexEpochEvent(event) && Boolean(event.newValue?.startsWith("signed-out:"))
    : event instanceof CustomEvent && event.detail?.disconnected === true;
}
