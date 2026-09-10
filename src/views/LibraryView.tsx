import { useEffect, useMemo, useState } from 'react';
import { BannerEditor } from '../components/BannerEditor';
import { bannerBnrIconPreviewUrl, iconBmpPreviewUrl } from '../lib/coverart';
import { gameDataTotals } from '../lib/gamedata';
import { loaderApiCapabilities } from '../lib/loader';
import { GAMES_DIR, ICONS, getDir, readFileBytes, type LibraryFile } from '../lib/sdcard';
import type { System } from '../lib/systems';
import { systemsSharingGamesDir } from '../lib/systems';
import { useSd, type CoverIndex } from '../state/SdContext';
import { useT } from '../i18n';
import { IconCartridge, IconClock, IconHeart, IconLayers } from '../components/icons';
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

/**
 * Landing view for an open SD card: a summary strip (game total, systems
 * present and — when the Pico Enhanced launcher's gamedata.json exists —
 * favorites and total play time) above a responsive card grid with one card
 * per system showing its game count and cover-art coverage. Clicking a
 * system card opens that system's cover gallery in place.
 */
/** The folder's `banner.bnr` icon as an object URL, `null` when absent or unreadable. */
async function readFolderBannerIcon(
  root: FileSystemDirectoryHandle,
  gamesDir: string,
): Promise<string | null> {
  try {
    const dir = await getDir(root, [GAMES_DIR, gamesDir]);
    const bnr = dir === null ? null : await readFileBytes(dir, 'banner.bnr');
    return bnr === null ? null : await bannerBnrIconPreviewUrl(bnr);
  } catch {
    // unreadable/corrupt banner: keep the fallback mark
    return null;
  }
}

/**
 * A custom icon (`/_pico/icons/user`) of one of the system's games, as an
 * object URL; existence is probed by reading, so a missing file is `null`.
 */
async function readGameUserIcon(
  userIconsDir: FileSystemDirectoryHandle,
  games: readonly LibraryFile[],
  systemId: string,
): Promise<string | null> {
  for (const game of games) {
    if (game.system.id !== systemId) continue;
    try {
      const bytes = await readFileBytes(userIconsDir, `${game.fileName}.bmp`);
      if (bytes !== null) return await iconBmpPreviewUrl(bytes);
    } catch {
      // unreadable icon, or one the launcher would not display: try the next game
    }
  }
  return null;
}

export function LibraryView() {
  const { root, games, coverIndex, gameData, cardInfo, refresh } = useSd();
  const t = useT();
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);
  /** Icon URLs keyed by `system.id`. */
  const [systemIcons, setSystemIcons] = useState<ReadonlyMap<string, string>>(new Map());
  /** Folder whose banner is being edited, `null` while the editor is closed. */
  const [bannerTarget, setBannerTarget] = useState<{ gamesDir: string; label: string } | null>(
    null,
  );

  const groups = useMemo(() => groupBySystem(games, coverIndex), [games, coverIndex]);

  // Card icons come from the SD itself, never bundled with the app. The
  // folder's banner.bnr is what the launcher shows for the folder, so it
  // represents the system best; a per-game custom icon (/_pico/icons/user)
  // is the fallback — except when several systems share one folder (gb/gbc):
  // the banner cannot tell them apart, so there a game's own icon goes first.
  useEffect(() => {
    if (root === null || groups.length === 0) return;
    let cancelled = false;
    const urls: string[] = [];
    async function loadIcons(rootHandle: FileSystemDirectoryHandle) {
      const icons = new Map<string, string>();
      const userIconsDir = await getDir(rootHandle, ICONS.user);
      const folderCache = new Map<string, string | null>();
      for (const { system } of groups) {
        const shared = systemsSharingGamesDir(system.gamesDir).length > 1;
        const order = shared ? (['game', 'folder'] as const) : (['folder', 'game'] as const);
        let url: string | null = null;
        for (const source of order) {
          if (url !== null) break;
          if (source === 'folder') {
            let folderUrl = folderCache.get(system.gamesDir);
            if (folderUrl === undefined) {
              folderUrl = await readFolderBannerIcon(rootHandle, system.gamesDir);
              if (folderUrl !== null) urls.push(folderUrl);
              folderCache.set(system.gamesDir, folderUrl);
            }
            url = folderUrl;
          } else if (userIconsDir !== null) {
            url = await readGameUserIcon(userIconsDir, games, system.id);
            if (url !== null) urls.push(url);
          }
          // a URL created after the cleanup ran would never be revoked there
          if (cancelled) {
            for (const u of urls) URL.revokeObjectURL(u);
            return;
          }
        }
        if (url !== null) icons.set(system.id, url);
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
    <section className="library-view" aria-label={t.library.overviewLabel}>
      <dl className="library-view__summary">
        <div className="library-view__stat card">
          <IconCartridge className="library-view__stat-icon" />
          <dt>{t.library.games}</dt>
          <dd>{games.length}</dd>
        </div>
        <div className="library-view__stat card">
          <IconLayers className="library-view__stat-icon" />
          <dt>{t.library.systems}</dt>
          <dd>{groups.length}</dd>
        </div>
        {totals !== null && (
          <>
            <div className="library-view__stat card">
              <IconHeart className="library-view__stat-icon" />
              <dt>{t.library.favorites}</dt>
              <dd>{totals.favoriteCount}</dd>
            </div>
            <div className="library-view__stat card">
              <IconClock className="library-view__stat-icon" />
              <dt>{t.library.playTime}</dt>
              <dd>{t.library.playTimeValue(totals.totalPlayMinutes)}</dd>
            </div>
          </>
        )}
      </dl>

      {games.length === 0 ? (
        <p className="library-view__empty">
          {t.library.noGames1}
          <code>/_pico</code>
          {t.library.noGames2}
          <code>Games/nds</code>
          {t.library.noGames3}
          <code>roms/</code>
          {t.library.noGames4}
        </p>
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
                <span className="library-view__card-count">{t.library.gameCount(count)}</span>
                <span
                  className="library-view__card-covers"
                  title={approximate ? t.library.approxTitle(system.label) : undefined}
                >
                  {t.library.covers(covered, count, approximate)}
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
                <span className="library-view__card-cta">{t.library.viewGames}</span>
              </button>
              {/* Sibling overlay, NOT a child of the card <button> — nested
                  buttons are invalid HTML. */}
              <button
                type="button"
                className="library-view__card-edit"
                aria-label={t.library.editBannerFor(system.label)}
                title={t.library.editBannerTitle(system.label)}
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
          // the editor reads ROM banners from the canonical folder, so only
          // offer the games that actually live there (case-insensitive: FAT)
          games={games.filter(
            (game) =>
              game.path.length === 2 &&
              game.path[0].toLowerCase() === GAMES_DIR.toLowerCase() &&
              game.path[1].toLowerCase() === bannerTarget.gamesDir.toLowerCase(),
          )}
          onClose={() => {
            setBannerTarget(null);
          }}
          onSaved={() => {
            void refresh();
          }}
        />
      )}

      <aside className="library-view__card-info card" aria-label={t.library.cardComponentsLabel}>
        <h3 className="library-view__card-info-title section-title">{t.library.onThisCard}</h3>
        <dl className="library-view__card-info-list">
          <div>
            <dt>{t.library.launcher}</dt>
            <dd>
              {cardInfo.launcherTitle ?? t.library.notFound}
              {(cardInfo.isEnhancedFork || gameData !== null) && (
                <span className="library-view__chip">{t.library.enhancedChip}</span>
              )}
              {cardInfo.launcherModified !== null && (
                <span className="library-view__card-info-dim">
                  {' '}
                  {t.library.updatedOn(new Date(cardInfo.launcherModified).toLocaleDateString())}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>{t.library.picoLoader}</dt>
            <dd>
              {cardInfo.loaderApiVersion === null ? (
                t.library.notFound
              ) : (
                <>
                  {t.library.apiVersion(cardInfo.loaderApiVersion)}
                  <span className="library-view__card-info-dim">
                    {' '}
                    ·{' '}
                    {loaderApiCapabilities(cardInfo.loaderApiVersion)
                      .map((c) => t.library.capabilities[c])
                      .join(' · ')}
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
