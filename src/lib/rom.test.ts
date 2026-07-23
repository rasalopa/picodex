import { describe, expect, it } from 'vitest';
import {
  isUsableGameCode,
  parseGbaGameCode,
  parseNdsGameCode,
  parseNdsNandBackupRegionStart,
  parseNdsSoftwareVersion,
  parseNdsSupportsDsiMode,
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
