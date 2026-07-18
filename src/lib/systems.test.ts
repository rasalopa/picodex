import { describe, expect, it } from 'vitest';
import { SYSTEMS, systemById, systemForExtension } from './systems.ts';

describe('SYSTEMS registry', () => {
  it('contains the 13 launcher systems with unique ids', () => {
    expect(SYSTEMS).toHaveLength(13);
    const ids = SYSTEMS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining([
        'nds',
        'gba',
        'gb',
        'gbc',
        'gen',
        'sms',
        'gg',
        'nes',
        'snes',
        'ws',
        'wsc',
        'ngp',
        'ngc',
      ]),
    );
  });

  it('declares every extension lowercase, dot-prefixed and unique across systems', () => {
    const seen = new Set<string>();
    for (const system of SYSTEMS) {
      expect(system.extensions.length).toBeGreaterThan(0);
      for (const ext of system.extensions) {
        expect(ext).toMatch(/^\.[a-z0-9]+$/);
        expect(seen.has(ext)).toBe(false);
        seen.add(ext);
      }
    }
  });

  it('matches the libretro repos from the launcher tooling (fetch_covers.py)', () => {
    const repos = Object.fromEntries(SYSTEMS.map((s) => [s.id, s.libretroRepo]));
    expect(repos).toEqual({
      nds: 'Nintendo_-_Nintendo_DS',
      gba: 'Nintendo_-_Game_Boy_Advance',
      gb: 'Nintendo_-_Game_Boy',
      gbc: 'Nintendo_-_Game_Boy_Color',
      gen: 'Sega_-_Mega_Drive_-_Genesis',
      sms: 'Sega_-_Master_System_-_Mark_III',
      gg: 'Sega_-_Game_Gear',
      nes: 'Nintendo_-_Nintendo_Entertainment_System',
      snes: 'Nintendo_-_Super_Nintendo_Entertainment_System',
      ws: 'Bandai_-_WonderSwan',
      wsc: 'Bandai_-_WonderSwan_Color',
      ngp: 'SNK_-_Neo_Geo_Pocket',
      ngc: 'SNK_-_Neo_Geo_Pocket_Color',
    });
  });

  it('shares gamesDir between color/monochrome handheld variants (as on the SD)', () => {
    expect(systemById('gb')?.gamesDir).toBe('gb');
    expect(systemById('gbc')?.gamesDir).toBe('gb');
    expect(systemById('ws')?.gamesDir).toBe('ws');
    expect(systemById('wsc')?.gamesDir).toBe('ws');
    expect(systemById('ngp')?.gamesDir).toBe('ngp');
    expect(systemById('ngc')?.gamesDir).toBe('ngp');
  });

  it('keys covers by gamecode only for nds and gba', () => {
    const byGamecode = SYSTEMS.filter((s) => s.coverKeying === 'gamecode').map((s) => s.id);
    expect(byGamecode.sort()).toEqual(['gba', 'nds']);
    for (const system of SYSTEMS) {
      if (system.id !== 'nds' && system.id !== 'gba') {
        expect(system.coverKeying).toBe('filename');
      }
    }
  });
});

describe('systemById', () => {
  it('returns the full system definition', () => {
    expect(systemById('nds')).toMatchObject({
      id: 'nds',
      gamesDir: 'nds',
      extensions: ['.nds', '.dsi', '.srl'],
      libretroRepo: 'Nintendo_-_Nintendo_DS',
      coverKeying: 'gamecode',
    });
    expect(systemById('gba')).toMatchObject({
      id: 'gba',
      gamesDir: 'gba',
      extensions: ['.gba', '.agb'],
      libretroRepo: 'Nintendo_-_Game_Boy_Advance',
      coverKeying: 'gamecode',
    });
  });

  it('returns null for unknown ids', () => {
    expect(systemById('n64')).toBeNull();
    expect(systemById('')).toBeNull();
    expect(systemById('NDS')).toBeNull(); // ids are exact, lowercase
  });
});

describe('systemForExtension', () => {
  it('resolves files by extension', () => {
    expect(systemForExtension('Mario Kart DS (USA).nds')?.id).toBe('nds');
    expect(systemForExtension('game.dsi')?.id).toBe('nds');
    expect(systemForExtension('game.srl')?.id).toBe('nds');
    expect(systemForExtension('Pokemon Emerald.gba')?.id).toBe('gba');
    expect(systemForExtension('game.agb')?.id).toBe('gba');
    expect(systemForExtension('Sonic.md')?.id).toBe('gen');
    expect(systemForExtension('Sonic 2.gen')?.id).toBe('gen');
    expect(systemForExtension('game.sfc')?.id).toBe('snes');
    expect(systemForExtension('game.smc')?.id).toBe('snes');
  });

  it('is case-insensitive on the extension', () => {
    expect(systemForExtension('GAME.NDS')?.id).toBe('nds');
    expect(systemForExtension('Pokemon.GbA')?.id).toBe('gba');
  });

  it('distinguishes color variants that share a folder', () => {
    expect(systemForExtension('Tetris.gb')?.id).toBe('gb');
    expect(systemForExtension('Shantae.gbc')?.id).toBe('gbc');
    expect(systemForExtension('game.ws')?.id).toBe('ws');
    expect(systemForExtension('game.wsc')?.id).toBe('wsc');
    expect(systemForExtension('game.ngp')?.id).toBe('ngp');
    expect(systemForExtension('game.ngc')?.id).toBe('ngc');
  });

  it('only matches the last extension of the file name', () => {
    // Regression: backup copies must not be misdetected by an inner extension.
    expect(systemForExtension('game.nds.bak')).toBeNull();
    expect(systemForExtension('archive.gba.zip')).toBeNull();
  });

  it('returns null for unknown extensions and extension-less names', () => {
    expect(systemForExtension('notes.txt')).toBeNull();
    expect(systemForExtension('game.zip')).toBeNull();
    expect(systemForExtension('README')).toBeNull();
    expect(systemForExtension('')).toBeNull();
    expect(systemForExtension('.nds')).toBeNull(); // dotfile, no base name
    expect(systemForExtension('trailingdot.')).toBeNull();
  });
});
