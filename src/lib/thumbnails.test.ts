import { describe, expect, it } from 'vitest';
import {
  boxartUrl,
  catalogUrl,
  fetchCatalog,
  parseCatalog,
  type CatalogFetch,
  type CatalogResponse,
} from './thumbnails.ts';

/**
 * Synthetic GitHub git trees payload shaped like the real API response:
 * tree/blob entries for boxarts, logos and snaps plus non-PNG noise. Only the
 * two `Named_Boxarts/*.png` blobs must survive {@link parseCatalog}.
 */
const TREES_PAYLOAD = {
  sha: 'abc123',
  url: 'https://api.github.com/repos/libretro-thumbnails/Nintendo_-_Game_Boy/git/trees/abc123',
  tree: [
    { path: 'Named_Boxarts', mode: '040000', type: 'tree', sha: '1' },
    {
      path: 'Named_Boxarts/Tetris (World) (Rev 1).png',
      mode: '100644',
      type: 'blob',
      sha: '2',
    },
    {
      path: 'Named_Boxarts/Pokemon - Blue Version (USA, Europe) (SGB Enhanced).png',
      mode: '100644',
      type: 'blob',
      sha: '3',
    },
    { path: 'Named_Boxarts/Thumbs.db', mode: '100644', type: 'blob', sha: '4' },
    {
      path: 'Named_Logos/Tetris (World) (Rev 1).png',
      mode: '100644',
      type: 'blob',
      sha: '5',
    },
    {
      path: 'Named_Snaps/Tetris (World) (Rev 1).png',
      mode: '100644',
      type: 'blob',
      sha: '6',
    },
    { path: 'README.md', mode: '100644', type: 'blob', sha: '7' },
  ],
  truncated: false,
};

/** Builds a stub {@link CatalogResponse} around a JSON body. */
function stubResponse(
  body: unknown,
  init: { status?: number; statusText?: string } = {},
): CatalogResponse {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: init.statusText ?? '',
    json: () => Promise.resolve(body),
  };
}

describe('catalogUrl', () => {
  it('builds the recursive git trees API URL', () => {
    expect(catalogUrl('Nintendo_-_Game_Boy')).toBe(
      'https://api.github.com/repos/libretro-thumbnails/Nintendo_-_Game_Boy/git/trees/master?recursive=1',
    );
  });
});

describe('parseCatalog', () => {
  it('keeps only Named_Boxarts PNGs, prefix stripped', () => {
    expect(parseCatalog(TREES_PAYLOAD)).toEqual([
      'Tetris (World) (Rev 1).png',
      'Pokemon - Blue Version (USA, Europe) (SGB Enhanced).png',
    ]);
  });

  it('returns an empty array for an empty tree', () => {
    expect(parseCatalog({ tree: [] })).toEqual([]);
  });

  it('skips malformed tree entries instead of crashing', () => {
    const payload = {
      tree: [null, 42, { mode: '100644' }, { path: 123 }, { path: 'Named_Boxarts/Ok.png' }],
    };
    expect(parseCatalog(payload)).toEqual(['Ok.png']);
  });

  it('throws a descriptive error on a non-object payload', () => {
    expect(() => parseCatalog(null)).toThrow(/not a JSON object/);
    expect(() => parseCatalog('oops')).toThrow(/not a JSON object/);
  });

  it('throws a descriptive error when the tree array is missing', () => {
    expect(() => parseCatalog({ message: 'API rate limit exceeded' })).toThrow(
      /missing "tree" array/,
    );
    expect(() => parseCatalog({ tree: 'not-an-array' })).toThrow(/missing "tree" array/);
  });
});

describe('boxartUrl', () => {
  it('builds the raw.githubusercontent.com URL for a plain name', () => {
    expect(boxartUrl('Nintendo_-_Game_Boy', 'Tetris.png')).toBe(
      'https://raw.githubusercontent.com/libretro-thumbnails/Nintendo_-_Game_Boy/master/Named_Boxarts/Tetris.png',
    );
  });

  it('percent-encodes spaces, commas and ampersands in the name', () => {
    // Real No-Intro names: spaces and parentheses everywhere, commas in
    // region lists, ampersands in titles.
    expect(
      boxartUrl('Nintendo_-_Game_Boy', 'Pokemon - Blue Version (USA, Europe) (SGB Enhanced).png'),
    ).toBe(
      'https://raw.githubusercontent.com/libretro-thumbnails/Nintendo_-_Game_Boy' +
        '/master/Named_Boxarts/Pokemon%20-%20Blue%20Version%20(USA%2C%20Europe)%20(SGB%20Enhanced).png',
    );
    expect(boxartUrl('Sega_-_Mega_Drive_-_Genesis', 'Sonic & Knuckles (World).png')).toBe(
      'https://raw.githubusercontent.com/libretro-thumbnails/Sega_-_Mega_Drive_-_Genesis' +
        '/master/Named_Boxarts/Sonic%20%26%20Knuckles%20(World).png',
    );
  });

  it('keeps the encoded name a single path segment', () => {
    // A slash in a name must never create an extra URL segment.
    const url = boxartUrl('Repo', 'Weird/Name.png');
    expect(url.endsWith('/Named_Boxarts/Weird%2FName.png')).toBe(true);
  });
});

describe('fetchCatalog', () => {
  it('fetches the catalog URL and returns parsed boxart names', async () => {
    const requested: string[] = [];
    const fetchFn: CatalogFetch = (url) => {
      requested.push(url);
      return Promise.resolve(stubResponse(TREES_PAYLOAD));
    };

    const catalog = await fetchCatalog('Nintendo_-_Game_Boy', fetchFn);

    expect(requested).toEqual([catalogUrl('Nintendo_-_Game_Boy')]);
    expect(catalog).toEqual([
      'Tetris (World) (Rev 1).png',
      'Pokemon - Blue Version (USA, Europe) (SGB Enhanced).png',
    ]);
  });

  it('throws a descriptive error on a non-200 response', async () => {
    const fetchFn: CatalogFetch = () =>
      Promise.resolve(
        stubResponse(
          { message: 'API rate limit exceeded' },
          { status: 403, statusText: 'Forbidden' },
        ),
      );

    await expect(fetchCatalog('Nintendo_-_Game_Boy', fetchFn)).rejects.toThrow(
      'GitHub trees request for "Nintendo_-_Game_Boy" failed: HTTP 403 Forbidden ' +
        '(https://api.github.com/repos/libretro-thumbnails/Nintendo_-_Game_Boy/git/trees/master?recursive=1)',
    );
  });

  it('omits the status text from the error when it is empty (HTTP/2)', async () => {
    const fetchFn: CatalogFetch = () => Promise.resolve(stubResponse(null, { status: 404 }));

    await expect(fetchCatalog('Nope', fetchFn)).rejects.toThrow(/failed: HTTP 404 \(/);
  });

  it('propagates payload-shape errors from parseCatalog', async () => {
    const fetchFn: CatalogFetch = () => Promise.resolve(stubResponse({ message: 'Not Found' }));

    await expect(fetchCatalog('Nope', fetchFn)).rejects.toThrow(/missing "tree" array/);
  });
});
