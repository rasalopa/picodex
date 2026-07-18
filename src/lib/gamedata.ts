/**
 * Reader/writer for the Pico Enhanced launcher's `/_pico/gamedata.json`.
 *
 * Authoritative writer: `JsonGameDataService.thumb.cpp` (ArduinoJson,
 * pretty-printed with 2-space indent and CRLF line endings). File shape:
 *
 * ```json
 * {
 *   "games": {
 *     "<fileName>": {
 *       "gameCode": "AMCE",
 *       "favorite": true,
 *       "launchCount": 3,
 *       "playMinutes": 125,
 *       "lastPlayed": "2026-07-16 21:30",
 *       "path": "/roms/nds/Mario Kart DS.nds"
 *     }
 *   },
 *   "sessionGame": "<fileName>",
 *   "sessionGameCode": "AMCE",
 *   "sessionStart": "2026-07-16 21:30"
 * }
 * ```
 *
 * All per-game keys are optional and omitted when falsy/empty; the session
 * keys exist at the top level only while a play session is open (it opens on
 * launch and closes at the next launcher boot). Only the known keys above are
 * modeled: unknown keys are dropped on a parse/serialize round trip, exactly
 * like the launcher itself does.
 */

/** Per-game persisted data, keyed by ROM file name. */
export interface GameDataEntry {
  /** ROM file name (JSON object key). Matched case-insensitively. */
  fileName: string;
  /**
   * Internal game code from the NDS/GBA header, undefined when unknown.
   * Lookups prefer it: it survives renames and moves.
   */
  gameCode?: string;
  /** Marked as favorite (X button in the launcher). */
  favorite: boolean;
  /** Number of times the game was launched. */
  launchCount: number;
  /**
   * Accumulated play time in minutes. A session spans from launching the
   * game until the next launcher boot, so it is an approximation.
   */
  playMinutes: number;
  /**
   * "YYYY-MM-DD HH:MM" of the last launch, undefined when never launched.
   * Lexicographic order equals chronological order.
   */
  lastPlayed?: string;
  /**
   * Full path of the file at its last launch, undefined when never launched.
   * Used by the recents list to navigate back to the game.
   */
  path?: string;
}

/** Open play session, persisted at the top level of gamedata.json. */
export interface GameDataSession {
  /** File name of the launched game (`sessionGame`). */
  game: string;
  /** Game code of the launched game (`sessionGameCode`), when usable. */
  gameCode?: string;
  /** "YYYY-MM-DD HH:MM" launch timestamp (`sessionStart`). */
  start: string;
}

/** Parsed contents of `/_pico/gamedata.json`. */
export interface GameData {
  /** Per-game entries, in file order. */
  entries: GameDataEntry[];
  /** Open play session, undefined when none is open. */
  session?: GameDataSession;
}

/** Aggregate statistics, mirroring the launcher's statistics sheet. */
export interface GameDataTotals {
  /** Entries launched at least once. */
  playedCount: number;
  /** Entries marked as favorite (played or not). */
  favoriteCount: number;
  /** Sum of launchCount over played entries. */
  totalLaunches: number;
  /** Sum of playMinutes over played entries. */
  totalPlayMinutes: number;
}

/**
 * Whether a game code can serve as a stable identity (and is safe inside the
 * JSON file). Homebrew headers can hold garbage where retail games keep their
 * code, so only non-empty printable-ASCII codes are usable. Mirrors the
 * launcher's `isUsableGameCode`.
 */
export function isUsableGameCode(gameCode: string | undefined): gameCode is string {
  if (gameCode === undefined || gameCode.length === 0) return false;
  for (let i = 0; i < gameCode.length; i++) {
    const c = gameCode.charCodeAt(i);
    if (c < 0x20 || c >= 0x7f) return false;
  }
  return true;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Non-negative integer or 0, mirroring ArduinoJson's `| 0u` u32 default. */
function readCount(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parses the text of `/_pico/gamedata.json` into a {@link GameData}.
 *
 * Tolerant of missing keys at every level: `"{}"` yields an empty result
 * (stock SD cards don't have the file at all — the caller handles that case
 * and can treat it as `"{}"`), per-game values of the wrong type fall back to
 * their defaults, and a session is only reported when `sessionStart` is a
 * non-empty string (the same gate the launcher uses). Malformed JSON throws
 * a `SyntaxError` (from `JSON.parse`) so callers never silently overwrite a
 * corrupt file with empty data.
 */
export function parseGameData(text: string): GameData {
  const root: unknown = JSON.parse(text);
  const data: GameData = { entries: [] };
  if (!isRecord(root)) return data;

  const games = root['games'];
  if (isRecord(games)) {
    for (const [fileName, value] of Object.entries(games)) {
      const game = isRecord(value) ? value : {};
      const entry: GameDataEntry = {
        fileName,
        favorite: game['favorite'] === true,
        launchCount: readCount(game['launchCount']),
        playMinutes: readCount(game['playMinutes']),
      };
      const gameCode = readString(game['gameCode']);
      if (gameCode.length > 0) entry.gameCode = gameCode;
      const lastPlayed = readString(game['lastPlayed']);
      if (lastPlayed.length > 0) entry.lastPlayed = lastPlayed;
      const path = readString(game['path']);
      if (path.length > 0) entry.path = path;
      data.entries.push(entry);
    }
  }

  const start = readString(root['sessionStart']);
  if (start.length > 0) {
    const session: GameDataSession = { game: readString(root['sessionGame']), start };
    const sessionGameCode = readString(root['sessionGameCode']);
    if (sessionGameCode.length > 0) session.gameCode = sessionGameCode;
    data.session = session;
  }
  return data;
}

/**
 * Serializes a {@link GameData} to the exact byte format the launcher writes:
 * pretty JSON with 2-space indent, `": "` separators and CRLF line endings
 * (ArduinoJson's `serializeJsonPretty`), no trailing newline.
 *
 * Field omission matches the launcher's `SaveAsync`: `favorite` only when
 * true, counts only when > 0, strings only when non-empty, and the session
 * keys at the top level only while a session is open (non-empty `start`).
 * Entries reset back to all-default state (not favorite, never launched, no
 * play time) are pruned. Only known keys are written.
 */
export function serializeGameData(data: GameData): string {
  const games: Record<string, unknown> = {};
  for (const entry of data.entries) {
    // entries reset back to all-default state are pruned on write
    if (!entry.favorite && entry.launchCount <= 0 && entry.playMinutes <= 0) continue;
    const game: Record<string, unknown> = {};
    if (entry.gameCode !== undefined && entry.gameCode.length > 0)
      game['gameCode'] = entry.gameCode;
    if (entry.favorite) game['favorite'] = true;
    if (entry.launchCount > 0) game['launchCount'] = entry.launchCount;
    if (entry.playMinutes > 0) game['playMinutes'] = entry.playMinutes;
    if (entry.lastPlayed !== undefined && entry.lastPlayed.length > 0)
      game['lastPlayed'] = entry.lastPlayed;
    if (entry.path !== undefined && entry.path.length > 0) game['path'] = entry.path;
    games[entry.fileName] = game;
  }

  const root: Record<string, unknown> = { games };
  if (data.session !== undefined && data.session.start.length > 0) {
    root['sessionGame'] = data.session.game;
    if (data.session.gameCode !== undefined && data.session.gameCode.length > 0) {
      root['sessionGameCode'] = data.session.gameCode;
    }
    root['sessionStart'] = data.session.start;
  }
  return JSON.stringify(root, null, 2).replace(/\n/g, '\r\n');
}

/**
 * Finds the entry for a game, mirroring the launcher's `GetEntry`: the game
 * code is tried first (case-insensitive) because it is the stable identity
 * that survives file renames; the file name (case-insensitive) is the
 * fallback. Unusable codes (empty or non-printable, see
 * {@link isUsableGameCode}) skip straight to the name lookup.
 */
export function findEntry(
  data: GameData,
  fileName: string,
  gameCode?: string,
): GameDataEntry | undefined {
  if (isUsableGameCode(gameCode)) {
    const code = gameCode.toLowerCase();
    const byCode = data.entries.find(
      (entry) => entry.gameCode !== undefined && entry.gameCode.toLowerCase() === code,
    );
    if (byCode !== undefined) return byCode;
  }
  const name = fileName.toLowerCase();
  return data.entries.find((entry) => entry.fileName.toLowerCase() === name);
}

/**
 * Aggregate totals, mirroring the launcher's `StatisticsViewModel`:
 * favorites are counted over all entries, while launches and play minutes
 * only accumulate over entries launched at least once.
 */
export function gameDataTotals(data: GameData): GameDataTotals {
  const totals: GameDataTotals = {
    playedCount: 0,
    favoriteCount: 0,
    totalLaunches: 0,
    totalPlayMinutes: 0,
  };
  for (const entry of data.entries) {
    if (entry.favorite) totals.favoriteCount++;
    if (entry.launchCount <= 0) continue;
    totals.playedCount++;
    totals.totalLaunches += entry.launchCount;
    totals.totalPlayMinutes += entry.playMinutes;
  }
  return totals;
}

/**
 * Entries launched at least once, most recent first, mirroring the
 * launcher's recents list. "YYYY-MM-DD HH:MM" sorts chronologically as a
 * plain string, so no date parsing is needed. Returns a new array of the
 * original entry objects; ties keep file order (stable sort).
 */
export function sortedByLastPlayed(data: GameData): GameDataEntry[] {
  return data.entries
    .filter((entry) => entry.lastPlayed !== undefined && entry.lastPlayed.length > 0)
    .sort((a, b) => {
      const left = a.lastPlayed ?? '';
      const right = b.lastPlayed ?? '';
      return left < right ? 1 : left > right ? -1 : 0;
    });
}

/**
 * Entries launched at least once, ranked by launch count (the metric the
 * launcher's statistics top list uses), with play minutes as tie breaker.
 * Returns a new array of the original entry objects; remaining ties keep
 * file order (stable sort).
 */
export function sortedByMostPlayed(data: GameData): GameDataEntry[] {
  return data.entries
    .filter((entry) => entry.launchCount > 0)
    .sort((a, b) => b.launchCount - a.launchCount || b.playMinutes - a.playMinutes);
}
