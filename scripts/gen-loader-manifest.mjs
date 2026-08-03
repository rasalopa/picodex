/**
 * Regenerates src/data/loaderReleases.json, the table that lets PicoDex work out
 * which pico-loader release a card's loader files came from.
 *
 * Run it by hand after LNH-team publishes a pico-loader release:
 *
 *     npm run loader-manifest
 *
 * It is deliberately NOT part of `npm run build`. The build must stay offline and
 * reproducible, and committing the output means a `git diff` shows exactly which
 * hashes a new release introduced, which is the whole point of keeping it in the
 * repository rather than fetching at runtime.
 *
 * Design notes:
 *
 * - A file hash identifies a SET of releases, not one release. Only two of the
 *   five loader files change on most releases: `aplist.bin` is byte-identical
 *   across eight of them. The manifest therefore maps hash -> [releases], and the
 *   app intersects the sets (see src/lib/loaderVersion.ts).
 * - Silent incompleteness is the worst failure mode here. A manifest missing a
 *   release, or missing one file of one release, would make PicoDex report a
 *   perfectly good card as unrecognised. So every step that could quietly skip
 *   something throws, and the run refuses to produce a smaller manifest than the
 *   one already committed (see checkGrowth).
 * - Order comes from the tag, never from `published_at`. That field is rewritten
 *   when a release is edited, and v1.0.0 already carries created_at 2025-11-23
 *   against published_at 2025-11-25. The app reads this array positionally to
 *   decide which release is newest and how far behind a card is, so a
 *   re-published old release would otherwise make PicoDex call it the latest.
 * - No timestamp in the output. Two runs over the same releases must produce a
 *   byte-identical file, otherwise every regeneration is a noisy diff and nobody
 *   reads them. Formatting goes through the repo's own pinned prettier, in
 *   process, so `npm run format:check` cannot disagree with what this writes.
 * - No new dependencies. The zip reader below cannot fail because `unzip` is
 *   missing from a machine or a CI image.
 */

import { createHash } from 'node:crypto';
import { inflateRawSync, crc32 } from 'node:zlib';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { format, resolveConfig } from 'prettier';

const REPO = 'LNH-team/pico-loader';

/**
 * The loader files a DSpico card carries in /_pico, and the only ones hashed.
 *
 * Only ONE pair of them is DSpico-specific: picoLoader7/9.bin differ per
 * flashcard, the three lists are shared across all of them. Do not "simplify" by
 * pulling whichever release asset is convenient - the DSpico zip is the one whose
 * bytes a DSpico card actually has.
 *
 * `biosnds7.rom` is deliberately absent. The launcher's health check lists it as
 * an optional /_pico file, but it is a user-supplied DS BIOS dump present in zero
 * release zips, so hashing it would put a permanent unrecognised file on every
 * card that has one. Keep this in step with LOADER_FILE_NAMES in
 * src/lib/loaderVersion.ts, not with health.ts.
 */
const ALWAYS_PRESENT = ['picoLoader7.bin', 'picoLoader9.bin', 'aplist.bin', 'savelist.bin'];

/** Ships from v1.5.0 onward. Verified absent from every earlier zip. */
const SINCE_V150 = ['patchlist.bin'];

const LOADER_FILES = [...ALWAYS_PRESENT, ...SINCE_V150];

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/loaderReleases.json');

/** Floor the manifest may never fall below. Raise deliberately, never to fix a run. */
const MIN_RELEASES = 11;
const MIN_HASHES = 28;

/**
 * Matches the DSpico release asset. The name changed shape between releases
 * (`Pico_Loader_for_DSPICO.zip` in v1.0.x, `Pico_Loader_DSPICO.zip` since
 * v1.1.0), so this matches the parts that carry meaning rather than a literal
 * name. Verified against all 11 releases: exactly one asset matches in each, and
 * no other asset in any release mentions dspico.
 */
function isDspicoAsset(name) {
  return /^pico[_-]?loader.*dspico\.zip$/i.test(name);
}

/** Sort key from the tag, which is immutable. See the header note on published_at. */
function semverKey(tag) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(tag);
  if (!m) {
    throw new Error(`${tag}: not a vMAJOR.MINOR.PATCH tag. Update semverKey() in this script.`);
  }
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function bySemver(a, b) {
  const x = semverKey(a);
  const y = semverKey(b);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

/** A GitHub token if one is reachable. Used for the API only, never for downloads. */
function githubToken() {
  if (process.env.GITHUB_TOKEN) return { token: process.env.GITHUB_TOKEN, from: 'GITHUB_TOKEN' };
  try {
    const t = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return t ? { token: t, from: 'gh auth token' } : { token: null, from: null };
  } catch {
    return { token: null, from: null };
  }
}

async function api(url, token) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });

  if (res.status === 401) {
    throw new Error(
      'GitHub rejected the credentials (401).\n' +
        '  The token is wrong or expired. Unset GITHUB_TOKEN to run unauthenticated\n' +
        '  (this script needs one request), or run `gh auth login`.',
    );
  }
  if (res.status === 403 || res.status === 429) {
    const retryAfter = res.headers.get('retry-after');
    if (retryAfter) {
      throw new Error(`GitHub secondary rate limit (${res.status}). Retry in ${retryAfter}s.`);
    }
    if (res.headers.get('x-ratelimit-remaining') === '0') {
      const reset = res.headers.get('x-ratelimit-reset');
      const when = reset ? new Date(Number(reset) * 1000).toLocaleTimeString() : 'unknown';
      throw new Error(
        `GitHub rate limit exhausted (${res.status}), resets at ${when}.` +
          (token ? '' : '\n  A token raises the limit from 60 to 5000 requests per hour.'),
      );
    }
    // not a rate limit: permissions, or an expired signed URL
    throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  }
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * Downloads a release asset, deliberately unauthenticated. browser_download_url
 * redirects cross-origin to a signed URL: the repository is public so a token
 * buys nothing there, and a broadly scoped user token has no business travelling
 * into that redirect chain.
 */
async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

const EOCD_SIG = 0x06054b50;
const EOCD_MAX_COMMENT = 0xffff;

/**
 * Reads a zip through its central directory, which is the authoritative index.
 * Scanning for local file headers instead would also "work" and would silently
 * pick up deleted entries, so this walks the directory properly.
 *
 * Zip64 is not handled: the entry count is read as 16 bits and the directory
 * offset as 32. These archives hold five entries in ~90 KB so it cannot come up,
 * but do not assume coverage if that changes.
 */
function readZip(buf) {
  // Bounded scan. The record sits within 22 + comment bytes of the end, and an
  // unbounded search can lock onto the same four bytes inside compressed data.
  const floor = Math.max(0, buf.length - 22 - EOCD_MAX_COMMENT);
  let eocd = -1;
  for (let i = buf.length - 22; i >= floor; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a zip: no end-of-central-directory record');

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = new Map();

  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) {
      throw new Error(`corrupt central directory at entry ${n}`);
    }
    const method = buf.readUInt16LE(p + 10);
    const expectedCrc = buf.readUInt32LE(p + 16);
    const compressedSize = buf.readUInt32LE(p + 20);
    const uncompressedSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);

    if (!name.endsWith('/')) {
      // Flat names only. Reducing a path to its basename would let a zip carrying
      // both docs/aplist.bin and aplist.bin feed in whichever came last.
      if (name.includes('/')) {
        throw new Error(`${name}: nested entry, this reader expects a flat archive`);
      }
      if (out.has(name)) throw new Error(`${name}: duplicate entry in archive`);

      const lhNameLen = buf.readUInt16LE(localOffset + 26);
      const lhExtraLen = buf.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + lhNameLen + lhExtraLen;
      const raw = buf.subarray(start, start + compressedSize);

      let data;
      if (method === 0) data = Buffer.from(raw);
      else if (method === 8) data = inflateRawSync(raw);
      else throw new Error(`${name}: unsupported zip compression method ${method}`);

      if (data.length !== uncompressedSize) {
        throw new Error(
          `${name}: inflated to ${data.length} bytes, directory says ${uncompressedSize}`,
        );
      }
      // catches a mis-sliced range that happens to inflate to the right length
      const actualCrc = crc32(data) >>> 0;
      if (actualCrc !== expectedCrc) {
        throw new Error(
          `${name}: crc32 ${actualCrc.toString(16)} does not match the archive's ${expectedCrc.toString(16)}`,
        );
      }
      out.set(name, data);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

const sha256 = (b) => createHash('sha256').update(b).digest('hex');

/**
 * Refuses to write a manifest smaller than the committed one. A single tripwire
 * for a truncated API response, a repository rename, a broken asset filter, and
 * "someone ran this with credentials that see a different set of releases".
 */
function checkGrowth(releaseTags, hashCount) {
  if (releaseTags.length < MIN_RELEASES || hashCount < MIN_HASHES) {
    throw new Error(
      `refusing to write a smaller manifest: ${releaseTags.length} releases and ${hashCount} ` +
        `hashes, expected at least ${MIN_RELEASES} and ${MIN_HASHES}.\n` +
        '  If pico-loader really removed releases, lower the floors on purpose.',
    );
  }
  if (!existsSync(OUT)) return;
  const previous = JSON.parse(readFileSync(OUT, 'utf8'));
  const lost = (previous.releases ?? [])
    .map((r) => r.tag)
    .filter((tag) => !releaseTags.includes(tag));
  if (lost.length) {
    throw new Error(`refusing to drop releases already in the manifest: ${lost.join(', ')}`);
  }
}

async function main() {
  const { token, from } = githubToken();
  // The whole run is ONE core API request: /releases returns all of them, and the
  // asset downloads go to another host and cost no quota.
  console.log(
    token
      ? `→ 1 API request, authenticated via ${from}`
      : '→ 1 API request, unauthenticated (the limit is 60 per hour, so this is fine)',
  );

  const releases = [];
  for (let page = 1; ; page++) {
    const batch = await api(
      `https://api.github.com/repos/${REPO}/releases?per_page=100&page=${page}`,
      token,
    );
    releases.push(...batch);
    if (batch.length < 100) break;
  }

  // Drafts are returned only to callers with push access, so without this filter
  // the manifest's contents would depend on who ran the script.
  const usable = releases.filter((r) => !r.draft && !r.prerelease);
  const skipped = releases.filter((r) => r.draft || r.prerelease);
  if (skipped.length) {
    const tags = skipped.map((r) => r.tag_name).join(', ');
    console.log(`→ skipping ${skipped.length} draft/prerelease: ${tags}`);
  }
  if (!usable.length) throw new Error(`no usable releases found in ${REPO}`);

  usable.sort((a, b) => bySemver(a.tag_name, b.tag_name));

  /** file -> hash -> release tags */
  const files = Object.fromEntries(LOADER_FILES.map((f) => [f, {}]));
  const releaseList = [];

  for (const r of usable) {
    const candidates = r.assets.filter((a) => isDspicoAsset(a.name));
    if (candidates.length !== 1) {
      // Loud on purpose: a quietly incomplete manifest makes PicoDex slander good cards.
      throw new Error(
        `${r.tag_name}: expected exactly one DSpico asset, found ${candidates.length}.\n` +
          '  Assets present:\n' +
          r.assets.map((a) => `    ${a.name}`).join('\n') +
          '\n  If the naming changed, update isDspicoAsset() in this script.',
      );
    }
    const asset = candidates[0];
    const entries = readZip(await download(asset.browser_download_url));

    // Every release must carry all four always-present files, and patchlist.bin
    // from v1.5.0 onward. A zip that quietly stopped shipping one would make real
    // cards report that file as unrecognised.
    const expected = [
      ...ALWAYS_PRESENT,
      ...(bySemver(r.tag_name, 'v1.5.0') >= 0 ? SINCE_V150 : []),
    ];
    const absent = expected.filter((f) => !entries.has(f));
    if (absent.length) {
      throw new Error(
        `${r.tag_name}: ${asset.name} is missing ${absent.join(', ')}.\n` +
          `  It contains: ${[...entries.keys()].join(', ')}`,
      );
    }

    for (const f of LOADER_FILES) {
      const data = entries.get(f);
      if (!data) continue;
      (files[f][sha256(data)] ??= []).push(r.tag_name);
    }
    releaseList.push({ tag: r.tag_name, published: r.published_at.slice(0, 10) });
    console.log(`  ${r.tag_name.padEnd(8)} ${asset.name.padEnd(28)} ${expected.length} files`);
  }

  // Deterministic: hash keys sorted as hex, tag arrays sorted the same way as the
  // release list, so the file has one ordering rather than two.
  const sortedFiles = {};
  for (const f of LOADER_FILES) {
    const hashes = Object.keys(files[f]).sort();
    if (!hashes.length) continue;
    sortedFiles[f] = Object.fromEntries(hashes.map((h) => [h, files[f][h].slice().sort(bySemver)]));
  }
  const hashCount = Object.values(sortedFiles).reduce((n, m) => n + Object.keys(m).length, 0);
  checkGrowth(
    releaseList.map((r) => r.tag),
    hashCount,
  );

  const manifest = {
    _comment:
      'GENERATED by scripts/gen-loader-manifest.mjs - do not edit by hand. ' +
      'A hash maps to every release that shipped that exact file; see src/lib/loaderVersion.ts.',
    source: REPO,
    releases: releaseList,
    files: sortedFiles,
  };

  // The repo's own pinned prettier, in process. Shelling out to npx could fetch a
  // different version from the network, and a silent failure there would leave a
  // file that `npm run format:check` rejects, so this is fatal, not a warning.
  const options = await resolveConfig(OUT);
  const formatted = await format(JSON.stringify(manifest, null, 2), { ...options, filepath: OUT });

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, formatted);
  console.log(`\n→ ${OUT}\n  ${releaseList.length} releases, ${hashCount} distinct hashes`);
}

main().catch((e) => {
  console.error(`\n✗ ${e.message}`);
  process.exit(1);
});
