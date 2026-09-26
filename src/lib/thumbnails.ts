/**
 * Access helpers for the libretro-thumbnails GitHub organization
 * (https://github.com/libretro-thumbnails), the boxart source used to fill in
 * missing Pico Launcher covers.
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
  /**
   * Response headers, when the caller has them. Used to tell an exhausted
   * request budget apart from any other refusal.
   */
  headers?: { get(name: string): string | null };
  /** Resolves to the parsed JSON body. */
  json(): Promise<unknown>;
}

/**
 * Thrown when GitHub has no requests left for this caller. Separate from a
 * plain failure because it is the one the user can do something about, and
 * because an old stored catalog is a good answer to it.
 */
export class RateLimitedError extends Error {
  /** When the budget refills, if GitHub said. */
  readonly resetAt: Date | null;

  constructor(resetAt: Date | null) {
    super(
      resetAt === null
        ? 'GitHub is out of box art requests for now. It allows 60 an hour without an account.'
        : `GitHub is out of box art requests until ${resetAt.toLocaleTimeString()}. It allows 60 an hour without an account.`,
    );
    this.name = 'RateLimitedError';
    this.resetAt = resetAt;
  }
}

/**
 * Thrown when GitHub answers the box art list with an error, or with something
 * that is not the list. `status` is the HTTP status, or null for a bad body.
 */
export class CatalogError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'CatalogError';
    this.status = status;
  }
}

/** Thrown when GitHub cannot be reached at all, for example with no connection. */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super(`Could not reach GitHub: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'NetworkError';
  }
}

/**
 * Runs a fetch and turns the browser's network failure (a TypeError: no
 * connection, DNS, a blocked request) into a {@link NetworkError}.
 */
export async function fetchOrNetworkError<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (error instanceof TypeError) throw new NetworkError(error);
    throw error;
  }
}

/**
 * GitHub answers 403 for an exhausted budget, and also 429 more recently, but
 * it answers 403 for other refusals too. Two things tell them apart: the
 * remaining-requests header, and the body, which says so in words. Both are
 * checked because the header is only readable when CORS exposes it, and neither
 * is guessed at: an unexplained 403 stays a plain failure.
 */
async function rateLimitedFrom(response: CatalogResponse): Promise<RateLimitedError | null> {
  if (response.status !== 403 && response.status !== 429) return null;

  const remaining = response.headers?.get('x-ratelimit-remaining');
  let limited = remaining === '0';

  if (!limited) {
    try {
      const body = (await response.json()) as { message?: unknown };
      limited =
        typeof body?.message === 'string' && body.message.toLowerCase().includes('rate limit');
    } catch {
      // a body that will not parse says nothing either way
    }
  }
  if (!limited) return null;

  const resetHeader = response.headers?.get('x-ratelimit-reset');
  // Number('') and Number('   ') are 0, which would date the reset to 1970;
  // treat an empty or whitespace header as "not given" instead.
  const resetSeconds =
    resetHeader === null || resetHeader === undefined || resetHeader.trim() === ''
      ? NaN
      : Number(resetHeader);
  return new RateLimitedError(Number.isFinite(resetSeconds) ? new Date(resetSeconds * 1000) : null);
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
 * @throws {CatalogError} If the payload does not have the expected
 *   `{ tree: [...] }` shape.
 */
export function parseCatalog(treesJson: unknown): string[] {
  if (typeof treesJson !== 'object' || treesJson === null) {
    throw new CatalogError('Unexpected GitHub trees payload: not a JSON object', null);
  }
  const tree = (treesJson as Record<string, unknown>)['tree'];
  if (!Array.isArray(tree)) {
    throw new CatalogError('Unexpected GitHub trees payload: missing "tree" array', null);
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
 * @throws {RateLimitedError} When GitHub has no requests left for this caller.
 * @throws {CatalogError} On any other non-2xx response or an unexpected payload shape.
 * @throws {NetworkError} When GitHub cannot be reached.
 */
export async function fetchCatalog(repo: string, fetchFn: CatalogFetch = fetch): Promise<string[]> {
  const url = catalogUrl(repo);
  const response = await fetchOrNetworkError(() => fetchFn(url));
  if (!response.ok) {
    const rateLimited = await rateLimitedFrom(response);
    if (rateLimited !== null) throw rateLimited;
    const status =
      response.statusText === ''
        ? `${response.status}`
        : `${response.status} ${response.statusText}`;
    throw new CatalogError(
      `GitHub trees request for "${repo}" failed: HTTP ${status} (${url})`,
      response.status,
    );
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    // The body can still fail after the headers arrived: the connection drops
    // mid-download (a TypeError), or what came back is not JSON at all.
    if (error instanceof TypeError) throw new NetworkError(error);
    const reason = error instanceof Error ? error.message : String(error);
    throw new CatalogError(`Unreadable GitHub trees payload: ${reason}`, null);
  }
  return parseCatalog(body);
}
