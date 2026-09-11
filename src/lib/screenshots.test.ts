import { describe, expect, it } from 'vitest';
import { groupScreenshots, screenshotFileName } from './screenshots';

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
