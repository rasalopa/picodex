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

/** Capability of a Pico Loader API version; labels live in i18n `library.capabilities`. */
export type LoaderCapability = 'gameLoading' | 'returnToLauncher' | 'cheats';

/** Capabilities of a Pico Loader API version, in order, as i18n keys. */
export function loaderApiCapabilities(apiVersion: number): LoaderCapability[] {
  const capabilities: LoaderCapability[] = ['gameLoading'];
  if (apiVersion >= 2) capabilities.push('returnToLauncher');
  if (apiVersion >= 3) capabilities.push('cheats');
  return capabilities;
}

/** Display name the Pico Loader Enhanced fork prints in its error screens. */
const LOADER_FORK_NAME = 'Pico Loader Enhanced';

/**
 * The line the fork's error screen starts with, from
 * `arm9/source/errorDisplay/ErrorDisplay.cpp`: `Pico Loader Enhanced v1.0.0 -
 * unofficial build`. Stock Pico Loader has no such string, so its presence is
 * the fork's own marker and the version follows it. A build marker rather than a
 * hash: this is the loader's counterpart to the launcher's "Enhanced" banner
 * subtitle, and needs no new table entry for every fork release.
 */
const LOADER_FORK_MARKER = `${LOADER_FORK_NAME} v`;

/** A loader fork recognised from its own binary. */
export interface LoaderFork {
  /** As the binary prints it. */
  name: string;
  /** With its `v`, as the binary prints it: `v1.0.0`. */
  version: string;
}

/**
 * Whether `picoLoader9.bin` is the Pico Loader Enhanced fork, and which version,
 * told from the line the fork prints on its error and warning screens. Read
 * straight from the binary, so it holds whether or not the loader has ever run.
 *
 * Only the arm9 half carries the marker; the arm7 half looks the same on both
 * builds to this check. A card whose arm9 file was replaced on its own still
 * reports the fork, which is what it is.
 *
 * @param picoLoader9 Complete `/_pico/picoLoader9.bin` bytes.
 * @returns The fork, or `null` for stock Pico Loader or a marker with no version.
 */
export function parseLoaderFork(picoLoader9: Uint8Array): LoaderFork | null {
  const marker = [...LOADER_FORK_MARKER].map((char) => char.charCodeAt(0));
  for (let start = 0; start + marker.length < picoLoader9.length; start++) {
    let i = 0;
    while (i < marker.length && picoLoader9[start + i] === marker[i]) i++;
    if (i < marker.length) continue;
    const version = readVersionAt(picoLoader9, start + marker.length);
    if (version !== null) return { name: LOADER_FORK_NAME, version };
  }
  return null;
}

/**
 * Reads a `MAJOR.MINOR.PATCH` run of ASCII digits and dots starting at `start`.
 * The lookahead keeps a four-part version from being reported as its first three.
 * The run is capped so a binary of digits cannot build an enormous string.
 */
function readVersionAt(bytes: Uint8Array, start: number): string | null {
  let text = '';
  for (let i = start; i < bytes.length && text.length < 32; i++) {
    const byte = bytes[i];
    const digit = byte >= 0x30 && byte <= 0x39;
    if (!digit && byte !== 0x2e) break;
    text += String.fromCharCode(byte);
  }
  const match = /^(\d+\.\d+\.\d+)(?![\d.])/.exec(text);
  return match ? `v${match[1]}` : null;
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

/**
 * The second banner line the Enhanced fork's build stamps into `_picoboot.nds`
 * (its Makefile `GAME_SUBTITLE`). Stock Pico Launcher leaves it out.
 */
const ENHANCED_LAUNCHER_MARKER = 'Enhanced';

/**
 * Whether a launcher ROM is the Pico Launcher Enhanced fork, told from its
 * banner rather than from any file it writes: the fork stamps a second title
 * line "Enhanced" that stock Pico Launcher does not. Read straight from
 * `_picoboot.nds`, so it holds whether or not the launcher has ever run, and
 * on any flashcart. Companion features (favorites, play stats) are shown only
 * when this is true.
 *
 * @param rom Complete `_picoboot.nds` bytes.
 */
export function isEnhancedLauncher(rom: Uint8Array, lang = 1): boolean {
  if (rom.length < 0x6c) {
    return false;
  }
  const view = new DataView(rom.buffer, rom.byteOffset, rom.byteLength);
  const bannerOffset = view.getUint32(0x68, true);
  if (bannerOffset === 0 || bannerOffset + BANNER_SIZE > rom.length) {
    return false;
  }
  const title = parseBannerTitle(rom.subarray(bannerOffset, bannerOffset + BANNER_SIZE), lang);
  return title.split('\n').some((line) => line.trim() === ENHANCED_LAUNCHER_MARKER);
}
