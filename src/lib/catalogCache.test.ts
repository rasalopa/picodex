import { afterEach, describe, expect, it, vi } from 'vitest';
import { CATALOG_MAX_AGE_MS, readCachedCatalog, writeCachedCatalog } from './catalogCache.ts';
import { installFakeIndexedDb } from './testing/fakeIndexedDb.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

const NOW = Date.UTC(2026, 7, 10, 12, 0, 0);

describe('readCachedCatalog', () => {
  it('has nothing to offer before anything is stored', async () => {
    installFakeIndexedDb();
    expect(await readCachedCatalog('Nintendo_-_Nintendo_DS', NOW)).toBeNull();
  });

  it('returns what was stored, as fresh, right after storing it', async () => {
    installFakeIndexedDb();
    await writeCachedCatalog('Nintendo_-_Nintendo_DS', ['Mario Kart DS.png'], NOW);

    const cached = await readCachedCatalog('Nintendo_-_Nintendo_DS', NOW);
    expect(cached).toEqual({ names: ['Mario Kart DS.png'], fresh: true });
  });

  it('keeps a catalog fresh right up to the age limit', async () => {
    installFakeIndexedDb();
    await writeCachedCatalog('repo', ['a.png'], NOW);

    expect((await readCachedCatalog('repo', NOW + CATALOG_MAX_AGE_MS - 1))?.fresh).toBe(true);
  });

  it('marks a catalog stale once past the limit, but still hands it over', async () => {
    installFakeIndexedDb();
    await writeCachedCatalog('repo', ['a.png'], NOW);

    const cached = await readCachedCatalog('repo', NOW + CATALOG_MAX_AGE_MS);
    expect(cached).toEqual({ names: ['a.png'], fresh: false });
  });

  it('does not trust a catalog stamped in the future, which a corrected clock can leave behind', async () => {
    installFakeIndexedDb();
    await writeCachedCatalog('repo', ['a.png'], NOW);

    expect((await readCachedCatalog('repo', NOW - 60_000))?.fresh).toBe(false);
  });

  it('keeps catalogs of different systems apart', async () => {
    installFakeIndexedDb();
    await writeCachedCatalog('nds', ['ds.png'], NOW);
    await writeCachedCatalog('gba', ['gba.png'], NOW);

    expect((await readCachedCatalog('nds', NOW))?.names).toEqual(['ds.png']);
    expect((await readCachedCatalog('gba', NOW))?.names).toEqual(['gba.png']);
  });

  it('replaces a catalog rather than adding to it', async () => {
    installFakeIndexedDb();
    await writeCachedCatalog('repo', ['old.png'], NOW);
    await writeCachedCatalog('repo', ['new.png'], NOW);

    expect((await readCachedCatalog('repo', NOW))?.names).toEqual(['new.png']);
  });

  it('ignores a stored value of the wrong shape rather than passing it on', async () => {
    const fake = installFakeIndexedDb();
    fake.store('catalogs').set('repo', { names: 'not an array', fetchedAt: NOW });

    expect(await readCachedCatalog('repo', NOW)).toBeNull();
  });

  it('ignores a stored value with no timestamp', async () => {
    const fake = installFakeIndexedDb();
    fake.store('catalogs').set('repo', { names: ['a.png'] });

    expect(await readCachedCatalog('repo', NOW)).toBeNull();
  });

  it('offers no catalog when storage is unavailable, and storing stays quiet', async () => {
    vi.stubGlobal('indexedDB', undefined);

    expect(await readCachedCatalog('repo', NOW)).toBeNull();
    await expect(writeCachedCatalog('repo', ['a.png'], NOW)).resolves.toBeUndefined();
  });
});
