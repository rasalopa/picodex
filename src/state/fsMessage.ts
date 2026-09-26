import type { SdMessage } from './SdContext';

/**
 * A filesystem exception as a descriptor the UI can translate, instead of a sentence in one
 * language. macOS raises NoModificationAllowedError on entries it protects (`.Trashes` and
 * friends) and on a read-only card. NotFoundError is what a card pulled out mid-read or mid-save
 * raises. Both are worth explaining rather than echoing; anything else passes through as its own
 * text: better raw than badly translated.
 */
export function fsMessage(e: unknown): SdMessage {
  if (e instanceof DOMException && e.name === 'NoModificationAllowedError') {
    return { key: 'fsDenied' };
  }
  if (e instanceof DOMException && e.name === 'NotFoundError') {
    return { key: 'fsNotFound' };
  }
  return { key: 'raw', text: e instanceof Error ? e.message : String(e) };
}
