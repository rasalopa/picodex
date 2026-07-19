/**
 * The read-only card walk behind the Health tab: one depth-capped pass that
 * collects macOS junk, `/_pico` loader entries, saves and user covers.
 *
 * The walk has to survive entries it is not allowed to read. macOS refuses
 * access to some of its own volume folders (`.Trashes` needs Full Disk
 * Access, for instance), and Chromium reports that refusal as
 * `NoModificationAllowedError` — "an attempt was made to write..." — even
 * when the operation was a read. One such entry must not abort the scan.
 */
import {
  JUNK_DIR_NAMES,
  isJunkFileName,
  isPreventionOnlyFsevents,
  type SaveFile,
} from './health.ts';
import { COVERS, GAMES_DIR, PICO_DIR, listEntries } from './sdcard.ts';

/** How deep the scanner walks below the SD root. */
export const MAX_SCAN_DEPTH = 8;

/** One junk file found by the scan, with enough context to delete it. */
export interface JunkFile {
  /** Directory path segments from the SD root (empty = at the root). */
  path: readonly string[];
  name: string;
  size: number;
}

/** One macOS junk directory found at the SD root. */
export interface JunkDir {
  name: string;
  /** `.fseventsd` holding only the intentional `no_log` marker: never deleted. */
  preventionOnly: boolean;
}

/** Raw data collected by one walk of the card (orphans are derived later). */
export interface ScanResult {
  junkFiles: JunkFile[];
  junkDirs: JunkDir[];
  /** File names found directly inside `/_pico` (for the loader check). */
  picoEntries: string[];
  /** `.sav` files found in `Games/<dir>/`. */
  saves: SaveFile[];
  /** File names found in `_pico/covers/user/`. */
  userCoverNames: string[];
  /** Directories (path from the root) the browser was not allowed to read. */
  skippedDirs: string[];
  /** Total number of files visited. */
  filesSeen: number;
}

/** Case-insensitive path comparison: FAT preserves case but ignores it. */
function pathEquals(path: readonly string[], expected: readonly string[]): boolean {
  return (
    path.length === expected.length &&
    expected.every((segment, i) => path[i].toLowerCase() === segment.toLowerCase())
  );
}

/** Whether an error is the browser denying access to an entry. */
function isAccessError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === 'NoModificationAllowedError' ||
      e.name === 'NotAllowedError' ||
      e.name === 'NotReadableError')
  );
}

/**
 * Whether a `.fseventsd` directory holds only the intentional `no_log`
 * marker. This is the one junk directory whose contents matter; the others
 * are never opened — macOS denies even listing `.Trashes`.
 */
async function isFseventsPreventionMarker(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    return isPreventionOnlyFsevents((await listEntries(handle)).map((entry) => entry.name));
  } catch {
    return false; // unreadable contents: treat as plain junk
  }
}

/**
 * Walks the whole card (depth-capped) collecting health data. Junk
 * directories are inspected but never descended into; everything else —
 * including ROM folders, where Finder drops `._*` files too — is visited.
 */
export async function scanCard(
  root: FileSystemDirectoryHandle,
  onProgress: (filesSeen: number) => void,
): Promise<ScanResult> {
  const result: ScanResult = {
    junkFiles: [],
    junkDirs: [],
    picoEntries: [],
    saves: [],
    userCoverNames: [],
    skippedDirs: [],
    filesSeen: 0,
  };

  async function walk(dir: FileSystemDirectoryHandle, path: readonly string[]): Promise<void> {
    const inPico = pathEquals(path, [PICO_DIR]);
    const inUserCovers = pathEquals(path, COVERS.user);
    const gamesDir =
      path.length === 2 && path[0].toLowerCase() === GAMES_DIR.toLowerCase() ? path[1] : null;
    for await (const handle of dir.values()) {
      if (handle.kind === 'file') {
        result.filesSeen += 1;
        if (result.filesSeen % 50 === 0) {
          onProgress(result.filesSeen);
        }
        if (isJunkFileName(handle.name)) {
          let size = 0;
          try {
            size = (await handle.getFile()).size;
          } catch {
            // size is display-only; an unreadable junk file is still junk
          }
          result.junkFiles.push({ path, name: handle.name, size });
          continue; // junk is junk everywhere; never double-report it below
        }
        if (inPico) {
          result.picoEntries.push(handle.name);
        } else if (inUserCovers) {
          result.userCoverNames.push(handle.name);
        } else if (gamesDir !== null && handle.name.toLowerCase().endsWith('.sav')) {
          result.saves.push({ gamesDir, name: handle.name });
        }
        continue;
      }
      if (JUNK_DIR_NAMES.includes(handle.name)) {
        // never descend into junk dirs; only the root-level ones are
        // reported (that is where macOS creates them)
        if (path.length === 0) {
          result.junkDirs.push({
            name: handle.name,
            preventionOnly:
              handle.name === '.fseventsd' && (await isFseventsPreventionMarker(handle)),
          });
        }
        continue;
      }
      if (path.length < MAX_SCAN_DEPTH) {
        const childPath = [...path, handle.name];
        try {
          await walk(handle, childPath);
        } catch (e) {
          if (!isAccessError(e)) {
            throw e;
          }
          result.skippedDirs.push(childPath.join('/'));
        }
      }
    }
  }

  await walk(root, []);
  onProgress(result.filesSeen);
  return result;
}
