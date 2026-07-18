import { describe, expect, it } from 'vitest';
import { COVER_HEIGHT, COVER_VISIBLE_WIDTH, COVER_WIDTH, decodeBmp, encodeCoverBmp } from './bmp';

/** Builds a 128x96 RGBA gradient with thousands of unique colors. */
function makeGradient(width = COVER_WIDTH, height = COVER_HEIGHT): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      rgba[o] = Math.round((x / (width - 1)) * 255);
      rgba[o + 1] = Math.round((y / (height - 1)) * 255);
      rgba[o + 2] = Math.round(((x + y) / (width + height - 2)) * 255);
      rgba[o + 3] = 255;
    }
  }
  return rgba;
}

/** Builds an RGBA image split into four solid-color quadrants. */
function makeQuadrants(width: number, height: number): Uint8ClampedArray {
  const colors: Array<[number, number, number]> = [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 255],
  ];
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const quadrant = (y < height / 2 ? 0 : 2) + (x < width / 2 ? 0 : 1);
      const [r, g, b] = colors[quadrant];
      const o = (y * width + x) * 4;
      rgba[o] = r;
      rgba[o + 1] = g;
      rgba[o + 2] = b;
      rgba[o + 3] = 255;
    }
  }
  return rgba;
}

describe('constants', () => {
  it('match the launcher cover format', () => {
    expect(COVER_WIDTH).toBe(128);
    expect(COVER_HEIGHT).toBe(96);
    expect(COVER_VISIBLE_WIDTH).toBe(106);
  });
});

describe('encodeCoverBmp', () => {
  it('writes the exact header img2cover.py writes', () => {
    const bmp = encodeCoverBmp(makeGradient());
    const view = new DataView(bmp.buffer, bmp.byteOffset, bmp.byteLength);

    expect(bmp[0]).toBe(0x42); // 'B'
    expect(bmp[1]).toBe(0x4d); // 'M'

    const dataOffset = 14 + 40 + 256 * 4; // 1078
    const imageSize = 128 * 96; // row stride 128 is already a multiple of 4
    expect(view.getUint32(2, true)).toBe(dataOffset + imageSize); // file size
    expect(view.getUint32(10, true)).toBe(dataOffset);
    expect(view.getUint32(14, true)).toBe(40); // BITMAPINFOHEADER
    expect(view.getInt32(18, true)).toBe(128); // width
    expect(view.getInt32(22, true)).toBe(96); // height, positive = bottom-up
    expect(view.getUint16(26, true)).toBe(1); // planes
    expect(view.getUint16(28, true)).toBe(8); // bpp
    expect(view.getUint32(30, true)).toBe(0); // BI_RGB
    expect(view.getUint32(34, true)).toBe(imageSize);
    expect(view.getInt32(38, true)).toBe(2835); // x pixels/meter
    expect(view.getInt32(42, true)).toBe(2835); // y pixels/meter
    expect(view.getUint32(46, true)).toBe(256); // clrUsed
    expect(view.getUint32(50, true)).toBe(0); // clrImportant
    expect(bmp.length).toBe(dataOffset + imageSize);
  });

  it('round-trips a low-color image losslessly', () => {
    const original = makeQuadrants(COVER_WIDTH, COVER_HEIGHT);
    const decoded = decodeBmp(encodeCoverBmp(original));

    expect(decoded.width).toBe(COVER_WIDTH);
    expect(decoded.height).toBe(COVER_HEIGHT);
    // Only 4 unique colors: median cut keeps them exactly, so the round trip
    // must be bit-identical (this also proves the bottom-up flip is symmetric).
    expect(decoded.rgba).toEqual(original);
  });

  it('round-trips a smooth gradient within quantization tolerance', () => {
    const original = makeGradient();
    const decoded = decodeBmp(encodeCoverBmp(original));

    let maxDiff = 0;
    let totalDiff = 0;
    for (let i = 0; i < original.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const diff = Math.abs(decoded.rgba[i + c] - original[i + c]);
        if (diff > maxDiff) maxDiff = diff;
        totalDiff += diff;
      }
    }
    const meanDiff = totalDiff / ((original.length / 4) * 3);
    expect(maxDiff).toBeLessThanOrEqual(32);
    expect(meanDiff).toBeLessThanOrEqual(8);
    expect(decoded.rgba[3]).toBe(255); // opaque output
  });

  it('never uses more than 256 palette indices', () => {
    const bmp = encodeCoverBmp(makeGradient());
    const dataOffset = new DataView(bmp.buffer).getUint32(10, true);
    const indices = new Set<number>();
    for (let i = dataOffset; i < bmp.length; i++) indices.add(bmp[i]);
    expect(indices.size).toBeLessThanOrEqual(256);
  });

  it('pads rows of non-multiple-of-4 widths and still round-trips', () => {
    // Width 5 -> 8-byte stride; regression for stride math on odd sizes.
    const width = 5;
    const height = 3;
    const original = makeQuadrants(width, height);
    const bmp = encodeCoverBmp(original, width, height);
    const view = new DataView(bmp.buffer, bmp.byteOffset, bmp.byteLength);

    expect(view.getUint32(34, true)).toBe(8 * height); // imageSize uses stride 8
    expect(bmp.length).toBe(14 + 40 + 256 * 4 + 8 * height);

    const decoded = decodeBmp(bmp);
    expect(decoded.width).toBe(width);
    expect(decoded.height).toBe(height);
    expect(decoded.rgba).toEqual(original);
  });

  it('stores rows bottom-up', () => {
    // 4x4: top row red, everything else black.
    const width = 4;
    const height = 4;
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
    for (let x = 0; x < width; x++) rgba[x * 4] = 255; // top row red

    const bmp = encodeCoverBmp(rgba, width, height);
    const view = new DataView(bmp.buffer, bmp.byteOffset, bmp.byteLength);
    const dataOffset = view.getUint32(10, true);
    const paletteOffset = 14 + 40;

    // The image's top row must be the LAST stored row.
    const lastRowIndex = bmp[dataOffset + (height - 1) * width];
    const p = paletteOffset + lastRowIndex * 4;
    expect([bmp[p + 2], bmp[p + 1], bmp[p]]).toEqual([255, 0, 0]); // BGR -> red

    const firstRowIndex = bmp[dataOffset];
    const q = paletteOffset + firstRowIndex * 4;
    expect([bmp[q + 2], bmp[q + 1], bmp[q]]).toEqual([0, 0, 0]); // bottom row black
  });

  it('rejects a buffer that does not match the dimensions', () => {
    expect(() => encodeCoverBmp(new Uint8ClampedArray(16), 128, 96)).toThrow(/does not match/);
    expect(() => encodeCoverBmp(new Uint8ClampedArray(0), 0, 0)).toThrow(/Invalid dimensions/);
  });
});

/** Hand-builds a tiny indexed BMP for decoder tests. */
function buildBmp(options: {
  width: number;
  height: number; // negative for top-down
  bitsPerPixel: 4 | 8;
  clrUsed: number;
  palette: Array<[number, number, number]>; // RGB
  rows: number[][]; // palette indices per STORED row
}): Uint8Array {
  const { width, height, bitsPerPixel, clrUsed, palette, rows } = options;
  const paletteCount = palette.length;
  const rowSize = Math.floor((width * bitsPerPixel + 31) / 32) * 4;
  const dataOffset = 14 + 40 + paletteCount * 4;
  const out = new Uint8Array(dataOffset + rowSize * rows.length);
  const view = new DataView(out.buffer);

  out[0] = 0x42;
  out[1] = 0x4d;
  view.setUint32(2, out.length, true);
  view.setUint32(10, dataOffset, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, bitsPerPixel, true);
  view.setUint32(30, 0, true);
  view.setUint32(34, rowSize * rows.length, true);
  view.setUint32(46, clrUsed, true);

  palette.forEach(([r, g, b], i) => {
    out[14 + 40 + i * 4] = b;
    out[14 + 40 + i * 4 + 1] = g;
    out[14 + 40 + i * 4 + 2] = r;
  });

  rows.forEach((row, rowIndex) => {
    const offset = dataOffset + rowIndex * rowSize;
    if (bitsPerPixel === 8) {
      row.forEach((index, x) => {
        out[offset + x] = index;
      });
    } else {
      row.forEach((index, x) => {
        out[offset + (x >> 1)] |= x % 2 === 0 ? index << 4 : index;
      });
    }
  });

  return out;
}

const RED: [number, number, number] = [255, 0, 0];
const GREEN: [number, number, number] = [0, 200, 0];
const BLUE: [number, number, number] = [16, 32, 255];

describe('decodeBmp', () => {
  it('decodes a hand-built 4bpp bottom-up BMP (icon format)', () => {
    // 4x2 image; stored bottom-up, so stored row 0 is the image's BOTTOM row.
    const bmp = buildBmp({
      width: 4,
      height: 2,
      bitsPerPixel: 4,
      clrUsed: 3,
      palette: [RED, GREEN, BLUE],
      rows: [
        [2, 2, 1, 0], // image bottom row: blue blue green red
        [0, 1, 2, 1], // image top row: red green blue green
      ],
    });

    const { width, height, rgba } = decodeBmp(bmp);
    expect(width).toBe(4);
    expect(height).toBe(2);

    const expected = [RED, GREEN, BLUE, GREEN, BLUE, BLUE, GREEN, RED];
    expected.forEach(([r, g, b], i) => {
      expect([rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2], rgba[i * 4 + 3]]).toEqual([
        r,
        g,
        b,
        255,
      ]);
    });
  });

  it('decodes 4bpp odd widths (last high nibble, padded row)', () => {
    // Width 3: second byte of each row only uses its high nibble.
    const bmp = buildBmp({
      width: 3,
      height: 1,
      bitsPerPixel: 4,
      clrUsed: 3,
      palette: [RED, GREEN, BLUE],
      rows: [[1, 0, 2]],
    });

    const { rgba } = decodeBmp(bmp);
    expect([...rgba.slice(0, 12)]).toEqual([...GREEN, 255, ...RED, 255, ...BLUE, 255]);
  });

  it('decodes top-down BMPs (negative height) without flipping', () => {
    const bmp = buildBmp({
      width: 2,
      height: -2, // top-down: stored row 0 is the image's TOP row
      bitsPerPixel: 8,
      clrUsed: 2,
      palette: [RED, BLUE],
      rows: [
        [0, 0], // top row red
        [1, 1], // bottom row blue
      ],
    });

    const { height, rgba } = decodeBmp(bmp);
    expect(height).toBe(2);
    expect([rgba[0], rgba[1], rgba[2]]).toEqual(RED);
    expect([rgba[8], rgba[9], rgba[10]]).toEqual(BLUE);
  });

  it('treats clrUsed = 0 as a full 2^bpp palette', () => {
    const palette: Array<[number, number, number]> = Array.from({ length: 16 }, (_, i) => [
      i * 16,
      i * 8,
      i,
    ]);
    const bmp = buildBmp({
      width: 2,
      height: 1,
      bitsPerPixel: 4,
      clrUsed: 0,
      palette,
      rows: [[15, 7]],
    });

    const { rgba } = decodeBmp(bmp);
    expect([rgba[0], rgba[1], rgba[2]]).toEqual([240, 120, 15]);
    expect([rgba[4], rgba[5], rgba[6]]).toEqual([112, 56, 7]);
  });

  it('works on a subarray view with a non-zero byteOffset', () => {
    // Regression: DataView must honor bytes.byteOffset, e.g. when the BMP
    // sits inside a larger buffer read from the SD card.
    const bmp = buildBmp({
      width: 2,
      height: 1,
      bitsPerPixel: 8,
      clrUsed: 2,
      palette: [RED, GREEN],
      rows: [[0, 1]],
    });
    const padded = new Uint8Array(bmp.length + 16);
    padded.set(bmp, 16);

    const { rgba } = decodeBmp(padded.subarray(16));
    expect([rgba[0], rgba[1], rgba[2]]).toEqual(RED);
    expect([rgba[4], rgba[5], rgba[6]]).toEqual(GREEN);
  });

  it('rejects invalid or unsupported files', () => {
    expect(() => decodeBmp(new Uint8Array(10))).toThrow(/too small/);

    const notBmp = new Uint8Array(64);
    notBmp[0] = 0x50;
    notBmp[1] = 0x4b;
    expect(() => decodeBmp(notBmp)).toThrow(/magic/);

    const bpp24 = buildBmp({
      width: 2,
      height: 1,
      bitsPerPixel: 8,
      clrUsed: 1,
      palette: [RED],
      rows: [[0, 0]],
    });
    new DataView(bpp24.buffer).setUint16(28, 24, true);
    expect(() => decodeBmp(bpp24)).toThrow(/bit depth/);

    const rle = buildBmp({
      width: 2,
      height: 1,
      bitsPerPixel: 8,
      clrUsed: 1,
      palette: [RED],
      rows: [[0, 0]],
    });
    new DataView(rle.buffer).setUint32(30, 1, true); // BI_RLE8
    expect(() => decodeBmp(rle)).toThrow(/compression/);

    const truncated = buildBmp({
      width: 2,
      height: 1,
      bitsPerPixel: 8,
      clrUsed: 1,
      palette: [RED],
      rows: [[0, 0]],
    });
    expect(() => decodeBmp(truncated.subarray(0, truncated.length - 2))).toThrow(/Truncated/);
  });
});
