/**
 * BMP encoding/decoding for DSpico launcher art.
 *
 * Ported from `tools/img2cover.py` (pico-enhanced). The launcher expects covers as
 * 128x96 8bpp indexed BMPs: uncompressed (BI_RGB), 40-byte BITMAPINFOHEADER,
 * 256-entry BGRA palette with `clrUsed = 256`, bottom-up rows. Only the leftmost
 * 106x96 pixels are visible on screen; the caller composes art into that area
 * (columns 106-127 are conventionally black).
 *
 * Browser-compatible: uses only Uint8Array/DataView, no Node APIs.
 */

/** Full width in pixels of a launcher cover BMP (128). */
export const COVER_WIDTH = 128;

/** Full height in pixels of a launcher cover BMP (96). */
export const COVER_HEIGHT = 96;

/** Width in pixels of the cover area the launcher actually displays (106). */
export const COVER_VISIBLE_WIDTH = 106;

const FILE_HEADER_SIZE = 14;
const DIB_HEADER_SIZE = 40;
const PALETTE_ENTRIES = 256;
/** Pixels-per-meter for a 72 DPI image, as written by Pillow and img2cover.py. */
const PPM_72DPI = 2835;

/** A weighted RGB color as accumulated from the source image. */
interface ColorEntry {
  r: number;
  g: number;
  b: number;
  /** Number of source pixels with this exact color. */
  count: number;
}

/** Packs an RGB triple into a single integer map key. */
function colorKey(r: number, g: number, b: number): number {
  return (r << 16) | (g << 8) | b;
}

/**
 * Collects the unique opaque colors of an RGBA buffer with their pixel counts.
 * Alpha is ignored (covers are always opaque).
 */
function collectColors(rgba: Uint8ClampedArray | Uint8Array, pixelCount: number): ColorEntry[] {
  const counts = new Map<number, ColorEntry>();
  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4;
    const r = rgba[o];
    const g = rgba[o + 1];
    const b = rgba[o + 2];
    const key = colorKey(r, g, b);
    const entry = counts.get(key);
    if (entry) {
      entry.count++;
    } else {
      counts.set(key, { r, g, b, count: 1 });
    }
  }
  return [...counts.values()];
}

/** One median-cut box: a slice of color entries plus its channel ranges. */
interface Box {
  entries: ColorEntry[];
  rangeR: number;
  rangeG: number;
  rangeB: number;
}

/** Computes channel ranges for a set of entries and wraps them in a Box. */
function makeBox(entries: ColorEntry[]): Box {
  let minR = 255,
    maxR = 0,
    minG = 255,
    maxG = 0,
    minB = 255,
    maxB = 0;
  for (const e of entries) {
    if (e.r < minR) minR = e.r;
    if (e.r > maxR) maxR = e.r;
    if (e.g < minG) minG = e.g;
    if (e.g > maxG) maxG = e.g;
    if (e.b < minB) minB = e.b;
    if (e.b > maxB) maxB = e.b;
  }
  return { entries, rangeR: maxR - minR, rangeG: maxG - minG, rangeB: maxB - minB };
}

/** Largest channel range of a box; 0 means the box cannot be split further. */
function boxSpread(box: Box): number {
  return Math.max(box.rangeR, box.rangeG, box.rangeB);
}

/**
 * Splits a box at the weighted median of its dominant channel.
 * Returns the two halves; both are guaranteed non-empty.
 */
function splitBox(box: Box): [Box, Box] {
  const { entries, rangeR, rangeG, rangeB } = box;
  let channel: keyof Pick<ColorEntry, 'r' | 'g' | 'b'>;
  if (rangeR >= rangeG && rangeR >= rangeB) channel = 'r';
  else if (rangeG >= rangeB) channel = 'g';
  else channel = 'b';

  const sorted = [...entries].sort((a, e) => a[channel] - e[channel]);
  let total = 0;
  for (const e of sorted) total += e.count;

  let acc = 0;
  let cut = 1; // ensure at least one entry on the left
  for (let i = 0; i < sorted.length - 1; i++) {
    acc += sorted[i].count;
    if (acc * 2 >= total) {
      cut = i + 1;
      break;
    }
    cut = i + 1;
  }
  return [makeBox(sorted.slice(0, cut)), makeBox(sorted.slice(cut))];
}

/**
 * Median-cut quantization of a list of weighted colors down to at most
 * `maxColors` representative colors. When the input already has `maxColors`
 * or fewer unique colors the result is exactly those colors (lossless).
 */
function medianCut(entries: ColorEntry[], maxColors: number): Array<[number, number, number]> {
  const boxes: Box[] = [makeBox(entries)];
  while (boxes.length < maxColors) {
    // Pick the splittable box with the widest channel range.
    let bestIndex = -1;
    let bestSpread = 0;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].entries.length < 2) continue;
      const spread = boxSpread(boxes[i]);
      if (spread >= bestSpread) {
        bestSpread = spread;
        bestIndex = i;
      }
    }
    if (bestIndex < 0) break; // every box is a single color
    const [left, right] = splitBox(boxes[bestIndex]);
    boxes[bestIndex] = left;
    boxes.push(right);
  }

  return boxes.map((box) => {
    let r = 0,
      g = 0,
      b = 0,
      count = 0;
    for (const e of box.entries) {
      r += e.r * e.count;
      g += e.g * e.count;
      b += e.b * e.count;
      count += e.count;
    }
    return [Math.round(r / count), Math.round(g / count), Math.round(b / count)];
  });
}

/** Index of the palette color nearest (squared RGB distance) to r/g/b. */
function nearestPaletteIndex(
  palette: Array<[number, number, number]>,
  r: number,
  g: number,
  b: number,
): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const dr = palette[i][0] - r;
    const dg = palette[i][1] - g;
    const db = palette[i][2] - b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

/**
 * Encodes an RGBA image as a DSpico launcher cover BMP: 8bpp indexed,
 * uncompressed, 40-byte BITMAPINFOHEADER, 256-entry palette (`clrUsed = 256`),
 * bottom-up rows padded to 4-byte multiples.
 *
 * Colors are reduced to at most 256 with a median-cut quantizer (no dithering).
 * Inputs with 256 or fewer unique colors are encoded losslessly.
 *
 * @param rgba - Pixel data, 4 bytes per pixel (RGBA), row-major, top-down.
 *   Alpha is ignored; covers are opaque. Callers compose the art into the
 *   visible {@link COVER_VISIBLE_WIDTH}x{@link COVER_HEIGHT} area beforehand.
 * @param width - Image width in pixels (defaults to {@link COVER_WIDTH}).
 * @param height - Image height in pixels (defaults to {@link COVER_HEIGHT}).
 * @returns The complete BMP file bytes.
 */
export function encodeCoverBmp(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number = COVER_WIDTH,
  height: number = COVER_HEIGHT,
): Uint8Array {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`Invalid dimensions ${width}x${height}`);
  }
  const pixelCount = width * height;
  if (rgba.length !== pixelCount * 4) {
    throw new Error(
      `RGBA buffer length ${rgba.length} does not match ${width}x${height} (expected ${pixelCount * 4})`,
    );
  }

  const palette = medianCut(collectColors(rgba, pixelCount), PALETTE_ENTRIES);

  // Map each unique source color to its palette index (memoized nearest lookup).
  const indexCache = new Map<number, number>();
  const indices = new Uint8Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4;
    const key = colorKey(rgba[o], rgba[o + 1], rgba[o + 2]);
    let index = indexCache.get(key);
    if (index === undefined) {
      index = nearestPaletteIndex(palette, rgba[o], rgba[o + 1], rgba[o + 2]);
      indexCache.set(key, index);
    }
    indices[i] = index;
  }

  const rowSize = (width + 3) & ~3; // 8bpp rows padded to 4-byte multiples
  const imageSize = rowSize * height;
  const dataOffset = FILE_HEADER_SIZE + DIB_HEADER_SIZE + PALETTE_ENTRIES * 4;
  const out = new Uint8Array(dataOffset + imageSize);
  const view = new DataView(out.buffer);

  // BITMAPFILEHEADER
  out[0] = 0x42; // 'B'
  out[1] = 0x4d; // 'M'
  view.setUint32(2, out.length, true);
  view.setUint32(10, dataOffset, true);

  // BITMAPINFOHEADER
  view.setUint32(14, DIB_HEADER_SIZE, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // positive: bottom-up
  view.setUint16(26, 1, true); // planes
  view.setUint16(28, 8, true); // bits per pixel
  view.setUint32(30, 0, true); // BI_RGB (uncompressed)
  view.setUint32(34, imageSize, true);
  view.setInt32(38, PPM_72DPI, true);
  view.setInt32(42, PPM_72DPI, true);
  view.setUint32(46, PALETTE_ENTRIES, true); // clrUsed
  view.setUint32(50, 0, true); // clrImportant

  // Palette: BGRA quads; entries beyond the quantized colors stay zeroed.
  for (let i = 0; i < palette.length; i++) {
    const o = FILE_HEADER_SIZE + DIB_HEADER_SIZE + i * 4;
    out[o] = palette[i][2];
    out[o + 1] = palette[i][1];
    out[o + 2] = palette[i][0];
  }

  // Pixel rows, bottom-up (padding bytes stay zeroed).
  for (let storedRow = 0; storedRow < height; storedRow++) {
    const imageRow = height - 1 - storedRow;
    out.set(
      indices.subarray(imageRow * width, imageRow * width + width),
      dataOffset + storedRow * rowSize,
    );
  }

  return out;
}

/** Result of {@link decodeBmp}: dimensions plus top-down RGBA pixel data. */
export interface DecodedBmp {
  /** Image width in pixels. */
  width: number;
  /** Image height in pixels (always positive, even for top-down files). */
  height: number;
  /** Pixel data, 4 bytes per pixel (RGBA), row-major, top-down, alpha = 255. */
  rgba: Uint8ClampedArray;
}

/**
 * Decodes an indexed BMP (8bpp or 4bpp, uncompressed) to top-down RGBA pixels.
 *
 * Supports bottom-up (positive height) and top-down (negative height) files,
 * any BITMAPINFOHEADER-family DIB header (size >= 40), and `clrUsed = 0`
 * (meaning a full 2^bpp palette). Pixel indices outside the palette decode as
 * opaque black. Used to preview existing covers and icons from the SD card.
 *
 * @param bytes - The complete BMP file bytes.
 * @returns The decoded dimensions and RGBA data.
 * @throws Error if the file is truncated, not a BMP, compressed, or not 4/8bpp.
 */
export function decodeBmp(bytes: Uint8Array): DecodedBmp {
  if (bytes.length < FILE_HEADER_SIZE + DIB_HEADER_SIZE) {
    throw new Error(`File too small to be a BMP (${bytes.length} bytes)`);
  }
  if (bytes[0] !== 0x42 || bytes[1] !== 0x4d) {
    throw new Error("Not a BMP file (missing 'BM' magic)");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const dataOffset = view.getUint32(10, true);
  const dibSize = view.getUint32(14, true);
  if (dibSize < DIB_HEADER_SIZE) {
    throw new Error(`Unsupported DIB header size ${dibSize} (need BITMAPINFOHEADER or later)`);
  }
  const width = view.getInt32(18, true);
  const rawHeight = view.getInt32(22, true);
  const bitsPerPixel = view.getUint16(28, true);
  const compression = view.getUint32(30, true);
  const clrUsed = view.getUint32(46, true);

  if (width <= 0 || rawHeight === 0) {
    throw new Error(`Invalid BMP dimensions ${width}x${rawHeight}`);
  }
  if (bitsPerPixel !== 8 && bitsPerPixel !== 4) {
    throw new Error(`Unsupported BMP bit depth ${bitsPerPixel} (only 4bpp and 8bpp)`);
  }
  if (compression !== 0) {
    throw new Error(`Unsupported BMP compression ${compression} (only uncompressed BI_RGB)`);
  }

  const topDown = rawHeight < 0;
  const height = Math.abs(rawHeight);
  const paletteCount = clrUsed !== 0 ? clrUsed : 1 << bitsPerPixel;
  const paletteOffset = FILE_HEADER_SIZE + dibSize;
  if (paletteOffset + paletteCount * 4 > bytes.length) {
    throw new Error('Truncated BMP: palette extends past end of file');
  }

  const rowSize = (((width * bitsPerPixel + 31) / 32) | 0) * 4;
  if (dataOffset + rowSize * height > bytes.length) {
    throw new Error('Truncated BMP: pixel data extends past end of file');
  }

  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const storedRow = topDown ? y : height - 1 - y;
    const rowOffset = dataOffset + storedRow * rowSize;
    for (let x = 0; x < width; x++) {
      let index: number;
      if (bitsPerPixel === 8) {
        index = bytes[rowOffset + x];
      } else {
        const packed = bytes[rowOffset + (x >> 1)];
        index = x % 2 === 0 ? packed >> 4 : packed & 0x0f;
      }
      const o = (y * width + x) * 4;
      if (index < paletteCount) {
        const p = paletteOffset + index * 4;
        rgba[o] = bytes[p + 2]; // R
        rgba[o + 1] = bytes[p + 1]; // G
        rgba[o + 2] = bytes[p]; // B
      }
      rgba[o + 3] = 255;
    }
  }

  return { width, height, rgba };
}
