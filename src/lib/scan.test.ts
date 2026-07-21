import { describe, expect, it } from 'vitest';
import { MAX_SCAN_DEPTH, scanCard } from './scan.ts';

// ---------------------------------------------------------------------------
// In-memory fakes implementing the minimal handle surface the module uses.
// They throw DOMExceptions with the same names as real browser handles —
// including NoModificationAllowedError, Chromium's surfacing of a macOS
// permission denial (TCC) even on read operations.
// ---------------------------------------------------------------------------

const ACCESS_DENIED = () =>
  new DOMException(
    'An attempt was made to write to a file or directory which could not be ' +
      'modified due to the state of the underlying filesystem.',
    'NoModificationAllowedError',
  );

class FakeFileHandle {
  readonly kind = 'file' as const;
  readonly name: string;
  private readonly size: number;
  private readonly readable: boolean;

  constructor(name: string, size = 0, readable = true) {
    this.name = name;
    this.size = size;
    this.readable = readable;
  }

  async getFile(): Promise<{ size: number }> {
    if (!this.readable) {
      throw ACCESS_DENIED();
    }
    return { size: this.size };
  }
}

class FakeDirectoryHandle {
  readonly kind = 'directory' as const;
  readonly name: string;
  readonly children: (FakeDirectoryHandle | FakeFileHandle)[] = [];
  /** Simulates a macOS-protected directory (e.g. `.Trashes` without FDA). */
  denyRead = false;

  constructor(name = '') {
    this.name = name;
  }

  dir(name: string): FakeDirectoryHandle {
    const child = new FakeDirectoryHandle(name);
    this.children.push(child);
    return child;
  }

  file(name: string, size = 0, readable = true): this {
    this.children.push(new FakeFileHandle(name, size, readable));
    return this;
  }

  async *values(): AsyncGenerator<FakeDirectoryHandle | FakeFileHandle> {
    if (this.denyRead) {
      throw ACCESS_DENIED();
    }
    yield* this.children;
  }
}

/** Casts a fake to the DOM handle type the module's API is typed against. */
function asRoot(fake: FakeDirectoryHandle): FileSystemDirectoryHandle {
  return fake as unknown as FileSystemDirectoryHandle;
}

const noProgress = () => {};

describe('scanCard', () => {
  it('collects junk, loader entries, saves and user covers in one walk', async () => {
    const root = new FakeDirectoryHandle();
    root.file('.DS_Store', 6148);
    const pico = root.dir('_pico');
    pico.file('picoLoader7.bin', 100).file('gamedata.json', 50);
    pico.dir('covers').dir('user').file('Mario.bmp', 200);
    const nds = root.dir('Games').dir('nds');
    nds.file('Mario.nds', 1000).file('Mario.sav', 512).file('._Mario.nds', 4096);

    const result = await scanCard(asRoot(root), noProgress);

    expect(result.junkFiles).toEqual([
      { path: [], name: '.DS_Store', size: 6148 },
      { path: ['Games', 'nds'], name: '._Mario.nds', size: 4096 },
    ]);
    expect(result.picoEntries).toEqual(['picoLoader7.bin', 'gamedata.json']);
    expect(result.saves).toEqual([{ path: ['Games', 'nds'], name: 'Mario.sav' }]);
    expect(result.userCoverNames).toEqual(['Mario.bmp']);
    expect(result.junkDirs).toEqual([]);
    expect(result.skippedDirs).toEqual([]);
    expect(result.filesSeen).toBe(7);
  });

  it('survives an unreadable .Trashes at the root and still reports it as junk', async () => {
    // macOS denies listing .Trashes to apps without Full Disk Access; the
    // scan used to die on it with a misleading "attempt to write" error
    const root = new FakeDirectoryHandle();
    root.dir('.Trashes').denyRead = true;
    root.dir('.Spotlight-V100').file('store.db', 10);
    root.dir('Games').dir('nds').file('Mario.nds', 1000);

    const result = await scanCard(asRoot(root), noProgress);

    expect(result.junkDirs).toEqual([
      { name: '.Trashes', preventionOnly: false },
      { name: '.Spotlight-V100', preventionOnly: false },
    ]);
    expect(result.skippedDirs).toEqual([]);
    expect(result.filesSeen).toBe(1); // junk dirs are never descended into
  });

  it('detects an intentional no_log-only .fseventsd', async () => {
    const root = new FakeDirectoryHandle();
    root.dir('.fseventsd').file('no_log');

    const result = await scanCard(asRoot(root), noProgress);

    expect(result.junkDirs).toEqual([{ name: '.fseventsd', preventionOnly: true }]);
  });

  it('treats a .fseventsd with real log files as plain junk', async () => {
    const root = new FakeDirectoryHandle();
    root.dir('.fseventsd').file('no_log').file('0000000012345678', 72);

    const result = await scanCard(asRoot(root), noProgress);

    expect(result.junkDirs).toEqual([{ name: '.fseventsd', preventionOnly: false }]);
  });

  it('treats an unreadable .fseventsd as plain junk', async () => {
    const root = new FakeDirectoryHandle();
    root.dir('.fseventsd').denyRead = true;

    const result = await scanCard(asRoot(root), noProgress);

    expect(result.junkDirs).toEqual([{ name: '.fseventsd', preventionOnly: false }]);
  });

  it('reports junk dirs below the root as neither junk nor scannable', async () => {
    const root = new FakeDirectoryHandle();
    root.dir('Games').dir('.Trashes').file('._ghost.nds', 100);

    const result = await scanCard(asRoot(root), noProgress);

    expect(result.junkDirs).toEqual([]);
    expect(result.junkFiles).toEqual([]);
    expect(result.filesSeen).toBe(0);
  });

  it('reports an unreadable junk file with size 0 instead of failing', async () => {
    const root = new FakeDirectoryHandle();
    root.file('._locked', 100, false).file('.DS_Store', 6148);

    const result = await scanCard(asRoot(root), noProgress);

    expect(result.junkFiles).toEqual([
      { path: [], name: '._locked', size: 0 },
      { path: [], name: '.DS_Store', size: 6148 },
    ]);
  });

  it('skips unreadable regular directories and reports them by path', async () => {
    const root = new FakeDirectoryHandle();
    const games = root.dir('Games');
    games.dir('secret').denyRead = true;
    games.dir('nds').file('Mario.nds', 1000).file('Mario.sav', 512);

    const result = await scanCard(asRoot(root), noProgress);

    expect(result.skippedDirs).toEqual(['Games/secret']);
    // the walk continued past the unreadable sibling
    expect(result.saves).toEqual([{ path: ['Games', 'nds'], name: 'Mario.sav' }]);
  });

  it('rethrows non-permission errors', async () => {
    const root = new FakeDirectoryHandle();
    const broken = root.dir('Games');
    broken.values = async function* () {
      yield* [];
      throw new DOMException('device gone', 'NotFoundError');
    };

    await expect(scanCard(asRoot(root), noProgress)).rejects.toThrow('device gone');
  });

  it('stops descending below MAX_SCAN_DEPTH', async () => {
    const root = new FakeDirectoryHandle();
    let dir = root;
    for (let depth = 1; depth <= MAX_SCAN_DEPTH + 1; depth += 1) {
      dir.file(`at-depth-${depth - 1}.txt`);
      dir = dir.dir(`level-${depth}`);
    }
    dir.file('too-deep.txt');

    const result = await scanCard(asRoot(root), noProgress);

    // files at depths 0..MAX are visited; the one below the cap is not
    expect(result.filesSeen).toBe(MAX_SCAN_DEPTH + 1);
  });

  it('collects saves from custom folders and the root, but never under _pico', async () => {
    const root = new FakeDirectoryHandle();
    root.dir('roms').file('Celeste.sav', 512);
    root.file('Loose.sav', 256);
    root.dir('_pico').dir('backup').file('old.sav', 128);

    const result = await scanCard(asRoot(root), noProgress);

    expect(result.saves).toEqual([
      { path: ['roms'], name: 'Celeste.sav' },
      { path: [], name: 'Loose.sav' },
    ]);
  });

  it('never collects saves inside dot-directories', async () => {
    // the library walk never enters dot-dirs, so their ROMs are invisible —
    // collecting the save would wrongly flag it as orphaned
    const root = new FakeDirectoryHandle();
    root.dir('.stash').file('Hidden.sav', 512);
    root.dir('roms').dir('.backup').file('Old.sav', 256);

    const result = await scanCard(asRoot(root), noProgress);

    expect(result.saves).toEqual([]);
  });

  it('reports progress with the final file count', async () => {
    const root = new FakeDirectoryHandle();
    root.file('a.txt').file('b.txt');
    const calls: number[] = [];

    await scanCard(asRoot(root), (n) => calls.push(n));

    expect(calls.at(-1)).toBe(2);
  });
});
