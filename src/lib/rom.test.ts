import { describe, expect, it } from 'vitest';
import {
  isUsableGameCode,
  parseGbaGameCode,
  parseNdsGameCode,
  parseNdsNandBackupRegionStart,
  parseNdsSoftwareVersion,
  parseNdsSupportsDsiMode,
  parseNdsIsHomebrew,
  parseNdsIsDsiWare,
  parseNdsDsiWareSaveSizes,
  NDS_HEADER_PARSE_BYTES,
} from './rom.ts';

/** Builds a synthetic ROM buffer with `code` bytes written at `offset`. */
function romWithCode(offset: number, code: string, size = 0x200, fill = 0): Uint8Array {
  const bytes = new Uint8Array(size).fill(fill);
  for (let i = 0; i < code.length; i++) {
    bytes[offset + i] = code.charCodeAt(i);
  }
  return bytes;
}

describe('parseNdsGameCode', () => {
  it('reads retail game codes at offset 0xC (golden vectors)', () => {
    // Mario Kart DS (USA) and New Super Mario Bros. (USA)
    expect(parseNdsGameCode(romWithCode(0x0c, 'AMCE'))).toBe('AMCE');
    expect(parseNdsGameCode(romWithCode(0x0c, 'A2DE'))).toBe('A2DE');
  });

  it('accepts a header-only slice of the minimal length (0x10 bytes)', () => {
    expect(parseNdsGameCode(romWithCode(0x0c, 'IPKE', 0x10))).toBe('IPKE');
  });

  it('accepts printable non-alphanumeric homebrew codes like "####"', () => {
    // The launcher treats any printable code as usable identity.
    expect(parseNdsGameCode(romWithCode(0x0c, '####'))).toBe('####');
  });

  it('returns null for a zero-filled header (homebrew without a code)', () => {
    expect(parseNdsGameCode(new Uint8Array(0x200))).toBeNull();
  });

  it('returns null for garbage bytes where retail games keep their code', () => {
    // Real-world regression: homebrew headers hold binary garbage at 0xC.
    const garbage = new Uint8Array(0x200).fill(0xff);
    expect(parseNdsGameCode(garbage)).toBeNull();

    const highBytes = romWithCode(0x0c, 'AB');
    highBytes[0x0e] = 0x80;
    highBytes[0x0f] = 0xc1;
    expect(parseNdsGameCode(highBytes)).toBeNull();
  });

  it('returns null when any of the 4 bytes is non-printable', () => {
    const withNul = romWithCode(0x0c, 'ABCE');
    withNul[0x0e] = 0x00;
    expect(parseNdsGameCode(withNul)).toBeNull();

    // Space (0x20) is not a usable code character.
    expect(parseNdsGameCode(romWithCode(0x0c, 'AB E'))).toBeNull();

    const withDel = romWithCode(0x0c, 'ABCE');
    withDel[0x0f] = 0x7f;
    expect(parseNdsGameCode(withDel)).toBeNull();
  });

  it('is safe on short buffers', () => {
    expect(parseNdsGameCode(new Uint8Array(0))).toBeNull();
    expect(parseNdsGameCode(new Uint8Array(4))).toBeNull();
    // One byte short of the required 0x10.
    expect(parseNdsGameCode(romWithCode(0x0c, 'AMC', 0x0f))).toBeNull();
  });
});

describe('parseGbaGameCode', () => {
  it('reads retail game codes at offset 0xAC (golden vectors)', () => {
    // Pokemon Emerald (USA) and Metroid Fusion (USA)
    expect(parseGbaGameCode(romWithCode(0xac, 'BPEE'))).toBe('BPEE');
    expect(parseGbaGameCode(romWithCode(0xac, 'AMTE'))).toBe('AMTE');
  });

  it('accepts a header-only slice of the minimal length (0xB0 bytes)', () => {
    expect(parseGbaGameCode(romWithCode(0xac, 'BPEE', 0xb0))).toBe('BPEE');
  });

  it('does not read the NDS offset (and vice versa)', () => {
    const gba = romWithCode(0xac, 'BPEE');
    expect(parseNdsGameCode(gba)).toBeNull();
    const nds = romWithCode(0x0c, 'AMCE');
    expect(parseGbaGameCode(nds)).toBeNull();
  });

  it('returns null for zero-filled and garbage headers', () => {
    expect(parseGbaGameCode(new Uint8Array(0x200))).toBeNull();
    expect(parseGbaGameCode(new Uint8Array(0x200).fill(0xee))).toBeNull();
  });

  it('is safe on short buffers', () => {
    expect(parseGbaGameCode(new Uint8Array(0))).toBeNull();
    expect(parseGbaGameCode(new Uint8Array(0xac))).toBeNull();
    // One byte short of the required 0xB0.
    expect(parseGbaGameCode(romWithCode(0xac, 'BPE', 0xaf))).toBeNull();
  });
});

describe('parseNdsSoftwareVersion', () => {
  /** Builds a synthetic header with `version` at the 0x1E revision byte. */
  function romWithVersion(version: number, size = 0x200): Uint8Array {
    const bytes = new Uint8Array(size);
    bytes[0x1e] = version;
    return bytes;
  }

  it('reads the revision byte at offset 0x1E', () => {
    // Rev 0 is the overwhelmingly common retail case; rev 1 marks re-issues.
    expect(parseNdsSoftwareVersion(romWithVersion(0))).toBe(0);
    expect(parseNdsSoftwareVersion(romWithVersion(1))).toBe(1);
    expect(parseNdsSoftwareVersion(romWithVersion(0xff))).toBe(0xff);
  });

  it('accepts a header-only slice of the minimal length (0x1F bytes)', () => {
    expect(parseNdsSoftwareVersion(romWithVersion(2, 0x1f))).toBe(2);
  });

  it('does not read neighbouring header bytes', () => {
    // flags (0x1D) and flags2 (0x1F) surround the revision byte.
    const bytes = romWithVersion(3);
    bytes[0x1d] = 0xaa;
    bytes[0x1f] = 0xbb;
    expect(parseNdsSoftwareVersion(bytes)).toBe(3);
  });

  it('is safe on short buffers', () => {
    expect(parseNdsSoftwareVersion(new Uint8Array(0))).toBeNull();
    // One byte short of the required 0x1F.
    expect(parseNdsSoftwareVersion(new Uint8Array(0x1e))).toBeNull();
  });
});

describe('parseNdsSupportsDsiMode', () => {
  /** Builds a synthetic header with `unitCode` at offset 0x12. */
  function romWithUnitCode(unitCode: number, size = 0x200): Uint8Array {
    const bytes = new Uint8Array(size);
    bytes[0x12] = unitCode;
    return bytes;
  }

  it('reads bit 1 of the unitCode byte (SupportsDsiMode)', () => {
    // 0x00 DS-only, 0x02 DS+DSi, 0x03 DSi-only — both DSi codes set bit 1.
    expect(parseNdsSupportsDsiMode(romWithUnitCode(0x00))).toBe(false);
    expect(parseNdsSupportsDsiMode(romWithUnitCode(0x02))).toBe(true);
    expect(parseNdsSupportsDsiMode(romWithUnitCode(0x03))).toBe(true);
  });

  it('ignores bit 0 (NOT_SUPPORTS_DS_MODE), which is a different flag', () => {
    // Bit 0 set on its own must not read as DSi capability.
    expect(parseNdsSupportsDsiMode(romWithUnitCode(0x01))).toBe(false);
  });

  it('accepts a header-only slice of the minimal length (0x13 bytes)', () => {
    expect(parseNdsSupportsDsiMode(romWithUnitCode(0x02, 0x13))).toBe(true);
  });

  it('is safe on short buffers', () => {
    expect(parseNdsSupportsDsiMode(new Uint8Array(0))).toBeNull();
    // One byte short of the required 0x13.
    expect(parseNdsSupportsDsiMode(new Uint8Array(0x12))).toBeNull();
  });
});

describe('parseNdsNandBackupRegionStart', () => {
  /** Builds a synthetic header with the u16 `nandBackupRegionStart` at 0x96. */
  function romWithNandStart(value: number, size = 0x200): Uint8Array {
    const bytes = new Uint8Array(size);
    bytes[0x96] = value & 0xff;
    bytes[0x97] = (value >>> 8) & 0xff;
    return bytes;
  }

  it('reads the u16 little-endian value at offset 0x96', () => {
    expect(parseNdsNandBackupRegionStart(romWithNandStart(0))).toBe(0);
    expect(parseNdsNandBackupRegionStart(romWithNandStart(0x0140))).toBe(0x0140);
    expect(parseNdsNandBackupRegionStart(romWithNandStart(0xffff))).toBe(0xffff);
  });

  it('does not read neighbouring header bytes', () => {
    // nandRomRegionEnd (0x94) precedes it and gap98 (0x98) follows it.
    const bytes = romWithNandStart(0x0140);
    bytes[0x94] = 0xaa;
    bytes[0x95] = 0xbb;
    bytes[0x98] = 0xcc;
    expect(parseNdsNandBackupRegionStart(bytes)).toBe(0x0140);
  });

  it('accepts a header-only slice of the minimal length (0x98 bytes)', () => {
    expect(parseNdsNandBackupRegionStart(romWithNandStart(0x0140, 0x98))).toBe(0x0140);
  });

  it('is safe on short buffers', () => {
    expect(parseNdsNandBackupRegionStart(new Uint8Array(0))).toBeNull();
    // One byte short of the required 0x98.
    expect(parseNdsNandBackupRegionStart(new Uint8Array(0x97))).toBeNull();
  });
});

describe('isUsableGameCode', () => {
  it('accepts exactly-4-character printable ASCII codes', () => {
    expect(isUsableGameCode('AMCE')).toBe(true);
    expect(isUsableGameCode('B2KJ')).toBe(true);
    // Range boundaries: '!' (0x21) and '~' (0x7E).
    expect(isUsableGameCode('!~!~')).toBe(true);
    expect(isUsableGameCode('####')).toBe(true);
  });

  it('rejects codes that are not exactly 4 characters', () => {
    expect(isUsableGameCode('')).toBe(false);
    expect(isUsableGameCode('ABC')).toBe(false);
    expect(isUsableGameCode('ABCDE')).toBe(false);
  });

  it('rejects codes containing non-printable or non-ASCII characters', () => {
    expect(isUsableGameCode('AB E')).toBe(false); // space (0x20)
    expect(isUsableGameCode('AB\u0000E')).toBe(false); // NUL
    expect(isUsableGameCode('AB\u001fE')).toBe(false); // below printable range (0x1F)
    expect(isUsableGameCode('AB\u007fE')).toBe(false); // DEL (0x7F)
    expect(isUsableGameCode('ÁBCD')).toBe(false); // non-ASCII 'Á'
  });
});

/**
 * Builds a header from the fields the loader's homebrew and DSiWare tests
 * read. Note `twlFlags` goes at 0x1C: 0x1BF is the unrelated `twlFlags2`. Defaults reproduce a retail cart; the golden values below are the real
 * bytes of Golden Sun - Dark Dawn (BO5E), Mario Clock (KWBE, DSiWare) and a
 * devkitPro homebrew build, read off a DSpico card.
 */
function headerWith({
  maker = 0x3130,
  arm7LoadAddress = 0x02380000,
  arm9Hook = 0x02000a74,
  arm7Hook = 0x02380158,
  twlFlags = 0x60,
  titleIdHigh = 0x00030000,
  publicSav = 0,
  privateSav = 0,
}: Partial<{
  maker: number;
  arm7LoadAddress: number;
  arm9Hook: number;
  arm7Hook: number;
  twlFlags: number;
  titleIdHigh: number;
  publicSav: number;
  privateSav: number;
}> = {}): Uint8Array {
  const bytes = new Uint8Array(0x240);
  const view = new DataView(bytes.buffer);
  view.setUint16(0x10, maker, true);
  view.setUint32(0x38, arm7LoadAddress, true);
  view.setUint32(0x70, arm9Hook, true);
  view.setUint32(0x74, arm7Hook, true);
  bytes[0x1c] = twlFlags;
  view.setUint32(0x234, titleIdHigh, true);
  view.setUint32(0x238, publicSav, true);
  view.setUint32(0x23c, privateSav, true);
  return bytes;
}

describe('parseNdsIsHomebrew', () => {
  it('says no for a retail cart (golden vector: Golden Sun - Dark Dawn)', () => {
    expect(parseNdsIsHomebrew(headerWith())).toBe(false);
  });

  it('catches each of the loader NdsLoader.cpp:171-173 clauses on its own', () => {
    // zero maker code, the devkitPro default
    expect(parseNdsIsHomebrew(headerWith({ maker: 0 }))).toBe(true);
    // both autoload-done hooks zero
    expect(parseNdsIsHomebrew(headerWith({ arm9Hook: 0, arm7Hook: 0 }))).toBe(true);
    // ARM7 binary placed at or above 0x03000000
    expect(parseNdsIsHomebrew(headerWith({ arm7LoadAddress: 0x03000000 }))).toBe(true);
    // one hook alone is NOT enough: the loader ANDs them
    expect(parseNdsIsHomebrew(headerWith({ arm9Hook: 0 }))).toBe(false);
    // and one below the threshold does not trip it either
    expect(parseNdsIsHomebrew(headerWith({ arm7LoadAddress: 0x02ffffff }))).toBe(false);
  });

  it('returns null rather than a guess when the header is too short', () => {
    expect(parseNdsIsHomebrew(new Uint8Array(0x40))).toBeNull();
  });
});

describe('parseNdsIsDsiWare', () => {
  it('says yes for DSiWare (golden vector: Mario Clock, titleId 0x000300044B574245)', () => {
    expect(parseNdsIsDsiWare(headerWith({ twlFlags: 0x01, titleIdHigh: 0x00030004 }))).toBe(true);
  });

  it('needs BOTH the twlFlags bit and the titleId bit, as IsDsiWare() does', () => {
    expect(parseNdsIsDsiWare(headerWith({ twlFlags: 0x01, titleIdHigh: 0x00030000 }))).toBe(false);
    expect(parseNdsIsDsiWare(headerWith({ twlFlags: 0x60, titleIdHigh: 0x00030004 }))).toBe(false);
  });

  it('says no for a retail DS cart', () => {
    expect(parseNdsIsDsiWare(headerWith())).toBe(false);
  });

  it('returns null rather than a guess when the header is too short', () => {
    expect(parseNdsIsDsiWare(new Uint8Array(0x100))).toBeNull();
  });
});

describe('parseNdsDsiWareSaveSizes', () => {
  it('reads the .pub/.prv sizes (golden vector: Mario Clock, 16 KB public, no private)', () => {
    expect(parseNdsDsiWareSaveSizes(headerWith({ publicSav: 0x4000 }))).toEqual({
      publicBytes: 0x4000,
      privateBytes: 0,
    });
  });

  it('reads a private save when the title declares one', () => {
    expect(
      parseNdsDsiWareSaveSizes(headerWith({ publicSav: 0x20000, privateSav: 0x4000 })),
    ).toEqual({ publicBytes: 0x20000, privateBytes: 0x4000 });
  });

  it('returns null when the header is too short', () => {
    expect(parseNdsDsiWareSaveSizes(new Uint8Array(0x200))).toBeNull();
  });
});

describe('NDS_HEADER_PARSE_BYTES', () => {
  it('is enough for every parser here to answer', () => {
    // Guard for a real bug: the gallery used to read 0xb0 bytes, which is past
    // both gamecodes but short of the TWL block, so parseNdsIsDsiWare returned
    // null and the compat sheet declared every ROM's header unreadable. Unit
    // tests missed it because they all pass generous buffers.
    const header = headerWith();
    const slice = header.slice(0, NDS_HEADER_PARSE_BYTES);
    expect(parseNdsGameCode(romWithCode(0x0c, 'BO5E', NDS_HEADER_PARSE_BYTES))).toBe('BO5E');
    expect(parseNdsSoftwareVersion(slice)).not.toBeNull();
    expect(parseNdsSupportsDsiMode(slice)).not.toBeNull();
    expect(parseNdsNandBackupRegionStart(slice)).not.toBeNull();
    expect(parseNdsIsHomebrew(slice)).not.toBeNull();
    expect(parseNdsIsDsiWare(slice)).not.toBeNull();
    expect(parseNdsDsiWareSaveSizes(slice)).not.toBeNull();
  });

  it('is the minimum: one byte less and the deepest parser gives up', () => {
    const short = headerWith().slice(0, NDS_HEADER_PARSE_BYTES - 1);
    expect(parseNdsDsiWareSaveSizes(short)).toBeNull();
  });
});
