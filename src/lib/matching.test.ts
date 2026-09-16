import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REGION_PREFS,
  isDegenerateTitle,
  normalizeTitle,
  pickBoxart,
  REGION_PREFS_BY_GBA_CODE,
  buildCatalogIndex,
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

  it('refuses to guess from a key too short to identify a game (issue #6)', () => {
    // A Chinese file name loses every character to normalizeTitle; the ascii
    // residue then prefixes dozens of catalog keys and the pick is arbitrary.
    // These are the covers the launcher actually fetched for these names.
    expect(
      pickBoxart('马里奥赛车DS', ['DS Yamamura Misa Suspense (Japan).png'], DEFAULT_REGION_PREFS),
    ).toBeNull();
    expect(
      pickBoxart(
        '口袋妖怪 黑2',
        ['2 in 1 - Best of Bibi Blocksberg (Germany).png'],
        DEFAULT_REGION_PREFS,
      ),
    ).toBeNull();
    expect(
      pickBoxart(
        '逆转裁判4',
        ['4 in 1 - Meine Tierarztpraxis (Germany).png'],
        DEFAULT_REGION_PREFS,
      ),
    ).toBeNull();
    expect(
      pickBoxart('牧场物语 DS', ['DS Yamamura Misa Suspense (Japan).png'], DEFAULT_REGION_PREFS),
    ).toBeNull();
  });

  it('refuses a name that normalizes to nothing, even against a non-ascii entry', () => {
    // '' == '' says only that both names vanished, so it must not match.
    expect(pickBoxart('超级公主桃子', ['ゼルダの伝説.png'], DEFAULT_REGION_PREFS)).toBeNull();
    expect(
      pickBoxart('塞尔达传说 幻影沙漏', ['ゼルダの伝説.png'], DEFAULT_REGION_PREFS),
    ).toBeNull();
  });

  it('still takes an exact hit on a short key, since that one is not a guess', () => {
    expect(pickBoxart('Up', ['Up (Europe).png'], DEFAULT_REGION_PREFS)).toBe('Up (Europe).png');
    expect(pickBoxart('F1', ['F1 (Europe).png'], DEFAULT_REGION_PREFS)).toBe('F1 (Europe).png');
    expect(pickBoxart('N+', ['N+ (USA).png'], DEFAULT_REGION_PREFS)).toBe('N+ (USA).png');
  });

  it('keeps matching the games whose title is a number (no digits-only rule)', () => {
    // 720, 688, 007, 1942, 2010... the digits are the title, not a residue.
    expect(pickBoxart('720', ['720 Degrees (USA, Europe).png'], DEFAULT_REGION_PREFS)).toBe(
      '720 Degrees (USA, Europe).png',
    );
    expect(pickBoxart('688', ['688 Attack Sub (Europe).png'], DEFAULT_REGION_PREFS)).toBe(
      '688 Attack Sub (Europe).png',
    );
    expect(pickBoxart('1942', ['1942 (USA, Europe).png'], DEFAULT_REGION_PREFS)).toBe(
      '1942 (USA, Europe).png',
    );
  });

  it('prefers the release over a kiosk demo sharing its key (Mario Kart DS regression)', () => {
    // normalizeTitle drops the parenthesized groups, so both collapse to
    // 'mario kart ds' and the kiosk build sorted first in the catalog
    const catalog = [
      'Mario Kart DS (Europe) (Demo) (Kiosk, Multiplayer).png',
      'Mario Kart DS (Europe) (En,Fr,De,Es,It).png',
    ];
    expect(pickBoxart('Mario Kart DS', catalog, DEFAULT_REGION_PREFS)).toBe(
      'Mario Kart DS (Europe) (En,Fr,De,Es,It).png',
    );
  });

  it('keeps a beta rather than crossing regions for it (Marvel Super Heroes regression)', () => {
    // the catalog filed the US box under the beta's name and has nothing else
    // for that region, so avoiding the variant would cost the right region
    const catalog = [
      'Marvel Super Heroes - War of the Gems (Japan).png',
      'Marvel Super Heroes - War of the Gems (USA) (Beta).png',
    ];
    expect(
      pickBoxart('Marvel Super Heroes - War of the Gems', catalog, REGION_PREFS_BY_GBA_CODE['E']),
    ).toBe('Marvel Super Heroes - War of the Gems (USA) (Beta).png');
  });

  it('reads the marker only inside parentheses, never in the title', () => {
    // real retail games whose name carries a marker word
    const catalog = ['Brain Boost - Beta Wave (USA).png'];
    expect(pickBoxart('Brain Boost - Beta Wave', catalog, DEFAULT_REGION_PREFS)).toBe(
      'Brain Boost - Beta Wave (USA).png',
    );
  });

  it('does not demote an unlicensed release, which is often the only one', () => {
    const catalog = ['Tanglewood (Europe) (Unl).png', 'Tanglewood (Japan).png'];
    expect(pickBoxart('Tanglewood', catalog, DEFAULT_REGION_PREFS)).toBe(
      'Tanglewood (Europe) (Unl).png',
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

  it('returns identical results through a prebuilt CatalogIndex', () => {
    const index = buildCatalogIndex(catalog);
    for (const query of ['mario kart', 'zelda', '', 'POKÉMON', 'golden sub']) {
      expect(searchCatalog(index, query)).toEqual(searchCatalog(catalog, query));
    }
  });

  it('keeps ranking fuzzy hits when substring hits alone fill the limit', () => {
    // substring hits >= limit: fuzzy candidates must not appear, and order
    // must still be shortest-name first
    const many = ['Mario Golf.png', 'Mario Kart DS.png', 'Mario.png', 'Wario Land.png'];
    expect(searchCatalog(many, 'mario', 2)).toEqual(['Mario.png', 'Mario Golf.png']);
    // below the limit the fuzzy near match ('wario' vs 'mario') still ranks last
    expect(searchCatalog(many, 'mario', 4)).toEqual([
      'Mario.png',
      'Mario Golf.png',
      'Mario Kart DS.png',
      'Wario Land.png',
    ]);
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

describe('isDegenerateTitle', () => {
  it('flags a name that keeps nothing, or almost nothing, after normalizing', () => {
    expect(isDegenerateTitle('超级公主桃子')).toBe(true);
    expect(isDegenerateTitle('马里奥赛车DS')).toBe(true);
    expect(isDegenerateTitle('口袋妖怪 黑2')).toBe(true);
  });

  it('does not flag a name the matcher can work with', () => {
    expect(isDegenerateTitle('Mario Kart DS')).toBe(false);
    expect(isDegenerateTitle('720')).toBe(false);
    expect(isDegenerateTitle('Uno')).toBe(false);
  });

  it('flags the short names pickBoxart only accepts as exact hits', () => {
    // these still match, but through step 1, so the caller may look elsewhere
    expect(isDegenerateTitle('Up')).toBe(true);
    expect(isDegenerateTitle('N+')).toBe(true);
  });
});
