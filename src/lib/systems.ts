/**
 * Registry of the game systems supported by the DSpico launcher.
 *
 * Data sourced from the launcher tooling (`tools/fetch_covers.py` SYSTEMS
 * dict) plus the two gamecode-keyed systems (NDS, GBA) handled natively by
 * the launcher / `tools/fetch_covers_gba.py`.
 */

/**
 * How cover art files for a system are keyed on the SD card:
 * - `'gamecode'`: `_pico/covers/<gamesDir>/<GAMECODE>.bmp` (4-char code from
 *   the ROM header).
 * - `'filename'`: `_pico/covers/user/<full file name>.bmp`.
 */
export type CoverKeying = 'gamecode' | 'filename';

/** Describes one console/handheld system supported by the DSpico launcher. */
export interface System {
  /** Stable identifier (slug), unique across the registry. */
  readonly id: string;
  /** Human-readable name for the UI. */
  readonly label: string;
  /** Folder name under `Games/` on the SD card where ROMs of this system live. */
  readonly gamesDir: string;
  /** ROM file extensions, lowercase and dot-prefixed (e.g. `'.nds'`). */
  readonly extensions: readonly string[];
  /** Repository name under github.com/libretro-thumbnails holding the boxarts. */
  readonly libretroRepo: string;
  /** How cover files for this system are keyed on the SD card. */
  readonly coverKeying: CoverKeying;
}

/**
 * All systems known to PicoDex, in display order (native DS systems first).
 *
 * Note that some systems share a `gamesDir` (gb/gbc, ws/wsc, ngp/ngc): the
 * launcher stores both variants of those handhelds in a single folder.
 */
export const SYSTEMS: readonly System[] = [
  {
    id: 'nds',
    label: 'Nintendo DS',
    gamesDir: 'nds',
    extensions: ['.nds', '.dsi', '.srl'],
    libretroRepo: 'Nintendo_-_Nintendo_DS',
    coverKeying: 'gamecode',
  },
  {
    id: 'gba',
    label: 'Game Boy Advance',
    gamesDir: 'gba',
    extensions: ['.gba', '.agb'],
    libretroRepo: 'Nintendo_-_Game_Boy_Advance',
    coverKeying: 'gamecode',
  },
  {
    id: 'gb',
    label: 'Game Boy',
    gamesDir: 'gb',
    extensions: ['.gb'],
    libretroRepo: 'Nintendo_-_Game_Boy',
    coverKeying: 'filename',
  },
  {
    id: 'gbc',
    label: 'Game Boy Color',
    gamesDir: 'gb',
    extensions: ['.gbc'],
    libretroRepo: 'Nintendo_-_Game_Boy_Color',
    coverKeying: 'filename',
  },
  {
    id: 'gen',
    label: 'Mega Drive / Genesis',
    gamesDir: 'gen',
    extensions: ['.md', '.gen'],
    libretroRepo: 'Sega_-_Mega_Drive_-_Genesis',
    coverKeying: 'filename',
  },
  {
    id: 'sms',
    label: 'Master System',
    gamesDir: 'sms',
    extensions: ['.sms'],
    libretroRepo: 'Sega_-_Master_System_-_Mark_III',
    coverKeying: 'filename',
  },
  {
    id: 'gg',
    label: 'Game Gear',
    gamesDir: 'gg',
    extensions: ['.gg'],
    libretroRepo: 'Sega_-_Game_Gear',
    coverKeying: 'filename',
  },
  {
    id: 'nes',
    label: 'NES',
    gamesDir: 'nes',
    extensions: ['.nes'],
    libretroRepo: 'Nintendo_-_Nintendo_Entertainment_System',
    coverKeying: 'filename',
  },
  {
    id: 'snes',
    label: 'Super Nintendo',
    gamesDir: 'snes',
    extensions: ['.sfc', '.smc'],
    libretroRepo: 'Nintendo_-_Super_Nintendo_Entertainment_System',
    coverKeying: 'filename',
  },
  {
    id: 'ws',
    label: 'WonderSwan',
    gamesDir: 'ws',
    extensions: ['.ws'],
    libretroRepo: 'Bandai_-_WonderSwan',
    coverKeying: 'filename',
  },
  {
    id: 'wsc',
    label: 'WonderSwan Color',
    gamesDir: 'ws',
    extensions: ['.wsc'],
    libretroRepo: 'Bandai_-_WonderSwan_Color',
    coverKeying: 'filename',
  },
  {
    id: 'ngp',
    label: 'Neo Geo Pocket',
    gamesDir: 'ngp',
    extensions: ['.ngp'],
    libretroRepo: 'SNK_-_Neo_Geo_Pocket',
    coverKeying: 'filename',
  },
  {
    id: 'ngc',
    label: 'Neo Geo Pocket Color',
    gamesDir: 'ngp',
    extensions: ['.ngc'],
    libretroRepo: 'SNK_-_Neo_Geo_Pocket_Color',
    coverKeying: 'filename',
  },
];

/** Extension → system lookup table (extensions are unique across systems). */
const systemsByExtension = new Map<string, System>();
for (const system of SYSTEMS) {
  for (const extension of system.extensions) {
    systemsByExtension.set(extension, system);
  }
}

/**
 * Finds the system a file belongs to by its extension (case-insensitive).
 *
 * @param fileName File name such as `'Mario Kart DS (USA).nds'`.
 * @returns The matching system, or `null` when the file has no extension or
 *   the extension is not associated with any system.
 */
export function systemForExtension(fileName: string): System | null {
  const dot = fileName.lastIndexOf('.');
  // dot <= 0 means no extension, or a dotfile like '.nds' with no base name
  if (dot <= 0) {
    return null;
  }
  const extension = fileName.slice(dot).toLowerCase();
  return systemsByExtension.get(extension) ?? null;
}

/**
 * Looks up a system by its identifier.
 *
 * @param id System slug such as `'nds'` or `'gba'`.
 * @returns The matching system, or `null` when unknown.
 */
/**
 * Every system whose games live in `Games/<gamesDir>`, normally one.
 *
 * Three folders are shared by a base system and its Color variant - `gb` by Game
 * Boy and Game Boy Color, `ws` by WonderSwan and WonderSwan Color, `ngp` by Neo
 * Geo Pocket and its Color - because one emulator runs both and they are told
 * apart by file extension, not by folder.
 *
 * Anything that writes PER-FOLDER data needs this. `banner.bnr` above all: it
 * lives inside the folder, so there is one banner for both systems and changing
 * the icon of Game Boy necessarily changes Game Boy Color's too. That is not a
 * defect and cannot be avoided with this layout, but it does surprise people, so
 * the UI has to say it.
 *
 * @param gamesDir Folder name under `Games/`, matched case-insensitively (FAT).
 * @returns The systems sharing that folder, in {@link SYSTEMS} order.
 */
export function systemsSharingGamesDir(gamesDir: string): readonly System[] {
  const wanted = gamesDir.toLowerCase();
  return SYSTEMS.filter((system) => system.gamesDir.toLowerCase() === wanted);
}

export function systemById(id: string): System | null {
  return SYSTEMS.find((system) => system.id === id) ?? null;
}
