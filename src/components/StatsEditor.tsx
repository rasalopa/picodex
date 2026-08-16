import { useEffect, useRef, useState } from 'react';
import type { LibraryFile } from '../lib/sdcard';
import { useSd } from '../state/SdContext';
import { useT } from '../i18n';
import './StatsEditor.css';

export interface StatsEditorProps {
  game: LibraryFile;
  /** Resolved gamecode, or null — keyed the same way the badges/toggles are. */
  gameCode: string | null;
  launchCount: number;
  playMinutes: number;
  onClose: () => void;
}

/** Non-negative integer from an input value; blank/invalid becomes 0. */
function toCount(value: string): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Small modal to correct a game's play stats by hand (launch count and play
 * time), for cases the launcher can't track — e.g. hours played on real
 * hardware before this existed, or a session credited wrong. Writes through
 * the SD context's queued gamedata writer, byte-compatible with the launcher.
 */
export function StatsEditor({
  game,
  gameCode,
  launchCount,
  playMinutes,
  onClose,
}: StatsEditorProps) {
  const { setStats } = useSd();
  const t = useT();
  const [launches, setLaunches] = useState(String(launchCount));
  const [hours, setHours] = useState(String(Math.floor(playMinutes / 60)));
  const [minutes, setMinutes] = useState(String(playMinutes % 60));
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const title = game.fileName.replace(/\.[^.]+$/, '');

  // Escape closes (unless a write is in flight).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !savingRef.current) onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  function save() {
    if (savingRef.current) return;
    setSaving(true);
    savingRef.current = true;
    const total = toCount(hours) * 60 + toCount(minutes);
    void setStats(game.fileName, gameCode, {
      launchCount: toCount(launches),
      playMinutes: total,
    }).finally(() => {
      onClose();
    });
  }

  return (
    <div
      className="stats-editor__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        className="stats-editor"
        role="dialog"
        aria-modal="true"
        aria-label={t.statsEditor.dialogLabel(title)}
      >
        <header className="stats-editor__header">
          <h3 className="stats-editor__title" title={game.fileName}>
            {t.statsEditor.title(title)}
          </h3>
          <button
            type="button"
            className="stats-editor__close"
            aria-label={t.statsEditor.close}
            disabled={saving}
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <label className="stats-editor__field">
          <span className="stats-editor__label">{t.statsEditor.launches}</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={launches}
            disabled={saving}
            onChange={(e) => {
              setLaunches(e.target.value);
            }}
          />
        </label>

        <div className="stats-editor__field">
          <span className="stats-editor__label">{t.statsEditor.playTime}</span>
          <div className="stats-editor__time">
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={hours}
              disabled={saving}
              aria-label={t.statsEditor.hours}
              onChange={(e) => {
                setHours(e.target.value);
              }}
            />
            <span className="stats-editor__unit">h</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={minutes}
              disabled={saving}
              aria-label={t.statsEditor.minutes}
              onChange={(e) => {
                setMinutes(e.target.value);
              }}
            />
            <span className="stats-editor__unit">m</span>
          </div>
        </div>

        <footer className="stats-editor__actions">
          <button type="button" disabled={saving} onClick={onClose}>
            {t.statsEditor.cancel}
          </button>
          <button type="button" className="primary" disabled={saving} onClick={save}>
            {saving ? t.statsEditor.saving : t.statsEditor.save}
          </button>
        </footer>
      </div>
    </div>
  );
}
