import { useEffect, useRef, useState } from 'react';
import {
  buildFolderBanner,
  decodeBannerIcon,
  encodeBannerIcon,
  parseBannerTitle,
  parseBnrIcon,
  type BannerIcon,
} from '../lib/banner';
import { bannerIconRgbaPreviewUrl, composeIconRgba } from '../lib/coverart';
import { GAMES_DIR, getDir, readFileBytes, writeFileBytes, type LibraryFile } from '../lib/sdcard';
import { SYSTEMS } from '../lib/systems';
import { useSd } from '../state/SdContext';
import './BannerEditor.css';

/** Name of the folder banner file the launcher reads. */
const BANNER_FILE = 'banner.bnr';

/** Where the editor can take the banner icon from. */
type IconSource = 'current' | 'image' | 'game';

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** `true` for NDS-family files whose header/banner can be read directly. */
function isNdsFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.nds') || lower.endsWith('.dsi') || lower.endsWith('.srl');
}

/**
 * Reads the banner icon of an NDS ROM on the card WITHOUT reading the whole
 * file (ROMs can be hundreds of MB): first a 0x6C-byte header slice for the
 * banner offset (u32 LE @ 0x68), then only the 0x240-byte icon area.
 *
 * @returns The icon, or `null` when the ROM declares no banner (offset 0) or
 *   the banner lies outside the file.
 */
async function readRomBannerIcon(
  root: FileSystemDirectoryHandle,
  gamesDir: string,
  fileName: string,
): Promise<BannerIcon | null> {
  const dir = await getDir(root, [GAMES_DIR, gamesDir]);
  if (dir === null) throw new Error(`Could not open ${GAMES_DIR}/${gamesDir}`);
  const handle = await dir.getFileHandle(fileName);
  const file = await handle.getFile();
  if (file.size < 0x6c) return null;
  const header = new Uint8Array(await file.slice(0, 0x6c).arrayBuffer());
  const offset = new DataView(header.buffer).getUint32(0x68, true);
  if (offset === 0 || offset + 0x240 > file.size) return null;
  const area = new Uint8Array(await file.slice(offset, offset + 0x240).arrayBuffer());
  if (area.length < 0x240) return null;
  // Same layout as inside a banner.bnr: bitmap @ 0x20, palette @ 0x220.
  return { bitmap: area.slice(0x20, 0x220), palette: area.slice(0x220, 0x240) };
}

export interface BannerEditorProps {
  /** Folder under `Games/` whose `banner.bnr` is being edited. */
  gamesDir: string;
  /** Label of the system whose card opened the editor (title prefill). */
  systemLabel: string;
  /** Games of all systems sharing this folder (icon-from-ROM candidates). */
  games: LibraryFile[];
  onClose: () => void;
  /** Called after the banner was written or removed, before {@link onClose}. */
  onSaved: () => void;
}

/**
 * Modal dialog to create, replace or remove a folder's `banner.bnr` — the
 * 32x32 icon plus display title the launcher shows instead of the folder
 * name. The icon can be kept from the existing banner, composed from any
 * image (aspect-fit, quantized to the 15-color banner palette — the preview
 * shows the TRUE quantized result) or extracted from an NDS ROM in the
 * folder. Writing intentionally overwrites any existing banner, and only
 * happens on the explicit save (or two-step remove) click.
 */
export function BannerEditor({
  gamesDir,
  systemLabel,
  games,
  onClose,
  onSaved,
}: BannerEditorProps) {
  const { root } = useSd();

  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Whether a banner.bnr currently exists in the folder. */
  const [hasExisting, setHasExisting] = useState(false);
  /** Icon of the existing banner ('Keep current' source). */
  const [currentIcon, setCurrentIcon] = useState<BannerIcon | null>(null);
  const [title, setTitle] = useState(systemLabel);
  const [source, setSource] = useState<IconSource>('image');
  /** Icon encoded from a picked image file ('From image' source). */
  const [imageIcon, setImageIcon] = useState<BannerIcon | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  /** Icon extracted from a chosen ROM ('From a game' source). */
  const [gameIcon, setGameIcon] = useState<BannerIcon | null>(null);
  const [gameFile, setGameFile] = useState('');
  const [gameLoading, setGameLoading] = useState(false);
  const [gameError, setGameError] = useState<string | null>(null);
  /** Discards stale ROM icon reads when the selection changes quickly. */
  const gameRequestRef = useRef(0);
  /** Stale-request token for image decodes (same pattern as ROM picks). */
  const imageRequestRef = useRef(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  /** In-flight write/remove; gates every way of closing the dialog. */
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  /** Mirror for event handlers registered once (Escape). */
  const busyRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const titleRef = useRef<HTMLInputElement | null>(null);

  /** ROMs whose banner icon can be reused (NDS-family files only). */
  const ndsGames = games.filter((game) => isNdsFile(game.fileName));
  /** Systems storing their games in this folder (gb/gbc, ws/wsc, ngp/ngc). */
  const sharingLabels = SYSTEMS.filter((system) => system.gamesDir === gamesDir).map(
    (system) => system.label,
  );

  const activeIcon = source === 'current' ? currentIcon : source === 'image' ? imageIcon : gameIcon;

  // Read the folder's current banner once on open: existing icon + title
  // prefill (falling back to the system label when there is no banner).
  useEffect(() => {
    if (root === null) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    async function load(rootHandle: FileSystemDirectoryHandle) {
      const dir = await getDir(rootHandle, [GAMES_DIR, gamesDir]);
      const bnr = dir === null ? null : await readFileBytes(dir, BANNER_FILE);
      if (cancelled) return;
      const icon = bnr === null ? null : parseBnrIcon(bnr);
      if (bnr !== null && icon !== null) {
        setHasExisting(true);
        setCurrentIcon(icon);
        setTitle(parseBannerTitle(bnr));
        setSource('current');
      }
    }
    load(root)
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(errorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [root, gamesDir]);

  // Focus the title input once the current banner has been read (so the
  // prefilled title is final; select it so typing starts fresh).
  useEffect(() => {
    if (!loaded) return;
    titleRef.current?.focus();
    titleRef.current?.select();
  }, [loaded]);

  // Escape closes the dialog (gated while writing/removing).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busyRef.current) onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  // Preview of the ACTIVE icon, decoded from its 4bpp bitmap + palette —
  // exactly what the DS shows, including quantization to <= 15 colors.
  useEffect(() => {
    if (activeIcon === null) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    /** URL committed to state, revoked when the icon changes/unmounts. */
    let url: string | null = null;
    bannerIconRgbaPreviewUrl(decodeBannerIcon(activeIcon.bitmap, activeIcon.palette)).then(
      (previewUrl_) => {
        if (cancelled) {
          URL.revokeObjectURL(previewUrl_);
          return;
        }
        url = previewUrl_;
        setPreviewUrl(previewUrl_);
      },
      () => {
        if (!cancelled) setPreviewUrl(null);
      },
    );
    return () => {
      cancelled = true;
      if (url !== null) URL.revokeObjectURL(url);
    };
  }, [activeIcon]);

  /** Composes + encodes a picked image file into a banner icon. */
  function handleImageFile(file: File | undefined) {
    if (file === undefined) return;
    const token = ++imageRequestRef.current;
    setImageIcon(null);
    setImageError(null);
    createImageBitmap(file)
      .then((bitmap) => {
        let rgba: Uint8ClampedArray;
        try {
          rgba = composeIconRgba(bitmap);
        } finally {
          bitmap.close();
        }
        // a slower earlier decode must not clobber a newer pick
        if (token === imageRequestRef.current) setImageIcon(encodeBannerIcon(rgba));
      })
      .catch((e: unknown) => {
        if (token === imageRequestRef.current) setImageError(errorMessage(e));
      });
  }

  /** Extracts the banner icon of the chosen ROM (partial reads only). */
  function handleGameChange(fileName: string) {
    setGameFile(fileName);
    setGameIcon(null);
    setGameError(null);
    const token = ++gameRequestRef.current;
    if (fileName === '' || root === null) return;
    setGameLoading(true);
    readRomBannerIcon(root, gamesDir, fileName).then(
      (icon) => {
        if (gameRequestRef.current !== token) return;
        setGameLoading(false);
        if (icon === null) {
          setGameError('This ROM has no banner icon.');
        } else {
          setGameIcon(icon);
        }
      },
      (e: unknown) => {
        if (gameRequestRef.current !== token) return;
        setGameLoading(false);
        setGameError(errorMessage(e));
      },
    );
  }

  /**
   * Builds and writes `banner.bnr` to the folder. This is the one and only
   * write path of the editor, and it intentionally overwrites any existing
   * banner — replacing it is the whole point.
   */
  function handleSave() {
    if (activeIcon === null || root === null || busy !== null || title.trim() === '') return;
    const rootHandle = root;
    const icon = activeIcon;
    const bannerTitle = title;
    setBusy('save');
    busyRef.current = true;
    setSaveError(null);
    async function write() {
      const dir = await getDir(rootHandle, [GAMES_DIR, gamesDir]);
      if (dir === null) throw new Error(`Could not open ${GAMES_DIR}/${gamesDir}`);
      await writeFileBytes(dir, BANNER_FILE, buildFolderBanner(icon, bannerTitle));
    }
    write().then(
      () => {
        onSaved();
        onClose();
      },
      (e: unknown) => {
        setSaveError(`Write failed: ${errorMessage(e)}`);
        setBusy(null);
        busyRef.current = false;
      },
    );
  }

  /** Deletes `banner.bnr` (second step of the inline confirm). */
  function handleRemove() {
    if (root === null || busy !== null) return;
    const rootHandle = root;
    setBusy('remove');
    busyRef.current = true;
    setSaveError(null);
    async function remove() {
      const dir = await getDir(rootHandle, [GAMES_DIR, gamesDir]);
      if (dir === null) throw new Error(`Could not open ${GAMES_DIR}/${gamesDir}`);
      await dir.removeEntry(BANNER_FILE);
    }
    remove().then(
      () => {
        onSaved();
        onClose();
      },
      (e: unknown) => {
        setSaveError(`Remove failed: ${errorMessage(e)}`);
        setBusy(null);
        busyRef.current = false;
      },
    );
  }

  return (
    <div
      className="banner-editor__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && busy === null) onClose();
      }}
    >
      <div
        className="banner-editor"
        role="dialog"
        aria-modal="true"
        aria-label={`Edit folder banner for ${systemLabel}`}
      >
        <header className="banner-editor__header">
          <h3 className="banner-editor__heading">
            Folder banner — {GAMES_DIR}/{gamesDir}/
          </h3>
          <button
            type="button"
            className="banner-editor__close"
            aria-label="Close"
            disabled={busy !== null}
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        {sharingLabels.length > 1 && (
          <p className="banner-editor__note">
            This folder is shared by {sharingLabels.join(', ')}; the launcher shows one banner for
            it.
          </p>
        )}

        {loadError !== null && (
          <p className="banner-editor__error" role="alert">
            Could not read the current banner: {loadError}
          </p>
        )}

        {!loaded ? (
          <p className="banner-editor__status" role="status">
            Reading current banner…
          </p>
        ) : (
          <>
            <div className="banner-editor__preview" aria-label="Banner preview">
              {previewUrl !== null ? (
                <img
                  className="banner-editor__preview-icon"
                  src={previewUrl}
                  alt=""
                  width={32}
                  height={32}
                />
              ) : (
                <span
                  className="banner-editor__preview-icon banner-editor__preview-icon--empty"
                  aria-hidden="true"
                >
                  ?
                </span>
              )}
              <span className="banner-editor__preview-title">{title}</span>
            </div>

            <label className="banner-editor__field">
              <span className="banner-editor__field-label">Title</span>
              <input
                ref={titleRef}
                type="text"
                maxLength={127}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                }}
                placeholder="Folder title shown by the launcher"
              />
            </label>

            <fieldset className="banner-editor__sources">
              <legend className="banner-editor__field-label">Icon</legend>
              <div
                className="banner-editor__source-options"
                role="radiogroup"
                aria-label="Icon source"
              >
                {hasExisting && (
                  <label className="banner-editor__source">
                    <input
                      type="radio"
                      name="banner-icon-source"
                      checked={source === 'current'}
                      onChange={() => {
                        setSource('current');
                      }}
                    />
                    Keep current
                  </label>
                )}
                <label className="banner-editor__source">
                  <input
                    type="radio"
                    name="banner-icon-source"
                    checked={source === 'image'}
                    onChange={() => {
                      setSource('image');
                    }}
                  />
                  From image
                </label>
                {ndsGames.length > 0 && (
                  <label className="banner-editor__source">
                    <input
                      type="radio"
                      name="banner-icon-source"
                      checked={source === 'game'}
                      onChange={() => {
                        setSource('game');
                      }}
                    />
                    From a game
                  </label>
                )}
              </div>

              {source === 'image' && (
                <div className="banner-editor__source-detail">
                  <input
                    type="file"
                    accept="image/*"
                    aria-label="Icon image file"
                    onChange={(e) => {
                      handleImageFile(e.target.files?.[0]);
                    }}
                  />
                  <p className="banner-editor__hint">
                    Scaled to fit 32×32 and quantized to 15 colors — the preview above is exactly
                    what the DS will show.
                  </p>
                  {imageError !== null && (
                    <p className="banner-editor__error" role="alert">
                      Could not read the image: {imageError}
                    </p>
                  )}
                </div>
              )}

              {source === 'game' && (
                <div className="banner-editor__source-detail">
                  <select
                    aria-label="Game to take the icon from"
                    value={gameFile}
                    onChange={(e) => {
                      handleGameChange(e.target.value);
                    }}
                  >
                    <option value="">Choose a game…</option>
                    {ndsGames.map((game) => (
                      <option key={game.fileName} value={game.fileName}>
                        {game.fileName}
                      </option>
                    ))}
                  </select>
                  {gameLoading && (
                    <p className="banner-editor__status" role="status">
                      Reading ROM banner…
                    </p>
                  )}
                  {gameError !== null && (
                    <p className="banner-editor__error" role="alert">
                      {gameError}
                    </p>
                  )}
                </div>
              )}
            </fieldset>
          </>
        )}

        <footer className="banner-editor__footer">
          <div className="banner-editor__remove-area">
            {hasExisting &&
              (confirmRemove ? (
                <span className="banner-editor__confirm">
                  <span>Remove {BANNER_FILE}?</span>
                  <button type="button" disabled={busy !== null} onClick={handleRemove}>
                    {busy === 'remove' ? 'Removing…' : 'Remove'}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => {
                      setConfirmRemove(false);
                    }}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="banner-editor__remove"
                  disabled={busy !== null}
                  onClick={() => {
                    setConfirmRemove(true);
                  }}
                >
                  Remove banner
                </button>
              ))}
          </div>
          <div className="banner-editor__actions">
            {saveError !== null && (
              <p className="banner-editor__error" role="alert">
                {saveError}
              </p>
            )}
            <p className="banner-editor__target">
              Writes{' '}
              <code>
                {GAMES_DIR}/{gamesDir}/{BANNER_FILE}
              </code>
            </p>
            <button
              type="button"
              className="primary"
              disabled={!loaded || activeIcon === null || title.trim() === '' || busy !== null}
              onClick={handleSave}
            >
              {busy === 'save' ? 'Writing…' : 'Save banner'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
