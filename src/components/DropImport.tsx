/**
 * ROM drag & drop importer.
 *
 * Mounted inside the workspace while an SD card is open: dragging files over
 * the window shows a full-window overlay, and dropping them copies every
 * recognized ROM into `Games/<system dir>/` — sequentially, never overwriting
 * an existing file — then best-effort fetches a launcher cover for each new
 * game (same pipeline as the Covers tab). A fixed bottom-right panel reports
 * the live status of each dropped file.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { encodeCoverBmp } from '../lib/bmp';
import { composeCoverRgba, downloadPngAsBitmap } from '../lib/coverart';
import { planImport } from '../lib/importer';
import { DEFAULT_REGION_PREFS, REGION_PREFS_BY_GBA_CODE, pickBoxart } from '../lib/matching';
import { parseGbaGameCode, parseNdsGameCode } from '../lib/rom';
import { COVERS, GAMES_DIR, fileExists, getDir, writeFileBytes } from '../lib/sdcard';
import type { System } from '../lib/systems';
import { boxartUrl, fetchCatalog } from '../lib/thumbnails';
import { useSd, type CoverIndex } from '../state/SdContext';
import './DropImport.css';

/** Live status of one dropped file in the results panel. */
type RowPhase =
  | 'queued'
  | 'copying'
  | 'added'
  | 'added-cover'
  | 'added-no-cover'
  | 'duplicate'
  | 'skipped'
  | 'unknown'
  | 'failed';

/** One row of the results panel. */
interface ImportRow {
  fileName: string;
  phase: RowPhase;
  /** Failure detail (failed phase). */
  message?: string;
}

const ROW_LABELS: Record<RowPhase, string> = {
  queued: 'Queued',
  copying: 'Copying…',
  added: 'Added',
  'added-cover': 'Added, cover fetched',
  'added-no-cover': 'Added, no cover match',
  duplicate: 'Duplicate (skipped)',
  skipped: 'Skipped (already on card)',
  unknown: 'Unknown type',
  failed: 'Failed',
};

/** Visual tone (status color) per phase. */
const ROW_TONES: Record<RowPhase, 'busy' | 'ok' | 'skip' | 'error'> = {
  queued: 'busy',
  copying: 'busy',
  added: 'ok',
  'added-cover': 'ok',
  'added-no-cover': 'ok',
  duplicate: 'skip',
  skipped: 'skip',
  unknown: 'skip',
  failed: 'error',
};

/** Phases that mean the ROM landed on the card. */
const ADDED_PHASES: readonly RowPhase[] = ['added', 'added-cover', 'added-no-cover'];

/** Outcome of the best-effort cover fetch for one added game. */
type CoverOutcome = 'fetched' | 'no-match' | 'none';

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

/** `true` when the drag carries files (as opposed to text/links). */
function isFileDrag(e: DragEvent): boolean {
  return e.dataTransfer?.types.includes('Files') ?? false;
}

/**
 * Best-effort cover fetch for a freshly imported ROM, mirroring the Covers
 * tab pipeline: parse the gamecode from the already-read bytes (NDS/GBA),
 * skip when a cover already exists, match the title against the system's
 * libretro-thumbnails catalog, then compose and write the launcher BMP.
 *
 * Never throws: any failure returns `'none'` and leaves the game installed
 * without a cover.
 */
async function fetchCoverBestEffort(
  root: FileSystemDirectoryHandle,
  coverIndex: CoverIndex,
  system: System,
  fileName: string,
  bytes: Uint8Array,
  getCatalog: (repo: string) => Promise<string[] | null>,
): Promise<CoverOutcome> {
  try {
    if (coverIndex.user.has(`${fileName}.bmp`.toLowerCase())) {
      return 'none';
    }
    let code: string | null = null;
    if (system.coverKeying === 'gamecode') {
      code = system.id === 'nds' ? parseNdsGameCode(bytes) : parseGbaGameCode(bytes);
      if (code !== null && coverIndex[gamecodeCoverKey(system)].has(`${code}.bmp`.toLowerCase())) {
        return 'none';
      }
    }
    const catalog = await getCatalog(system.libretroRepo);
    if (catalog === null) {
      return 'none';
    }
    const regionPrefs =
      system.id === 'gba' && code !== null
        ? (REGION_PREFS_BY_GBA_CODE[code.charAt(3)] ?? DEFAULT_REGION_PREFS)
        : DEFAULT_REGION_PREFS;
    const match = pickBoxart(titleOf(fileName), catalog, regionPrefs);
    if (match === null) {
      return 'no-match';
    }
    const bitmap = await downloadPngAsBitmap(boxartUrl(system.libretroRepo, match));
    let rgba: Uint8ClampedArray;
    try {
      rgba = composeCoverRgba(bitmap);
    } finally {
      bitmap.close();
    }
    const bmp = encodeCoverBmp(rgba);
    // re-check the CARD, not just the in-memory index: a cover written
    // earlier in this batch (shared gamecode) or added externally must
    // never be overwritten
    if (system.coverKeying === 'gamecode' && code !== null) {
      const dir = await getDir(root, COVERS[gamecodeCoverKey(system)], true);
      if (dir === null) return 'none';
      const name = `${code.toUpperCase()}.bmp`;
      if (await fileExists(dir, name)) return 'none';
      await writeFileBytes(dir, name, bmp);
    } else {
      const dir = await getDir(root, COVERS.user, true);
      if (dir === null) return 'none';
      const name = `${fileName}.bmp`;
      if (await fileExists(dir, name)) return 'none';
      await writeFileBytes(dir, name, bmp);
    }
    return 'fetched';
  } catch {
    // best effort: the game stays installed without a cover
    return 'none';
  }
}

/**
 * Full-window drag & drop target that imports dropped ROM files onto the
 * open SD card, plus the results panel reporting each file's outcome.
 */
export function DropImport() {
  const { root, games, coverIndex, refresh } = useSd();
  const [dragActive, setDragActive] = useState(false);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  /** dragenter/dragleave pair counter, so nested drag events don't flicker. */
  const dragDepth = useRef(0);
  /** Mirrors `running` for the window event handlers. */
  const runningRef = useRef(false);
  /** Boxart catalogs already downloaded, keyed by repo (kept across batches). */
  const catalogsRef = useRef(new Map<string, string[]>());

  const updateRow = useCallback((index: number, patch: Partial<ImportRow>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }, []);

  /** Plans the drop, then copies the accepted ROMs to the card sequentially. */
  const runImport = useCallback(
    async (files: File[]) => {
      if (root === null || runningRef.current) return;
      runningRef.current = true;
      setRunning(true);

      const plan = planImport(
        files.map((file) => file.name),
        games,
      );
      setRows(
        plan.map((item) => ({
          fileName: item.fileName,
          phase:
            item.verdict === 'add'
              ? 'queued'
              : item.verdict === 'duplicate'
                ? 'duplicate'
                : 'unknown',
        })),
      );

      // One catalog download per repo per batch; failures are not retried.
      const failedRepos = new Set<string>();
      const getCatalog = async (repo: string): Promise<string[] | null> => {
        const cached = catalogsRef.current.get(repo);
        if (cached !== undefined) return cached;
        if (failedRepos.has(repo)) return null;
        try {
          const catalog = await fetchCatalog(repo);
          catalogsRef.current.set(repo, catalog);
          return catalog;
        } catch {
          failedRepos.add(repo);
          return null;
        }
      };

      let wroteAnything = false;
      try {
        // Sequential on purpose: SD card writes, keep it simple and safe.
        for (let i = 0; i < plan.length; i++) {
          const item = plan[i];
          const system = item.system;
          if (item.verdict !== 'add' || system === null) continue;
          updateRow(i, { phase: 'copying' });
          try {
            const bytes = new Uint8Array(await files[i].arrayBuffer());
            const dir = await getDir(root, [GAMES_DIR, system.gamesDir], true);
            if (dir === null) throw new Error('Could not open the games directory');
            // Re-check on the card right before writing: never overwrite a
            // ROM, even if it appeared after the library was last scanned.
            if (await fileExists(dir, item.fileName)) {
              updateRow(i, { phase: 'skipped' });
              continue;
            }
            await writeFileBytes(dir, item.fileName, bytes);
            wroteAnything = true;
            const outcome = await fetchCoverBestEffort(
              root,
              coverIndex,
              system,
              item.fileName,
              bytes,
              getCatalog,
            );
            updateRow(i, {
              phase:
                outcome === 'fetched'
                  ? 'added-cover'
                  : outcome === 'no-match'
                    ? 'added-no-cover'
                    : 'added',
            });
          } catch (e) {
            updateRow(i, { phase: 'failed', message: errorMessage(e) });
          }
        }
        if (wroteAnything) {
          await refresh();
        }
      } finally {
        runningRef.current = false;
        setRunning(false);
      }
    },
    [root, games, coverIndex, refresh, updateRow],
  );

  useEffect(() => {
    if (root === null) return;

    const onDragEnter = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragDepth.current += 1;
      setDragActive(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      // preventDefault marks the window as a valid drop target.
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = runningRef.current ? 'none' : 'copy';
      }
    };
    const onDragLeave = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragActive(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragActive(false);
      // A batch is already writing to the card: ignore further drops.
      if (runningRef.current) return;
      const items = e.dataTransfer?.items;
      const files: File[] = [];
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.kind !== 'file') continue;
          const file = item.getAsFile();
          if (file !== null) files.push(file);
        }
      }
      if (files.length > 0) void runImport(files);
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
      dragDepth.current = 0;
    };
  }, [root, runImport]);

  if (root === null) return null;

  const addedCount = rows.filter((row) => ADDED_PHASES.includes(row.phase)).length;

  return (
    <>
      {dragActive && (
        <div className="drop-import__overlay" aria-hidden="true">
          <p className="drop-import__overlay-box">
            {/* the app's cartridge mark (App.tsx), body tinted for this surface */}
            <svg className="drop-import__overlay-mark" viewBox="0 0 32 32" aria-hidden="true">
              <rect x="2" y="2" width="28" height="28" rx="6" fill="var(--bg-hover)" />
              <rect x="7" y="8" width="18" height="12" rx="2" fill="var(--accent)" />
              <rect x="10" y="11" width="12" height="6" rx="1" fill="var(--bg)" />
              <circle cx="11" cy="24" r="2" fill="var(--accent)" />
              <circle cx="21" cy="24" r="2" fill="var(--text-dim)" />
            </svg>
            {running ? 'Import in progress…' : 'Drop ROMs to add them to your card'}
          </p>
        </div>
      )}
      {rows.length > 0 && (
        <section className="drop-import__panel" role="status" aria-label="ROM import results">
          <header className="drop-import__panel-header">
            <span className="drop-import__title">
              {running ? 'Importing ROMs…' : 'Import finished'}
            </span>
            <span className="drop-import__summary">{addedCount} added</span>
            <button
              className="drop-import__close"
              onClick={() => setRows([])}
              disabled={running}
              aria-label="Dismiss import results"
              title={running ? 'Import in progress' : 'Dismiss'}
            >
              ×
            </button>
          </header>
          <ul className="drop-import__list" aria-live="polite">
            {rows.map((row, i) => (
              <li
                key={`${String(i)}:${row.fileName}`}
                className={`drop-import__row drop-import__row--${ROW_TONES[row.phase]}`}
              >
                <span className="drop-import__name" title={row.fileName}>
                  {row.fileName}
                </span>
                <span className="drop-import__status">
                  {row.phase === 'failed' && row.message !== undefined
                    ? `Failed (${row.message})`
                    : ROW_LABELS[row.phase]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
