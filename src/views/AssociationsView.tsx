import { useState } from 'react';
import { useSd } from '../state/SdContext';
import {
  removeAssociation,
  serializeSettings,
  setAssociation,
  type ParsedSettings,
} from '../lib/settings';
import { PICO_DIR, SETTINGS_FILE, getDir, writeFileText } from '../lib/sdcard';
import './AssociationsView.css';

/** Common emulator paths surfaced as hints and input placeholders. */
const EXAMPLE_PATHS = [
  '/_pico/emulators/nesDS.nds',
  '/_pico/emulators/gbarunner2.nds',
  '/_pico/emulators/lameboy.nds',
  '/_pico/emulators/SNEmulDS.nds',
  '/_pico/emulators/jEnesisDS.nds',
] as const;

/** Shallow equality of two extension → appPath maps (order-insensitive). */
function associationsEqual(a: Map<string, string>, b: Map<string, string>): boolean {
  if (a.size !== b.size) return false;
  for (const [ext, appPath] of a) {
    if (b.get(ext) !== appPath) return false;
  }
  return true;
}

/**
 * Normalizes a new association through the settings lib (the single authority
 * on extension normalization) without touching real settings.
 *
 * @returns The `[normalizedExt, appPath]` pair, or `null` when the extension
 *   is invalid (empty once dots are stripped).
 */
function normalizeNewAssociation(ext: string, appPath: string): [string, string] | null {
  const probe: ParsedSettings = { raw: {}, associations: new Map() };
  try {
    setAssociation(probe, ext, appPath);
  } catch {
    return null;
  }
  const entry = probe.associations.entries().next();
  return entry.done ? null : entry.value;
}

/**
 * Editor for the launcher's file associations in `/_pico/settings.json`:
 * which application (usually an emulator) DSpico's launcher boots for each
 * ROM file extension. Edits accumulate in a local draft and are written back
 * to the SD card only when the user hits “Save to SD”; every other key of the
 * settings file is preserved verbatim.
 */
export function AssociationsView() {
  const { root, settings, refresh } = useSd();
  /** Local edits; `null` mirrors the settings from the SD card (pristine). */
  const [draft, setDraft] = useState<Map<string, string> | null>(null);
  const [newExt, setNewExt] = useState('');
  const [newPath, setNewPath] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!root) {
    return (
      <section className="associations-view">
        <h2>File associations</h2>
        <p className="associations-view__info">Open an SD card to edit file associations.</p>
      </section>
    );
  }

  if (!settings) {
    return (
      <section className="associations-view">
        <h2>File associations</h2>
        <p className="associations-view__info">
          No <code>settings.json</code> found — run Pico Launcher once on your DSpico so it creates{' '}
          <code>/_pico/settings.json</code>, then refresh.
        </p>
      </section>
    );
  }

  const shown = draft ?? settings.associations;
  const dirty = draft !== null && !associationsEqual(draft, settings.associations);
  const hasEmptyPath = [...shown.values()].some((appPath) => appPath.trim().length === 0);

  const mutateDraft = (mutate: (next: Map<string, string>) => void) => {
    setDraft((previous) => {
      const next = new Map(previous ?? settings.associations);
      mutate(next);
      return next;
    });
  };

  const handlePathChange = (ext: string, appPath: string) => {
    mutateDraft((next) => next.set(ext, appPath));
  };

  const handleRemove = (ext: string) => {
    mutateDraft((next) => next.delete(ext));
  };

  const handleAdd = () => {
    setAddError(null);
    const normalized = normalizeNewAssociation(newExt, newPath.trim());
    if (normalized === null) {
      setAddError('Enter a valid file extension (dots are ignored).');
      return;
    }
    const [ext, appPath] = normalized;
    mutateDraft((next) => next.set(ext, appPath));
    setNewExt('');
    setNewPath('');
  };

  const handleDiscard = () => {
    setDraft(null);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (draft === null || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const next: ParsedSettings = {
        raw: structuredClone(settings.raw),
        associations: new Map(settings.associations),
      };
      for (const ext of settings.associations.keys()) {
        if (!draft.has(ext)) removeAssociation(next, ext);
      }
      for (const [ext, appPath] of draft) {
        setAssociation(next, ext, appPath);
      }
      const text = serializeSettings(next);
      const picoDir = await getDir(root, [PICO_DIR]);
      if (picoDir === null) {
        throw new Error('The /_pico directory is missing from the SD card.');
      }
      await writeFileText(picoDir, SETTINGS_FILE, text);
      setDraft(null);
      await refresh();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="associations-view">
      <header>
        <h2>File associations</h2>
        <p className="associations-view__intro">
          Choose which application the launcher opens for each file extension. Stored in{' '}
          <code>/_pico/settings.json</code>.
        </p>
      </header>

      {shown.size === 0 ? (
        <p className="associations-view__info">No file associations yet — add one below.</p>
      ) : (
        <div className="associations-view__table-wrap">
          <table className="associations-view__table">
            <thead>
              <tr>
                <th scope="col">Extension</th>
                <th scope="col">Application path</th>
                <th scope="col">
                  <span className="associations-view__sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {[...shown.entries()].map(([ext, appPath]) => (
                <tr key={ext}>
                  <th scope="row">
                    <code>.{ext}</code>
                  </th>
                  <td>
                    <input
                      type="text"
                      className="associations-view__path-input"
                      value={appPath}
                      placeholder={EXAMPLE_PATHS[0]}
                      aria-label={`Application path for .${ext} files`}
                      onChange={(event) => handlePathChange(ext, event.target.value)}
                    />
                  </td>
                  <td className="associations-view__row-actions">
                    <button
                      type="button"
                      onClick={() => handleRemove(ext)}
                      aria-label={`Remove .${ext} association`}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form
        className="associations-view__add"
        onSubmit={(event) => {
          event.preventDefault();
          handleAdd();
        }}
      >
        <label className="associations-view__field associations-view__field--ext">
          <span>Extension</span>
          <input
            type="text"
            value={newExt}
            placeholder="nes"
            onChange={(event) => setNewExt(event.target.value)}
          />
        </label>
        <label className="associations-view__field associations-view__field--path">
          <span>Application path</span>
          <input
            type="text"
            className="associations-view__path-input"
            value={newPath}
            placeholder={EXAMPLE_PATHS[0]}
            onChange={(event) => setNewPath(event.target.value)}
          />
        </label>
        <button type="submit" disabled={newExt.trim().length === 0 || newPath.trim().length === 0}>
          Add
        </button>
      </form>
      {addError !== null && (
        <p className="associations-view__error" role="alert">
          {addError}
        </p>
      )}

      <p className="associations-view__hint">
        Enter the extension without the dot. Common emulator paths:{' '}
        {EXAMPLE_PATHS.map((path, index) => (
          <span key={path}>
            {index > 0 && ', '}
            <code>{path}</code>
          </span>
        ))}
        .
      </p>

      {dirty && (
        <div className="associations-view__save-bar card">
          <p className="associations-view__warning" role="status">
            The launcher reads associations at boot — restart your DS after saving for the changes
            to take effect.
          </p>
          {hasEmptyPath && (
            <p className="associations-view__error" role="alert">
              Application paths cannot be empty. Fill in or remove the blank rows.
            </p>
          )}
          {saveError !== null && (
            <p className="associations-view__error" role="alert">
              {saveError}
            </p>
          )}
          <div className="associations-view__save-actions">
            <button type="button" onClick={handleDiscard} disabled={saving}>
              Discard changes
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => void handleSave()}
              disabled={saving || hasEmptyPath}
            >
              {saving ? 'Saving…' : 'Save to SD'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
