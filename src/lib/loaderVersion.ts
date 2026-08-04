/**
 * Works out which pico-loader release the loader files on a card came from, and
 * whether they all came from the same one.
 *
 * Why this is not a lookup table
 * -----------------------------
 * The obvious design, "hash of file X means release Y", is wrong. Most releases
 * change only the two halves of the loader itself: `aplist.bin` is byte-identical
 * across eight of the eleven releases published so far, and `savelist.bin` has
 * only three distinct versions in total. So a hash identifies a SET of releases.
 *
 * The card's release is therefore the intersection of the sets of every file it
 * carries, and an EMPTY intersection is the interesting case: it means the files
 * cannot all have come from one release, which is exactly the "half-updated card"
 * this check exists to catch. That happens when someone updates by copying only
 * the files they think changed.
 *
 * Two consequences worth knowing
 * ------------------------------
 * - v1.3.0 and v1.3.1 ship byte-identical loader files. They can never be told
 *   apart, so a card on either reports both and the UI must say so rather than
 *   pick one.
 * - A file the manifest has never seen is NOT evidence of mixing. It is more
 *   likely hand-edited (people do edit `aplist.bin`) or from a release newer than
 *   the manifest. Such files are excluded from the intersection and reported
 *   separately, so one edited file cannot make a healthy card look broken.
 *
 * Absence is deliberately not evidence either. `patchlist.bin` only exists from
 * v1.5.0 onward, so its absence looks like proof of an older release - but a
 * v1.7.1 owner who deleted it would then intersect to nothing and be told their
 * card is mixed, which is false. The four always-present files identify all eleven
 * releases on their own, so nothing is lost by ignoring absence here. Missing
 * files are reported through {@link LoaderVersionResult.missingFiles} instead.
 */

/** Upstream repository the manifest is generated from. */
export const LOADER_REPO = 'LNH-team/pico-loader';

/** Releases page users are pointed at, the source of the /_pico .bin files. */
export const LOADER_RELEASES_URL = `https://github.com/${LOADER_REPO}/releases`;

/** The loader files PicoDex hashes. `patchlist.bin` only exists from v1.5.0. */
export const LOADER_FILE_NAMES = [
  'picoLoader7.bin',
  'picoLoader9.bin',
  'aplist.bin',
  'savelist.bin',
  'patchlist.bin',
] as const;

export type LoaderFileName = (typeof LOADER_FILE_NAMES)[number];

/** Shape of `src/data/loaderReleases.json`, written by scripts/gen-loader-manifest.mjs. */
export interface LoaderManifest {
  source: string;
  /** Oldest first, so the last entry is the newest release the manifest knows. */
  releases: readonly { tag: string; published: string }[];
  /** file name -> sha256 -> every release tag that shipped that exact file. */
  files: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
}

/** One file on the card, resolved against the manifest. */
export interface LoaderFileMatch {
  file: LoaderFileName;
  hash: string;
  /** Releases that shipped this exact file, empty when the manifest has not seen it. */
  releases: readonly string[];
}

/**
 * - `identified`: every recognised file is consistent with at least one release.
 * - `mixed`: two or more recognised files, and no release ships all of them.
 * - `unrecognised`: files are present but none matches anything in the manifest.
 * - `no-loader`: the card carries none of the loader files.
 */
export type LoaderVersionStatus = 'identified' | 'mixed' | 'unrecognised' | 'no-loader';

/**
 * For a mixed card: which release most of its files agree on, and which files do
 * not fit. Dumping every file's compatible releases instead would bury the answer
 * - `aplist.bin` alone is compatible with eight of them, so the honest evidence
 * reads as noise. What a user needs is the odd one out.
 */
export interface LoaderMismatch {
  /**
   * The release the largest number of files are consistent with. When several tie,
   * the newest of them, on the assumption an interrupted update was heading
   * forwards.
   */
  bestFit: string;
  /** Files not consistent with {@link bestFit}: the ones to copy again. */
  oddOnesOut: readonly LoaderFileName[];
  /** How many files do agree with {@link bestFit}, for wording like "four of five". */
  agreeing: number;
}

/**
 * Why more than one release survived, which the UI must not guess at.
 *
 * - `identical-releases`: the candidates really do ship byte-identical files, so
 *   nothing could ever tell them apart. Only the v1.3.0/v1.3.1 pair, today.
 * - `incomplete-evidence`: the files that would have discriminated them were
 *   missing or unrecognised, so this is a limit of what was read, not of the
 *   releases. Saying "they ship identical files" here is false: v1.7.0 and v1.7.1
 *   differ in exactly picoLoader7.bin, which is the file most likely to be absent.
 */
export type LoaderAmbiguity = 'identical-releases' | 'incomplete-evidence';

export interface LoaderVersionResult {
  status: LoaderVersionStatus;
  /**
   * Releases compatible with every recognised file, oldest first. Usually one
   * entry; two for the byte-identical v1.3.0/v1.3.1 pair. Empty unless the
   * status is `identified`.
   */
  candidates: readonly string[];
  /** Every file that was hashed, in {@link LOADER_FILE_NAMES} order. */
  matches: readonly LoaderFileMatch[];
  /** Hashed files the manifest does not know: hand-edited, or newer than it. */
  unrecognisedFiles: readonly LoaderFileName[];
  /** Loader files the card does not have. Absent `patchlist.bin` is normal on old cards. */
  missingFiles: readonly LoaderFileName[];
  /**
   * How many releases were published after the newest candidate. 0 means up to
   * date as far as the manifest knows; see {@link isNewerThanManifest} for the
   * case where the manifest itself is stale.
   */
  releasesBehind: number;
  /** Newest release in the manifest, for wording like "v1.7.1 is the latest here". */
  latestKnown: string;
  /** Set only when the status is `mixed`; see {@link LoaderMismatch}. */
  mismatch: LoaderMismatch | null;
  /**
   * Why {@link candidates} holds more than one release. `null` when it holds one
   * or none. See {@link LoaderAmbiguity}: the two reasons need different wording
   * and only one of them is about the releases themselves.
   */
  ambiguity: LoaderAmbiguity | null;
}

/**
 * Resolves the card's loader release from the hashes of its loader files.
 *
 * @param manifest The committed manifest.
 * @param hashes Lowercase hex sha256 per file. Omit a file, or pass `null`, when
 *   the card does not have it: absence is reported but never narrows the answer
 *   (see the module comment for the false-positive this avoids).
 * @returns The verdict; never throws, and never guesses.
 */
export function identifyLoader(
  manifest: LoaderManifest,
  hashes: Partial<Record<LoaderFileName, string | null>>,
): LoaderVersionResult {
  const order = manifest.releases.map((r) => r.tag);
  const latestKnown = order[order.length - 1] ?? '';

  const matches: LoaderFileMatch[] = [];
  const missingFiles: LoaderFileName[] = [];
  const unrecognisedFiles: LoaderFileName[] = [];

  for (const file of LOADER_FILE_NAMES) {
    const hash = hashes[file];
    if (hash === undefined || hash === null) {
      missingFiles.push(file);
      continue;
    }
    const releases = manifest.files[file]?.[hash.toLowerCase()] ?? [];
    matches.push({ file, hash, releases });
    if (releases.length === 0) unrecognisedFiles.push(file);
  }

  const recognised = matches.filter((m) => m.releases.length > 0);

  if (matches.length === 0) {
    return {
      status: 'no-loader',
      candidates: [],
      matches,
      unrecognisedFiles,
      missingFiles,
      releasesBehind: 0,
      latestKnown,
      mismatch: null,
      ambiguity: null,
    };
  }
  if (recognised.length === 0) {
    return {
      status: 'unrecognised',
      candidates: [],
      matches,
      unrecognisedFiles,
      missingFiles,
      releasesBehind: 0,
      latestKnown,
      mismatch: null,
      ambiguity: null,
    };
  }

  let candidateSet = new Set(recognised[0].releases);
  for (const m of recognised.slice(1)) {
    const next = new Set<string>();
    for (const tag of m.releases) if (candidateSet.has(tag)) next.add(tag);
    candidateSet = next;
  }

  // A single recognised file can never contradict itself, so "mixed" needs two.
  if (candidateSet.size === 0) {
    // Pick the release the most files agree with, newest on a tie, and name the
    // rest. That is the actionable half of the finding.
    let bestFit = order[order.length - 1];
    let agreeing = -1;
    for (const tag of order) {
      const n = recognised.filter((m) => m.releases.includes(tag)).length;
      if (n >= agreeing) {
        agreeing = n;
        bestFit = tag;
      }
    }
    const oddOnesOut = recognised.filter((m) => !m.releases.includes(bestFit)).map((m) => m.file);
    return {
      status: 'mixed',
      candidates: [],
      matches,
      unrecognisedFiles,
      missingFiles,
      releasesBehind: 0,
      latestKnown,
      mismatch: { bestFit, oddOnesOut, agreeing },
      ambiguity: null,
    };
  }

  const candidates = order.filter((tag) => candidateSet.has(tag));
  const newest = candidates[candidates.length - 1];
  const releasesBehind = order.length - 1 - order.indexOf(newest);

  // Several candidates mean either that nothing could ever separate them, or that
  // what would have separated them was not read. Only the first is a fact about
  // the releases, and the UI has to say which.
  let ambiguity: LoaderAmbiguity | null = null;
  if (candidates.length > 1) {
    const identical = Object.values(manifest.files).every((byHash) => {
      const hashesCoveringCandidates = Object.entries(byHash)
        .filter(([, tags]) => candidates.some((tag) => tags.includes(tag)))
        .map(([hash]) => hash);
      // one hash covering all of them, or the file is in none of them
      return hashesCoveringCandidates.length <= 1;
    });
    ambiguity = identical ? 'identical-releases' : 'incomplete-evidence';
  }

  return {
    status: 'identified',
    candidates,
    matches,
    unrecognisedFiles,
    missingFiles,
    releasesBehind,
    latestKnown,
    mismatch: null,
    ambiguity,
  };
}

/**
 * Whether a release tag seen live on GitHub is newer than anything the committed
 * manifest knows, which is the one thing the manifest cannot tell on its own.
 *
 * Kept separate from {@link identifyLoader} on purpose: the verdict must never
 * depend on the network. This only ever adds a "there is something newer than I
 * know about" note on top of an answer that already stands.
 *
 * @param manifest The committed manifest.
 * @param liveLatestTag Newest non-prerelease tag from the GitHub API, or `null`
 *   when the call was not made or failed.
 * @returns `true` only when the live tag is definitely absent from the manifest.
 */
export function isNewerThanManifest(
  manifest: LoaderManifest,
  liveLatestTag: string | null,
): boolean {
  if (!liveLatestTag) return false;
  return !manifest.releases.some((r) => r.tag === liveLatestTag);
}
