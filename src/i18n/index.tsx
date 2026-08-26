/**
 * Language plumbing: which language is active and how components read it.
 *
 * `useT()` hands back the whole active dictionary, so components read strings
 * as plain properties (`t.welcome.openSd`) and parameterized ones as calls
 * (`t.welcome.openLast(name)`). No string keys, no library - TypeScript keeps
 * every language complete (see en.ts for the contract).
 *
 * The choice: an explicit pick from the footer toggle is stored and wins
 * forever; until then the browser language decides, so a Spanish system sees
 * Spanish on first visit without touching anything.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { en, type Dict } from './en';
import { es } from './es';

export type Lang = 'en' | 'es';

const STORAGE_KEY = 'picodex-lang';

const DICTS: Record<Lang, Dict> = { en, es };

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'es') return stored;
  } catch {
    // storage can be unavailable (blocked cookies); the browser language still works
  }
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

const LanguageContext = createContext<{ lang: Lang; setLang: (lang: Lang) => void }>({
  lang: 'en',
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  // The document has to declare the language it is actually in, not the one index.html was
  // written in. A screen reader picks its voice from this, and so does the browser when it
  // offers to translate the page - a Spanish page claiming to be English gets read with an
  // English voice and offered a translation it does not need.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // not persisting is fine; the choice still applies for this visit
    }
  }, []);
  return <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>;
}

/** The active language and its setter, for the footer toggle. */
// eslint-disable-next-line react-refresh/only-export-components -- context + hook is the idiomatic pairing
export function useLang() {
  return useContext(LanguageContext);
}

/** The active dictionary. */
// eslint-disable-next-line react-refresh/only-export-components -- context + hook is the idiomatic pairing
export function useT(): Dict {
  return DICTS[useContext(LanguageContext).lang];
}
