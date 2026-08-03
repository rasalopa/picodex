import { describe, expect, it } from 'vitest';
import manifestJson from '../data/loaderReleases.json';
import {
  identifyLoader,
  isNewerThanManifest,
  LOADER_FILE_NAMES,
  type LoaderFileName,
  type LoaderManifest,
} from './loaderVersion.ts';

const manifest = manifestJson as LoaderManifest;

/**
 * The five sha256 values of a real v1.7.1 card, copied from the test card. They
 * are here as an external golden vector: if the manifest were regenerated wrongly
 * these would stop identifying as v1.7.1.
 */
const REAL_V171 = {
  'picoLoader7.bin': '18def39ea14824be8c1c5a8749ea759d7e53cc2e0f3a33627ef9d6d4e618b13f',
  'picoLoader9.bin': 'de101abad93d79257bdebbba1213277660871ceaabd6f04571ad11e78578d7aa',
  'aplist.bin': '13e27e0bca8a8a45af8b22aa09cdd73cbac6f8cdeb33678f0842607f077a36d2',
  'savelist.bin': '438685d7a6f783809f43ec1efc39355cec9a1c7b176c804ef7b2951300f8eea8',
  'patchlist.bin': '9936b0b324894df9e324a70e05683daeb2b3b2b83c2b22514313fa50aa4a5023',
} as const;

/** Builds the hashes a card on `tag` would have, from the manifest itself. */
function cardOn(tag: string): Partial<Record<LoaderFileName, string>> {
  const out: Partial<Record<LoaderFileName, string>> = {};
  for (const file of LOADER_FILE_NAMES) {
    const byHash = manifest.files[file];
    if (!byHash) continue;
    const hash = Object.keys(byHash).find((h) => byHash[h].includes(tag));
    if (hash) out[file] = hash;
  }
  return out;
}

const allTags = manifest.releases.map((r) => r.tag);

describe('the manifest itself', () => {
  it('is present, ordered oldest first, and covers the releases we expect', () => {
    expect(manifest.source).toBe('LNH-team/pico-loader');
    expect(allTags.length).toBeGreaterThanOrEqual(11);
    const dates = manifest.releases.map((r) => r.published);
    expect([...dates].sort()).toEqual(dates);
    expect(allTags[allTags.length - 1]).toBe(manifest.releases.at(-1)?.tag);
  });

  it('carries both halves of the loader for every release', () => {
    for (const tag of allTags) {
      const card = cardOn(tag);
      expect(card['picoLoader7.bin'], `${tag} picoLoader7`).toBeDefined();
      expect(card['picoLoader9.bin'], `${tag} picoLoader9`).toBeDefined();
    }
  });
});

describe('identifyLoader, real releases', () => {
  it('identifies the real test card as v1.7.1 (golden vector)', () => {
    const r = identifyLoader(manifest, REAL_V171);
    expect(r.status).toBe('identified');
    expect(r.candidates).toEqual(['v1.7.1']);
    expect(r.releasesBehind).toBe(0);
    expect(r.unrecognisedFiles).toEqual([]);
    expect(r.missingFiles).toEqual([]);
  });

  it('identifies every release from its own files', () => {
    for (const tag of allTags) {
      const r = identifyLoader(manifest, cardOn(tag));
      expect(r.status, tag).toBe('identified');
      expect(r.candidates, tag).toContain(tag);
    }
  });

  it('reports both v1.3.0 and v1.3.1, which ship byte-identical files', () => {
    // Not a defect: they cannot be told apart, so claiming one would be a guess.
    for (const tag of ['v1.3.0', 'v1.3.1']) {
      const r = identifyLoader(manifest, cardOn(tag));
      expect(r.candidates).toEqual(['v1.3.0', 'v1.3.1']);
    }
  });

  it('identifies every other release to exactly one release', () => {
    const ambiguous = allTags.filter(
      (t) => identifyLoader(manifest, cardOn(t)).candidates.length > 1,
    );
    expect(ambiguous).toEqual(['v1.3.0', 'v1.3.1']);
  });

  it('counts how many releases newer than the card exist', () => {
    const oldest = identifyLoader(manifest, cardOn(allTags[0]));
    expect(oldest.releasesBehind).toBe(allTags.length - 1);
    expect(oldest.latestKnown).toBe(allTags.at(-1));
  });
});

describe('identifyLoader, mixed cards', () => {
  it('detects one file left behind from an older release', () => {
    const r = identifyLoader(manifest, {
      ...REAL_V171,
      'picoLoader7.bin': cardOn('v1.6.0')['picoLoader7.bin'],
    });
    expect(r.status).toBe('mixed');
    expect(r.candidates).toEqual([]);
  });

  it('detects a new loader dropped onto old lists', () => {
    const old = cardOn('v1.1.0');
    const r = identifyLoader(manifest, {
      'picoLoader7.bin': REAL_V171['picoLoader7.bin'],
      'picoLoader9.bin': REAL_V171['picoLoader9.bin'],
      'aplist.bin': old['aplist.bin'],
      'savelist.bin': old['savelist.bin'],
    });
    expect(r.status).toBe('mixed');
  });

  it("names the odd file out instead of dumping every file's releases", () => {
    // aplist.bin alone is compatible with eight releases, so listing each file's
    // compatible set reads as noise. The answer is which file does not fit.
    const r = identifyLoader(manifest, {
      ...REAL_V171,
      'patchlist.bin': cardOn('v1.6.0')['patchlist.bin'],
    });
    expect(r.status).toBe('mixed');
    expect(r.mismatch).toEqual({
      bestFit: 'v1.7.1',
      oddOnesOut: ['patchlist.bin'],
      agreeing: 4,
    });
  });

  it('picks the newest release when several tie on how many files agree', () => {
    // picoLoader9 and patchlist from v1.7.1 fit both v1.7.0 and v1.7.1; the
    // interrupted update was heading forwards, so name the newer one.
    const r = identifyLoader(manifest, {
      'picoLoader9.bin': REAL_V171['picoLoader9.bin'],
      'picoLoader7.bin': cardOn('v1.2.0')['picoLoader7.bin'],
    });
    expect(r.status).toBe('mixed');
    expect(r.mismatch?.bestFit).toBe('v1.7.1');
    expect(r.mismatch?.oddOnesOut).toEqual(['picoLoader7.bin']);
  });

  it('leaves mismatch null when the card is not mixed', () => {
    expect(identifyLoader(manifest, REAL_V171).mismatch).toBeNull();
    expect(identifyLoader(manifest, {}).mismatch).toBeNull();
  });

  it('does NOT call a card mixed just because it is old', () => {
    const r = identifyLoader(manifest, cardOn('v1.4.0'));
    expect(r.status).toBe('identified');
    expect(r.releasesBehind).toBeGreaterThan(0);
  });

  it('needs two contradicting files: one recognised file alone is never mixed', () => {
    const r = identifyLoader(manifest, { 'picoLoader9.bin': REAL_V171['picoLoader9.bin'] });
    expect(r.status).toBe('identified');
  });
});

describe('identifyLoader, files it cannot place', () => {
  it('keeps identifying the card when one file was hand-edited', () => {
    // People do edit aplist.bin. That must not make a healthy card look broken.
    const r = identifyLoader(manifest, { ...REAL_V171, 'aplist.bin': 'de'.repeat(32) });
    expect(r.status).toBe('identified');
    expect(r.candidates).toEqual(['v1.7.1']);
    expect(r.unrecognisedFiles).toEqual(['aplist.bin']);
  });

  it('says unrecognised, not mixed, when it can place nothing at all', () => {
    const junk = Object.fromEntries(LOADER_FILE_NAMES.map((f, i) => [f, String(i).repeat(64)]));
    const r = identifyLoader(manifest, junk);
    expect(r.status).toBe('unrecognised');
    expect(r.candidates).toEqual([]);
    expect(r.unrecognisedFiles).toEqual([...LOADER_FILE_NAMES]);
  });

  it('says no-loader when the card carries none of the files', () => {
    const r = identifyLoader(manifest, {});
    expect(r.status).toBe('no-loader');
    expect(r.missingFiles).toEqual([...LOADER_FILE_NAMES]);
  });

  it('accepts an uppercase hash', () => {
    const r = identifyLoader(manifest, {
      'picoLoader9.bin': REAL_V171['picoLoader9.bin'].toUpperCase(),
    });
    expect(r.status).toBe('identified');
  });
});

describe('absence never narrows the answer', () => {
  it('still identifies v1.7.1 when patchlist.bin was deleted', () => {
    // The regression this guards: patchlist.bin only exists from v1.5.0, so
    // treating its absence as evidence would intersect a real v1.7.1 card down to
    // nothing and report it as mixed. Absence is reported, never used.
    const { 'patchlist.bin': _dropped, ...withoutPatchlist } = REAL_V171;
    const r = identifyLoader(manifest, withoutPatchlist);
    expect(r.status).toBe('identified');
    expect(r.candidates).toEqual(['v1.7.1']);
    expect(r.missingFiles).toEqual(['patchlist.bin']);
  });

  it('treats an explicit null the same as a missing key', () => {
    const a = identifyLoader(manifest, { ...REAL_V171, 'patchlist.bin': null });
    const { 'patchlist.bin': _dropped, ...b } = REAL_V171;
    expect(a.candidates).toEqual(identifyLoader(manifest, b).candidates);
    expect(a.missingFiles).toEqual(['patchlist.bin']);
  });

  it('identifies a pre-v1.5.0 card, which genuinely has no patchlist.bin', () => {
    const r = identifyLoader(manifest, cardOn('v1.4.0'));
    expect(r.status).toBe('identified');
    expect(r.candidates).toEqual(['v1.4.0']);
    expect(r.missingFiles).toEqual(['patchlist.bin']);
  });
});

describe('isNewerThanManifest', () => {
  it('is false for a tag the manifest already knows', () => {
    expect(isNewerThanManifest(manifest, 'v1.7.1')).toBe(false);
    expect(isNewerThanManifest(manifest, allTags[0])).toBe(false);
  });

  it('is true for a tag the manifest has never seen', () => {
    expect(isNewerThanManifest(manifest, 'v1.8.0')).toBe(true);
  });

  it('is false when there was no network answer', () => {
    expect(isNewerThanManifest(manifest, null)).toBe(false);
  });
});
