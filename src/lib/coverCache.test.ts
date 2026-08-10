import { afterEach, describe, expect, it, vi } from 'vitest';
import { readCachedCover, writeCachedCover } from './coverCache.ts';
import { installFakeIndexedDb } from './testing/fakeIndexedDb.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A file with a chosen size and last-modified time; contents do not matter. */
function file(name: string, size: number, lastModified: number): File {
  return new File(['x'.repeat(size)], name, { lastModified });
}

function preview(marker = 'png'): Blob {
  return new Blob([marker], { type: 'image/png' });
}

async function text(blob: Blob | null): Promise<string | null> {
  return blob === null ? null : blob.text();
}

describe('readCachedCover', () => {
  it('has nothing to offer before anything is stored', async () => {
    installFakeIndexedDb();
    expect(await readCachedCover('DSPICO', 'nds', 'ABCD.bmp', file('ABCD.bmp', 10, 1))).toBeNull();
  });

  it('returns the preview stored for a file that has not changed', async () => {
    installFakeIndexedDb();
    const f = file('ABCD.bmp', 10, 1000);
    await writeCachedCover('DSPICO', 'nds', 'ABCD.bmp', f, preview('the-cover'));

    expect(await text(await readCachedCover('DSPICO', 'nds', 'ABCD.bmp', f))).toBe('the-cover');
  });

  it('ignores the stored preview once the file has been rewritten', async () => {
    installFakeIndexedDb();
    await writeCachedCover('DSPICO', 'nds', 'ABCD.bmp', file('ABCD.bmp', 10, 1000), preview());

    // same name, later timestamp: a regenerated cover
    const rewritten = file('ABCD.bmp', 10, 2000);
    expect(await readCachedCover('DSPICO', 'nds', 'ABCD.bmp', rewritten)).toBeNull();
  });

  it('ignores the stored preview once the file has changed size', async () => {
    installFakeIndexedDb();
    await writeCachedCover('DSPICO', 'nds', 'ABCD.bmp', file('ABCD.bmp', 10, 1000), preview());

    const resized = file('ABCD.bmp', 20, 1000);
    expect(await readCachedCover('DSPICO', 'nds', 'ABCD.bmp', resized)).toBeNull();
  });

  it('keeps a game whose name matches a gamecode from reading its picture', async () => {
    installFakeIndexedDb();
    const f = file('ABCD.bmp', 10, 1000);
    await writeCachedCover('DSPICO', 'nds', 'ABCD.bmp', f, preview('gamecode'));
    await writeCachedCover('DSPICO', 'user', 'ABCD.bmp', f, preview('user-named'));

    expect(await text(await readCachedCover('DSPICO', 'nds', 'ABCD.bmp', f))).toBe('gamecode');
    expect(await text(await readCachedCover('DSPICO', 'user', 'ABCD.bmp', f))).toBe('user-named');
  });

  it('keeps two cards with the same file name apart', async () => {
    installFakeIndexedDb();
    const f = file('ABCD.bmp', 10, 1000);
    await writeCachedCover('CARD-A', 'nds', 'ABCD.bmp', f, preview('from-a'));
    await writeCachedCover('CARD-B', 'nds', 'ABCD.bmp', f, preview('from-b'));

    expect(await text(await readCachedCover('CARD-A', 'nds', 'ABCD.bmp', f))).toBe('from-a');
    expect(await text(await readCachedCover('CARD-B', 'nds', 'ABCD.bmp', f))).toBe('from-b');
  });

  it('keeps keys apart when label, slot and name would concatenate the same', async () => {
    installFakeIndexedDb();
    const f = file('x', 1, 1);
    // Without a separator both keys collapse to 'DSPICOndsgba.bmp', so the
    // second write would clobber the first; the NUL between the fields is the
    // only thing keeping them distinct. Drop it and this test fails.
    await writeCachedCover('DSPICO', 'nds', 'gba.bmp', f, preview('left'));
    await writeCachedCover('DSPICOnds', 'gba', '.bmp', f, preview('right'));

    expect(await text(await readCachedCover('DSPICO', 'nds', 'gba.bmp', f))).toBe('left');
    expect(await text(await readCachedCover('DSPICOnds', 'gba', '.bmp', f))).toBe('right');
  });

  it('replaces the stored preview rather than keeping the old one', async () => {
    installFakeIndexedDb();
    const f = file('ABCD.bmp', 10, 1000);
    await writeCachedCover('DSPICO', 'nds', 'ABCD.bmp', f, preview('first'));
    await writeCachedCover('DSPICO', 'nds', 'ABCD.bmp', f, preview('second'));

    expect(await text(await readCachedCover('DSPICO', 'nds', 'ABCD.bmp', f))).toBe('second');
  });

  it('ignores a stored value of the wrong shape rather than passing it on', async () => {
    const fake = installFakeIndexedDb();
    const f = file('ABCD.bmp', 10, 1000);
    // size and lastModified match the file, so the freshness check passes and
    // only the isStoredCover blob guard can reject this: drop that guard and
    // the test must fail, not stay green.
    const key = ['DSPICO', 'nds', 'ABCD.bmp'].join('\u0000');
    fake.store('covers').set(key, { blob: 'not a blob', size: 10, lastModified: 1000 });

    expect(await readCachedCover('DSPICO', 'nds', 'ABCD.bmp', f)).toBeNull();
  });

  it('offers nothing and stays quiet when storage is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const f = file('ABCD.bmp', 10, 1000);

    expect(await readCachedCover('DSPICO', 'nds', 'ABCD.bmp', f)).toBeNull();
    await expect(
      writeCachedCover('DSPICO', 'nds', 'ABCD.bmp', f, preview()),
    ).resolves.toBeUndefined();
  });
});
