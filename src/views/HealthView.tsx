import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSd } from '../state/SdContext';
import {
  JUNK_DIR_NAMES,
  findOrphanSaves,
  findOrphanUserCovers,
  isJunkFileName,
  isPreventionOnlyFsevents,
  missingLoaderFiles,
  type SaveFile,
} from '../lib/health';
import { COVERS, GAMES_DIR, PICO_DIR, getDir, listEntries } from '../lib/sdcard';
import './HealthView.css';

/** URL of the Pico Loader releases page (source of the required .bin files). */
const LOADER_RELEASES_URL = 'https://github.com/LNH-team/pico-loader/releases';

/** How deep the scanner walks below the SD root. */
const MAX_SCAN_DEPTH = 8;

/** One junk file found by the scan, with enough context to delete it. */
interface JunkFile {
  /** Directory path segments from the SD root (empty = at the root). */
  path: readonly string[];
  name: string;
  size: number;
}

/** One macOS junk directory found at the SD root. */
interface JunkDir {
  name: string;
  /** `.fseventsd` holding only the intentional `no_log` marker: never deleted. */
  preventionOnly: boolean;
}

/** Raw data collected by one walk of the card (orphans are derived later). */
interface ScanResult {
  junkFiles: JunkFile[];
  junkDirs: JunkDir[];
  /** File names found directly inside `/_pico` (for the loader check). */
  picoEntries: string[];
  /** `.sav` files found in `Games/<dir>/`. */
  saves: SaveFile[];
  /** File names found in `_pico/covers/user/`. */
  userCoverNames: string[];
  /** Total number of files visited. */
  filesSeen: number;
}

/** Case-insensitive path comparison: FAT preserves case but ignores it. */
function pathEquals(path: readonly string[], expected: readonly string[]): boolean {
  return (
    path.length === expected.length &&
    expected.every((segment, i) => path[i].toLowerCase() === segment.toLowerCase())
  );
}

/**
 * Walks the whole card (depth-capped) collecting health data. Junk
 * directories are inspected but never descended into; everything else —
 * including ROM folders, where Finder drops `._*` files too — is visited.
 */
async function scanCard(
  root: FileSystemDirectoryHandle,
  onProgress: (filesSeen: number) => void,
): Promise<ScanResult> {
  const result: ScanResult = {
    junkFiles: [],
    junkDirs: [],
    picoEntries: [],
    saves: [],
    userCoverNames: [],
    filesSeen: 0,
  };

  async function walk(dir: FileSystemDirectoryHandle, path: readonly string[]): Promise<void> {
    const inPico = pathEquals(path, [PICO_DIR]);
    const inUserCovers = pathEquals(path, COVERS.user);
    const gamesDir =
      path.length === 2 && path[0].toLowerCase() === GAMES_DIR.toLowerCase() ? path[1] : null;
    for await (const handle of dir.values()) {
      if (handle.kind === 'file') {
        result.filesSeen += 1;
        if (result.filesSeen % 50 === 0) {
          onProgress(result.filesSeen);
        }
        if (isJunkFileName(handle.name)) {
          const file = await handle.getFile();
          result.junkFiles.push({ path, name: handle.name, size: file.size });
          continue; // junk is junk everywhere; never double-report it below
        }
        if (inPico) {
          result.picoEntries.push(handle.name);
        } else if (inUserCovers) {
          result.userCoverNames.push(handle.name);
        } else if (gamesDir !== null && handle.name.toLowerCase().endsWith('.sav')) {
          result.saves.push({ gamesDir, name: handle.name });
        }
        continue;
      }
      if (JUNK_DIR_NAMES.includes(handle.name)) {
        // never descend into junk dirs; only the root-level ones are
        // reported (that is where macOS creates them)
        if (path.length === 0) {
          const entryNames = (await listEntries(handle)).map((entry) => entry.name);
          result.junkDirs.push({
            name: handle.name,
            preventionOnly: handle.name === '.fseventsd' && isPreventionOnlyFsevents(entryNames),
          });
        }
        continue;
      }
      if (path.length < MAX_SCAN_DEPTH) {
        await walk(handle, [...path, handle.name]);
      }
    }
  }

  await walk(root, []);
  onProgress(result.filesSeen);
  return result;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Toggles `key` in a set, immutably (for checkbox selection state). */
function toggledSet(set: ReadonlySet<string>, key: string): Set<string> {
  const next = new Set(set);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  return next;
}

/**
 * Two-step inline confirmation for a destructive action: the trigger button
 * turns into a `Confirm delete …? Yes / No` prompt, so a stray click never
 * deletes anything.
 */
function ConfirmDelete({
  label,
  confirmLabel,
  busy,
  disabled,
  confirming,
  onConfirmChange,
  onDelete,
}: {
  label: string;
  confirmLabel: string;
  busy: boolean;
  disabled: boolean;
  confirming: boolean;
  onConfirmChange: (confirming: boolean) => void;
  onDelete: () => void;
}) {
  if (!confirming) {
    return (
      <button
        type="button"
        className="health-view__danger"
        disabled={disabled || busy}
        onClick={() => onConfirmChange(true)}
      >
        {label}
      </button>
    );
  }
  return (
    <span className="health-view__confirm" role="alert">
      <span className="health-view__confirm-text">{confirmLabel}</span>
      <button type="button" className="health-view__danger" disabled={busy} onClick={onDelete}>
        {busy ? 'Deleting…' : 'Yes, delete'}
      </button>
      <button type="button" disabled={busy} onClick={() => onConfirmChange(false)}>
        No
      </button>
    </span>
  );
}

/**
 * SD card health check: finds macOS junk, missing Pico Loader files,
 * orphaned saves and orphaned user covers, with surgical cleanup actions.
 * Junk is deleted by exact rules only ({@link isJunkFileName},
 * {@link JUNK_DIR_NAMES}); anything possibly valuable (saves) requires
 * explicit per-item opt-in.
 */
export function HealthView() {
  const { root, games, refresh, loading } = useSd();
  const [scanning, setScanning] = useState(false);
  const [filesSeen, setFilesSeen] = useState(0);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const [junkConfirm, setJunkConfirm] = useState(false);
  const [junkBusy, setJunkBusy] = useState(false);
  const [junkError, setJunkError] = useState<string | null>(null);

  /** Selected orphan saves (`<gamesDir>/<name>` keys) — empty by default. */
  const [savesSelected, setSavesSelected] = useState<ReadonlySet<string>>(new Set());
  const [savesConfirm, setSavesConfirm] = useState(false);
  const [savesBusy, setSavesBusy] = useState(false);
  const [savesError, setSavesError] = useState<string | null>(null);

  /** UNselected orphan covers — covers default to checked (regenerable). */
  const [coversDeselected, setCoversDeselected] = useState<ReadonlySet<string>>(new Set());
  const [coversConfirm, setCoversConfirm] = useState(false);
  const [coversBusy, setCoversBusy] = useState(false);
  const [coversError, setCoversError] = useState<string | null>(null);

  const runScan = useCallback(async () => {
    if (root === null) return;
    setScanning(true);
    setScanError(null);
    setFilesSeen(0);
    try {
      // orphan classification joins the walk against the context library:
      // re-read it first so files copied outside PicoDex are known
      await refresh();
      const result = await scanCard(root, setFilesSeen);
      setScan(result);
      // fresh scan, fresh choices: selections and pending confirms reset
      setSavesSelected(new Set());
      setCoversDeselected(new Set());
      setJunkConfirm(false);
      setSavesConfirm(false);
      setCoversConfirm(false);
    } catch (e) {
      setScanError(errorMessage(e));
    } finally {
      setScanning(false);
    }
  }, [root, refresh]);

  // auto-scan once on first mount with an open card
  const autoScanned = useRef(false);
  useEffect(() => {
    // wait for the initial library load: scanning against an empty games
    // list would classify every save and user cover as orphaned
    if (root !== null && !loading && !autoScanned.current) {
      autoScanned.current = true;
      void runScan();
    }
  }, [root, loading, runScan]);

  const loader = useMemo(
    () => (scan === null ? null : missingLoaderFiles(scan.picoEntries)),
    [scan],
  );
  const orphanSaves = useMemo(
    () => (scan === null ? [] : findOrphanSaves(games, scan.saves)),
    [scan, games],
  );
  const orphanCovers = useMemo(
    () => (scan === null ? [] : findOrphanUserCovers(scan.userCoverNames, games)),
    [scan, games],
  );

  const deletableJunkDirs = useMemo(
    () => (scan === null ? [] : scan.junkDirs.filter((dir) => !dir.preventionOnly)),
    [scan],
  );
  const keptFsevents = scan?.junkDirs.some((dir) => dir.preventionOnly) ?? false;
  const junkCount = (scan?.junkFiles.length ?? 0) + deletableJunkDirs.length;
  const junkSize = scan?.junkFiles.reduce((sum, file) => sum + file.size, 0) ?? 0;

  const selectedSaves = orphanSaves.filter((save) =>
    savesSelected.has(`${save.gamesDir}/${save.name}`),
  );
  const selectedCovers = orphanCovers.filter((name) => !coversDeselected.has(name));

  const anyBusy = scanning || junkBusy || savesBusy || coversBusy;

  const handleJunkDelete = async () => {
    if (root === null || scan === null || anyBusy) return;
    setJunkBusy(true);
    setJunkError(null);
    try {
      for (const file of scan.junkFiles) {
        const dir = await getDir(root, file.path);
        if (dir === null) continue; // parent vanished since the scan
        await dir.removeEntry(file.name);
      }
      for (const junkDir of deletableJunkDirs) {
        await root.removeEntry(junkDir.name, { recursive: true });
      }
    } catch (e) {
      setJunkError(errorMessage(e));
    }
    setJunkConfirm(false);
    await refresh();
    await runScan();
    setJunkBusy(false);
  };

  const handleSavesDelete = async () => {
    if (root === null || anyBusy || selectedSaves.length === 0) return;
    setSavesBusy(true);
    setSavesError(null);
    try {
      for (const save of selectedSaves) {
        const dir = await getDir(root, [GAMES_DIR, save.gamesDir]);
        if (dir === null) continue;
        await dir.removeEntry(save.name);
      }
    } catch (e) {
      setSavesError(errorMessage(e));
    }
    setSavesConfirm(false);
    await refresh();
    await runScan();
    setSavesBusy(false);
  };

  const handleCoversDelete = async () => {
    if (root === null || anyBusy || selectedCovers.length === 0) return;
    setCoversBusy(true);
    setCoversError(null);
    try {
      const dir = await getDir(root, COVERS.user);
      if (dir !== null) {
        for (const name of selectedCovers) {
          await dir.removeEntry(name);
        }
      }
    } catch (e) {
      setCoversError(errorMessage(e));
    }
    setCoversConfirm(false);
    await refresh();
    await runScan();
    setCoversBusy(false);
  };

  if (root === null) {
    return (
      <section className="health-view">
        <h2>Card health</h2>
        <p className="health-view__dim">Open an SD card to run a health check.</p>
      </section>
    );
  }

  return (
    <section className="health-view">
      <header className="health-view__header">
        <div>
          <h2>Card health</h2>
          <p className="health-view__dim">
            Checks the card for macOS junk, missing loader files, orphaned saves and orphaned
            covers. Nothing is deleted without confirmation.
          </p>
        </div>
        <button type="button" className="primary" onClick={() => void runScan()} disabled={anyBusy}>
          {scanning ? 'Scanning…' : 'Scan card'}
        </button>
      </header>

      {scanning && (
        <p className="health-view__dim" role="status">
          Scanning… {filesSeen} files
        </p>
      )}
      {scanError !== null && (
        <p className="health-view__error" role="alert">
          {scanError}
        </p>
      )}

      {scan !== null && !scanning && (
        <>
          <p className="health-view__dim">Scanned {scan.filesSeen} files.</p>

          <section className="health-view__section">
            <h3>macOS junk</h3>
            {junkCount === 0 ? (
              <p className="health-view__ok">No macOS junk found.</p>
            ) : (
              <>
                <p>
                  <span className="health-view__warn">
                    {scan.junkFiles.length} junk {scan.junkFiles.length === 1 ? 'file' : 'files'} (
                    {formatSize(junkSize)})
                  </span>{' '}
                  — <code>._*</code> AppleDouble files and <code>.DS_Store</code>
                  {deletableJunkDirs.length > 0 && (
                    <>
                      , plus {deletableJunkDirs.length} junk{' '}
                      {deletableJunkDirs.length === 1 ? 'folder' : 'folders'} at the root (
                      {deletableJunkDirs.map((dir, index) => (
                        <span key={dir.name}>
                          {index > 0 && ', '}
                          <code>{dir.name}</code>
                        </span>
                      ))}
                      )
                    </>
                  )}
                  .
                </p>
                {scan.junkFiles.length > 0 && (
                  <details className="health-view__details">
                    <summary>Show junk files</summary>
                    <ul className="health-view__list">
                      {scan.junkFiles.map((file) => (
                        <li key={[...file.path, file.name].join('/')}>
                          <code>{[...file.path, file.name].join('/')}</code>{' '}
                          <span className="health-view__dim">({formatSize(file.size)})</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <div>
                  <ConfirmDelete
                    label={`Clean up ${junkCount} ${junkCount === 1 ? 'file' : 'files'}`}
                    confirmLabel={`Confirm delete ${junkCount} ${junkCount === 1 ? 'file' : 'files'}?`}
                    busy={junkBusy}
                    disabled={anyBusy}
                    confirming={junkConfirm}
                    onConfirmChange={setJunkConfirm}
                    onDelete={() => void handleJunkDelete()}
                  />
                </div>
              </>
            )}
            {keptFsevents && (
              <p className="health-view__dim">
                <code>.fseventsd</code> holds only a <code>no_log</code> marker — that is an
                intentional logging-prevention setup, so it is left alone.
              </p>
            )}
            {junkError !== null && (
              <p className="health-view__error" role="alert">
                {junkError}
              </p>
            )}
          </section>

          <section className="health-view__section">
            <h3>Loader files</h3>
            {loader !== null && loader.required.length === 0 ? (
              <p className="health-view__ok">All required loader files are present.</p>
            ) : (
              loader !== null && (
                <>
                  <ul className="health-view__list">
                    {loader.required.map((name) => (
                      <li key={name} className="health-view__warn">
                        <code>/_pico/{name}</code> is missing — the loader needs it to boot games.
                      </li>
                    ))}
                  </ul>
                  <p>
                    Download from{' '}
                    <a href={LOADER_RELEASES_URL} target="_blank" rel="noreferrer">
                      pico-loader releases
                    </a>{' '}
                    and copy the files into <code>/_pico</code>.
                  </p>
                </>
              )
            )}
            {loader !== null && loader.optional.length > 0 && (
              <p className="health-view__dim">
                Optional files not on the card:{' '}
                {loader.optional.map((name, index) => (
                  <span key={name}>
                    {index > 0 && ', '}
                    <code>{name}</code>
                  </span>
                ))}{' '}
                — fine to leave out.
              </p>
            )}
          </section>

          <section className="health-view__section">
            <h3>Orphaned saves</h3>
            {orphanSaves.length === 0 ? (
              <p className="health-view__ok">Every save file belongs to a game on the card.</p>
            ) : (
              <>
                <p className="health-view__warn">
                  {orphanSaves.length} save {orphanSaves.length === 1 ? 'file' : 'files'} match no
                  ROM on the card. Saves may hold game progress and deleting them is permanent —
                  select only the ones you are sure about.
                </p>
                <ul className="health-view__list">
                  {orphanSaves.map((save) => {
                    const key = `${save.gamesDir}/${save.name}`;
                    return (
                      <li key={key}>
                        <label className="health-view__check">
                          <input
                            type="checkbox"
                            checked={savesSelected.has(key)}
                            disabled={anyBusy}
                            onChange={() =>
                              setSavesSelected((previous) => toggledSet(previous, key))
                            }
                          />
                          <code>
                            {GAMES_DIR}/{save.gamesDir}/{save.name}
                          </code>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <div>
                  <ConfirmDelete
                    label={`Delete selected (${selectedSaves.length})`}
                    confirmLabel={`Confirm permanently delete ${selectedSaves.length} save ${selectedSaves.length === 1 ? 'file' : 'files'}?`}
                    busy={savesBusy}
                    disabled={anyBusy || selectedSaves.length === 0}
                    confirming={savesConfirm}
                    onConfirmChange={setSavesConfirm}
                    onDelete={() => void handleSavesDelete()}
                  />
                </div>
              </>
            )}
            {savesError !== null && (
              <p className="health-view__error" role="alert">
                {savesError}
              </p>
            )}
          </section>

          <section className="health-view__section">
            <h3>Orphaned user covers</h3>
            {orphanCovers.length === 0 ? (
              <p className="health-view__ok">Every user cover belongs to a game on the card.</p>
            ) : (
              <>
                <p className="health-view__dim">
                  {orphanCovers.length} {orphanCovers.length === 1 ? 'cover' : 'covers'} in{' '}
                  <code>/_pico/covers/user</code> match no ROM. Covers can be regenerated from the
                  Covers tab, so they are pre-selected.
                </p>
                <ul className="health-view__list">
                  {orphanCovers.map((name) => (
                    <li key={name}>
                      <label className="health-view__check">
                        <input
                          type="checkbox"
                          checked={!coversDeselected.has(name)}
                          disabled={anyBusy}
                          onChange={() =>
                            setCoversDeselected((previous) => toggledSet(previous, name))
                          }
                        />
                        <code>{name}</code>
                      </label>
                    </li>
                  ))}
                </ul>
                <div>
                  <ConfirmDelete
                    label={`Clean up selected (${selectedCovers.length})`}
                    confirmLabel={`Confirm delete ${selectedCovers.length} ${selectedCovers.length === 1 ? 'cover' : 'covers'}?`}
                    busy={coversBusy}
                    disabled={anyBusy || selectedCovers.length === 0}
                    confirming={coversConfirm}
                    onConfirmChange={setCoversConfirm}
                    onDelete={() => void handleCoversDelete()}
                  />
                </div>
              </>
            )}
            {coversError !== null && (
              <p className="health-view__error" role="alert">
                {coversError}
              </p>
            )}
          </section>
        </>
      )}
    </section>
  );
}
