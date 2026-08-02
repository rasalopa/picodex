import { useEffect, useMemo, useState } from 'react';
import { CompatSheet } from '../components/CompatSheet';
import { CoverPicker } from '../components/CoverPicker';
import { StatsEditor } from '../components/StatsEditor';
import { ProgressBar } from '../components/ProgressBar';
import { coverBmpCroppedPreviewUrl } from '../lib/coverart';
import { findEntry, type GameDataEntry } from '../lib/gamedata';
import {
  NDS_HEADER_PARSE_BYTES,
  parseGbaGameCode,
  parseNdsDsiWareSaveSizes,
  parseNdsGameCode,
  parseNdsIsDsiWare,
  parseNdsIsHomebrew,
  parseNdsNandBackupRegionStart,
  parseNdsSoftwareVersion,
  parseNdsSupportsDsiMode,
} from '../lib/rom';
import type { RomKind } from '../lib/loaderlists';
import { COVERS, getDir, readFileBytes, type LibraryFile } from '../lib/sdcard';
import type { System } from '../lib/systems';
import { useSd } from '../state/SdContext';
import './SystemGallery.css';

/** Maximum covers read and decoded simultaneously. */
const MAX_CONCURRENCY = 6;

/**
 * Header slice size, taken from rom.ts so it cannot drift behind the parsers.
 * Reading short does not fail loudly: the deepest parsers just return null and
 * the sheet then reports every game's header as unreadable.
 */
const HEADER_BYTES = NDS_HEADER_PARSE_BYTES;

/** Header fields PicoDex reads from a ROM (cover, stats and loader-compat keys). */
interface HeaderInfo {
  /** Header gamecode (NDS/GBA), `null` when not applicable or unreadable. */
  code: string | null;
  /** NDS header software revision (byte 0x1E), `null` elsewhere/unreadable. */
  version: number | null;
  /** NDS `nandBackupRegionStart` (header 0x96), `null` elsewhere/unreadable. */
  nandBackupRegionStart: number | null;
  /** NDS DSi-mode (TWL) capability (unitCode bit), `null` elsewhere/unreadable. */
  twl: boolean | null;
  /**
   * Which loader path this ROM takes. `null` means the header could not be
   * read, which is deliberately distinct from 'homebrew': the sheet must not
   * turn a failed read into a claim about the ROM.
   */
  kind: RomKind | null;
  /** DSiWare `.pub`/`.prv` sizes from the TWL header, when applicable. */
  dsiWareSaveBytes: { publicBytes: number; privateBytes: number } | null;
}

/** All-null header, for non-gamecode systems and unreadable ROMs. */
const EMPTY_HEADER: HeaderInfo = {
  code: null,
  version: null,
  nandBackupRegionStart: null,
  twl: null,
  kind: null,
  dsiWareSaveBytes: null,
};

/** Outcome of resolving one game's cover on the SD card: its header plus art. */
interface ResolvedCover extends HeaderInfo {
  /** Cropped preview object URL, or `null` when the game has no cover. */
  url: string | null;
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

/** Lowercased and accent-folded, for accent-insensitive name search. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
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
 * carry play-time badges plus heart and check buttons that toggle the
 * favorite/completed flags on the card (writing gamedata.json back), and
 * favorites sort first. A pencil button on each card opens the manual cover
 * picker for when the automatic matcher chose the wrong box art. On NDS —
 * the only system pico-loader boots — an info button opens the per-game
 * loader-compatibility sheet when the card carries loader lists.
 */
export function SystemGallery({ system, onBack }: { system: System; onBack: () => void }) {
  const {
    root,
    games,
    coverIndex,
    gameData,
    loaderLists,
    toggleFavorite,
    toggleCompleted,
    refresh,
  } = useSd();
  const [resolved, setResolved] = useState<ReadonlyMap<string, ResolvedCover>>(new Map());
  const [error, setError] = useState<string | null>(null);
  /** True while a favorite toggle's SD write is in flight (hearts disable). */
  const [togglePending, setTogglePending] = useState(false);
  /** Card whose cover is being hand-picked, `null` while the modal is closed. */
  const [picking, setPicking] = useState<{ game: LibraryFile; cover: ResolvedCover } | null>(null);
  const [editingStats, setEditingStats] = useState<{
    game: LibraryFile;
    gameCode: string | null;
    launchCount: number;
    playMinutes: number;
  } | null>(null);
  /** Game whose loader-compat sheet is open, `null` while closed. */
  const [compatFor, setCompatFor] = useState<{
    title: string;
    gameCode: string | null;
    kind: RomKind | null;
    dsiWareSaveBytes: { publicBytes: number; privateBytes: number } | null;
    romVersion: number | null;
    nand: { backupRegionStart: number; twl: boolean } | null;
  } | null>(null);
  /** Live search + flag filters, scoped to this system's gallery. */
  const [query, setQuery] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [onlyCompleted, setOnlyCompleted] = useState(false);
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

  /** Unique per file on the card: two same-named ROMs can live in different
   *  folders now, so `fileName` alone cannot key the resolved-cover map. */
  const gameKey = (game: LibraryFile) => [...game.path, game.fileName].join('/');

  useEffect(() => {
    if (root === null) return;
    const rootHandle = root;
    let cancelled = false;
    /** Object URLs created so far, revoked on unmount / reload. */
    const urls: string[] = [];
    setResolved(new Map());
    setError(null);

    async function loadAll() {
      const userDir = await getDir(rootHandle, COVERS.user);
      const codeKey = system.id === 'nds' ? 'nds' : system.id === 'gba' ? 'gba' : null;
      const codeDir = codeKey === null ? null : await getDir(rootHandle, COVERS[codeKey]);
      /** ROMs can live anywhere on the card; directories are opened per game
       *  path and cached (lowercased key — FAT ignores case). */
      const dirCache = new Map<string, FileSystemDirectoryHandle | null>();

      /** Reads the gamecode and, for NDS, the software revision plus the
       *  NAND-save header fields from a ROM header (first bytes only). */
      async function readHeader(game: LibraryFile): Promise<HeaderInfo> {
        if (system.coverKeying !== 'gamecode') return EMPTY_HEADER;
        const dirKey = game.path.join('/').toLowerCase();
        let dir = dirCache.get(dirKey);
        if (dir === undefined) {
          dir = await getDir(rootHandle, game.path);
          dirCache.set(dirKey, dir);
        }
        if (dir === null) return EMPTY_HEADER;
        try {
          const handle = await dir.getFileHandle(game.fileName);
          const file = await handle.getFile();
          const header = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
          if (system.id !== 'nds') {
            return {
              code: parseGbaGameCode(header),
              version: null,
              nandBackupRegionStart: null,
              twl: null,
              kind: null,
              dsiWareSaveBytes: null,
            };
          }
          // order matters: the loader tests isHomebrew first and only reaches
          // its IsDsiWare() branch for non-homebrew ROMs (NdsLoader.cpp:201)
          const homebrew = parseNdsIsHomebrew(header);
          const dsiWare = parseNdsIsDsiWare(header);
          return {
            code: parseNdsGameCode(header),
            version: parseNdsSoftwareVersion(header),
            nandBackupRegionStart: parseNdsNandBackupRegionStart(header),
            twl: parseNdsSupportsDsiMode(header),
            kind:
              homebrew === null || dsiWare === null
                ? null
                : homebrew
                  ? 'homebrew'
                  : dsiWare
                    ? 'dsiware'
                    : 'retail',
            dsiWareSaveBytes: dsiWare === true ? parseNdsDsiWareSaveSizes(header) : null,
          };
        } catch {
          return EMPTY_HEADER;
        }
      }

      /** Finds a game's cover file, reads it and decodes a cropped preview. */
      async function resolveCover(game: LibraryFile): Promise<ResolvedCover> {
        // the gamecode also keys the play-stats lookup and the loader-compat
        // sheet (which needs the revision and the NAND-save header fields), so
        // read the header for gamecode systems even when a user-folder cover
        // short-circuits
        const header = codeKey === null ? EMPTY_HEADER : await readHeader(game);
        let bytes: Uint8Array | null = null;
        const userName = `${game.fileName}.bmp`;
        if (userDir !== null && coverIndex.user.has(userName.toLowerCase())) {
          bytes = await readFileBytes(userDir, userName);
        }
        if (bytes === null && codeKey !== null && header.code !== null && codeDir !== null) {
          const codeName = `${header.code.toUpperCase()}.bmp`;
          if (coverIndex[codeKey].has(codeName.toLowerCase())) {
            bytes = await readFileBytes(codeDir, codeName);
          }
        }
        if (bytes === null) return { ...header, url: null };
        try {
          return { ...header, url: await coverBmpCroppedPreviewUrl(bytes) };
        } catch {
          // corrupt/unsupported BMP on the card: show the placeholder
          return { ...header, url: null };
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
              return { ...EMPTY_HEADER, url: null };
            });
            if (cancelled) {
              if (result.url !== null) URL.revokeObjectURL(result.url);
              return;
            }
            if (result.url !== null) urls.push(result.url);
            setResolved((prev) => new Map(prev).set(gameKey(game), result));
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
      const cover = resolved.get(gameKey(game));
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

  /** Toggles a game flag on the SD card; all badges disable until it settles. */
  function handleToggle(
    toggle: (fileName: string, gameCode?: string | null) => Promise<void>,
    game: LibraryFile,
    cover: ResolvedCover | undefined,
  ) {
    setTogglePending(true);
    void toggle(game.fileName, cover?.code ?? undefined).finally(() => {
      setTogglePending(false);
    });
  }

  const total = systemGames.length;
  const loading = root !== null && total > 0 && resolved.size < total;

  // loader-compat info exists only for NDS (pico-loader boots nothing else)
  // and only when the card actually carries at least one loader list
  const showCompat =
    system.id === 'nds' &&
    loaderLists !== null &&
    (loaderLists.ap !== null || loaderLists.save !== null || loaderLists.patch !== null);

  // client-side filtering over the already-built cards: name search (accent
  // insensitive) plus the favorite/completed toggles, all combined with AND
  const normalizedQuery = normalize(query.trim());
  const visibleCards = cards.filter(({ game, entry }) => {
    if (
      normalizedQuery.length > 0 &&
      !normalize(titleOf(game.fileName)).includes(normalizedQuery)
    ) {
      return false;
    }
    if (onlyFavorites && entry?.favorite !== true) return false;
    if (onlyCompleted && entry?.completed !== true) return false;
    return true;
  });
  const filtering = normalizedQuery.length > 0 || onlyFavorites || onlyCompleted;

  return (
    <section className="system-gallery" aria-label={`${system.label} games`}>
      <header className="system-gallery__header">
        <button type="button" className="system-gallery__back" onClick={onBack}>
          ← Library
        </button>
        <h2 className="system-gallery__title">{system.label}</h2>
        <p className="system-gallery__count">
          {filtering
            ? `${String(visibleCards.length)} of ${String(total)}`
            : `${String(total)} ${total === 1 ? 'game' : 'games'}`}
        </p>
      </header>

      {total > 0 && (
        <div className="system-gallery__controls">
          <input
            type="search"
            className="system-gallery__search"
            placeholder={`Search ${system.label}…`}
            aria-label={`Search ${system.label} games`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQuery('');
            }}
          />
          {gameData !== null && (
            <div className="system-gallery__filters" role="group" aria-label="Filters">
              <button
                type="button"
                className={
                  onlyFavorites
                    ? 'system-gallery__filter system-gallery__filter--fav-on'
                    : 'system-gallery__filter'
                }
                aria-pressed={onlyFavorites}
                onClick={() => {
                  setOnlyFavorites((value) => !value);
                }}
              >
                <span aria-hidden="true">♥</span> Favorites
              </button>
              <button
                type="button"
                className={
                  onlyCompleted
                    ? 'system-gallery__filter system-gallery__filter--done-on'
                    : 'system-gallery__filter'
                }
                aria-pressed={onlyCompleted}
                onClick={() => {
                  setOnlyCompleted((value) => !value);
                }}
              >
                <span aria-hidden="true">✓</span> Completed
              </button>
            </div>
          )}
        </div>
      )}

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
      ) : visibleCards.length === 0 ? (
        <p className="system-gallery__empty">No games match your search.</p>
      ) : (
        <ul className="system-gallery__grid">
          {visibleCards.map(({ game, cover, entry }) => {
            const title = titleOf(game.fileName);
            const badge = entry === undefined ? null : playBadge(entry);
            return (
              <li key={gameKey(game)} className="system-gallery__card">
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
                    title={cover === undefined ? 'Resolving game…' : 'Pick the correct box art'}
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
                            ? 'Remove from favorites'
                            : 'Mark as a favorite'
                      }
                      // disabled until the cover/gamecode resolves: a
                      // name-only toggle on a renamed rom would split its
                      // gamedata entry in two
                      disabled={togglePending || cover === undefined}
                      onClick={() => {
                        handleToggle(toggleFavorite, game, cover);
                      }}
                    >
                      <span aria-hidden="true">{entry?.favorite === true ? '♥' : '♡'}</span>
                    </button>
                  )}
                  {gameData !== null && (
                    <button
                      type="button"
                      className={
                        entry?.completed === true
                          ? 'system-gallery__completed system-gallery__completed--on'
                          : 'system-gallery__completed'
                      }
                      aria-pressed={entry?.completed === true}
                      aria-label={`Toggle completed for ${title}`}
                      title={
                        cover === undefined
                          ? 'Resolving game…'
                          : entry?.completed === true
                            ? 'Unmark as completed'
                            : 'Mark as completed'
                      }
                      // same gate as the heart: a name-only toggle on a
                      // renamed rom would split its gamedata entry in two
                      disabled={togglePending || cover === undefined}
                      onClick={() => {
                        handleToggle(toggleCompleted, game, cover);
                      }}
                    >
                      <span aria-hidden="true">✓</span>
                    </button>
                  )}
                  {gameData !== null && (
                    <button
                      type="button"
                      className="system-gallery__badges system-gallery__badges--button"
                      aria-label={`Edit play stats for ${title}`}
                      title={
                        cover === undefined
                          ? 'Resolving game…'
                          : 'Correct launch count and play time'
                      }
                      // same gate as the heart: the gamecode must resolve
                      // before we can key the write to the right entry
                      disabled={cover === undefined}
                      onClick={() => {
                        if (cover === undefined) return;
                        setEditingStats({
                          game,
                          gameCode: cover.code ?? null,
                          launchCount: entry?.launchCount ?? 0,
                          playMinutes: entry?.playMinutes ?? 0,
                        });
                      }}
                    >
                      <span className="system-gallery__play">
                        {badge ?? <span aria-hidden="true">🕓</span>}
                      </span>
                    </button>
                  )}
                  {showCompat && (
                    <button
                      type="button"
                      className="system-gallery__compat"
                      aria-label={`Loader compatibility for ${title}`}
                      title={
                        cover === undefined
                          ? 'Resolving game…'
                          : 'What the loader does for this game'
                      }
                      // disabled until the header resolves: the sheet keys
                      // its lookups on the gamecode and revision
                      disabled={cover === undefined}
                      onClick={() => {
                        if (cover === undefined) return;
                        setCompatFor({
                          title,
                          gameCode: cover.code,
                          kind: cover.kind,
                          dsiWareSaveBytes: cover.dsiWareSaveBytes,
                          romVersion: cover.version,
                          // a readable NAND start (non-null) always comes with
                          // a readable twl bit from the same header slice
                          nand:
                            cover.nandBackupRegionStart === null
                              ? null
                              : {
                                  backupRegionStart: cover.nandBackupRegionStart,
                                  twl: cover.twl ?? false,
                                },
                        });
                      }}
                    >
                      <span aria-hidden="true">ⓘ</span>
                    </button>
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

      {editingStats !== null && (
        <StatsEditor
          game={editingStats.game}
          gameCode={editingStats.gameCode}
          launchCount={editingStats.launchCount}
          playMinutes={editingStats.playMinutes}
          onClose={() => {
            // setStats commits to gameData directly, so the badge updates
            // from live state; no refresh needed
            setEditingStats(null);
          }}
        />
      )}

      {compatFor !== null && (
        <CompatSheet
          title={compatFor.title}
          gameCode={compatFor.gameCode}
          kind={compatFor.kind}
          dsiWareSaveBytes={compatFor.dsiWareSaveBytes}
          romVersion={compatFor.romVersion}
          nand={compatFor.nand}
          onClose={() => {
            setCompatFor(null);
          }}
        />
      )}
    </section>
  );
}
