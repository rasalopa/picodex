import { describe, expect, it } from 'vitest';
import { groupScreenshots, screenshotFileName, shotAt } from './screenshots';

describe('groupScreenshots', () => {
  it('pairs the two halves the launcher writes for one capture', () => {
    expect(groupScreenshots(['shot000_top.bmp', 'shot000_bot.bmp'])).toEqual([
      { id: '000', number: 0, top: 'shot000_top.bmp', bottom: 'shot000_bot.bmp' },
    ]);
  });

  it('keeps a half whose partner never made it to the card', () => {
    expect(groupScreenshots(['shot008_top.bmp', 'shot009_bot.bmp'])).toEqual([
      { id: '008', number: 8, top: 'shot008_top.bmp', bottom: null },
      { id: '009', number: 9, top: null, bottom: 'shot009_bot.bmp' },
    ]);
  });

  it('orders by capture number, not by file name', () => {
    const names = ['shot010_top.bmp', 'shot002_top.bmp', 'shot100_top.bmp'];
    expect(groupScreenshots(names).map((s) => s.number)).toEqual([2, 10, 100]);
  });

  it('matches the launcher naming whatever the case, since FAT ignores it', () => {
    expect(groupScreenshots(['SHOT003_TOP.BMP', 'Shot003_Bot.bmp'])).toEqual([
      { id: '003', number: 3, top: 'SHOT003_TOP.BMP', bottom: 'Shot003_Bot.bmp' },
    ]);
  });

  it('shows a bmp that follows no naming on its own, after the numbered ones', () => {
    // an older fork wrote shotNNN.bmp with no suffix, and a user can drop
    // anything into the folder; both are still pictures worth showing
    const shots = groupScreenshots(['holiday.bmp', 'shot001_top.bmp', 'shot000.bmp']);
    expect(shots).toEqual([
      { id: '001', number: 1, top: 'shot001_top.bmp', bottom: null },
      { id: 'holiday.bmp', number: null, top: 'holiday.bmp', bottom: null },
      { id: 'shot000.bmp', number: null, top: 'shot000.bmp', bottom: null },
    ]);
  });

  it('leaves out what is not a picture, dot files included', () => {
    const names = ['shot000_top.bmp', '._shot000_top.bmp', '.DS_Store', 'notes.txt', 'thumbs'];
    expect(groupScreenshots(names).map((s) => s.id)).toEqual(['000']);
  });

  it('keeps shot7 and shot007 apart, however the file got there', () => {
    // the launcher always writes three digits, but a file copied back from a
    // pc can carry fewer — folding them together would hide one and delete
    // the other's half with it
    const shots = groupScreenshots(['shot007_top.bmp', 'shot007_bot.bmp', 'shot7_top.bmp']);
    expect(shots).toEqual([
      { id: '007', number: 7, top: 'shot007_top.bmp', bottom: 'shot007_bot.bmp' },
      { id: '7', number: 7, top: 'shot7_top.bmp', bottom: null },
    ]);
  });

  it('returns nothing for an empty folder', () => {
    expect(groupScreenshots([])).toEqual([]);
  });

  it('takes the last name when a folder somehow holds the same half twice', () => {
    // FAT cannot really do this, but a listing is untrusted input
    expect(groupScreenshots(['shot000_top.bmp', 'SHOT000_TOP.BMP'])[0].top).toBe('SHOT000_TOP.BMP');
  });
});

describe('screenshotFileName', () => {
  it('names a numbered capture after its number', () => {
    expect(
      screenshotFileName({
        id: '007',
        number: 7,
        top: 'shot007_top.bmp',
        bottom: 'shot007_bot.bmp',
      }),
    ).toBe('shot007.png');
  });

  it('keeps the number as the card wrote it, however many digits', () => {
    expect(screenshotFileName({ id: '0007', number: 7, top: 'a.bmp', bottom: 'b.bmp' })).toBe(
      'shot0007.png',
    );
  });

  it('says which half it is when the capture has only one', () => {
    expect(screenshotFileName({ id: '007', number: 7, top: 'x.bmp', bottom: null })).toBe(
      'shot007_top.png',
    );
    expect(screenshotFileName({ id: '007', number: 7, top: null, bottom: 'x.bmp' })).toBe(
      'shot007_bot.png',
    );
  });

  it('renames an unnumbered file rather than inventing a number for it', () => {
    expect(
      screenshotFileName({ id: 'holiday.BMP', number: null, top: 'holiday.BMP', bottom: null }),
    ).toBe('holiday.png');
  });
});

describe('shotAt', () => {
  const ids = ['000', '001', '002'];

  it('walks forward and back through the captures', () => {
    expect(shotAt(ids, '001', 1)).toBe('002');
    expect(shotAt(ids, '001', -1)).toBe('000');
  });

  it('stops at both ends instead of wrapping around', () => {
    expect(shotAt(ids, '002', 1)).toBeNull();
    expect(shotAt(ids, '000', -1)).toBeNull();
  });

  it('returns nothing for a capture that is not on the list', () => {
    // the open capture can vanish when another card is opened
    expect(shotAt(ids, '404', 1)).toBeNull();
    expect(shotAt([], '000', 1)).toBeNull();
  });

  it('takes a step of any size, clamped by the ends', () => {
    expect(shotAt(ids, '000', 2)).toBe('002');
    expect(shotAt(ids, '000', 3)).toBeNull();
  });
});
