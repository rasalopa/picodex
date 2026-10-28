import { describe, expect, it } from 'vitest';
import {
  findEntry,
  gameDataTotals,
  isUsableGameCode,
  parseGameData,
  serializeGameData,
  setGameStats,
  sortedByLastPlayed,
  sortedByMostPlayed,
  toggleCompleted,
  toggleFavorite,
} from './gamedata';
import type { GameData, GameDataEntry } from './gamedata';

/** Joins pretty-JSON lines with the CRLF endings the launcher writes. */
function crlf(...lines: string[]): string {
  return lines.join('\r\n');
}

/**
 * A realistic file as `JsonGameDataService::SaveAsync` writes it: ArduinoJson
 * pretty format (2-space indent, ": " separator, CRLF), an open session, and
 * per-game keys omitted when falsy/empty.
 */
const launcherSample = crlf(
  '{',
  '  "games": {',
  '    "Mario Kart DS.nds": {',
  '      "gameCode": "AMCE",',
  '      "favorite": true,',
  '      "launchCount": 3,',
  '      "playMinutes": 125,',
  '      "lastPlayed": "2026-07-16 21:30",',
  '      "path": "/roms/nds/Mario Kart DS.nds"',
  '    },',
  '    "homebrew.nds": {',
  '      "launchCount": 1,',
  '      "lastPlayed": "2026-07-10 09:05",',
  '      "path": "/homebrew/homebrew.nds"',
  '    },',
  '    "Zelda.gba": {',
  '      "gameCode": "AZLS",',
  '      "favorite": true,',
  '      "completed": true',
  '    }',
  '  },',
  '  "sessionGame": "Mario Kart DS.nds",',
  '  "sessionGameCode": "AMCE",',
  '  "sessionStart": "2026-07-16 21:30"',
  '}',
);

describe('parseGameData', () => {
  it('parses a launcher-written file', () => {
    const data = parseGameData(launcherSample);

    expect(data.entries).toHaveLength(3);
    expect(data.entries[0]).toEqual({
      fileName: 'Mario Kart DS.nds',
      gameCode: 'AMCE',
      favorite: true,
      completed: false,
      launchCount: 3,
      playMinutes: 125,
      lastPlayed: '2026-07-16 21:30',
      path: '/roms/nds/Mario Kart DS.nds',
    });
    // omitted keys become defaults / undefined
    expect(data.entries[1]).toEqual({
      fileName: 'homebrew.nds',
      favorite: false,
      completed: false,
      launchCount: 1,
      playMinutes: 0,
      lastPlayed: '2026-07-10 09:05',
      path: '/homebrew/homebrew.nds',
    });
    expect(data.entries[1]?.gameCode).toBeUndefined();
    // favorite+completed entry, never launched
    expect(data.entries[2]).toEqual({
      fileName: 'Zelda.gba',
      gameCode: 'AZLS',
      favorite: true,
      completed: true,
      launchCount: 0,
      playMinutes: 0,
    });
    expect(data.session).toEqual({
      game: 'Mario Kart DS.nds',
      gameCode: 'AMCE',
      start: '2026-07-16 21:30',
    });
  });

  it('parses "{}" (the equivalent of a stock SD without the file) as empty', () => {
    const data = parseGameData('{}');
    expect(data.entries).toEqual([]);
    expect(data.session).toBeUndefined();
  });

  it('tolerates an empty games object and missing session keys', () => {
    const data = parseGameData('{"games": {}}');
    expect(data.entries).toEqual([]);
    expect(data.session).toBeUndefined();
  });

  it('tolerates wrong-typed values, mirroring ArduinoJson defaults', () => {
    const data = parseGameData(
      JSON.stringify({
        games: {
          'a.nds': {
            favorite: 'yes',
            completed: 1,
            launchCount: -2,
            playMinutes: 1.5,
            lastPlayed: 42,
            gameCode: null,
          },
          'b.nds': 'not-an-object',
        },
        sessionStart: '',
        sessionGame: 'a.nds',
      }),
    );
    expect(data.entries[0]).toEqual({
      fileName: 'a.nds',
      favorite: false,
      completed: false,
      launchCount: 0,
      playMinutes: 0,
    });
    expect(data.entries[1]).toEqual({
      fileName: 'b.nds',
      favorite: false,
      completed: false,
      launchCount: 0,
      playMinutes: 0,
    });
    // empty sessionStart means no open session, like the launcher's gate
    expect(data.session).toBeUndefined();
  });

  it('reports a session without a gameCode (homebrew launch)', () => {
    const data = parseGameData(
      '{"games": {}, "sessionGame": "homebrew.nds", "sessionStart": "2026-07-16 08:00"}',
    );
    expect(data.session).toEqual({ game: 'homebrew.nds', start: '2026-07-16 08:00' });
    expect(data.session?.gameCode).toBeUndefined();
  });

  it('returns empty data for non-object JSON roots', () => {
    expect(parseGameData('null').entries).toEqual([]);
    expect(parseGameData('[1, 2]').entries).toEqual([]);
  });

  it('throws on malformed JSON instead of silently yielding empty data', () => {
    expect(() => parseGameData('')).toThrow(SyntaxError);
    expect(() => parseGameData('{"games": {')).toThrow(SyntaxError);
  });
});

describe('serializeGameData', () => {
  it('round-trips a launcher-written file byte for byte', () => {
    const data = parseGameData(launcherSample);
    expect(serializeGameData(data)).toBe(launcherSample);
  });

  it('round-trips through parse again (data level)', () => {
    const data = parseGameData(launcherSample);
    expect(parseGameData(serializeGameData(data))).toEqual(data);
  });

  it('writes an empty file as {"games": {}} with CRLF', () => {
    expect(serializeGameData({ entries: [] })).toBe(crlf('{', '  "games": {}', '}'));
  });

  it('prunes entries reset back to all-default state', () => {
    const data: GameData = {
      entries: [
        // un-favorited, never launched: must disappear even though it still
        // carries a gameCode/lastPlayed/path (matches the launcher's prune)
        {
          fileName: 'reset.nds',
          gameCode: 'AAAA',
          favorite: false,
          completed: false,
          launchCount: 0,
          playMinutes: 0,
          lastPlayed: '2026-01-01 10:00',
          path: '/reset.nds',
        },
        { fileName: 'kept.nds', favorite: true, completed: false, launchCount: 0, playMinutes: 0 },
      ],
    };
    expect(serializeGameData(data)).toBe(
      crlf('{', '  "games": {', '    "kept.nds": {', '      "favorite": true', '    }', '  }', '}'),
    );
  });

  it('omits falsy/empty fields and closed sessions exactly like the launcher', () => {
    const data: GameData = {
      entries: [
        {
          fileName: 'a.nds',
          gameCode: '',
          favorite: false,
          completed: false,
          launchCount: 2,
          playMinutes: 0,
          lastPlayed: '',
          path: '',
        },
      ],
      session: { game: '', start: '' }, // closed session: no top-level keys
    };
    expect(serializeGameData(data)).toBe(
      crlf('{', '  "games": {', '    "a.nds": {', '      "launchCount": 2', '    }', '  }', '}'),
    );
  });

  it('omits sessionGameCode when the session has no usable code', () => {
    const data: GameData = {
      entries: [],
      session: { game: 'homebrew.nds', start: '2026-07-16 08:00' },
    };
    expect(serializeGameData(data)).toBe(
      crlf(
        '{',
        '  "games": {},',
        '  "sessionGame": "homebrew.nds",',
        '  "sessionStart": "2026-07-16 08:00"',
        '}',
      ),
    );
  });
});

describe('findEntry', () => {
  const data = parseGameData(launcherSample);

  it('finds by file name', () => {
    expect(findEntry(data, 'homebrew.nds')?.fileName).toBe('homebrew.nds');
    expect(findEntry(data, 'missing.nds')).toBeUndefined();
  });

  it('ignores the case of A-Z only, like the launcher', () => {
    expect(findEntry(data, 'MARIO KART DS.NDS')?.gameCode).toBe('AMCE');
    // the launcher's strcasecmp folds ASCII letters and nothing else
    const accented = parseGameData('{"games": {"Pokémon.nds": {"favorite": true}}}');
    expect(findEntry(accented, 'POKéMON.NDS')?.favorite).toBe(true);
    expect(findEntry(accented, 'POKÉMON.NDS')).toBeUndefined();
  });

  it('keeps two roms with the same game code apart', () => {
    // a game and its hack carry the same header code; the launcher tells them
    // apart by file name, so their marks and play time stay separate
    const pair = parseGameData(
      JSON.stringify({
        games: {
          'Tetris DS.nds': { gameCode: 'ATRE', favorite: true },
          'Tetris DS (hack).nds': { gameCode: 'ATRE', launchCount: 2 },
        },
      }),
    );
    expect(findEntry(pair, 'Tetris DS.nds')?.favorite).toBe(true);
    expect(findEntry(pair, 'Tetris DS (hack).nds')?.launchCount).toBe(2);
  });

  it('finds nothing for a renamed rom, as on the console', () => {
    expect(findEntry(data, 'Mario Kart DS (Europe).nds')).toBeUndefined();
  });
});

describe('toggleFavorite', () => {
  it('marks only that file, even when another rom has the same game code', () => {
    const data: GameData = {
      entries: [
        {
          fileName: 'Mario Kart DS.nds',
          gameCode: 'AMCE',
          favorite: false,
          completed: false,
          launchCount: 3,
          playMinutes: 125,
        },
      ],
    };
    // a hack of the game gets its own entry, and the original keeps its
    // play time and name, as the launcher does on the console
    const next = toggleFavorite(data, 'Mario Kart DS (hack).nds', 'AMCE');
    expect(next.entries).toEqual([
      data.entries[0],
      {
        fileName: 'Mario Kart DS (hack).nds',
        gameCode: 'AMCE',
        favorite: true,
        completed: false,
        launchCount: 0,
        playMinutes: 0,
      },
    ]);
  });

  it('toggles by name (case-insensitive), adopting a newly known code', () => {
    const data: GameData = {
      entries: [
        {
          fileName: 'legacy.nds',
          favorite: false,
          completed: false,
          launchCount: 1,
          playMinutes: 5,
        },
      ],
    };
    const next = toggleFavorite(data, 'LEGACY.NDS', 'ABCD');
    // legacy name-keyed entry upgraded with the code, name kept as written
    expect(next.entries).toEqual([
      {
        fileName: 'legacy.nds',
        gameCode: 'ABCD',
        favorite: true,
        completed: false,
        launchCount: 1,
        playMinutes: 5,
      },
    ]);
  });

  it('stores usable codes only, refreshing the stored one like the launcher', () => {
    const garbage = toggleFavorite(
      {
        entries: [
          {
            fileName: 'homebrew.nds',
            favorite: false,
            completed: false,
            launchCount: 1,
            playMinutes: 0,
          },
        ],
      },
      'homebrew.nds',
      '##',
    );
    expect(garbage.entries[0]?.gameCode).toBeUndefined();
    expect(garbage.entries[0]?.favorite).toBe(true);

    const refreshed = toggleFavorite(
      {
        entries: [
          {
            fileName: 'a.nds',
            gameCode: 'AAAA',
            favorite: false,
            completed: false,
            launchCount: 0,
            playMinutes: 0,
          },
        ],
      },
      'a.nds',
      'BBBB',
    );
    // the code is information about the file, so the newest reading wins
    expect(refreshed.entries[0]?.gameCode).toBe('BBBB');
  });

  it('creates a fresh favorite entry when nothing matches', () => {
    const next = toggleFavorite({ entries: [] }, 'new.nds', 'BXYZ');
    expect(next.entries).toEqual([
      {
        fileName: 'new.nds',
        gameCode: 'BXYZ',
        favorite: true,
        completed: false,
        launchCount: 0,
        playMinutes: 0,
      },
    ]);

    // null / unusable code: the fresh entry is name-keyed only
    const homebrew = toggleFavorite({ entries: [] }, 'homebrew.nds', null);
    expect(homebrew.entries).toEqual([
      {
        fileName: 'homebrew.nds',
        favorite: true,
        completed: false,
        launchCount: 0,
        playMinutes: 0,
      },
    ]);
    expect(homebrew.entries[0]?.gameCode).toBeUndefined();
  });

  it('toggle off leaves the reset entry for serialize-side pruning', () => {
    const data = toggleFavorite({ entries: [] }, 'once.nds', 'AAAA');
    const next = toggleFavorite(data, 'once.nds', 'AAAA');
    // the all-default entry survives in memory (like the launcher's) ...
    expect(next.entries).toHaveLength(1);
    expect(next.entries[0]?.favorite).toBe(false);
    // ... and serializeGameData prunes it on write
    expect(serializeGameData(next)).toBe(crlf('{', '  "games": {}', '}'));
  });

  it('never mutates the input GameData', () => {
    const data = parseGameData(launcherSample);
    const snapshot = structuredClone(data);
    toggleFavorite(data, 'Mario Kart DS (Europe).nds', 'AMCE'); // new entry, same code
    toggleFavorite(data, 'homebrew.nds', 'ABCD'); // adopt code
    toggleFavorite(data, 'brand-new.nds'); // append
    expect(data).toEqual(snapshot);
  });

  it('passes the session through a toggle + serialize round trip', () => {
    const data = parseGameData(launcherSample);
    const next = toggleFavorite(data, 'homebrew.nds');
    expect(next.session).toBe(data.session); // untouched, same reference
    const reparsed = parseGameData(serializeGameData(next));
    expect(reparsed.session).toEqual({
      game: 'Mario Kart DS.nds',
      gameCode: 'AMCE',
      start: '2026-07-16 21:30',
    });
    expect(reparsed.entries.find((e) => e.fileName === 'homebrew.nds')?.favorite).toBe(true);
  });
});

describe('isUsableGameCode', () => {
  it('accepts printable ASCII and rejects empty/garbage codes', () => {
    expect(isUsableGameCode('AMCE')).toBe(true);
    expect(isUsableGameCode('A0# ')).toBe(true);
    expect(isUsableGameCode('')).toBe(false);
    expect(isUsableGameCode(undefined)).toBe(false);
    expect(isUsableGameCode('AB C')).toBe(false);
    expect(isUsableGameCode('ABÿC')).toBe(false);
  });

  it('rejects the homebrew placeholder code ####', () => {
    // every homebrew built without its own code carries it: not an identity
    expect(isUsableGameCode('####')).toBe(false);
    expect(isUsableGameCode('#')).toBe(false);
    expect(isUsableGameCode('#A##')).toBe(true); // a real code with a # is fine
  });
});

describe('stats helpers', () => {
  const entry = (partial: Partial<GameDataEntry> & { fileName: string }): GameDataEntry => ({
    favorite: false,
    completed: false,
    launchCount: 0,
    playMinutes: 0,
    ...partial,
  });

  const data: GameData = {
    entries: [
      entry({
        fileName: 'a.nds',
        launchCount: 3,
        playMinutes: 125,
        lastPlayed: '2025-12-31 23:59',
      }),
      entry({ fileName: 'b.nds', favorite: true, completed: true }),
      entry({
        fileName: 'c.nds',
        launchCount: 1,
        playMinutes: 200,
        lastPlayed: '2026-01-01 00:00',
      }),
      entry({
        fileName: 'd.nds',
        favorite: true,
        launchCount: 3,
        playMinutes: 10,
        lastPlayed: '2026-07-16 09:05',
      }),
      entry({ fileName: 'e.nds', launchCount: 2, playMinutes: 0, lastPlayed: '2026-07-16 08:59' }),
    ],
  };

  it('computes totals like the statistics sheet', () => {
    expect(gameDataTotals(data)).toEqual({
      playedCount: 4,
      favoriteCount: 2, // favorites counted even when never launched
      completedCount: 1, // completed too
      totalLaunches: 9,
      totalPlayMinutes: 335,
    });
    expect(gameDataTotals({ entries: [] })).toEqual({
      playedCount: 0,
      favoriteCount: 0,
      completedCount: 0,
      totalLaunches: 0,
      totalPlayMinutes: 0,
    });
  });

  it('sorts by lastPlayed descending: lexicographic equals chronological', () => {
    const recents = sortedByLastPlayed(data).map((e) => e.fileName);
    // year/midnight boundaries order correctly without any date parsing
    expect(recents).toEqual(['d.nds', 'e.nds', 'c.nds', 'a.nds']);
    // never-launched entries are excluded, source order is untouched
    expect(data.entries.map((e) => e.fileName)).toEqual([
      'a.nds',
      'b.nds',
      'c.nds',
      'd.nds',
      'e.nds',
    ]);
  });

  it('sorts by launch count with playMinutes as tie breaker', () => {
    const most = sortedByMostPlayed(data).map((e) => e.fileName);
    // a and d tie at 3 launches; a has more minutes
    expect(most).toEqual(['a.nds', 'd.nds', 'e.nds', 'c.nds']);
  });
});

describe('toggleCompleted', () => {
  it('creates a fresh completed entry and leaves favorite untouched', () => {
    const next = toggleCompleted({ entries: [] }, 'done.nds', 'DONE');
    expect(next.entries).toEqual([
      {
        fileName: 'done.nds',
        gameCode: 'DONE',
        favorite: false,
        completed: true,
        launchCount: 0,
        playMinutes: 0,
      },
    ]);
  });

  it('toggles completed independently of favorite on an existing entry', () => {
    const data = parseGameData(launcherSample);
    const next = toggleCompleted(data, 'Mario Kart DS.nds', 'AMCE');
    const mario = next.entries.find((e) => e.fileName === 'Mario Kart DS.nds');
    expect(mario?.completed).toBe(true);
    expect(mario?.favorite).toBe(true); // untouched
    const off = toggleCompleted(next, 'Mario Kart DS.nds', 'AMCE');
    expect(off.entries.find((e) => e.fileName === 'Mario Kart DS.nds')?.completed).toBe(false);
  });

  it('writes "completed" after "favorite" and survives a round trip', () => {
    const next = toggleCompleted(
      toggleFavorite({ entries: [] }, 'done.nds', 'DONE'),
      'done.nds',
      'DONE',
    );
    const text = serializeGameData(next);
    expect(text).toBe(
      crlf(
        '{',
        '  "games": {',
        '    "done.nds": {',
        '      "gameCode": "DONE",',
        '      "favorite": true,',
        '      "completed": true',
        '    }',
        '  }',
        '}',
      ),
    );
    expect(parseGameData(text).entries[0]?.completed).toBe(true);
  });

  it('a completed-only entry survives serialize-side pruning', () => {
    const on = toggleCompleted({ entries: [] }, 'keep.nds', null);
    expect(serializeGameData(on)).toContain('keep.nds');
    // toggled back off it becomes all-default and is pruned
    const off = toggleCompleted(on, 'keep.nds', null);
    expect(serializeGameData(off)).toBe(crlf('{', '  "games": {}', '}'));
  });
});

describe('setGameStats', () => {
  it('overwrites launch count and play time on an existing entry, keeping flags', () => {
    const data: GameData = {
      entries: [
        {
          fileName: 'Mario.nds',
          gameCode: 'AMCE',
          favorite: true,
          completed: true,
          launchCount: 3,
          playMinutes: 125,
          lastPlayed: '2026-07-16 21:30',
        },
      ],
    };
    const next = setGameStats(data, 'Mario.nds', 'AMCE', { launchCount: 10, playMinutes: 600 });
    expect(next.entries[0]).toEqual({
      fileName: 'Mario.nds',
      gameCode: 'AMCE',
      favorite: true,
      completed: true,
      launchCount: 10,
      playMinutes: 600,
      lastPlayed: '2026-07-16 21:30',
    });
  });

  it('creates a fresh entry when nothing matches', () => {
    const next = setGameStats({ entries: [] }, 'New.gba', 'BXYZ', {
      launchCount: 2,
      playMinutes: 45,
    });
    expect(next.entries).toEqual([
      {
        fileName: 'New.gba',
        gameCode: 'BXYZ',
        favorite: false,
        completed: false,
        launchCount: 2,
        playMinutes: 45,
      },
    ]);
  });

  it('clamps negative and fractional inputs to non-negative integers', () => {
    const next = setGameStats({ entries: [] }, 'x.nds', null, {
      launchCount: -5,
      playMinutes: 12.9,
    });
    expect(next.entries[0]?.launchCount).toBe(0);
    expect(next.entries[0]?.playMinutes).toBe(12);
  });

  it('sets the stats of that file only, even when another rom has the same game code', () => {
    const data = parseGameData(
      JSON.stringify({
        games: {
          'Old.gba': { gameCode: 'APAE', launchCount: 1, lastPlayed: '2026-01-01 10:00' },
          'New.gba': { completed: true, lastPlayed: '2026-07-01 10:00' },
        },
      }),
    );
    const next = setGameStats(data, 'New.gba', 'APAE', { launchCount: 9, playMinutes: 300 });
    expect(next.entries).toEqual([
      data.entries[0],
      {
        fileName: 'New.gba',
        gameCode: 'APAE',
        favorite: false,
        completed: true,
        launchCount: 9,
        playMinutes: 300,
        lastPlayed: '2026-07-01 10:00',
      },
    ]);
  });

  it('leaves an all-default entry for serialize-side pruning when cleared to 0', () => {
    const data: GameData = {
      entries: [
        { fileName: 'x.nds', favorite: false, completed: false, launchCount: 3, playMinutes: 50 },
      ],
    };
    const next = setGameStats(data, 'x.nds', null, { launchCount: 0, playMinutes: 0 });
    expect(next.entries).toHaveLength(1);
    expect(serializeGameData(next)).toBe(crlf('{', '  "games": {}', '}'));
  });

  it('prunes a played entry (dropping lastPlayed/path) when cleared to 0, unless a flag keeps it', () => {
    const played: GameData = {
      entries: [
        {
          fileName: 'Zelda.nds',
          gameCode: 'AZLE',
          favorite: false,
          completed: false,
          launchCount: 5,
          playMinutes: 300,
          lastPlayed: '2026-07-01 10:00',
          path: '/roms/nds/Zelda.nds',
        },
      ],
    };
    const zeroed = setGameStats(played, 'Zelda.nds', 'AZLE', { launchCount: 0, playMinutes: 0 });
    // the returned entry still carries lastPlayed/path in memory...
    expect(zeroed.entries[0]).toMatchObject({
      lastPlayed: '2026-07-01 10:00',
      path: '/roms/nds/Zelda.nds',
    });
    // ...but on disk the now-default entry is pruned entirely, matching the launcher
    expect(serializeGameData(zeroed)).toBe(crlf('{', '  "games": {}', '}'));

    // a flag keeps the entry, so lastPlayed/path survive the write
    const favorited: GameData = { entries: [{ ...played.entries[0], favorite: true }] };
    const zeroedFav = setGameStats(favorited, 'Zelda.nds', 'AZLE', {
      launchCount: 0,
      playMinutes: 0,
    });
    const serialized = serializeGameData(zeroedFav);
    expect(serialized).toContain('"lastPlayed": "2026-07-01 10:00"');
    expect(serialized).toContain('"path": "/roms/nds/Zelda.nds"');
  });

  it('clamps non-finite inputs to 0', () => {
    const next = setGameStats({ entries: [] }, 'x.nds', 'AXXE', {
      launchCount: Number.NaN,
      playMinutes: Number.POSITIVE_INFINITY,
    });
    expect(next.entries[0]?.launchCount).toBe(0);
    expect(next.entries[0]?.playMinutes).toBe(0);
    // an all-zero entry is default-valued, so it prunes rather than persisting a phantom
    expect(serializeGameData(next)).toBe(crlf('{', '  "games": {}', '}'));
  });

  it('does not mutate the input', () => {
    const data = parseGameData(launcherSample);
    const snapshot = structuredClone(data);
    setGameStats(data, 'Mario Kart DS.nds', 'AMCE', { launchCount: 99, playMinutes: 9999 });
    expect(data).toEqual(snapshot);
  });
});

describe('saveSlot', () => {
  /** A launcher-written entry that picked save slot 2 (written after "path"). */
  const slotSample = crlf(
    '{',
    '  "games": {',
    '    "Pokemon Platinum.nds": {',
    '      "gameCode": "CPUE",',
    '      "launchCount": 5,',
    '      "path": "/roms/Pokemon Platinum.nds",',
    '      "saveSlot": 2',
    '    }',
    '  }',
    '}',
  );

  it('round-trips a launcher-written slot byte for byte', () => {
    const data = parseGameData(slotSample);
    expect(data.entries[0]?.saveSlot).toBe(2);
    expect(serializeGameData(data)).toBe(slotSample);
  });

  it('survives a favorite toggle, so PicoDex never resets a game to its regular save', () => {
    const next = toggleFavorite(parseGameData(slotSample), 'Pokemon Platinum.nds', 'CPUE');
    const parsed = JSON.parse(serializeGameData(next)) as {
      games: Record<string, { saveSlot?: number }>;
    };
    expect(parsed.games['Pokemon Platinum.nds'].saveSlot).toBe(2);
  });

  it('keeps an entry that holds nothing but a slot from being pruned', () => {
    const data = parseGameData(JSON.stringify({ games: { 'a.nds': { saveSlot: 4 } } }));
    expect(serializeGameData(data)).toBe(
      crlf('{', '  "games": {', '    "a.nds": {', '      "saveSlot": 4', '    }', '  }', '}'),
    );
  });

  it('reads slots the launcher cannot name a save for as slot 0, like the launcher', () => {
    const data = parseGameData(
      JSON.stringify({
        games: {
          'zero.nds': { launchCount: 1, saveSlot: 0 },
          'ten.nds': { launchCount: 1, saveSlot: 10 },
          'half.nds': { launchCount: 1, saveSlot: 1.5 },
          'text.nds': { launchCount: 1, saveSlot: '3' },
        },
      }),
    );
    for (const entry of data.entries) expect(entry.saveSlot).toBeUndefined();
  });

  it('stays with its own file, not with a hack sharing its game code', () => {
    const data = parseGameData(
      JSON.stringify({
        games: {
          'Platinum.nds': { gameCode: 'CPUE', launchCount: 3, saveSlot: 3 },
          'Platinum Hack.nds': { gameCode: 'CPUE', launchCount: 1 },
        },
      }),
    );
    const toggled = toggleFavorite(data, 'Platinum Hack.nds', 'CPUE');
    expect(findEntry(toggled, 'Platinum.nds')?.saveSlot).toBe(3);
    expect(findEntry(toggled, 'Platinum Hack.nds')?.saveSlot).toBeUndefined();
  });

  it('survives clearing the play stats, which leaves an entry holding only the slot', () => {
    const data = parseGameData(slotSample);
    const edited = setGameStats(data, 'Pokemon Platinum.nds', 'CPUE', {
      launchCount: 0,
      playMinutes: 0,
    });
    expect(findEntry(edited, 'Pokemon Platinum.nds')?.saveSlot).toBe(2);
    const parsed = JSON.parse(serializeGameData(edited)) as {
      games: Record<string, { saveSlot?: number }>;
    };
    expect(parsed.games['Pokemon Platinum.nds'].saveSlot).toBe(2);
  });
});
