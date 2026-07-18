import { ProgressBar } from '../components/ProgressBar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { encodeCoverBmp } from '../lib/bmp';
import { composeCoverRgba, coverBmpPreviewUrl, downloadPngAsBitmap } from '../lib/coverart';
import { DEFAULT_REGION_PREFS, REGION_PREFS_BY_GBA_CODE, pickBoxart } from '../lib/matching';
import { parseGbaGameCode, parseNdsGameCode } from '../lib/rom';
import { COVERS, GAMES_DIR, getDir, writeFileBytes, type LibraryFile } from '../lib/sdcard';
import type { System } from '../lib/systems';
import { boxartUrl, fetchCatalog } from '../lib/thumbnails';
import { useSd, type CoverIndex } from '../state/SdContext';
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

const JOB_STATUS_LABELS: Record<JobPhase, string> = {
  pending: 'Queued',
  matched: 'Downloading…',
  written: 'Written',
  'no-match': 'No match',
  error: 'Failed',
};

/** Maximum simultaneous boxart downloads. */
const MAX_CONCURRENCY = 4;

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
  dirCache: Map<string, FileSystemDirectoryHandle | null>,
): Promise<string | null> {
  const { system, fileName } = game;
  let dir = dirCache.get(system.gamesDir);
  if (dir === undefined) {
    dir = await getDir(root, [GAMES_DIR, system.gamesDir]);
    dirCache.set(system.gamesDir, dir);
  }
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
  dirCache: Map<string, FileSystemDirectoryHandle | null>,
): Promise<MissingGame | null> {
  const { system, fileName } = game;
  if (coverIndex.user.has(`${fileName}.bmp`.toLowerCase())) {
    return null;
  }
  let code: string | null = null;
  if (system.coverKeying === 'gamecode') {
    code = await readGameCode(root, game, dirCache);
    if (code !== null && coverIndex[gamecodeCoverKey(system)].has(`${code}.bmp`.toLowerCase())) {
      return null;
    }
  }
  return { id: `${system.id}/${fileName}`, game, code };
}

/**
 * Covers tab: scans the library for games without cover art, then fetches
 * matching boxarts from libretro-thumbnails, composes them into launcher
 * covers (128x96 indexed BMP) and writes them to the SD card, previewing
 * every written file.
 */
export function CoversView() {
  const { root, games, coverIndex, refresh } = useSd();
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
      const found: MissingGame[] = [];
      const dirCache = new Map<string, FileSystemDirectoryHandle | null>();
      let done = 0;
      for (const game of games) {
        if (cancelled) return;
        const entry = await classifyGame(rootHandle, game, coverIndex, dirCache);
        if (entry !== null) found.push(entry);
        done++;
        setScanProgress({ done, total: games.length });
      }
      if (cancelled) return;
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

  // Release preview object URLs when the view unmounts.
  useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
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
    return <p className="covers-view__empty">Open an SD card to manage covers.</p>;
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

  /** Matches, downloads, composes and writes the cover of one game. */
  async function runJob(m: MissingGame): Promise<void> {
    const { game, code } = m;
    const { system, fileName } = game;
    try {
      const catalog = catalogsRef.current.get(system.libretroRepo);
      if (!catalog) {
        throw new Error('Boxart catalog unavailable');
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
      if (system.coverKeying === 'gamecode' && code !== null) {
        const dir = await getDir(rootHandle, COVERS[gamecodeCoverKey(system)], true);
        if (!dir) throw new Error('Could not open the covers directory');
        await writeFileBytes(dir, `${code.toUpperCase()}.bmp`, bmp);
      } else {
        const dir = await getDir(rootHandle, COVERS.user, true);
        if (!dir) throw new Error('Could not open the covers directory');
        await writeFileBytes(dir, `${fileName}.bmp`, bmp);
      }
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
      // One catalog fetch per distinct repo (cached across batches).
      const repos = [...new Set(queue.map((m) => m.game.system.libretroRepo))];
      const repoErrors = new Map<string, string>();
      await Promise.all(
        repos.map(async (repo) => {
          if (catalogsRef.current.has(repo)) return;
          try {
            catalogsRef.current.set(repo, await fetchCatalog(repo));
          } catch (e) {
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

      let next = 0;
      await Promise.all(
        Array.from({ length: Math.min(MAX_CONCURRENCY, runnable.length) }, async () => {
          for (let i = next++; i < runnable.length; i = next++) {
            await runJob(runnable[i]);
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
    if (job.phase === 'no-match') return 'No box art found in the catalog';
    if (job.phase === 'error') return job.message ?? 'Unknown error';
    return null;
  }

  const selectedCount = selected.size;

  return (
    <section className="covers-view" aria-label="Cover art">
      <header className="covers-view__header">
        <h2>Covers</h2>
        <p className="covers-view__hint">
          Finds games without cover art, fetches matching box art from libretro-thumbnails and
          writes launcher-ready BMP covers to your SD card.
        </p>
      </header>

      {scanError && <p className="covers-view__error">Scan failed: {scanError}</p>}

      {scanProgress && (
        <div className="covers-view__progress" role="status">
          <span>
            Scanning {scanProgress.done}/{scanProgress.total}…
          </span>
          {scanProgress.total > 0 && <ProgressBar value={scanProgress.done / scanProgress.total} />}
        </div>
      )}

      {jobs.length > 0 && (
        <section className="covers-view__batch" aria-label="Fetch results">
          <h3>Fetch results</h3>
          <p className="covers-view__counter" role="status">
            {fetching
              ? `Fetching covers — ${jobStats.done}/${jobs.length} done`
              : `Batch finished: ${jobStats.written} written · ${jobStats.noMatch} without match · ${jobStats.failed} failed`}
          </p>
          <ul className="covers-view__jobs">
            {jobs.map((job) => (
              <li key={job.id} className={`covers-view__job covers-view__job--${job.phase}`}>
                {job.previewUrl ? (
                  <img
                    className="covers-view__preview"
                    src={job.previewUrl}
                    alt={`Written cover for ${job.fileName}`}
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
                <span className="covers-view__job-status">{JOB_STATUS_LABELS[job.phase]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!scanProgress && !scanError && missing.length === 0 && (
        <p className="covers-view__all-covered" role="status">
          {games.length === 0
            ? 'No games found on this SD card.'
            : `All ${games.length} games already have covers.`}
        </p>
      )}

      {!scanProgress && missing.length > 0 && (
        <section aria-label="Games missing covers">
          <div className="covers-view__toolbar">
            <h3 className="covers-view__toolbar-title">
              Missing covers <span className="covers-view__dim">({missing.length})</span>
            </h3>
            <button
              onClick={() => setSelected(new Set(missing.map((m) => m.id)))}
              disabled={fetching}
            >
              Select all
            </button>
            <button onClick={() => setSelected(new Set())} disabled={fetching}>
              Select none
            </button>
            <button
              className="primary"
              onClick={() => void fetchSelected()}
              disabled={fetching || selectedCount === 0}
            >
              {fetching
                ? 'Fetching…'
                : `Fetch ${selectedCount} cover${selectedCount === 1 ? '' : 's'}`}
            </button>
          </div>
          {groups.map((group) => (
            <div key={group.system.id} className="covers-view__group">
              <h4 className="covers-view__group-title">
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
                        <span className="covers-view__row-note">
                          no gamecode — saved as user cover
                        </span>
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
