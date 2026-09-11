import { useRef, useState, type ComponentType } from 'react';
import { ProgressBar } from './components/ProgressBar';
import { isFileSystemAccessSupported } from './lib/sdcard';
import { SdProvider, useSd } from './state/SdContext';
import { LANGUAGES, LanguageProvider, useLang, useT, type Lang } from './i18n';
import { resolveSdMessage } from './i18n/messages';
import type { Dict } from './i18n/en';
import { LibraryView } from './views/LibraryView';
import { CoversView } from './views/CoversView';
import { StatsView } from './views/StatsView';
import { AssociationsView } from './views/AssociationsView';
import { ScreenshotsView } from './views/ScreenshotsView';
import { HealthView } from './views/HealthView';
import { DropImport } from './components/DropImport';
import { Changelog } from './components/Changelog';
import {
  IconChart,
  IconFolder,
  IconGrid,
  IconImage,
  IconLink,
  IconScreens,
  IconPulse,
} from './components/icons';
import './App.css';

type Tab = 'library' | 'covers' | 'stats' | 'associations' | 'screenshots' | 'health';

type IconComponent = ComponentType<{ className?: string }>;

const TABS: { id: Tab; label: (t: Dict) => string; Icon: IconComponent }[] = [
  { id: 'library', label: (t) => t.app.tabs.library, Icon: IconGrid },
  { id: 'covers', label: (t) => t.app.tabs.covers, Icon: IconImage },
  { id: 'stats', label: (t) => t.app.tabs.stats, Icon: IconChart },
  { id: 'associations', label: (t) => t.app.tabs.associations, Icon: IconLink },
  { id: 'screenshots', label: (t) => t.app.tabs.screenshots, Icon: IconScreens },
  { id: 'health', label: (t) => t.app.tabs.health, Icon: IconPulse },
];

const FEATURES: {
  title: (t: Dict) => string;
  body: (t: Dict) => string;
  Icon: IconComponent;
}[] = [
  {
    title: (t) => t.welcome.features.boxArtTitle,
    body: (t) => t.welcome.features.boxArtBody,
    Icon: IconImage,
  },
  {
    title: (t) => t.welcome.features.libraryTitle,
    body: (t) => t.welcome.features.libraryBody,
    Icon: IconGrid,
  },
  {
    title: (t) => t.welcome.features.statsTitle,
    body: (t) => t.welcome.features.statsBody,
    Icon: IconChart,
  },
  {
    title: (t) => t.welcome.features.healthTitle,
    body: (t) => t.welcome.features.healthBody,
    Icon: IconPulse,
  },
  {
    title: (t) => t.welcome.features.bannersTitle,
    body: (t) => t.welcome.features.bannersBody,
    Icon: IconFolder,
  },
  {
    title: (t) => t.welcome.features.associationsTitle,
    body: (t) => t.welcome.features.associationsBody,
    Icon: IconLink,
  },
];

/** Small cartridge mark that echoes the favicon. */
function Cartridge() {
  return (
    <svg className="app__mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2" y="2" width="28" height="28" rx="6" fill="var(--bg-raised)" />
      <rect x="7" y="8" width="18" height="12" rx="2" fill="var(--accent)" />
      <rect x="10" y="11" width="12" height="6" rx="1" fill="var(--bg)" />
      <circle cx="11" cy="24" r="2" fill="var(--accent)" />
      <circle cx="21" cy="24" r="2" fill="var(--text-dim)" />
    </svg>
  );
}

function Wordmark() {
  return (
    <span className="app__logo">
      <Cartridge />
      Pico<span className="app__brand-accent">Dex</span>
    </span>
  );
}

/** Landing hero shown before an SD card is opened. */
function Welcome({ onWhatsNew }: { onWhatsNew: () => void }) {
  const { openSd, lastCard, openLastCard, dismissLastCard, loading, progress, error } = useSd();
  const t = useT();
  const supported = isFileSystemAccessSupported();
  const pickButton = useRef<HTMLButtonElement>(null);
  // Dismissing removes the button that was just clicked, so send focus to the
  // one that replaces it instead of dropping it back to the document.
  const handleDismiss = () => {
    dismissLastCard();
    requestAnimationFrame(() => pickButton.current?.focus());
  };
  return (
    <div className="app__welcome">
      <h1 className="app__welcome-title">
        <Cartridge />
        Pico<span className="app__brand-accent">Dex</span>
      </h1>
      <p className="app__tagline">{t.welcome.tagline}</p>
      {supported && lastCard != null && (
        <div className="app__last-card">
          <button
            className="primary app__cta"
            onClick={() => void openLastCard()}
            disabled={loading}
          >
            {loading ? t.welcome.opening : t.welcome.openLast(lastCard.name)}
          </button>
          <p className="app__last-card-note">
            {lastCard.ready ? t.welcome.lastCardReady : t.welcome.lastCardAskAgain}
          </p>
          <button className="app__last-card-forget" onClick={handleDismiss} disabled={loading}>
            {t.welcome.pickDifferent}
          </button>
        </div>
      )}
      {!supported ? (
        <p className="app__unsupported">{t.welcome.unsupported}</p>
      ) : lastCard === null ? (
        <button
          ref={pickButton}
          className="primary app__cta"
          onClick={() => void openSd()}
          disabled={loading}
        >
          {loading ? t.welcome.opening : t.welcome.openSd}
        </button>
      ) : null}
      {loading && (
        <span className="app__loading" role="status">
          <ProgressBar />
          <span className="app__loading-text">
            {progress ? resolveSdMessage(t, progress) : t.welcome.waitingForFolder}
          </span>
        </span>
      )}
      {error && <p className="app__error">{resolveSdMessage(t, error)}</p>}
      <ul className="app__features">
        {FEATURES.map(({ title, body, Icon }) => (
          <li key={title(t)}>
            <Icon className="app__feature-icon" />
            <span className="app__feature-title">{title(t)}</span>
            {body(t)}
          </li>
        ))}
      </ul>
      <button type="button" className="app__whatsnew" onClick={onWhatsNew}>
        {t.welcome.whatsNewButton}
      </button>
    </div>
  );
}

/** Tabbed workspace shown once an SD card is open. */
function Workspace() {
  const { root, error, refresh, loading, progress, cardInfo, gameData } = useSd();
  const t = useT();
  const [tab, setTab] = useState<Tab>('library');
  // The card is running the Enhanced fork if its launcher banner says so, or if
  // it has written a gamedata.json (favorites/play time, which stock never does).
  // Either signal counts, so a fork install from before the banner marker keeps
  // its tab, while a stock Pico Launcher on any flashcart has neither and stays
  // generic.
  const runsEnhancedFork = cardInfo.isEnhancedFork || gameData !== null;
  // the stats tab needs the fork's gamedata.json. The gallery shows on any fork
  // card, even before the first capture: the folder only appears once someone
  // has held START, and a tab that explains the shortcut beats a hidden one. A
  // card left with the folder from an older install keeps it too.
  const tabs = TABS.filter(
    (tabDef) =>
      (tabDef.id !== 'stats' || runsEnhancedFork) &&
      (tabDef.id !== 'screenshots' || cardInfo.hasScreenshots || runsEnhancedFork),
  );
  // If the active tab is no longer available (switched to a stock card while on
  // the Pico Enhanced tab), fall back to the library rather than show a phantom.
  const activeTab = tabs.some((tabDef) => tabDef.id === tab) ? tab : 'library';
  return (
    <>
      <nav className="app__tabs" aria-label={t.app.sections}>
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={activeTab === id ? 'app__tab app__tab--active' : 'app__tab'}
            aria-current={activeTab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            <Icon className="app__tab-icon" />
            {label(t)}
          </button>
        ))}
        <span className="app__sd-name" title={t.app.openSdFolder}>
          <span className="app__sd-dot" aria-hidden="true" />
          {root?.name}
        </span>
        <button onClick={() => void refresh()} disabled={loading}>
          {loading ? t.app.reloading : t.app.reload}
        </button>
      </nav>
      {loading && (
        <span className="app__loading" role="status">
          <ProgressBar />
          <span className="app__loading-text">
            {progress ? resolveSdMessage(t, progress) : t.app.reloading}
          </span>
        </span>
      )}
      {error && <p className="app__error">{resolveSdMessage(t, error)}</p>}
      <main className="app__content">
        {activeTab === 'library' && <LibraryView />}
        {activeTab === 'covers' && <CoversView />}
        {activeTab === 'stats' && <StatsView />}
        {activeTab === 'associations' && <AssociationsView />}
        {activeTab === 'screenshots' && <ScreenshotsView />}
        {activeTab === 'health' && <HealthView />}
      </main>
      <DropImport />
    </>
  );
}

/** The language switch in the footer. The stored pick wins over the browser language. */
function LanguageToggle() {
  const { lang, setLang } = useLang();
  const t = useT();
  const option = (value: Lang, label: string) => (
    <button
      key={value}
      type="button"
      className={
        lang === value ? 'app__footer-link app__lang--active' : 'app__footer-link app__lang'
      }
      aria-pressed={lang === value}
      onClick={() => setLang(value)}
    >
      {label}
    </button>
  );
  return (
    <span className="app__lang-toggle" role="group" aria-label={t.app.language}>
      {LANGUAGES.map(({ code, label }) => option(code, label))}
    </span>
  );
}

function Shell() {
  const { root } = useSd();
  const t = useT();
  const [showChangelog, setShowChangelog] = useState(false);
  return (
    <div className="app">
      {root ? (
        <>
          <header className="app__header">
            <Wordmark />
          </header>
          <Workspace />
        </>
      ) : (
        <Welcome onWhatsNew={() => setShowChangelog(true)} />
      )}
      <footer className="app__footer">
        <a href="https://github.com/rasalopa/picodex" target="_blank" rel="noreferrer">
          GitHub
        </a>
        <span aria-hidden="true">·</span>
        <button type="button" className="app__footer-link" onClick={() => setShowChangelog(true)}>
          {t.app.whatsNew}
        </button>
        <span aria-hidden="true">·</span>
        <span>{t.app.footerLicense}</span>
        <span aria-hidden="true">·</span>
        <LanguageToggle />
      </footer>
      {showChangelog && <Changelog onClose={() => setShowChangelog(false)} />}
    </div>
  );
}

/** PicoDex root component. */
export default function App() {
  return (
    <LanguageProvider>
      <SdProvider>
        <Shell />
      </SdProvider>
    </LanguageProvider>
  );
}
