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
  /** Entries marked as completed (played or not). */
  completedCount: number;
  /** Sum of launchCount over played entries. */
  totalLaunches: number;
  /** Sum of playMinutes over played entries. */
  totalPlayMinutes: number;
}

/**
 * Whether a game code can serve as a stable identity (and is safe inside the
 * JSON file). Homebrew headers can hold garbage where retail games keep their
 * code, so only non-empty printable-ASCII codes are usable — and `####`, the
 * toolchain placeholder every homebrew without its own code carries, is not
 * an identity either (matching by it would make them all share one entry).
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
    if (!entry.favorite && !entry.completed && entry.launchCount <= 0 && entry.playMinutes <= 0)
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

/** User-editable boolean marks on a game entry. */
export type GameFlag = 'favorite' | 'completed';

/**
 * Toggles one of a game's boolean flags, mirroring the launcher's
 * `ToggleFavorite`/`ToggleCompleted` (X press / X long-press). The entry is
 * resolved like the launcher's `GetOrCreateEntry`: code-first
 * (case-insensitive, usable codes only — see {@link isUsableGameCode}) with
 * the file name healed to the given one on a code match (the code is the
 * stable identity, the file may have been renamed since the entry was
 * written); then by file name (case-insensitive), adopting the code when the
 * entry lacks one (upgrading a legacy name-keyed entry); else a fresh entry
 * with just that flag set is appended.
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
  const code = gameCode ?? undefined;
  const usable = isUsableGameCode(code);
  const entries = [...data.entries];

  if (usable) {
    const lowerCode = code.toLowerCase();
    const index = entries.findIndex(
      (entry) => entry.gameCode !== undefined && entry.gameCode.toLowerCase() === lowerCode,
    );
    const found = index >= 0 ? entries[index] : undefined;
    if (found !== undefined) {
      // self-heal the file name: the code survives renames, the name may not
      let healed: GameDataEntry = { ...found, fileName };
      healed[flag] = !found[flag];
      // healing may rename onto a fileName owned by a code-less duplicate
      // (e.g. a toggle recorded before this game's code was known). Both the
      // launcher and serializeGameData collapse duplicate names
      // last-writer-wins, which would destroy this entry's history — merge
      // the duplicate into the surviving entry instead.
      const lowerName = fileName.toLowerCase();
      const duplicateIndex = entries.findIndex(
        (entry, i) =>
          i !== index && entry.gameCode === undefined && entry.fileName.toLowerCase() === lowerName,
      );
      if (duplicateIndex >= 0) {
        const duplicate = entries[duplicateIndex];
        healed = {
          ...healed,
          launchCount: healed.launchCount + duplicate.launchCount,
          playMinutes: healed.playMinutes + duplicate.playMinutes,
          lastPlayed:
            healed.lastPlayed !== undefined &&
            (duplicate.lastPlayed === undefined || duplicate.lastPlayed <= healed.lastPlayed)
              ? healed.lastPlayed
              : duplicate.lastPlayed,
        };
        // a flag set only on the swallowed duplicate must survive the merge.
        // The flag being toggled is exempt: the UI showed (and the user acted
        // on) the code entry's state, so its just-flipped value wins — OR-ing
        // it too would undo an intentional un-toggle.
        const untoggled: GameFlag = flag === 'favorite' ? 'completed' : 'favorite';
        healed[untoggled] = healed[untoggled] || duplicate[untoggled];
        entries.splice(duplicateIndex, 1);
      }
      const healedIndex = entries.indexOf(found);
      entries[healedIndex] = healed;
      return { ...data, entries };
    }
  }

  const lowerName = fileName.toLowerCase();
  const index = entries.findIndex((entry) => entry.fileName.toLowerCase() === lowerName);
  const found = index >= 0 ? entries[index] : undefined;
  if (found !== undefined) {
    const next: GameDataEntry = { ...found };
    next[flag] = !found[flag];
    if (usable && next.gameCode === undefined) next.gameCode = code;
    entries[index] = next;
    return { ...data, entries };
  }

  const created: GameDataEntry = {
    fileName,
    favorite: false,
    completed: false,
    launchCount: 0,
    playMinutes: 0,
  };
  created[flag] = true;
  if (usable) created.gameCode = code;
  entries.push(created);
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
