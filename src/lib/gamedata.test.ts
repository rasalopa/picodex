import { describe, expect, it } from 'vitest';
import {
  findEntry,
  gameDataTotals,
  isUsableGameCode,
  parseGameData,
  serializeGameData,
  sortedByLastPlayed,
  sortedByMostPlayed,
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
  '      "favorite": true',
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
      launchCount: 3,
      playMinutes: 125,
      lastPlayed: '2026-07-16 21:30',
      path: '/roms/nds/Mario Kart DS.nds',
    });
    // omitted keys become defaults / undefined
    expect(data.entries[1]).toEqual({
      fileName: 'homebrew.nds',
      favorite: false,
      launchCount: 1,
      playMinutes: 0,
      lastPlayed: '2026-07-10 09:05',
      path: '/homebrew/homebrew.nds',
    });
    expect(data.entries[1]?.gameCode).toBeUndefined();
    // favorite-only entry, never launched
    expect(data.entries[2]).toEqual({
      fileName: 'Zelda.gba',
      gameCode: 'AZLS',
      favorite: true,
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
      launchCount: 0,
      playMinutes: 0,
    });
    expect(data.entries[1]).toEqual({
      fileName: 'b.nds',
      favorite: false,
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
          launchCount: 0,
          playMinutes: 0,
          lastPlayed: '2026-01-01 10:00',
          path: '/reset.nds',
        },
        { fileName: 'kept.nds', favorite: true, launchCount: 0, playMinutes: 0 },
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
      entry({ fileName: 'b.nds', favorite: true }),
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
      totalLaunches: 9,
      totalPlayMinutes: 335,
    });
    expect(gameDataTotals({ entries: [] })).toEqual({
      playedCount: 0,
      favoriteCount: 0,
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
