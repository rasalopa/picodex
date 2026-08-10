/**
 * Keeps the box art catalogs between sessions.
 *
 * A catalog is the full file listing of a libretro-thumbnails repository, and
 * the NDS one runs to thousands of entries. Downloading it again on every visit
 * costs a wait each time and spends one of the sixty requests an hour GitHub
 * allows an unauthenticated caller, which is the whole budget for a card with
 * several systems on it.
 *
 * New box art is added to those repositories now and then, so a stored catalog
 * is refreshed after a week. Being a few days behind only means a game that was
 * added very recently is not offered yet, and the next refresh picks it up.
 *
 * A stale catalog is still worth having: when GitHub refuses to answer, usually
 * because the hourly limit is spent, an old listing finds art for almost every
 * game and beats failing outright. So callers can ask for one explicitly.
 */

import { CATALOG_STORE, withStore } from './idb';

/** How long a stored catalog is used before being downloaded again. */
export const CATALOG_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface StoredCatalog {
  names: string[];
  /** When it was downloaded, ms since the epoch. */
  fetchedAt: number;
}

/** A catalog from the store, and whether it is still considered current. */
export interface CachedCatalog {
  names: string[];
  /** False once it is older than {@link CATALOG_MAX_AGE_MS}. */
  fresh: boolean;
}

function isStoredCatalog(value: unknown): value is StoredCatalog {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as StoredCatalog;
  return (
    Array.isArray(candidate.names) &&
    candidate.names.every((name) => typeof name === 'string') &&
    typeof candidate.fetchedAt === 'number' &&
    Number.isFinite(candidate.fetchedAt)
  );
}

/**
 * Returns the stored catalog for `repo`, or null when there is none.
 *
 * @param now Current time, injectable so tests do not depend on the clock.
 */
export async function readCachedCatalog(
  repo: string,
  now: number = Date.now(),
): Promise<CachedCatalog | null> {
  const stored = await withStore<unknown>(CATALOG_STORE, 'readonly', (store) => store.get(repo));
  if (!isStoredCatalog(stored)) return null;
  // A clock that moved backwards (a corrected system time, a different machine)
  // would otherwise make a catalog look fresh forever.
  const age = now - stored.fetchedAt;
  return { names: stored.names, fresh: age >= 0 && age < CATALOG_MAX_AGE_MS };
}

/** Stores `names` as the catalog for `repo`. */
export async function writeCachedCatalog(
  repo: string,
  names: string[],
  now: number = Date.now(),
): Promise<void> {
  const record: StoredCatalog = { names, fetchedAt: now };
  await withStore(CATALOG_STORE, 'readwrite', (store) => store.put(record, repo));
}
