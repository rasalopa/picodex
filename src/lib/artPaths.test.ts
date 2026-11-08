import { describe, expect, it } from 'vitest';
import { canShareArt, findArt, gamecodeDir, resolveArtTarget, type ArtIndex } from './artPaths';
import type { LibraryFile } from './sdcard';
import { systemById } from './systems';

function game(systemId: string, fileName: string): LibraryFile {
  const system = systemById(systemId);
  if (system === null) throw new Error(`unknown system ${systemId}`);
  return { system, fileName, size: 0, path: ['Games', system.gamesDir] };
}

function index(parts: Partial<Record<keyof ArtIndex, string[]>> = {}): ArtIndex {
  return {
    nds: new Set((parts.nds ?? []).map((n) => n.toLowerCase())),
    gba: new Set((parts.gba ?? []).map((n) => n.toLowerCase())),
    user: new Set((parts.user ?? []).map((n) => n.toLowerCase())),
  };
}

describe('gamecodeDir', () => {
  it('sends NDS to nds/ and every other gamecode system to gba/', () => {
    expect(gamecodeDir(game('nds', 'a.nds').system)).toBe('nds');
    expect(gamecodeDir(game('gba', 'a.gba').system)).toBe('gba');
  });
});

describe('findArt', () => {
  it('prefers user/<file>.<ext> over the gamecode file, like the launcher', () => {
    const idx = index({ user: ['Metroid Fusion.gba.bmp'], gba: ['AMTP.bmp'] });
    expect(findArt(game('gba', 'Metroid Fusion.gba'), 'AMTP', idx, 'bmp')).toEqual({
      dir: 'user',
      name: 'Metroid Fusion.gba.bmp',
    });
  });

  it('falls back to the gamecode folder with the code upper-cased', () => {
    const idx = index({ gba: ['AMTP.bmp'] });
    expect(findArt(game('gba', 'Metroid Fusion.gba'), 'amtp', idx, 'bmp')).toEqual({
      dir: 'gba',
      name: 'AMTP.bmp',
    });
  });

  it('matches names case-insensitively, as FAT does', () => {
    const idx = index({ user: ['metroid fusion.GBA.BMP'] });
    expect(findArt(game('gba', 'Metroid Fusion.gba'), null, idx, 'bmp')?.dir).toBe('user');
  });

  it('uses the extension it is asked for (banners are .bnr)', () => {
    const idx = index({ gba: ['AMTP.bnr'] });
    expect(findArt(game('gba', 'Metroid Fusion.gba'), 'AMTP', idx, 'bnr')?.name).toBe('AMTP.bnr');
    expect(findArt(game('gba', 'Metroid Fusion.gba'), 'AMTP', idx, 'bmp')).toBeNull();
  });

  it('never consults the gamecode folder for filename-keyed systems', () => {
    const idx = index({ gba: ['ABCD.bmp'] });
    expect(findArt(game('gb', 'Tetris.gb'), 'ABCD', idx, 'bmp')).toBeNull();
  });

  it('returns null without a code and without a user file', () => {
    expect(findArt(game('nds', 'x.nds'), null, index({ nds: ['ABCD.bmp'] }), 'bmp')).toBeNull();
  });
});

describe('resolveArtTarget', () => {
  it('writes the gamecode file for NDS and GBA games with a usable code', () => {
    expect(resolveArtTarget(game('nds', 'Mario Kart DS.nds'), 'amce', index())).toEqual({
      dir: 'nds',
      name: 'AMCE.bmp',
    });
    expect(resolveArtTarget(game('gba', 'Metroid Fusion.gba'), 'AMTP', index())).toEqual({
      dir: 'gba',
      name: 'AMTP.bmp',
    });
  });

  it('replaces an existing user/ override instead of writing a shadowed gamecode file', () => {
    const idx = index({ user: ['Metroid Fusion.gba.bmp'] });
    expect(resolveArtTarget(game('gba', 'Metroid Fusion.gba'), 'AMTP', idx)).toEqual({
      dir: 'user',
      name: 'Metroid Fusion.gba.bmp',
    });
  });

  it('keys homebrew with the #### placeholder by file name, never by code', () => {
    expect(resolveArtTarget(game('nds', 'GBARunner3.nds'), '####', index())).toEqual({
      dir: 'user',
      name: 'GBARunner3.nds.bmp',
    });
  });

  it('keys filename systems and unreadable codes by file name', () => {
    expect(resolveArtTarget(game('gb', 'Tetris.gb'), null, index()).dir).toBe('user');
    expect(resolveArtTarget(game('gba', 'broken.gba'), null, index())).toEqual({
      dir: 'user',
      name: 'broken.gba.bmp',
    });
  });

  it('writes the gamecode file for the shared scope even when an override exists', () => {
    const idx = index({ user: ['Metroid Fusion.gba.bmp'] });
    expect(resolveArtTarget(game('gba', 'Metroid Fusion.gba'), 'AMTP', idx, 'shared')).toEqual({
      dir: 'gba',
      name: 'AMTP.bmp',
    });
  });

  it('writes the per-file name for the game scope, whatever the code or index says', () => {
    const idx = index({ gba: ['AMTP.bmp'] });
    expect(resolveArtTarget(game('gba', 'Metroid Fusion.gba'), 'AMTP', idx, 'game')).toEqual({
      dir: 'user',
      name: 'Metroid Fusion.gba.bmp',
    });
    expect(resolveArtTarget(game('nds', 'Mario Kart DS.nds'), 'AMCE', index(), 'game')).toEqual({
      dir: 'user',
      name: 'Mario Kart DS.nds.bmp',
    });
  });

  it('falls back to the per-file name for a shared scope without a usable code', () => {
    expect(resolveArtTarget(game('nds', 'GBARunner3.nds'), '####', index(), 'shared')).toEqual({
      dir: 'user',
      name: 'GBARunner3.nds.bmp',
    });
    expect(resolveArtTarget(game('gba', 'broken.gba'), null, index(), 'shared').dir).toBe('user');
    expect(resolveArtTarget(game('gb', 'Tetris.gb'), 'ABCD', index(), 'shared').dir).toBe('user');
  });
});

describe('canShareArt', () => {
  it('accepts gamecode-keyed systems with a usable code, case included', () => {
    expect(canShareArt(game('nds', 'Mario Kart DS.nds'), 'AMCE')).toBe(true);
    expect(canShareArt(game('gba', 'Metroid Fusion.gba'), 'amtp')).toBe(true);
  });

  it('refuses filename systems, unreadable codes and the homebrew placeholder', () => {
    expect(canShareArt(game('gb', 'Tetris.gb'), 'ABCD')).toBe(false);
    expect(canShareArt(game('gba', 'broken.gba'), null)).toBe(false);
    expect(canShareArt(game('nds', 'GBARunner3.nds'), '####')).toBe(false);
  });
});
