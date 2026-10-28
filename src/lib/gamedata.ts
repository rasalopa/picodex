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
 *       "completed": true,
 *       "launchCount": 3,
 *       "playMinutes": 125,
 *       "lastPlayed": "2026-07-16 21:30",
 *       "path": "/roms/nds/Mario Kart DS.nds",
 *       "saveSlot": 2
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
  /**
   * ROM file name (JSON object key), the entry's identity. Matched ignoring
   * the case of A-Z only, see {@link sameFileName}.
   */
  fileName: string;
  /**
   * Internal game code from the NDS/GBA header, undefined when unknown.
   * Kept as information only: no lookup goes by it, see {@link findEntry}.
   */
  gameCode?: string;
  /** Marked as favorite (X button in the launcher). */
  favorite: boolean;
  /**
   * Marked as completed (long-press X in the launcher). Requires Pico
   * Launcher Enhanced v1.1.0+ — older launchers drop the key on save.
   */
  completed: boolean;
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
  /**
   * Save slot picked in the launcher's game details sheet, 1 to 9: the loader
   * then uses `<game name>.sav<N>` instead of `<game name>.sav`. Undefined
   * means slot 0, the regular save. Not editable here, but carried through
   * every write: dropping it would silently put the game back on slot 0.
   */
  saveSlot?: number;
}

/** Highest save slot the launcher names a save for (`.sav1` to `.sav9`). */
const MAX_SAVE_SLOT = 9;

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
  /** Entries marked as completed (played or not). */
  completedCount: number;
  /** Sum of launchCount over played entries. */
  totalLaunches: number;
  /** Sum of playMinutes over played entries. */
  totalPlayMinutes: number;
}

/**
 * Whether a game code is worth storing on an entry (and is safe inside the
 * JSON file). Homebrew headers can hold garbage where retail games keep their
 * code, so only non-empty printable-ASCII codes are usable, and `####`, the
 * toolchain placeholder every homebrew without its own code carries, says
 * nothing about the game either.
 * Mirrors the launcher's `JsonGameDataService::isUsableGameCode`. NOTE: this
 * is a different rule from {@link import('./rom').isUsableGameCode}, which
 * governs ROM-header extraction and deliberately keeps `####` — do not
 * unify them.
 */
export function isUsableGameCode(gameCode: string | undefined): gameCode is string {
  if (gameCode === undefined || gameCode.length === 0) return false;
  let allPlaceholder = true;
  for (let i = 0; i < gameCode.length; i++) {
    const c = gameCode.charCodeAt(i);
    if (c < 0x20 || c >= 0x7f) return false;
    if (gameCode[i] !== '#') allPlaceholder = false;
  }
  return !allPlaceholder;
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
        completed: game['completed'] === true,
        launchCount: readCount(game['launchCount']),
        playMinutes: readCount(game['playMinutes']),
      };
      const gameCode = readString(game['gameCode']);
      if (gameCode.length > 0) entry.gameCode = gameCode;
      const lastPlayed = readString(game['lastPlayed']);
      if (lastPlayed.length > 0) entry.lastPlayed = lastPlayed;
      const path = readString(game['path']);
      if (path.length > 0) entry.path = path;
      // the launcher reads a slot it can't name a save for as slot 0
      const saveSlot = readCount(game['saveSlot']);
      if (saveSlot > 0 && saveSlot <= MAX_SAVE_SLOT) entry.saveSlot = saveSlot;
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
 * true, counts and `saveSlot` only when > 0, strings only when non-empty, and
 * the session keys at the top level only while a session is open (non-empty
 * `start`). Entries reset back to all-default state (not favorite, never
 * launched, no play time, slot 0) are pruned. Only known keys are written.
 */
export function serializeGameData(data: GameData): string {
  const games: Record<string, unknown> = {};
  for (const entry of data.entries) {
    // entries reset back to all-default state are pruned on write
    if (
      !entry.favorite &&
      !entry.completed &&
      entry.launchCount <= 0 &&
      entry.playMinutes <= 0 &&
      !(entry.saveSlot !== undefined && entry.saveSlot > 0)
    )
      continue;
    const game: Record<string, unknown> = {};
    if (entry.gameCode !== undefined && entry.gameCode.length > 0)
      game['gameCode'] = entry.gameCode;
    if (entry.favorite) game['favorite'] = true;
    if (entry.completed) game['completed'] = true;
    if (entry.launchCount > 0) game['launchCount'] = entry.launchCount;
    if (entry.playMinutes > 0) game['playMinutes'] = entry.playMinutes;
    if (entry.lastPlayed !== undefined && entry.lastPlayed.length > 0)
      game['lastPlayed'] = entry.lastPlayed;
    if (entry.path !== undefined && entry.path.length > 0) game['path'] = entry.path;
    if (entry.saveSlot !== undefined && entry.saveSlot > 0) game['saveSlot'] = entry.saveSlot;
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
 * Compares two file names the way the launcher's `strcasecmp` does: A-Z match
 * their lowercase letters and every other character must be identical, so
 * "Pokémon.nds" and "POKéMON.NDS" are the same file but "POKÉMON.NDS" is not.
 */
export function sameFileName(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    let x = a.charCodeAt(i);
    let y = b.charCodeAt(i);
    if (x >= 0x41 && x <= 0x5a) x += 0x20;
    if (y >= 0x41 && y <= 0x5a) y += 0x20;
    if (x !== y) return false;
  }
  return true;
}

/**
 * Finds the entry for a game by file name only, mirroring the launcher's
 * `GetEntry`. The game code plays no part: a game and its hack share one, and
 * the launcher (since v1.5.0) keeps their marks and play time apart by name.
 * A rom renamed on the PC finds nothing here, the same as on the console.
 */
export function findEntry(data: GameData, fileName: string): GameDataEntry | undefined {
  return data.entries.find((entry) => sameFileName(entry.fileName, fileName));
}

/** User-editable boolean marks on a game entry. */
export type GameFlag = 'favorite' | 'completed';

/**
 * Resolves the entry a change goes to, mirroring the launcher's
 * `GetOrCreateEntry`: the one with that file name ({@link findEntry}), or a
 * fresh all-default entry appended for it. A usable code
 * ({@link isUsableGameCode}) is written onto the entry in both cases, as the
 * latest reading of the file's header; it never picks the entry. Works on a
 * copy of the entries and returns it with the index of the entry to change.
 */
function getOrCreateEntry(
  data: GameData,
  fileName: string,
  gameCode: string | null | undefined,
): { entries: GameDataEntry[]; index: number } {
  const entries = [...data.entries];
  let index = entries.findIndex((entry) => sameFileName(entry.fileName, fileName));
  if (index < 0) {
    entries.push({ fileName, favorite: false, completed: false, launchCount: 0, playMinutes: 0 });
    index = entries.length - 1;
  }
  const code = gameCode ?? undefined;
  if (isUsableGameCode(code)) entries[index] = { ...entries[index], gameCode: code };
  return { entries, index };
}

/**
 * Toggles one of a game's boolean flags, mirroring the launcher's
 * `ToggleFavorite`/`ToggleCompleted` (X press / X long-press) on the entry
 * {@link getOrCreateEntry} resolves by file name.
 *
 * Returns a new {@link GameData} — the input is never mutated; the session
 * and all unaffected entries are carried over untouched. An entry toggled
 * back to all-default state (no flags, never launched, no play time) is
 * kept in `entries`: {@link serializeGameData} prunes it on write, exactly
 * like the launcher does.
 */
export function toggleFlag(
  data: GameData,
  fileName: string,
  gameCode: string | null | undefined,
  flag: GameFlag,
): GameData {
  const { entries, index } = getOrCreateEntry(data, fileName, gameCode);
  const next: GameDataEntry = { ...entries[index] };
  next[flag] = !next[flag];
  entries[index] = next;
  return { ...data, entries };
}

/** Toggles a game's favorite flag — see {@link toggleFlag}. */
export function toggleFavorite(
  data: GameData,
  fileName: string,
  gameCode?: string | null,
): GameData {
  return toggleFlag(data, fileName, gameCode, 'favorite');
}

/** Toggles a game's completed flag — see {@link toggleFlag}. */
export function toggleCompleted(
  data: GameData,
  fileName: string,
  gameCode?: string | null,
): GameData {
  return toggleFlag(data, fileName, gameCode, 'completed');
}

/** Explicit play-stat values a manual edit sets (non-negative integers). */
export interface GameStats {
  launchCount: number;
  playMinutes: number;
}

/**
 * Overwrites a game's launch count and play time with explicit values, for
 * manual correction (e.g. time played on hardware before tracking existed).
 * The entry is resolved like {@link toggleFlag}'s, by file name through
 * {@link getOrCreateEntry}, but the counts are SET rather than toggled, and
 * flags, lastPlayed and path are kept on the returned entry. Negative, fractional or
 * non-finite inputs are clamped to non-negative integers. Returns a new
 * {@link GameData}; the input is never mutated. Setting both counts to 0
 * makes the entry default-valued, so — unless a flag (favorite/completed)
 * keeps it — {@link serializeGameData} prunes it on write, dropping its
 * lastPlayed/path too (the game leaves recents). That mirrors the launcher,
 * which prunes the same entry on its next save, so preserving those fields
 * here would only diverge from it for a single reload.
 */
export function setGameStats(
  data: GameData,
  fileName: string,
  gameCode: string | null | undefined,
  stats: GameStats,
): GameData {
  const clampCount = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0);
  const { entries, index } = getOrCreateEntry(data, fileName, gameCode);
  entries[index] = {
    ...entries[index],
    launchCount: clampCount(stats.launchCount),
    playMinutes: clampCount(stats.playMinutes),
  };
  return { ...data, entries };
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
    completedCount: 0,
    totalLaunches: 0,
    totalPlayMinutes: 0,
  };
  for (const entry of data.entries) {
    if (entry.favorite) totals.favoriteCount++;
    if (entry.completed) totals.completedCount++;
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
