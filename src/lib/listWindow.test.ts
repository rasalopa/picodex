import { describe, expect, it } from 'vitest';
import { windowAround } from './listWindow';

const list = ['a', 'b', 'c', 'd', 'e', 'f'];

describe('windowAround', () => {
  it('keeps one item above and fills the rest below', () => {
    expect(windowAround(list, 2, 4)).toEqual({ before: ['b'], after: ['d', 'e'] });
  });

  it('slides at the start so the window stays full', () => {
    expect(windowAround(list, 0, 4)).toEqual({ before: [], after: ['b', 'c', 'd'] });
  });

  it('slides at the end so the window stays full', () => {
    expect(windowAround(list, 5, 4)).toEqual({ before: ['c', 'd', 'e'], after: [] });
    expect(windowAround(list, 4, 4)).toEqual({ before: ['c', 'd'], after: ['f'] });
  });

  it('returns what there is when the list is shorter than the window', () => {
    expect(windowAround(['a', 'b'], 0, 4)).toEqual({ before: [], after: ['b'] });
    expect(windowAround(['a', 'b'], 1, 4)).toEqual({ before: ['a'], after: [] });
    expect(windowAround(['a'], 0, 4)).toEqual({ before: [], after: [] });
  });

  it('never includes the centred item in either side', () => {
    for (let i = 0; i < list.length; i++) {
      const { before, after } = windowAround(list, i, 4);
      expect(before).not.toContain(list[i]);
      expect(after).not.toContain(list[i]);
      expect(before.length + after.length).toBe(Math.min(4, list.length) - 1);
    }
  });

  it('yields an empty window for an index out of range or a size below one', () => {
    expect(windowAround(list, -1, 4)).toEqual({ before: [], after: [] });
    expect(windowAround(list, 6, 4)).toEqual({ before: [], after: [] });
    expect(windowAround([], 0, 4)).toEqual({ before: [], after: [] });
    expect(windowAround(list, 2, 0)).toEqual({ before: [], after: [] });
  });
});
