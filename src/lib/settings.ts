/**
 * Reader/writer for the DSpico launcher settings file (`/_pico/settings.json`).
 *
 * The authoritative writer is the launcher's `JsonAppSettingsSerializer`
 * (ArduinoJson, 2048-byte pool). Known top-level keys are `language`,
 * `romBrowserLayout`, `romBrowserSortMode`, `theme`, `lastUsedFilePath` and
 * `fileAssociations`; the latter maps a file extension (stored WITHOUT the
 * leading dot, matched case-insensitively by the launcher) to an object of
 * shape `{ "appPath": string }`.
 *
 * PicoDex edits only `fileAssociations`. Every other top-level key — including
 * keys unknown to PicoDex that future launcher versions may add — is preserved
 * verbatim through a parse/serialize round-trip.
 */

/**
 * Result of {@link parseSettings}: the raw JSON document plus the file
 * associations extracted into an editable map.
 */
export interface ParsedSettings {
  /**
   * Every top-level key exactly as parsed, unknown keys included. The
   * `fileAssociations` entry present here is only the parsed snapshot; on
   * {@link serializeSettings} it is replaced by {@link associations}.
   */
  raw: Record<string, unknown>;
  /**
   * File extension (normalized: lowercase, no leading dot) mapped to the
   * application path launched for that extension.
   */
  associations: Map<string, string>;
}

/**
 * Normalizes a file extension the way the launcher matches it: without the
 * leading dot and lowercase (the launcher compares with `strcasecmp`).
 *
 * @throws {Error} If the extension is empty after normalization.
 */
function normalizeExtension(ext: string): string {
  let normalized = ext.trim().toLowerCase();
  while (normalized.startsWith('.')) {
    normalized = normalized.slice(1);
  }
  if (normalized.length === 0) {
    throw new Error(`Invalid file extension: ${JSON.stringify(ext)}`);
  }
  return normalized;
}

/** Narrows an unknown value to a plain (non-array, non-null) JSON object. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parses the text of `/_pico/settings.json`.
 *
 * Tolerant of a missing, `null` or empty `fileAssociations` object, and of
 * malformed association entries (a non-object value or a missing/non-string
 * `appPath` is skipped rather than rejected). Empty or whitespace-only input
 * is treated as an empty settings document, mirroring the launcher which
 * regenerates the file when it cannot be read.
 *
 * @param text - Raw JSON text of the settings file.
 * @returns The raw document plus the extracted associations map.
 * @throws {SyntaxError} If `text` is non-empty but not valid JSON.
 * @throws {Error} If the JSON root is not an object.
 */
export function parseSettings(text: string): ParsedSettings {
  if (text.trim().length === 0) {
    return { raw: {}, associations: new Map() };
  }

  const parsed: unknown = JSON.parse(text);
  if (!isPlainObject(parsed)) {
    throw new Error('settings.json root must be a JSON object');
  }

  const associations = new Map<string, string>();
  const rawAssociations = parsed['fileAssociations'];
  if (isPlainObject(rawAssociations)) {
    for (const [ext, entry] of Object.entries(rawAssociations)) {
      if (!isPlainObject(entry)) {
        continue;
      }
      const appPath = entry['appPath'];
      if (typeof appPath !== 'string') {
        continue;
      }
      let normalized: string;
      try {
        normalized = normalizeExtension(ext);
      } catch {
        continue; // Skip unusable keys such as "" or "."
      }
      associations.set(normalized, appPath);
    }
  }

  return { raw: parsed, associations };
}

/**
 * Adds or replaces the file association for `ext`.
 *
 * @param parsed - Settings previously returned by {@link parseSettings}.
 * @param ext - File extension, with or without leading dot, any case.
 * @param appPath - SD-card path of the application to launch (e.g.
 *   `/apps/gbarunner2.nds`).
 * @throws {Error} If `ext` is empty after normalization.
 */
export function setAssociation(parsed: ParsedSettings, ext: string, appPath: string): void {
  parsed.associations.set(normalizeExtension(ext), appPath);
}

/**
 * Removes the file association for `ext`, if present.
 *
 * @param parsed - Settings previously returned by {@link parseSettings}.
 * @param ext - File extension, with or without leading dot, any case.
 * @returns `true` if an association existed and was removed.
 */
export function removeAssociation(parsed: ParsedSettings, ext: string): boolean {
  let normalized: string;
  try {
    normalized = normalizeExtension(ext);
  } catch {
    return false;
  }
  return parsed.associations.delete(normalized);
}

/**
 * Serializes settings back to JSON text for `/_pico/settings.json`.
 *
 * All top-level keys of {@link ParsedSettings.raw} are re-emitted in their
 * original order; `fileAssociations` is rebuilt from
 * {@link ParsedSettings.associations} (appended at the end when the original
 * document had none). Output is pretty-printed with 4-space indentation — the
 * launcher reparses any valid JSON.
 *
 * @param parsed - Settings previously returned by {@link parseSettings}.
 * @returns Pretty-printed JSON text.
 */
export function serializeSettings(parsed: ParsedSettings): string {
  const fileAssociations: Record<string, { appPath: string }> = {};
  for (const [ext, appPath] of parsed.associations) {
    fileAssociations[ext] = { appPath };
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.raw)) {
    output[key] = key === 'fileAssociations' ? fileAssociations : value;
  }
  if (!('fileAssociations' in output)) {
    output['fileAssociations'] = fileAssociations;
  }

  return JSON.stringify(output, null, 4);
}
