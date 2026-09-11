/**
 * Where the launcher looks for a game's art (covers, icons, banners) and
 * where PicoDex must write new art so the launcher picks it up.
 *
 * All three art kinds share one folder layout under `/_pico/<kind>/`:
 * `user/<file name>.<ext>` keyed by the ROM's full file name, and
 * `nds/<CODE>.<ext>` or `gba/<CODE>.<ext>` keyed by the header gamecode.
 * The launcher resolves `user/` FIRST, then the gamecode folder
 * (`IconRepository`, `CoverRepository`, `BannerRepository` upstream).
 */

import { isUsableGameCode } from './gamedata';
import type { LibraryFile } from './sdcard';
import type { System } from './systems';

/** One of the three launcher art folders. */
export type ArtDir = 'nds' | 'gba' | 'user';

/** A file inside an art folder set: folder key plus file name. */
export interface ArtTarget {
  dir: ArtDir;
  name: string;
}

/** Names present in each folder of one art kind, lowercased, extension included. */
export interface ArtIndex {
  nds: Set<string>;
  gba: Set<string>;
  user: Set<string>;
}

/** The gamecode folder of a gamecode-keyed system (`nds` for NDS, `gba` otherwise). */
export function gamecodeDir(system: System): 'nds' | 'gba' {
  return system.id === 'nds' ? 'nds' : 'gba';
}

/**
 * The file the launcher would pick for `game` in one art kind, following its
 * lookup order, or `null` when the card has none for it.
 *
 * @param game - The ROM.
 * @param code - Its header gamecode, `null` when unreadable or not applicable.
 * @param index - Names present in that art kind's folders (`ArtIndex`).
 * @param ext - File extension without the dot (`bmp` for covers and icons,
 *   `bnr` for banners).
 */
export function findArt(
  game: LibraryFile,
  code: string | null,
  index: ArtIndex,
  ext: string,
): ArtTarget | null {
  const userName = `${game.fileName}.${ext}`;
  if (index.user.has(userName.toLowerCase())) return { dir: 'user', name: userName };
  if (code !== null && game.system.coverKeying === 'gamecode') {
    const dir = gamecodeDir(game.system);
    const codeName = `${code.toUpperCase()}.${ext}`;
    if (index[dir].has(codeName.toLowerCase())) return { dir, name: codeName };
  }
  return null;
}

/**
 * The file a NEW cover or icon for `game` must be written to.
 *
 * A `user/` file already on the card shadows the gamecode folders, so it is
 * replaced in place: writing the gamecode path instead would look like a
 * silent no-op. Otherwise gamecode-keyed systems with a usable code go to
 * `<nds|gba>/<CODE>.bmp`. A code that is not an identity (the `####` homebrew
 * placeholder every homebrew shares) falls back to the file name, or the art
 * would show up on all of them.
 */
export function resolveArtTarget(
  game: LibraryFile,
  code: string | null,
  index: ArtIndex,
): ArtTarget {
  const userName = `${game.fileName}.bmp`;
  if (index.user.has(userName.toLowerCase())) return { dir: 'user', name: userName };
  if (game.system.coverKeying === 'gamecode' && code !== null && isUsableGameCode(code)) {
    return { dir: gamecodeDir(game.system), name: `${code.toUpperCase()}.bmp` };
  }
  return { dir: 'user', name: userName };
}
