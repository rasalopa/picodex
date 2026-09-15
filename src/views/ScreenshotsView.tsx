import { useEffect, useState } from 'react';
import { ProgressBar } from '../components/ProgressBar';
import { ScreenshotViewer } from '../components/ScreenshotViewer';
import { screenshotPngBlob } from '../lib/coverart';
import { groupScreenshots, shotAt, type Shot } from '../lib/screenshots';
import { SCREENSHOTS, getDir, listEntries, readFileBytes } from '../lib/sdcard';
import { useSd, type SdMessage } from '../state/SdContext';
import { fsMessage } from '../state/fsMessage';
import { resolveSdMessage } from '../i18n/messages';
import { useT } from '../i18n';
import './ScreenshotsView.css';

/** Captures decoded at once; each one is two 147KB files off the card. */
const MAX_CONCURRENCY = 4;

/** Pixels of dark hinge drawn between the two screens, as on the console. */
const SCREEN_GAP = 6;

/** Shared empty map, so a card with nothing read yet does not make a new one. */
const EMPTY_RENDERED: ReadonlyMap<string, Rendered> = new Map();

/** One capture as the gallery renders it: its files plus the stacked picture. */
interface Rendered {
  shot: Shot;
  /** Object URL of the two screens stacked, `null` when neither could be read. */
  url: string | null;
}

/** Everything read from one card, so a second card cannot be shown its results. */
interface CardShots {
  root: FileSystemDirectoryHandle;
  /** `null` until the folder has been listed. */
  shots: Shot[] | null;
  rendered: ReadonlyMap<string, Rendered>;
  error: string | null;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Screenshots tab: every capture in `/_pico/screenshots`, each one drawn as
 * the console showed it — top screen above bottom screen. The launcher writes
 * a capture as two files that share a number; a capture whose other half never
 * reached the card is shown on its own, in its place, and labelled.
 *
 * The files are read and decoded progressively with a small worker pool, so a
 * card with a hundred captures fills in rather than blocking on the first.
 */
export function ScreenshotsView() {
  const { root } = useSd();
  const t = useT();
  /**
   * What has been read so far, tagged with the card it was read from: opening
   * another card derives an empty gallery rather than clearing this one from
   * inside the effect, which would rerender twice for nothing.
   */
  const [state, setState] = useState<CardShots | null>(null);
  /**
   * The capture being viewed, tagged with its card for the same reason the
   * gallery is: opening another card closes the viewer instead of showing a
   * picture that belongs to the card that was just unplugged.
   */
  const [open, setOpen] = useState<{ root: FileSystemDirectoryHandle; id: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<SdMessage | null>(null);
  /** Name of the capture just removed, so a silent success is not silent. */
  const [deleted, setDeleted] = useState<string | null>(null);
  const current = state !== null && state.root === root ? state : null;
  const shots = current?.shots ?? null;
  const rendered = current?.rendered ?? EMPTY_RENDERED;
  const error = current?.error ?? null;

  useEffect(() => {
    if (root === null) return;
    const rootHandle = root;
    let cancelled = false;
    /** Object URLs handed to the DOM, revoked on unmount and on a reload. */
    const urls: string[] = [];
    /** Folds one change into the state of THIS card, never another's. */
    function update(patch: (prev: CardShots) => Partial<CardShots>) {
      setState((prev) => {
        const base =
          prev !== null && prev.root === rootHandle
            ? prev
            : { root: rootHandle, shots: null, rendered: EMPTY_RENDERED, error: null };
        return { ...base, ...patch(base) };
      });
    }

    async function load() {
      const dir = await getDir(rootHandle, SCREENSHOTS);
      const entries = dir === null ? [] : await listEntries(dir);
      const found = groupScreenshots(
        entries.filter((entry) => entry.kind === 'file').map((entry) => entry.name),
      );
      if (cancelled) return;
      update(() => ({ shots: found }));
      if (dir === null || found.length === 0) return;
      const shotsDir = dir;

      /** Reads both halves of one capture and stacks them into a picture. */
      async function render(shot: Shot): Promise<Rendered> {
        try {
          const [top, bottom] = await Promise.all([
            shot.top === null ? null : readFileBytes(shotsDir, shot.top),
            shot.bottom === null ? null : readFileBytes(shotsDir, shot.bottom),
          ]);
          if (top === null && bottom === null) return { shot, url: null };
          const blob = await screenshotPngBlob(top, bottom, SCREEN_GAP);
          return { shot, url: URL.createObjectURL(blob) };
        } catch {
          // a truncated or foreign BMP shows as unreadable, next capture please
          return { shot, url: null };
        }
      }

      let next = 0;
      await Promise.all(
        Array.from({ length: Math.min(MAX_CONCURRENCY, found.length) }, async () => {
          for (let i = next++; i < found.length; i = next++) {
            if (cancelled) return;
            const result = await render(found[i]);
            if (cancelled) {
              if (result.url !== null) URL.revokeObjectURL(result.url);
              return;
            }
            if (result.url !== null) urls.push(result.url);
            update((prev) => ({ rendered: new Map(prev.rendered).set(result.shot.id, result) }));
          }
        }),
      );
    }

    load().catch((e: unknown) => {
      if (!cancelled) update(() => ({ error: errorMessage(e) }));
    });
    return () => {
      cancelled = true;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [root]);

  if (root === null) {
    return <p className="screenshots-view__empty">{t.screenshots.openCard}</p>;
  }

  const total = shots?.length ?? 0;
  const loading = shots === null || rendered.size < total;
  // paging walks the captures that can actually be shown, so a half that
  // failed to decode is stepped over rather than opening an empty viewer
  const viewable = (shots ?? []).filter((s) => rendered.get(s.id)?.url != null).map((s) => s.id);
  const openId = open !== null && open.root === root ? open.id : null;
  const openItem = openId === null ? undefined : rendered.get(openId);
  /** Opens a capture, or closes the viewer; either way last error goes away. */
  const show = (id: string | null) => {
    setDeleteError(null);
    setDeleted(null);
    setOpen(id === null || root === null ? null : { root, id });
  };
  const stepTo = (delta: number) => {
    if (openId === null) return null;
    const id = shotAt(viewable, openId, delta);
    return id === null
      ? null
      : () => {
          show(id);
        };
  };

  /**
   * Removes a capture from the card: both halves, then the gallery drops it
   * without rereading the folder. A failure keeps the viewer open and says
   * why, since the files may well still be there.
   */
  async function deleteShot(shot: Shot) {
    if (root === null || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const dir = await getDir(root, SCREENSHOTS);
      if (dir !== null) {
        for (const name of [shot.top, shot.bottom]) {
          if (name !== null) await dir.removeEntry(name);
        }
      }
      const gone = rendered.get(shot.id);
      if (gone?.url != null) URL.revokeObjectURL(gone.url);
      setState((prev) =>
        prev === null || prev.root !== root
          ? prev
          : {
              ...prev,
              shots: (prev.shots ?? []).filter((s) => s.id !== shot.id),
              rendered: new Map([...prev.rendered].filter(([id]) => id !== shot.id)),
            },
      );
      setOpen(null);
      setDeleted(shot.number === null ? shot.id : t.screenshots.captureAlt(shot.id));
    } catch (e) {
      setDeleteError(fsMessage(e));
    }
    setDeleting(false);
  }

  return (
    <section className="screenshots-view" aria-label={t.screenshots.regionLabel}>
      <header className="screenshots-view__header">
        <h2>{t.screenshots.title}</h2>
        <p className="screenshots-view__hint">{t.screenshots.intro}</p>
      </header>

      {error !== null && (
        <p className="screenshots-view__error">{t.screenshots.loadError(error)}</p>
      )}

      {deleted !== null && (
        <p className="screenshots-view__done" role="status">
          {t.screenshots.deleted(deleted)}
        </p>
      )}

      {loading && total > 0 && (
        <div className="screenshots-view__progress" role="status">
          <span>{t.screenshots.loading(rendered.size, total)}</span>
          <ProgressBar value={rendered.size / total} />
        </div>
      )}

      {shots !== null && total === 0 ? (
        <p className="screenshots-view__empty">
          {t.screenshots.empty1}
          <kbd>START</kbd>
          {t.screenshots.empty2}
        </p>
      ) : (
        <>
          <p className="screenshots-view__count">{t.screenshots.count(total)}</p>
          <ul className="screenshots-view__grid">
            {(shots ?? []).map((shot) => {
              const item = rendered.get(shot.id);
              const half =
                shot.top !== null && shot.bottom === null
                  ? t.screenshots.topOnly
                  : shot.top === null && shot.bottom !== null
                    ? t.screenshots.bottomOnly
                    : null;
              return (
                <li key={shot.id} className="screenshots-view__card">
                  {item === undefined ? (
                    <span
                      className="screenshots-view__shot screenshots-view__shot--skeleton"
                      aria-hidden="true"
                    />
                  ) : item.url === null ? (
                    <span className="screenshots-view__shot screenshots-view__shot--failed">
                      {t.screenshots.unreadable}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="screenshots-view__open"
                      aria-label={t.screenshots.open}
                      onClick={() => {
                        show(shot.id);
                      }}
                    >
                      <img
                        className="screenshots-view__shot"
                        src={item.url}
                        alt={t.screenshots.captureAlt(shot.id)}
                        loading="lazy"
                      />
                    </button>
                  )}
                  <span className="screenshots-view__name">
                    {shot.number === null ? shot.id : t.screenshots.captureAlt(shot.id)}
                    {half !== null && <span className="screenshots-view__half"> · {half}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {openItem?.url != null && (
        <ScreenshotViewer
          shot={openItem.shot}
          url={openItem.url}
          onPrev={stepTo(-1)}
          onNext={stepTo(1)}
          onClose={() => {
            show(null);
          }}
          onDelete={() => {
            void deleteShot(openItem.shot);
          }}
          deleting={deleting}
          error={deleteError === null ? null : resolveSdMessage(t, deleteError)}
        />
      )}
    </section>
  );
}
