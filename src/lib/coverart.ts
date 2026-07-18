/**
 * Browser-only canvas helpers for cover art: downloading boxart PNGs,
 * composing them into the launcher's 128x96 cover layout, and previewing
 * encoded cover BMPs.
 *
 * These functions need a DOM (canvas, `createImageBitmap`, `fetch`) and are
 * therefore not unit-tested; all pure pixel logic lives in `bmp.ts`.
 */

import { COVER_HEIGHT, COVER_VISIBLE_WIDTH, COVER_WIDTH, decodeBmp } from './bmp';

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
  // ImageData requires an ArrayBuffer-backed view; copy if needed.
  const data: Uint8ClampedArray<ArrayBuffer> =
    rgba.buffer instanceof ArrayBuffer
      ? (rgba as Uint8ClampedArray<ArrayBuffer>)
      : new Uint8ClampedArray(rgba);
  const [canvas, ctx] = makeCanvas(width, height);
  ctx.putImageData(new ImageData(data, width, height), 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas preview export failed'))),
      'image/png',
    );
  });
  return URL.createObjectURL(blob);
}
