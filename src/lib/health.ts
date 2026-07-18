/**
 * Pure logic for the SD card health check: classifying macOS junk,
 * verifying the Pico Loader file set and finding orphaned saves/covers.
 *
 * Everything here is side-effect free and operates on plain data collected
 * elsewhere (the Health view walks the card); keeping the rules pure makes
 * the deletion criteria — the dangerous part — fully unit-testable.
 */

import type { LibraryFile } from './sdcard.ts';

/**
 * Whether a file name is disposable macOS metadata: AppleDouble resource
 * forks (`._*`) or Finder's `.DS_Store`.
 *
 * Deliberately conservative: other dotfiles (`.gitignore`, `.nomedia`, …)
 * and `.metadata_never_index` — a marker users create on purpose to stop
 * Spotlight from indexing the card — are NOT junk.
 */
export function isJunkFileName(name: string): boolean {
  return name.startsWith('._') || name === '.DS_Store';
}

/**
 * Directory names macOS creates at a volume root that are safe to delete
 * recursively — with one exception: `.fseventsd` containing only a `no_log`
 * marker was set up intentionally to disable FSEvents logging and must be
 * kept (see {@link isPreventionOnlyFsevents}).
 */
export const JUNK_DIR_NAMES: readonly string[] = [
  '.Spotlight-V100',
  '.Trashes',
  '.fseventsd',
  '.TemporaryItems',
];

/**
 * Whether a `.fseventsd` directory is a user-made prevention marker rather
 * than macOS junk: it contains a `no_log` file and nothing else. Such a
 * directory must never be deleted — removing it would re-enable FSEvents
 * logging on the card.
 *
 * @param entryNames Names of the directory's immediate children. An empty
 *   directory is plain junk (macOS recreates it either way), so `[]` returns
 *   `false`. FAT cards are case-insensitive, so `no_log` is matched
 *   case-insensitively.
 */
export function isPreventionOnlyFsevents(entryNames: readonly string[]): boolean {
  return entryNames.length > 0 && entryNames.every((name) => name.toLowerCase() === 'no_log');
}

/** Files inside `/_pico` the loader cannot boot games without. */
export const REQUIRED_LOADER_FILES: readonly string[] = [
  'picoLoader7.bin',
  'picoLoader9.bin',
  'aplist.bin',
  'savelist.bin',
];

/** Optional `/_pico` loader files (extra patches, DS BIOS for compatibility). */
export const OPTIONAL_LOADER_FILES: readonly string[] = ['patchlist.bin', 'biosnds7.rom'];

/**
 * Checks which loader files are missing from `/_pico`.
 *
 * @param picoEntries Entry names found in `/_pico` (FAT is case-insensitive,
 *   so presence is checked case-insensitively).
 * @returns Missing names split by severity, in the canonical spelling of
 *   {@link REQUIRED_LOADER_FILES} / {@link OPTIONAL_LOADER_FILES}.
 */
export function missingLoaderFiles(picoEntries: readonly string[]): {
  required: string[];
  optional: string[];
} {
  const present = new Set(picoEntries.map((name) => name.toLowerCase()));
  const missing = (names: readonly string[]) =>
    names.filter((name) => !present.has(name.toLowerCase()));
  return { required: missing(REQUIRED_LOADER_FILES), optional: missing(OPTIONAL_LOADER_FILES) };
}

/** A save file found in a games directory, as collected by the card walk. */
export interface SaveFile {
  /** Directory under `Games/` the save was found in (e.g. `'nds'`, `'gb'`). */
  gamesDir: string;
  /** File name of the save (e.g. `'Mario Kart DS (USA).sav'`). */
  name: string;
}

/** `name` minus its final extension (`'a.nds.sav'` → `'a.nds'`). */
function baseName(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? name : name.slice(0, dot);
}

/**
 * Finds `.sav` files that no longer belong to any ROM: their base name
 * (name minus the final extension) matches no game in the same games
 * directory, case-insensitively.
 *
 * Systems can share a games directory (gb/gbc both use `gb`, ws/wsc use
 * `ws`, ngp/ngc use `ngp`), so a save is compared against every game whose
 * `system.gamesDir` equals the save's directory. To stay conservative, a
 * save also counts as owned when its base name equals a game's full file
 * name (`'Game.nds.sav'` next to `'Game.nds'`), a naming scheme some
 * loaders use.
 *
 * @param games All ROMs found on the card.
 * @param saves Save files collected per games directory.
 * @returns The orphaned saves, in `saves` order. Non-`.sav` entries are
 *   ignored, never reported.
 */
export function findOrphanSaves(
  games: readonly LibraryFile[],
  saves: readonly SaveFile[],
): SaveFile[] {
  // FAT is case-insensitive: an on-disk 'Games/NDS' still holds the 'nds'
  // system's games, so the directory join must be case-insensitive too or
  // every save in a re-cased folder would be flagged orphaned.
  /** lowercased gamesDir → lowercased names a save base may match. */
  const ownedByDir = new Map<string, Set<string>>();
  for (const game of games) {
    const dirKey = game.system.gamesDir.toLowerCase();
    let owned = ownedByDir.get(dirKey);
    if (owned === undefined) {
      owned = new Set();
      ownedByDir.set(dirKey, owned);
    }
    owned.add(baseName(game.fileName).toLowerCase());
    owned.add(game.fileName.toLowerCase());
  }
  return saves.filter((save) => {
    if (!save.name.toLowerCase().endsWith('.sav')) {
      return false;
    }
    const owned = ownedByDir.get(save.gamesDir.toLowerCase());
    return owned === undefined || !owned.has(baseName(save.name).toLowerCase());
  });
}

/**
 * Finds files in `_pico/covers/user/` that are no game's cover: user covers
 * are keyed by full ROM file name (`<file name>.bmp`), so any `.bmp` whose
 * name matches no game file name (case-insensitively) is orphaned.
 *
 * Junk names ({@link isJunkFileName}) are skipped — they belong to the junk
 * section — and so are non-`.bmp` files, which were never covers.
 *
 * @param userCoverNames Entry names found in `_pico/covers/user/`.
 * @param games All ROMs found on the card (any system; user covers are not
 *   split per system).
 * @returns The orphaned cover file names, in `userCoverNames` order.
 */
export function findOrphanUserCovers(
  userCoverNames: readonly string[],
  games: readonly LibraryFile[],
): string[] {
  const expected = new Set(games.map((game) => `${game.fileName.toLowerCase()}.bmp`));
  return userCoverNames.filter((name) => {
    const lower = name.toLowerCase();
    return !isJunkFileName(name) && lower.endsWith('.bmp') && !expected.has(lower);
  });
}
