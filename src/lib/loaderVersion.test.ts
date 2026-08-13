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

describe('why more than one release survives', () => {
  it('says identical-releases only for the pair that really is byte-identical', () => {
    for (const tag of ['v1.3.0', 'v1.3.1']) {
      const r = identifyLoader(manifest, cardOn(tag));
      expect(r.candidates).toEqual(['v1.3.0', 'v1.3.1']);
      expect(r.ambiguity).toBe('identical-releases');
    }
  });

  it('says incomplete-evidence when the discriminating file was not read', () => {
    // The regression this guards: the UI used to explain EVERY multi-candidate
    // result as "those releases ship identical files". v1.7.0 and v1.7.1 differ in
    // exactly picoLoader7.bin, so on a card missing that one file the sentence was
    // false about both the releases and the card.
    const { 'picoLoader7.bin': _dropped, ...withoutLoader7 } = REAL_V171;
    const r = identifyLoader(manifest, withoutLoader7);
    expect(r.candidates).toEqual(['v1.7.0', 'v1.7.1']);
    expect(r.ambiguity).toBe('incomplete-evidence');
  });

  it('says incomplete-evidence when the discriminating file is unrecognised', () => {
    const r = identifyLoader(manifest, { ...REAL_V171, 'picoLoader7.bin': 'ab'.repeat(32) });
    expect(r.ambiguity).toBe('incomplete-evidence');
  });

  it('is null when a single release was pinned, and on every other status', () => {
    expect(identifyLoader(manifest, REAL_V171).ambiguity).toBeNull();
    expect(identifyLoader(manifest, {}).ambiguity).toBeNull();
    const mixed = identifyLoader(manifest, {
      ...REAL_V171,
      'picoLoader7.bin': cardOn('v1.6.0')['picoLoader7.bin'],
    });
    expect(mixed.status).toBe('mixed');
    expect(mixed.ambiguity).toBeNull();
  });

  it('never claims identical-releases for a set that is not', () => {
    // Exhaustive: degrade every release by dropping each subset of its files and
    // assert the label matches whether the candidates really share every hash.
    const files = Object.keys(manifest.files);
    for (const tag of allTags) {
      const full = cardOn(tag);
      const present = files.filter((f) => full[f as LoaderFileName]);
      for (let mask = 0; mask < 1 << present.length; mask++) {
        const partial: Partial<Record<LoaderFileName, string>> = {};
        present.forEach((f, i) => {
          if (mask & (1 << i)) partial[f as LoaderFileName] = full[f as LoaderFileName];
        });
        const r = identifyLoader(manifest, partial);
        if (r.ambiguity !== 'identical-releases') continue;
        // Claimed identical: then no hash that could sit on this card may
        // separate the candidates - every relevant one must ship in ALL of
        // them. Bytes built for another cart are excluded the same way the
        // implementation excludes them: they can never be on this card, so
        // they separate nothing. Counting hashes per file instead would be
        // wrong here, the per-cart binaries have one hash per build.
        for (const f of files) {
          for (const [h, tags] of Object.entries(manifest.files[f])) {
            if (!r.candidates.some((c) => tags.includes(c))) continue;
            const carts = manifest.builds[f]?.[h];
            if (carts && r.builds.length > 0 && !r.builds.some((b) => carts.includes(b))) {
              continue;
            }
            const coversAll = r.candidates.every((c) => tags.includes(c));
            expect(coversAll, `${tag} mask ${String(mask)} ${f} ${h.slice(0, 12)}`).toBe(true);
          }
        }
      }
    }
  });
});

describe('which flashcart build the loader is', () => {
  it('identifies the real test card as the DSPICO build', () => {
    expect(identifyLoader(manifest, REAL_V171).builds).toEqual(['DSPICO']);
  });

  it('identifies a card assembled with another build of the same release', () => {
    // The R4 loader9 of v1.7.1, plus everything else from the DSpico card. The
    // lists are shared across builds, so this is a valid, consistent v1.7.1
    // card - just built for an R4. Exactly what the multi-cart manifest exists
    // to recognise instead of calling it unrecognised.
    const r4 = Object.entries(manifest.builds['picoLoader9.bin']).find(
      ([hash, carts]) =>
        carts.length === 1 &&
        carts[0] === 'R4' &&
        manifest.files['picoLoader9.bin'][hash].includes('v1.7.1'),
    );
    expect(r4).toBeDefined();
    const r = identifyLoader(manifest, { ...REAL_V171, 'picoLoader9.bin': r4![0] });
    expect(r.status).toBe('identified');
    expect(r.candidates).toEqual(['v1.7.1']);
    expect(r.builds).toEqual(['R4']);
  });

  it('does not pretend to know the build from the universal picoLoader7 alone', () => {
    const r = identifyLoader(manifest, { 'picoLoader7.bin': REAL_V171['picoLoader7.bin'] });
    // every build of the matching releases survives, which the UI reads as unknown
    expect(r.builds.length).toBeGreaterThan(2);
  });

  it('reports no build when no per-cart file was recognised', () => {
    expect(identifyLoader(manifest, {}).builds).toEqual([]);
    expect(identifyLoader(manifest, { 'aplist.bin': REAL_V171['aplist.bin'] }).builds).toEqual([]);
  });

  it('narrows to at least one build for a full card of every release', () => {
    for (const tag of allTags) {
      const r = identifyLoader(manifest, cardOn(tag));
      expect(r.builds.length, tag).toBeGreaterThanOrEqual(1);
    }
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

  it('gives the same full answer whatever the casing', () => {
    // The regression this guards: the files lookup lowercased the hash but the
    // match kept the caller's casing, so the builds table (lowercase keys) was
    // silently missed - an uppercase card resolved its release but reported no
    // build, and the identical-releases verdict could flip because the
    // cart-exclusion clause had no builds to work with.
    const upper = Object.fromEntries(
      Object.entries(REAL_V171).map(([f, h]) => [f, h.toUpperCase()]),
    );
    expect(identifyLoader(manifest, upper)).toEqual(identifyLoader(manifest, REAL_V171));

    const pair = cardOn('v1.3.0');
    const pairUpper = Object.fromEntries(
      Object.entries(pair).map(([f, h]) => [f, h!.toUpperCase()]),
    );
    expect(identifyLoader(manifest, pairUpper)).toEqual(identifyLoader(manifest, pair));
    expect(identifyLoader(manifest, pairUpper).ambiguity).toBe('identical-releases');
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
