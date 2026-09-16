import { useEffect, useRef, useState } from 'react';
import { screenshotFileName, type Shot } from '../lib/screenshots';
import { useT } from '../i18n';
import './ScreenshotViewer.css';

export interface ScreenshotViewerProps {
  shot: Shot;
  /** Object URL of the stacked picture, or `null` when it could not be read. */
  url: string | null;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onClose: () => void;
  onDelete: () => void;
  /** A write is in flight; the delete prompt stays put and stops responding. */
  deleting: boolean;
  /** Why the last delete failed, shown under the buttons. */
  error: string | null;
}

/**
 * One capture, as large as the window allows, with a way to save it.
 *
 * The picture is the object URL the gallery already built, so opening a
 * capture costs nothing: no second read off the card and no second decode.
 * Saving hands that same blob to the browser under the launcher's own
 * numbering, so a folder of downloads still reads in capture order.
 */
export function ScreenshotViewer({
  shot,
  url,
  onPrev,
  onNext,
  onClose,
  onDelete,
  deleting,
  error,
}: ScreenshotViewerProps) {
  const t = useT();
  const name = shot.number === null ? shot.id : t.screenshots.captureAlt(shot.id);
  /** Tagged with the capture it belongs to, so paging drops a half-made prompt. */
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirming = confirmId === shot.id;
  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  // Take focus on open and hand it back on close, so a keyboard user is not
  // dropped at the top of the page with the grid still behind the overlay.
  useEffect(() => {
    opener.current = document.activeElement;
    dialog.current?.focus();
    return () => {
      const back = opener.current;
      if (back instanceof HTMLElement && document.contains(back)) back.focus();
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (deleting) return;
      if (e.key === 'Tab') {
        // keep Tab inside the dialog: it is modal, and what is behind it is
        // covered by the overlay anyway
        const stops = dialog.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href]',
        );
        if (stops === undefined || stops.length === 0) return;
        const edge = e.shiftKey ? stops[0] : stops[stops.length - 1];
        if (document.activeElement === edge || document.activeElement === dialog.current) {
          e.preventDefault();
          (e.shiftKey ? stops[stops.length - 1] : stops[0]).focus();
        }
        return;
      }
      if (e.key === 'Escape') {
        if (confirming) setConfirmId(null);
        else onClose();
      } else if (e.key === 'ArrowLeft') onPrev?.();
      else if (e.key === 'ArrowRight') onNext?.();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, onPrev, onNext, confirming, deleting]);

  return (
    <div
      className="shot-viewer__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleting) onClose();
      }}
    >
      <div
        className="shot-viewer"
        role="dialog"
        aria-modal="true"
        aria-label={t.screenshots.captureAlt(shot.id)}
        ref={dialog}
        tabIndex={-1}
      >
        <header className="shot-viewer__header">
          <h3 className="shot-viewer__title">{name}</h3>
          <button
            type="button"
            className="shot-viewer__close"
            aria-label={t.screenshots.close}
            disabled={deleting}
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="shot-viewer__stage">
          <button
            type="button"
            className="shot-viewer__step"
            aria-label={t.screenshots.previous}
            disabled={onPrev === null || deleting}
            onClick={() => onPrev?.()}
          >
            <span aria-hidden="true">‹</span>
          </button>
          {url === null ? (
            // a capture whose files would not decode is still deletable: one
            // you cannot see is the one you most want off a failing card
            <span className="shot-viewer__shot shot-viewer__failed">
              {t.screenshots.unreadable}
            </span>
          ) : (
            <img className="shot-viewer__shot" src={url} alt={t.screenshots.captureAlt(shot.id)} />
          )}
          <button
            type="button"
            className="shot-viewer__step"
            aria-label={t.screenshots.next}
            disabled={onNext === null || deleting}
            onClick={() => onNext?.()}
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>

        <footer className="shot-viewer__actions">
          {confirming && (
            <p className="shot-viewer__prompt" role="alert">
              {t.screenshots.confirmDelete}
            </p>
          )}
          <div className="shot-viewer__buttons">
            <span className="shot-viewer__group">
              {confirming ? (
                // "No" takes the slot the delete button just vacated, so the
                // second click of a double click cancels instead of deleting.
                // The health tab is safe from this by accident: its prompt
                // sits inline and pushes the buttons sideways.
                <>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => {
                      setConfirmId(null);
                    }}
                  >
                    {t.screenshots.no}
                  </button>
                  <button
                    type="button"
                    className="shot-viewer__danger"
                    disabled={deleting}
                    onClick={onDelete}
                  >
                    {deleting ? t.screenshots.deleting : t.screenshots.yesDelete}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="shot-viewer__danger"
                  onClick={() => {
                    setConfirmId(shot.id);
                  }}
                >
                  {t.screenshots.deleteCapture}
                </button>
              )}
            </span>
            {url !== null && (
              <a className="shot-viewer__save" href={url} download={screenshotFileName(shot)}>
                {t.screenshots.download}
              </a>
            )}
          </div>
        </footer>

        {error !== null && <p className="shot-viewer__error">{t.screenshots.deleteError(error)}</p>}
      </div>
    </div>
  );
}
