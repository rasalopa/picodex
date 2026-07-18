import { useEffect, useMemo, useRef, useState } from 'react';
import { encodeCoverBmp } from '../lib/bmp';
import { composeCoverRgba, coverBmpCroppedPreviewUrl, downloadPngAsBitmap } from '../lib/coverart';
import { searchCatalog } from '../lib/matching';
import { COVERS, getDir, writeFileBytes, type LibraryFile } from '../lib/sdcard';
import { boxartUrl, fetchCatalog } from '../lib/thumbnails';
import { useSd } from '../state/SdContext';
import './CoverPicker.css';

/**
 * Boxart catalogs already downloaded this session, keyed by libretro repo.
 * Module-level so reopening the picker (or opening it for another game of the
 * same system) is instant.
 */
const catalogCache = new Map<string, string[]>();

/** File name without its final extension. */
function titleOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/** Catalog entry as shown to the user: the `.png` extension stripped. */
function displayName(entry: string): string {
  return entry.toLowerCase().endsWith('.png') ? entry.slice(0, -4) : entry;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** A fully composed candidate cover: encoded BMP bytes plus their preview. */
interface ComposedCover {
  /** Launcher-ready BMP file bytes (exactly what a save writes). */
  bmp: Uint8Array;
  /** Cropped preview object URL of {@link bmp} (owned by the effect). */
  url: string;
}

export interface CoverPickerProps {
  /** Game whose cover is being replaced. */
  game: LibraryFile;
  /** Header gamecode (NDS/GBA), `null` when not applicable or unreadable. */
  code: string | null;
  /** Preview URL of the cover currently on the card, `null` when none. */
  currentCoverUrl: string | null;
  onClose: () => void;
  /** Called after a cover was written, before {@link onClose}. */
  onSaved: () => void;
}

/**
 * Modal dialog to hand-pick a game's cover when the automatic matcher got it
 * wrong: browse/search the system's libretro-thumbnails catalog, preview the
 * real composed cover (downloaded, composed and BMP-encoded — exactly what
 * the launcher will display) next to the current one, and write it to the SD
 * card. Writing intentionally overwrites any existing cover file, and only
 * happens on the explicit "Use this cover" click.
 */
export function CoverPicker({ game, code, currentCoverUrl, onClose, onSaved }: CoverPickerProps) {
  const { root, coverIndex } = useSd();
  const repo = game.system.libretroRepo;
  const title = titleOf(game.fileName);

  const [catalog, setCatalog] = useState<string[] | null>(() => catalogCache.get(repo) ?? null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  /** Bumped by the retry button to re-run the catalog fetch effect. */
  const [retryToken, setRetryToken] = useState(0);
  const [query, setQuery] = useState(title);
  /** Catalog entry picked in the grid, `null` before the first click. */
  const [selected, setSelected] = useState<string | null>(null);
  const [composed, setComposed] = useState<ComposedCover | null>(null);
  const [composing, setComposing] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Mirror for event handlers registered once (Escape). */
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Where a save will write. The launcher resolves covers/user/<file>.bmp
  // BEFORE the gamecode folders, so when a user/ override exists the new
  // cover must replace it there — writing the code path would be shadowed
  // and look like a silent no-op. Otherwise gamecode-keyed systems with a
  // resolved code use covers/<nds|gba>/<CODE>.bmp.
  const userName = `${game.fileName}.bmp`;
  const hasUserOverride = coverIndex.user.has(userName.toLowerCase());
  const target =
    !hasUserOverride && game.system.coverKeying === 'gamecode' && code !== null
      ? {
          dir: game.system.id === 'nds' ? ('nds' as const) : ('gba' as const),
          name: `${code.toUpperCase()}.bmp`,
        }
      : { dir: 'user' as const, name: userName };

  // Focus the search input when the dialog opens (select the prefilled title
  // so typing starts a fresh query).
  useEffect(() => {
    searchRef.current?.focus();
    searchRef.current?.select();
  }, []);

  // Escape closes the dialog.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !savingRef.current) onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  // Load the system's boxart catalog (once per repo per session).
  useEffect(() => {
    const cached = catalogCache.get(repo);
    if (cached !== undefined) {
      setCatalog(cached);
      setCatalogError(null);
      return;
    }
    let cancelled = false;
    setCatalog(null);
    setCatalogError(null);
    fetchCatalog(repo).then(
      (names) => {
        catalogCache.set(repo, names);
        if (!cancelled) setCatalog(names);
      },
      (e: unknown) => {
        if (!cancelled) setCatalogError(errorMessage(e));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [repo, retryToken]);

  // Compose the real cover for the selected candidate: download the PNG,
  // compose it into the launcher layout, encode the BMP and preview the
  // cropped result — exactly the bytes a save will write.
  useEffect(() => {
    if (selected === null) {
      setComposed(null);
      setComposing(false);
      setComposeError(null);
      return;
    }
    const name = selected;
    let cancelled = false;
    /** URL committed to state, revoked when the selection changes/unmounts. */
    let url: string | null = null;
    setComposed(null);
    setComposing(true);
    setComposeError(null);
    async function compose() {
      const bitmap = await downloadPngAsBitmap(boxartUrl(repo, name));
      let rgba: Uint8ClampedArray;
      try {
        rgba = composeCoverRgba(bitmap);
      } finally {
        bitmap.close();
      }
      const bmp = encodeCoverBmp(rgba);
      const previewUrl = await coverBmpCroppedPreviewUrl(bmp);
      if (cancelled) {
        // cleanup already ran with url === null: revoke here instead
        URL.revokeObjectURL(previewUrl);
        return;
      }
      url = previewUrl;
      setComposed({ bmp, url: previewUrl });
      setComposing(false);
    }
    compose().catch((e: unknown) => {
      if (!cancelled) {
        setComposeError(errorMessage(e));
        setComposing(false);
      }
    });
    return () => {
      cancelled = true;
      if (url !== null) URL.revokeObjectURL(url);
    };
  }, [selected, repo]);

  const results = useMemo(
    () => (catalog === null ? [] : searchCatalog(catalog, query)),
    [catalog, query],
  );

  /**
   * Writes the already-encoded BMP bytes from the preview step to the SD
   * card. This is the one and only write path of the picker, and it
   * intentionally overwrites any existing cover — replacing a wrong cover is
   * the whole point.
   */
  function handleSave() {
    if (composed === null || root === null || saving) return;
    const rootHandle = root;
    const bmp = composed.bmp;
    setSaving(true);
    savingRef.current = true;
    setSaveError(null);
    async function write() {
      const dir = await getDir(rootHandle, COVERS[target.dir], true);
      if (dir === null) throw new Error('Could not open the covers directory');
      await writeFileBytes(dir, target.name, bmp);
    }
    write().then(
      () => {
        onSaved();
        onClose();
      },
      (e: unknown) => {
        setSaveError(errorMessage(e));
        setSaving(false);
        savingRef.current = false;
      },
    );
  }

  return (
    <div
      className="cover-picker__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        className="cover-picker"
        role="dialog"
        aria-modal="true"
        aria-label={`Change cover for ${title}`}
      >
        <header className="cover-picker__header">
          <h3 className="cover-picker__title" title={game.fileName}>
            Change cover — {title}
          </h3>
          <button
            type="button"
            className="cover-picker__close"
            aria-label="Close"
            disabled={saving}
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <input
          ref={searchRef}
          className="cover-picker__search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${game.system.label} box art…`}
          aria-label="Search box art"
        />

        {catalogError !== null ? (
          <div className="cover-picker__error" role="alert">
            <span>Could not load the box art catalog: {catalogError}</span>
            <button
              type="button"
              onClick={() => {
                setRetryToken((n) => n + 1);
              }}
            >
              Retry
            </button>
          </div>
        ) : catalog === null ? (
          <p className="cover-picker__status" role="status">
            Loading box art catalog…
          </p>
        ) : results.length === 0 ? (
          <p className="cover-picker__status">No box art matches “{query}”.</p>
        ) : (
          <ul className="cover-picker__results">
            {results.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  className={
                    name === selected
                      ? 'cover-picker__candidate cover-picker__candidate--selected'
                      : 'cover-picker__candidate'
                  }
                  aria-pressed={name === selected}
                  onClick={() => setSelected(name)}
                >
                  <img
                    className="cover-picker__thumb"
                    loading="lazy"
                    src={boxartUrl(repo, name)}
                    alt=""
                  />
                  <span className="cover-picker__candidate-name">{displayName(name)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <footer className="cover-picker__compare">
          <figure className="cover-picker__side">
            <figcaption>Current</figcaption>
            {currentCoverUrl !== null ? (
              <img
                className="cover-picker__cover"
                src={currentCoverUrl}
                alt={`Current cover of ${title}`}
                width={106}
                height={96}
              />
            ) : (
              <span className="cover-picker__cover cover-picker__cover--empty">
                <span aria-hidden="true">?</span>
              </span>
            )}
          </figure>
          <span className="cover-picker__arrow" aria-hidden="true">
            →
          </span>
          <figure className="cover-picker__side">
            <figcaption>New</figcaption>
            {composing ? (
              <span
                className="cover-picker__cover cover-picker__cover--empty"
                role="status"
                aria-label="Composing preview…"
              >
                <span className="cover-picker__spinner" aria-hidden="true" />
              </span>
            ) : composed !== null ? (
              <img
                className="cover-picker__cover"
                src={composed.url}
                alt={`New cover preview for ${title}`}
                width={106}
                height={96}
              />
            ) : (
              <span className="cover-picker__cover cover-picker__cover--empty">
                <span aria-hidden="true">?</span>
              </span>
            )}
          </figure>
          <div className="cover-picker__actions">
            {composeError !== null && (
              <p className="cover-picker__inline-error" role="alert">
                Preview failed: {composeError}
              </p>
            )}
            {saveError !== null && (
              <p className="cover-picker__inline-error" role="alert">
                Write failed: {saveError}
              </p>
            )}
            <p className="cover-picker__target">
              Writes{' '}
              <code>
                covers/{target.dir}/{target.name}
              </code>
            </p>
            <button
              type="button"
              className="primary"
              disabled={composed === null || saving}
              onClick={handleSave}
            >
              {saving ? 'Writing…' : 'Use this cover'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
