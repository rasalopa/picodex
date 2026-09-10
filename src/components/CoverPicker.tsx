import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n';
import { findArt, resolveArtTarget, type ArtIndex, type ArtTarget } from '../lib/artPaths';
import { decodeBannerIcon } from '../lib/banner';
import { encodeCoverBmp, encodeIconBmp, validateLauncherIconBmp } from '../lib/bmp';
import {
  bannerIconRgbaPreviewUrl,
  composeCoverRgba,
  composeIconRgba,
  coverBmpCroppedPreviewUrl,
  downloadPngAsBitmap,
  iconBmpPreviewUrl,
} from '../lib/coverart';
import { buildCatalogIndex, searchCatalog } from '../lib/matching';
import {
  BANNERS,
  COVERS,
  ICONS,
  getDir,
  readFileBytes,
  writeFileBytes,
  type LibraryFile,
} from '../lib/sdcard';
import { boxartUrl, fetchCatalog } from '../lib/thumbnails';
import { useSd } from '../state/SdContext';
import './CoverPicker.css';

/**
 * Boxart catalogs already downloaded this session, keyed by libretro repo.
 * Module-level so reopening the picker (or opening it for another game of the
 * same system) is instant.
 */
const catalogCache = new Map<string, string[]>();

/**
 * Smallest `.bnr` the launcher accepts: header, icon bitmap and palette
 * (`NdsBannerInternalFileInfo::ReadBannerChunks`). Shorter files are ignored
 * and the game falls back to its BMP icon.
 */
const MIN_BANNER_BYTES = 0x240;

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

/**
 * What the launcher shows next to this game's name today, resolved in its own
 * order: a per-game banner replaces everything, else a custom BMP icon, else
 * (DS only) the icon built into the ROM.
 */
interface CurrentIcon {
  kind: 'banner' | 'custom' | 'builtin' | 'invalid' | 'none';
  /** Preview URL; `null` for `invalid` (the launcher draws it blank) and `none`. */
  url: string | null;
}

/** One of the two things a save can write. */
type ArtKind = 'cover' | 'icon';

/** Where a tab's picker lives. */
type Tab = 'boxart' | 'coverFile' | 'iconFile';

export interface CoverPickerProps {
  /** Game whose art is being changed. */
  game: LibraryFile;
  /** Header gamecode (NDS/GBA), `null` when not applicable or unreadable. */
  code: string | null;
  /** Preview URL of the cover currently on the card, `null` when none. */
  currentCoverUrl: string | null;
  /** Titles listed just before and after this game in the gallery, for the list mock-up. */
  neighbours?: { before: readonly string[]; after: readonly string[] };
  onClose: () => void;
  /** Called once after anything was written to the card. */
  onSaved: () => void;
}

/**
 * Modal dialog to change a game's cover and, for systems whose ROMs carry no
 * icon of their own, its list icon. It shows the game the way the console
 * does — the cover on the top screen, the game's row with icon and name on
 * the bottom screen — and marks whatever a save will change. Sources sit in
 * tabs below: the system's libretro-thumbnails catalog, a cover image from
 * the computer, an icon image from the computer. The previews are the real
 * composed and BMP-encoded files, exactly what the launcher will display.
 *
 * One Save writes everything pending, in order, and reports each file on its
 * own: the dialog closes when all of it landed, and stays open with the
 * failed file marked when something did not, so a partial write is never
 * mistaken for a full one. Writing intentionally overwrites existing files.
 */
export function CoverPicker({
  game,
  code,
  currentCoverUrl,
  neighbours,
  onClose,
  onSaved,
}: CoverPickerProps) {
  const { root, coverIndex, iconIndex, bannerIndex } = useSd();
  const t = useT();
  const repo = game.system.libretroRepo;
  const title = titleOf(game.fileName);
  // NDS ROMs ship their own banner icon; a custom one would only replace it.
  // The icon tab exists for GBA and the other systems, which have none.
  const iconTabShown = game.system.id !== 'nds';

  const [tab, setTab] = useState<Tab>('boxart');
  const [catalog, setCatalog] = useState<string[] | null>(() => catalogCache.get(repo) ?? null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  /** Bumped by the retry button to re-run the catalog fetch effect. */
  const [retryToken, setRetryToken] = useState(0);
  const [query, setQuery] = useState(title);
  /** Art picked for the new cover, `null` before the first pick. */
  const [source, setSource] = useState<CoverSource | null>(null);
  /** Catalog entry highlighted in the grid (none while a file is the source). */
  const selected = source?.kind === 'catalog' ? source.name : null;
  const coverFileRef = useRef<HTMLInputElement | null>(null);
  /** Image picked for the new icon, `null` before the first pick. */
  const [iconFile, setIconFile] = useState<File | null>(null);
  const iconFileRef = useRef<HTMLInputElement | null>(null);
  /**
   * The card's icon for this game, tagged with what it was resolved from so a
   * result for another game or an older index is ignored.
   */
  const [cardIcon, setCardIcon] = useState<
    (CurrentIcon & { game: LibraryFile; icons: ArtIndex; banners: ArtIndex }) | null
  >(null);
  const currentIcon: CurrentIcon =
    cardIcon !== null &&
    cardIcon.game === game &&
    cardIcon.icons === iconIndex &&
    cardIcon.banners === bannerIndex
      ? cardIcon
      : { kind: 'none', url: null };
  const hasBanner = currentIcon.kind === 'banner';
  const [saving, setSaving] = useState(false);
  /** Mirror for event handlers registered once (Escape). */
  const savingRef = useRef(false);
  /** Per file: written by the last save (so it is no longer pending) or why it failed. */
  const [saved, setSaved] = useState<Record<ArtKind, boolean>>({ cover: false, icon: false });
  const [writeErrors, setWriteErrors] = useState<Record<ArtKind, string | null>>({
    cover: null,
    icon: null,
  });
  const searchRef = useRef<HTMLInputElement | null>(null);

  const coverTarget = resolveArtTarget(game, code, coverIndex);
  const iconTarget = resolveArtTarget(game, code, iconIndex);

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

  // Resolve the icon the console shows for this game today, in the launcher's
  // order: banner file, custom BMP (a launcher-invalid one is reported, not
  // previewed: the console draws it blank), then the ROM's own banner on DS.
  useEffect(() => {
    if (root === null) return;
    const rootHandle = root;
    let cancelled = false;
    let url: string | null = null;
    const tag = { game, icons: iconIndex, banners: bannerIndex };

    async function bannerIcon(): Promise<CurrentIcon | null> {
      const found = findArt(game, code, bannerIndex, 'bnr');
      if (found === null) return null;
      const dir = await getDir(rootHandle, BANNERS[found.dir]);
      const bytes = dir === null ? null : await readFileBytes(dir, found.name);
      if (bytes === null || bytes.length < MIN_BANNER_BYTES) return null;
      const rgba = decodeBannerIcon(bytes.subarray(0x20, 0x220), bytes.subarray(0x220, 0x240));
      return { kind: 'banner', url: await bannerIconRgbaPreviewUrl(rgba) };
    }

    async function customIcon(): Promise<CurrentIcon | null> {
      const found = findArt(game, code, iconIndex, 'bmp');
      if (found === null) return null;
      const dir = await getDir(rootHandle, ICONS[found.dir]);
      const bytes = dir === null ? null : await readFileBytes(dir, found.name);
      if (bytes === null) return null;
      if (validateLauncherIconBmp(bytes) !== null) return { kind: 'invalid', url: null };
      return { kind: 'custom', url: await iconBmpPreviewUrl(bytes) };
    }

    async function builtInIcon(): Promise<CurrentIcon | null> {
      if (game.system.id !== 'nds') return null;
      const dir = await getDir(rootHandle, game.path);
      if (dir === null) return null;
      const file = await (await dir.getFileHandle(game.fileName)).getFile();
      const header = new DataView(await file.slice(0x68, 0x6c).arrayBuffer());
      const offset = header.getUint32(0, true);
      if (offset === 0 || offset + 0x240 > file.size) return null;
      const banner = new Uint8Array(await file.slice(offset + 0x20, offset + 0x240).arrayBuffer());
      const rgba = decodeBannerIcon(banner.subarray(0, 0x200), banner.subarray(0x200, 0x220));
      return { kind: 'builtin', url: await bannerIconRgbaPreviewUrl(rgba) };
    }

    async function load() {
      const icon = (await bannerIcon()) ?? (await customIcon()) ?? (await builtInIcon());
      if (icon === null) return;
      if (cancelled) {
        if (icon.url !== null) URL.revokeObjectURL(icon.url);
        return;
      }
      url = icon.url;
      setCardIcon({ ...icon, ...tag });
    }
    // an unreadable file simply shows as "none"
    load().catch(() => undefined);
    return () => {
      cancelled = true;
      if (url !== null) URL.revokeObjectURL(url);
    };
  }, [root, game, code, iconIndex, bannerIndex]);

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

  // What a save would write. A composed file already written by an earlier
  // (partially failed) save stays on screen but is not written again; an icon
  // is never written while a banner would make the launcher ignore it.
  const coverPending = cover.composed !== null && !saved.cover;
  const iconPending = iconTabShown && icon.composed !== null && !saved.icon && !hasBanner;
  const canSave = (coverPending || iconPending) && !saving;

  // index once per catalog; per keystroke only the query-dependent half runs
  const searchIndex = useMemo(
    () => (catalog === null ? null : buildCatalogIndex(catalog)),
    [catalog],
  );
  const results = useMemo(
    () => (searchIndex === null ? [] : searchCatalog(searchIndex, query)),
    [searchIndex, query],
  );

  function pickCover(next: CoverSource) {
    setSource(next);
    setSaved((s) => ({ ...s, cover: false }));
    setWriteErrors((w) => ({ ...w, cover: null }));
  }

  function pickIcon(file: File) {
    setIconFile(file);
    setSaved((s) => ({ ...s, icon: false }));
    setWriteErrors((w) => ({ ...w, icon: null }));
  }

  /**
   * Writes every pending file, one after the other, and reports each on its
   * own. Anything that landed triggers one card reload; the dialog closes only
   * when everything landed, otherwise the failed file stays pending with its
   * error shown and the written one is marked as saved.
   */
  function handleSave() {
    if (root === null || !canSave) return;
    const rootHandle = root;
    const plan: Array<{
      kind: ArtKind;
      folders: typeof COVERS;
      target: ArtTarget;
      bmp: Uint8Array;
    }> = [];
    if (coverPending && cover.composed !== null) {
      plan.push({ kind: 'cover', folders: COVERS, target: coverTarget, bmp: cover.composed.bmp });
    }
    if (iconPending && icon.composed !== null) {
      plan.push({ kind: 'icon', folders: ICONS, target: iconTarget, bmp: icon.composed.bmp });
    }
    setSaving(true);
    savingRef.current = true;
    setWriteErrors({ cover: null, icon: null });
    async function write() {
      const errors: Record<ArtKind, string | null> = { cover: null, icon: null };
      let wrote = false;
      for (const w of plan) {
        try {
          const dir = await getDir(rootHandle, w.folders[w.target.dir], true);
          if (dir === null) {
            throw new Error(
              w.kind === 'cover' ? t.coverPicker.coversDirMissing : t.coverPicker.iconsDirMissing,
            );
          }
          await writeFileBytes(dir, w.target.name, w.bmp);
          wrote = true;
          setSaved((s) => ({ ...s, [w.kind]: true }));
        } catch (e) {
          errors[w.kind] = errorMessage(e);
        }
      }
      if (wrote) onSaved();
      return errors;
    }
    write().then((errors) => {
      if (errors.cover === null && errors.icon === null) {
        onClose();
        return;
      }
      setWriteErrors(errors);
      setSaving(false);
      savingRef.current = false;
    });
  }

  const before = neighbours?.before ?? [];
  const after = neighbours?.after ?? [];
  const showNewCover = cover.composed !== null;
  const showNewIcon = iconTabShown && icon.composed !== null && !hasBanner;

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
          <span className="cover-picker__meta">
            {game.system.label}
            {code !== null && ` · ${code}`}
          </span>
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

        <div className="cover-picker__screens">
          <section className="cover-picker__screen" aria-label={t.coverPicker.topScreen}>
            <span className="section-title">{t.coverPicker.topScreen}</span>
            <div className="cover-picker__panel">
              {cover.composing ? (
                <span
                  className="cover-picker__top-cover cover-picker__top-cover--empty"
                  role="status"
                  aria-label={t.coverPicker.composingPreview}
                >
                  <span className="cover-picker__spinner" aria-hidden="true" />
                </span>
              ) : showNewCover && cover.composed !== null ? (
                <img
                  className="cover-picker__top-cover"
                  src={cover.composed.url}
                  alt={t.coverPicker.newAlt(title)}
                  width={106}
                  height={96}
                />
              ) : currentCoverUrl !== null ? (
                <img
                  className="cover-picker__top-cover"
                  src={currentCoverUrl}
                  alt={t.coverPicker.currentAlt(title)}
                  width={106}
                  height={96}
                />
              ) : (
                <span className="cover-picker__top-cover cover-picker__top-cover--empty">
                  <span aria-hidden="true">?</span>
                </span>
              )}
              <span className="cover-picker__title-chip">{title}</span>
              {coverPending && <span className="cover-picker__pill">{t.coverPicker.newCover}</span>}
              {showNewCover && currentCoverUrl !== null && (
                <span className="cover-picker__before">
                  <img
                    src={currentCoverUrl}
                    alt={t.coverPicker.currentAlt(title)}
                    width={53}
                    height={48}
                  />
                  {t.coverPicker.current}
                </span>
              )}
            </div>
          </section>

          <section className="cover-picker__screen" aria-label={t.coverPicker.bottomScreen}>
            <span className="section-title">{t.coverPicker.bottomScreen}</span>
            <div className="cover-picker__panel cover-picker__list">
              {before.map((name) => (
                <div key={`b-${name}`} className="cover-picker__row cover-picker__row--dim">
                  <span className="cover-picker__row-icon cover-picker__row-icon--empty" />
                  <span className="cover-picker__row-name">{name}</span>
                </div>
              ))}
              <div className="cover-picker__row cover-picker__row--selected">
                {icon.composing && iconTabShown ? (
                  <span
                    className="cover-picker__row-icon cover-picker__row-icon--empty"
                    role="status"
                    aria-label={t.coverPicker.composingPreview}
                  >
                    <span className="cover-picker__spinner" aria-hidden="true" />
                  </span>
                ) : showNewIcon && icon.composed !== null ? (
                  <img
                    className="cover-picker__row-icon"
                    src={icon.composed.url}
                    alt={t.coverPicker.iconNewAlt(title)}
                    width={32}
                    height={32}
                  />
                ) : currentIcon.url !== null ? (
                  <img
                    className="cover-picker__row-icon"
                    src={currentIcon.url}
                    alt={
                      currentIcon.kind === 'banner'
                        ? t.coverPicker.bannerIconAlt(title)
                        : currentIcon.kind === 'builtin'
                          ? t.coverPicker.builtInIconAlt(title)
                          : t.coverPicker.iconCurrentAlt(title)
                    }
                    width={32}
                    height={32}
                  />
                ) : currentIcon.kind === 'invalid' ? (
                  <span
                    className="cover-picker__row-icon cover-picker__row-icon--invalid"
                    role="img"
                    aria-label={t.coverPicker.iconInvalidOnCard}
                    title={t.coverPicker.iconInvalidOnCard}
                  >
                    <span aria-hidden="true">!</span>
                  </span>
                ) : (
                  <span
                    className="cover-picker__row-icon cover-picker__row-icon--empty"
                    role="img"
                    aria-label={t.coverPicker.iconNone}
                    title={t.coverPicker.iconNone}
                  >
                    <span aria-hidden="true">?</span>
                  </span>
                )}
                <span className="cover-picker__row-name">{title}</span>
                {iconPending && (
                  <span className="cover-picker__pill">{t.coverPicker.newCover}</span>
                )}
              </div>
              {after.map((name) => (
                <div key={`a-${name}`} className="cover-picker__row cover-picker__row--dim">
                  <span className="cover-picker__row-icon cover-picker__row-icon--empty" />
                  <span className="cover-picker__row-name">{name}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="cover-picker__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'boxart'}
            className={
              tab === 'boxart' ? 'cover-picker__tab cover-picker__tab--active' : 'cover-picker__tab'
            }
            onClick={() => setTab('boxart')}
          >
            {t.coverPicker.tabBoxArt}
            {coverPending && source?.kind === 'catalog' && (
              <span className="cover-picker__tab-dot" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'coverFile'}
            className={
              tab === 'coverFile'
                ? 'cover-picker__tab cover-picker__tab--active'
                : 'cover-picker__tab'
            }
            onClick={() => setTab('coverFile')}
          >
            {t.coverPicker.tabCoverFile}
            {coverPending && source?.kind === 'file' && (
              <span className="cover-picker__tab-dot" aria-hidden="true" />
            )}
          </button>
          {iconTabShown && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'iconFile'}
              className={
                tab === 'iconFile'
                  ? 'cover-picker__tab cover-picker__tab--active'
                  : 'cover-picker__tab'
              }
              onClick={() => setTab('iconFile')}
            >
              {t.coverPicker.tabIconFile}
              {iconPending && <span className="cover-picker__tab-dot" aria-hidden="true" />}
            </button>
          )}
        </div>

        {tab === 'boxart' && (
          <div className="cover-picker__tabpanel" role="tabpanel">
            <input
              ref={searchRef}
              className="cover-picker__search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.coverPicker.searchPlaceholder(game.system.label)}
              aria-label={t.coverPicker.searchLabel}
            />
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
                        if (coverFileRef.current !== null) coverFileRef.current.value = '';
                        pickCover({ kind: 'catalog', name });
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
          </div>
        )}

        {tab === 'coverFile' && (
          <div className="cover-picker__tabpanel" role="tabpanel">
            <label className="cover-picker__file-label">
              <span>{t.coverPicker.tabCoverFile}</span>
              <input
                ref={coverFileRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file !== undefined) pickCover({ kind: 'file', file });
                }}
              />
            </label>
            <p className="cover-picker__hint">{t.coverPicker.ownImageHint}</p>
          </div>
        )}

        {tab === 'iconFile' && iconTabShown && (
          <div className="cover-picker__tabpanel" role="tabpanel">
            <label className="cover-picker__file-label">
              <span>{t.coverPicker.tabIconFile}</span>
              <input
                ref={iconFileRef}
                type="file"
                accept="image/*"
                disabled={hasBanner}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file !== undefined) pickIcon(file);
                }}
              />
            </label>
            {hasBanner ? (
              <p className="cover-picker__note">{t.coverPicker.iconBannerNote}</p>
            ) : (
              <p className="cover-picker__hint">{t.coverPicker.iconHint}</p>
            )}
          </div>
        )}

        <footer className="cover-picker__footer">
          {(coverPending || iconPending) && (
            <span className="cover-picker__writes">{t.coverPicker.writes}</span>
          )}
          {coverPending && (
            <code
              className={
                writeErrors.cover !== null
                  ? 'cover-picker__chip cover-picker__chip--failed'
                  : 'cover-picker__chip'
              }
            >
              covers/{coverTarget.dir}/{coverTarget.name}
            </code>
          )}
          {iconPending && (
            <code
              className={
                writeErrors.icon !== null
                  ? 'cover-picker__chip cover-picker__chip--failed'
                  : 'cover-picker__chip'
              }
            >
              icons/{iconTarget.dir}/{iconTarget.name}
            </code>
          )}
          <span className="cover-picker__spacer" />
          <button type="button" disabled={saving} onClick={onClose}>
            {t.coverPicker.close}
          </button>
          <button
            type="button"
            className="primary"
            disabled={!canSave}
            title={coverPending || iconPending ? undefined : t.coverPicker.nothingToSave}
            onClick={handleSave}
          >
            {saving ? t.coverPicker.writing : t.coverPicker.save}
          </button>
          {cover.error !== null && (
            <p className="cover-picker__inline-error" role="alert">
              {t.coverPicker.previewFailed(cover.error)}
            </p>
          )}
          {icon.error !== null && (
            <p className="cover-picker__inline-error" role="alert">
              {t.coverPicker.previewFailed(icon.error)}
            </p>
          )}
          {writeErrors.cover !== null && (
            <p className="cover-picker__inline-error" role="alert">
              {t.coverPicker.writeFailed(writeErrors.cover)}
            </p>
          )}
          {writeErrors.icon !== null && (
            <p className="cover-picker__inline-error" role="alert">
              {t.coverPicker.writeFailed(writeErrors.icon)}
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}
