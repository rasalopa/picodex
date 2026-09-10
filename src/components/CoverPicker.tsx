import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n';
import { encodeCoverBmp, encodeIconBmp } from '../lib/bmp';
import { isUsableGameCode } from '../lib/gamedata';
import {
  composeCoverRgba,
  composeIconRgba,
  coverBmpCroppedPreviewUrl,
  downloadPngAsBitmap,
  iconBmpPreviewUrl,
} from '../lib/coverart';
import { buildCatalogIndex, searchCatalog } from '../lib/matching';
import {
  COVERS,
  ICONS,
  getDir,
  readFileBytes,
  writeFileBytes,
  type LibraryFile,
} from '../lib/sdcard';
import { boxartUrl, fetchCatalog } from '../lib/thumbnails';
import { useSd, type CoverIndex } from '../state/SdContext';
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

/**
 * Where the new cover's art comes from: a libretro catalog entry, or an image
 * the user picked from their computer (issue #5: romhacks and homebrew have
 * nothing to find in the catalogs).
 */
type CoverSource = { kind: 'catalog'; name: string } | { kind: 'file'; file: File };

/** Decodes the source into a bitmap the compose step can draw. */
function loadSourceBitmap(source: CoverSource, repo: string): Promise<ImageBitmap> {
  return source.kind === 'catalog'
    ? downloadPngAsBitmap(boxartUrl(repo, source.name))
    : createImageBitmap(source.file);
}

/** A fully composed candidate (cover or icon): encoded BMP bytes plus preview. */
interface ComposedArt {
  /** Launcher-ready BMP file bytes (exactly what a save writes). */
  bmp: Uint8Array;
  /** Preview object URL of {@link bmp} (owned by the composing effect). */
  url: string;
}

/** One of the three launcher art folders, for covers and icons alike. */
type ArtDir = 'nds' | 'gba' | 'user';

/** Which file a save writes: folder key plus file name. */
interface ArtTarget {
  dir: ArtDir;
  name: string;
}

/**
 * Resolves the file a new cover or icon must be written to, following the
 * launcher's lookup order. It resolves `<art>/user/<file>.bmp` BEFORE the
 * gamecode folders, so when a user/ override exists the new file must replace
 * it there — writing the code path would be shadowed and look like a silent
 * no-op. Otherwise gamecode-keyed systems with a resolved code use
 * `<art>/<nds|gba>/<CODE>.bmp` — unless the code is not an identity (the
 * `####` homebrew placeholder): every homebrew shares it, so a file written
 * under it would show up on all of them, on the card and in the launcher
 * alike. Those go by file name.
 */
function resolveTarget(game: LibraryFile, code: string | null, index: CoverIndex): ArtTarget {
  const userName = `${game.fileName}.bmp`;
  const hasUserOverride = index.user.has(userName.toLowerCase());
  const usableCode = code !== null && isUsableGameCode(code) ? code : null;
  return !hasUserOverride && game.system.coverKeying === 'gamecode' && usableCode !== null
    ? { dir: game.system.id === 'nds' ? 'nds' : 'gba', name: `${usableCode.toUpperCase()}.bmp` }
    : { dir: 'user', name: userName };
}

/**
 * Composes a preview for whatever the user picked: runs `build` (decode,
 * compose, encode, preview) for the current input, and owns the resulting
 * object URL — it is revoked when the input changes or the dialog closes.
 * Only an outcome built for the CURRENT input is reported; an older one (or a
 * stale build finishing after the input moved on) is dropped, URL included.
 */
function useComposedArt<T>(
  input: T | null,
  build: (input: T) => Promise<ComposedArt>,
): { composed: ComposedArt | null; composing: boolean; error: string | null } {
  /** Outcome of the last finished build, tagged with the input it was built for. */
  const [outcome, setOutcome] = useState<{
    input: T;
    art: ComposedArt | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (input === null) return;
    let cancelled = false;
    /** URL committed to state, revoked when the input changes/unmounts. */
    let url: string | null = null;
    build(input).then(
      (art) => {
        if (cancelled) {
          // cleanup already ran with url === null: revoke here instead
          URL.revokeObjectURL(art.url);
          return;
        }
        url = art.url;
        setOutcome({ input, art, error: null });
      },
      (e: unknown) => {
        if (!cancelled) setOutcome({ input, art: null, error: errorMessage(e) });
      },
    );
    return () => {
      cancelled = true;
      if (url !== null) URL.revokeObjectURL(url);
    };
  }, [input, build]);

  const current = outcome !== null && outcome.input === input ? outcome : null;
  return {
    composed: current?.art ?? null,
    error: current?.error ?? null,
    composing: input !== null && current === null,
  };
}

export interface CoverPickerProps {
  /** Game whose cover is being replaced. */
  game: LibraryFile;
  /** Header gamecode (NDS/GBA), `null` when not applicable or unreadable. */
  code: string | null;
  /** Preview URL of the cover currently on the card, `null` when none. */
  currentCoverUrl: string | null;
  onClose: () => void;
  /** Called after a cover or icon was written, before {@link onClose}. */
  onSaved: () => void;
}

/**
 * Modal dialog to hand-pick a game's cover when the automatic matcher got it
 * wrong: browse/search the system's libretro-thumbnails catalog (or pick an
 * image from the computer), preview the real composed cover (downloaded,
 * composed and BMP-encoded — exactly what the launcher will display) next to
 * the current one, and write it to the SD card. A second row does the same
 * for the game's 32x32 list icon from an image on the computer. Writing
 * intentionally overwrites any existing file, and only happens on the
 * explicit "Use this cover" / "Use this icon" click.
 */
export function CoverPicker({ game, code, currentCoverUrl, onClose, onSaved }: CoverPickerProps) {
  const { root, coverIndex, iconIndex } = useSd();
  const t = useT();
  const repo = game.system.libretroRepo;
  const title = titleOf(game.fileName);

  const [catalog, setCatalog] = useState<string[] | null>(() => catalogCache.get(repo) ?? null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  /** Bumped by the retry button to re-run the catalog fetch effect. */
  const [retryToken, setRetryToken] = useState(0);
  const [query, setQuery] = useState(title);
  /** Art picked for the new cover, `null` before the first pick. */
  const [source, setSource] = useState<CoverSource | null>(null);
  /** Catalog entry highlighted in the grid (none while a file is the source). */
  const selected = source?.kind === 'catalog' ? source.name : null;
  const fileRef = useRef<HTMLInputElement | null>(null);
  /** Image picked for the new icon, `null` before the first pick. */
  const [iconFile, setIconFile] = useState<File | null>(null);
  /**
   * Custom icon found on the card for this game, tagged with what it was
   * resolved from so a result for another game or an older index is ignored.
   */
  const [currentIcon, setCurrentIcon] = useState<{
    game: LibraryFile;
    code: string | null;
    index: CoverIndex;
    url: string;
  } | null>(null);
  const currentIconUrl =
    currentIcon !== null &&
    currentIcon.game === game &&
    currentIcon.code === code &&
    currentIcon.index === iconIndex
      ? currentIcon.url
      : null;
  const [saving, setSaving] = useState(false);
  /** Mirror for event handlers registered once (Escape). */
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [iconSaveError, setIconSaveError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const target = resolveTarget(game, code, coverIndex);
  const iconTarget = resolveTarget(game, code, iconIndex);

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

  // Show the custom icon the card has for this game today, resolved the way
  // the launcher does (user/ by file name first, then the gamecode folder).
  useEffect(() => {
    if (root === null) return;
    const rootHandle = root;
    let cancelled = false;
    let url: string | null = null;
    async function load() {
      const userName = `${game.fileName}.bmp`;
      let dir: ArtDir | null = null;
      let name: string | null = null;
      if (iconIndex.user.has(userName.toLowerCase())) {
        dir = 'user';
        name = userName;
      } else if (code !== null && game.system.coverKeying === 'gamecode') {
        const codeDir: ArtDir = game.system.id === 'nds' ? 'nds' : 'gba';
        const codeName = `${code.toUpperCase()}.bmp`;
        if (iconIndex[codeDir].has(codeName.toLowerCase())) {
          dir = codeDir;
          name = codeName;
        }
      }
      if (dir === null || name === null) return;
      const iconsDir = await getDir(rootHandle, ICONS[dir]);
      if (iconsDir === null) return;
      const bytes = await readFileBytes(iconsDir, name);
      if (bytes === null) return;
      const previewUrl = await iconBmpPreviewUrl(bytes);
      if (cancelled) {
        URL.revokeObjectURL(previewUrl);
        return;
      }
      url = previewUrl;
      setCurrentIcon({ game, code, index: iconIndex, url: previewUrl });
    }
    // an unreadable or malformed icon file simply shows as "none"
    load().catch(() => undefined);
    return () => {
      cancelled = true;
      if (url !== null) URL.revokeObjectURL(url);
    };
  }, [root, game, code, iconIndex]);

  // Compose the real cover for the picked source: decode it (download the
  // catalog PNG, or read the user's file), compose it into the launcher
  // layout, encode the BMP and preview the cropped result — exactly the bytes
  // a save will write.
  const buildCover = useCallback(
    async (picked: CoverSource): Promise<ComposedArt> => {
      const bitmap = await loadSourceBitmap(picked, repo);
      let rgba: Uint8ClampedArray;
      try {
        rgba = composeCoverRgba(bitmap);
      } finally {
        bitmap.close();
      }
      const bmp = encodeCoverBmp(rgba);
      return { bmp, url: await coverBmpCroppedPreviewUrl(bmp) };
    },
    [repo],
  );
  const cover = useComposedArt(source, buildCover);

  // Same for the icon: fit the image into the 32x32 square, encode the 4bpp
  // BMP and preview it with its transparency.
  const buildIcon = useCallback(async (file: File): Promise<ComposedArt> => {
    const bitmap = await createImageBitmap(file);
    let rgba: Uint8ClampedArray;
    try {
      rgba = composeIconRgba(bitmap);
    } finally {
      bitmap.close();
    }
    const bmp = encodeIconBmp(rgba);
    return { bmp, url: await iconBmpPreviewUrl(bmp) };
  }, []);
  const icon = useComposedArt(iconFile, buildIcon);

  // index once per catalog; per keystroke only the query-dependent half runs
  const searchIndex = useMemo(
    () => (catalog === null ? null : buildCatalogIndex(catalog)),
    [catalog],
  );
  const results = useMemo(
    () => (searchIndex === null ? [] : searchCatalog(searchIndex, query)),
    [searchIndex, query],
  );

  /**
   * Writes already-encoded BMP bytes from a preview step to the SD card. This
   * is the one and only write path of the picker, and it intentionally
   * overwrites any existing file — replacing a wrong cover or icon is the
   * whole point.
   */
  function saveArt(
    folders: typeof COVERS,
    art: ArtTarget,
    bmp: Uint8Array,
    dirMissing: string,
    setError: (message: string | null) => void,
  ) {
    if (root === null || saving) return;
    const rootHandle = root;
    setSaving(true);
    savingRef.current = true;
    setError(null);
    async function write() {
      const dir = await getDir(rootHandle, folders[art.dir], true);
      if (dir === null) throw new Error(dirMissing);
      await writeFileBytes(dir, art.name, bmp);
    }
    write().then(
      () => {
        onSaved();
        onClose();
      },
      (e: unknown) => {
        setError(errorMessage(e));
        setSaving(false);
        savingRef.current = false;
      },
    );
  }

  function handleSaveCover() {
    if (cover.composed === null) return;
    saveArt(COVERS, target, cover.composed.bmp, t.coverPicker.coversDirMissing, setSaveError);
  }

  function handleSaveIcon() {
    if (icon.composed === null) return;
    saveArt(ICONS, iconTarget, icon.composed.bmp, t.coverPicker.iconsDirMissing, setIconSaveError);
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
        aria-label={t.coverPicker.dialogLabel(title)}
      >
        <header className="cover-picker__header">
          <h3 className="cover-picker__title" title={game.fileName}>
            {t.coverPicker.title(title)}
          </h3>
          <button
            type="button"
            className="cover-picker__close"
            aria-label={t.coverPicker.close}
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
          placeholder={t.coverPicker.searchPlaceholder(game.system.label)}
          aria-label={t.coverPicker.searchLabel}
        />

        <div className="cover-picker__own">
          <label className="cover-picker__own-label">
            <span>{t.coverPicker.ownImage}</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file !== undefined) setSource({ kind: 'file', file });
              }}
            />
          </label>
          <p className="cover-picker__own-hint">{t.coverPicker.ownImageHint}</p>
        </div>

        {catalogError !== null ? (
          <div className="cover-picker__error" role="alert">
            <span>{t.coverPicker.catalogFailed(catalogError)}</span>
            <button
              type="button"
              onClick={() => {
                setRetryToken((n) => n + 1);
              }}
            >
              {t.coverPicker.retry}
            </button>
          </div>
        ) : catalog === null ? (
          <p className="cover-picker__status" role="status">
            {t.coverPicker.loadingCatalog}
          </p>
        ) : results.length === 0 ? (
          <p className="cover-picker__status">{t.coverPicker.noMatches(query)}</p>
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
                  onClick={() => {
                    if (fileRef.current !== null) fileRef.current.value = '';
                    setSource({ kind: 'catalog', name });
                  }}
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
            <figcaption className="section-title">{t.coverPicker.current}</figcaption>
            {currentCoverUrl !== null ? (
              <img
                className="cover-picker__cover"
                src={currentCoverUrl}
                alt={t.coverPicker.currentAlt(title)}
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
            <figcaption className="section-title">{t.coverPicker.newCover}</figcaption>
            {cover.composing ? (
              <span
                className="cover-picker__cover cover-picker__cover--empty"
                role="status"
                aria-label={t.coverPicker.composingPreview}
              >
                <span className="cover-picker__spinner" aria-hidden="true" />
              </span>
            ) : cover.composed !== null ? (
              <img
                className="cover-picker__cover"
                src={cover.composed.url}
                alt={t.coverPicker.newAlt(title)}
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
            {cover.error !== null && (
              <p className="cover-picker__inline-error" role="alert">
                {t.coverPicker.previewFailed(cover.error)}
              </p>
            )}
            {saveError !== null && (
              <p className="cover-picker__inline-error" role="alert">
                {t.coverPicker.writeFailed(saveError)}
              </p>
            )}
            <p className="cover-picker__target">
              {t.coverPicker.writes}{' '}
              <code>
                covers/{target.dir}/{target.name}
              </code>
            </p>
            <button
              type="button"
              className="primary"
              disabled={cover.composed === null || saving}
              onClick={handleSaveCover}
            >
              {saving ? t.coverPicker.writing : t.coverPicker.useCover}
            </button>
          </div>
        </footer>

        <section className="cover-picker__icon" aria-label={t.coverPicker.iconTitle}>
          <figure className="cover-picker__side">
            <figcaption className="section-title">{t.coverPicker.iconTitle}</figcaption>
            {currentIconUrl !== null ? (
              <img
                className="cover-picker__icon-img"
                src={currentIconUrl}
                alt={t.coverPicker.iconCurrentAlt(title)}
                width={32}
                height={32}
              />
            ) : (
              <span
                className="cover-picker__icon-img cover-picker__icon-img--empty"
                role="img"
                aria-label={t.coverPicker.iconNone}
              >
                <span aria-hidden="true">?</span>
              </span>
            )}
          </figure>
          <span className="cover-picker__arrow" aria-hidden="true">
            →
          </span>
          <figure className="cover-picker__side">
            <figcaption className="section-title">{t.coverPicker.newCover}</figcaption>
            {icon.composing ? (
              <span
                className="cover-picker__icon-img cover-picker__icon-img--empty"
                role="status"
                aria-label={t.coverPicker.composingPreview}
              >
                <span className="cover-picker__spinner" aria-hidden="true" />
              </span>
            ) : icon.composed !== null ? (
              <img
                className="cover-picker__icon-img"
                src={icon.composed.url}
                alt={t.coverPicker.iconNewAlt(title)}
                width={32}
                height={32}
              />
            ) : (
              <span className="cover-picker__icon-img cover-picker__icon-img--empty">
                <span aria-hidden="true">?</span>
              </span>
            )}
          </figure>
          <div className="cover-picker__icon-body">
            <label className="cover-picker__own-label">
              <span>{t.coverPicker.iconOwnImage}</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file !== undefined) setIconFile(file);
                }}
              />
            </label>
            <p className="cover-picker__own-hint">{t.coverPicker.iconHint}</p>
          </div>
          <div className="cover-picker__actions">
            {icon.error !== null && (
              <p className="cover-picker__inline-error" role="alert">
                {t.coverPicker.previewFailed(icon.error)}
              </p>
            )}
            {iconSaveError !== null && (
              <p className="cover-picker__inline-error" role="alert">
                {t.coverPicker.writeFailed(iconSaveError)}
              </p>
            )}
            <p className="cover-picker__target">
              {t.coverPicker.writes}{' '}
              <code>
                icons/{iconTarget.dir}/{iconTarget.name}
              </code>
            </p>
            <button
              type="button"
              className="primary"
              disabled={icon.composed === null || saving}
              onClick={handleSaveIcon}
            >
              {saving ? t.coverPicker.writing : t.coverPicker.useIcon}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
