import { describe, expect, it } from 'vitest';
import { en } from './en';
import { es } from './es';
import type { Dict } from './en';

/**
 * Some sentences are split in two so a `<strong>` can sit between the halves — `releasesBehind1`
 * plus a version plus `releasesBehind2`, and fifteen more like it. The JSX around them carries no
 * padding, so the space has to live inside the strings, and Spanish lost one: `releasesBehind1`
 * ended with a letter, so Health read "2 versiones por detrás dev1.7.1", glued together.
 *
 * What is under test is only that nothing ends up glued to the interpolated value. Not that the two
 * languages match — they must not. The split exists precisely so word order can differ: English
 * says "the R4 build" and Spanish "build R4", and Spanish puts "Falta " in a first half that English
 * leaves empty. Comparing the languages to each other flags all of that as broken, which is how the
 * first version of this test managed to fail on two sentences that were perfectly correct.
 */

type Bag = Record<string, unknown>;

/** Punctuation that may legitimately touch the value in front of it, with no space. */
const ATTACHING = /^[.,;:!?)\]}»…]/;

/** Every `X1`/`X2` pair in a dictionary, as dotted paths, found by walking rather than by list. */
function splitPairs(dict: Bag, prefix = ''): string[] {
  const found: string[] = [];
  for (const [key, value] of Object.entries(dict)) {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    if (value !== null && typeof value === 'object') {
      found.push(...splitPairs(value as Bag, path));
    } else if (/1$/.test(key) && `${key.slice(0, -1)}2` in dict) {
      found.push(path);
    }
  }
  return found;
}

function at(dict: Bag, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => (node as Bag)?.[key], dict);
}

/**
 * The rendered text of one half. A function here takes counts and names; any argument does, because
 * only the padding at the edges is under test and never the wording.
 */
function render(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'function') {
    const f = value as (...args: unknown[]) => unknown;
    return String(f(...Array.from({ length: f.length }, () => 1)));
  }
  return String(value);
}

const LANGUAGES: ReadonlyArray<readonly [string, Dict]> = [
  ['en', en],
  ['es', es],
];

describe('a split sentence never glues itself to the value between its halves', () => {
  const pairs = splitPairs(en as unknown as Bag);

  it('finds the pairs at all, so a green run means something', () => {
    expect(pairs.length).toBeGreaterThan(10);
    expect(pairs).toContain('health.releasesBehind1');
  });

  for (const [name, dict] of LANGUAGES) {
    it.each(pairs)(`${name}: %s leaves room before the value`, (path) => {
      const first = render(at(dict as unknown as Bag, path));
      // Empty is fine: it means this language does not use the slot at all.
      if (first === '') {
        return;
      }
      expect(/\s$/.test(first), `${name}.${path} ends with "${first.slice(-12)}"`).toBe(true);
    });

    it.each(pairs)(`${name}: %s leaves room after the value`, (path) => {
      const second = render(at(dict as unknown as Bag, `${path.slice(0, -1)}2`));
      if (second === '') {
        return;
      }
      const ok = /^\s/.test(second) || ATTACHING.test(second);
      expect(ok, `${name}.${path.slice(0, -1)}2 starts with "${second.slice(0, 12)}"`).toBe(true);
    });
  }
});
