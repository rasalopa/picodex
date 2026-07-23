import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SAVE_SIZE_BYTES,
  compatForGame,
  parseApList,
  parsePatchList,
  parseSaveList,
} from './loaderlists';
import type { LoaderLists } from './loaderlists';

// ---------------------------------------------------------------------------
// Fixture builders. They pack bytes exactly like the loader's converter
// (tools/PicoLoaderConverter) writes them, so the tests never need real
// LNH-distributed binaries.
// ---------------------------------------------------------------------------

/** Little-endian u16 as 2 bytes. */
function u16(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff];
}

/** Little-endian u24 as 3 bytes. */
function u24(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff];
}

/** Little-endian u32 as 4 bytes. */
function u32(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

/** 4-character game code as its 4 bytes, LSB-first (GameCodeHelper.cs). */
function code(gameCode: string): number[] {
  return [
    gameCode.charCodeAt(0),
    gameCode.charCodeAt(1),
    gameCode.charCodeAt(2),
    gameCode.charCodeAt(3),
  ];
}

/**
 * One 16-byte aplist entry, packed like `ApListFactory.WriteBinaryApListEntry`:
 * info = gameVersion | dsProtect << 5 | functionMask << 10. The overlay ids
 * and u24 offsets are given non-zero defaults so a stride bug would corrupt
 * the next entry's decoded fields.
 */
function apEntry(opts: {
  gameCode: string;
  gameVersion?: number;
  dsProtect?: number;
  functionMask?: number;
  regularOverlayId?: number;
  sOverlayId?: number;
  regularOffset?: number;
  sOffset?: number;
}): number[] {
  const info =
    (opts.gameVersion ?? 0) | ((opts.dsProtect ?? 0) << 5) | ((opts.functionMask ?? 0) << 10);
  return [
    ...code(opts.gameCode),
    ...u16(info),
    ...u16(opts.regularOverlayId ?? 0xfffe),
    ...u16(opts.sOverlayId ?? 0xffff),
    ...u24(opts.regularOffset ?? 0xabcdef),
    ...u24(opts.sOffset ?? 0x123456),
  ];
}

/** One 8-byte savelist entry: u32 code, u8 type, u8 log2 size, u16 zero. */
function saveEntry(gameCode: string, saveType: number, log2Size: number): number[] {
  return [...code(gameCode), saveType, log2Size, ...u16(0)];
}

/**
 * A whole patchlist.bin: u32 entryCount, the 8-byte header entries with
 * packed `gameVersion | offset << 8`, optional padding, then the patch
 * bodies `{ u16 length; u16 patchCount; ...filler }` the offsets point at —
 * mirroring `PatchListFactory.ToBinary`.
 */
function patchListFile(
  entries: { gameCode: string; gameVersion: number; patchCount: number }[],
  padding = 0,
): Uint8Array {
  const bodyBytes: number[] = new Array<number>(padding).fill(0);
  const headerBytes: number[] = [...u32(entries.length)];
  const bodiesStart = 4 + entries.length * 8 + padding;
  for (const entry of entries) {
    const offset = bodiesStart + bodyBytes.length - padding;
    headerBytes.push(...code(entry.gameCode), ...u32(entry.gameVersion | (offset << 8)));
    // Body: length covers the two u16s plus 4 filler bytes per patch.
    const filler = new Array<number>(entry.patchCount * 4).fill(0xee);
    bodyBytes.push(...u16(4 + filler.length), ...u16(entry.patchCount), ...filler);
  }
  return Uint8Array.from([...headerBytes, ...bodyBytes]);
}

/** LoaderLists with every list null, overridable per test. */
function lists(overrides: Partial<LoaderLists> = {}): LoaderLists {
  return { ap: null, save: null, patch: null, ...overrides };
}

// ---------------------------------------------------------------------------
// parseApList
// ---------------------------------------------------------------------------

describe('parseApList', () => {
  it('parses an empty file as an empty list', () => {
    expect(parseApList(new Uint8Array(0))).toEqual([]);
  });

  it('decodes a single entry, unpacking the info bitfield', () => {
    // dsProtect 9 = v1.26 (DSProtectVersion.h order); a full functionMask
    // (bits 10-15) must not bleed into the dsProtect index.
    const bytes = Uint8Array.from(
      apEntry({ gameCode: 'AMCE', gameVersion: 1, dsProtect: 9, functionMask: 0x3f }),
    );

    expect(parseApList(bytes)).toEqual([
      { gameCode: 'AMCE', gameVersion: 1, dsProtectVersion: 'v1.26' },
    ]);
  });

  it('decodes multiple entries in file order', () => {
    const bytes = Uint8Array.from([
      // dsProtect 0 is v1.06, not v1.00_2: the enum is not sorted.
      ...apEntry({ gameCode: 'ADAE', gameVersion: 0, dsProtect: 0 }),
      ...apEntry({ gameCode: 'ADAE', gameVersion: 5, dsProtect: 20 }),
      ...apEntry({ gameCode: 'YUTE', gameVersion: 0, dsProtect: 19 }),
    ]);

    expect(parseApList(bytes)).toEqual([
      { gameCode: 'ADAE', gameVersion: 0, dsProtectVersion: 'v1.06' },
      { gameCode: 'ADAE', gameVersion: 5, dsProtectVersion: 'v1.00_2' },
      { gameCode: 'YUTE', gameVersion: 0, dsProtectVersion: 'v2.05s' },
    ]);
  });

  it('maps a dsProtect index past the enum to "unknown"', () => {
    const bytes = Uint8Array.from(apEntry({ gameCode: 'AAAA', dsProtect: 31 }));
    expect(parseApList(bytes)[0]?.dsProtectVersion).toBe('unknown');
  });

  it('keeps non-printable game codes as-is', () => {
    const bytes = Uint8Array.from([1, 2, 3, 4, ...apEntry({ gameCode: 'AAAA' }).slice(4)]);
    expect(parseApList(bytes)[0]?.gameCode).toBe('\x01\x02\x03\x04');
  });

  it('floors the entry count like ApListFactory, ignoring trailing bytes', () => {
    // The loader's f_size / sizeof(ApListEntry) division drops any remainder,
    // so two whole entries plus 5 stray bytes decode to exactly two entries.
    const bytes = Uint8Array.from([
      ...apEntry({ gameCode: 'ADAE', gameVersion: 0, dsProtect: 9 }),
      ...apEntry({ gameCode: 'YUTE', gameVersion: 1, dsProtect: 3 }),
      1,
      2,
      3,
      4,
      5,
    ]);
    expect(parseApList(bytes).map((entry) => entry.gameCode)).toEqual(['ADAE', 'YUTE']);
  });

  it('yields an empty list for a buffer shorter than one entry', () => {
    expect(parseApList(new Uint8Array(15))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// parseSaveList
// ---------------------------------------------------------------------------

describe('parseSaveList', () => {
  it('parses an empty file as an empty list', () => {
    expect(parseSaveList(new Uint8Array(0))).toEqual([]);
  });

  it('decodes every save type and expands the log2 size', () => {
    const bytes = Uint8Array.from([
      ...saveEntry('AAAA', 0, 0), // none, no save
      ...saveEntry('ABCD', 1, 9), // eeprom, 512 B
      ...saveEntry('AMCE', 2, 18), // flash, 256 KiB
      ...saveEntry('ADAE', 3, 23), // nand, 8 MiB
    ]);

    expect(parseSaveList(bytes)).toEqual([
      { gameCode: 'AAAA', saveType: 'none', saveSizeBytes: 0 },
      { gameCode: 'ABCD', saveType: 'eeprom', saveSizeBytes: 512 },
      { gameCode: 'AMCE', saveType: 'flash', saveSizeBytes: 256 * 1024 },
      { gameCode: 'ADAE', saveType: 'nand', saveSizeBytes: 8 * 1024 * 1024 },
    ]);
  });

  it('keeps a save type outside the CardSaveType enum as "unknown"', () => {
    // The loader's SaveListEntry::Dump has an unknown branch and GetSaveSize
    // ignores the type, so an out-of-enum byte is kept, never a reject.
    expect(parseSaveList(Uint8Array.from(saveEntry('AAAA', 4, 9)))).toEqual([
      { gameCode: 'AAAA', saveType: 'unknown', saveSizeBytes: 512 },
    ]);
  });

  it('floors the entry count like SaveListFactory, ignoring trailing bytes', () => {
    const bytes = Uint8Array.from([
      ...saveEntry('AMCE', 2, 18),
      ...saveEntry('ADAE', 3, 23),
      0xaa,
      0xbb,
      0xcc,
      0xdd, // half an entry, dropped
    ]);
    expect(parseSaveList(bytes).map((entry) => entry.gameCode)).toEqual(['AMCE', 'ADAE']);
  });

  it('yields an empty list for a buffer shorter than one entry', () => {
    expect(parseSaveList(new Uint8Array(7))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// parsePatchList
// ---------------------------------------------------------------------------

describe('parsePatchList', () => {
  it('parses a zero-entry file as an empty list', () => {
    expect(parsePatchList(Uint8Array.from(u32(0)))).toEqual([]);
  });

  it('decodes a single entry, following the offset to its patch count', () => {
    expect(
      parsePatchList(patchListFile([{ gameCode: 'ADAE', gameVersion: 0, patchCount: 3 }])),
    ).toEqual([{ gameCode: 'ADAE', gameVersion: 0, patchCount: 3 }]);
  });

  it('splits the packed u32 into an 8-bit version and 24-bit offset', () => {
    // Padding pushes the body offset past 0xFF so its low byte is non-zero,
    // and version 0xAB sets bits that would corrupt the offset if the split
    // were off by even one bit.
    const file = patchListFile([{ gameCode: 'AXXE', gameVersion: 0xab, patchCount: 2 }], 300);

    expect(parsePatchList(file)).toEqual([{ gameCode: 'AXXE', gameVersion: 0xab, patchCount: 2 }]);
  });

  it('decodes multiple entries with distinct bodies', () => {
    const file = patchListFile([
      { gameCode: 'ADAE', gameVersion: 0, patchCount: 1 },
      { gameCode: 'ADAE', gameVersion: 1, patchCount: 4 },
      { gameCode: 'CPUE', gameVersion: 0, patchCount: 2 },
    ]);

    expect(parsePatchList(file)).toEqual([
      { gameCode: 'ADAE', gameVersion: 0, patchCount: 1 },
      { gameCode: 'ADAE', gameVersion: 1, patchCount: 4 },
      { gameCode: 'CPUE', gameVersion: 0, patchCount: 2 },
    ]);
  });

  it('returns null on a file too short for the count header', () => {
    expect(parsePatchList(new Uint8Array(0))).toBeNull();
    expect(parsePatchList(new Uint8Array(3))).toBeNull();
  });

  it('returns null when the declared count does not fit in the file', () => {
    expect(parsePatchList(Uint8Array.from(u32(2)))).toBeNull();
  });

  it('returns null on an out-of-bounds body offset', () => {
    // Header entry whose offset points past the end of the file.
    const file = Uint8Array.from([...u32(1), ...code('ADAE'), ...u32(0 | (0x100 << 8))]);
    expect(parsePatchList(file)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// compatForGame
// ---------------------------------------------------------------------------

describe('compatForGame', () => {
  const ap = [
    { gameCode: 'ADAE', gameVersion: 0, dsProtectVersion: 'v1.26' },
    { gameCode: 'ADAE', gameVersion: 5, dsProtectVersion: 'v2.00' },
    { gameCode: 'YUTE', gameVersion: 1, dsProtectVersion: 'v1.05' },
  ];
  const save = [
    { gameCode: 'ADAE', saveType: 'flash' as const, saveSizeBytes: 512 * 1024 },
    { gameCode: 'AAAA', saveType: 'none' as const, saveSizeBytes: 0 },
  ];
  const patch = [
    { gameCode: 'ADAE', gameVersion: 0, patchCount: 3 },
    { gameCode: 'CPUE', gameVersion: 1, patchCount: 2 },
  ];

  it('reports list-unavailable for null ap/patch lists and the default save', () => {
    // A null list means "could not check", not a positive "nothing needed" —
    // that distinction is the whole point of the list-unavailable status.
    expect(compatForGame(lists(), 'ADAE', 0)).toEqual({
      save: { saveType: null, sizeBytes: DEFAULT_SAVE_SIZE_BYTES, source: 'default' },
      ap: { status: 'list-unavailable', dsProtectVersion: null, entryVersions: [], romVersion: 0 },
      patch: { status: 'list-unavailable', patchCount: 0, entryVersions: [] },
    });
  });

  it('distinguishes an empty (present) list from a null one', () => {
    // Present-but-empty aplist/patchlist is a real "no entry for this game".
    const compat = compatForGame({ ap: [], save: [], patch: [] }, 'ZZZZ', 0);
    expect(compat.ap.status).toBe('not-needed');
    expect(compat.patch.status).toBe('none');
    expect(compat.save).toEqual({
      saveType: null,
      sizeBytes: DEFAULT_SAVE_SIZE_BYTES,
      source: 'default',
    });
  });

  it('matches the save list on game code alone, ignoring the version', () => {
    const compat = compatForGame(lists({ save }), 'ADAE', 7);
    expect(compat.save).toEqual({ saveType: 'flash', sizeBytes: 512 * 1024, source: 'list' });
  });

  it('reports a listed no-save game with size 0', () => {
    const compat = compatForGame(lists({ save }), 'AAAA', 0);
    expect(compat.save).toEqual({ saveType: 'none', sizeBytes: 0, source: 'list' });
  });

  it('falls back to the 512 KiB default for unlisted games', () => {
    const compat = compatForGame(lists({ save }), 'ZZZZ', 0);
    expect(compat.save).toEqual({
      saveType: null,
      sizeBytes: DEFAULT_SAVE_SIZE_BYTES,
      source: 'default',
    });
  });

  // NAND saves: the ROM header wins over the savelist (CardSaveArranger).

  it('sizes a NAND save from the header with the NTR block in DS mode', () => {
    // backupRegionStart 0x40 * NTR block 0x20000 = 0x800000;
    // 0x07A00000 - 0x800000 = 0x7200000 (114 MiB).
    const compat = compatForGame(lists(), 'UORE', 0, { backupRegionStart: 0x40, twl: false });
    expect(compat.save).toEqual({ saveType: 'nand', sizeBytes: 0x7200000, source: 'nand-header' });
  });

  it('sizes a NAND save with the larger TWL block in DSi mode', () => {
    // Same start, TWL block 0x80000: 0x40 * 0x80000 = 0x2000000;
    // 0x07A00000 - 0x2000000 = 0x5A00000 (90 MiB) — smaller than the NTR case.
    const compat = compatForGame(lists(), 'UORE', 0, { backupRegionStart: 0x40, twl: true });
    expect(compat.save).toEqual({ saveType: 'nand', sizeBytes: 0x5a00000, source: 'nand-header' });
  });

  it('guards a nonsensical (too-large) NAND start to a non-negative size', () => {
    // 0x100 * TWL 0x80000 = 0x8000000, past NAND_RW_REGION_END (0x07A00000):
    // the loader's u32 subtraction would wrap, so we clamp to 0.
    const compat = compatForGame(lists(), 'UORE', 0, { backupRegionStart: 0x100, twl: true });
    expect(compat.save).toEqual({ saveType: 'nand', sizeBytes: 0, source: 'nand-header' });
  });

  it('lets a NAND header override a savelist row (loader checks it first)', () => {
    // ADAE has a savelist row, but a non-zero nandBackupRegionStart wins.
    const compat = compatForGame(lists({ save }), 'ADAE', 0, {
      backupRegionStart: 0x40,
      twl: false,
    });
    expect(compat.save.source).toBe('nand-header');
    expect(compat.save.saveType).toBe('nand');
  });

  it('ignores a zero NAND start and falls through to the savelist', () => {
    const compat = compatForGame(lists({ save }), 'ADAE', 0, { backupRegionStart: 0, twl: false });
    expect(compat.save).toEqual({ saveType: 'flash', sizeBytes: 512 * 1024, source: 'list' });
  });

  it('reports ap not-needed when no entry exists for the game code', () => {
    const compat = compatForGame(lists({ ap }), 'ZZZZ', 0);
    expect(compat.ap).toEqual({
      status: 'not-needed',
      dsProtectVersion: null,
      entryVersions: [],
      romVersion: 0,
    });
  });

  it('reports ap applies on an exact (gameCode, gameVersion) match', () => {
    const compat = compatForGame(lists({ ap }), 'ADAE', 5);
    expect(compat.ap).toEqual({
      status: 'applies',
      dsProtectVersion: 'v2.00',
      entryVersions: [0, 5],
      romVersion: 5,
    });
  });

  it('reports ap version-mismatch with no fallback across versions', () => {
    const compat = compatForGame(lists({ ap }), 'ADAE', 2);
    expect(compat.ap).toEqual({
      status: 'version-mismatch',
      dsProtectVersion: null,
      entryVersions: [0, 5],
      romVersion: 2,
    });
  });

  it('reports ap list-unavailable when aplist.bin is absent', () => {
    const compat = compatForGame(lists({ save, patch }), 'ADAE', 0);
    expect(compat.ap).toEqual({
      status: 'list-unavailable',
      dsProtectVersion: null,
      entryVersions: [],
      romVersion: 0,
    });
  });

  it('falls back to version 0 when the ROM version is unreadable', () => {
    const compat = compatForGame(lists({ ap }), 'ADAE', null);
    expect(compat.ap).toEqual({
      status: 'applies',
      dsProtectVersion: 'v1.26',
      entryVersions: [0, 5],
      romVersion: null,
    });
  });

  it('reports version-mismatch when the version-0 fallback finds nothing', () => {
    const compat = compatForGame(lists({ ap }), 'YUTE', null);
    expect(compat.ap).toEqual({
      status: 'version-mismatch',
      dsProtectVersion: null,
      entryVersions: [1],
      romVersion: null,
    });
  });

  it('reports patch none when no entry exists for the game code', () => {
    const compat = compatForGame(lists({ patch }), 'ZZZZ', 0);
    expect(compat.patch).toEqual({ status: 'none', patchCount: 0, entryVersions: [] });
  });

  it('reports patch applies with the entry patch count on an exact match', () => {
    const compat = compatForGame(lists({ patch }), 'ADAE', 0);
    expect(compat.patch).toEqual({ status: 'applies', patchCount: 3, entryVersions: [0] });
  });

  it('reports patch version-mismatch with no fallback across versions', () => {
    const compat = compatForGame(lists({ patch }), 'CPUE', 0);
    expect(compat.patch).toEqual({
      status: 'version-mismatch',
      patchCount: 0,
      entryVersions: [1],
    });
  });

  it('reports patch list-unavailable when patchlist.bin is absent', () => {
    const compat = compatForGame(lists({ ap, save }), 'ADAE', 0);
    expect(compat.patch).toEqual({ status: 'list-unavailable', patchCount: 0, entryVersions: [] });
  });

  it('falls back to version 0 for the patch list when the ROM version is unreadable', () => {
    const compat = compatForGame(lists({ patch }), 'ADAE', null);
    expect(compat.patch).toEqual({ status: 'applies', patchCount: 3, entryVersions: [0] });
  });
});
