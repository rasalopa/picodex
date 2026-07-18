/**
 * NDS banner (version 1) utilities: build `banner.bnr` files for folders,
 * extract/decode/encode 32x32 icons and read/write UTF-16LE titles.
 *
 * Layout of a v1 banner (0x840 bytes):
 * - u16 LE version (= 1)          @ 0x00
 * - u16 LE CRC-16/MODBUS          @ 0x02, computed over bytes [0x20, 0x840)
 * - icon bitmap, 4bpp 32x32       @ 0x20..0x21F (4x4 tiles of 8x8 px, 2 px per
 *   byte, low nibble first)
 * - palette, 16 x BGR555 u16 LE   @ 0x220..0x23F (index 0 is transparent)
 * - six UTF-16LE title slots of 0x100 bytes each, starting @ 0x240
 *   (Japanese, English, French, German, Italian, Spanish)
 *
 * Port of `tools/make_banner.py` (authoritative reference implementation).
 */

/** Total size in bytes of a version-1 NDS banner. */
export const BANNER_SIZE = 0x840;

/** Icon size in pixels (icons are always ICON_SIZE x ICON_SIZE). */
export const ICON_SIZE = 32;

/** Byte length of the 4bpp icon bitmap (32*32 pixels / 2 px per byte). */
export const ICON_BITMAP_SIZE = 0x200;

/** Byte length of the 16-entry BGR555 icon palette. */
export const ICON_PALETTE_SIZE = 0x20;

/** A raw NDS icon: 4bpp tiled bitmap plus 16-color BGR555 palette. */
export interface BannerIcon {
  /** 0x200 bytes: 4bpp pixels, 4x4 tiles of 8x8, low nibble first. */
  bitmap: Uint8Array;
  /** 0x20 bytes: 16 BGR555 colors as u16 LE; index 0 is transparent. */
  palette: Uint8Array;
}

/** Placeholder color stored at palette index 0 (magenta, BGR555). */
const TRANSPARENT_PLACEHOLDER = 0x7c1f;

/** Number of pixels in an icon. */
const PIXEL_COUNT = ICON_SIZE * ICON_SIZE;

/**
 * CRC-16/MODBUS over `bytes`: init 0xFFFF, reflected polynomial 0xA001.
 * This is the checksum used by NDS banner headers.
 *
 * @param bytes - Input data.
 * @returns The 16-bit CRC (0..0xFFFF).
 */
export function crc16(bytes: Uint8Array): number {
  let crc = 0xffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
    }
  }
  return crc;
}

/** Maps a linear tiled pixel index (0..1023) to its {x, y} screen position. */
function tiledIndexToXY(i: number): { x: number; y: number } {
  const tile = i >> 6; // 64 pixels per 8x8 tile
  const offset = i & 63;
  return {
    x: (tile % 4) * 8 + (offset % 8),
    y: (tile >> 2) * 8 + (offset >> 3),
  };
}

/** DataView over exactly the bytes of a (possibly offset) Uint8Array. */
function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * Extracts the icon (bitmap + palette) from the banner of an NDS ROM.
 * The banner offset is read from the u32 LE at 0x68 of the ROM header.
 *
 * @param ndsRom - Full ROM contents (at least the header plus banner).
 * @returns Copies of the icon bitmap and palette, or `null` when the ROM has
 *   no banner (offset 0) or the banner lies outside the provided bytes.
 */
export function extractBannerIcon(ndsRom: Uint8Array): BannerIcon | null {
  if (ndsRom.length < 0x6c) return null;
  const offset = viewOf(ndsRom).getUint32(0x68, true);
  if (offset === 0 || offset + 0x240 > ndsRom.length) return null;
  return {
    bitmap: ndsRom.slice(offset + 0x20, offset + 0x220),
    palette: ndsRom.slice(offset + 0x220, offset + 0x240),
  };
}

/**
 * Decodes a 4bpp tiled icon into 32x32 RGBA pixels.
 * Palette index 0 decodes as fully transparent black; other indices use
 * BGR555 -> RGB888 expansion `(v & 31) << 3` per channel with alpha 255.
 *
 * @param bitmap - 0x200-byte 4bpp tiled bitmap.
 * @param palette - 0x20-byte palette (16 x BGR555 u16 LE).
 * @returns 32*32*4 RGBA bytes in row-major order.
 */
export function decodeBannerIcon(bitmap: Uint8Array, palette: Uint8Array): Uint8ClampedArray {
  if (bitmap.length !== ICON_BITMAP_SIZE) {
    throw new Error(`icon bitmap must be ${ICON_BITMAP_SIZE} bytes, got ${bitmap.length}`);
  }
  if (palette.length !== ICON_PALETTE_SIZE) {
    throw new Error(`icon palette must be ${ICON_PALETTE_SIZE} bytes, got ${palette.length}`);
  }
  const paletteView = viewOf(palette);
  const rgba = new Uint8ClampedArray(PIXEL_COUNT * 4);
  for (let i = 0; i < PIXEL_COUNT; i++) {
    const byte = bitmap[i >> 1];
    const index = i % 2 === 0 ? byte & 0xf : byte >> 4;
    if (index === 0) continue; // transparent: leave (0, 0, 0, 0)
    const { x, y } = tiledIndexToXY(i);
    const color = paletteView.getUint16(index * 2, true);
    const out = (y * ICON_SIZE + x) * 4;
    rgba[out] = (color & 31) << 3;
    rgba[out + 1] = ((color >> 5) & 31) << 3;
    rgba[out + 2] = ((color >> 10) & 31) << 3;
    rgba[out + 3] = 255;
  }
  return rgba;
}

/** An RGB color as a [r, g, b] triple (0..255 per channel). */
type Rgb = readonly [number, number, number];

/** A unique color plus how many pixels use it (median-cut input). */
interface WeightedColor {
  r: number;
  g: number;
  b: number;
  count: number;
}

/** RGB channel keys, used to pick the median-cut split axis. */
const CHANNELS = ['r', 'g', 'b'] as const;

/**
 * Median-cut quantization: reduces `colors` to at most `maxColors`
 * representative colors (weighted channel averages of each final box).
 */
function medianCut(colors: WeightedColor[], maxColors: number): Rgb[] {
  if (colors.length === 0) return [];
  const boxes: WeightedColor[][] = [colors.slice()];
  while (boxes.length < maxColors) {
    // Pick the box with the widest channel range (only splittable boxes).
    let bestBox = -1;
    let bestRange = 0;
    let bestChannel: (typeof CHANNELS)[number] = 'r';
    for (let b = 0; b < boxes.length; b++) {
      const box = boxes[b];
      if (box.length < 2) continue;
      for (const channel of CHANNELS) {
        let min = 255;
        let max = 0;
        for (const c of box) {
          if (c[channel] < min) min = c[channel];
          if (c[channel] > max) max = c[channel];
        }
        if (max - min > bestRange) {
          bestRange = max - min;
          bestBox = b;
          bestChannel = channel;
        }
      }
    }
    if (bestBox < 0) break; // nothing left to split
    const box = boxes[bestBox];
    box.sort((a, b) => a[bestChannel] - b[bestChannel]);
    const total = box.reduce((sum, c) => sum + c.count, 0);
    // Split at the weighted median, keeping both halves non-empty.
    let accumulated = 0;
    let cut = 0;
    for (let i = 0; i < box.length - 1; i++) {
      accumulated += box[i].count;
      cut = i;
      if (accumulated * 2 >= total) break;
    }
    boxes.splice(bestBox, 1, box.slice(0, cut + 1), box.slice(cut + 1));
  }
  return boxes.map((box) => {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (const c of box) {
      r += c.r * c.count;
      g += c.g * c.count;
      b += c.b * c.count;
      n += c.count;
    }
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  });
}

/**
 * Encodes a 32x32 RGBA image as an NDS banner icon.
 * Pixels with alpha >= 128 are opaque; the rest map to transparent index 0.
 * Opaque colors are quantized to at most 15 colors (median cut when there are
 * more than 15 unique colors) assigned to palette indices 1..15; palette
 * index 0 holds a magenta placeholder, as in the reference implementation.
 *
 * @param rgba - 32*32*4 RGBA bytes in row-major order.
 * @returns The 4bpp tiled bitmap and BGR555 palette.
 */
export function encodeBannerIcon(rgba: Uint8Array | Uint8ClampedArray): BannerIcon {
  if (rgba.length !== PIXEL_COUNT * 4) {
    throw new Error(`expected ${PIXEL_COUNT * 4} RGBA bytes, got ${rgba.length}`);
  }

  // Collect opaque pixels: per-pixel packed color key (-1 = transparent)
  // and unique color counts in first-seen order.
  const pixelKeys = new Int32Array(PIXEL_COUNT).fill(-1);
  const counts = new Map<number, number>();
  for (let p = 0; p < PIXEL_COUNT; p++) {
    if (rgba[p * 4 + 3] < 128) continue;
    const key = (rgba[p * 4] << 16) | (rgba[p * 4 + 1] << 8) | rgba[p * 4 + 2];
    pixelKeys[p] = key;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let paletteColors: Rgb[];
  if (counts.size <= 15) {
    paletteColors = [...counts.keys()].map((key) => [
      (key >> 16) & 0xff,
      (key >> 8) & 0xff,
      key & 0xff,
    ]);
  } else {
    const weighted = [...counts.entries()].map(([key, count]) => ({
      r: (key >> 16) & 0xff,
      g: (key >> 8) & 0xff,
      b: key & 0xff,
      count,
    }));
    paletteColors = medianCut(weighted, 15);
  }

  // Map every unique opaque color to its nearest palette entry (1-based).
  const keyToIndex = new Map<number, number>();
  for (const key of counts.keys()) {
    const r = (key >> 16) & 0xff;
    const g = (key >> 8) & 0xff;
    const b = key & 0xff;
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < paletteColors.length; i++) {
      const [pr, pg, pb] = paletteColors[i];
      const distance = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    keyToIndex.set(key, best + 1);
  }

  // Pack pixels into 4x4 tiles of 8x8, two pixels per byte, low nibble first.
  const bitmap = new Uint8Array(ICON_BITMAP_SIZE);
  for (let i = 0; i < PIXEL_COUNT; i++) {
    const { x, y } = tiledIndexToXY(i);
    const key = pixelKeys[y * ICON_SIZE + x];
    const index = key >= 0 ? (keyToIndex.get(key) ?? 0) : 0;
    bitmap[i >> 1] |= i % 2 === 0 ? index : index << 4;
  }

  const palette = new Uint8Array(ICON_PALETTE_SIZE);
  const paletteView = viewOf(palette);
  paletteView.setUint16(0, TRANSPARENT_PLACEHOLDER, true);
  for (let i = 0; i < paletteColors.length; i++) {
    const [r, g, b] = paletteColors[i];
    paletteView.setUint16((i + 1) * 2, (r >> 3) | ((g >> 3) << 5) | ((b >> 3) << 10), true);
  }
  return { bitmap, palette };
}

/**
 * Builds a complete version-1 NDS banner (0x840 bytes) for a folder:
 * the given icon plus the same title in all six language slots.
 * The title is truncated to 127 UTF-16 code units; the header CRC is
 * computed over bytes [0x20, 0x840).
 *
 * @param icon - Icon bitmap (0x200 bytes) and palette (0x20 bytes).
 * @param title - Folder title (shown instead of the folder name).
 * @returns The banner file contents, ready to be written as `banner.bnr`.
 */
export function buildFolderBanner(icon: BannerIcon, title: string): Uint8Array {
  if (icon.bitmap.length !== ICON_BITMAP_SIZE) {
    throw new Error(`icon bitmap must be ${ICON_BITMAP_SIZE} bytes, got ${icon.bitmap.length}`);
  }
  if (icon.palette.length !== ICON_PALETTE_SIZE) {
    throw new Error(`icon palette must be ${ICON_PALETTE_SIZE} bytes, got ${icon.palette.length}`);
  }
  const banner = new Uint8Array(BANNER_SIZE);
  const view = viewOf(banner);
  view.setUint16(0x00, 0x0001, true); // version 1
  banner.set(icon.bitmap, 0x20);
  banner.set(icon.palette, 0x220);
  const units = Math.min(title.length, 127);
  for (let lang = 0; lang < 6; lang++) {
    const base = 0x240 + lang * 0x100;
    for (let i = 0; i < units; i++) {
      view.setUint16(base + i * 2, title.charCodeAt(i), true);
    }
  }
  view.setUint16(0x02, crc16(banner.subarray(0x20)), true);
  return banner;
}

/**
 * Reads a title from a banner's language slots.
 * The string ends at the first NUL code unit (or fills the whole slot).
 *
 * @param banner - A banner of at least 0x840 bytes.
 * @param lang - Language slot 0..5 (0 Japanese, 1 English, 2 French,
 *   3 German, 4 Italian, 5 Spanish). Defaults to English.
 * @returns The decoded UTF-16 title.
 */
export function parseBannerTitle(banner: Uint8Array, lang = 1): string {
  if (!Number.isInteger(lang) || lang < 0 || lang > 5) {
    throw new Error(`language slot must be an integer 0..5, got ${lang}`);
  }
  if (banner.length < BANNER_SIZE) {
    throw new Error(`banner must be at least ${BANNER_SIZE} bytes, got ${banner.length}`);
  }
  const view = viewOf(banner);
  const base = 0x240 + lang * 0x100;
  const units: number[] = [];
  for (let i = 0; i < 0x100 / 2; i++) {
    const unit = view.getUint16(base + i * 2, true);
    if (unit === 0) break;
    units.push(unit);
  }
  return String.fromCharCode(...units);
}
