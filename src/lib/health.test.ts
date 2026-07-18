import { describe, expect, it } from 'vitest';
import {
  JUNK_DIR_NAMES,
  OPTIONAL_LOADER_FILES,
  REQUIRED_LOADER_FILES,
  findOrphanSaves,
  findOrphanUserCovers,
  isJunkFileName,
  isPreventionOnlyFsevents,
  missingLoaderFiles,
} from './health.ts';
import type { LibraryFile } from './sdcard.ts';
import { systemById } from './systems.ts';

/** Builds a LibraryFile for a real registry system (throws on unknown id). */
function rom(systemId: string, fileName: string): LibraryFile {
  const system = systemById(systemId);
  if (system === null) {
    throw new Error(`unknown system in test: ${systemId}`);
  }
  return { system, fileName, size: 0 };
}

describe('isJunkFileName', () => {
  it('flags AppleDouble resource forks (._*)', () => {
    expect(isJunkFileName('._Mario Kart DS (USA).nds')).toBe(true);
    expect(isJunkFileName('._.DS_Store')).toBe(true);
    expect(isJunkFileName('._')).toBe(true);
  });

  it('flags .DS_Store exactly', () => {
    expect(isJunkFileName('.DS_Store')).toBe(true);
    expect(isJunkFileName('.DS_Store.bak')).toBe(false);
    expect(isJunkFileName('DS_Store')).toBe(false);
  });

  it('never flags .metadata_never_index (intentional Spotlight-prevention marker)', () => {
    expect(isJunkFileName('.metadata_never_index')).toBe(false);
  });

  it('never flags other dotfiles or regular files', () => {
    expect(isJunkFileName('.gitignore')).toBe(false);
    expect(isJunkFileName('.nomedia')).toBe(false);
    expect(isJunkFileName('.hidden')).toBe(false);
    expect(isJunkFileName('Mario Kart DS (USA).nds')).toBe(false);
    expect(isJunkFileName('game_.sav')).toBe(false);
  });
});

describe('JUNK_DIR_NAMES', () => {
  it('lists exactly the four macOS volume-root directories', () => {
    expect(JUNK_DIR_NAMES).toEqual([
      '.Spotlight-V100',
      '.Trashes',
      '.fseventsd',
      '.TemporaryItems',
    ]);
  });
});

describe('isPreventionOnlyFsevents', () => {
  it('detects a directory holding only the no_log marker', () => {
    expect(isPreventionOnlyFsevents(['no_log'])).toBe(true);
  });

  it('matches no_log case-insensitively (FAT preserves but ignores case)', () => {
    expect(isPreventionOnlyFsevents(['NO_LOG'])).toBe(true);
  });

  it('treats an empty directory as plain junk', () => {
    expect(isPreventionOnlyFsevents([])).toBe(false);
  });

  it('treats a directory with real event logs as junk, even next to no_log', () => {
    expect(isPreventionOnlyFsevents(['no_log', '0000000012345678'])).toBe(false);
    expect(isPreventionOnlyFsevents(['fseventsd-uuid'])).toBe(false);
  });
});

describe('missingLoaderFiles', () => {
  it('reports every loader file missing on an empty _pico', () => {
    expect(missingLoaderFiles([])).toEqual({
      required: [...REQUIRED_LOADER_FILES],
      optional: [...OPTIONAL_LOADER_FILES],
    });
  });

  it('reports nothing missing when all files are present', () => {
    const entries = [...REQUIRED_LOADER_FILES, ...OPTIONAL_LOADER_FILES, 'settings.json'];
    expect(missingLoaderFiles(entries)).toEqual({ required: [], optional: [] });
  });

  it('matches presence case-insensitively', () => {
    const entries = ['PICOLOADER7.BIN', 'picoloader9.bin', 'APlist.bin', 'SaveList.BIN'];
    expect(missingLoaderFiles(entries)).toEqual({
      required: [],
      optional: [...OPTIONAL_LOADER_FILES],
    });
  });

  it('splits missing names by severity, in canonical spelling', () => {
    const entries = ['picoLoader7.bin', 'aplist.bin', 'biosnds7.rom'];
    expect(missingLoaderFiles(entries)).toEqual({
      required: ['picoLoader9.bin', 'savelist.bin'],
      optional: ['patchlist.bin'],
    });
  });
});

describe('findOrphanSaves', () => {
  it('keeps saves whose base name matches a game in the same dir, case-insensitively', () => {
    const games = [rom('nds', 'Mario Kart DS (USA).nds')];
    const saves = [{ gamesDir: 'nds', name: 'MARIO KART DS (usa).SAV' }];
    expect(findOrphanSaves(games, saves)).toEqual([]);
  });

  it('reports saves that match no game in their dir', () => {
    const games = [rom('nds', 'Mario Kart DS (USA).nds')];
    const saves = [
      { gamesDir: 'nds', name: 'Mario Kart DS (USA).sav' },
      { gamesDir: 'nds', name: 'Deleted Game (USA).sav' },
    ];
    expect(findOrphanSaves(games, saves)).toEqual([
      { gamesDir: 'nds', name: 'Deleted Game (USA).sav' },
    ]);
  });

  it('matches across systems sharing a games dir (gb + gbc both live in gb/)', () => {
    const games = [rom('gb', 'Tetris (World).gb'), rom('gbc', 'Zelda DX (USA).gbc')];
    const saves = [
      { gamesDir: 'gb', name: 'Tetris (World).sav' },
      { gamesDir: 'gb', name: 'Zelda DX (USA).sav' },
      { gamesDir: 'gb', name: 'Gone (USA).sav' },
    ];
    expect(findOrphanSaves(games, saves)).toEqual([{ gamesDir: 'gb', name: 'Gone (USA).sav' }]);
  });

  it('does not let a game in one dir claim a same-named save in another dir', () => {
    const games = [rom('nds', 'Metroid (USA).nds')];
    const saves = [{ gamesDir: 'gba', name: 'Metroid (USA).sav' }];
    expect(findOrphanSaves(games, saves)).toEqual(saves);
  });

  it('keeps saves named after the full ROM file name (Game.nds.sav scheme)', () => {
    const games = [rom('nds', 'Mario Kart DS (USA).nds')];
    const saves = [{ gamesDir: 'nds', name: 'Mario Kart DS (USA).nds.sav' }];
    expect(findOrphanSaves(games, saves)).toEqual([]);
  });

  it('ignores non-.sav files entirely', () => {
    const saves = [
      { gamesDir: 'nds', name: 'notes.txt' },
      { gamesDir: 'nds', name: 'Orphan.sav.bak' },
    ];
    expect(findOrphanSaves([], saves)).toEqual([]);
  });

  it('reports every save in a dir that has no games at all', () => {
    const saves = [{ gamesDir: 'snes', name: 'Old Game.sav' }];
    expect(findOrphanSaves([], saves)).toEqual(saves);
  });
});

describe('findOrphanUserCovers', () => {
  const games = [rom('gb', 'Tetris (World).gb'), rom('snes', 'Chrono Trigger (USA).sfc')];

  it('keeps covers named <game fileName>.bmp, case-insensitively', () => {
    const covers = ['Tetris (World).gb.bmp', 'CHRONO TRIGGER (usa).SFC.BMP'];
    expect(findOrphanUserCovers(covers, games)).toEqual([]);
  });

  it('reports covers matching no game file name', () => {
    const covers = ['Tetris (World).gb.bmp', 'Deleted Game (USA).gb.bmp'];
    expect(findOrphanUserCovers(covers, games)).toEqual(['Deleted Game (USA).gb.bmp']);
  });

  it('does not match on base name alone: the .bmp must wrap the full file name', () => {
    // 'Tetris (World).bmp' misses the '.gb' — the launcher would never use it
    expect(findOrphanUserCovers(['Tetris (World).bmp'], games)).toEqual(['Tetris (World).bmp']);
  });

  it('skips junk names and non-bmp files', () => {
    const covers = ['._Tetris (World).gb.bmp', '.DS_Store', 'readme.txt'];
    expect(findOrphanUserCovers(covers, games)).toEqual([]);
  });

  it('reports every cover when there are no games', () => {
    expect(findOrphanUserCovers(['Lost.gb.bmp'], [])).toEqual(['Lost.gb.bmp']);
  });
});

describe('findOrphanSaves directory casing', () => {
  it('joins games and saves case-insensitively across dir names', () => {
    // FAT preserves case: a card can carry Games/NDS while the registry says 'nds'
    const games = [rom('nds', 'Zelda.nds')];
    const saves = [{ gamesDir: 'NDS', name: 'Zelda.sav' }];
    expect(findOrphanSaves(games, saves)).toHaveLength(0);
  });
});
