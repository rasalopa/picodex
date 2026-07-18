import { useEffect, useMemo, useState } from 'react';
import { CoverPicker } from '../components/CoverPicker';
import { ProgressBar } from '../components/ProgressBar';
import { coverBmpCroppedPreviewUrl } from '../lib/coverart';
import { findEntry, type GameDataEntry } from '../lib/gamedata';
import { parseGbaGameCode, parseNdsGameCode } from '../lib/rom';
import { COVERS, GAMES_DIR, getDir, readFileBytes, type LibraryFile } from '../lib/sdcard';
import type { System } from '../lib/systems';
import { useSd } from '../state/SdContext';
import './SystemGallery.css';

/** Maximum covers read and decoded simultaneously. */
const MAX_CONCURRENCY = 6;

/** Header slice size covering both NDS (0xC) and GBA (0xAC) gamecode offsets. */
const HEADER_BYTES = 0xb0;

/** Outcome of resolving one game's cover on the SD card. */
interface ResolvedCover {
  /** Cropped preview object URL, or `null` when the game has no cover. */
  url: string | null;
  /** Header gamecode (NDS/GBA), `null` when not applicable or unreadable. */
  code: string | null;
}

/** One rendered gallery card: the game plus its resolved cover and stats. */
interface Card {
  game: LibraryFile;
  /** `undefined` while the cover is still being resolved. */
  cover: ResolvedCover | undefined;
  /** Matching gamedata.json entry, `undefined` without one (or without the file). */
  entry: GameDataEntry | undefined;
}

/** File name without its final extension. */
function titleOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/** Formats a minute total as "Xh Ym" (e.g. 125 → "2h 5m"). */
function formatPlayTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours)}h ${String(minutes)}m`;
}

/** Play badge text for an entry: play time, launch count, or `null`. */
function playBadge(entry: GameDataEntry): string | null {
  if (entry.playMinutes > 0) return formatPlayTime(entry.playMinutes);
  if (entry.launchCount > 0) return `${String(entry.launchCount)}x`;
  return null;
}

/**
 * Cover gallery of one system: every game of the system as a card with its
 * cover art (cropped to the launcher's visible 106x96 area), resolved
 * progressively from the SD card with a small worker pool. Covers are matched
 * the way the launcher does: `covers/user/<file name>.bmp` first, then — for
 * gamecode-keyed systems — `covers/<nds|gba>/<CODE>.bmp` with the code read
 * from the ROM header. When Pico Enhanced's gamedata.json is present, cards
 * carry play-time badges and a heart button that toggles the favorite on the
 * card (writing gamedata.json back), and favorites sort first. A pencil
 * button on each card opens the manual cover picker for when the automatic
 * matcher chose the wrong box art.
 */
export function SystemGallery({ system, onBack }: { system: System; onBack: () => void }) {
  const { root, games, coverIndex, gameData, toggleFavorite, refresh } = useSd();
  const [resolved, setResolved] = useState<ReadonlyMap<string, ResolvedCover>>(new Map());
  const [error, setError] = useState<string | null>(null);
  /** True while a favorite toggle's SD write is in flight (hearts disable). */
  const [togglePending, setTogglePending] = useState(false);
  /** Card whose cover is being hand-picked, `null` while the modal is closed. */
  const [picking, setPicking] = useState<{ game: LibraryFile; cover: ResolvedCover } | null>(null);
  /**
   * gameData snapshot from when the gallery mounted, used only for ordering:
   * favorites sort first, so sorting on the live data would re-order the grid
   * on every heart toggle and yank the clicked card away from the pointer.
   * The frozen snapshot keeps each card in place for the gallery's lifetime,
   * while heart fill and badges still render the live state.
   */
  const [initialGameData] = useState(gameData);

  const systemGames = useMemo(
    () => games.filter((game) => game.system.id === system.id),
    [games, system.id],
  );

  useEffect(() => {
    if (root === null) return;
    const rootHandle = root;
    let cancelled = false;
    /** Object URLs created so far, revoked on unmount / reload. */
    const urls: string[] = [];
    setResolved(new Map());
    setError(null);

    async function loadAll() {
      const gamesDir =
        system.coverKeying === 'gamecode'
          ? await getDir(rootHandle, [GAMES_DIR, system.gamesDir])
          : null;
      const userDir = await getDir(rootHandle, COVERS.user);
      const codeKey = system.id === 'nds' ? 'nds' : system.id === 'gba' ? 'gba' : null;
      const codeDir = codeKey === null ? null : await getDir(rootHandle, COVERS[codeKey]);

      /** Reads the 4-char gamecode from a ROM header (first bytes only). */
      async function readCode(fileName: string): Promise<string | null> {
        if (gamesDir === null) return null;
        try {
          const handle = await gamesDir.getFileHandle(fileName);
          const file = await handle.getFile();
          const header = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
          return system.id === 'nds' ? parseNdsGameCode(header) : parseGbaGameCode(header);
        } catch {
          return null;
        }
      }

      /** Finds a game's cover file, reads it and decodes a cropped preview. */
      async function resolveCover(game: LibraryFile): Promise<ResolvedCover> {
        // the gamecode also keys the play-stats lookup, so read it for
        // gamecode systems even when a user-folder cover short-circuits
        const code = codeKey === null ? null : await readCode(game.fileName);
        let bytes: Uint8Array | null = null;
        const userName = `${game.fileName}.bmp`;
        if (userDir !== null && coverIndex.user.has(userName.toLowerCase())) {
          bytes = await readFileBytes(userDir, userName);
        }
        if (bytes === null && codeKey !== null && code !== null && codeDir !== null) {
          const codeName = `${code.toUpperCase()}.bmp`;
          if (coverIndex[codeKey].has(codeName.toLowerCase())) {
            bytes = await readFileBytes(codeDir, codeName);
          }
        }
        if (bytes === null) return { url: null, code };
        try {
          return { url: await coverBmpCroppedPreviewUrl(bytes), code };
        } catch {
          // corrupt/unsupported BMP on the card: show the placeholder
          return { url: null, code };
        }
      }

      let next = 0;
      await Promise.all(
        Array.from({ length: Math.min(MAX_CONCURRENCY, systemGames.length) }, async () => {
          for (let i = next++; i < systemGames.length; i = next++) {
            if (cancelled) return;
            const game = systemGames[i];
            // a hard I/O failure (SD yanked mid-read) must not kill the
            // worker: fall back to the placeholder and keep going
            const result = await resolveCover(game).catch((): ResolvedCover => {
              return { url: null, code: null };
            });
            if (cancelled) {
              if (result.url !== null) URL.revokeObjectURL(result.url);
              return;
            }
            if (result.url !== null) urls.push(result.url);
            setResolved((prev) => new Map(prev).set(game.fileName, result));
          }
        }),
      );
    }

    loadAll().catch((e: unknown) => {
      if (!cancelled) setError(e instanceof Error ? e.message : String(e));
    });

    return () => {
      cancelled = true;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [root, system, systemGames, coverIndex]);

  const cards = useMemo<Card[]>(() => {
    const list = systemGames.map((game) => {
      const cover = resolved.get(game.fileName);
      const entry =
        gameData === null
          ? undefined
          : findEntry(gameData, game.fileName, cover?.code ?? undefined);
      // favorites-first is decided on the mount-time snapshot, not the live
      // entry above — see the initialGameData doc for why
      const frozen =
        initialGameData === null
          ? undefined
          : findEntry(initialGameData, game.fileName, cover?.code ?? undefined);
      return { card: { game, cover, entry }, favoriteRank: frozen?.favorite === true ? 0 : 1 };
    });
    list.sort(
      (a, b) =>
        a.favoriteRank - b.favoriteRank ||
        a.card.game.fileName.localeCompare(b.card.game.fileName, undefined, {
          sensitivity: 'base',
        }),
    );
    return list.map(({ card }) => card);
  }, [systemGames, resolved, gameData, initialGameData]);

  /** Toggles a favorite on the SD card; hearts disable until it settles. */
  function handleToggleFavorite(game: LibraryFile, cover: ResolvedCover | undefined) {
    setTogglePending(true);
    void toggleFavorite(game.fileName, cover?.code ?? undefined).finally(() => {
      setTogglePending(false);
    });
  }

  const total = systemGames.length;
  const loading = root !== null && total > 0 && resolved.size < total;

  return (
    <section className="system-gallery" aria-label={`${system.label} games`}>
      <header className="system-gallery__header">
        <button type="button" className="system-gallery__back" onClick={onBack}>
          ← Library
        </button>
        <h2 className="system-gallery__title">{system.label}</h2>
        <p className="system-gallery__count">
          {total} {total === 1 ? 'game' : 'games'}
        </p>
      </header>

      {error !== null && <p className="system-gallery__error">Could not load covers: {error}</p>}

      {loading && (
        <div className="system-gallery__progress" role="status">
          <span>
            Loading covers {resolved.size}/{total}…
          </span>
          <ProgressBar value={resolved.size / total} />
        </div>
      )}

      {total === 0 ? (
        <p className="system-gallery__empty">No {system.label} games on this SD card.</p>
      ) : (
        <ul className="system-gallery__grid">
          {cards.map(({ game, cover, entry }) => {
            const title = titleOf(game.fileName);
            const badge = entry === undefined ? null : playBadge(entry);
            return (
              <li key={game.fileName} className="system-gallery__card">
                <span className="system-gallery__cover-wrap">
                  {cover === undefined ? (
                    <span
                      className="system-gallery__cover system-gallery__cover--skeleton"
                      aria-hidden="true"
                    />
                  ) : cover.url === null ? (
                    <span className="system-gallery__cover system-gallery__cover--missing">
                      <span aria-hidden="true">?</span>
                    </span>
                  ) : (
                    <img
                      className="system-gallery__cover"
                      src={cover.url}
                      alt={`Cover of ${title}`}
                      width={106}
                      height={96}
                    />
                  )}
                  <button
                    type="button"
                    className="system-gallery__edit"
                    aria-label={`Change cover for ${title}`}
                    title={cover === undefined ? 'Resolving game…' : 'Fix cover'}
                    // disabled until the cover/gamecode resolves: without the
                    // code the picker could not target covers/<nds|gba>/
                    disabled={cover === undefined}
                    onClick={() => {
                      if (cover !== undefined) setPicking({ game, cover });
                    }}
                  >
                    <span aria-hidden="true">🖉</span>
                  </button>
                  {gameData !== null && (
                    <button
                      type="button"
                      className={
                        entry?.favorite === true
                          ? 'system-gallery__favorite system-gallery__favorite--on'
                          : 'system-gallery__favorite'
                      }
                      aria-pressed={entry?.favorite === true}
                      aria-label={`Toggle favorite for ${title}`}
                      title={
                        cover === undefined
                          ? 'Resolving game…'
                          : entry?.favorite === true
                            ? 'Remove favorite'
                            : 'Add favorite'
                      }
                      // disabled until the cover/gamecode resolves: a
                      // name-only toggle on a renamed rom would split its
                      // gamedata entry in two
                      disabled={togglePending || cover === undefined}
                      onClick={() => {
                        handleToggleFavorite(game, cover);
                      }}
                    >
                      <span aria-hidden="true">{entry?.favorite === true ? '♥' : '♡'}</span>
                    </button>
                  )}
                  {badge !== null && (
                    <span className="system-gallery__badges">
                      <span className="system-gallery__play">{badge}</span>
                    </span>
                  )}
                </span>
                <span className="system-gallery__name" title={game.fileName}>
                  {title}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {picking !== null && (
        <CoverPicker
          game={picking.game}
          code={picking.cover.code}
          currentCoverUrl={picking.cover.url}
          onClose={() => {
            setPicking(null);
          }}
          onSaved={() => {
            // the gallery effect re-resolves covers off the refreshed
            // coverIndex; the frozen favorites sort stays put by design
            void refresh();
          }}
        />
      )}
    </section>
  );
}
