import type { Dict } from './en';
import { resolveSdMessage } from './messages';
import { fsMessage } from '../state/fsMessage';
import { CatalogError, NetworkError, RateLimitedError } from '../lib/thumbnails';
import { CanvasError, ImageDownloadError } from '../lib/coverart';

/**
 * Renders an error for the reader in the active language. The errors PicoDex
 * raises itself are translated by type, a filesystem error goes through
 * {@link fsMessage}, and anything else shows its own text.
 */
export function errorText(t: Dict, e: unknown): string {
  if (e instanceof RateLimitedError) {
    return e.resetAt === null
      ? t.errors.rateLimited
      : t.errors.rateLimitedUntil(e.resetAt.toLocaleTimeString());
  }
  if (e instanceof CatalogError) {
    return e.status === null ? t.errors.catalogUnreadable : t.errors.catalogFailed(e.status);
  }
  if (e instanceof ImageDownloadError) {
    return t.errors.imageDownloadFailed(e.status);
  }
  if (e instanceof CanvasError) {
    return t.errors.canvasFailed;
  }
  if (e instanceof NetworkError) {
    return t.errors.offline;
  }
  return resolveSdMessage(t, fsMessage(e));
}
