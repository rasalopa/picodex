import { describe, expect, it } from 'vitest';
import { buildFolderBanner, encodeBannerIcon } from './banner';
import { loaderApiCapabilities, parseLoaderApiVersion, parseNdsRomTitle } from './loader';

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
    expect(loaderApiCapabilities(1)).toEqual(['Game loading']);
    expect(loaderApiCapabilities(2)).toEqual(['Game loading', 'Return to launcher']);
    expect(loaderApiCapabilities(3)).toEqual(['Game loading', 'Return to launcher', 'Cheats']);
  });
});

describe('parseNdsRomTitle', () => {
  /** Builds a fake ROM: header pointing at a real banner built by banner.ts. */
  function fakeRom(title: string): Uint8Array {
    const icon = encodeBannerIcon(new Uint8ClampedArray(32 * 32 * 4));
    const banner = buildFolderBanner(icon, title);
    const bannerOffset = 0x200;
    const rom = new Uint8Array(bannerOffset + banner.length);
    new DataView(rom.buffer).setUint32(0x68, bannerOffset, true);
    rom.set(banner, bannerOffset);
    return rom;
  }

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
