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

  it('uses well-formed versions and real ISO dates', () => {
    for (const entry of CHANGELOG) {
      expect(entry.version).toMatch(/^\d+\.\d+\.\d+$/);
      // "2026-07-22" — Changelog.tsx formats it for the active language
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const [year, month, day] = entry.date.split('-').map(Number);
      const parsed = new Date(Date.UTC(year, month - 1, day));
      expect(parsed.getUTCFullYear()).toBe(year);
      expect(parsed.getUTCMonth()).toBe(month - 1);
      expect(parsed.getUTCDate()).toBe(day);
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

  it('has unique, non-empty English change texts within each entry (React keys)', () => {
    for (const entry of CHANGELOG) {
      const english = entry.changes.map((change) => change.text.en);
      expect(new Set(english).size).toBe(english.length);
      for (const change of entry.changes) {
        expect(change.text.en.trim().length).toBeGreaterThan(0);
      }
    }
  });

  // A translation may be absent - the panel falls back to English. Present and blank is the
  // one thing it must not be, because that renders an empty bullet rather than a readable one.
  it('never carries a blank translation, in any language', () => {
    for (const entry of CHANGELOG) {
      for (const change of entry.changes) {
        for (const [lang, text] of Object.entries(change.text)) {
          expect(text.trim().length, `${entry.version} ${lang}`).toBeGreaterThan(0);
        }
      }
    }
  });

  // Spanish is a shipped language, not a contributed one: every entry carries it.
  it('carries Spanish on every entry', () => {
    for (const entry of CHANGELOG) {
      for (const change of entry.changes) {
        expect(change.text.es, `${entry.version}: "${change.text.en.slice(0, 40)}"`).toBeTruthy();
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
