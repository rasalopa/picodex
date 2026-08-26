/**
 * The language registry: the one place that knows which languages exist.
 *
 * A translation does not have to be finished to ship. `Translation<Dict>` makes
 * every key optional, and {@link fill} lays the translation over English at load
 * time, so whatever is missing reads in English instead of showing a blank label.
 * That is the whole point: a new language never blocks a release, and a release
 * never waits on a translator.
 *
 * English must be complete, because it is what everything falls back to. Spanish
 * chooses to be: `es.ts` annotates itself `: Dict`, so the compiler refuses a
 * missing key there. That is a per-language decision, not a rule - a language
 * kept complete says so in its own file, and one that is not simply falls back.
 *
 * Adding a language is two edits: a file next to this one, and a line in
 * {@link REGISTRY}. Nothing downstream names a language - the type, the footer
 * switch and the browser detection are all derived from the registry.
 */
import { en, type Dict } from './en';
import { es } from './es';

/**
 * A partially translated dictionary: same shape as {@link Dict}, every key
 * optional, functions kept whole. A function takes a value and builds a sentence
 * around it, so it cannot be half-translated - it is either provided or it is not.
 */
export type Translation<T> = {
  [K in keyof T]?: T[K] extends (...args: never[]) => unknown
    ? T[K]
    : T[K] extends object
      ? Translation<T[K]>
      : T[K];
};

interface Entry {
  /** What the footer button shows. */
  label: string;
  /** Absent for English, which is the fallback rather than a translation of it. */
  translation?: Translation<Dict>;
}

/**
 * Every language the app offers, in the order the footer shows them.
 *
 * Keys are BCP-47 tags, because the tag is also what `Intl` formats dates with
 * and what the page declares as its language - so `pt-BR` is a valid key, not
 * just `pt`.
 */
const REGISTRY = {
  en: { label: 'EN' },
  es: { label: 'ES', translation: es },
} satisfies Record<string, Entry>;

/** The languages that exist, derived - never written out by hand. */
export type Lang = keyof typeof REGISTRY;

/** The footer switch maps over this instead of hardcoding a button per language. */
export const LANGUAGES: readonly { code: Lang; label: string }[] = Object.entries(REGISTRY).map(
  ([code, entry]) => ({ code: code as Lang, label: (entry as Entry).label }),
);

function isBranch(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * English with a translation laid over it, key by key.
 *
 * Only `undefined` counts as untranslated. An empty string is a real answer: the
 * split sentences exist so word order can move, and English itself stores `''`
 * for a first half that only Spanish needs. Treating `''` as missing would
 * silently paste the English half back in.
 *
 * A key the translation has but English does not is dropped. Nothing can render
 * it, and after a key is renamed a stale translation would otherwise carry the
 * old one around forever.
 */
export function fill<T extends object>(base: T, over: Translation<T>): T {
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(over as Record<string, unknown>)) {
    if (value === undefined || !(key in out)) continue;
    const fallback = out[key];
    const bothBranches =
      isBranch(value) &&
      isBranch(fallback) &&
      typeof value !== 'function' &&
      typeof fallback !== 'function';
    out[key] = bothBranches
      ? fill(fallback as object, value as Translation<object>)
      : (value as unknown);
  }
  return out as T;
}

const DICTS = Object.fromEntries(
  Object.entries(REGISTRY).map(([code, entry]) => {
    const { translation } = entry as Entry;
    return [code, translation === undefined ? en : fill(en, translation)];
  }),
) as Record<Lang, Dict>;

/** The complete dictionary for a language, English filling any gap. */
export function dictFor(lang: Lang): Dict {
  return DICTS[lang];
}

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && value in REGISTRY;
}

/**
 * Which language to open in: an explicit choice from a previous visit wins
 * forever, otherwise the browser decides.
 *
 * The browser is matched on the full tag first and the base tag second, so a
 * `pt-BR` reader gets Brazilian Portuguese when it exists and plain `pt` when
 * only that does. Anything unrecognised lands on English.
 */
export function pickLang(stored: string | null, browser: string | undefined): Lang {
  if (isLang(stored)) return stored;
  const tag = browser?.toLowerCase() ?? '';
  if (tag === '') return 'en';
  const codes = LANGUAGES.map(({ code }) => code);
  const exact = codes.find((code) => code.toLowerCase() === tag);
  if (exact !== undefined) return exact;
  const base = tag.split('-')[0];
  return codes.find((code) => code.toLowerCase().split('-')[0] === base) ?? 'en';
}
