/**
 * The little bit of IndexedDB the app needs: a key/value store that survives
 * reloads, for the things a return visit should not have to fetch or pick again.
 *
 * Everything degrades to "nothing stored" rather than throwing. Private windows,
 * disabled storage, a database another tab is upgrading and a quota that is full
 * are all normal, and none of them is worth an error message in a tool whose job
 * is elsewhere: the caller simply does what it would have done on a first visit.
 */

const DB_NAME = 'picodex';

/**
 * Bump when adding a store. Every store is created on upgrade, so an older
 * database gains the new ones without losing what it already holds.
 */
const DB_VERSION = 3;

/** Directory handles of cards, so a return visit can skip the folder picker. */
export const HANDLE_STORE = 'handles';

/** Box art catalogs, so they are not re-downloaded every session. */
export const CATALOG_STORE = 'catalogs';

/** Decoded cover previews, so a gallery is not re-decoded every time it opens. */
export const COVER_STORE = 'covers';

const STORES = [HANDLE_STORE, CATALOG_STORE, COVER_STORE] as const;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

/**
 * Runs one request against one store and closes the connection behind it.
 *
 * @returns What the request produced, or `null` if anything at all went wrong.
 */
export function withStore<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest,
): Promise<T | null> {
  return openDb().then((db) => {
    if (db === null) return null;
    return new Promise<T | null>((resolve) => {
      let request: IDBRequest;
      try {
        request = run(db.transaction(store, mode).objectStore(store));
      } catch {
        db.close();
        resolve(null);
        return;
      }
      request.onsuccess = () => {
        resolve((request.result as T | undefined) ?? null);
        db.close();
      };
      request.onerror = () => {
        resolve(null);
        db.close();
      };
    });
  });
}
