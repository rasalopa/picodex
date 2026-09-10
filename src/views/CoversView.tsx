import { ProgressBar } from '../components/ProgressBar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { isUsableGameCode } from '../lib/gamedata';
import { encodeCoverBmp } from '../lib/bmp';
import { composeCoverRgba, coverBmpPreviewUrl, downloadPngAsBitmap } from '../lib/coverart';
import { DEFAULT_REGION_PREFS, REGION_PREFS_BY_GBA_CODE, pickBoxart } from '../lib/matching';
import { parseGbaGameCode, parseNdsGameCode } from '../lib/rom';
import { COVERS, getDir, writeFileBytes, type LibraryFile } from '../lib/sdcard';
import type { System } from '../lib/systems';
import { boxartUrl, fetchCatalog } from '../lib/thumbnails';
import { readCachedCatalog, writeCachedCatalog } from '../lib/catalogCache';
import type { CoverSlot } from '../lib/coverCache';
import { useSd, type CoverIndex } from '../state/SdContext';
import { useT } from '../i18n';
import './CoversView.css';

/** A library game with no cover on the SD card yet. */
interface MissingGame {
  /** Unique id: `<system id>/<file name>`. */
  id: string;
  game: LibraryFile;
  /** Header gamecode for NDS/GBA ROMs, `null` when unreadable or not applicable. */
  code: string | null;
}

type JobPhase = 'pending' | 'matched' | 'written' | 'no-match' | 'error';

/** Per-game progress entry of a fetch batch. */
interface Job {
  id: string;
  fileName: string;
  systemLabel: string;
  phase: JobPhase;
  /** Matched catalog file name (matched/written phases). */
  match?: string;
  /** Object URL previewing the written cover (written phase). */
  previewUrl?: string;
  /** Failure detail (error phase). */
  message?: string;
}

/** Maximum simultaneous boxart downloads. */
const MAX_CONCURRENCY = 4;

/**
 * Maximum ROM headers read concurrently while scanning for missing covers.
 * These are small local reads, so more than the download pool is fine; past a
 * handful the card reader itself is the limit.
 */
const SCAN_CONCURRENCY = 8;

/** Header slice size covering both NDS (0xC) and GBA (0xAC) gamecode offsets. */
const HEADER_BYTES = 0xb0;

/** Cover directory key for a gamecode-keyed system. */
function gamecodeCoverKey(system: System): 'nds' | 'gba' {
  return system.id === 'nds' ? 'nds' : 'gba';
}

/** File name without its final extension. */
function titleOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Reads the 4-character gamecode from an NDS/GBA ROM header, fetching only
 * the first {@link HEADER_BYTES} bytes of the file.
 */
async function readGameCode(
  root: FileSystemDirectoryHandle,
  game: LibraryFile,
  dirCache: Map<string, Promise<FileSystemDirectoryHandle | null>>,
): Promise<string | null> {
  const { system, fileName } = game;
  // ROMs can live anywhere on the card; cache directories per game path
  // (lowercased key — FAT ignores case). The cache holds promises so that
  // several games of one folder, classified concurrently, share one lookup.
  const dirKey = game.path.join('/').toLowerCase();
  let dirPromise = dirCache.get(dirKey);
  if (dirPromise === undefined) {
    dirPromise = getDir(root, game.path);
    dirCache.set(dirKey, dirPromise);
  }
  const dir = await dirPromise;
  if (dir === null) {
    return null;
  }
  try {
    const handle = await dir.getFileHandle(fileName);
    const file = await handle.getFile();
    const header = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
    return system.id === 'nds' ? parseNdsGameCode(header) : parseGbaGameCode(header);
  } catch {
    return null;
  }
}

/**
 * Decides whether a game is missing its cover. Returns a {@link MissingGame}
 * when no cover exists, or `null` when the game is already covered.
 */
async function classifyGame(
  root: FileSystemDirectoryHandle,
  game: LibraryFile,
  coverIndex: CoverIndex,
  dirCache: Map<string, Promise<FileSystemDirectoryHandle | null>>,
): Promise<MissingGame | null> {
  const { system, fileName } = game;
  if (coverIndex.user.has(`${fileName}.bmp`.toLowerCase())) {
    return null;
  }
  let code: string | null = null;
  if (system.coverKeying === 'gamecode') {
    code = await readGameCode(root, game, dirCache);
    // the `####` homebrew placeholder is not an identity: a cover keyed by it
    // would be shared by every homebrew, so those games go by file name
    if (code !== null && !isUsableGameCode(code)) code = null;
    if (code !== null && coverIndex[gamecodeCoverKey(system)].has(`${code}.bmp`.toLowerCase())) {
      return null;
    }
  }
  // the path is part of the id: same-named ROMs can live in different folders
  return { id: [system.id, ...game.path, fileName].join('/'), game, code };
}

/**
 * Covers tab: scans the library for games without cover art, then fetches
 * matching boxarts from libretro-thumbnails, composes them into launcher
 * covers (128x96 indexed BMP) and writes them to the SD card, previewing
 * every written file.
 */
export function CoversView() {
  const { root, games, coverIndex, refresh } = useSd();
  const t = useT();
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [missing, setMissing] = useState<MissingGame[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  /** Boxart catalogs already downloaded this session, keyed by repo. */
  const catalogsRef = useRef(new Map<string, string[]>());
  /** Object URLs created for previews, revoked on new batch / unmount. */
  const previewUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!root) return;
    const rootHandle = root;
    let cancelled = false;
    async function scan() {
      setScanError(null);
      setScanProgress({ done: 0, total: games.length });
      const dirCache = new Map<string, Promise<FileSystemDirectoryHandle | null>>();
      let done = 0;

      // Classifying a game means reading its ROM header off the card, and one
      // header at a time made the wait grow with the library: reading them
      // concurrently is what the card reader was idle for. Results land by
      // index so the list keeps the library's order whatever finishes first.
      const results: (MissingGame | null)[] = new Array<MissingGame | null>(games.length).fill(
        null,
      );
      let next = 0;
      await Promise.all(
        Array.from({ length: Math.min(SCAN_CONCURRENCY, games.length) }, async () => {
          for (let i = next++; i < games.length; i = next++) {
            if (cancelled) return;
            // A read failure on one game must not abort the whole scan or leave
            // its siblings running past the error, the way rejecting Promise.all
            // would: treat it as "nothing to add" and keep going, like the
            // gallery does when a cover fails to load.
            results[i] = await classifyGame(rootHandle, games[i], coverIndex, dirCache).catch(
              () => null,
            );
            // a superseded scan's straggler must not write progress over the
            // scan that replaced it
            if (cancelled) return;
            done++;
            setScanProgress({ done, total: games.length });
          }
        }),
      );
      if (cancelled) return;
      const found = results.filter((entry): entry is MissingGame => entry !== null);
      setMissing(found);
      setSelected(new Set(found.map((m) => m.id)));
      setScanProgress(null);
    }
    scan().catch((e: unknown) => {
      if (!cancelled) {
        setScanError(errorMessage(e));
        setScanProgress(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [root, games, coverIndex]);

  // Release preview object URLs when the view unmounts. The ref is read inside
  // the cleanup, not captured at mount: fetchSelected reassigns it to a fresh
  // array per batch, so a mount-time binding would revoke the wrong (empty) one
  // and leak every preview the last batch produced.
  useEffect(() => {
    return () => {
      for (const url of previewUrlsRef.current) URL.revokeObjectURL(url);
    };
  }, []);

  const groups = useMemo(() => {
    const bySystem = new Map<string, { system: System; items: MissingGame[] }>();
    for (const m of missing) {
      const group = bySystem.get(m.game.system.id);
      if (group) {
        group.items.push(m);
      } else {
        bySystem.set(m.game.system.id, { system: m.game.system, items: [m] });
      }
    }
    return [...bySystem.values()];
  }, [missing]);

  const jobStats = useMemo(() => {
    let written = 0;
    let noMatch = 0;
    let failed = 0;
    for (const job of jobs) {
      if (job.phase === 'written') written++;
      else if (job.phase === 'no-match') noMatch++;
      else if (job.phase === 'error') failed++;
    }
    return { written, noMatch, failed, done: written + noMatch + failed };
  }, [jobs]);

  if (!root) {
    return <p className="covers-view__empty">{t.covers.openCard}</p>;
  }
  const rootHandle = root;

  function updateJob(id: string, patch: Partial<Job>) {
    setJobs((prev) => prev.map((job) => (job.id === id ? { ...job, ...patch } : job)));
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  /**
   * Matches, downloads, composes and writes the cover of one game.
   *
   * @param dirs - Target directories, already created once for the whole
   *   batch: four workers creating `_pico/covers/<dir>` at the same time raced
   *   on a card that did not have those folders yet, and every write failed.
   * @param writeLock - Serializes the card writes; downloads stay parallel.
   *   Two ROMs can share a gamecode (romhacks of one game do), so two workers
   *   could otherwise open the same file at the same time.
   */
  async function runJob(
    m: MissingGame,
    dirs: ReadonlyMap<CoverSlot, FileSystemDirectoryHandle>,
    writeLock: { chain: Promise<unknown> },
  ): Promise<void> {
    const { game, code } = m;
    const { system, fileName } = game;
    try {
      const catalog = catalogsRef.current.get(system.libretroRepo);
      if (!catalog) {
        throw new Error(t.covers.catalogUnavailable);
      }
      const regionPrefs =
        system.id === 'gba' && code !== null
          ? (REGION_PREFS_BY_GBA_CODE[code.charAt(3)] ?? DEFAULT_REGION_PREFS)
          : DEFAULT_REGION_PREFS;
      const match = pickBoxart(titleOf(fileName), catalog, regionPrefs);
      if (match === null) {
        updateJob(m.id, { phase: 'no-match' });
        return;
      }
      updateJob(m.id, { phase: 'matched', match });
      const bitmap = await downloadPngAsBitmap(boxartUrl(system.libretroRepo, match));
      let rgba: Uint8ClampedArray;
      try {
        rgba = composeCoverRgba(bitmap);
      } finally {
        bitmap.close();
      }
      const bmp = encodeCoverBmp(rgba);
      const slot: CoverSlot =
        system.coverKeying === 'gamecode' && code !== null ? gamecodeCoverKey(system) : 'user';
      const name = slot === 'user' ? `${fileName}.bmp` : `${(code ?? '').toUpperCase()}.bmp`;
      const dir = dirs.get(slot);
      if (!dir) throw new Error(t.covers.coversDirFailed);
      const write = writeLock.chain.then(
        () => writeFileBytes(dir, name, bmp),
        () => writeFileBytes(dir, name, bmp),
      );
      writeLock.chain = write;
      await write;
      const previewUrl = await coverBmpPreviewUrl(bmp);
      previewUrlsRef.current.push(previewUrl);
      updateJob(m.id, { phase: 'written', match, previewUrl });
    } catch (e) {
      updateJob(m.id, { phase: 'error', message: errorMessage(e) });
    }
  }

  /** Runs a batch over the selected games with a small download worker pool. */
  async function fetchSelected() {
    if (fetching) return;
    const queue = missing.filter((m) => selected.has(m.id));
    if (queue.length === 0) return;

    for (const url of previewUrlsRef.current) URL.revokeObjectURL(url);
    previewUrlsRef.current = [];
    setFetching(true);
    setJobs(
      queue.map((m) => ({
        id: m.id,
        fileName: m.game.fileName,
        systemLabel: m.game.system.label,
        phase: 'pending' as const,
      })),
    );

    try {
      // One catalog per distinct repo, kept for this session and, through
      // readCachedCatalog, for the next visits too.
      const repos = [...new Set(queue.map((m) => m.game.system.libretroRepo))];
      const repoErrors = new Map<string, string>();
      await Promise.all(
        repos.map(async (repo) => {
          if (catalogsRef.current.has(repo)) return;
          const cached = await readCachedCatalog(repo);
          if (cached !== null && cached.fresh) {
            catalogsRef.current.set(repo, cached.names);
            return;
          }
          try {
            const names = await fetchCatalog(repo);
            catalogsRef.current.set(repo, names);
            void writeCachedCatalog(repo, names);
          } catch (e) {
            // An old listing still finds art for almost everything, so it beats
            // giving up when GitHub will not answer.
            if (cached !== null) {
              catalogsRef.current.set(repo, cached.names);
              return;
            }
            repoErrors.set(repo, errorMessage(e));
          }
        }),
      );
      const runnable: MissingGame[] = [];
      for (const m of queue) {
        const repoError = repoErrors.get(m.game.system.libretroRepo);
        if (repoError !== undefined) {
          updateJob(m.id, { phase: 'error', message: repoError });
        } else {
          runnable.push(m);
        }
      }

      // Create every target folder once, before any worker runs: four
      // concurrent creations of the same path fail on a card without them.
      const dirs = new Map<CoverSlot, FileSystemDirectoryHandle>();
      const slots = new Set(
        runnable.map((m) =>
          m.game.system.coverKeying === 'gamecode' && m.code !== null
            ? gamecodeCoverKey(m.game.system)
            : ('user' as CoverSlot),
        ),
      );
      let dirError: string | null = null;
      for (const slot of slots) {
        try {
          const dir = await getDir(rootHandle, COVERS[slot], true);
          if (dir === null) throw new Error(t.covers.coversDirFailed);
          dirs.set(slot, dir);
        } catch (e) {
          dirError = errorMessage(e);
          break;
        }
      }
      if (dirError !== null) {
        for (const m of runnable) updateJob(m.id, { phase: 'error', message: dirError });
        return;
      }

      /** Shared tail of the card writes; see runJob. */
      const writeLock = { chain: Promise.resolve() as Promise<unknown> };
      let next = 0;
      await Promise.all(
        Array.from({ length: Math.min(MAX_CONCURRENCY, runnable.length) }, async () => {
          for (let i = next++; i < runnable.length; i = next++) {
            await runJob(runnable[i], dirs, writeLock);
          }
        }),
      );

      await refresh();
    } finally {
      setFetching(false);
    }
  }

  function jobDetail(job: Job): string | null {
    if (job.phase === 'matched' || job.phase === 'written') return job.match ?? null;
    if (job.phase === 'no-match') return t.covers.noBoxartFound;
    if (job.phase === 'error') return job.message ?? t.covers.unknownError;
    return null;
  }

  const selectedCount = selected.size;

  return (
    <section className="covers-view" aria-label={t.covers.regionLabel}>
      <header className="covers-view__header">
        <h2>{t.covers.title}</h2>
        <p className="covers-view__hint">{t.covers.intro}</p>
      </header>

      {scanError && <p className="covers-view__error">{t.covers.scanFailed(scanError)}</p>}

      {scanProgress && (
        <div className="covers-view__progress" role="status">
          <span>{t.covers.scanning(scanProgress.done, scanProgress.total)}</span>
          {scanProgress.total > 0 && <ProgressBar value={scanProgress.done / scanProgress.total} />}
        </div>
      )}

      {jobs.length > 0 && (
        <section className="covers-view__batch card" aria-label={t.covers.fetchResults}>
          <h3>{t.covers.fetchResults}</h3>
          <p className="covers-view__counter" role="status">
            {fetching
              ? t.covers.fetchingCounter(jobStats.done, jobs.length)
              : t.covers.batchFinished(jobStats.written, jobStats.noMatch, jobStats.failed)}
          </p>
          <ul className="covers-view__jobs">
            {jobs.map((job) => (
              <li key={job.id} className={`covers-view__job covers-view__job--${job.phase}`}>
                {job.previewUrl ? (
                  <img
                    className="covers-view__preview"
                    src={job.previewUrl}
                    alt={t.covers.writtenCoverAlt(job.fileName)}
                    width={128}
                    height={96}
                  />
                ) : (
                  <span
                    className="covers-view__preview covers-view__preview--empty"
                    aria-hidden="true"
                  />
                )}
                <span className="covers-view__job-text">
                  <span className="covers-view__job-name">{job.fileName}</span>
                  <span className="covers-view__job-detail">
                    {job.systemLabel}
                    {jobDetail(job) !== null && ` — ${jobDetail(job)}`}
                  </span>
                </span>
                <span className="covers-view__job-status">{t.covers.jobStatus[job.phase]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!scanProgress && !scanError && missing.length === 0 && (
        <p className="covers-view__all-covered" role="status">
          {games.length === 0 ? t.covers.noGames : t.covers.allCovered(games.length)}
        </p>
      )}

      {!scanProgress && missing.length > 0 && (
        <section aria-label={t.covers.missingRegionLabel}>
          <div className="covers-view__toolbar card">
            <h3 className="covers-view__toolbar-title">
              {t.covers.missingTitle} <span className="covers-view__dim">({missing.length})</span>
            </h3>
            <button
              onClick={() => setSelected(new Set(missing.map((m) => m.id)))}
              disabled={fetching}
            >
              {t.covers.selectAll}
            </button>
            <button onClick={() => setSelected(new Set())} disabled={fetching}>
              {t.covers.selectNone}
            </button>
            <button
              className="primary"
              onClick={() => void fetchSelected()}
              disabled={fetching || selectedCount === 0}
            >
              {fetching ? t.covers.fetching : t.covers.fetchCount(selectedCount)}
            </button>
          </div>
          {groups.map((group) => (
            <div key={group.system.id} className="covers-view__group">
              <h4 className="covers-view__group-title section-title">
                {group.system.label}{' '}
                <span className="covers-view__dim">({group.items.length})</span>
              </h4>
              <ul className="covers-view__list">
                {group.items.map((m) => (
                  <li key={m.id}>
                    <label className="covers-view__row">
                      <input
                        type="checkbox"
                        checked={selected.has(m.id)}
                        onChange={() => toggleSelected(m.id)}
                        disabled={fetching}
                      />
                      <span className="covers-view__row-name">{m.game.fileName}</span>
                      {m.code !== null && <code className="covers-view__code">{m.code}</code>}
                      {m.game.system.coverKeying === 'gamecode' && m.code === null && (
                        <span className="covers-view__row-note">{t.covers.noGamecode}</span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </section>
  );
}
