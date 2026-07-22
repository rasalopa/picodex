import { describe, expect, it } from 'vitest';
import { CHANGELOG, REPO_URL } from './changelog.ts';

/** '1.2.3' -> [1, 2, 3] for numeric comparison. */
function versionParts(version: string): number[] {
  return version.split('.').map(Number);
}

describe('CHANGELOG data', () => {
  it('is non-empty and every entry has at least one change', () => {
    expect(CHANGELOG.length).toBeGreaterThan(0);
    for (const entry of CHANGELOG) {
      expect(entry.changes.length).toBeGreaterThan(0);
    }
  });

  it('uses well-formed versions and display dates', () => {
    for (const entry of CHANGELOG) {
      expect(entry.version).toMatch(/^\d+\.\d+\.\d+$/);
      // "Jul 22, 2026" — the display format Changelog.tsx renders verbatim
      expect(entry.date).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
    }
  });

  it('is ordered newest first', () => {
    for (let i = 1; i < CHANGELOG.length; i++) {
      const [aMajor, aMinor, aPatch] = versionParts(CHANGELOG[i - 1].version);
      const [bMajor, bMinor, bPatch] = versionParts(CHANGELOG[i].version);
      const newer =
        aMajor !== bMajor ? aMajor > bMajor : aMinor !== bMinor ? aMinor > bMinor : aPatch > bPatch;
      expect(newer, `${CHANGELOG[i - 1].version} must be newer than ${CHANGELOG[i].version}`).toBe(
        true,
      );
    }
  });

  it('has unique versions (React keys in the panel)', () => {
    const versions = CHANGELOG.map((entry) => entry.version);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it('has unique, non-empty change texts within each entry (React keys)', () => {
    for (const entry of CHANGELOG) {
      const texts = entry.changes.map((change) => change.text);
      expect(new Set(texts).size).toBe(texts.length);
      for (const text of texts) {
        expect(text.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('links only positive integer issue numbers', () => {
    for (const entry of CHANGELOG) {
      for (const change of entry.changes) {
        if (change.issue !== undefined) {
          expect(Number.isInteger(change.issue)).toBe(true);
          expect(change.issue).toBeGreaterThan(0);
        }
      }
    }
  });

  it('points at the picodex repository', () => {
    expect(REPO_URL).toBe('https://github.com/rasalopa/picodex');
  });
});
