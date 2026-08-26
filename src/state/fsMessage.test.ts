import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { es } from '../i18n/es';
import { resolveSdMessage } from '../i18n/messages';
import { fsMessage } from './fsMessage';

describe('fsMessage', () => {
  it('turns the macOS permission denial into a descriptor, not a sentence', () => {
    const denial = new DOMException('nope', 'NoModificationAllowedError');
    expect(fsMessage(denial)).toEqual({ key: 'fsDenied' });
  });

  it('reaches the reader in whichever language is active', () => {
    // The point of the descriptor: this used to come back as one hardcoded English string, so a
    // Spanish reader was told about their card in English.
    const message = fsMessage(new DOMException('nope', 'NoModificationAllowedError'));
    expect(resolveSdMessage(en, message)).toContain('macOS denied access');
    expect(resolveSdMessage(es, message)).toContain('macOS');
    expect(resolveSdMessage(es, message)).not.toBe(resolveSdMessage(en, message));
  });

  it('passes anything it does not own through as its own text', () => {
    expect(fsMessage(new DOMException('gone', 'NotFoundError'))).toEqual({
      key: 'raw',
      text: 'gone',
    });
    expect(fsMessage(new Error('boom'))).toEqual({ key: 'raw', text: 'boom' });
    expect(fsMessage('plain string')).toEqual({ key: 'raw', text: 'plain string' });
  });

  it('shows a passthrough identically in both languages, since it is not ours to translate', () => {
    const message = fsMessage(new Error('ENOSPC'));
    expect(resolveSdMessage(en, message)).toBe('ENOSPC');
    expect(resolveSdMessage(es, message)).toBe('ENOSPC');
  });
});
