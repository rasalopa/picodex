import { useMemo, useState } from 'react';
import { gameDataTotals } from '../lib/gamedata';
import { GAMES_DIR, type LibraryFile } from '../lib/sdcard';
import type { System } from '../lib/systems';
import { useSd, type CoverIndex } from '../state/SdContext';
import { SystemGallery } from './SystemGallery';
import './LibraryView.css';

/** One row of the per-system grid: a system plus its aggregate numbers. */
interface SystemGroup {
  system: System;
  /** Number of games found for this system. */
  count: number;
  /** Games with cover art present (see `approximate`). */
  covered: number;
  /** True when `covered` is the gamecode-based estimate, not an exact match. */
  approximate: boolean;
}

/**
 * Groups the library by system (keeping scan order) and computes cover-art
 * coverage per system.
 *
 * Coverage per game:
 * - Filename-keyed systems are exact: a game counts as covered when
 *   `_pico/covers/user/<file name>.bmp` exists.
 * - Gamecode-keyed systems (NDS/GBA) are approximate: matching a cover to a
 *   game would require reading each ROM's header bytes for its gamecode, so
 *   the number of files in the system's gamecode covers folder is used
 *   instead — plus exact user-folder covers via the filename rule — capped
 *   at the game count.
 */
function groupBySystem(games: readonly LibraryFile[], coverIndex: CoverIndex): SystemGroup[] {
  const groups = new Map<string, { system: System; files: LibraryFile[] }>();
  for (const game of games) {
    let group = groups.get(game.system.id);
    if (group === undefined) {
      group = { system: game.system, files: [] };
      groups.set(game.system.id, group);
    }
    group.files.push(game);
  }
  return [...groups.values()].map(({ system, files }) => {
    const byFileName = files.filter((file) =>
      coverIndex.user.has(`${file.fileName}.bmp`.toLowerCase()),
    ).length;
    if (system.coverKeying === 'filename') {
      return { system, count: files.length, covered: byFileName, approximate: false };
    }
    const codeCovers = system.id === 'gba' ? coverIndex.gba.size : coverIndex.nds.size;
    return {
      system,
      count: files.length,
      covered: Math.min(files.length, codeCovers + byFileName),
      approximate: true,
    };
  });
}

/** Formats a minute total as "Xh Ym" (e.g. 125 → "2h 5m"). */
function formatPlayTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours)}h ${String(minutes)}m`;
}

/**
 * Landing view for an open SD card: a summary strip (game total, systems
 * present and — when the Pico Enhanced launcher's gamedata.json exists —
 * favorites and total play time) above a responsive card grid with one card
 * per system showing its game count and cover-art coverage. Clicking a
 * system card opens that system's cover gallery in place.
 */
export function LibraryView() {
  const { games, coverIndex, gameData } = useSd();
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);

  const groups = useMemo(() => groupBySystem(games, coverIndex), [games, coverIndex]);
  const totals = useMemo(() => (gameData === null ? null : gameDataTotals(gameData)), [gameData]);

  const selectedSystem =
    selectedSystemId === null
      ? null
      : (groups.find((group) => group.system.id === selectedSystemId)?.system ?? null);

  if (selectedSystem !== null) {
    return (
      <SystemGallery
        system={selectedSystem}
        onBack={() => {
          setSelectedSystemId(null);
        }}
      />
    );
  }

  return (
    <section className="library-view" aria-label="Library overview">
      <dl className="library-view__summary">
        <div className="library-view__stat">
          <dt>Games</dt>
          <dd>{games.length}</dd>
        </div>
        <div className="library-view__stat">
          <dt>Systems</dt>
          <dd>{groups.length}</dd>
        </div>
        {totals !== null && (
          <>
            <div className="library-view__stat">
              <dt>Favorites</dt>
              <dd>{totals.favoriteCount}</dd>
            </div>
            <div className="library-view__stat">
              <dt>Play time</dt>
              <dd>{formatPlayTime(totals.totalPlayMinutes)}</dd>
            </div>
          </>
        )}
      </dl>

      {games.length === 0 ? (
        <p className="library-view__empty">No games found under {GAMES_DIR}/</p>
      ) : (
        <ul className="library-view__grid">
          {groups.map(({ system, count, covered, approximate }) => (
            <li key={system.id}>
              <button
                type="button"
                className="library-view__card"
                onClick={() => {
                  setSelectedSystemId(system.id);
                }}
              >
                <span className="library-view__card-label">{system.label}</span>
                <span className="library-view__card-count">
                  {count} {count === 1 ? 'game' : 'games'}
                </span>
                <span
                  className="library-view__card-covers"
                  title={
                    approximate
                      ? `Approximate: ${system.label} covers are keyed by ROM gamecode, which cannot be matched to files without reading each ROM. This is the number of cover files present, capped at the game count.`
                      : undefined
                  }
                >
                  {covered}/{count} covers{approximate ? ' (approx.)' : ''}
                </span>
                <span className="library-view__bar" aria-hidden="true">
                  {/* count >= 1 by construction: a group only exists for systems with games */}
                  <span
                    className={`library-view__bar-fill${
                      covered >= count ? ' library-view__bar-fill--full' : ''
                    }`}
                    style={{ width: `${String((covered / count) * 100)}%` }}
                  />
                </span>
                <span className="library-view__card-cta">View games →</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
