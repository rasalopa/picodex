/**
 * Remembers the card you were last working on, so a return visit is one click
 * instead of the folder picker plus a full rescan.
 *
 * Why IndexedDB and not localStorage
 * ----------------------------------
 * What has to survive is a `FileSystemDirectoryHandle`, the browser's own token
 * for "this folder, with this permission". It is structured-cloneable but not
 * serialisable, so `JSON.stringify` turns it into `{}` and localStorage cannot
 * hold it. IndexedDB stores the live object.
 *
 * The handle alone is not access. Permission is granted per visit, and asking
 * for it again needs a user gesture, so reopening is deliberately two steps:
 * `loadLastCard` reads the handle and reports whether it is still usable
 * (`ready`), and only when it is not does the app need a click to ask. Nothing
 * here ever prompts on its own.
 *
 * Everything degrades to "no remembered card" rather than throwing: private
 * windows, disabled storage and cleared site data are all normal, and none of
 * them is worth an error message on a tool whose main job is elsewhere.
 */

const DB_NAME = 'picodex';
const DB_VERSION = 1;
const STORE = 'handles';
const KEY = 'lastCard';

/** A remembered card and whether it can be read without asking the user again. */
export interface LastCard {
  handle: FileSystemDirectoryHandle;
  /** True when permission is still granted, so the card can be opened silently. */
  ready: boolean;
}

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
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return openDb().then((db) => {
    if (db === null) return null;
    return new Promise<T | null>((resolve) => {
      let request: IDBRequest<T>;
      try {
        request = run(db.transaction(STORE, mode).objectStore(STORE));
      } catch {
        db.close();
        resolve(null);
        return;
      }
      request.onsuccess = () => {
        resolve(request.result ?? null);
        db.close();
      };
      request.onerror = () => {
        resolve(null);
        db.close();
      };
    });
  });
}

/** Remembers `handle` as the card to offer on the next visit. */
export async function rememberCard(handle: FileSystemDirectoryHandle): Promise<void> {
  await withStore('readwrite', (store) => store.put(handle, KEY));
}

/** Drops the remembered card, so the next visit starts with the picker. */
export async function forgetCard(): Promise<void> {
  await withStore('readwrite', (store) => store.delete(KEY));
}

/**
 * Whatever comes back out of the store is whatever some past version of PicoDex
 * put in, so it is checked rather than trusted: a stale shape would otherwise
 * reach the app as a handle and fail somewhere far from here.
 */
function isDirectoryHandle(value: unknown): value is FileSystemDirectoryHandle {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as FileSystemHandle).kind === 'directory' &&
    typeof (value as FileSystemDirectoryHandle).name === 'string'
  );
}

/**
 * Returns the remembered card, or null when there is none. Only queries the
 * permission, never asks for it, so this is safe to call on page load.
 */
export async function loadLastCard(): Promise<LastCard | null> {
  const stored = await withStore<unknown>('readonly', (store) => store.get(KEY));
  if (!isDirectoryHandle(stored)) {
    return null;
  }
  if (typeof stored.queryPermission !== 'function') {
    return { handle: stored, ready: false };
  }
  try {
    const state = await stored.queryPermission({ mode: 'readwrite' });
    return { handle: stored, ready: state === 'granted' };
  } catch {
    // handle for a card that is no longer around
    return { handle: stored, ready: false };
  }
}
