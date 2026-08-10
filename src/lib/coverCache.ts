/**
 * Keeps the decoded cover previews the gallery shows, so opening a system does
 * not read and decode every BMP off the card again.
 *
 * The covers live on the card as BMP files; turning one into something the page
 * can show means reading its bytes and decoding them on a canvas, and the
 * gallery did that for every game each time it opened. The result is the same
 * until the file changes, so it is worth storing.
 *
 * An entry is tied to the file that produced it by size and last-modified time,
 * so rewriting a cover — which moves its mtime — normally drops the old entry
 * with no separate step to clear anything. Two caveats keep this from being a
 * guarantee: launcher covers are a fixed size, so size never discriminates, and
 * FAT times have 2-second granularity, so an overwrite landing in the same
 * 2-second window as the cached mtime would go unnoticed. In practice a rewrite
 * lands seconds or longer later, so this is a corner, not the common case.
 *
 * Entries are scoped to a card and a cover folder so a game whose name collides
 * with a gamecode does not read the other's picture. The card scope is only
 * best-effort: it uses the volume label, so two cards both labelled the same
 * (a blank or "NO NAME" default) can, if they hold a same-named cover with a
 * matching size and mtime, show one card's preview on the other. The mismatch
 * is cosmetic — the wrong preview is never written back to the card.
 */

import { COVER_STORE, withStore } from './idb';

interface StoredCover {
  /** The decoded preview, as a PNG blob. */
  blob: Blob;
  /** The source file's last-modified time, to notice it changing. */
  lastModified: number;
  /** The source file's size, likewise (weak on its own — covers are fixed size). */
  size: number;
}

/** Which cover folder a file came from, so their namespaces stay apart. */
export type CoverSlot = 'user' | 'nds' | 'gba';

function keyOf(cardTag: string, slot: CoverSlot, coverName: string): string {
  // NUL cannot appear in a FAT file name or a card label, so it is a separator
  // no real value can smuggle a collision through.
  return [cardTag, slot, coverName].join('\u0000');
}

function isStoredCover(value: unknown): value is StoredCover {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as StoredCover;
  return (
    candidate.blob instanceof Blob &&
    typeof candidate.lastModified === 'number' &&
    Number.isFinite(candidate.lastModified) &&
    typeof candidate.size === 'number' &&
    Number.isFinite(candidate.size)
  );
}

/**
 * Returns the stored preview for a cover file, or null when there is none or
 * the file on the card no longer matches the one it was made from.
 *
 * @param cardTag Best-effort identity of the card (its folder label).
 * @param slot Which cover folder the file lives in.
 * @param coverName The cover file's name.
 * @param file The file as it is on the card now, for the size/time comparison.
 */
export async function readCachedCover(
  cardTag: string,
  slot: CoverSlot,
  coverName: string,
  file: File,
): Promise<Blob | null> {
  const stored = await withStore<unknown>(COVER_STORE, 'readonly', (store) =>
    store.get(keyOf(cardTag, slot, coverName)),
  );
  if (!isStoredCover(stored)) return null;
  if (stored.lastModified !== file.lastModified || stored.size !== file.size) return null;
  return stored.blob;
}

/** Stores `blob` as the preview for a cover file, tied to its size and time. */
export async function writeCachedCover(
  cardTag: string,
  slot: CoverSlot,
  coverName: string,
  file: File,
  blob: Blob,
): Promise<void> {
  const record: StoredCover = { blob, lastModified: file.lastModified, size: file.size };
  await withStore(COVER_STORE, 'readwrite', (store) =>
    store.put(record, keyOf(cardTag, slot, coverName)),
  );
}
