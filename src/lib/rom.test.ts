import { describe, expect, it } from 'vitest';
import { isUsableGameCode, parseGbaGameCode, parseNdsGameCode } from './rom.ts';

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
