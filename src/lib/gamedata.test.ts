import { describe, expect, it } from 'vitest';
import {
  findEntry,
  gameDataTotals,
  isUsableGameCode,
  parseGameData,
  serializeGameData,
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

  it('finds by file name when no code is given', () => {
    expect(findEntry(data, 'homebrew.nds')?.fileName).toBe('homebrew.nds');
    expect(findEntry(data, 'missing.nds')).toBeUndefined();
  });

  it('is case-insensitive on both code and name', () => {
    expect(findEntry(data, 'MARIO KART DS.NDS')?.gameCode).toBe('AMCE');
    expect(findEntry(data, 'whatever.nds', 'amce')?.fileName).toBe('Mario Kart DS.nds');
  });

  it('prefers the code over the name (healed rename scenario)', () => {
    // the ROM was renamed on the PC after the entry was written: the name no
    // longer matches, but the code is the stable identity and still resolves
    const renamed = findEntry(data, 'Mario Kart DS (Europe).nds', 'AMCE');
    expect(renamed?.fileName).toBe('Mario Kart DS.nds');
    expect(renamed?.launchCount).toBe(3);

    // both a code and a name match exist: the code entry wins
    const both = findEntry(data, 'homebrew.nds', 'AZLS');
    expect(both?.fileName).toBe('Zelda.gba');
  });

  it('falls back to the name for unusable game codes', () => {
    // homebrew headers can hold garbage where retail games keep their code
    expect(findEntry(data, 'homebrew.nds', '##')?.fileName).toBe('homebrew.nds');
    expect(findEntry(data, 'homebrew.nds', '')?.fileName).toBe('homebrew.nds');
  });
});

describe('toggleFavorite', () => {
  it('toggles an existing entry by code, healing a renamed file name', () => {
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
    // the ROM was renamed on the PC since the entry was written: the code
    // still resolves (case-insensitively) and the file name is healed
    const next = toggleFavorite(data, 'Mario Kart DS (Europe).nds', 'amce');
    expect(next.entries).toEqual([
      {
        fileName: 'Mario Kart DS (Europe).nds',
        gameCode: 'AMCE',
        favorite: true,
        completed: false,
        launchCount: 3,
        playMinutes: 125,
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

  it('does not adopt unusable codes and keeps an existing code', () => {
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

    const keeps = toggleFavorite(
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
    expect(keeps.entries[0]?.gameCode).toBe('AAAA');
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
    toggleFavorite(data, 'Mario Kart DS (Europe).nds', 'AMCE'); // heal + toggle
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

describe('toggleFavorite duplicate healing', () => {
  it('merges a name-keyed duplicate when healing renames onto it', () => {
    // scenario: the game was renamed after the launcher wrote its entry, and
    // a favorite was toggled before the gamecode was known (name-keyed
    // duplicate). Toggling again WITH the code must not lose play history.
    const data = parseGameData(
      JSON.stringify({
        games: {
          'Old Name.gba': {
            gameCode: 'APAE',
            launchCount: 42,
            playMinutes: 900,
            lastPlayed: '2026-07-10 21:00',
            path: '/Games/gba/Old Name.gba',
          },
          'New Name.gba': { favorite: true },
        },
      }),
    );
    const next = toggleFavorite(data, 'New Name.gba', 'APAE');
    const matches = next.entries.filter((e) => e.fileName.toLowerCase() === 'new name.gba');
    expect(matches).toHaveLength(1);
    const merged = matches[0];
    expect(merged.gameCode).toBe('APAE');
    expect(merged.launchCount).toBe(42);
    expect(merged.playMinutes).toBe(900);
    expect(merged.lastPlayed).toBe('2026-07-10 21:00');
    // the code entry was not favorite; this toggle turns it on
    expect(merged.favorite).toBe(true);
    // serialization keeps a single key with full history
    const text = serializeGameData(next);
    const parsed = JSON.parse(text) as { games: Record<string, { launchCount?: number }> };
    expect(Object.keys(parsed.games)).toHaveLength(1);
    expect(parsed.games['New Name.gba'].launchCount).toBe(42);
  });

  it('keeps the newer lastPlayed when merging', () => {
    const data = parseGameData(
      JSON.stringify({
        games: {
          'Old.gba': { gameCode: 'BXYZ', launchCount: 1, lastPlayed: '2026-01-01 10:00' },
          'New.gba': { launchCount: 2, lastPlayed: '2026-07-01 10:00' },
        },
      }),
    );
    const next = toggleFavorite(data, 'New.gba', 'BXYZ');
    const merged = next.entries.find((e) => e.fileName === 'New.gba');
    expect(merged?.lastPlayed).toBe('2026-07-01 10:00');
    expect(merged?.launchCount).toBe(3);
  });

  it('carries the untoggled flag of the swallowed duplicate into the merge', () => {
    // the completed mark lives only on the name-keyed duplicate (marked
    // before the gamecode was known); toggling FAVORITE via the code path
    // must not silently drop it
    const data = parseGameData(
      JSON.stringify({
        games: {
          'Old.gba': { gameCode: 'BXYZ', launchCount: 1 },
          'New.gba': { completed: true },
        },
      }),
    );
    const next = toggleFavorite(data, 'New.gba', 'BXYZ');
    const merged = next.entries.find((e) => e.fileName === 'New.gba');
    expect(merged?.favorite).toBe(true);
    expect(merged?.completed).toBe(true); // survived the merge
  });

  it('never resurrects the toggled flag from the duplicate', () => {
    // the UI showed the code entry's state (favorite on); the user clicked
    // to REMOVE it — the duplicate's stale favorite must not undo that
    const data = parseGameData(
      JSON.stringify({
        games: {
          'Old.gba': { gameCode: 'BXYZ', favorite: true, launchCount: 1 },
          'New.gba': { favorite: true, completed: true },
        },
      }),
    );
    const next = toggleFavorite(data, 'New.gba', 'BXYZ');
    const merged = next.entries.find((e) => e.fileName === 'New.gba');
    expect(merged?.favorite).toBe(false); // the un-toggle wins
    expect(merged?.completed).toBe(true); // the untoggled flag still survives
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
