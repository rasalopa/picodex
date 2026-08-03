/**
 * Reads and hashes the loader files in `/_pico` so {@link identifyLoader} can say
 * which pico-loader release they came from.
 *
 * The IO lives here rather than in `loaderVersion.ts` so that the deciding logic
 * stays pure and testable without a card, matching how `health.ts` is split.
 */

import manifestJson from '../data/loaderReleases.json';
import {
  LOADER_FILE_NAMES,
  LOADER_REPO,
  type LoaderFileName,
  type LoaderManifest,
} from './loaderVersion.ts';
import { PICO_DIR, getDir, isAccessError, readFileBytes } from './sdcard.ts';

/**
 * The committed manifest, written by `scripts/gen-loader-manifest.mjs`.
 *
 * The cast is deliberate rather than a runtime validation: if the generator's
 * output shape ever drifts from {@link LoaderManifest}, TypeScript fails the build
 * here, which is where a shape change should be caught.
 */
export const LOADER_MANIFEST = manifestJson as LoaderManifest;

export interface LoaderFileScan {
  /** Lowercase hex sha256 per file. A file absent from the card has no key. */
  hashes: Partial<Record<LoaderFileName, string>>;
  /**
   * Files that are on the card but could not be read - a macOS lock, antivirus,
   * a failing card. Deliberately distinct from absent: `patchlist.bin` being
   * absent is normal on an older card, a file that will not open is not, and
   * silently treating one as the other would let PicoDex report a card as
   * "missing files" when the truth is "I could not look".
   */
  unreadable: LoaderFileName[];
}

/** Lowercase hex sha256 of a byte range. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // The copy is needed for types, not for correctness: TypeScript 6 types a
  // Uint8Array as Uint8Array<ArrayBufferLike>, which is not assignable to
  // BufferSource when the buffer could be a SharedArrayBuffer.
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Reads and hashes every loader file present in `/_pico`.
 *
 * Each read is guarded on its own. `readFileBytes` only swallows a missing entry;
 * a file that exists but will not open throws, and one unreadable loader file must
 * not abort the whole health check.
 *
 * @param root The card root directory handle.
 * @returns The hashes found, plus any file that could not be read. An absent
 *   `/_pico` yields empty results rather than an error: {@link identifyLoader}
 *   reports that as `no-loader`, which is the honest answer.
 */
export async function scanLoaderFiles(root: FileSystemDirectoryHandle): Promise<LoaderFileScan> {
  const hashes: Partial<Record<LoaderFileName, string>> = {};
  const unreadable: LoaderFileName[] = [];

  const picoDir = await getDir(root, [PICO_DIR]);
  if (picoDir === null) return { hashes, unreadable };

  for (const file of LOADER_FILE_NAMES) {
    try {
      const bytes = await readFileBytes(picoDir, file);
      if (bytes !== null) hashes[file] = await sha256Hex(bytes);
    } catch (error) {
      if (!isAccessError(error)) throw error;
      unreadable.push(file);
    }
  }

  return { hashes, unreadable };
}

/** Milliseconds before the optional release check gives up. */
const LATEST_TAG_TIMEOUT_MS = 5000;

/**
 * Asks GitHub for pico-loader's newest release tag, so PicoDex can notice that its
 * own manifest has gone stale - the one thing a committed manifest cannot know.
 *
 * Returns `null` on anything at all: no network, rate limited, offline, blocked,
 * slow. That is the point. The verdict in the health check is produced entirely
 * from the committed manifest, and this only ever adds a note on top of an answer
 * that already stands, so a failure here must be invisible rather than an error
 * the user has to read.
 *
 * Only the API is called, never a release asset: the API sends
 * `access-control-allow-origin: *`, while asset downloads do not, which is why the
 * hashes are committed instead of fetched.
 *
 * @returns The newest non-prerelease tag, or `null` when it could not be learned.
 */
export async function fetchLatestLoaderTag(): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${LOADER_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(LATEST_TAG_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    const tag = (body as { tag_name?: unknown }).tag_name;
    return typeof tag === 'string' && tag.length > 0 ? tag : null;
  } catch {
    return null;
  }
}
