import { useEffect, useRef } from 'react';
import { CHANGELOG, REPO_URL } from '../lib/changelog';
import { useLang, useT, type Lang } from '../i18n';
import './Changelog.css';

/** "2026-08-14" -> "Aug 14, 2026" / "14 ago 2026". Built through UTC so the
 *  day never shifts with the viewer's timezone. */
function formatDate(iso: string, lang: Lang): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(lang, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/**
 * "What's new" panel: a curated, in-app view of recent releases sourced from
 * {@link CHANGELOG}. Shown as a modal so it is reachable from the landing and
 * the footer without a router. Escape or an overlay click closes it.
 */
export function Changelog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { lang } = useLang();
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
                <span className="changelog__date">{formatDate(entry.date, lang)}</span>
              </div>
              <ul className="changelog__changes">
                {entry.changes.map((change) => (
                  <li key={change.text.en}>
                    {change.text[lang] ?? change.text.en}{' '}
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
