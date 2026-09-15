import { useEffect } from 'react';
import { screenshotFileName, type Shot } from '../lib/screenshots';
import { useT } from '../i18n';
import './ScreenshotViewer.css';

export interface ScreenshotViewerProps {
  shot: Shot;
  /** Object URL of the stacked picture, the same one the grid is showing. */
  url: string;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onClose: () => void;
}

/**
 * One capture, as large as the window allows, with a way to save it.
 *
 * The picture is the object URL the gallery already built, so opening a
 * capture costs nothing: no second read off the card and no second decode.
 * Saving hands that same blob to the browser under the launcher's own
 * numbering, so a folder of downloads still reads in capture order.
 */
export function ScreenshotViewer({ shot, url, onPrev, onNext, onClose }: ScreenshotViewerProps) {
  const t = useT();
  const name = shot.number === null ? shot.id : t.screenshots.captureAlt(shot.id);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onPrev?.();
      else if (e.key === 'ArrowRight') onNext?.();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, onPrev, onNext]);

  return (
    <div
      className="shot-viewer__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="shot-viewer"
        role="dialog"
        aria-modal="true"
        aria-label={t.screenshots.captureAlt(shot.id)}
      >
        <header className="shot-viewer__header">
          <h3 className="shot-viewer__title">{name}</h3>
          <button
            type="button"
            className="shot-viewer__close"
            aria-label={t.screenshots.close}
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
            disabled={onPrev === null}
            onClick={() => onPrev?.()}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <img className="shot-viewer__shot" src={url} alt={t.screenshots.captureAlt(shot.id)} />
          <button
            type="button"
            className="shot-viewer__step"
            aria-label={t.screenshots.next}
            disabled={onNext === null}
            onClick={() => onNext?.()}
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>

        <footer className="shot-viewer__actions">
          <a className="shot-viewer__save" href={url} download={screenshotFileName(shot)}>
            {t.screenshots.download}
          </a>
        </footer>
      </div>
    </div>
  );
}
