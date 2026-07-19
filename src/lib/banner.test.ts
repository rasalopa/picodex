import { describe, expect, it } from 'vitest';
import {
  BANNER_SIZE,
  buildFolderBanner,
  crc16,
  decodeBannerIcon,
  encodeBannerIcon,
  extractBannerIcon,
  parseBannerTitle,
  parseBnrIcon,
} from './banner';

/** Little-endian u16 read straight from a byte array. */
function readU16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

/** Builds a 32x32 RGBA image from a per-pixel color callback. */
function makeRgba(
  pixel: (x: number, y: number) => [number, number, number, number],
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(32 * 32 * 4);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const [r, g, b, a] = pixel(x, y);
      rgba.set([r, g, b, a], (y * 32 + x) * 4);
    }
  }
  return rgba;
}

/** A single opaque pure-red pixel at (x, y) on a transparent canvas. */
function singlePixelImage(px: number, py: number): Uint8ClampedArray {
  return makeRgba((x, y) => (x === px && y === py ? [248, 0, 0, 255] : [0, 0, 0, 0]));
}

describe('crc16', () => {
  it('matches the CRC-16/MODBUS check value for "123456789"', () => {
    const data = new TextEncoder().encode('123456789');
    expect(crc16(data)).toBe(0x4b37);
  });

  it('returns the init value 0xFFFF for empty input', () => {
    expect(crc16(new Uint8Array(0))).toBe(0xffff);
  });

  it('matches reference values for other inputs', () => {
    // Golden values computed with tools/make_banner.py crc16().
    expect(crc16(new Uint8Array([0x00]))).toBe(0x40bf);
    expect(crc16(new Uint8Array([0xff, 0xff, 0xff, 0xff]))).toBe(0xb001);
  });
});

describe('buildFolderBanner', () => {
  const bitmap = Uint8Array.from({ length: 0x200 }, (_, i) => (i * 7 + 1) & 0xff);
  const palette = Uint8Array.from({ length: 0x20 }, (_, i) => (i * 13 + 5) & 0xff);

  it('reproduces the Python reference banner byte-for-byte (golden CRC)', () => {
    // make_banner.py with this exact bitmap/palette/title stores CRC 0xAEA1
    // and these UTF-16LE bytes at the start of the first title slot.
    const banner = buildFolderBanner({ bitmap, palette }, 'PicoDex Test');
    expect(banner.length).toBe(BANNER_SIZE);
    expect(readU16(banner, 0x02)).toBe(0xaea1);
    const slot0 = [...banner.subarray(0x240, 0x250)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(slot0).toBe('5000690063006f004400650078002000');
  });

  it('round-trips: version, icon placement, valid CRC, parseable title', () => {
    const banner = buildFolderBanner({ bitmap, palette }, 'Juegos NDS');
    expect(readU16(banner, 0x00)).toBe(1); // version
    expect(banner.subarray(0x20, 0x220)).toEqual(bitmap);
    expect(banner.subarray(0x220, 0x240)).toEqual(palette);
    // Stored CRC must validate against the [0x20, 0x840) region.
    expect(readU16(banner, 0x02)).toBe(crc16(banner.subarray(0x20)));
    // Same title in all six language slots.
    for (let lang = 0; lang < 6; lang++) {
      expect(parseBannerTitle(banner, lang)).toBe('Juegos NDS');
    }
    expect(parseBannerTitle(banner)).toBe('Juegos NDS'); // default lang = 1
  });

  it('truncates the title to 127 UTF-16 code units', () => {
    const long = 'x'.repeat(200);
    const banner = buildFolderBanner({ bitmap, palette }, long);
    expect(parseBannerTitle(banner)).toBe('x'.repeat(127));
  });

  it('rejects icons with wrong sizes', () => {
    expect(() => buildFolderBanner({ bitmap: new Uint8Array(10), palette }, 't')).toThrow();
    expect(() => buildFolderBanner({ bitmap, palette: new Uint8Array(10) }, 't')).toThrow();
  });
});

describe('parseBannerTitle', () => {
  it('stops at the first NUL code unit', () => {
    const banner = buildFolderBanner(
      { bitmap: new Uint8Array(0x200), palette: new Uint8Array(0x20) },
      'AB',
    );
    // Slot is zero-padded after "AB", so trailing NULs must not leak in.
    expect(parseBannerTitle(banner, 1)).toBe('AB');
    expect(parseBannerTitle(banner, 1)).toHaveLength(2);
  });

  it('rejects out-of-range language slots and short buffers', () => {
    const banner = new Uint8Array(BANNER_SIZE);
    expect(() => parseBannerTitle(banner, 6)).toThrow();
    expect(() => parseBannerTitle(banner, -1)).toThrow();
    expect(() => parseBannerTitle(new Uint8Array(0x100))).toThrow();
  });
});

describe('encodeBannerIcon / decodeBannerIcon', () => {
  it('round-trips a 4-color image with transparency exactly', () => {
    // Channel values that survive BGR555 (multiples of 8, max 248).
    const colors: Array<[number, number, number]> = [
      [248, 0, 0],
      [0, 248, 0],
      [0, 0, 248],
      [248, 248, 248],
    ];
    const rgba = makeRgba((x, y) => {
      if ((x + y) % 7 === 0) return [0, 0, 0, 0]; // transparent
      const quadrant = (y < 16 ? 0 : 2) + (x < 16 ? 0 : 1);
      const [r, g, b] = colors[quadrant];
      return [r, g, b, 255];
    });
    const icon = encodeBannerIcon(rgba);
    expect(icon.bitmap.length).toBe(0x200);
    expect(icon.palette.length).toBe(0x20);
    expect(decodeBannerIcon(icon.bitmap, icon.palette)).toEqual(rgba);
  });

  it('treats alpha >= 128 as opaque and alpha < 128 as transparent', () => {
    const rgba = makeRgba((x) => (x === 0 ? [248, 0, 0, 128] : [248, 0, 0, 127]));
    const { bitmap, palette } = encodeBannerIcon(rgba);
    const decoded = decodeBannerIcon(bitmap, palette);
    expect(decoded[3]).toBe(255); // (0, 0): alpha 128 -> opaque
    expect(decoded[7]).toBe(0); // (1, 0): alpha 127 -> transparent
  });

  it('writes the magenta placeholder at palette index 0', () => {
    const { palette } = encodeBannerIcon(new Uint8ClampedArray(32 * 32 * 4));
    expect(readU16(palette, 0)).toBe(0x7c1f);
  });

  it('quantizes >15 unique colors down to at most 15 palette entries', () => {
    // 32 distinct opaque colors: a red/green gradient per column.
    const rgba = makeRgba((x) => [x * 8, 248 - x * 8, 0, 255]);
    const { bitmap, palette } = encodeBannerIcon(rgba);
    const used = new Set<number>();
    for (const byte of bitmap) {
      used.add(byte & 0xf);
      used.add(byte >> 4);
    }
    expect(used.has(0)).toBe(false); // every pixel is opaque
    expect(Math.max(...used)).toBeLessThanOrEqual(15);
    expect(Math.min(...used)).toBeGreaterThanOrEqual(1);
    expect(readU16(palette, 0)).toBe(0x7c1f);
    // All pixels must decode as opaque.
    const decoded = decodeBannerIcon(bitmap, palette);
    for (let p = 0; p < 32 * 32; p++) expect(decoded[p * 4 + 3]).toBe(255);
  });

  it('rejects wrong input sizes', () => {
    expect(() => encodeBannerIcon(new Uint8ClampedArray(16))).toThrow();
    expect(() => decodeBannerIcon(new Uint8Array(1), new Uint8Array(0x20))).toThrow();
    expect(() => decodeBannerIcon(new Uint8Array(0x200), new Uint8Array(1))).toThrow();
  });
});

describe('icon tiling math', () => {
  it('encode: pixel (0,0) lands in byte 0, low nibble', () => {
    const { bitmap } = encodeBannerIcon(singlePixelImage(0, 0));
    expect(bitmap[0] & 0xf).toBe(1);
    expect(bitmap[0] >> 4).toBe(0);
    expect(bitmap.slice(1).every((b) => b === 0)).toBe(true);
  });

  it('encode: pixel (1,0) lands in byte 0, high nibble', () => {
    const { bitmap } = encodeBannerIcon(singlePixelImage(1, 0));
    expect(bitmap[0] & 0xf).toBe(0);
    expect(bitmap[0] >> 4).toBe(1);
  });

  it('encode: pixel (8,0) lands in tile 1 (byte 32, low nibble)', () => {
    const { bitmap } = encodeBannerIcon(singlePixelImage(8, 0));
    expect(bitmap[0]).toBe(0);
    expect(bitmap[32] & 0xf).toBe(1);
  });

  it('encode: pixel (0,8) lands in tile 4 (byte 128, low nibble)', () => {
    const { bitmap } = encodeBannerIcon(singlePixelImage(0, 8));
    expect(bitmap[128] & 0xf).toBe(1);
  });

  it('decode: bitmap bytes map back to the expected screen pixels', () => {
    const palette = new Uint8Array(0x20);
    palette[2] = 0x1f; // index 1 = BGR555 0x001F = pure red (248, 0, 0)
    const bitmap = new Uint8Array(0x200);
    bitmap[0] = 0x10; // pixel (1,0) via high nibble of byte 0
    bitmap[32] = 0x01; // pixel (8,0) via low nibble of tile 1
    const rgba = decodeBannerIcon(bitmap, palette);
    const at = (x: number, y: number) => [...rgba.subarray((y * 32 + x) * 4, (y * 32 + x) * 4 + 4)];
    expect(at(0, 0)).toEqual([0, 0, 0, 0]);
    expect(at(1, 0)).toEqual([248, 0, 0, 255]);
    expect(at(8, 0)).toEqual([248, 0, 0, 255]);
  });
});

describe('parseBnrIcon', () => {
  const bitmap = Uint8Array.from({ length: 0x200 }, (_, i) => (i * 3 + 2) & 0xff);
  const palette = Uint8Array.from({ length: 0x20 }, (_, i) => 0x40 + i);

  it('round-trips the icon of a banner built with buildFolderBanner', () => {
    const banner = buildFolderBanner({ bitmap, palette }, 'Retro Folder');
    const icon = parseBnrIcon(banner);
    expect(icon).not.toBeNull();
    expect(icon!.bitmap).toEqual(bitmap);
    expect(icon!.palette).toEqual(palette);
  });

  it('returns copies, not views into the banner', () => {
    const banner = buildFolderBanner({ bitmap, palette }, 'Retro Folder');
    const icon = parseBnrIcon(banner)!;
    icon.bitmap[0] = 0xee;
    icon.palette[0] = 0xee;
    expect(banner[0x20]).toBe(bitmap[0]);
    expect(banner[0x220]).toBe(palette[0]);
  });

  it('returns null for buffers shorter than a complete banner', () => {
    expect(parseBnrIcon(new Uint8Array(0))).toBeNull();
    expect(parseBnrIcon(new Uint8Array(BANNER_SIZE - 1))).toBeNull();
  });
});

describe('extractBannerIcon', () => {
  /** A minimal fake ROM: header + banner at `bannerOffset`. */
  function makeRom(bannerOffset: number): {
    rom: Uint8Array;
    bitmap: Uint8Array;
    palette: Uint8Array;
  } {
    const bitmap = Uint8Array.from({ length: 0x200 }, (_, i) => i & 0xff);
    const palette = Uint8Array.from({ length: 0x20 }, (_, i) => 0xa0 + i);
    const rom = new Uint8Array(bannerOffset + 0x840);
    new DataView(rom.buffer).setUint32(0x68, bannerOffset, true);
    rom.set(bitmap, bannerOffset + 0x20);
    rom.set(palette, bannerOffset + 0x220);
    return { rom, bitmap, palette };
  }

  it('reads the icon at the header-declared banner offset', () => {
    const { rom, bitmap, palette } = makeRom(0x200);
    const icon = extractBannerIcon(rom);
    expect(icon).not.toBeNull();
    expect(icon!.bitmap).toEqual(bitmap);
    expect(icon!.palette).toEqual(palette);
  });

  it('returns copies, not views into the ROM', () => {
    const { rom } = makeRom(0x200);
    const icon = extractBannerIcon(rom)!;
    icon.bitmap[0] = 0xee;
    expect(rom[0x220]).toBe(0);
  });

  it('returns null when the ROM declares no banner (offset 0)', () => {
    const { rom } = makeRom(0x200);
    new DataView(rom.buffer).setUint32(0x68, 0, true);
    expect(extractBannerIcon(rom)).toBeNull();
  });

  it('returns null when the banner lies beyond the ROM bytes', () => {
    const { rom } = makeRom(0x200);
    const truncated = rom.slice(0, 0x200 + 0x100); // cuts into the banner
    expect(extractBannerIcon(truncated)).toBeNull();
  });

  it('returns null for ROMs shorter than the header field', () => {
    expect(extractBannerIcon(new Uint8Array(0x40))).toBeNull();
  });

  it('round-trips through buildFolderBanner placed inside a ROM image', () => {
    const source = makeRom(0x200);
    const icon = extractBannerIcon(source.rom)!;
    const banner = buildFolderBanner(icon, 'Retro');
    // Embed the built banner into a fresh ROM and extract it again.
    const rom = new Uint8Array(0x400 + BANNER_SIZE);
    new DataView(rom.buffer).setUint32(0x68, 0x400, true);
    rom.set(banner, 0x400);
    const again = extractBannerIcon(rom)!;
    expect(again.bitmap).toEqual(source.bitmap);
    expect(again.palette).toEqual(source.palette);
  });
});
