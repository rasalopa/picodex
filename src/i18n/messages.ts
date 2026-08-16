import type { Dict } from './en';
import type { SdMessage } from '../state/SdContext';

/**
 * Renders an {@link SdMessage} descriptor through the active dictionary.
 *
 * Lives here rather than in the context: the context records what happened
 * without knowing the language, and the language without knowing the card.
 * `raw` is the one passthrough - a text we do not own (a DOMException message,
 * an unexpected Error) shown as-is rather than badly translated.
 */
export function resolveSdMessage(t: Dict, message: SdMessage): string {
  switch (message.key) {
    case 'scanningLibrary':
      return t.sd.scanningLibrary;
    case 'scanningLibraryCount':
      return t.sd.scanningLibraryCount(message.count);
    case 'readingCovers':
      return t.sd.readingCovers;
    case 'readingLauncherData':
      return t.sd.readingLauncherData;
    case 'waitingAccess':
      return t.sd.waitingAccess;
    case 'needsAccess':
      return t.sd.needsAccess(message.name);
    case 'noPicoAnymore':
      return t.sd.noPicoAnymore;
    case 'noPicoPickRoot':
      return t.sd.noPicoPickRoot;
    case 'noPicoOnCard':
      return t.sd.noPicoOnCard;
    case 'fsDenied':
      return t.sd.fsDenied;
    case 'raw':
      return message.text;
  }
}
