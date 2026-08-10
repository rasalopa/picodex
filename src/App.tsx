import { useRef, useState, type ComponentType } from 'react';
import { ProgressBar } from './components/ProgressBar';
import { isFileSystemAccessSupported } from './lib/sdcard';
import { SdProvider, useSd } from './state/SdContext';
import { LibraryView } from './views/LibraryView';
import { CoversView } from './views/CoversView';
import { StatsView } from './views/StatsView';
import { AssociationsView } from './views/AssociationsView';
import { HealthView } from './views/HealthView';
import { DropImport } from './components/DropImport';
import { Changelog } from './components/Changelog';
import {
  IconChart,
  IconFolder,
  IconGrid,
  IconImage,
  IconLink,
  IconPulse,
} from './components/icons';
import './App.css';

type Tab = 'library' | 'covers' | 'stats' | 'associations' | 'health';

type IconComponent = ComponentType<{ className?: string }>;

const TABS: { id: Tab; label: string; Icon: IconComponent }[] = [
  { id: 'library', label: 'Library', Icon: IconGrid },
  { id: 'covers', label: 'Covers', Icon: IconImage },
  { id: 'stats', label: 'Pico Enhanced', Icon: IconChart },
  { id: 'associations', label: 'Associations', Icon: IconLink },
  { id: 'health', label: 'Health', Icon: IconPulse },
];

const FEATURES: { title: string; body: string; Icon: IconComponent }[] = [
  {
    title: 'Box art',
    body: 'Finds games without covers and fetches launcher-ready art.',
    Icon: IconImage,
  },
  {
    title: 'Your library',
    body: 'Every system on the card at a glance, with cover coverage.',
    Icon: IconGrid,
  },
  {
    title: 'Play stats',
    body: 'Favorites, most played and recents from Pico Enhanced.',
    Icon: IconChart,
  },
  {
    title: 'Card health',
    body: 'Spots macOS junk, orphaned saves, and a loader whose files came from different releases.',
    Icon: IconPulse,
  },
  {
    title: 'Folder banners',
    body: 'Give each system folder a proper icon and display name.',
    Icon: IconFolder,
  },
  {
    title: 'File associations',
    body: 'Point each ROM extension at its emulator, no JSON editing.',
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
      <p className="app__tagline">
        Manage your DSpico SD card from the browser. Your files never leave your machine.
      </p>
      {supported && lastCard != null && (
        <div className="app__last-card">
          <button
            className="primary app__cta"
            onClick={() => void openLastCard()}
            disabled={loading}
          >
            {loading ? 'Opening…' : `Open ${lastCard.name}`}
          </button>
          <p className="app__last-card-note">
            {lastCard.ready
              ? 'The card you had open last time.'
              : 'The card you had open last time. Your browser will ask for access again.'}
          </p>
          <button className="app__last-card-forget" onClick={handleDismiss} disabled={loading}>
            Pick a different card
          </button>
        </div>
      )}
      {!supported ? (
        <p className="app__unsupported">
          Your browser does not support the File System Access API. Please use a Chromium-based
          browser (Chrome, Edge, Brave, Opera).
        </p>
      ) : lastCard === null ? (
        <button
          ref={pickButton}
          className="primary app__cta"
          onClick={() => void openSd()}
          disabled={loading}
        >
          {loading ? 'Opening…' : 'Open SD card'}
        </button>
      ) : null}
      {loading && (
        <span className="app__loading" role="status">
          <ProgressBar />
          <span className="app__loading-text">{progress ?? 'Waiting for folder…'}</span>
        </span>
      )}
      {error && <p className="app__error">{error}</p>}
      <ul className="app__features">
        {FEATURES.map(({ title, body, Icon }) => (
          <li key={title}>
            <Icon className="app__feature-icon" />
            <span className="app__feature-title">{title}</span>
            {body}
          </li>
        ))}
      </ul>
      <button type="button" className="app__whatsnew" onClick={onWhatsNew}>
        What's new in PicoDex
      </button>
    </div>
  );
}

/** Tabbed workspace shown once an SD card is open. */
function Workspace() {
  const { root, error, refresh, loading, progress } = useSd();
  const [tab, setTab] = useState<Tab>('library');
  return (
    <>
      <nav className="app__tabs" aria-label="Sections">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={tab === id ? 'app__tab app__tab--active' : 'app__tab'}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            <Icon className="app__tab-icon" />
            {label}
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
      {loading && (
        <span className="app__loading" role="status">
          <ProgressBar />
          <span className="app__loading-text">{progress ?? 'Reloading…'}</span>
        </span>
      )}
      {error && <p className="app__error">{error}</p>}
      <main className="app__content">
        {tab === 'library' && <LibraryView />}
        {tab === 'covers' && <CoversView />}
        {tab === 'stats' && <StatsView />}
        {tab === 'associations' && <AssociationsView />}
        {tab === 'health' && <HealthView />}
      </main>
      <DropImport />
    </>
  );
}

function Shell() {
  const { root } = useSd();
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
          What's new
        </button>
        <span aria-hidden="true">·</span>
        <span>MIT licensed · no telemetry</span>
      </footer>
      {showChangelog && <Changelog onClose={() => setShowChangelog(false)} />}
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
