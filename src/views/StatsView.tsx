import { gameDataTotals, sortedByLastPlayed, sortedByMostPlayed } from '../lib/gamedata';
import { useSd } from '../state/SdContext';
import './StatsView.css';

/** How many rows the "Most played" and "Recently played" lists show. */
const TOP_COUNT = 10;

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
 * via {@link useSd}. When no game data is available (stock launcher, or no SD
 * card open) it renders an info state instead.
 */
export function StatsView() {
  const { gameData } = useSd();

  if (gameData === null) {
    return (
      <section className="stats-view">
        <div className="stats-view__info">
          <p className="stats-view__info-icon" aria-hidden="true">
            ✨
          </p>
          <h2>No play stats here yet</h2>
          <p>
            This section lights up when the SD card runs{' '}
            <a
              href="https://github.com/rasalopa/pico-launcher-enhanced"
              target="_blank"
              rel="noreferrer"
            >
              Pico Launcher Enhanced
            </a>
            , a launcher fork that tracks launches, play time and favorites for every game. It is a
            drop-in replacement for the stock{' '}
            <a href="https://github.com/LNH-team/pico-launcher" target="_blank" rel="noreferrer">
              Pico Launcher
            </a>
            , which does not record play statistics.
          </p>
        </div>
      </section>
    );
  }

  const totals = gameDataTotals(gameData);
  const mostPlayed = sortedByMostPlayed(gameData).slice(0, TOP_COUNT);
  const recentlyPlayed = sortedByLastPlayed(gameData).slice(0, TOP_COUNT);
  const favorites = gameData.entries.filter((entry) => entry.favorite);

  return (
    <section className="stats-view">
      <dl className="stats-view__tiles">
        <div className="stats-view__tile card">
          <dt className="stats-view__tile-label">Games played</dt>
          <dd className="stats-view__tile-value">{totals.playedCount}</dd>
        </div>
        <div className="stats-view__tile card">
          <dt className="stats-view__tile-label">Favorites</dt>
          <dd className="stats-view__tile-value">{totals.favoriteCount}</dd>
        </div>
        <div className="stats-view__tile card">
          <dt className="stats-view__tile-label">Completed</dt>
          <dd className="stats-view__tile-value">{totals.completedCount}</dd>
        </div>
        <div className="stats-view__tile card">
          <dt className="stats-view__tile-label">Total launches</dt>
          <dd className="stats-view__tile-value">{totals.totalLaunches}</dd>
        </div>
        <div className="stats-view__tile card">
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
                    <td className="stats-view__name" title={entry.fileName}>
                      {baseName(entry.fileName)}
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
                <span className="stats-view__name" title={entry.fileName}>
                  {baseName(entry.fileName)}
                </span>
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
                <span className="stats-view__heart" aria-hidden="true">
                  ♥
                </span>
                <span className="stats-view__name">{baseName(entry.fileName)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
