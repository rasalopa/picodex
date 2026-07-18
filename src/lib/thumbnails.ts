/**
 * Access helpers for the libretro-thumbnails GitHub organization
 * (https://github.com/libretro-thumbnails), the boxart source used to fill in
 * missing DSpico covers.
 *
 * Each console has its own repository (e.g. `Nintendo_-_Game_Boy`) whose
 * `Named_Boxarts/` directory holds one PNG per game, named after the No-Intro
 * title. The catalog of available boxarts is listed through the GitHub git
 * trees API and individual images are downloaded from raw.githubusercontent.com.
 *
 * Mirrors `tools/fetch_covers.py` (`fetch_catalog` and its raw URL scheme)
 * from the pico-enhanced reference tooling.
 */

/** Path prefix inside every libretro-thumbnails repository that holds boxarts. */
const BOXARTS_PREFIX = 'Named_Boxarts/';

/**
 * Minimal structural subset of a Fetch API `Response` needed by
 * {@link fetchCatalog}. The real global `fetch` satisfies
 * {@link CatalogFetch}; tests can supply a plain-object stub.
 */
export interface CatalogResponse {
  /** `true` when the HTTP status is in the 200–299 range. */
  ok: boolean;
  /** HTTP status code. */
  status: number;
  /** HTTP status text (may be empty on HTTP/2 responses). */
  statusText: string;
  /** Resolves to the parsed JSON body. */
  json(): Promise<unknown>;
}

/**
 * Signature of the injectable fetch function accepted by
 * {@link fetchCatalog}. The browser/global `fetch` is assignable to it.
 */
export type CatalogFetch = (url: string) => Promise<CatalogResponse>;

/**
 * Builds the GitHub git trees API URL listing the full file tree of a
 * libretro-thumbnails repository in a single request.
 *
 * @param repo Repository name inside the libretro-thumbnails organization,
 *   e.g. `"Nintendo_-_Game_Boy"`.
 */
export function catalogUrl(repo: string): string {
  return `https://api.github.com/repos/libretro-thumbnails/${repo}/git/trees/master?recursive=1`;
}

/**
 * Extracts the boxart file names from a GitHub git trees API payload.
 *
 * Keeps only entries under `Named_Boxarts/` whose path ends in `.png`, and
 * strips that prefix so each result is a bare file name such as
 * `"Tetris (World) (Rev 1).png"`. Entries in other directories
 * (`Named_Snaps/`, `Named_Titles/`, ...) and non-PNG files are ignored.
 *
 * @param treesJson Parsed JSON body of the trees API response.
 * @throws {Error} If the payload does not have the expected
 *   `{ tree: [...] }` shape.
 */
export function parseCatalog(treesJson: unknown): string[] {
  if (typeof treesJson !== 'object' || treesJson === null) {
    throw new Error('Unexpected GitHub trees payload: not a JSON object');
  }
  const tree = (treesJson as Record<string, unknown>)['tree'];
  if (!Array.isArray(tree)) {
    throw new Error('Unexpected GitHub trees payload: missing "tree" array');
  }
  const names: string[] = [];
  for (const entry of tree as unknown[]) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const path = (entry as Record<string, unknown>)['path'];
    if (typeof path === 'string' && path.startsWith(BOXARTS_PREFIX) && path.endsWith('.png')) {
      names.push(path.slice(BOXARTS_PREFIX.length));
    }
  }
  return names;
}

/**
 * Builds the raw.githubusercontent.com download URL for one boxart PNG.
 *
 * The file name is percent-encoded as a single path segment with
 * `encodeURIComponent` (spaces, commas, ampersands, `#`, `%`, ... are all
 * escaped), matching `urllib.parse.quote` in the reference Python tooling.
 *
 * @param repo Repository name inside the libretro-thumbnails organization.
 * @param name Boxart file name as returned by {@link parseCatalog}
 *   (unencoded, including the `.png` extension).
 */
export function boxartUrl(repo: string, name: string): string {
  return (
    `https://raw.githubusercontent.com/libretro-thumbnails/${repo}` +
    `/master/${BOXARTS_PREFIX}${encodeURIComponent(name)}`
  );
}

/**
 * Downloads and parses the boxart catalog of a libretro-thumbnails
 * repository.
 *
 * @param repo Repository name inside the libretro-thumbnails organization.
 * @param fetchFn Fetch implementation; defaults to the global `fetch`.
 *   Injectable so tests run without network access.
 * @returns Boxart file names (prefix stripped), in repository tree order.
 * @throws {Error} On a non-2xx HTTP response (including GitHub API rate
 *   limiting, which answers 403) or on an unexpected payload shape.
 */
export async function fetchCatalog(repo: string, fetchFn: CatalogFetch = fetch): Promise<string[]> {
  const url = catalogUrl(repo);
  const response = await fetchFn(url);
  if (!response.ok) {
    const status =
      response.statusText === ''
        ? `${response.status}`
        : `${response.status} ${response.statusText}`;
    throw new Error(`GitHub trees request for "${repo}" failed: HTTP ${status} (${url})`);
  }
  return parseCatalog(await response.json());
}
