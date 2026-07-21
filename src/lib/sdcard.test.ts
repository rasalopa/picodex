import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  COVERS,
  GAMEDATA_FILE,
  GAMES_DIR,
  PICO_DIR,
  SETTINGS_FILE,
  ensureReadWritePermission,
  fileExists,
  friendlyFsError,
  getDir,
  isFileSystemAccessSupported,
  listEntries,
  looksLikeDspicoSd,
  pickSdRoot,
  readFileBytes,
  readFileText,
  scanLibrary,
  writeFileBytes,
  writeFileText,
} from './sdcard.ts';
import { SYSTEMS, systemById } from './systems.ts';
import type { System } from './systems.ts';

// ---------------------------------------------------------------------------
// In-memory fakes implementing the minimal handle surface the module uses.
// They throw DOMExceptions with the same names as real browser handles.
// ---------------------------------------------------------------------------

type FakeEntry = FakeDirectoryHandle | FakeFileHandle;

class FakeFileHandle {
  readonly kind = 'file' as const;
  readonly name: string;
  data: Uint8Array;
  /** Simulates a locked/unreadable file: getFile() throws. */
  denyRead = false;

  constructor(name: string, data: Uint8Array = new Uint8Array(0)) {
    this.name = name;
    this.data = data;
  }

  async getFile(): Promise<{ size: number; arrayBuffer(): Promise<ArrayBuffer> }> {
    if (this.denyRead) {
      throw new DOMException('access denied', 'NotReadableError');
    }
    const snapshot = new Uint8Array(this.data);
    return {
      size: snapshot.byteLength,
      arrayBuffer: async () => snapshot.buffer,
    };
  }

  /** Mirrors the real API: buffered writes replace the contents on close(). */
  async createWritable(): Promise<{
    write(chunk: Uint8Array): Promise<void>;
    close(): Promise<void>;
    abort(): Promise<void>;
  }> {
    const chunks: Uint8Array[] = [];
    return {
      write: async (chunk) => {
        chunks.push(new Uint8Array(chunk));
      },
      close: async () => {
        const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
        const merged = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.byteLength;
        }
        this.data = merged;
      },
      abort: async () => {
        chunks.length = 0;
      },
    };
  }
}

class FakeDirectoryHandle {
  readonly kind = 'directory' as const;
  readonly name: string;
  readonly children = new Map<string, FakeEntry>();
  /** Simulates an ACL/TCC-protected directory (Windows `System Volume
   *  Information`, macOS `.Trashes`): listing it throws. */
  denyRead = false;

  constructor(name = '') {
    this.name = name;
  }

  addDir(name: string): FakeDirectoryHandle {
    const dir = new FakeDirectoryHandle(name);
    this.children.set(name, dir);
    return dir;
  }

  addFile(name: string, data: Uint8Array | string = new Uint8Array(0)): FakeFileHandle {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const file = new FakeFileHandle(name, bytes);
    this.children.set(name, file);
    return file;
  }

  async getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FakeDirectoryHandle> {
    const existing = this.children.get(name);
    if (existing !== undefined) {
      if (existing.kind !== 'directory') {
        throw new DOMException(`${name} is not a directory`, 'TypeMismatchError');
      }
      return existing;
    }
    if (options?.create) {
      return this.addDir(name);
    }
    throw new DOMException(`${name} not found`, 'NotFoundError');
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<FakeFileHandle> {
    const existing = this.children.get(name);
    if (existing !== undefined) {
      if (existing.kind !== 'file') {
        throw new DOMException(`${name} is not a file`, 'TypeMismatchError');
      }
      return existing;
    }
    if (options?.create) {
      return this.addFile(name);
    }
    throw new DOMException(`${name} not found`, 'NotFoundError');
  }

  async *values(): AsyncGenerator<FakeEntry> {
    if (this.denyRead) {
      throw new DOMException('access denied', 'NotReadableError');
    }
    yield* this.children.values();
  }
}

/** Casts a fake to the DOM handle type the module's API is typed against. */
function asDir(fake: FakeDirectoryHandle): FileSystemDirectoryHandle {
  return fake as unknown as FileSystemDirectoryHandle;
}

function mustSystem(id: string): System {
  const system = systemById(id);
  if (system === null) {
    throw new Error(`unknown system in test setup: ${id}`);
  }
  return system;
}

// ---------------------------------------------------------------------------

describe('SD layout constants', () => {
  it('matches the DSpico on-card layout', () => {
    expect(PICO_DIR).toBe('_pico');
    expect(GAMES_DIR).toBe('Games');
    expect(COVERS.nds).toEqual(['_pico', 'covers', 'nds']);
    expect(COVERS.gba).toEqual(['_pico', 'covers', 'gba']);
    expect(COVERS.user).toEqual(['_pico', 'covers', 'user']);
    expect(GAMEDATA_FILE).toBe('gamedata.json');
    expect(SETTINGS_FILE).toBe('settings.json');
  });
});

describe('isFileSystemAccessSupported / pickSdRoot', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports unsupported in a bare Node environment', () => {
    expect(isFileSystemAccessSupported()).toBe(false);
  });

  it('pickSdRoot rejects when the API is unavailable', async () => {
    await expect(pickSdRoot()).rejects.toThrow(/not supported/);
  });

  it('calls showDirectoryPicker with readwrite mode and returns its handle', async () => {
    const fake = new FakeDirectoryHandle('SDCARD');
    let receivedOptions: unknown;
    vi.stubGlobal('window', {
      showDirectoryPicker: async (options?: unknown) => {
        receivedOptions = options;
        return asDir(fake);
      },
    });
    expect(isFileSystemAccessSupported()).toBe(true);
    const root = await pickSdRoot();
    expect(root).toBe(asDir(fake));
    expect(receivedOptions).toEqual({ mode: 'readwrite' });
  });
});

describe('ensureReadWritePermission', () => {
  function handleWith(states: {
    query?: PermissionState;
    request?: PermissionState;
  }): FileSystemHandle {
    const handle = {
      kind: 'directory',
      name: 'sd',
      queryPermission: states.query === undefined ? undefined : async () => states.query,
      requestPermission: states.request === undefined ? undefined : async () => states.request,
    };
    return handle as unknown as FileSystemHandle;
  }

  it('is true when permission is already granted (no prompt needed)', async () => {
    await expect(ensureReadWritePermission(handleWith({ query: 'granted' }))).resolves.toBe(true);
  });

  it('prompts and honors the user response', async () => {
    await expect(
      ensureReadWritePermission(handleWith({ query: 'prompt', request: 'granted' })),
    ).resolves.toBe(true);
    await expect(
      ensureReadWritePermission(handleWith({ query: 'prompt', request: 'denied' })),
    ).resolves.toBe(false);
  });

  it('assumes granted when the browser lacks the permission methods', async () => {
    await expect(ensureReadWritePermission(handleWith({}))).resolves.toBe(true);
  });
});

describe('getDir', () => {
  it('returns the root itself for an empty path', async () => {
    const root = new FakeDirectoryHandle('root');
    await expect(getDir(asDir(root), [])).resolves.toBe(asDir(root));
  });

  it('traverses nested directories', async () => {
    const root = new FakeDirectoryHandle('root');
    const covers = root.addDir('_pico').addDir('covers');
    const nds = covers.addDir('nds');
    const found = await getDir(asDir(root), [...COVERS.nds]);
    expect(found).toBe(asDir(nds));
  });

  it('returns null for a missing segment when create=false', async () => {
    const root = new FakeDirectoryHandle('root');
    root.addDir('_pico');
    await expect(getDir(asDir(root), ['_pico', 'covers', 'nds'])).resolves.toBeNull();
  });

  it('returns null when a segment exists but is a file', async () => {
    const root = new FakeDirectoryHandle('root');
    root.addFile('_pico');
    await expect(getDir(asDir(root), ['_pico', 'covers'])).resolves.toBeNull();
  });

  it('creates the missing chain when create=true', async () => {
    const root = new FakeDirectoryHandle('root');
    const created = await getDir(asDir(root), [...COVERS.user], true);
    expect(created).not.toBeNull();
    // The chain is now reachable without create.
    const found = await getDir(asDir(root), [...COVERS.user]);
    expect(found).toBe(created);
  });
});

describe('file read/write round-trips', () => {
  it('round-trips raw bytes (all 256 values)', async () => {
    const dir = new FakeDirectoryHandle('d');
    const bytes = new Uint8Array(256).map((_, i) => i);
    await writeFileBytes(asDir(dir), 'blob.bin', bytes);
    const back = await readFileBytes(asDir(dir), 'blob.bin');
    expect(back).toEqual(bytes);
  });

  it('round-trips non-ASCII text as UTF-8', async () => {
    const dir = new FakeDirectoryHandle('d');
    const text = 'Pokémon — ポケモン ★';
    await writeFileText(asDir(dir), SETTINGS_FILE, text);
    await expect(readFileText(asDir(dir), SETTINGS_FILE)).resolves.toBe(text);
    // On-disk representation is UTF-8 bytes.
    const bytes = await readFileBytes(asDir(dir), SETTINGS_FILE);
    expect(bytes).toEqual(new TextEncoder().encode(text));
  });

  it('returns null for missing files', async () => {
    const dir = new FakeDirectoryHandle('d');
    await expect(readFileBytes(asDir(dir), 'nope.bin')).resolves.toBeNull();
    await expect(readFileText(asDir(dir), 'nope.txt')).resolves.toBeNull();
  });

  it('overwriting fully replaces previous, longer contents', async () => {
    const dir = new FakeDirectoryHandle('d');
    await writeFileBytes(asDir(dir), GAMEDATA_FILE, new Uint8Array(10).fill(0xaa));
    await writeFileBytes(asDir(dir), GAMEDATA_FILE, new Uint8Array([1, 2, 3]));
    const back = await readFileBytes(asDir(dir), GAMEDATA_FILE);
    expect(back).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('creates the file when it does not exist yet', async () => {
    const dir = new FakeDirectoryHandle('d');
    await expect(fileExists(asDir(dir), 'new.txt')).resolves.toBe(false);
    await writeFileText(asDir(dir), 'new.txt', 'hello');
    await expect(fileExists(asDir(dir), 'new.txt')).resolves.toBe(true);
  });
});

describe('fileExists', () => {
  it('distinguishes files, directories and missing entries', async () => {
    const dir = new FakeDirectoryHandle('d');
    dir.addFile('settings.json', '{}');
    dir.addDir('covers');
    await expect(fileExists(asDir(dir), 'settings.json')).resolves.toBe(true);
    await expect(fileExists(asDir(dir), 'covers')).resolves.toBe(false);
    await expect(fileExists(asDir(dir), 'missing.bin')).resolves.toBe(false);
  });
});

describe('listEntries', () => {
  it('lists immediate children with their kind', async () => {
    const dir = new FakeDirectoryHandle('d');
    dir.addFile('a.nds');
    dir.addDir('saves');
    dir.addFile('b.gba');
    const entries = await listEntries(asDir(dir));
    expect(entries).toEqual([
      { name: 'a.nds', kind: 'file' },
      { name: 'saves', kind: 'directory' },
      { name: 'b.gba', kind: 'file' },
    ]);
  });

  it('returns an empty array for an empty directory', async () => {
    await expect(listEntries(asDir(new FakeDirectoryHandle('d')))).resolves.toEqual([]);
  });
});

describe('looksLikeDspicoSd', () => {
  it('is true when the root has a _pico directory', async () => {
    const root = new FakeDirectoryHandle('root');
    root.addDir('_pico');
    await expect(looksLikeDspicoSd(asDir(root))).resolves.toBe(true);
  });

  it('is false without _pico', async () => {
    const root = new FakeDirectoryHandle('root');
    root.addDir('Games');
    await expect(looksLikeDspicoSd(asDir(root))).resolves.toBe(false);
  });

  it('is false when _pico is a file, not a directory', async () => {
    const root = new FakeDirectoryHandle('root');
    root.addFile('_pico');
    await expect(looksLikeDspicoSd(asDir(root))).resolves.toBe(false);
  });
});

describe('scanLibrary', () => {
  it('skips junk files, wrong extensions and subdirectories', async () => {
    const root = new FakeDirectoryHandle('root');
    const nds = root.addDir(GAMES_DIR).addDir('nds');
    nds.addFile('Mario Kart DS (USA).nds', new Uint8Array(64));
    // Real-world regression: macOS AppleDouble/metadata junk on FAT SD cards
    // (skipped with the same startswith rule as tools/fetch_covers*.py).
    nds.addFile('._Mario Kart DS (USA).nds', new Uint8Array(4));
    nds.addFile('.DS_Store', new Uint8Array(8));
    nds.addFile('readme.txt', 'not a rom');
    nds.addDir('saves');

    const found = await scanLibrary(asDir(root), [mustSystem('nds')]);
    expect(found).toEqual([
      {
        system: mustSystem('nds'),
        fileName: 'Mario Kart DS (USA).nds',
        size: 64,
        path: [GAMES_DIR, 'nds'],
      },
    ]);
  });

  it('matches extensions case-insensitively', async () => {
    const root = new FakeDirectoryHandle('root');
    const nds = root.addDir(GAMES_DIR).addDir('nds');
    nds.addFile('POKEMON.NDS', new Uint8Array(16));
    const found = await scanLibrary(asDir(root), [mustSystem('nds')]);
    expect(found.map((f) => f.fileName)).toEqual(['POKEMON.NDS']);
  });

  it('attributes files in a shared games dir to the right system (gb/gbc)', async () => {
    const root = new FakeDirectoryHandle('root');
    const gb = root.addDir(GAMES_DIR).addDir('gb');
    gb.addFile('Tetris (World).gb', new Uint8Array(32));
    gb.addFile('Wario Land 3 (World).gbc', new Uint8Array(48));

    const found = await scanLibrary(asDir(root), [mustSystem('gb'), mustSystem('gbc')]);
    expect(found).toEqual([
      {
        system: mustSystem('gb'),
        fileName: 'Tetris (World).gb',
        size: 32,
        path: [GAMES_DIR, 'gb'],
      },
      {
        system: mustSystem('gbc'),
        fileName: 'Wario Land 3 (World).gbc',
        size: 48,
        path: [GAMES_DIR, 'gb'],
      },
    ]);
  });

  it('only reports files whose extension belongs to a requested system', async () => {
    const root = new FakeDirectoryHandle('root');
    const games = root.addDir(GAMES_DIR);
    games.addDir('nds').addFile('Game.nds', new Uint8Array(8));
    games.addDir('snes').addFile('Game.sfc', new Uint8Array(9));
    const found = await scanLibrary(asDir(root), [mustSystem('nds')]);
    expect(found).toEqual([
      { system: mustSystem('nds'), fileName: 'Game.nds', size: 8, path: [GAMES_DIR, 'nds'] },
    ]);
  });

  it('returns an empty array when the card has no known ROMs', async () => {
    const root = new FakeDirectoryHandle('root');
    root.addDir('_pico');
    root.addDir('DCIM').addFile('photo.jpg', new Uint8Array(3));
    await expect(scanLibrary(asDir(root), SYSTEMS)).resolves.toEqual([]);
  });

  it('finds ROMs in custom folders anywhere on the card', async () => {
    const root = new FakeDirectoryHandle('root');
    const roms = root.addDir('roms');
    roms.addFile('Celeste.nds', new Uint8Array(5));
    roms.addDir('handhelds').addFile('Shantae.gbc', new Uint8Array(6));
    root.addFile('Loose.gba', new Uint8Array(7));

    const found = await scanLibrary(asDir(root), SYSTEMS);
    // grouped in SYSTEMS order (nds before gba before gbc)
    expect(found.map((f) => [f.system.id, f.fileName, f.path])).toEqual([
      ['nds', 'Celeste.nds', ['roms']],
      ['gba', 'Loose.gba', []],
      ['gbc', 'Shantae.gbc', ['roms', 'handhelds']],
    ]);
  });

  it('never scans inside _pico (emulators are tools, not library games)', async () => {
    const root = new FakeDirectoryHandle('root');
    root.addDir('_pico').addDir('emulators').addFile('GBARunner2.nds', new Uint8Array(4));
    root.addDir(GAMES_DIR).addDir('nds').addFile('Real.nds', new Uint8Array(2));
    const found = await scanLibrary(asDir(root), SYSTEMS);
    expect(found.map((f) => f.fileName)).toEqual(['Real.nds']);
  });

  it('never descends into dot-directories (.Trashes and friends)', async () => {
    const root = new FakeDirectoryHandle('root');
    root.addDir('.Trashes').addFile('Deleted.nds', new Uint8Array(4));
    const found = await scanLibrary(asDir(root), SYSTEMS);
    expect(found).toEqual([]);
  });

  it('never lists the launcher ROM (_picoboot.nds) as a game', async () => {
    const root = new FakeDirectoryHandle('root');
    root.addFile('_picoboot.nds', new Uint8Array(64));
    root.addFile('_PICOBOOT.NDS', new Uint8Array(64)); // FAT re-cased
    root.addDir(GAMES_DIR).addDir('nds').addFile('_picoboot.nds', new Uint8Array(2));
    const found = await scanLibrary(asDir(root), SYSTEMS);
    // only the root-level launcher is special; a user file elsewhere with
    // the same name is still a (weirdly named) game
    expect(found.map((f) => [...f.path, f.fileName].join('/'))).toEqual([
      'Games/nds/_picoboot.nds',
    ]);
  });

  it('skips unreadable directories instead of losing the whole library', async () => {
    // Windows ACL-protects 'System Volume Information' on every card it
    // touches; one such folder must not abort the scan
    const root = new FakeDirectoryHandle('root');
    root.addDir('System Volume Information').denyRead = true;
    root.addDir(GAMES_DIR).addDir('nds').addFile('Game.nds', new Uint8Array(2));
    const found = await scanLibrary(asDir(root), SYSTEMS);
    expect(found.map((f) => f.fileName)).toEqual(['Game.nds']);
  });

  it('skips a locked file without losing its siblings or the scan', async () => {
    const root = new FakeDirectoryHandle('root');
    root.addFile('LockedRoot.gba', new Uint8Array(1)).denyRead = true;
    const nds = root.addDir(GAMES_DIR).addDir('nds');
    nds.addFile('A.nds', new Uint8Array(1));
    nds.addFile('Locked.nds', new Uint8Array(1)).denyRead = true;
    nds.addFile('Z.nds', new Uint8Array(1));
    const found = await scanLibrary(asDir(root), SYSTEMS);
    // a locked file costs only itself — Z.nds after it must survive
    expect(found.map((f) => f.fileName)).toEqual(['A.nds', 'Z.nds']);
  });

  it('reports the same file name in two folders as two library entries', async () => {
    const root = new FakeDirectoryHandle('root');
    root.addDir(GAMES_DIR).addDir('nds').addFile('Mario.nds', new Uint8Array(1));
    root.addDir('backup').addFile('Mario.nds', new Uint8Array(1));
    const found = await scanLibrary(asDir(root), SYSTEMS);
    expect(found.map((f) => [...f.path, f.fileName].join('/'))).toEqual([
      'Games/nds/Mario.nds',
      'backup/Mario.nds',
    ]);
  });

  it('reports progress with the final count of visited files', async () => {
    const root = new FakeDirectoryHandle('root');
    const nds = root.addDir(GAMES_DIR).addDir('nds');
    nds.addFile('A.nds', new Uint8Array(1));
    nds.addFile('notes.txt', 'not a rom'); // visited files count, not ROMs
    const calls: number[] = [];
    await scanLibrary(asDir(root), SYSTEMS, (n) => calls.push(n));
    expect(calls.at(-1)).toBe(2);
  });

  it('stops descending below the depth cap', async () => {
    const root = new FakeDirectoryHandle('root');
    let dir = root;
    for (let depth = 1; depth <= 9; depth += 1) {
      dir = dir.addDir(`level-${depth}`);
    }
    dir.addFile('TooDeep.nds', new Uint8Array(1));
    const found = await scanLibrary(asDir(root), SYSTEMS);
    expect(found).toEqual([]);
  });

  it('scans the full registry without duplicating shared directories', async () => {
    const root = new FakeDirectoryHandle('root');
    const games = root.addDir(GAMES_DIR);
    games.addDir('nds').addFile('A.nds', new Uint8Array(1));
    games.addDir('gba').addFile('B.gba', new Uint8Array(2));
    const gb = games.addDir('gb');
    gb.addFile('C.gb', new Uint8Array(3));
    gb.addFile('D.gbc', new Uint8Array(4));

    const found = await scanLibrary(asDir(root), SYSTEMS);
    expect(found.map((f) => [f.system.id, f.fileName, f.size])).toEqual([
      ['nds', 'A.nds', 1],
      ['gba', 'B.gba', 2],
      ['gb', 'C.gb', 3],
      ['gbc', 'D.gbc', 4],
    ]);
  });
});

describe('friendlyFsError', () => {
  it('translates the misleading Chromium permission-denial wording', () => {
    const denial = new DOMException(
      'An attempt was made to write to a file or directory which could not ' +
        'be modified due to the state of the underlying filesystem.',
      'NoModificationAllowedError',
    );
    expect(friendlyFsError(denial)).toContain('macOS denied access');
    expect(friendlyFsError(denial)).toContain('.Trashes');
  });

  it('passes other errors through unchanged', () => {
    expect(friendlyFsError(new DOMException('gone', 'NotFoundError'))).toBe('gone');
    expect(friendlyFsError(new Error('boom'))).toBe('boom');
    expect(friendlyFsError('plain string')).toBe('plain string');
  });
});
