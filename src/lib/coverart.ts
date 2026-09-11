/**
 * Browser-only canvas helpers for cover art: downloading boxart PNGs,
 * composing them into the launcher's 128x96 cover layout, and previewing
 * encoded cover BMPs.
 *
 * These functions need a DOM (canvas, `createImageBitmap`, `fetch`) and are
 * therefore not unit-tested; all pure pixel logic lives in `bmp.ts`.
 */

import {
  BANNER_SIZE,
  ICON_BITMAP_SIZE,
  ICON_PALETTE_SIZE,
  ICON_SIZE,
  decodeBannerIcon,
} from './banner';
import {
  COVER_HEIGHT,
  COVER_VISIBLE_WIDTH,
  COVER_WIDTH,
  ICON_TRANSPARENT_INDEX,
  decodeBmp,
  validateLauncherIconBmp,
} from './bmp';

/** Creates a detached canvas of the given size with its 2D context. */
function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas is not available in this browser');
  }
  return [canvas, ctx];
}

/**
 * Downloads an image (boxart PNG) and decodes it into an {@link ImageBitmap}.
 *
 * @param url Image URL, e.g. from `boxartUrl()` in `thumbnails.ts`.
 * @throws {Error} On a non-2xx HTTP response or undecodable image data.
 */
export async function downloadPngAsBitmap(url: string): Promise<ImageBitmap> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Image download failed: HTTP ${response.status} (${url})`);
  }
  return createImageBitmap(await response.blob());
}

/**
 * Composes downloaded art into the launcher cover layout: the image is
 * stretched to exactly fill the visible left 106x96 area (no letterboxing —
 * the community covers convention) and the remaining right columns (106..127)
 * stay black.
 *
 * @param image Decoded boxart of any size.
 * @returns Top-down RGBA pixels of the full 128x96 cover, ready for
 *   `encodeCoverBmp()`.
 */
export function composeCoverRgba(image: ImageBitmap): Uint8ClampedArray {
  const [, ctx] = makeCanvas(COVER_WIDTH, COVER_HEIGHT);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, COVER_WIDTH, COVER_HEIGHT);
  ctx.drawImage(image, 0, 0, COVER_VISIBLE_WIDTH, COVER_HEIGHT);
  return ctx.getImageData(0, 0, COVER_WIDTH, COVER_HEIGHT).data;
}

/**
 * Composes an arbitrary image into the launcher's 32x32 folder-icon square:
 * aspect-fit, centered, on a fully TRANSPARENT background — icons are never
 * stretched, and the empty margins stay transparent so the encoder maps them
 * to palette index 0 (the launcher's transparent index).
 *
 * @param image Decoded source image of any size.
 * @returns Top-down RGBA pixels of the 32x32 icon, ready for
 *   `encodeBannerIcon()` or `encodeIconBmp()`.
 */
export function composeIconRgba(image: ImageBitmap): Uint8ClampedArray {
  const [, ctx] = makeCanvas(ICON_SIZE, ICON_SIZE);
  const scale = Math.min(ICON_SIZE / image.width, ICON_SIZE / image.height);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  ctx.drawImage(
    image,
    Math.floor((ICON_SIZE - width) / 2),
    Math.floor((ICON_SIZE - height) / 2),
    width,
    height,
  );
  return ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE).data;
}

/** Decoded BMP pixels as an `ImageData` (copied when not ArrayBuffer-backed). */
function bmpImageData(rgba: Uint8ClampedArray, width: number, height: number): ImageData {
  // ImageData requires an ArrayBuffer-backed view; copy if needed.
  const data: Uint8ClampedArray<ArrayBuffer> =
    rgba.buffer instanceof ArrayBuffer
      ? (rgba as Uint8ClampedArray<ArrayBuffer>)
      : new Uint8ClampedArray(rgba);
  return new ImageData(data, width, height);
}

/** Exports a canvas as a PNG blob. */
async function canvasPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas preview export failed'))),
      'image/png',
    );
  });
}

/** Exports a canvas as a PNG blob object URL (owned by the caller). */
async function canvasPngUrl(canvas: HTMLCanvasElement): Promise<string> {
  return URL.createObjectURL(await canvasPngBlob(canvas));
}

/**
 * Decodes a cover BMP back into pixels and renders it to a PNG object URL,
 * so the UI can preview exactly what was written to the SD card.
 *
 * The caller owns the returned URL and must release it with
 * `URL.revokeObjectURL()` when the preview is discarded.
 *
 * @param bytes Complete BMP file bytes (as produced by `encodeCoverBmp()`).
 * @throws {Error} When the BMP cannot be decoded or the canvas export fails.
 */
export async function coverBmpPreviewUrl(bytes: Uint8Array): Promise<string> {
  const { width, height, rgba } = decodeBmp(bytes);
  const [canvas, ctx] = makeCanvas(width, height);
  ctx.putImageData(bmpImageData(rgba, width, height), 0, 0);
  return canvasPngUrl(canvas);
}

/**
 * Decodes a cover BMP and renders only the area the launcher actually shows —
 * the left {@link COVER_VISIBLE_WIDTH}x{@link COVER_HEIGHT} (106x96) pixels —
 * to a PNG object URL. The columns right of {@link COVER_VISIBLE_WIDTH} are
 * padding the launcher never displays, so gallery previews crop them away
 * instead of showing a black strip.
 *
 * The caller owns the returned URL and must release it with
 * `URL.revokeObjectURL()` when the preview is discarded.
 *
 * @param bytes Complete BMP file bytes (as produced by `encodeCoverBmp()`).
 * @throws {Error} When the BMP cannot be decoded or the canvas export fails.
 */
export async function coverBmpCroppedPreviewUrl(bytes: Uint8Array): Promise<string> {
  return URL.createObjectURL(await coverBmpCroppedPreviewBlob(bytes));
}

/**
 * Like {@link coverBmpCroppedPreviewUrl} but returns the PNG blob itself, so it
 * can be stored (and turned into a URL later) rather than only shown once.
 *
 * @param bytes Complete BMP file bytes (as produced by `encodeCoverBmp()`).
 * @throws {Error} When the BMP cannot be decoded or the canvas export fails.
 */
export async function coverBmpCroppedPreviewBlob(bytes: Uint8Array): Promise<Blob> {
  const { width, height, rgba } = decodeBmp(bytes);
  // The canvas is only as wide as the visible area; putImageData clips the
  // padding columns off. Covers narrower than the visible width stay intact.
  const [canvas, ctx] = makeCanvas(Math.min(width, COVER_VISIBLE_WIDTH), height);
  ctx.putImageData(bmpImageData(rgba, width, height), 0, 0);
  return canvasPngBlob(canvas);
}

/**
 * Decodes the 32x32 icon of a standalone `banner.bnr` file (as placed inside
 * launcher folders) and renders it to a PNG object URL, preserving the
 * palette-index-0 transparency.
 *
 * The caller owns the returned URL and must release it with
 * `URL.revokeObjectURL()` when the preview is discarded.
 *
 * @param bnr Complete banner file bytes (at least {@link BANNER_SIZE}).
 * @throws {Error} When the banner is too short or the canvas export fails.
 */
export async function bannerBnrIconPreviewUrl(bnr: Uint8Array): Promise<string> {
  if (bnr.length < BANNER_SIZE) {
    throw new Error(`Banner too short: ${String(bnr.length)} bytes`);
  }
  const rgba = decodeBannerIcon(
    bnr.subarray(0x20, 0x20 + ICON_BITMAP_SIZE),
    bnr.subarray(0x20 + ICON_BITMAP_SIZE, 0x20 + ICON_BITMAP_SIZE + ICON_PALETTE_SIZE),
  );
  return bannerIconRgbaPreviewUrl(rgba);
}

/**
 * Renders 32x32 RGBA icon pixels (as produced by `decodeBannerIcon()`) to a
 * PNG object URL, preserving transparency.
 *
 * The caller owns the returned URL and must release it with
 * `URL.revokeObjectURL()` when the preview is discarded.
 *
 * @param rgba 32*32*4 RGBA bytes in row-major order.
 * @throws {Error} When the canvas export fails.
 */
export async function bannerIconRgbaPreviewUrl(rgba: Uint8ClampedArray): Promise<string> {
  const [canvas, ctx] = makeCanvas(ICON_SIZE, ICON_SIZE);
  ctx.putImageData(bmpImageData(rgba, ICON_SIZE, ICON_SIZE), 0, 0);
  return canvasPngUrl(canvas);
}

/**
 * Decodes the two halves of a capture and stacks them the way the console
 * shows them, top screen above bottom screen, as one PNG blob.
 *
 * A capture whose other half never reached the card is rendered on its own,
 * in its place: a lone bottom half keeps the lower slot so it does not read
 * as a top screen. The gap between the screens is painted with `gap`, which
 * is also what a missing half leaves behind.
 *
 * @param top - `shotNNN_top.bmp` bytes, `null` when the card has none.
 * @param bottom - `shotNNN_bot.bmp` bytes, `null` when the card has none.
 * @param gap - Pixels drawn between the screens (the DS hinge). Defaults to 0.
 * @throws {Error} When neither half was given, or a file cannot be decoded.
 */
export async function screenshotPngBlob(
  top: Uint8Array | null,
  bottom: Uint8Array | null,
  gap = 0,
): Promise<Blob> {
  const halves = [top, bottom].map((bytes) => (bytes === null ? null : decodeBmp(bytes)));
  const present = halves.filter((half) => half !== null);
  if (present.length === 0) {
    throw new Error('A screenshot needs at least one of its two screens');
  }
  const width = Math.max(...present.map((half) => half.width));
  const screenHeight = Math.max(...present.map((half) => half.height));
  const [canvas, ctx] = makeCanvas(width, screenHeight * 2 + gap);
  halves.forEach((half, index) => {
    if (half === null) return;
    ctx.putImageData(
      bmpImageData(half.rgba, half.width, half.height),
      Math.floor((width - half.width) / 2),
      index === 0 ? 0 : screenHeight + gap,
    );
  });
  return canvasPngBlob(canvas);
}

/**
 * Decodes a launcher custom-icon BMP (32x32, 4bpp, palette index
 * {@link ICON_TRANSPARENT_INDEX} = transparent) to a PNG object URL, keeping
 * the transparent pixels transparent. Only files the launcher itself would
 * display are previewed: it draws anything else as a blank icon, and a
 * preview that showed such a file would claim it works.
 *
 * The caller owns the returned URL and must release it with
 * `URL.revokeObjectURL()` when the preview is discarded.
 *
 * @param bytes Complete BMP file bytes (as produced by `encodeIconBmp()`).
 * @throws {Error} When the launcher would reject the file
 *   (`validateLauncherIconBmp`), or the canvas export fails.
 */
export async function iconBmpPreviewUrl(bytes: Uint8Array): Promise<string> {
  const rejected = validateLauncherIconBmp(bytes);
  if (rejected !== null) throw new Error(`Not a launcher icon: ${rejected}`);
  const { width, height, rgba } = decodeBmp(bytes, { transparentIndex: ICON_TRANSPARENT_INDEX });
  const [canvas, ctx] = makeCanvas(width, height);
  ctx.putImageData(bmpImageData(rgba, width, height), 0, 0);
  return canvasPngUrl(canvas);
}
