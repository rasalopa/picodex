import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSd } from '../state/SdContext';
import { findOrphanSaves, findOrphanUserCovers, missingLoaderFiles } from '../lib/health';
import { scanCard, type ScanResult } from '../lib/scan';
import { COVERS, friendlyFsError, getDir } from '../lib/sdcard';
import './HealthView.css';

/** URL of the Pico Loader releases page (source of the required .bin files). */
const LOADER_RELEASES_URL = 'https://github.com/LNH-team/pico-loader/releases';

/** Section card class with its ok/warn status edge modifier. */
function sectionClass(ok: boolean): string {
  return `health-view__section health-view__section--${ok ? 'ok' : 'warn'}`;
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
 * Junk is deleted by exact rules only (the `isJunkFileName` /
 * `JUNK_DIR_NAMES` allowlists in `lib/health`); anything possibly valuable
 * (saves) requires explicit per-item opt-in.
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

  /** Selected orphan saves (full-path keys) — empty by default. */
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
      if (!(await refresh())) {
        // scanning against a stale or empty library would flag healthy
        // saves and covers as orphans — refuse rather than mislead
        setScanError(
          'The game library could not be re-read (see the error above), ' +
            'so the scan was cancelled — its results would be unreliable.',
        );
        return;
      }
      const result = await scanCard(root, setFilesSeen);
      setScan(result);
      // fresh scan, fresh choices: selections and pending confirms reset
      setSavesSelected(new Set());
      setCoversDeselected(new Set());
      setJunkConfirm(false);
      setSavesConfirm(false);
      setCoversConfirm(false);
    } catch (e) {
      setScanError(friendlyFsError(e));
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
  /**
   * With no games found under `Games/<system>` (e.g. ROMs kept in a custom
   * folder layout), EVERY save and user cover would classify as orphaned —
   * a mass-deletion invitation. Skip orphan detection entirely then and
   * explain why instead.
   */
  const libraryEmpty = games.length === 0;
  const orphanSaves = useMemo(
    () => (scan === null || libraryEmpty ? [] : findOrphanSaves(games, scan.saves)),
    [scan, games, libraryEmpty],
  );
  const orphanCovers = useMemo(
    () => (scan === null || libraryEmpty ? [] : findOrphanUserCovers(scan.userCoverNames, games)),
    [scan, games, libraryEmpty],
  );

  // macOS recreates .Trashes / .Spotlight-V100 / .fseventsd every time the
  // card is mounted, so deleting them is a losing battle — they are shown as
  // an informational note, not as junk to clean. A no_log-only .fseventsd is
  // excluded here: it gets its own dedicated note below.
  const macosDirs = useMemo(
    () => scan?.junkDirs.filter((dir) => !dir.preventionOnly).map((dir) => dir.name) ?? [],
    [scan],
  );
  const keptFsevents = scan?.junkDirs.some((dir) => dir.preventionOnly) ?? false;
  // only files are actionable junk: ._* and .DS_Store are created on copy/view
  // (not on mount), so cleaning them actually sticks.
  const junkCount = scan?.junkFiles.length ?? 0;
  const junkSize = scan?.junkFiles.reduce((sum, file) => sum + file.size, 0) ?? 0;

  const selectedSaves = orphanSaves.filter((save) =>
    savesSelected.has([...save.path, save.name].join('/')),
  );
  const selectedCovers = orphanCovers.filter((name) => !coversDeselected.has(name));

  const anyBusy = scanning || junkBusy || savesBusy || coversBusy;

  const handleJunkDelete = async () => {
    if (root === null || scan === null || anyBusy) return;
    setJunkBusy(true);
    setJunkError(null);
    // one protected entry must not abort the rest of the cleanup
    const failed: string[] = [];
    for (const file of scan.junkFiles) {
      try {
        const dir = await getDir(root, file.path);
        if (dir === null) continue; // parent vanished since the scan
        await dir.removeEntry(file.name);
      } catch {
        failed.push([...file.path, file.name].join('/'));
      }
    }
    if (failed.length > 0) {
      setJunkError(
        `Could not delete: ${failed.join(', ')}. macOS protects some of its own ` +
          'files from other apps — they are harmless to the launcher.',
      );
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
        const dir = await getDir(root, save.path);
        if (dir === null) continue;
        await dir.removeEntry(save.name);
      }
    } catch (e) {
      setSavesError(friendlyFsError(e));
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
      setCoversError(friendlyFsError(e));
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
          <p className="health-view__dim">
            Scanned {scan.filesSeen} files.
            {scan.skippedDirs.length > 0 && (
              <>
                {' '}
                Skipped {scan.skippedDirs.length}{' '}
                {scan.skippedDirs.length === 1 ? 'folder' : 'folders'} macOS would not let the
                browser read:{' '}
                {scan.skippedDirs.map((name, index) => (
                  <span key={name}>
                    {index > 0 && ', '}
                    <code>{name}</code>
                  </span>
                ))}
                .
              </>
            )}
          </p>

          <section className={sectionClass(junkCount === 0)}>
            <h3 className="section-title">macOS junk</h3>
            {junkCount === 0 ? (
              <p className="health-view__ok">No macOS junk files found.</p>
            ) : (
              <>
                <p>
                  <span className="health-view__warn">
                    {scan.junkFiles.length} junk {scan.junkFiles.length === 1 ? 'file' : 'files'} (
                    {formatSize(junkSize)})
                  </span>{' '}
                  — <code>._*</code> AppleDouble files and <code>.DS_Store</code>.
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
            {macosDirs.length > 0 && (
              <p className="health-view__dim">
                macOS keeps{' '}
                {macosDirs.map((name, index) => (
                  <span key={name}>
                    {index > 0 && ', '}
                    <code>{name}</code>
                  </span>
                ))}{' '}
                on the card. It recreates them every time you plug it into a Mac, so they are left
                alone — they are harmless to the launcher.
              </p>
            )}
            {keptFsevents && (
              <p className="health-view__dim">
                <code>.fseventsd</code> holds only a <code>no_log</code> marker — an intentional
                logging-prevention setup.
              </p>
            )}
            {junkError !== null && (
              <p className="health-view__error" role="alert">
                {junkError}
              </p>
            )}
          </section>

          <section className={sectionClass(loader !== null && loader.required.length === 0)}>
            <h3 className="section-title">Loader files</h3>
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

          <section className={sectionClass(orphanSaves.length === 0)}>
            <h3 className="section-title">Orphaned saves</h3>
            {libraryEmpty ? (
              <p className="health-view__dim">
                Skipped: no games were found on the card, so every save would wrongly look orphaned.
              </p>
            ) : orphanSaves.length === 0 ? (
              <p className="health-view__ok">Every save file belongs to a game on the card.</p>
            ) : (
              <>
                <p className="health-view__warn">
                  {orphanSaves.length} save {orphanSaves.length === 1 ? 'file' : 'files'} have no
                  matching ROM in their own folder — the launcher only pairs a save with a ROM
                  sitting next to it. Saves may hold game progress and deleting them is permanent —
                  select only the ones you are sure about.
                </p>
                <ul className="health-view__list">
                  {orphanSaves.map((save) => {
                    const key = [...save.path, save.name].join('/');
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
                          <code>{key}</code>
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

          <section className={sectionClass(orphanCovers.length === 0)}>
            <h3 className="section-title">Orphaned user covers</h3>
            {libraryEmpty ? (
              <p className="health-view__dim">
                Skipped: no games were found on the card, so every user cover would wrongly look
                orphaned.
              </p>
            ) : orphanCovers.length === 0 ? (
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
