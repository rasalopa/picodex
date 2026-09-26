import { describe, expect, it } from 'vitest';
import {
  compareTranslation,
  keyTimes,
  parseBlame,
  translationTag,
  type BlamedLine,
} from './outdated';

/** Lines of a dictionary, each changed at the time given before the `|`. */
function blamed(source: string): BlamedLine[] {
  return source.split('\n').map((row) => {
    const bar = row.indexOf('|');
    return { time: Number(row.slice(0, bar)), text: row.slice(bar + 1) };
  });
}

describe('parseBlame', () => {
  it('gives every line the committer time of its commit, also when the header is not repeated', () => {
    const a = 'a'.repeat(40);
    const b = 'b'.repeat(40);
    const porcelain = [
      `${a} 1 1 1`,
      'author-time 100',
      'committer-time 150',
      '\tfirst',
      `${b} 2 2 1`,
      'committer-time 300',
      '\tsecond',
      `${a} 3 3 1`,
      '\tthird',
    ].join('\n');
    expect(parseBlame(porcelain)).toEqual([
      { text: 'first', time: 150 },
      { text: 'second', time: 300 },
      { text: 'third', time: 150 },
    ]);
  });
});

describe('keyTimes', () => {
  it('names nested keys and takes the newest line of a value that spans several', () => {
    const times = keyTimes(
      blamed(`1|export const en = {
1|  app: {
2|    title: 'PicoDex',
1|    tabs: {
3|      library: 'Library',
1|    },
1|    // a comment is not a key
1|
4|    long:
9|      'a value on the next line',
1|    count: (n: number) => {
1|      if (n === 1) return 'one';
7|      return 'many';
1|    },
1|  },
5|  health: {
6|    title: 'Card health',
1|  },
1|};`),
    );
    expect(Object.fromEntries(times)).toEqual({
      'app.title': 2,
      'app.tabs.library': 3,
      'app.long': 9,
      'app.count': 7,
      'health.title': 6,
    });
  });

  it('reads a quoted key like any other', () => {
    const times = keyTimes(
      blamed(`1|  jobStatus: {
2|    pending: 'Pending',
3|    'no-match': 'No match',
1|  },`),
    );
    expect(times.get('jobStatus.no-match')).toBe(3);
  });

  it('keeps the arguments of a function split over lines with its key', () => {
    const times = keyTimes(
      blamed(`1|  health: {
2|    mixed: (
2|      kind: string,
2|    ) =>
8|      \`a \${kind}\`,
3|    next: 'x',
1|  },`),
    );
    expect(times.get('health.mixed')).toBe(8);
    expect(times.get('health.next')).toBe(3);
  });
});

describe('translationTag', () => {
  it('reads two-letter, three-letter and regional tags, and skips everything else', () => {
    expect(translationTag('es.ts')).toBe('es');
    expect(translationTag('fil.ts')).toBe('fil');
    expect(translationTag('pt-BR.ts')).toBe('pt-BR');
    expect(translationTag('en.ts')).toBeNull();
    expect(translationTag('languages.ts')).toBeNull();
    expect(translationTag('outdated.test.ts')).toBeNull();
  });
});

describe('compareTranslation', () => {
  it('lists a string whose English changed after it was translated, and one never translated', () => {
    const english = new Map([
      ['a', 10],
      ['b', 20],
      ['c', 30],
    ]);
    const translation = new Map([
      ['a', 15],
      ['b', 5],
    ]);
    expect(compareTranslation(english, translation)).toEqual({
      outdated: [{ key: 'b', english: 20, translated: 5 }],
      untranslated: ['c'],
    });
  });
});
