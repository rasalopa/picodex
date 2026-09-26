import { describe, expect, it } from 'vitest';
import { en } from './en';
import { es } from './es';
import { errorText } from './errors';
import { CatalogError, NetworkError, RateLimitedError } from '../lib/thumbnails';
import { CanvasError, ImageDecodeError, ImageDownloadError } from '../lib/coverart';

describe('errorText', () => {
  it('says the errors PicoDex raises in the reader’s language, never in the English of the Error', () => {
    const resetAt = new Date('2026-09-26T13:00:00Z');
    const time = resetAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const cases: [unknown, string, string][] = [
      [new RateLimitedError(null), en.errors.rateLimited, es.errors.rateLimited],
      [
        new RateLimitedError(resetAt),
        en.errors.rateLimitedUntil(time),
        es.errors.rateLimitedUntil(time),
      ],
      [new CatalogError('x', 500), en.errors.catalogFailed(500), es.errors.catalogFailed(500)],
      [new CatalogError('x', null), en.errors.catalogUnreadable, es.errors.catalogUnreadable],
      [
        new ImageDownloadError('x', 500),
        en.errors.imageDownloadFailed(500),
        es.errors.imageDownloadFailed(500),
      ],
      [
        new ImageDownloadError('x', 404),
        en.errors.imageDownloadFailed(404),
        es.errors.imageDownloadFailed(404),
      ],
      [new ImageDecodeError('x'), en.errors.imageUnreadable, es.errors.imageUnreadable],
      [new CanvasError('x'), en.errors.canvasFailed, es.errors.canvasFailed],
      [new NetworkError(new TypeError('Failed to fetch')), en.errors.offline, es.errors.offline],
      [new DOMException('gone', 'NotFoundError'), en.sd.fsNotFound, es.sd.fsNotFound],
      [new DOMException('nope', 'NoModificationAllowedError'), en.sd.fsDenied, es.sd.fsDenied],
    ];
    for (const [error, english, spanish] of cases) {
      expect(errorText(en, error)).toBe(english);
      expect(errorText(es, error)).toBe(spanish);
      expect(spanish).not.toBe(english);
    }
  });

  it('does not promise that retrying brings back box art that is gone', () => {
    expect(en.errors.imageDownloadFailed(404)).not.toContain('Try again');
    expect(en.errors.imageDownloadFailed(500)).toContain('Try again');
  });

  it('shows any other error as its own text', () => {
    expect(errorText(es, new Error('ENOSPC'))).toBe('ENOSPC');
    expect(errorText(en, 'plain string')).toBe('plain string');
  });
});
