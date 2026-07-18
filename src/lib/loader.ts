/**
 * Detection of the Pico Loader / Pico Launcher components installed on an SD
 * card. The loader's marketing version is not embedded in its binaries, but
 * `picoLoader7.bin` starts with a stable ABI header (`pload_header7_t` in the
 * launcher source) whose `apiVersion` field is: u16 LE at offset 0x0A, after
 * `entryPoint` (u32) + `dldiDriver` (u32) + `bootDrive` (u16).
 */

import { BANNER_SIZE, parseBannerTitle } from './banner';

/** Byte offset of the u16 `apiVersion` field inside `picoLoader7.bin`. */
const LOADER_API_VERSION_OFFSET = 0x0a;

/** Highest API version PicoDex knows how to describe. */
const KNOWN_MAX_API_VERSION = 16;

/**
 * Reads the Pico Loader API version from `picoLoader7.bin` bytes.
 *
 * @returns The API version, or `null` when the file is too short or the
 *   value is implausible (0 or far beyond known versions).
 */
export function parseLoaderApiVersion(picoLoader7: Uint8Array): number | null {
  if (picoLoader7.length < LOADER_API_VERSION_OFFSET + 2) {
    return null;
  }
  const view = new DataView(picoLoader7.buffer, picoLoader7.byteOffset, picoLoader7.byteLength);
  const version = view.getUint16(LOADER_API_VERSION_OFFSET, true);
  if (version === 0 || version > KNOWN_MAX_API_VERSION) {
    return null;
  }
  return version;
}

/** Human-readable capabilities of a Pico Loader API version. */
export function loaderApiCapabilities(apiVersion: number): string[] {
  const capabilities = ['Game loading'];
  if (apiVersion >= 2) capabilities.push('Return to launcher');
  if (apiVersion >= 3) capabilities.push('Cheats');
  return capabilities;
}

/**
 * Extracts the banner title of an NDS ROM (e.g. `_picoboot.nds`), first line
 * only.
 *
 * @param rom Complete ROM bytes.
 * @param lang Title language slot (0..5), defaults to English.
 * @returns The first title line, or `null` when the ROM has no valid banner.
 */
export function parseNdsRomTitle(rom: Uint8Array, lang = 1): string | null {
  if (rom.length < 0x6c) {
    return null;
  }
  const view = new DataView(rom.buffer, rom.byteOffset, rom.byteLength);
  const bannerOffset = view.getUint32(0x68, true);
  if (bannerOffset === 0 || bannerOffset + BANNER_SIZE > rom.length) {
    return null;
  }
  const title = parseBannerTitle(rom.subarray(bannerOffset, bannerOffset + BANNER_SIZE), lang);
  const firstLine = title.split('\n')[0].trim();
  return firstLine.length > 0 ? firstLine : null;
}
