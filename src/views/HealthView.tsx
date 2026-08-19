import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSd } from '../state/SdContext';
import { useT } from '../i18n';
import { findOrphanSaves, findOrphanUserCovers, missingLoaderFiles } from '../lib/health';
import { fetchLatestLoaderTag, LOADER_MANIFEST, scanLoaderFiles } from '../lib/loaderScan';
import {
  identifyLoader,
  isNewerThanManifest,
  LOADER_RELEASES_URL,
  type LoaderVersionResult,
} from '../lib/loaderVersion';
import { scanCard, type ScanResult } from '../lib/scan';
import { COVERS, friendlyFsError, getDir } from '../lib/sdcard';
import './HealthView.css';

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
  const t = useT();
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
        {busy ? t.health.deleting : t.health.yesDelete}
      </button>
      <button type="button" disabled={busy} onClick={() => onConfirmChange(false)}>
        {t.health.no}
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
  const t = useT();
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

  /**
   * Which pico-loader release the card's loader files came from, hashed during
   * the scan. `null` until a scan has run.
   */
  const [loaderVersion, setLoaderVersion] = useState<LoaderVersionResult | null>(null);
  /** Loader files that are on the card but would not open, so were not hashed. */
  const [loaderUnreadable, setLoaderUnreadable] = useState<readonly string[]>([]);
  /**
   * Newest release tag GitHub reports, when it could be reached. Only used to
   * notice that the committed manifest is behind; never part of the verdict.
   */
  const [liveLatestTag, setLiveLatestTag] = useState<string | null>(null);

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
        setScanError(t.health.libraryRereadFailed);
        return;
      }
      const result = await scanCard(root, setFilesSeen);
      setScan(result);
      // Hashing the loader files is part of inspecting the card, so it shares this
      // scan's spinner and re-runs on rescan. Its own try/catch: a loader file
      // that will not open must not cost the user the rest of the report.
      try {
        const { hashes, unreadable } = await scanLoaderFiles(root);
        setLoaderVersion(identifyLoader(LOADER_MANIFEST, hashes));
        setLoaderUnreadable(unreadable);
      } catch {
        setLoaderVersion(null);
        setLoaderUnreadable([]);
      }
      // Deliberately not awaited: the report is complete without it, so a slow or
      // blocked network must not hold it up. Resolves to null on any failure.
      void fetchLatestLoaderTag().then(setLiveLatestTag);
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
  }, [root, refresh, t]);

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

  /**
   * Whether GitHub has a release this build's manifest never saw. It cannot change
   * the verdict, but it does change what the verdict is allowed to claim: calling a
   * release "the newest" is false once we know a newer one exists.
   */
  const manifestIsStale = isNewerThanManifest(LOADER_MANIFEST, liveLatestTag);

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
      setJunkError(t.health.junkDeleteFailed(failed.join(', ')));
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
        <h2>{t.health.title}</h2>
        <p className="health-view__dim">{t.health.openCard}</p>
      </section>
    );
  }

  return (
    <section className="health-view">
      <header className="health-view__header">
        <div>
          <h2>{t.health.title}</h2>
          <p className="health-view__dim">{t.health.intro}</p>
        </div>
        <button type="button" className="primary" onClick={() => void runScan()} disabled={anyBusy}>
          {scanning ? t.health.scanning : t.health.scanCard}
        </button>
      </header>

      {scanning && (
        <p className="health-view__dim" role="status">
          {t.health.scanningCount(filesSeen)}
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
            {t.health.scannedFiles(scan.filesSeen)}
            {scan.skippedDirs.length > 0 && (
              <>
                {' '}
                {t.health.skippedFolders(scan.skippedDirs.length)}{' '}
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
            <h3 className="section-title">{t.health.junkTitle}</h3>
            {junkCount === 0 ? (
              <p className="health-view__ok">{t.health.junkNone}</p>
            ) : (
              <>
                <p>
                  <span className="health-view__warn">
                    {t.health.junkCount(scan.junkFiles.length, formatSize(junkSize))}
                  </span>{' '}
                  {t.health.junkKinds1}
                  <code>._*</code>
                  {t.health.junkKinds2}
                  <code>.DS_Store</code>
                  {t.health.junkKinds3}
                </p>
                {scan.junkFiles.length > 0 && (
                  <details className="health-view__details">
                    <summary>{t.health.showJunk}</summary>
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
                    label={t.health.junkCleanLabel(junkCount)}
                    confirmLabel={t.health.junkConfirmLabel(junkCount)}
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
                {t.health.macosKeeps1}
                {macosDirs.map((name, index) => (
                  <span key={name}>
                    {index > 0 && ', '}
                    <code>{name}</code>
                  </span>
                ))}
                {t.health.macosKeeps2}
              </p>
            )}
            {keptFsevents && (
              <p className="health-view__dim">
                <code>.fseventsd</code>
                {t.health.fsevents1}
                <code>no_log</code>
                {t.health.fsevents2}
              </p>
            )}
            {junkError !== null && (
              <p className="health-view__error" role="alert">
                {junkError}
              </p>
            )}
          </section>

          <section
            className={sectionClass(
              loader !== null && loader.required.length === 0 && loaderVersion?.status !== 'mixed',
            )}
          >
            <h3 className="section-title">{t.health.loaderTitle}</h3>
            {loader !== null && loader.required.length === 0 ? (
              <p className="health-view__ok">{t.health.loaderAllPresent}</p>
            ) : (
              loader !== null && (
                <>
                  <ul className="health-view__list">
                    {loader.required.map((name) => (
                      <li key={name} className="health-view__warn">
                        {t.health.loaderMissing1}
                        <code>/_pico/{name}</code>
                        {t.health.loaderMissing2}
                      </li>
                    ))}
                  </ul>
                  <p>
                    {t.health.downloadFrom1}
                    <a href={LOADER_RELEASES_URL} target="_blank" rel="noreferrer">
                      {t.health.downloadReleases}
                    </a>
                    {t.health.downloadFrom2}
                    <code>/_pico</code>
                    {t.health.downloadFrom3}
                  </p>
                </>
              )
            )}
            {loaderVersion !== null && loaderVersion.status === 'identified' && (
              // Two statements, not one sentence. Which release the card is on, and
              // whether that is current, are independently true or false, and every
              // attempt to carry both in one clause has ended up claiming something
              // the data did not support - "the newest release" while admitting it
              // cannot tell which of two releases you have, most recently.
              <>
                <p
                  className={loaderVersion.candidates.length === 1 ? 'health-view__ok' : undefined}
                >
                  {t.health.loaderIs}
                  <strong>{loaderVersion.candidates.join(t.health.orJoiner)}</strong>
                  {loaderVersion.builds.length >= 1 && loaderVersion.builds.length <= 2 ? (
                    // The build is named only when the loader binaries pin it down:
                    // one cart, or the old byte-identical AK2/AKRPG pair. A card
                    // where only the universal picoLoader7.bin matched reports
                    // every build, which is not knowledge worth printing.
                    <>
                      {t.health.loaderBuild1}
                      <strong>{loaderVersion.builds.join(t.health.orJoiner)}</strong>
                      {t.health.loaderBuild2}
                    </>
                  ) : (
                    t.health.loaderEnd
                  )}
                  {loaderVersion.ambiguity === 'identical-releases'
                    ? t.health.ambiguityIdentical
                    : loaderVersion.ambiguity === 'incomplete-evidence'
                      ? // NOT "identical files": v1.7.0 and v1.7.1 differ in exactly
                        // picoLoader7.bin, which reaching this branch means was either
                        // absent or unrecognised (hand-edited, or newer than the manifest).
                        t.health.ambiguityIncomplete
                      : ''}
                </p>
                {loaderVersion.releasesBehind > 0 ? (
                  <p>
                    {t.health.releasesBehind1(
                      loaderVersion.releasesBehind,
                      loaderVersion.candidates.length > 1,
                    )}
                    <strong>{loaderVersion.latestKnown}</strong>
                    {t.health.releasesBehind2}
                  </p>
                ) : loaderVersion.candidates.length > 1 ? (
                  // Saying "the newest" here would pick one of the candidates.
                  <p className="health-view__dim">
                    {t.health.newestKnownCandidate(loaderVersion.latestKnown)}
                  </p>
                ) : manifestIsStale || loaderVersion.unrecognisedFiles.length > 0 ? (
                  <p className="health-view__dim">{t.health.newestKnownMaybe}</p>
                ) : (
                  <p className="health-view__ok">{t.health.newestRelease}</p>
                )}
              </>
            )}

            {loaderVersion !== null &&
              loaderVersion.status === 'mixed' &&
              loaderVersion.mismatch !== null && (
                <>
                  <p className="health-view__warn">
                    {t.health.mixed1(loaderVersion.mismatch.agreeing)}
                    <strong>{loaderVersion.mismatch.bestFit}</strong>
                    {t.health.mixed2}
                    {loaderVersion.mismatch.oddOnesOut.map((name, index) => (
                      <span key={name}>
                        {index > 0 &&
                          (index === loaderVersion.mismatch!.oddOnesOut.length - 1
                            ? t.health.andJoiner
                            : ', ')}
                        <code>{name}</code>
                      </span>
                    ))}{' '}
                    {t.health.mixed3(loaderVersion.mismatch.oddOnesOut.length)}
                  </p>
                  <p>
                    {t.health.copyAgain1}
                    <a href={LOADER_RELEASES_URL} target="_blank" rel="noreferrer">
                      {t.health.copyAgainRelease}
                    </a>
                    {loaderVersion.unrecognisedFiles.length > 0
                      ? t.health.copyAgainOverwrites
                      : t.health.copyAgainEnd}
                  </p>
                </>
              )}

            {loaderVersion !== null && loaderVersion.status === 'unrecognised' && (
              <p className="health-view__dim">{t.health.unrecognisedAll}</p>
            )}

            {/* Also on a mixed card: the sentence above counts only the files that
                could be placed, so without this the rest are never mentioned at all
                and its numbers do not add up to what was hashed. */}
            {loaderVersion !== null &&
              (loaderVersion.status === 'identified' || loaderVersion.status === 'mixed') &&
              loaderVersion.unrecognisedFiles.length > 0 && (
                <p className="health-view__dim">
                  {t.health.unrecognisedListed1}
                  {loaderVersion.unrecognisedFiles.map((name, index) => (
                    <span key={name}>
                      {index > 0 && ', '}
                      <code>{name}</code>
                    </span>
                  ))}
                  {t.health.unrecognisedListed2}
                  <code>aplist.bin</code>
                  {t.health.unrecognisedListed3}
                </p>
              )}

            {isNewerThanManifest(LOADER_MANIFEST, liveLatestTag) && (
              <p className="health-view__dim">
                {t.health.githubNewer1}
                <strong>{liveLatestTag}</strong>
                {t.health.githubNewer2(liveLatestTag ?? '')}
              </p>
            )}

            {loaderUnreadable.length > 0 && (
              <p className="health-view__dim">
                {t.health.unreadable}
                {loaderUnreadable.map((name, index) => (
                  <span key={name}>
                    {index > 0 && ', '}
                    <code>{name}</code>
                  </span>
                ))}
              </p>
            )}

            {loader !== null && loader.optional.length > 0 && (
              <p className="health-view__dim">
                {t.health.optional1}
                {loader.optional.map((name, index) => (
                  <span key={name}>
                    {index > 0 && ', '}
                    <code>{name}</code>
                  </span>
                ))}
                {t.health.optional2}
              </p>
            )}
          </section>

          <section className={sectionClass(orphanSaves.length === 0)}>
            <h3 className="section-title">{t.health.savesTitle}</h3>
            {libraryEmpty ? (
              <p className="health-view__dim">{t.health.savesSkipped}</p>
            ) : orphanSaves.length === 0 ? (
              <p className="health-view__ok">{t.health.savesAllOk}</p>
            ) : (
              <>
                <p className="health-view__warn">{t.health.savesOrphans(orphanSaves.length)}</p>
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
                    label={t.health.savesDeleteLabel(selectedSaves.length)}
                    confirmLabel={t.health.savesConfirmLabel(selectedSaves.length)}
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
            <h3 className="section-title">{t.health.coversTitle}</h3>
            {libraryEmpty ? (
              <p className="health-view__dim">{t.health.coversSkipped}</p>
            ) : orphanCovers.length === 0 ? (
              <p className="health-view__ok">{t.health.coversAllOk}</p>
            ) : (
              <>
                <p className="health-view__dim">
                  {t.health.coversOrphans1(orphanCovers.length)}
                  <code>/_pico/covers/user</code>
                  {t.health.coversOrphans2(orphanCovers.length)}
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
                    label={t.health.coversCleanLabel(selectedCovers.length)}
                    confirmLabel={t.health.coversConfirmLabel(selectedCovers.length)}
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
