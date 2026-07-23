import { useEffect, useRef } from 'react';
import { compatForGame, type GameCompat, type SaveType } from '../lib/loaderlists';
import { useSd } from '../state/SdContext';
import './CompatSheet.css';

export interface CompatSheetProps {
  /** Display title of the game (file name without extension). */
  title: string;
  /** Resolved header gamecode, `null` for homebrew/unreadable headers. */
  gameCode: string | null;
  /** Header software revision (byte 0x1E), `null` when unreadable. */
  romVersion: number | null;
  /**
   * NAND-save fields from the ROM header (`nandBackupRegionStart` and whether
   * the cart is DSi-capable), or `null` when not an NDS game / unreadable. A
   * non-zero `backupRegionStart` makes the loader size the save from the
   * header instead of the savelist — see {@link compatForGame}.
   */
  nand: { backupRegionStart: number; twl: boolean } | null;
  onClose: () => void;
}

/** Visual tone of one compatibility row. */
type Tone = 'ok' | 'neutral' | 'warn';

/** Display labels for the loader's save memory types. */
const SAVE_TYPE_LABELS: Record<SaveType, string> = {
  none: 'None',
  eeprom: 'EEPROM',
  flash: 'Flash',
  nand: 'NAND',
  unknown: 'Unknown',
};

/** "512" or "1.5" — integral values without the pointless ".0". */
function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Human save size: "512 B", "8 KB", "1 MB". */
function formatSize(bytes: number): string {
  const KB = 1024;
  const MB = KB * KB;
  if (bytes >= MB) return `${formatNumber(bytes / MB)} MB`;
  if (bytes >= KB) return `${formatNumber(bytes / KB)} KB`;
  return `${String(bytes)} B`;
}

/**
 * Amber-warning sentence for a version mismatch: entries exist for this game
 * but none for the ROM's revision. When the header revision was unreadable
 * the loader assumed revision 0, so the wording softens accordingly.
 */
function mismatchText(kind: 'fix' | 'patch', entryVersions: number[], romVersion: number | null) {
  const noun = entryVersions.length === 1 ? 'revision' : 'revisions';
  const revs = entryVersions.join(', ');
  const romPart =
    romVersion === null
      ? "this ROM's revision is unreadable (assuming rev 0)"
      : `this ROM is revision ${String(romVersion)}`;
  return `A ${kind} exists for ${noun} ${revs}, but ${romPart} — the loader only applies exact matches.`;
}

/** Tone + text for the anti-piracy row. */
function apRow(ap: GameCompat['ap'], romVersion: number | null): { tone: Tone; text: string } {
  switch (ap.status) {
    case 'not-needed':
      // absence is the normal case, so the wording stays neutral, never scary
      return { tone: 'neutral', text: "No fix listed — most games don't need one." };
    case 'applies':
      return { tone: 'ok', text: `Fix included (DS Protect ${ap.dsProtectVersion ?? 'unknown'}).` };
    case 'version-mismatch':
      return { tone: 'warn', text: mismatchText('fix', ap.entryVersions, romVersion) };
    case 'list-unavailable':
      // the list is absent, so this is "we can't check", not "nothing needed":
      // informational and muted, never the amber heads-up styling
      return {
        tone: 'neutral',
        text: 'aplist.bin is missing or unreadable — nothing to check against.',
      };
  }
}

/** Tone + text for the save row. */
function saveRow(save: GameCompat['save']): { tone: Tone; text: string } {
  if (save.source === 'nand-header') {
    return { tone: 'ok', text: `NAND, ${formatSize(save.sizeBytes)} (from the ROM header)` };
  }
  if (save.source === 'default' || save.saveType === null) {
    return { tone: 'neutral', text: 'Not listed — the loader defaults to 512 KB.' };
  }
  if (save.saveType === 'none' || save.sizeBytes === 0) {
    return { tone: 'neutral', text: 'None — this game does not save.' };
  }
  return { tone: 'ok', text: `${SAVE_TYPE_LABELS[save.saveType]}, ${formatSize(save.sizeBytes)}` };
}

/** Tone + text for the game-specific patch row. */
function patchRow(
  patch: GameCompat['patch'],
  romVersion: number | null,
): { tone: Tone; text: string } {
  switch (patch.status) {
    case 'none':
      return { tone: 'neutral', text: 'None needed.' };
    case 'applies':
      return {
        tone: 'ok',
        text:
          patch.patchCount === 1
            ? '1 patch applied at boot.'
            : `${String(patch.patchCount)} patches applied at boot.`,
      };
    case 'version-mismatch':
      return { tone: 'warn', text: mismatchText('patch', patch.entryVersions, romVersion) };
    case 'list-unavailable':
      // same informational, muted treatment as the AP list-unavailable case
      return {
        tone: 'neutral',
        text: 'patchlist.bin is missing or unreadable — nothing to check against.',
      };
  }
}

/**
 * One compatibility row: a status dot, an uppercase label, the verdict, and a
 * plain-words hint explaining what the row is about for users who don't know
 * the loader's internals.
 */
function Row({
  tone,
  label,
  text,
  hint,
}: {
  tone: Tone;
  label: string;
  text: string;
  hint: string;
}) {
  const glyph = tone === 'ok' ? '✓' : tone === 'warn' ? '!' : '–';
  return (
    <li className={`compat-sheet__row compat-sheet__row--${tone}`}>
      <span className={`compat-sheet__status compat-sheet__status--${tone}`} aria-hidden="true">
        {glyph}
      </span>
      <span className="compat-sheet__body">
        <span className="compat-sheet__label">{label}</span>
        <span className="compat-sheet__text">{text}</span>
        <span className="compat-sheet__hint">{hint}</span>
      </span>
    </li>
  );
}

/**
 * Per-game loader compatibility sheet: what pico-loader will do for this NDS
 * game at boot, derived from the card's `/_pico` loader lists (aplist.bin,
 * savelist.bin, patchlist.bin) via {@link compatForGame} — anti-piracy fix,
 * save memory type/size, and game-specific patches, each matched exactly the
 * way the loader matches them (gamecode + revision, no cross-revision
 * fallback). Shown as a modal following the app's convention (Changelog,
 * StatsEditor): Escape or an overlay click closes, focus moves in on open
 * and back to the trigger on close.
 */
export function CompatSheet({ title, gameCode, romVersion, nand, onClose }: CompatSheetProps) {
  const { loaderLists } = useSd();
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
  // (matches Changelog/CoverPicker, the app's modal convention)
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      previouslyFocused?.focus?.();
    };
  }, []);

  const compat =
    gameCode !== null && loaderLists !== null
      ? compatForGame(loaderLists, gameCode, romVersion, nand)
      : null;

  return (
    <div
      className="compat-sheet__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="compat-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Loader compatibility for ${title}`}
      >
        <header className="compat-sheet__header">
          <div className="compat-sheet__heading">
            <p className="compat-sheet__kicker">Loader compatibility</p>
            <h3 className="compat-sheet__title" title={title}>
              {title}
            </h3>
          </div>
          <button
            type="button"
            className="compat-sheet__close"
            aria-label="Close"
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        {gameCode === null ? (
          <p className="compat-sheet__note">
            This ROM has no retail game code (likely homebrew) — the loader's compatibility lists
            only cover retail games.
          </p>
        ) : compat === null ? (
          <p className="compat-sheet__note">No loader lists were found on this SD card.</p>
        ) : (
          <>
            <p className="compat-sheet__meta">
              <code>{gameCode}</code>
              {' · '}
              {romVersion === null
                ? 'revision unreadable (assuming rev 0)'
                : `revision ${String(romVersion)}`}
            </p>
            <ul className="compat-sheet__rows">
              <Row
                label="Anti-piracy fix"
                hint="Some retail games detect flashcards and freeze on purpose. The loader undoes that at boot when it has a fix for the game."
                {...apRow(compat.ap, romVersion)}
              />
              <Row
                label="Save"
                hint="Original cartridges have a save chip inside; the loader recreates it as a .sav file on the SD card, sized for this game."
                {...saveRow(compat.save)}
              />
              <Row
                label="Game-specific patch"
                hint="A few games need small one-off fixes to run correctly from a flashcard."
                {...patchRow(compat.patch, romVersion)}
              />
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
