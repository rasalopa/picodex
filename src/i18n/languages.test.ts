import { describe, expect, it } from 'vitest';
import { en, type Dict } from './en';
import { dictFor, fill, isLang, LANGUAGES, pickLang, type Translation } from './languages';

/**
 * The point of all of this: a translation that covers three strings must work, and the two
 * hundred it does not cover must read in English rather than blank. Before the registry, a
 * dictionary missing a key did not compile - which sounds safe until a community language
 * means every release waits for every translator.
 */

/**
 * A tag for "a language we do not have". Not a real language code on purpose: these tests
 * first used 'fr', and the moment a French translation was added for a trial run, three of
 * them failed - not because anything broke, but because the sentinel had become real. A test
 * naming a language it hopes never ships has the same rot the registry was built to remove.
 */
const ABSENT = 'zz-nowhere';

describe('fill', () => {
  it('falls back to English for a key the translation does not have', () => {
    const filled = fill(en, { app: { language: 'Idioma' } });

    expect(filled.app.language).toBe('Idioma');
    expect(filled.app.tabs.library).toBe(en.app.tabs.library);
  });

  it('reaches into a branch without flattening its untranslated siblings', () => {
    const filled = fill(en, { app: { tabs: { library: 'Biblioteca' } } });

    expect(filled.app.tabs.library).toBe('Biblioteca');
    expect(filled.app.tabs.covers).toBe(en.app.tabs.covers);
    expect(filled.app.language).toBe(en.app.language);
  });

  it('keeps a translated function whole, so the sentence can be reordered around the value', () => {
    const filled = fill(en, {
      health: { releasesBehind1: (count: number) => `atrasado por ${count} ` },
    });

    expect(filled.health.releasesBehind1(3, false)).toBe('atrasado por 3 ');
    expect(filled.health.releasesBehind2).toBe(en.health.releasesBehind2);
  });

  it('treats an empty string as a real answer, not as a gap', () => {
    // The split sentences need this: a half that one language leaves empty on purpose must stay
    // empty, or the English half gets pasted back in and the sentence says it twice.
    const filled = fill(en, { app: { language: '' } });

    expect(filled.app.language).toBe('');
  });

  it('drops a key English does not have, so a renamed key cannot linger', () => {
    const stale = { app: { language: 'Idioma', wasRenamedAwayLastYear: 'x' } };
    const filled = fill(en, stale as Translation<Dict>);

    expect(filled.app.language).toBe('Idioma');
    expect('wasRenamedAwayLastYear' in filled.app).toBe(false);
  });

  it('leaves English untouched, since every other language is built from it', () => {
    const before = en.app.language;
    fill(en, { app: { language: 'Idioma' } });

    expect(en.app.language).toBe(before);
  });

  it('changes nothing when the translation is empty', () => {
    expect(fill(en, {})).toEqual(en);
  });
});

describe('pickLang', () => {
  it('lets a stored choice win over the browser', () => {
    expect(pickLang('es', 'en-US')).toBe('es');
    expect(pickLang('en', 'es-ES')).toBe('en');
  });

  it('ignores a stored value that is not a language we have', () => {
    // A code that was removed, or something else writing to our key.
    expect(pickLang(ABSENT, 'es-ES')).toBe('es');
    expect(pickLang('', 'es-ES')).toBe('es');
  });

  it('matches the browser on the full tag before the base tag', () => {
    expect(pickLang(null, 'es')).toBe('es');
    expect(pickLang(null, 'es-MX')).toBe('es');
    expect(pickLang(null, 'ES-419')).toBe('es');
  });

  it('lands on English for a language we do not have, and when there is nothing to read', () => {
    expect(pickLang(null, ABSENT)).toBe('en');
    expect(pickLang(null, '')).toBe('en');
    expect(pickLang(null, undefined)).toBe('en');
  });
});

describe('the registry', () => {
  it('offers English first, since it is the fallback', () => {
    expect(LANGUAGES[0].code).toBe('en');
    expect(LANGUAGES.map(({ code }) => code)).toContain('es');
  });

  it('gives every language a label for the switch to show', () => {
    for (const { code, label } of LANGUAGES) {
      expect(label.trim().length, code).toBeGreaterThan(0);
    }
  });

  it('recognises the codes it offers and nothing else', () => {
    // Guards the sentinel itself: if this ever ships as a language, these tests need a new one.
    expect(LANGUAGES.map(({ code }) => String(code))).not.toContain(ABSENT);
    for (const { code } of LANGUAGES) {
      expect(isLang(code)).toBe(true);
    }
    expect(isLang(ABSENT)).toBe(false);
    expect(isLang(undefined)).toBe(false);
    expect(isLang(null)).toBe(false);
  });

  it('hands back a dictionary with every key present, for every language', () => {
    // What a component relies on: `useT()` never returns a hole, whatever the translation covers.
    for (const { code } of LANGUAGES) {
      const dict = dictFor(code);
      for (const group of Object.keys(en) as (keyof Dict)[]) {
        expect(dict[group], `${code}.${String(group)}`).toBeDefined();
      }
    }
  });

  it('serves English itself, not a copy built from it', () => {
    expect(dictFor('en')).toBe(en);
  });

  it('serves a translated dictionary that is actually translated', () => {
    const spanish = dictFor('es');

    expect(spanish.app.tabs.library).not.toBe(en.app.tabs.library);
  });
});
