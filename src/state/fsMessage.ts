import type { SdMessage } from './SdContext';

/**
 * A filesystem exception as a descriptor the UI can translate, instead of a sentence in one
 * language. macOS raises NoModificationAllowedError on entries it protects (`.Trashes` and
 * friends) and on a read-only card, which is the one case worth explaining rather than echoing.
 * Anything else passes through as its own text: better raw than badly translated.
 */
export function fsMessage(e: unknown): SdMessage {
  if (e instanceof DOMException && e.name === 'NoModificationAllowedError') {
    return { key: 'fsDenied' };
  }
  return { key: 'raw', text: e instanceof Error ? e.message : String(e) };
}
