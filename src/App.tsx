import { useState } from 'react';
import { isFileSystemAccessSupported } from './lib/sdcard';
import { SdProvider, useSd } from './state/SdContext';
import { LibraryView } from './views/LibraryView';
import { CoversView } from './views/CoversView';
import { StatsView } from './views/StatsView';
import { AssociationsView } from './views/AssociationsView';
import './App.css';

type Tab = 'library' | 'covers' | 'stats' | 'associations';

const TABS: { id: Tab; label: string }[] = [
  { id: 'library', label: 'Library' },
  { id: 'covers', label: 'Covers' },
  { id: 'stats', label: 'Pico Enhanced' },
  { id: 'associations', label: 'Associations' },
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
function Welcome() {
  const { openSd, loading, error } = useSd();
  const supported = isFileSystemAccessSupported();
  return (
    <div className="app__welcome">
      <h1 className="app__welcome-title">
        <Cartridge />
        Pico<span className="app__brand-accent">Dex</span>
      </h1>
      <p className="app__tagline">
        Manage your DSpico SD card from the browser. Your files never leave your machine.
      </p>
      {supported ? (
        <button className="primary app__cta" onClick={() => void openSd()} disabled={loading}>
          {loading ? 'Opening…' : 'Open SD card'}
        </button>
      ) : (
        <p className="app__unsupported">
          Your browser does not support the File System Access API. Please use a Chromium-based
          browser (Chrome, Edge, Brave, Opera).
        </p>
      )}
      {error && <p className="app__error">{error}</p>}
      <ul className="app__features">
        <li>
          <span className="app__feature-title">Box art</span>
          Finds games without covers and fetches launcher-ready art.
        </li>
        <li>
          <span className="app__feature-title">Your library</span>
          Every system on the card at a glance, with cover coverage.
        </li>
        <li>
          <span className="app__feature-title">Play stats</span>
          Favorites, most played and recents from Pico Enhanced.
        </li>
      </ul>
    </div>
  );
}

/** Tabbed workspace shown once an SD card is open. */
function Workspace() {
  const { root, error, refresh, loading } = useSd();
  const [tab, setTab] = useState<Tab>('library');
  return (
    <>
      <nav className="app__tabs" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'app__tab app__tab--active' : 'app__tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <span className="app__sd-name" title="Open SD card folder">
          <span className="app__sd-dot" aria-hidden="true" />
          {root?.name}
        </span>
        <button onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Reloading…' : 'Reload'}
        </button>
      </nav>
      {error && <p className="app__error">{error}</p>}
      <main className="app__content">
        {tab === 'library' && <LibraryView />}
        {tab === 'covers' && <CoversView />}
        {tab === 'stats' && <StatsView />}
        {tab === 'associations' && <AssociationsView />}
      </main>
    </>
  );
}

function Shell() {
  const { root } = useSd();
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
        <Welcome />
      )}
      <footer className="app__footer">
        <a href="https://github.com/rasalopa/picodex" target="_blank" rel="noreferrer">
          GitHub
        </a>
        <span>·</span>
        <span>MIT licensed · no telemetry</span>
      </footer>
    </div>
  );
}

/** PicoDex root component. */
export default function App() {
  return (
    <SdProvider>
      <Shell />
    </SdProvider>
  );
}
