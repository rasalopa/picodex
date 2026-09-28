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
import { validateLauncherCoverBmp, type CoverLauncher } from './bmp.ts';
import { COVERS, MAX_SCAN_DEPTH, PICO_DIR, isAccessError, listEntries } from './sdcard.ts';

export { MAX_SCAN_DEPTH } from './sdcard.ts';

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

/** A cover file the launcher would not display, and why. */
export interface CoverProblem {
  /** Which covers folder it sits in. */
  folder: keyof typeof COVERS;
  name: string;
  /** What {@link validateLauncherCoverBmp} objected to. */
  reason: string;
}

/** Raw data collected by one walk of the card (orphans are derived later). */
export interface ScanResult {
  junkFiles: JunkFile[];
  junkDirs: JunkDir[];
  /** File names found directly inside `/_pico` (for the loader check). */
  picoEntries: string[];
  /** `.sav` files found anywhere outside `/_pico`. */
  saves: SaveFile[];
  /** File names found in `_pico/covers/user/`. */
  userCoverNames: string[];
  /** `.bmp` files in the covers folders that the launcher cannot display. */
  coverProblems: CoverProblem[];
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
  options: { launcher?: CoverLauncher } = {},
): Promise<ScanResult> {
  const launcher = options.launcher ?? 'stock';
  const result: ScanResult = {
    junkFiles: [],
    junkDirs: [],
    picoEntries: [],
    saves: [],
    userCoverNames: [],
    coverProblems: [],
    skippedDirs: [],
    filesSeen: 0,
  };

  async function walk(dir: FileSystemDirectoryHandle, path: readonly string[]): Promise<void> {
    const inPico = pathEquals(path, [PICO_DIR]);
    const inUserCovers = pathEquals(path, COVERS.user);
    const coverFolder = (Object.keys(COVERS) as (keyof typeof COVERS)[]).find((key) =>
      pathEquals(path, COVERS[key]),
    );
    // saves live next to their ROM or in a saves folder beside it, anywhere
    // outside /_pico — but the library walk never enters dot-directories, so
    // a save in one must not be collected either (its ROM would be invisible
    // and the save would wrongly classify as orphaned)
    const savesCollectible =
      path.every((segment) => !segment.startsWith('.')) &&
      (path.length === 0 || path[0].toLowerCase() !== PICO_DIR.toLowerCase());
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
        if (coverFolder !== undefined && handle.name.toLowerCase().endsWith('.bmp')) {
          // only the header is read: the launcher's own checks are all in it,
          // and a card can hold hundreds of covers
          try {
            const file = await handle.getFile();
            const header = new Uint8Array(await file.slice(0, 64).arrayBuffer());
            const reason = validateLauncherCoverBmp(header, file.size, launcher);
            if (reason !== null) {
              result.coverProblems.push({ folder: coverFolder, name: handle.name, reason });
            }
          } catch {
            // an unreadable cover is not one the launcher shows either, but
            // there is nothing to say about it that helps
          }
        }
        if (inPico) {
          result.picoEntries.push(handle.name);
        } else if (inUserCovers) {
          result.userCoverNames.push(handle.name);
        } else if (savesCollectible && handle.name.toLowerCase().endsWith('.sav')) {
          result.saves.push({ path, name: handle.name });
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
