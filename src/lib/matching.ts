/**
 * Boxart title matcher for the libretro-thumbnails (No-Intro) catalogs.
 *
 * Port of `norm()` + `pick()` from the authoritative Python tools
 * (`tools/fetch_covers.py` / `tools/fetch_covers_gba.py` in pico-enhanced),
 * including the "prefix before fuzzy" fix: `difflib`-style fuzzy matching
 * confuses numbered sequels ("Megaman Zero 1" vs "Megaman Zero 4"), so a
 * whole-word prefix relation between normalized keys is checked first.
 *
 * One refinement over the Python reference: the prefix fallback only wins
 * *before* fuzzy when the prefix key itself is similar enough to the title
 * (ratio >= 0.85). A short generic prefix ("golden sun") must not shadow a
 * much closer fuzzy candidate ("golden sun edad perdida"); yet the prefix
 * relation is kept as a last resort for titles whose subtitle makes every
 * ratio low ("Phalanx - The Enforce Fighter A-144" -> "Phalanx (Europe)").
 */

/** Minimum {@link similarityRatio} for a fuzzy (or pre-fuzzy prefix) match. */
const FUZZY_CUTOFF = 0.85;

/**
 * Default region-preference list (substring probes against catalog file
 * names, e.g. `'(Europe'`), used when the GBA gamecode region letter is
 * unknown. Ported from `DEFAULT_PREF` in `fetch_covers_gba.py`.
 */
export const DEFAULT_REGION_PREFS: readonly string[] = ['(Europe', '(USA', '(World'];

/**
 * Region-preference lists keyed by the 4th letter of a GBA gamecode (header
 * offset 0xAC), which encodes the cartridge region. Ported from
 * `REGION_PREF` in `fetch_covers_gba.py`. Fall back to
 * {@link DEFAULT_REGION_PREFS} for letters not present here.
 */
export const REGION_PREFS_BY_GBA_CODE: Readonly<Record<string, readonly string[]>> = {
  E: ['(USA', '(World', '(Europe'],
  P: ['(Europe', '(World', '(USA'],
  S: ['(Spain', '(Europe', '(USA'],
  F: ['(France', '(Europe', '(USA'],
  D: ['(Germany', '(Europe', '(USA'],
  I: ['(Italy', '(Europe', '(USA'],
  J: ['(Japan', '(USA', '(Europe'],
};

/**
 * Normalizes a game title into a comparison key, mirroring the Python
 * `norm()`: NFKD-decompose and drop every non-ASCII code point (strips
 * diacritics), remove parenthesized groups (`(USA)`, `(Rev 1)`, ...),
 * lowercase, turn every non-alphanumeric run into a single space, drop
 * leading articles in English and Spanish (the, a, an, el, la, los, las) as
 * whole words, and collapse whitespace.
 *
 * @example normalizeTitle('The Legend of Zelda - A Link to the Past')
 *          // => 'legend of zelda link to past'
 */
export function normalizeTitle(s: string): string {
  // keep ASCII only, like python's encode('ascii', 'ignore')
  let t = '';
  for (const ch of s.normalize('NFKD')) {
    if (ch.codePointAt(0)! <= 0x7f) t += ch;
  }
  t = t.replace(/\(.*?\)/g, '');
  t = t.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  t = t.replace(/\b(?:the|a|an|el|la|los|las)\b/g, ' ');
  return t.split(/\s+/).filter(Boolean).join(' ');
}

/** Maps each UTF-16 code unit of `b` to its ascending list of indices. */
function buildCharIndex(b: string): Map<number, number[]> {
  const b2j = new Map<number, number[]>();
  for (let j = 0; j < b.length; j++) {
    const code = b.charCodeAt(j);
    const list = b2j.get(code);
    if (list) {
      list.push(j);
    } else {
      b2j.set(code, [j]);
    }
  }
  return b2j;
}

/**
 * `difflib.SequenceMatcher.find_longest_match` without the junk heuristic:
 * returns `[besti, bestj, bestsize]`, the longest block where
 * `a[besti .. besti+bestsize) === b[bestj .. bestj+bestsize)` within the
 * given slices, preferring the earliest `besti` then earliest `bestj`.
 */
function findLongestMatch(
  a: string,
  b: string,
  b2j: Map<number, number[]>,
  alo: number,
  ahi: number,
  blo: number,
  bhi: number,
): [number, number, number] {
  let besti = alo;
  let bestj = blo;
  let bestsize = 0;
  // j2len[j] = length of the longest match ending at a[i], b[j].
  let j2len = new Map<number, number>();
  for (let i = alo; i < ahi; i++) {
    const newJ2len = new Map<number, number>();
    const indices = b2j.get(a.charCodeAt(i));
    if (indices) {
      for (const j of indices) {
        if (j < blo) continue;
        if (j >= bhi) break; // indices are ascending
        const k = (j2len.get(j - 1) ?? 0) + 1;
        newJ2len.set(j, k);
        if (k > bestsize) {
          besti = i - k + 1;
          bestj = j - k + 1;
          bestsize = k;
        }
      }
    }
    j2len = newJ2len;
  }
  // Extend with equal elements on both sides (difflib's non-junk extension).
  while (besti > alo && bestj > blo && a.charCodeAt(besti - 1) === b.charCodeAt(bestj - 1)) {
    besti--;
    bestj--;
    bestsize++;
  }
  while (
    besti + bestsize < ahi &&
    bestj + bestsize < bhi &&
    a.charCodeAt(besti + bestsize) === b.charCodeAt(bestj + bestsize)
  ) {
    bestsize++;
  }
  return [besti, bestj, bestsize];
}

/**
 * Similarity of two strings in `[0, 1]`, equivalent to Python
 * `difflib.SequenceMatcher(None, a, b).ratio()` (no junk/autojunk):
 * `2 * M / (a.length + b.length)` where `M` is the total length of the
 * matching blocks found by recursively splitting around the longest common
 * substring. Two empty strings yield `1`. Operates on UTF-16 code units,
 * which matches Python code points for the ASCII keys produced by
 * {@link normalizeTitle}.
 */
export function similarityRatio(a: string, b: string): number {
  const total = a.length + b.length;
  if (total === 0) return 1;
  const b2j = buildCharIndex(b);
  // Iterative equivalent of difflib.get_matching_blocks(), summing sizes.
  let matched = 0;
  const queue: Array<[number, number, number, number]> = [[0, a.length, 0, b.length]];
  while (queue.length > 0) {
    const [alo, ahi, blo, bhi] = queue.pop() as [number, number, number, number];
    const [i, j, k] = findLongestMatch(a, b, b2j, alo, ahi, blo, bhi);
    if (k > 0) {
      matched += k;
      if (alo < i && blo < j) queue.push([alo, i, blo, j]);
      if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi]);
    }
  }
  return (2 * matched) / total;
}

/**
 * Picks the best boxart file name from a libretro-thumbnails catalog for a
 * ROM title, or `null` when nothing matches.
 *
 * Matching pipeline over normalized keys ({@link normalizeTitle}; catalog
 * entries are normalized with their `.png` extension stripped):
 * 1. exact normalized match;
 * 2. longest whole-word prefix relation (`key` starts with `k + ' '` or `k`
 *    starts with `key + ' '`) — taken immediately only when
 *    `similarityRatio(key, k) >= 0.85`, so numbered sequels resolve to their
 *    base title before fuzzy can mismatch them;
 * 3. best fuzzy match with `similarityRatio >= 0.85` (ties keep the earliest
 *    catalog key);
 * 4. the deferred prefix relation from step 2, if any, as a last resort.
 *
 * Among the candidate files sharing the winning key, the first entry
 * containing a region preference substring wins ({@link DEFAULT_REGION_PREFS}
 * / {@link REGION_PREFS_BY_GBA_CODE}); otherwise the first candidate.
 *
 * @param title ROM title (file name without extension).
 * @param catalog Boxart file names, e.g. `'Golden Sun (USA).png'`.
 * @param regionPrefs Ordered region probes, e.g. `['(Europe', '(USA']`.
 */
export function pickBoxart(
  title: string,
  catalog: readonly string[],
  regionPrefs: readonly string[],
): string | null {
  const byNorm = new Map<string, string[]>();
  for (const entry of catalog) {
    const base = entry.toLowerCase().endsWith('.png') ? entry.slice(0, -4) : entry;
    const key = normalizeTitle(base);
    const list = byNorm.get(key);
    if (list) {
      list.push(entry);
    } else {
      byNorm.set(key, [entry]);
    }
  }

  const key = normalizeTitle(title);
  let candidates = byNorm.get(key);

  let prefixKey: string | null = null;
  if (!candidates) {
    for (const k of byNorm.keys()) {
      if (key.startsWith(k + ' ') || k.startsWith(key + ' ')) {
        if (prefixKey === null || k.length > prefixKey.length) {
          prefixKey = k;
        }
      }
    }
    if (prefixKey !== null && similarityRatio(key, prefixKey) >= FUZZY_CUTOFF) {
      candidates = byNorm.get(prefixKey);
    }
  }

  if (!candidates) {
    let bestKey: string | null = null;
    let bestRatio = 0;
    for (const k of byNorm.keys()) {
      const ratio = similarityRatio(key, k);
      if (ratio >= FUZZY_CUTOFF && ratio > bestRatio) {
        bestKey = k;
        bestRatio = ratio;
      }
    }
    if (bestKey !== null) {
      candidates = byNorm.get(bestKey);
    }
  }

  if (!candidates && prefixKey !== null) {
    candidates = byNorm.get(prefixKey);
  }
  if (!candidates || candidates.length === 0) {
    return null;
  }

  for (const pref of regionPrefs) {
    for (const candidate of candidates) {
      if (candidate.includes(pref)) {
        return candidate;
      }
    }
  }
  return candidates[0] ?? null;
}
