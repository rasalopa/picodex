import { vi } from 'vitest';

/**
 * A stand-in for the slice of IndexedDB the app uses: named key/value stores
 * holding live objects. The real thing is not available under vitest.
 *
 * Every way it can fail is switchable, because degrading gracefully is the whole
 * point of the modules built on it — a fake that only ever succeeds would leave
 * exactly the interesting half untested. It also counts connections, so a test
 * can catch one being left open.
 */
export interface FakeOptions {
  /** `open()` throws outright, as in Firefox private browsing. */
  openThrows?: boolean;
  /** `open()` fails asynchronously. */
  openFails?: 'error' | 'blocked';
  /** The database exists without the app's stores, so they have to be created. */
  needsUpgrade?: boolean;
  /** Starting a transaction throws, e.g. on a closing connection. */
  transactionThrows?: boolean;
  /** Requests fail instead of succeeding, e.g. on a full disk. */
  requestFails?: boolean;
}

export interface FakeIndexedDb {
  /** The backing map of a store, so a test can plant or inspect values. */
  store(name: string): Map<string, unknown>;
  /** Names of stores created through an upgrade. */
  created: string[];
  /** Connections currently open; should be back to 0 after every call. */
  openConnections(): number;
}

export function installFakeIndexedDb(options: FakeOptions = {}): FakeIndexedDb {
  const stores = new Map<string, Map<string, unknown>>();
  const created: string[] = [];
  let openConnections = 0;

  const storeFor = (name: string): Map<string, unknown> => {
    let store = stores.get(name);
    if (store === undefined) {
      store = new Map<string, unknown>();
      stores.set(name, store);
    }
    return store;
  };

  function request<T>(result: T): { result: T; onsuccess?: () => void; onerror?: () => void } {
    const req = { result } as { result: T; onsuccess?: () => void; onerror?: () => void };
    queueMicrotask(() => (options.requestFails === true ? req.onerror?.() : req.onsuccess?.()));
    return req;
  }

  const db = {
    objectStoreNames: { contains: () => options.needsUpgrade !== true },
    createObjectStore: (name: string) => {
      created.push(name);
      storeFor(name);
    },
    close: () => {
      openConnections--;
    },
    transaction: (name: string) => {
      if (options.transactionThrows === true) {
        throw new DOMException('store is gone', 'NotFoundError');
      }
      const store = storeFor(name);
      return {
        objectStore: () => ({
          get: (key: string) => request(store.get(key)),
          put: (value: unknown, key: string) => {
            store.set(key, value);
            return request(undefined);
          },
          delete: (key: string) => {
            store.delete(key);
            return request(undefined);
          },
        }),
      };
    },
  };

  vi.stubGlobal('indexedDB', {
    open: () => {
      if (options.openThrows === true) {
        throw new DOMException('storage is disabled', 'InvalidStateError');
      }
      const req = {
        result: db,
        onsuccess: undefined as (() => void) | undefined,
        onerror: undefined as (() => void) | undefined,
        onupgradeneeded: undefined as (() => void) | undefined,
        onblocked: undefined as (() => void) | undefined,
      };
      queueMicrotask(() => {
        if (options.openFails === 'error') {
          req.onerror?.();
          return;
        }
        if (options.openFails === 'blocked') {
          req.onblocked?.();
          return;
        }
        openConnections++;
        if (options.needsUpgrade === true) req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
  });

  return { store: storeFor, created, openConnections: () => openConnections };
}
