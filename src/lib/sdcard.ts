/**
 * File System Access layer + DSpico SD card layout model.
 *
 * Thin promise-based helpers over the browser File System Access API
 * (directory picking, path traversal, byte/text file IO) plus the layout
 * knowledge of a DSpico SD card as documented in pico-enhanced's ESTUDIO.md:
 *
 * ```
 * /_pico/                  launcher data (settings.json, gamedata.json, covers/, ...)
 * /_pico/covers/nds/       NDS covers keyed by 4-char gamecode (<CODE>.bmp)
 * /_pico/covers/gba/       GBA covers keyed by 4-char gamecode (<CODE>.bmp)
 * /_pico/covers/user/      covers keyed by full ROM file name (<file name>.bmp)
 * /Games/<system dir>/     ROMs, one folder per system (see systems.ts)
 * ```
 *
 * All functions are typed against the DOM handle interfaces so real handles
 * flow through untouched; tests exercise them with in-memory fakes.
 */

import type { System } from './systems.ts';

/**
 * Permission descriptor accepted by `queryPermission` / `requestPermission`
 * on File System Access handles (WICG spec, not yet in TypeScript's DOM lib).
 */
export interface FileSystemPermissionDescriptor {
  /** Access level to check or request. Defaults to `'read'` in browsers. */
  mode?: 'read' | 'readwrite';
}

// Minimal ambient declarations for the WICG File System Access API surface
// that TypeScript's DOM lib does not ship yet. Kept local to this module on
// purpose (no @types dependency).
declare global {
  /** Options bag for `window.showDirectoryPicker()` (WICG File System Access). */
  interface DirectoryPickerOptions {
    /** Lets the browser remember different last-used directories per id. */
    id?: string;
    /** Access level requested for the picked directory. */
    mode?: 'read' | 'readwrite';
    /** Well-known directory or handle the picker should start in. */
    startIn?: FileSystemHandle | string;
  }

  interface Window {
    /** WICG File System Access entry point; `undefined` in unsupported browsers. */
    showDirectoryPicker?(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
  }

  interface FileSystemHandle {
    /** Queries the current permission state without prompting the user. */
    queryPermission?(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
    /** Prompts the user (if needed) to grant access to this handle. */
    requestPermission?(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
  }
}

/** Name of the launcher's data directory at the SD card root. */
export const PICO_DIR = '_pico';

/** Name of the ROMs directory at the SD card root (one subfolder per system). */
export const GAMES_DIR = 'Games';

/**
 * Path segments (relative to the SD root, for {@link getDir}) of each cover
 * art directory: `nds`/`gba` hold gamecode-keyed covers, `user` holds
 * filename-keyed covers for every other system.
 */
export const COVERS: Record<'nds' | 'gba' | 'user', readonly string[]> = {
  nds: [PICO_DIR, 'covers', 'nds'],
  gba: [PICO_DIR, 'covers', 'gba'],
  user: [PICO_DIR, 'covers', 'user'],
};

/** File name of the per-game data store (favorites, launch counts) inside `_pico/`. */
export const GAMEDATA_FILE = 'gamedata.json';

/** File name of the launcher settings inside `_pico/`. */
export const SETTINGS_FILE = 'settings.json';

/**
 * Whether the current browser exposes the File System Access API needed to
 * open an SD card directory ({@link pickSdRoot}).
 */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

/**
 * Opens the browser directory picker so the user can select the SD card
 * root, requesting read-write access.
 *
 * @throws If the browser does not support the File System Access API, or the
 *   user dismisses the picker (`AbortError` DOMException).
 */
export async function pickSdRoot(): Promise<FileSystemDirectoryHandle> {
  if (typeof window === 'undefined' || window.showDirectoryPicker === undefined) {
    throw new Error('File System Access API is not supported in this browser');
  }
  return window.showDirectoryPicker({ mode: 'readwrite' });
}

/**
 * Ensures a previously obtained handle (e.g. restored from IndexedDB) still
 * has read-write permission, prompting the user when necessary.
 *
 * @returns `true` when access is granted. Browsers that implement the API
 *   without the permission methods are assumed to have granted access along
 *   with the handle.
 */
export async function ensureReadWritePermission(handle: FileSystemHandle): Promise<boolean> {
  const descriptor: FileSystemPermissionDescriptor = { mode: 'readwrite' };
  const current =
    handle.queryPermission !== undefined ? await handle.queryPermission(descriptor) : 'granted';
  if (current === 'granted') {
    return true;
  }
  if (handle.requestPermission === undefined) {
    return false;
  }
  return (await handle.requestPermission(descriptor)) === 'granted';
}

/**
 * `true` when the error signals a missing (or wrongly-typed) directory entry:
 * `NotFoundError`, or `TypeMismatchError` (entry exists but is a file where a
 * directory was expected, or vice versa).
 */
function isMissingEntryError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('name' in error)) {
    return false;
  }
  const name = (error as { name: unknown }).name;
  return name === 'NotFoundError' || name === 'TypeMismatchError';
}

/**
 * Resolves a nested directory by walking `path` segments from `root`.
 *
 * @param root Directory to start from (an empty `path` returns it as-is).
 * @param path Path segments, e.g. `[PICO_DIR, 'covers', 'nds']`.
 * @param create When `true`, missing directories are created along the way.
 * @returns The directory handle, or `null` when a segment does not exist (or
 *   is a file) and `create` is `false`. Other errors (permissions, ...) are
 *   rethrown.
 */
export async function getDir(
  root: FileSystemDirectoryHandle,
  path: readonly string[],
  create = false,
): Promise<FileSystemDirectoryHandle | null> {
  let dir = root;
  for (const segment of path) {
    try {
      dir = await dir.getDirectoryHandle(segment, { create });
    } catch (error) {
      if (!create && isMissingEntryError(error)) {
        return null;
      }
      throw error;
    }
  }
  return dir;
}

/**
 * Reads a file inside `dir` as raw bytes.
 *
 * @returns The file contents, or `null` when no file with that name exists.
 */
export async function readFileBytes(
  dir: FileSystemDirectoryHandle,
  name: string,
): Promise<Uint8Array | null> {
  let handle: FileSystemFileHandle;
  try {
    handle = await dir.getFileHandle(name);
  } catch (error) {
    if (isMissingEntryError(error)) {
      return null;
    }
    throw error;
  }
  const file = await handle.getFile();
  return new Uint8Array(await file.arrayBuffer());
}

/**
 * Reads a file inside `dir` as UTF-8 text.
 *
 * @returns The decoded text, or `null` when no file with that name exists.
 */
export async function readFileText(
  dir: FileSystemDirectoryHandle,
  name: string,
): Promise<string | null> {
  const bytes = await readFileBytes(dir, name);
  if (bytes === null) {
    return null;
  }
  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * Writes `bytes` to a file inside `dir`, creating it when missing and fully
 * replacing any previous contents.
 */
export async function writeFileBytes(
  dir: FileSystemDirectoryHandle,
  name: string,
  bytes: Uint8Array,
): Promise<void> {
  const handle = await dir.getFileHandle(name, { create: true });
  // write() only accepts ArrayBuffer-backed views; copy if the caller's view
  // sits on a SharedArrayBuffer (the copy also satisfies the TS 6 DOM types).
  const chunk: Uint8Array<ArrayBuffer> =
    bytes.buffer instanceof ArrayBuffer
      ? (bytes as Uint8Array<ArrayBuffer>)
      : new Uint8Array(bytes);
  const writable = await handle.createWritable();
  try {
    await writable.write(chunk);
  } catch (error) {
    await writable.abort();
    throw error;
  }
  await writable.close();
}

/**
 * Writes UTF-8 `text` to a file inside `dir`, creating it when missing and
 * fully replacing any previous contents.
 */
export async function writeFileText(
  dir: FileSystemDirectoryHandle,
  name: string,
  text: string,
): Promise<void> {
  await writeFileBytes(dir, name, new TextEncoder().encode(text));
}

/** One directory entry as returned by {@link listEntries}. */
export interface SdEntry {
  /** Entry name (file name or directory name). */
  name: string;
  /** Whether the entry is a file or a directory. */
  kind: 'file' | 'directory';
}

/** Lists the immediate children of a directory (files and subdirectories). */
export async function listEntries(dir: FileSystemDirectoryHandle): Promise<SdEntry[]> {
  const entries: SdEntry[] = [];
  for await (const handle of dir.values()) {
    entries.push({ name: handle.name, kind: handle.kind });
  }
  return entries;
}

/** Whether a file (not a directory) named `name` exists inside `dir`. */
export async function fileExists(dir: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch (error) {
    if (isMissingEntryError(error)) {
      return false;
    }
    throw error;
  }
}

/**
 * Heuristic check that a picked directory is a DSpico SD card root: it must
 * contain the launcher's `_pico` directory.
 */
export async function looksLikeDspicoSd(root: FileSystemDirectoryHandle): Promise<boolean> {
  return (await getDir(root, [PICO_DIR])) !== null;
}

/** One ROM file found by {@link scanLibrary}. */
export interface LibraryFile {
  /** System the file belongs to (matched by its extension). */
  system: System;
  /** File name, without its directory. */
  fileName: string;
  /** File size in bytes. */
  size: number;
  /**
   * Directory path segments from the SD root (empty = at the root). ROMs can
   * live anywhere on the card, not just `Games/<system.gamesDir>` — always
   * open a game through this, never by rebuilding the canonical layout.
   */
  path: readonly string[];
}

/** How deep the card walks (library and health scan) go below the SD root. */
export const MAX_SCAN_DEPTH = 8;

/** The launcher ROM at the card root — a tool, never a library game. */
export const LAUNCHER_FILE = '_picoboot.nds';

/**
 * Whether an error is the browser denying access to an entry. Chromium
 * surfaces macOS/Windows permission denials as these names — sometimes as
 * `NoModificationAllowedError` even on reads (see {@link friendlyFsError}).
 */
export function isAccessError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === 'NoModificationAllowedError' ||
      e.name === 'NotAllowedError' ||
      e.name === 'NotReadableError')
  );
}

/**
 * Scans the whole card (depth-capped) and returns every file whose extension
 * belongs to a system — ROMs can live anywhere, not just in the suggested
 * `Games/<gamesDir>` layout.
 *
 * Skipped while walking: entries whose name starts with `'.'` (macOS `._*`
 * AppleDouble files, `.DS_Store`, and junk/protected folders like `.Trashes`),
 * the `_pico` folder (its `emulators/` holds `.nds` files that are tools, not
 * library games), the launcher ROM `_picoboot.nds` at the root, and
 * directories the browser is not allowed to read (Windows ACL-protects
 * `System Volume Information` on every card it touches — one such folder
 * must not abort the whole library). Each file is attributed by extension —
 * extensions are unique across systems, which also disambiguates the systems
 * that share a canonical folder (gb/gbc, ws/wsc, ngp/ngc).
 *
 * @param root SD card root handle.
 * @param systems Systems to scan for, in the order results should appear.
 * @param onProgress Called with the number of files visited so far (every
 *   50 files and once at the end) — large collections take a while and the
 *   UI should show the walk is alive.
 * @returns Found files grouped per system in `systems` order (walk order
 *   within a system); empty when the card holds no known ROMs.
 */
export async function scanLibrary(
  root: FileSystemDirectoryHandle,
  systems: readonly System[],
  onProgress?: (filesSeen: number) => void,
): Promise<LibraryFile[]> {
  const systemByExtension = new Map<string, System>();
  for (const system of systems) {
    for (const extension of system.extensions) {
      systemByExtension.set(extension.toLowerCase(), system);
    }
  }

  let filesSeen = 0;
  const results: LibraryFile[] = [];
  async function walk(dir: FileSystemDirectoryHandle, path: readonly string[]): Promise<void> {
    for await (const handle of dir.values()) {
      if (handle.name.startsWith('.')) {
        continue;
      }
      if (handle.kind === 'directory') {
        if (path.length === 0 && handle.name.toLowerCase() === PICO_DIR.toLowerCase()) {
          continue;
        }
        if (path.length < MAX_SCAN_DEPTH) {
          try {
            await walk(handle, [...path, handle.name]);
          } catch (e) {
            if (!isAccessError(e)) {
              throw e;
            }
            // unreadable subtree: skip it rather than lose the whole library
          }
        }
        continue;
      }
      filesSeen += 1;
      if (filesSeen % 50 === 0) {
        onProgress?.(filesSeen);
      }
      if (path.length === 0 && handle.name.toLowerCase() === LAUNCHER_FILE) {
        continue;
      }
      const dot = handle.name.lastIndexOf('.');
      if (dot <= 0) {
        continue;
      }
      const system = systemByExtension.get(handle.name.slice(dot).toLowerCase());
      if (system === undefined) {
        continue;
      }
      let file: File;
      try {
        file = await handle.getFile();
      } catch (e) {
        if (!isAccessError(e)) {
          throw e;
        }
        // a locked file must cost only itself, not its siblings (an error
        // escaping this loop would abort the whole directory mid-iteration)
        continue;
      }
      results.push({ system, fileName: handle.name, size: file.size, path });
    }
  }
  await walk(root, []);
  onProgress?.(filesSeen);

  // group per system in `systems` order; the sort is stable, so files keep
  // their walk order within a system
  const systemOrder = new Map(systems.map((system, index) => [system.id, index]));
  return results.sort(
    (a, b) => (systemOrder.get(a.system.id) ?? 0) - (systemOrder.get(b.system.id) ?? 0),
  );
}

/**
 * Human-readable message for a filesystem error. Chromium reports macOS
 * permission denials (system-protected entries like `.Trashes`, read-only
 * mounts) as a misleading "an attempt was made to write..." — name the
 * likely causes instead of echoing it.
 */
export function friendlyFsError(e: unknown): string {
  if (e instanceof DOMException && e.name === 'NoModificationAllowedError') {
    return (
      'macOS denied access to an entry on the card — it may be a system-protected ' +
      'folder (like .Trashes) or the card may be mounted read-only.'
    );
  }
  return e instanceof Error ? e.message : String(e);
}
