import { describe, expect, it } from 'vitest';
import { buildFolderBanner, encodeBannerIcon } from './banner';
import {
  isEnhancedLauncher,
  loaderApiCapabilities,
  parseLoaderApiVersion,
  parseLoaderFork,
  parseNdsRomTitle,
} from './loader';

/** Builds a minimal picoLoader7.bin-like header with the given api version. */
function loader7Bytes(apiVersion: number): Uint8Array {
  const bytes = new Uint8Array(0x20);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x06000414, true); // entryPoint
  view.setUint32(4, 0, true); // dldiDriver
  view.setUint16(8, 0, true); // bootDrive
  view.setUint16(0x0a, apiVersion, true);
  return bytes;
}

/** Builds a fake NDS ROM: header pointing at a real banner with `title`. */
function fakeRom(title: string): Uint8Array {
  const icon = encodeBannerIcon(new Uint8ClampedArray(32 * 32 * 4));
  const banner = buildFolderBanner(icon, title);
  const bannerOffset = 0x200;
  const rom = new Uint8Array(bannerOffset + banner.length);
  new DataView(rom.buffer).setUint32(0x68, bannerOffset, true);
  rom.set(banner, bannerOffset);
  return rom;
}

describe('parseLoaderApiVersion', () => {
  it('reads the api version at offset 0x0a', () => {
    expect(parseLoaderApiVersion(loader7Bytes(3))).toBe(3);
    expect(parseLoaderApiVersion(loader7Bytes(1))).toBe(1);
  });

  it('rejects implausible values', () => {
    expect(parseLoaderApiVersion(loader7Bytes(0))).toBeNull();
    expect(parseLoaderApiVersion(loader7Bytes(999))).toBeNull();
  });

  it('rejects too-short files', () => {
    expect(parseLoaderApiVersion(new Uint8Array(4))).toBeNull();
  });

  it('works on subarray views with a byte offset', () => {
    const padded = new Uint8Array(0x30);
    padded.set(loader7Bytes(3), 0x10);
    expect(parseLoaderApiVersion(padded.subarray(0x10))).toBe(3);
  });
});

describe('loaderApiCapabilities', () => {
  it('accumulates capabilities by version', () => {
    expect(loaderApiCapabilities(1)).toEqual(['gameLoading']);
    expect(loaderApiCapabilities(2)).toEqual(['gameLoading', 'returnToLauncher']);
    expect(loaderApiCapabilities(3)).toEqual(['gameLoading', 'returnToLauncher', 'cheats']);
  });
});

describe('parseNdsRomTitle', () => {
  it('reads the first banner title line', () => {
    expect(parseNdsRomTitle(fakeRom('Pico Launcher'))).toBe('Pico Launcher');
  });

  it('returns null without a banner pointer', () => {
    const rom = new Uint8Array(0x1000);
    expect(parseNdsRomTitle(rom)).toBeNull();
  });

  it('returns null for truncated roms', () => {
    expect(parseNdsRomTitle(new Uint8Array(0x10))).toBeNull();
  });
});

describe('isEnhancedLauncher', () => {
  it('detects the fork by its "Enhanced" banner subtitle', () => {
    // matches the fork Makefile: GAME_TITLE "Pico Launcher", GAME_SUBTITLE "Enhanced"
    expect(isEnhancedLauncher(fakeRom('Pico Launcher\nEnhanced\nLNH team'))).toBe(true);
  });

  it('treats stock Pico Launcher (no subtitle) as not the fork', () => {
    expect(isEnhancedLauncher(fakeRom('Pico Launcher\nLNH team'))).toBe(false);
    expect(isEnhancedLauncher(fakeRom('Pico Launcher'))).toBe(false);
  });

  it('requires the whole line to be the marker, not merely to contain it', () => {
    expect(isEnhancedLauncher(fakeRom('Pico Launcher\nEnhanced Edition\nLNH team'))).toBe(false);
  });

  it('is false when there is no banner or the rom is truncated', () => {
    expect(isEnhancedLauncher(new Uint8Array(0x1000))).toBe(false);
    expect(isEnhancedLauncher(new Uint8Array(0x10))).toBe(false);
  });
});

/** Builds a picoLoader9.bin-like buffer with `text` embedded after some bytes. */
function loader9Bytes(text: string): Uint8Array {
  const encoded = new TextEncoder().encode(text);
  const bytes = new Uint8Array(0x40 + encoded.length);
  bytes.set(encoded, 0x40);
  return bytes;
}

describe('parseLoaderFork', () => {
  /** The exact line enhanced-v1.0.0 prints on its error screens. */
  const MARKER =
    'Pico Loader Enhanced v1.0.0 - unofficial build\n' +
    'Report issues at:\ngithub.com/rasalopa/pico-launcher-enhanced';

  it('reads the fork name and version from its error-screen line', () => {
    expect(parseLoaderFork(loader9Bytes(MARKER))).toEqual({
      name: 'Pico Loader Enhanced',
      version: 'v1.0.0',
    });
  });

  it('keeps every part of the version, however many digits', () => {
    expect(
      parseLoaderFork(loader9Bytes('Pico Loader Enhanced v12.3.40 - unofficial build')),
    ).toEqual({ name: 'Pico Loader Enhanced', version: 'v12.3.40' });
  });

  it('reads a version that runs to the end of the file', () => {
    expect(parseLoaderFork(loader9Bytes('Pico Loader Enhanced v2.0.1'))?.version).toBe('v2.0.1');
  });

  it('leaves a stock Pico Loader binary alone', () => {
    expect(parseLoaderFork(loader9Bytes('Pico Loader ARM9 started'))).toBeNull();
  });

  it('needs a complete version right after the name', () => {
    expect(parseLoaderFork(loader9Bytes('Pico Loader Enhanced fork'))).toBeNull();
    expect(parseLoaderFork(loader9Bytes('Pico Loader Enhanced v1.0'))).toBeNull();
    expect(parseLoaderFork(loader9Bytes('Pico Loader Enhanced v1.0.0.1'))).toBeNull();
  });

  it('is null for empty or truncated files', () => {
    expect(parseLoaderFork(new Uint8Array(0))).toBeNull();
    expect(parseLoaderFork(loader9Bytes('').subarray(0, 10))).toBeNull();
  });
});
