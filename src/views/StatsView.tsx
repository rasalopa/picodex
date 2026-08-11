import { useEffect, useMemo, useState } from 'react';
import {
  gameDataTotals,
  sortedByLastPlayed,
  sortedByMostPlayed,
  type GameDataEntry,
} from '../lib/gamedata';
import { coverBmpCroppedPreviewUrl } from '../lib/coverart';
import { COVERS, getDir, readFileBytes } from '../lib/sdcard';
import { systemForExtension } from '../lib/systems';
import { useSd, type CoverIndex } from '../state/SdContext';
import {
  IconCartridge,
  IconCheckCircle,
  IconClock,
  IconHeart,
  IconPlay,
} from '../components/icons';
import './StatsView.css';

/** How many rows the "Most played" and "Recently played" lists show. */
const TOP_COUNT = 10;

/** Covers resolved in parallel while filling in the lists' thumbnails. */
const COVER_CONCURRENCY = 6;

/** File name without its final extension ("Mario Kart DS.nds" → "Mario Kart DS"). */
function baseName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/** Minutes rendered as "Xh Ym" (125 → "2h 5m"). */
function formatPlayTime(minutes: number): string {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** "YYYY-MM-DD HH:MM" → "DD/MM HH:MM"; unexpected shapes pass through unchanged. */
function formatLastPlayed(lastPlayed: string): string {
  const match = /^\d{4}-(\d{2})-(\d{2}) (\d{2}:\d{2})$/.exec(lastPlayed);
  return match ? `${match[2]}/${match[1]} ${match[3]}` : lastPlayed;
}

type CoverDirs = {
  user: FileSystemDirectoryHandle | null;
  nds: FileSystemDirectoryHandle | null;
  gba: FileSystemDirectoryHandle | null;
};

/**
 * Resolves one game's cover preview URL from the already-loaded cover index,
 * the same way the launcher matches art: a user cover keyed by file name
 * first, then a gamecode cover under the game's own system folder
 * (covers/nds or covers/gba). No ROM reads: the gamecode comes from the
 * gamedata entry. Returns `null` when there is no cover (or it fails to
 * decode) so the caller can show a placeholder.
 */
async function resolveCoverUrl(
  entry: GameDataEntry,
  dirs: CoverDirs,
  coverIndex: CoverIndex,
): Promise<string | null> {
  const userName = `${entry.fileName}.bmp`;
  if (dirs.user !== null && coverIndex.user.has(userName.toLowerCase())) {
    const bytes = await readFileBytes(dirs.user, userName);
    if (bytes !== null) {
      try {
        return await coverBmpCroppedPreviewUrl(bytes);
      } catch {
        // corrupt/unsupported BMP: fall through to the code cover / placeholder
      }
    }
  }
  const code = entry.gameCode;
  if (code !== undefined && code.length > 0) {
    // only the game's own system folder: NDS and GBA gamecodes are
    // independent namespaces, so a cross-system lookup can hit another game
    const system = systemForExtension(entry.fileName);
    const key: 'nds' | 'gba' | null =
      system === null ? null : system.id === 'nds' ? 'nds' : system.id === 'gba' ? 'gba' : null;
    if (key !== null && dirs[key] !== null && coverIndex[key].has(`${code.toLowerCase()}.bmp`)) {
      const bytes = await readFileBytes(dirs[key], `${code.toUpperCase()}.bmp`);
      if (bytes !== null) {
        try {
          return await coverBmpCroppedPreviewUrl(bytes);
        } catch {
          // corrupt/unsupported BMP: show the placeholder
        }
      }
    }
  }
  return null;
}

/** Small cover thumbnail: skeleton while resolving, dashed placeholder when absent. */
function Thumb({ url }: { url: string | null | undefined }) {
  if (typeof url === 'string') {
    return <img className="stats-view__thumb" src={url} alt="" />;
  }
  if (url === null) {
    return (
      <span className="stats-view__thumb stats-view__thumb--missing" aria-hidden="true">
        ?
      </span>
    );
  }
  return <span className="stats-view__thumb stats-view__thumb--skeleton" aria-hidden="true" />;
}

function FavoriteHeart() {
  return (
    <span className="stats-view__heart" role="img" aria-label="Favorite">
      ♥
    </span>
  );
}

/**
 * The "Pico Enhanced" statistics view: headline totals, most played games,
 * recently played games and favorites, all read from `/_pico/gamedata.json`
 * via {@link useSd}, each game shown with its cover thumbnail. When no game
 * data is available (stock launcher, or no SD card open) it renders an info
 * state instead.
 */
export function StatsView() {
  const { root, coverIndex, gameData } = useSd();
  const [covers, setCovers] = useState<ReadonlyMap<string, string | null>>(new Map());

  const lists = useMemo(() => {
    if (gameData === null) {
      return {
        mostPlayed: [] as GameDataEntry[],
        recentlyPlayed: [] as GameDataEntry[],
        favorites: [] as GameDataEntry[],
      };
    }
    return {
      mostPlayed: sortedByMostPlayed(gameData).slice(0, TOP_COUNT),
      recentlyPlayed: sortedByLastPlayed(gameData).slice(0, TOP_COUNT),
      favorites: gameData.entries.filter((entry) => entry.favorite),
    };
  }, [gameData]);

  // the union of games shown across the three lists, deduped by file name, so
  // each cover is resolved once even when a game is in several lists
  const wanted = useMemo(() => {
    const byName = new Map<string, GameDataEntry>();
    for (const entry of [...lists.mostPlayed, ...lists.recentlyPlayed, ...lists.favorites]) {
      if (!byName.has(entry.fileName)) byName.set(entry.fileName, entry);
    }
    return [...byName.values()];
  }, [lists]);

  useEffect(() => {
    if (root === null || wanted.length === 0) {
      setCovers(new Map());
      return;
    }
    const rootHandle = root;
    let cancelled = false;
    /** Object URLs created here, revoked on unmount / re-resolve. */
    const urls: string[] = [];
    setCovers(new Map());

    async function run() {
      const dirs: CoverDirs = {
        user: await getDir(rootHandle, COVERS.user),
        nds: await getDir(rootHandle, COVERS.nds),
        gba: await getDir(rootHandle, COVERS.gba),
      };
      let next = 0;
      await Promise.all(
        Array.from({ length: Math.min(COVER_CONCURRENCY, wanted.length) }, async () => {
          for (let i = next++; i < wanted.length; i = next++) {
            if (cancelled) return;
            const entry = wanted[i];
            // a hard I/O failure (SD yanked mid-read) must not kill the
            // worker: fall back to the placeholder and keep going
            const url = await resolveCoverUrl(entry, dirs, coverIndex).catch(
              (): string | null => null,
            );
            if (cancelled) {
              if (url !== null) URL.revokeObjectURL(url);
              return;
            }
            if (url !== null) urls.push(url);
            setCovers((prev) => new Map(prev).set(entry.fileName, url));
          }
        }),
      );
    }
    run().catch(() => {
      // a hard failure before the workers start (covers dir unreadable, SD
      // yanked): flip every unresolved thumbnail to the placeholder instead
      // of leaving skeletons pulsing forever
      if (cancelled) return;
      setCovers((prev) => {
        const next = new Map(prev);
        for (const entry of wanted) {
          if (!next.has(entry.fileName)) next.set(entry.fileName, null);
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [root, coverIndex, wanted]);

  if (gameData === null) {
    return (
      <section className="stats-view">
        <div className="stats-view__info">
          <p className="stats-view__info-icon" aria-hidden="true">
            ✨
          </p>
          <h2>No play stats yet</h2>
          <p>
            <a
              href="https://github.com/rasalopa/pico-launcher-enhanced"
              target="_blank"
              rel="noreferrer"
            >
              Pico Launcher Enhanced
            </a>{' '}
            records a launch count, play time and favorite for every game. Launch something from the
            launcher and it shows up here.
          </p>
        </div>
      </section>
    );
  }

  const totals = gameDataTotals(gameData);
  const { mostPlayed, recentlyPlayed, favorites } = lists;

  return (
    <section className="stats-view">
      <dl className="stats-view__tiles">
        <div className="stats-view__tile card">
          <IconCartridge className="stats-view__tile-icon" />
          <dt className="stats-view__tile-label">Games played</dt>
          <dd className="stats-view__tile-value">{totals.playedCount}</dd>
        </div>
        <div className="stats-view__tile card">
          <IconHeart className="stats-view__tile-icon" />
          <dt className="stats-view__tile-label">Favorites</dt>
          <dd className="stats-view__tile-value">{totals.favoriteCount}</dd>
        </div>
        <div className="stats-view__tile card">
          <IconCheckCircle className="stats-view__tile-icon" />
          <dt className="stats-view__tile-label">Completed</dt>
          <dd className="stats-view__tile-value">{totals.completedCount}</dd>
        </div>
        <div className="stats-view__tile card">
          <IconPlay className="stats-view__tile-icon" />
          <dt className="stats-view__tile-label">Total launches</dt>
          <dd className="stats-view__tile-value">{totals.totalLaunches}</dd>
        </div>
        <div className="stats-view__tile card">
          <IconClock className="stats-view__tile-icon" />
          <dt className="stats-view__tile-label">Total play time</dt>
          <dd className="stats-view__tile-value">{formatPlayTime(totals.totalPlayMinutes)}</dd>
        </div>
      </dl>

      <section aria-labelledby="stats-view-most-played">
        <h2 className="stats-view__title section-title" id="stats-view-most-played">
          Most played
        </h2>
        {mostPlayed.length === 0 ? (
          <p className="stats-view__none">No games have been launched yet.</p>
        ) : (
          <div className="stats-view__table-wrap">
            <table className="stats-view__table">
              <thead>
                <tr>
                  <th scope="col">Game</th>
                  <th scope="col" className="stats-view__num">
                    Launches
                  </th>
                  <th scope="col" className="stats-view__num">
                    Play time
                  </th>
                  <th scope="col">
                    <span className="stats-view__sr-only">Favorite</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {mostPlayed.map((entry) => (
                  <tr key={entry.fileName}>
                    <td>
                      <div className="stats-view__name-cell">
                        <Thumb url={covers.get(entry.fileName)} />
                        <span className="stats-view__name" title={entry.fileName}>
                          {baseName(entry.fileName)}
                        </span>
                      </div>
                    </td>
                    <td className="stats-view__num">{entry.launchCount}</td>
                    <td className="stats-view__num">{formatPlayTime(entry.playMinutes)}</td>
                    <td className="stats-view__fav">{entry.favorite ? <FavoriteHeart /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="stats-view-recent">
        <h2 className="stats-view__title section-title" id="stats-view-recent">
          Recently played
        </h2>
        {recentlyPlayed.length === 0 ? (
          <p className="stats-view__none">No games have been launched yet.</p>
        ) : (
          <ol className="stats-view__recent">
            {recentlyPlayed.map((entry) => (
              <li key={entry.fileName} className="stats-view__recent-item">
                <div className="stats-view__recent-main">
                  <Thumb url={covers.get(entry.fileName)} />
                  <span className="stats-view__name" title={entry.fileName}>
                    {baseName(entry.fileName)}
                  </span>
                </div>
                <time
                  className="stats-view__when"
                  dateTime={(entry.lastPlayed ?? '').replace(' ', 'T')}
                >
                  {formatLastPlayed(entry.lastPlayed ?? '')}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="stats-view-favorites">
        <h2 className="stats-view__title section-title" id="stats-view-favorites">
          Favorites
        </h2>
        {favorites.length === 0 ? (
          <p className="stats-view__none">
            No favorites yet — press X on a game in the launcher to add one.
          </p>
        ) : (
          <ul className="stats-view__favorites">
            {favorites.map((entry) => (
              <li key={entry.fileName} className="stats-view__favorite" title={entry.fileName}>
                <Thumb url={covers.get(entry.fileName)} />
                <span className="stats-view__name">{baseName(entry.fileName)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
