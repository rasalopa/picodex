import { useEffect, useRef } from 'react';
import { CHANGELOG, REPO_URL } from '../lib/changelog';
import { useT } from '../i18n';
import './Changelog.css';

/**
 * "What's new" panel: a curated, in-app view of recent releases sourced from
 * {@link CHANGELOG}. Shown as a modal so it is reachable from the landing and
 * the footer without a router. Escape or an overlay click closes it.
 */
export function Changelog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  // move focus into the dialog on open, and restore it to the trigger on close
  // (matches CoverPicker/BannerEditor, the app's modal convention)
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      className="changelog__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="changelog"
        role="dialog"
        aria-modal="true"
        aria-label={t.changelog.dialogLabel}
      >
        <header className="changelog__header">
          <h3 className="changelog__title">{t.changelog.title}</h3>
          <button
            type="button"
            className="changelog__close"
            aria-label={t.changelog.close}
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <ol className="changelog__list">
          {CHANGELOG.map((entry) => (
            <li key={entry.version} className="changelog__entry">
              <div className="changelog__meta">
                <span className="changelog__version">v{entry.version}</span>
                <span className="changelog__date">{entry.date}</span>
              </div>
              <ul className="changelog__changes">
                {entry.changes.map((change) => (
                  <li key={change.text}>
                    {change.text}{' '}
                    {change.issue !== undefined && (
                      <a
                        className="changelog__issue"
                        href={`${REPO_URL}/issues/${String(change.issue)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        #{change.issue}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        <footer className="changelog__footer">
          <a href={`${REPO_URL}/releases`} target="_blank" rel="noreferrer">
            {t.changelog.fullNotes}
          </a>
        </footer>
      </div>
    </div>
  );
}
