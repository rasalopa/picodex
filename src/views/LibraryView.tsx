import { useEffect, useMemo, useState } from 'react';
import { BannerEditor } from '../components/BannerEditor';
import { bannerBnrIconPreviewUrl, iconBmpPreviewUrl } from '../lib/coverart';
import { gameDataTotals } from '../lib/gamedata';
import { loaderApiCapabilities } from '../lib/loader';
import { GAMES_DIR, PICO_DIR, getDir, readFileBytes, type LibraryFile } from '../lib/sdcard';
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
  const { root, games, coverIndex, gameData, cardInfo, refresh } = useSd();
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);
  /** Icon URLs keyed by `system.id`. */
  const [systemIcons, setSystemIcons] = useState<ReadonlyMap<string, string>>(new Map());
  /** Folder whose banner is being edited, `null` while the editor is closed. */
  const [bannerTarget, setBannerTarget] = useState<{ gamesDir: string; label: string } | null>(
    null,
  );

  const groups = useMemo(() => groupBySystem(games, coverIndex), [games, coverIndex]);

  // Card icons come from the SD itself, never bundled with the app:
  // a per-game custom icon (/_pico/icons/user) of one of the system's games
  // wins — it distinguishes systems sharing one folder (gb/gbc) — falling
  // back to the folder's banner.bnr (the launcher's folder icon).
  useEffect(() => {
    if (root === null || groups.length === 0) return;
    let cancelled = false;
    const urls: string[] = [];
    async function loadIcons(rootHandle: FileSystemDirectoryHandle) {
      const icons = new Map<string, string>();
      const userIconsDir = await getDir(rootHandle, [PICO_DIR, 'icons', 'user']);
      const folderCache = new Map<string, string | null>();
      for (const group of groups) {
        const { system } = group;
        let url: string | null = null;
        if (userIconsDir !== null) {
          // existence is probed by reading; missing files return null
          for (const game of games) {
            if (game.system.id !== system.id) continue;
            try {
              const bytes = await readFileBytes(userIconsDir, `${game.fileName}.bmp`);
              if (bytes !== null) {
                url = await iconBmpPreviewUrl(bytes);
                break;
              }
            } catch {
              // unreadable icon: try the next game
            }
          }
        }
        if (url === null) {
          let folderUrl = folderCache.get(system.gamesDir);
          if (folderUrl === undefined) {
            folderUrl = null;
            try {
              const dir = await getDir(rootHandle, [GAMES_DIR, system.gamesDir]);
              const bnr = dir === null ? null : await readFileBytes(dir, 'banner.bnr');
              if (bnr !== null) folderUrl = await bannerBnrIconPreviewUrl(bnr);
            } catch {
              // unreadable/corrupt banner: keep the fallback mark
            }
            folderCache.set(system.gamesDir, folderUrl);
            if (folderUrl !== null) urls.push(folderUrl);
          }
          if (folderUrl !== null) icons.set(system.id, folderUrl);
        } else {
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          urls.push(url);
          icons.set(system.id, url);
        }
      }
      if (!cancelled) setSystemIcons(icons);
    }
    void loadIcons(root);
    return () => {
      cancelled = true;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [root, groups, games]);
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
        <div className="library-view__stat card">
          <dt>Games</dt>
          <dd>{games.length}</dd>
        </div>
        <div className="library-view__stat card">
          <dt>Systems</dt>
          <dd>{groups.length}</dd>
        </div>
        {totals !== null && (
          <>
            <div className="library-view__stat card">
              <dt>Favorites</dt>
              <dd>{totals.favoriteCount}</dd>
            </div>
            <div className="library-view__stat card">
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
                className="library-view__card card card--interactive"
                onClick={() => {
                  setSelectedSystemId(system.id);
                }}
              >
                <span className="library-view__card-head">
                  {systemIcons.get(system.id) !== undefined ? (
                    <img
                      className="library-view__card-icon"
                      src={systemIcons.get(system.id)}
                      alt=""
                      width={32}
                      height={32}
                    />
                  ) : (
                    <span
                      className="library-view__card-icon library-view__card-icon--fallback"
                      aria-hidden="true"
                    >
                      ▦
                    </span>
                  )}
                  <span className="library-view__card-label">{system.label}</span>
                </span>
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
              {/* Sibling overlay, NOT a child of the card <button> — nested
                  buttons are invalid HTML. */}
              <button
                type="button"
                className="library-view__card-edit"
                aria-label={`Edit folder banner for ${system.label}`}
                title="Edit folder banner"
                onClick={(e) => {
                  e.stopPropagation();
                  setBannerTarget({ gamesDir: system.gamesDir, label: system.label });
                }}
              >
                <span aria-hidden="true">🖉</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {bannerTarget !== null && (
        <BannerEditor
          gamesDir={bannerTarget.gamesDir}
          systemLabel={bannerTarget.label}
          games={games.filter((game) => game.system.gamesDir === bannerTarget.gamesDir)}
          onClose={() => {
            setBannerTarget(null);
          }}
          onSaved={() => {
            void refresh();
          }}
        />
      )}

      <aside className="library-view__card-info card" aria-label="Card components">
        <h3 className="library-view__card-info-title section-title">On this card</h3>
        <dl className="library-view__card-info-list">
          <div>
            <dt>Launcher</dt>
            <dd>
              {cardInfo.launcherTitle ?? 'Not found'}
              {gameData !== null && <span className="library-view__chip">Pico Enhanced</span>}
              {cardInfo.launcherModified !== null && (
                <span className="library-view__card-info-dim">
                  {' '}
                  · updated {new Date(cardInfo.launcherModified).toLocaleDateString()}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>Pico Loader</dt>
            <dd>
              {cardInfo.loaderApiVersion === null ? (
                'Not found'
              ) : (
                <>
                  API v{cardInfo.loaderApiVersion}
                  <span className="library-view__card-info-dim">
                    {' '}
                    · {loaderApiCapabilities(cardInfo.loaderApiVersion).join(' · ')}
                  </span>
                </>
              )}
            </dd>
          </div>
        </dl>
      </aside>
    </section>
  );
}
