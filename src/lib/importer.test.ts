import { describe, expect, it } from 'vitest';
import { planImport } from './importer.ts';
import type { LibraryFile } from './sdcard.ts';
import { systemById, type System } from './systems.ts';

function sys(id: string): System {
  const system = systemById(id);
  if (system === null) throw new Error(`unknown system in fixture: ${id}`);
  return system;
}

function lib(id: string, fileName: string): LibraryFile {
  return { system: sys(id), fileName, size: 0 };
}

describe('planImport', () => {
  it('returns an empty plan for an empty drop', () => {
    expect(planImport([], [])).toEqual([]);
    expect(planImport([], [lib('nds', 'Existing Game.nds')])).toEqual([]);
  });

  it('classifies a mixed drop, preserving input order and names', () => {
    const dropped = [
      'Mario Kart DS (USA).nds',
      'Pokemon Emerald (USA).gba',
      'readme.txt',
      '.DS_Store',
      '._Mario Kart DS (USA).nds',
      'Mario Kart DS (USA).nds',
    ];
    const plan = planImport(dropped, [lib('nds', 'Existing Game.nds')]);

    expect(plan.map((item) => item.fileName)).toEqual(dropped);
    expect(plan.map((item) => item.verdict)).toEqual([
      'add',
      'add',
      'unknown-type',
      'unknown-type',
      'unknown-type',
      'duplicate',
    ]);
    expect(plan.map((item) => item.system?.id ?? null)).toEqual([
      'nds',
      'gba',
      null,
      null,
      null,
      'nds',
    ]);
  });

  it('rejects junk names starting with . or ._ with no system attached', () => {
    const plan = planImport(['.DS_Store', '._Zelda.gba', '.nds'], []);
    for (const item of plan) {
      expect(item.verdict).toBe('unknown-type');
      expect(item.system).toBeNull();
    }
  });

  it('rejects names without a known ROM extension', () => {
    const plan = planImport(['README', 'game.iso', 'cover.png'], []);
    expect(plan.map((item) => item.verdict)).toEqual([
      'unknown-type',
      'unknown-type',
      'unknown-type',
    ]);
    expect(plan.every((item) => item.system === null)).toBe(true);
  });

  it('detects duplicates against the existing library case-insensitively', () => {
    const existing = [lib('nds', 'Mario Kart DS (USA).nds'), lib('gbc', 'Zelda DX.gbc')];
    const plan = planImport(['mario kart ds (usa).NDS', 'ZELDA dx.GBC', 'Zelda DX.gb'], existing);

    expect(plan[0].verdict).toBe('duplicate');
    expect(plan[0].system?.id).toBe('nds');
    expect(plan[1].verdict).toBe('duplicate');
    expect(plan[1].system?.id).toBe('gbc');
    // Lands in the same shared gb/ folder but under a different file name.
    expect(plan[2].verdict).toBe('add');
    expect(plan[2].system?.id).toBe('gb');
  });

  it('dedupes repeated names within one drop (second occurrence is a duplicate)', () => {
    const plan = planImport(['Tetris.gb', 'TETRIS.GB', 'Tetris.gb'], []);
    expect(plan.map((item) => item.verdict)).toEqual(['add', 'duplicate', 'duplicate']);
    expect(plan.map((item) => item.system?.id)).toEqual(['gb', 'gb', 'gb']);
  });

  it('keeps same-named files targeting different games folders independent', () => {
    // Same base name, different extensions → different systems and folders.
    const plan = planImport(['Tetris.gb', 'Tetris.nes'], []);
    expect(plan.map((item) => item.verdict)).toEqual(['add', 'add']);
    expect(plan.map((item) => item.system?.gamesDir)).toEqual(['gb', 'nes']);
  });
});
