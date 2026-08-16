import { useEffect, useRef } from 'react';
import { compatForGame, type GameCompat, type RomKind } from '../lib/loaderlists';
import { useSd } from '../state/SdContext';
import { useT } from '../i18n';
import type { Dict } from '../i18n/en';
import './CompatSheet.css';

export interface CompatSheetProps {
  /** Display title of the game (file name without extension). */
  title: string;
  /** Resolved header gamecode, `null` when the header carries no usable one. */
  gameCode: string | null;
  /**
   * Which of the loader's paths this ROM takes, from the header. `null` when
   * the header could not be read at all - which is NOT the same as homebrew,
   * and must not be reported as a fact about the ROM.
   */
  kind: RomKind | null;
  /** DSiWare `.pub`/`.prv` sizes from the TWL header, when applicable. */
  dsiWareSaveBytes?: { publicBytes: number; privateBytes: number } | null;
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

/** Tone + text for the anti-piracy row. */
function apRow(
  t: Dict,
  ap: GameCompat['ap'],
  romVersion: number | null,
): { tone: Tone; text: string } {
  switch (ap.status) {
    case 'not-listed':
      // Absence from aplist.bin is NOT "this game needs no fix": the loader
      // also patches a hardcoded set of gamecodes on the ARM9 side
      // (Arm9Patcher::AddGamePatches) that is deliberately kept out of the
      // list, so a claim about the game would be false for exactly those
      // titles. Say what we actually checked, and nothing more.
      return { tone: 'neutral', text: t.compat.ap.notListed };
    case 'not-applicable':
      return { tone: 'neutral', text: t.compat.ap.skipped };
    case 'applies':
      return { tone: 'ok', text: t.compat.ap.applies(ap.dsProtectVersion) };
    case 'version-mismatch':
      return { tone: 'warn', text: t.compat.mismatch('fix', ap.entryVersions, romVersion) };
    case 'list-unavailable':
      // the list is absent, so this is "we can't check", not "nothing needed":
      // informational and muted, never the amber heads-up styling
      return { tone: 'neutral', text: t.compat.ap.listUnavailable };
  }
}

/** Tone + text for the save row. */
function saveRow(t: Dict, save: GameCompat['save']): { tone: Tone; text: string } {
  if (save.source === 'homebrew-none') {
    return { tone: 'neutral', text: t.compat.save.homebrewNone };
  }
  if (save.source === 'dsiware-header') {
    // DSiWare goes to DsiWareSaveArranger, which sizes .pub/.prv from the TWL
    // header and never opens savelist.bin
    if (save.sizeBytes === 0 && !save.privateSizeBytes) {
      return { tone: 'neutral', text: t.compat.save.dsiWareNone };
    }
    return {
      tone: 'ok',
      text: t.compat.save.dsiWare(
        formatSize(save.sizeBytes),
        save.privateSizeBytes ? formatSize(save.privateSizeBytes) : null,
      ),
    };
  }
  if (save.source === 'nand-header') {
    return { tone: 'ok', text: t.compat.save.nandHeader(formatSize(save.sizeBytes)) };
  }
  if (save.source === 'default' || save.saveType === null) {
    return { tone: 'neutral', text: t.compat.save.defaultSize };
  }
  if (save.saveType === 'none' || save.sizeBytes === 0) {
    return { tone: 'neutral', text: t.compat.save.none };
  }
  return {
    tone: 'ok',
    text: t.compat.save.listed(t.compat.saveTypes[save.saveType], formatSize(save.sizeBytes)),
  };
}

/** Tone + text for the game-specific patch row. */
function patchRow(
  t: Dict,
  patch: GameCompat['patch'],
  romVersion: number | null,
): { tone: Tone; text: string } {
  switch (patch.status) {
    case 'not-listed':
      // patchlist.bin covers only the ARM7-applied patches; the ARM9 side has
      // its own hardcoded table (Arm9Patcher::AddGameSpecificPatches), so
      // "none needed" would overstate what this checked
      return { tone: 'neutral', text: t.compat.patch.notListed };
    case 'not-applicable':
      return { tone: 'neutral', text: t.compat.patch.skipped };
    case 'applies':
      return { tone: 'ok', text: t.compat.patch.applied(patch.patchCount) };
    case 'version-mismatch':
      return { tone: 'warn', text: t.compat.mismatch('patch', patch.entryVersions, romVersion) };
    case 'list-unavailable':
      // same informational, muted treatment as the AP list-unavailable case
      return { tone: 'neutral', text: t.compat.patch.listUnavailable };
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
export function CompatSheet({
  title,
  gameCode,
  kind,
  dsiWareSaveBytes,
  romVersion,
  nand,
  onClose,
}: CompatSheetProps) {
  const { loaderLists } = useSd();
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
  // (matches Changelog/CoverPicker, the app's modal convention)
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      previouslyFocused?.focus?.();
    };
  }, []);

  const compat =
    gameCode !== null && kind !== null && loaderLists !== null
      ? compatForGame(loaderLists, gameCode, romVersion, nand, {
          kind,
          dsiWareSaveBytes: dsiWareSaveBytes ?? undefined,
        })
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
        aria-label={t.compat.dialogLabel(title)}
      >
        <header className="compat-sheet__header">
          <div className="compat-sheet__heading">
            <p className="compat-sheet__kicker">{t.compat.kicker}</p>
            <h3 className="compat-sheet__title" title={title}>
              {title}
            </h3>
          </div>
          <button
            type="button"
            className="compat-sheet__close"
            aria-label={t.compat.close}
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        {kind === null ? (
          <p className="compat-sheet__note">{t.compat.noHeader}</p>
        ) : gameCode === null ? (
          <p className="compat-sheet__note">{t.compat.noGameCode}</p>
        ) : compat === null ? (
          <p className="compat-sheet__note">{t.compat.noLists}</p>
        ) : (
          <>
            <p className="compat-sheet__meta">
              <code>{gameCode}</code>
              {' · '}
              {romVersion === null ? t.compat.revisionUnreadable : t.compat.revision(romVersion)}
            </p>
            <ul className="compat-sheet__rows">
              <Row
                label={t.compat.apLabel}
                hint={t.compat.hints.ap[compat.kind]}
                {...apRow(t, compat.ap, romVersion)}
              />
              <Row
                label={t.compat.saveLabel}
                hint={t.compat.hints.save[compat.kind]}
                {...saveRow(t, compat.save)}
              />
              <Row
                label={t.compat.patchLabel}
                hint={t.compat.hints.patch[compat.kind]}
                {...patchRow(t, compat.patch, romVersion)}
              />
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
