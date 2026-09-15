/**
 * Reading the launcher's screenshot folder, `/_pico/screenshots`.
 *
 * Holding START saves both screens of one moment as two files that share a
 * number, `shotNNN_top.bmp` and `shotNNN_bot.bmp` (24bpp, 256x192 each). The
 * two halves are written one after the other, so a card can hold a lone half
 * when a write failed or the console was pulled in between, and an older build
 * of the fork wrote a single `shotNNN.bmp` instead. Everything in the folder is
 * shown either way — a picture the user cannot see is a picture they cannot
 * delete.
 */

/** One capture: the screens of a moment, or whatever of it reached the card. */
export interface Shot {
  /** Stable key: the capture number, or the file name for anything unnumbered. */
  id: string;
  /** Capture number from `shotNNN`, `null` when the name follows no pattern. */
  number: number | null;
  /** File name of the top screen, `null` when the card has no top half. */
  top: string | null;
  /** File name of the bottom screen, `null` when the card has no bottom half. */
  bottom: string | null;
}

/** `shotNNN_top.bmp` / `shotNNN_bot.bmp`, in any case: FAT ignores it. */
const HALF = /^shot(\d+)_(top|bot)\.bmp$/i;

/** Anything the browser can decode as one of our BMPs. */
const BMP = /\.bmp$/i;

/**
 * Groups a screenshot folder listing into captures.
 *
 * Numbered captures come first, in capture order; anything else follows by
 * name, each on its own. Files that are not BMPs, and the `._` and `.DS_Store`
 * leftovers macOS scatters, are left out.
 *
 * @param names - File names in `/_pico/screenshots`, in any order.
 */
export function groupScreenshots(names: readonly string[]): Shot[] {
  const numbered = new Map<number, Shot>();
  const loose: Shot[] = [];

  for (const name of names) {
    if (name.startsWith('.') || !BMP.test(name)) continue;
    const half = HALF.exec(name);
    if (half === null) {
      loose.push({ id: name, number: null, top: name, bottom: null });
      continue;
    }
    const number = Number(half[1]);
    let shot = numbered.get(number);
    if (shot === undefined) {
      shot = { id: half[1], number, top: null, bottom: null };
      numbered.set(number, shot);
    }
    if (half[2].toLowerCase() === 'top') {
      shot.top = name;
    } else {
      shot.bottom = name;
    }
  }

  return [
    ...[...numbered.values()].sort((a, b) => (a.number ?? 0) - (b.number ?? 0)),
    ...loose.sort((a, b) => a.id.localeCompare(b.id)),
  ];
}

/**
 * What to call a capture once it has been saved out as a PNG.
 *
 * A whole capture keeps the number the card gave it, `shot007.png`; a lone
 * half says which screen it is, so two files saved from the same folder cannot
 * collide; anything unnumbered keeps its own name with a new extension.
 */
/**
 * The capture `delta` places away from `current`, or `null` past either end.
 *
 * The gallery hands this the captures it can actually show, so paging skips
 * the ones whose files could not be read rather than stopping on them.
 *
 * @param ids - Capture ids in the order they are shown.
 * @param current - Id of the capture on screen.
 * @param delta - How far to move, usually -1 or 1.
 */
export function shotAt(ids: readonly string[], current: string, delta: number): string | null {
  const index = ids.indexOf(current);
  if (index === -1) return null;
  const next = index + delta;
  return next >= 0 && next < ids.length ? ids[next] : null;
}

export function screenshotFileName(shot: Shot): string {
  if (shot.number === null) return `${shot.id.replace(BMP, '')}.png`;
  const half = shot.top === null ? '_bot' : shot.bottom === null ? '_top' : '';
  return `shot${shot.id}${half}.png`;
}
