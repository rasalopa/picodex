import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REGION_PREFS,
  normalizeTitle,
  pickBoxart,
  REGION_PREFS_BY_GBA_CODE,
  searchCatalog,
  similarityRatio,
} from './matching';

describe('normalizeTitle', () => {
  it('lowercases and maps non-alphanumeric runs to single spaces', () => {
    expect(normalizeTitle('Phalanx - The Enforce Fighter A-144')).toBe(
      'phalanx enforce fighter 144',
    );
  });

  it('removes parenthesized groups', () => {
    expect(normalizeTitle('Golden Sun (USA) (Rev 1)')).toBe('golden sun');
  });

  it('strips diacritics via NFKD and drops remaining non-ASCII', () => {
    expect(normalizeTitle('Pokémon Édition Bleue')).toBe('pokemon edition bleue');
    expect(normalizeTitle('El Niño ★ Dorado')).toBe('nino dorado');
  });

  it('drops English and Spanish articles as whole words only', () => {
    expect(normalizeTitle('El Rey León')).toBe('rey leon');
    expect(normalizeTitle('Los Simpson: The Game')).toBe('simpson game');
    // 'las'/'the'/'an' inside words must survive.
    expect(normalizeTitle('Lasagna Theme Anthem')).toBe('lasagna theme anthem');
  });

  it('collapses whitespace', () => {
    expect(normalizeTitle('  Golden   Sun  ')).toBe('golden sun');
  });

  it('equates the No-Intro comma style with the plain title (Zelda regression)', () => {
    expect(normalizeTitle('The Legend of Zelda - A Link to the Past & Four Swords')).toBe(
      normalizeTitle('Legend of Zelda, The - A Link to the Past _ Four Swords (Europe)'),
    );
  });
});

describe('similarityRatio', () => {
  // Golden vectors computed with Python difflib.SequenceMatcher(None, a, b).ratio().
  const golden: Array<[string, string, number]> = [
    ['megaman zero 1', 'megaman zero 4', 0.9285714285714286],
    ['megaman zero 1', 'megaman zero', 0.9230769230769231],
    ['megaman zero 1', 'megaman zero 2', 0.9285714285714286],
    ['golden sun 2 edad perdida', 'golden sun edad perdida', 0.9583333333333334],
    ['golden sun 2 edad perdida', 'golden sun', 0.5714285714285714],
    ['phalanx enforce fighter 144', 'phalanx', 0.4117647058823529],
    ['abcd', 'bcde', 0.75],
    ['abcdefg', 'gfedcba', 0.14285714285714285],
    ['private', 'pirate', 0.7692307692307693],
    ['kitten', 'sitting', 0.6153846153846154],
    ['qabxcd', 'abycdf', 0.6666666666666666],
  ];

  it.each(golden)('matches difflib for (%s, %s)', (a, b, expected) => {
    expect(similarityRatio(a, b)).toBeCloseTo(expected, 12);
  });

  it('returns 1 for identical strings and for two empty strings', () => {
    expect(similarityRatio('golden sun', 'golden sun')).toBe(1);
    expect(similarityRatio('', '')).toBe(1);
  });

  it('returns 0 when one string is empty', () => {
    expect(similarityRatio('abc', '')).toBe(0);
    expect(similarityRatio('', 'abc')).toBe(0);
  });

  it('is symmetric on the golden pairs', () => {
    for (const [a, b] of golden) {
      expect(similarityRatio(b, a)).toBeCloseTo(similarityRatio(a, b), 12);
    }
  });

  it('rates a wrong sequel above the cutoff — why prefix must run before fuzzy', () => {
    // Fuzzy alone would accept "megaman zero 4" (>= 0.85) and even prefer
    // "megaman zero 2" over the correct base title "megaman zero".
    expect(similarityRatio('megaman zero 1', 'megaman zero 4')).toBeGreaterThanOrEqual(0.85);
    expect(similarityRatio('megaman zero 1', 'megaman zero 2')).toBeGreaterThan(
      similarityRatio('megaman zero 1', 'megaman zero'),
    );
  });
});

describe('pickBoxart', () => {
  it('prefers the whole-word prefix over a fuzzy sequel (Megaman Zero regression)', () => {
    const catalog = [
      'Megaman Zero (USA) (Virtual Console).png',
      'Megaman Zero 2 (USA).png',
      'Megaman Zero 4 (Europe).png',
    ];
    expect(pickBoxart('Megaman Zero 1', catalog, DEFAULT_REGION_PREFS)).toBe(
      'Megaman Zero (USA) (Virtual Console).png',
    );
  });

  it('matches a long subtitle to its bare base title via prefix (Phalanx regression)', () => {
    expect(
      pickBoxart(
        'Phalanx - The Enforce Fighter A-144',
        ['Phalanx (Europe).png'],
        DEFAULT_REGION_PREFS,
      ),
    ).toBe('Phalanx (Europe).png');
  });

  it('matches the No-Intro comma style exactly via normalization (Zelda regression)', () => {
    const catalog = [
      'Legend of Zelda, The - Minish Cap (Europe).png',
      'Legend of Zelda, The - A Link to the Past _ Four Swords (Europe).png',
    ];
    expect(
      pickBoxart(
        'The Legend of Zelda - A Link to the Past & Four Swords',
        catalog,
        DEFAULT_REGION_PREFS,
      ),
    ).toBe('Legend of Zelda, The - A Link to the Past _ Four Swords (Europe).png');
  });

  it('lets a close fuzzy match beat a short generic prefix (Golden Sun 2 regression)', () => {
    const catalog = ['Golden Sun - La Edad Perdida (Spain).png', 'Golden Sun (USA).png'];
    expect(pickBoxart('Golden Sun 2 - La Edad Perdida', catalog, DEFAULT_REGION_PREFS)).toBe(
      'Golden Sun - La Edad Perdida (Spain).png',
    );
  });

  it('honors region preference order among same-key candidates', () => {
    const catalog = ['Golden Sun (Japan).png', 'Golden Sun (USA).png', 'Golden Sun (Europe).png'];
    expect(pickBoxart('Golden Sun', catalog, DEFAULT_REGION_PREFS)).toBe('Golden Sun (Europe).png');
    expect(pickBoxart('Golden Sun', catalog, REGION_PREFS_BY_GBA_CODE['E'])).toBe(
      'Golden Sun (USA).png',
    );
    expect(pickBoxart('Golden Sun', catalog, REGION_PREFS_BY_GBA_CODE['J'])).toBe(
      'Golden Sun (Japan).png',
    );
  });

  it('applies region preferences to prefix-derived candidates too', () => {
    const catalog = ['Megaman Zero (Japan).png', 'Megaman Zero (Europe).png'];
    expect(pickBoxart('Megaman Zero 1', catalog, DEFAULT_REGION_PREFS)).toBe(
      'Megaman Zero (Europe).png',
    );
  });

  it('falls back to the first candidate when no region preference matches', () => {
    const catalog = ['Golden Sun (Brazil).png', 'Golden Sun (Korea).png'];
    expect(pickBoxart('Golden Sun', catalog, DEFAULT_REGION_PREFS)).toBe('Golden Sun (Brazil).png');
  });

  it('picks the longest key among multiple prefix relations', () => {
    const catalog = ['Mega Man (USA).png', 'Mega Man Battle Network (USA).png'];
    expect(pickBoxart('Mega Man Battle Network 2', catalog, DEFAULT_REGION_PREFS)).toBe(
      'Mega Man Battle Network (USA).png',
    );
  });

  it('uses the reverse prefix relation (catalog key extends the title) as last resort', () => {
    // ratio('castlevania', 'castlevania circle of moon') ~= 0.59 < 0.85, so
    // this resolves through the deferred-prefix fallback after fuzzy fails.
    const catalog = ['Castlevania - Circle of the Moon (USA).png'];
    expect(pickBoxart('Castlevania', catalog, DEFAULT_REGION_PREFS)).toBe(
      'Castlevania - Circle of the Moon (USA).png',
    );
  });

  it('returns null when nothing relates', () => {
    const catalog = ['Golden Sun (USA).png', 'Phalanx (Europe).png'];
    expect(pickBoxart('Totally Unrelated Game', catalog, DEFAULT_REGION_PREFS)).toBeNull();
    expect(pickBoxart('Golden Sun', [], DEFAULT_REGION_PREFS)).toBeNull();
  });
});

describe('searchCatalog', () => {
  const catalog = [
    'Mario Party DS (USA).png',
    'Mario Kart DS (USA).png',
    'Golden Sun (USA).png',
    'Zelda II - The Adventure of Link (USA).png',
    'Zelda (USA).png',
  ];

  it('ranks substring hits above fuzzy near-matches', () => {
    // 'mario party ds' does not contain 'mario kart' but is similar enough
    // (ratio >= 0.5) to surface as a near match after the substring hit.
    expect(searchCatalog(catalog, 'mario kart')).toEqual([
      'Mario Kart DS (USA).png',
      'Mario Party DS (USA).png',
    ]);
  });

  it('orders substring ties shorter-name first, then alphabetical', () => {
    const results = searchCatalog(catalog, 'zelda');
    expect(results[0]).toBe('Zelda (USA).png');
    expect(results[1]).toBe('Zelda II - The Adventure of Link (USA).png');
    // pure alphabetical tie between equal-length names
    expect(searchCatalog(['Mario B (USA).png', 'Mario A (USA).png'], 'mario')).toEqual([
      'Mario A (USA).png',
      'Mario B (USA).png',
    ]);
  });

  it('returns the first entries alphabetically for an empty or whitespace query', () => {
    expect(searchCatalog(['B.png', 'C.png', 'A.png'], '')).toEqual(['A.png', 'B.png', 'C.png']);
    expect(searchCatalog(['B.png', 'C.png', 'A.png'], '   ', 2)).toEqual(['A.png', 'B.png']);
  });

  it('respects the limit', () => {
    expect(searchCatalog(catalog, 'mario', 1)).toEqual(['Mario Kart DS (USA).png']);
    const many = ['Mario 1.png', 'Mario 2.png', 'Mario 3.png', 'Mario 4.png'];
    expect(searchCatalog(many, 'mario', 3)).toEqual(['Mario 1.png', 'Mario 2.png', 'Mario 3.png']);
  });

  it('matches case- and diacritic-insensitively', () => {
    expect(searchCatalog(['Pokemon Edicion Rubi (Spain).png'], 'POKÉMON Edición')).toEqual([
      'Pokemon Edicion Rubi (Spain).png',
    ]);
  });

  it('never returns duplicates, even for duplicate catalog entries', () => {
    expect(searchCatalog(['Zelda (USA).png', 'Zelda (USA).png'], 'zelda')).toEqual([
      'Zelda (USA).png',
    ]);
    expect(searchCatalog(['Zelda (USA).png', 'Zelda (USA).png'], '')).toEqual(['Zelda (USA).png']);
  });
});

describe('region preference tables', () => {
  it('ports DEFAULT_PREF from fetch_covers_gba.py', () => {
    expect(DEFAULT_REGION_PREFS).toEqual(['(Europe', '(USA', '(World']);
  });

  it('ports REGION_PREF by 4th gamecode letter from fetch_covers_gba.py', () => {
    expect(REGION_PREFS_BY_GBA_CODE).toEqual({
      E: ['(USA', '(World', '(Europe'],
      P: ['(Europe', '(World', '(USA'],
      S: ['(Spain', '(Europe', '(USA'],
      F: ['(France', '(Europe', '(USA'],
      D: ['(Germany', '(Europe', '(USA'],
      I: ['(Italy', '(Europe', '(USA'],
      J: ['(Japan', '(USA', '(Europe'],
    });
  });
});
