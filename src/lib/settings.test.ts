import { describe, expect, it } from 'vitest';
import { parseSettings, removeAssociation, serializeSettings, setAssociation } from './settings.ts';

/**
 * Golden vector matching the launcher's own output: ArduinoJson
 * `serializeJsonPretty` emits 2-space indentation with CRLF line endings, and
 * `JsonAppSettingsSerializer` writes the keys in this exact order.
 */
const LAUNCHER_GOLDEN = [
  '{',
  '  "language": "english",',
  '  "romBrowserLayout": "HorizontalIconGrid",',
  '  "romBrowserSortMode": "NameAscending",',
  '  "theme": "material",',
  '  "lastUsedFilePath": "/roms/nds/Pok\\u00e9mon.nds",',
  '  "fileAssociations": {',
  '    "gba": {',
  '      "appPath": "/apps/gbarunner2.nds"',
  '    },',
  '    "nes": {',
  '      "appPath": "/apps/nesds.nds"',
  '    }',
  '  }',
  '}',
].join('\r\n');

describe('parseSettings', () => {
  it('parses a launcher-written settings file (golden vector)', () => {
    const parsed = parseSettings(LAUNCHER_GOLDEN);

    expect(parsed.raw['language']).toBe('english');
    expect(parsed.raw['romBrowserLayout']).toBe('HorizontalIconGrid');
    expect(parsed.raw['romBrowserSortMode']).toBe('NameAscending');
    expect(parsed.raw['theme']).toBe('material');
    expect(parsed.raw['lastUsedFilePath']).toBe('/roms/nds/Pokémon.nds');

    expect(parsed.associations).toEqual(
      new Map([
        ['gba', '/apps/gbarunner2.nds'],
        ['nes', '/apps/nesds.nds'],
      ]),
    );
  });

  it('tolerates a missing fileAssociations key', () => {
    const parsed = parseSettings('{"language": "spanish"}');
    expect(parsed.associations.size).toBe(0);
    expect(parsed.raw['language']).toBe('spanish');
  });

  it('tolerates an empty fileAssociations object', () => {
    const parsed = parseSettings('{"fileAssociations": {}}');
    expect(parsed.associations.size).toBe(0);
  });

  it('tolerates a null fileAssociations value', () => {
    const parsed = parseSettings('{"fileAssociations": null}');
    expect(parsed.associations.size).toBe(0);
  });

  it('treats empty or whitespace-only input as an empty document', () => {
    for (const text of ['', '   ', '\r\n\t']) {
      const parsed = parseSettings(text);
      expect(parsed.raw).toEqual({});
      expect(parsed.associations.size).toBe(0);
    }
  });

  it('skips malformed association entries instead of failing', () => {
    const parsed = parseSettings(
      JSON.stringify({
        fileAssociations: {
          gba: { appPath: '/apps/gbarunner2.nds' },
          sms: '/apps/not-an-object.nds', // value not an object
          gg: { appPath: 42 }, // appPath not a string
          gbc: {}, // appPath missing
          nes: null, // null entry
          '': { appPath: '/apps/empty-ext.nds' }, // unusable key
          '.': { appPath: '/apps/dot-only.nds' }, // unusable key
        },
      }),
    );
    expect(parsed.associations).toEqual(new Map([['gba', '/apps/gbarunner2.nds']]));
  });

  it('normalizes extension keys: strips leading dot, lowercases', () => {
    const parsed = parseSettings(
      JSON.stringify({
        fileAssociations: {
          '.GBA': { appPath: '/apps/gbarunner2.nds' },
          Nes: { appPath: '/apps/nesds.nds' },
        },
      }),
    );
    expect(parsed.associations).toEqual(
      new Map([
        ['gba', '/apps/gbarunner2.nds'],
        ['nes', '/apps/nesds.nds'],
      ]),
    );
  });

  it('collapses keys that differ only in case (launcher matches case-insensitively)', () => {
    const parsed = parseSettings(
      JSON.stringify({
        fileAssociations: {
          GBA: { appPath: '/apps/first.nds' },
          gba: { appPath: '/apps/second.nds' },
        },
      }),
    );
    expect(parsed.associations).toEqual(new Map([['gba', '/apps/second.nds']]));
  });

  it('throws on invalid JSON', () => {
    expect(() => parseSettings('{ not json')).toThrow(SyntaxError);
  });

  it('throws when the root is not an object', () => {
    expect(() => parseSettings('[1, 2]')).toThrow(/root must be a JSON object/);
    expect(() => parseSettings('"hello"')).toThrow(/root must be a JSON object/);
    expect(() => parseSettings('null')).toThrow(/root must be a JSON object/);
  });
});

describe('setAssociation / removeAssociation', () => {
  it('adds a new association', () => {
    const parsed = parseSettings('{}');
    setAssociation(parsed, 'gba', '/apps/gbarunner2.nds');
    expect(parsed.associations.get('gba')).toBe('/apps/gbarunner2.nds');
  });

  it('edits an existing association', () => {
    const parsed = parseSettings(LAUNCHER_GOLDEN);
    setAssociation(parsed, 'gba', '/apps/other-runner.nds');
    expect(parsed.associations.get('gba')).toBe('/apps/other-runner.nds');
    expect(parsed.associations.size).toBe(2);
  });

  it('normalizes the extension argument (dot and case)', () => {
    const parsed = parseSettings('{}');
    setAssociation(parsed, '.GBA', '/apps/gbarunner2.nds');
    expect(parsed.associations.get('gba')).toBe('/apps/gbarunner2.nds');

    expect(removeAssociation(parsed, '.gBa')).toBe(true);
    expect(parsed.associations.size).toBe(0);
  });

  it('throws when setting an empty extension', () => {
    const parsed = parseSettings('{}');
    expect(() => setAssociation(parsed, '', '/apps/x.nds')).toThrow(/Invalid file extension/);
    expect(() => setAssociation(parsed, '.', '/apps/x.nds')).toThrow(/Invalid file extension/);
  });

  it('removeAssociation returns false for absent or invalid extensions', () => {
    const parsed = parseSettings(LAUNCHER_GOLDEN);
    expect(removeAssociation(parsed, 'sms')).toBe(false);
    expect(removeAssociation(parsed, '')).toBe(false);
    expect(parsed.associations.size).toBe(2);
  });
});

describe('serializeSettings', () => {
  it('round-trips the golden vector without changing any values', () => {
    const first = parseSettings(LAUNCHER_GOLDEN);
    const second = parseSettings(serializeSettings(first));

    expect(second.raw).toEqual(first.raw);
    expect(second.associations).toEqual(first.associations);
  });

  it('preserves unknown top-level keys and their values (future launcher versions)', () => {
    const input = JSON.stringify({
      language: 'english',
      futureFlag: true,
      futureNested: { a: [1, 2, { b: null }], c: 'text' },
      theme: 'material',
      fileAssociations: { gba: { appPath: '/apps/gbarunner2.nds' } },
      trailingUnknown: 3.5,
    });

    const parsed = parseSettings(input);
    setAssociation(parsed, 'nes', '/apps/nesds.nds');
    const reparsed = parseSettings(serializeSettings(parsed));

    expect(reparsed.raw['futureFlag']).toBe(true);
    expect(reparsed.raw['futureNested']).toEqual({ a: [1, 2, { b: null }], c: 'text' });
    expect(reparsed.raw['trailingUnknown']).toBe(3.5);
    expect(reparsed.raw['language']).toBe('english');
    expect(reparsed.raw['theme']).toBe('material');
  });

  it('keeps the original top-level key order', () => {
    const parsed = parseSettings(LAUNCHER_GOLDEN);
    const keys = Object.keys(JSON.parse(serializeSettings(parsed)) as Record<string, unknown>);
    expect(keys).toEqual([
      'language',
      'romBrowserLayout',
      'romBrowserSortMode',
      'theme',
      'lastUsedFilePath',
      'fileAssociations',
    ]);
  });

  it('folds the associations map back as { ext: { appPath } }', () => {
    const parsed = parseSettings('{}');
    setAssociation(parsed, 'gba', '/apps/gbarunner2.nds');

    const output = JSON.parse(serializeSettings(parsed)) as Record<string, unknown>;
    expect(output['fileAssociations']).toEqual({ gba: { appPath: '/apps/gbarunner2.nds' } });
  });

  it('reflects edits and removals in the output', () => {
    const parsed = parseSettings(LAUNCHER_GOLDEN);
    setAssociation(parsed, 'gba', '/apps/edited.nds');
    removeAssociation(parsed, 'nes');
    setAssociation(parsed, 'sms', '/apps/s8ds.nds');

    const output = JSON.parse(serializeSettings(parsed)) as Record<string, unknown>;
    expect(output['fileAssociations']).toEqual({
      gba: { appPath: '/apps/edited.nds' },
      sms: { appPath: '/apps/s8ds.nds' },
    });
  });

  it('appends fileAssociations when the original document had none', () => {
    const parsed = parseSettings('{"language": "english"}');
    setAssociation(parsed, 'gba', '/apps/gbarunner2.nds');

    const text = serializeSettings(parsed);
    const output = JSON.parse(text) as Record<string, unknown>;
    expect(output).toEqual({
      language: 'english',
      fileAssociations: { gba: { appPath: '/apps/gbarunner2.nds' } },
    });
  });

  it('emits an empty fileAssociations object for an empty map', () => {
    const parsed = parseSettings('{}');
    const output = JSON.parse(serializeSettings(parsed)) as Record<string, unknown>;
    expect(output['fileAssociations']).toEqual({});
  });

  it('pretty-prints with 4-space indentation', () => {
    const parsed = parseSettings(LAUNCHER_GOLDEN);
    const text = serializeSettings(parsed);
    expect(text).toMatch(/^\{\n {4}"language"/);
    expect(text).toMatch(/\n {8}"gba": \{\n {12}"appPath"/);
  });

  it('preserves non-ASCII values through a round-trip', () => {
    const parsed = parseSettings(LAUNCHER_GOLDEN);
    setAssociation(parsed, 'gbc', '/apps/カービィ.nds');
    const reparsed = parseSettings(serializeSettings(parsed));
    expect(reparsed.raw['lastUsedFilePath']).toBe('/roms/nds/Pokémon.nds');
    expect(reparsed.associations.get('gbc')).toBe('/apps/カービィ.nds');
  });

  it('is stable: serialize(parse(serialize(x))) === serialize(x)', () => {
    const parsed = parseSettings(LAUNCHER_GOLDEN);
    const once = serializeSettings(parsed);
    const twice = serializeSettings(parseSettings(once));
    expect(twice).toBe(once);
  });
});
