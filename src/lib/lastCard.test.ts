import { afterEach, describe, expect, it, vi } from 'vitest';
import { forgetCard, loadLastCard, rememberCard } from './lastCard.ts';
import { installFakeIndexedDb } from './testing/fakeIndexedDb.ts';

function handle(name: string, permission?: PermissionState): FileSystemDirectoryHandle {
  return {
    name,
    kind: 'directory',
    queryPermission: permission === undefined ? undefined : () => Promise.resolve(permission),
  } as unknown as FileSystemDirectoryHandle;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadLastCard', () => {
  it('reports no card when nothing was remembered', async () => {
    installFakeIndexedDb();
    expect(await loadLastCard()).toBeNull();
  });

  it('reports no card when the browser has no IndexedDB', async () => {
    vi.stubGlobal('indexedDB', undefined);
    expect(await loadLastCard()).toBeNull();
  });

  it('returns a remembered card as ready while permission still holds', async () => {
    installFakeIndexedDb();
    await rememberCard(handle('DSPICO', 'granted'));

    const remembered = await loadLastCard();
    expect(remembered?.handle.name).toBe('DSPICO');
    expect(remembered?.ready).toBe(true);
  });

  it('returns a remembered card as not ready once permission has lapsed, so the app knows to ask', async () => {
    installFakeIndexedDb();
    await rememberCard(handle('DSPICO', 'prompt'));

    const remembered = await loadLastCard();
    expect(remembered?.handle.name).toBe('DSPICO');
    expect(remembered?.ready).toBe(false);
  });

  it('does not claim a card is ready when the browser cannot tell us', async () => {
    installFakeIndexedDb();
    await rememberCard(handle('DSPICO'));

    expect((await loadLastCard())?.ready).toBe(false);
  });

  it('treats a handle that can no longer be queried as not ready rather than failing', async () => {
    installFakeIndexedDb();
    const gone = {
      name: 'GONE',
      kind: 'directory',
      queryPermission: () => Promise.reject(new Error('card is gone')),
    } as unknown as FileSystemDirectoryHandle;
    await rememberCard(gone);

    const remembered = await loadLastCard();
    expect(remembered?.ready).toBe(false);
  });
});

describe('rememberCard', () => {
  it('replaces the previous card rather than keeping a list', async () => {
    installFakeIndexedDb();
    await rememberCard(handle('FIRST', 'granted'));
    await rememberCard(handle('SECOND', 'granted'));

    expect((await loadLastCard())?.handle.name).toBe('SECOND');
  });

  it('stays quiet when storage is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await expect(rememberCard(handle('DSPICO', 'granted'))).resolves.toBeUndefined();
  });
});

describe('forgetCard', () => {
  it('stops the card being offered again', async () => {
    installFakeIndexedDb();
    await rememberCard(handle('DSPICO', 'granted'));
    await forgetCard();

    expect(await loadLastCard()).toBeNull();
  });
});

describe('when storage misbehaves', () => {
  it('offers no card when opening the database throws, as in private browsing', async () => {
    installFakeIndexedDb({ openThrows: true });

    expect(await loadLastCard()).toBeNull();
    await expect(rememberCard(handle('DSPICO', 'granted'))).resolves.toBeUndefined();
    await expect(forgetCard()).resolves.toBeUndefined();
  });

  it('offers no card when opening the database fails', async () => {
    installFakeIndexedDb({ openFails: 'error' });
    expect(await loadLastCard()).toBeNull();
  });

  it('offers no card when another tab is holding the database open', async () => {
    installFakeIndexedDb({ openFails: 'blocked' });
    expect(await loadLastCard()).toBeNull();
  });

  it('offers no card when the store cannot be opened', async () => {
    installFakeIndexedDb({ transactionThrows: true });

    expect(await loadLastCard()).toBeNull();
    await expect(rememberCard(handle('DSPICO', 'granted'))).resolves.toBeUndefined();
  });

  it('offers no card when the read itself fails', async () => {
    installFakeIndexedDb({ requestFails: true });
    expect(await loadLastCard()).toBeNull();
  });

  it('creates the stores on the first visit', async () => {
    const fake = installFakeIndexedDb({ needsUpgrade: true });
    await loadLastCard();

    // every store is created on upgrade, so a database from an older version
    // gains the newer ones without losing what it already holds
    expect(fake.created).toEqual(['handles', 'catalogs', 'covers']);
  });

  it('leaves no database connection open behind it', async () => {
    const fake = installFakeIndexedDb();
    await rememberCard(handle('DSPICO', 'granted'));
    await loadLastCard();
    await forgetCard();

    expect(fake.openConnections()).toBe(0);
  });

  it('ignores anything in the store that is not a folder, rather than passing it on', async () => {
    const fake = installFakeIndexedDb();
    fake.store('handles').set('lastCard', { name: 'DSPICO', kind: 'file' });

    expect(await loadLastCard()).toBeNull();
  });
});
