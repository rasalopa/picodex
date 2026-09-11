/**
 * Picking a slice of a list around one of its items, for previews that show
 * an item among its real neighbours (the cover dialog's bottom-screen
 * mock-up shows the game with the names the launcher lists above and below).
 */

/** A slice of a list split around the item it was centred on. */
export interface ListWindow<T> {
  /** Items before it, nearest last. */
  before: T[];
  /** Items after it, nearest first. */
  after: T[];
}

/**
 * The `size` items around `index`, split into what comes before and after it
 * (the item itself is in neither list).
 *
 * The window keeps one item above when it can, and slides at the ends of the
 * list so it always holds `size` items while the list is long enough — a
 * preview that shows fewer rows near the top of a list reads as broken rather
 * than accurate.
 *
 * @param items - The list, in the order the user sees it.
 * @param index - Position of the item to centre on; out of range yields an
 *   empty window.
 * @param size - Items the window holds, the centred one included.
 */
export function windowAround<T>(items: readonly T[], index: number, size: number): ListWindow<T> {
  if (index < 0 || index >= items.length || size < 1) return { before: [], after: [] };
  const start = Math.max(0, Math.min(index - 1, items.length - size));
  const slice = items.slice(start, start + size);
  const at = index - start;
  return { before: slice.slice(0, at), after: slice.slice(at + 1) };
}
