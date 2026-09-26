/**
 * Finds the strings of a translation that are older than the English text
 * they were translated from, going by when git last changed each line.
 *
 * Used by scripts/i18n-outdated.mjs. The English copy changes all the time;
 * this is what keeps a translation from quietly saying something the English
 * no longer says.
 */

/** One line of a file and when git last changed it, in seconds. */
export interface BlamedLine {
  text: string;
  time: number;
}

/** A key whose translation was last changed before its English text. */
export interface OutdatedKey {
  key: string;
  english: number;
  translated: number;
}

/**
 * The language tag of a translation file name: `es.ts` gives `es`, `pt-BR.ts`
 * gives `pt-BR`. Null for any other file, including the English source.
 */
export function translationTag(fileName: string): string | null {
  const match = /^([a-z]{2,3}(?:-[A-Za-z]{2,4})?)\.ts$/.exec(fileName);
  return match === null || match[1] === 'en' ? null : match[1];
}

/** Reads the output of `git blame --porcelain` into lines with their times. */
export function parseBlame(porcelain: string): BlamedLine[] {
  const commitTimes = new Map<string, number>();
  const lines: BlamedLine[] = [];
  let commit = '';
  for (const row of porcelain.split('\n')) {
    if (row.startsWith('\t')) {
      lines.push({ text: row.slice(1), time: commitTimes.get(commit) ?? 0 });
      continue;
    }
    const header = /^([0-9a-f]{40}) \d+ \d+/.exec(row);
    if (header) {
      commit = header[1];
    } else if (row.startsWith('committer-time ')) {
      commitTimes.set(commit, Number(row.slice('committer-time '.length)));
    }
  }
  return lines;
}

/**
 * Maps every string key of a dictionary file (`app.tabs.library`, ...) to the
 * newest time any of its lines changed. Expects the layout Prettier gives the
 * dictionaries: one key per line (quoted or not), nested objects opened by
 * `key: {`, and a value that goes on over more deeply indented lines.
 */
export function keyTimes(lines: BlamedLine[]): Map<string, number> {
  const times = new Map<string, number>();
  const sections: { name: string; indent: number }[] = [];
  let current: { key: string; indent: number } | null = null;
  for (const { text, time } of lines) {
    const trimmed = text.trim();
    if (
      trimmed === '' ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*')
    ) {
      continue;
    }
    const indent = text.length - text.trimStart().length;
    // The rest of a value: a deeper line, or the bracket that closes a
    // function's arguments or body at the key's own indent.
    if (
      current &&
      (indent > current.indent || (indent === current.indent && /^[)\]}]/.test(trimmed)))
    ) {
      times.set(current.key, Math.max(times.get(current.key) ?? 0, time));
      continue;
    }
    current = null;
    while (sections.length > 0 && sections[sections.length - 1].indent >= indent) {
      sections.pop();
    }
    const match = /^(?:([A-Za-z_$][\w$]*)|'([^']+)'|"([^"]+)")\s*:(.*)$/.exec(trimmed);
    if (!match) {
      continue;
    }
    const name = match[1] ?? match[2] ?? match[3];
    const rest = match[4];
    if (rest.trim() === '{') {
      sections.push({ name, indent });
      continue;
    }
    const key = [...sections.map((section) => section.name), name].join('.');
    current = { key, indent };
    times.set(key, time);
  }
  return times;
}

/**
 * Compares the key times of a translation with those of the English file.
 *
 * @returns The keys translated before their English text last changed, and
 *   the English keys the translation does not have (they show in English).
 */
export function compareTranslation(
  english: Map<string, number>,
  translation: Map<string, number>,
): { outdated: OutdatedKey[]; untranslated: string[] } {
  const outdated: OutdatedKey[] = [];
  const untranslated: string[] = [];
  for (const [key, time] of english) {
    const translated = translation.get(key);
    if (translated === undefined) {
      untranslated.push(key);
    } else if (translated < time) {
      outdated.push({ key, english: time, translated });
    }
  }
  return { outdated, untranslated };
}
