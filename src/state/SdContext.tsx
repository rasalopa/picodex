import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { parseGameData, type GameData } from '../lib/gamedata';
import { parseLoaderApiVersion, parseNdsRomTitle } from '../lib/loader';
import { parseSettings, type ParsedSettings } from '../lib/settings';
import {
  COVERS,
  GAMEDATA_FILE,
  SETTINGS_FILE,
  PICO_DIR,
  getDir,
  listEntries,
  looksLikeDspicoSd,
  pickSdRoot,
  readFileBytes,
  readFileText,
  scanLibrary,
  type LibraryFile,
} from '../lib/sdcard';
import { SYSTEMS } from '../lib/systems';

/** Launcher/loader components detected on the card. */
export interface CardInfo {
  /** Banner title of `_picoboot.nds`, or `null` when absent/invalid. */
  launcherTitle: string | null;
  /** Last-modified time of `_picoboot.nds` (ms epoch), or `null`. */
  launcherModified: number | null;
  /** Pico Loader ABI version from `picoLoader7.bin`, or `null`. */
  loaderApiVersion: number | null;
}

/** Names present in each cover folder, lowercased, extension included. */
export interface CoverIndex {
  nds: Set<string>;
  gba: Set<string>;
  user: Set<string>;
}

export interface SdState {
  root: FileSystemDirectoryHandle | null;
  /** True while opening or rescanning. */
  loading: boolean;
  /** Human-readable description of the current loading phase, when any. */
  progress: string | null;
  error: string | null;
  games: LibraryFile[];
  coverIndex: CoverIndex;
  /** Parsed /_pico/gamedata.json, or null on stock launchers. */
  gameData: GameData | null;
  /** Parsed /_pico/settings.json, or null when missing/unreadable. */
  settings: ParsedSettings | null;
  /** Launcher/loader component info detected on the card. */
  cardInfo: CardInfo;
  openSd: () => Promise<void>;
  /** Re-reads library, covers and launcher files from the open SD. */
  refresh: () => Promise<void>;
}

const SdContext = createContext<SdState | null>(null);

async function readCoverIndex(root: FileSystemDirectoryHandle): Promise<CoverIndex> {
  const index: CoverIndex = { nds: new Set(), gba: new Set(), user: new Set() };
  for (const key of ['nds', 'gba', 'user'] as const) {
    const dir = await getDir(root, COVERS[key]);
    if (!dir) continue;
    for (const entry of await listEntries(dir)) {
      if (entry.kind === 'file' && !entry.name.startsWith('.')) {
        index[key].add(entry.name.toLowerCase());
      }
    }
  }
  return index;
}

const EMPTY_CARD_INFO: CardInfo = {
  launcherTitle: null,
  launcherModified: null,
  loaderApiVersion: null,
};

async function readCardInfo(root: FileSystemDirectoryHandle): Promise<CardInfo> {
  const info: CardInfo = { ...EMPTY_CARD_INFO };
  try {
    const handle = await root.getFileHandle('_picoboot.nds');
    const file = await handle.getFile();
    info.launcherModified = file.lastModified;
    info.launcherTitle = parseNdsRomTitle(new Uint8Array(await file.arrayBuffer()));
  } catch {
    // no launcher rom at the root: fields stay null
  }
  const picoDir = await getDir(root, [PICO_DIR]);
  if (picoDir) {
    const loader7 = await readFileBytes(picoDir, 'picoLoader7.bin');
    if (loader7 !== null) {
      info.loaderApiVersion = parseLoaderApiVersion(loader7);
    }
  }
  return info;
}

async function readLauncherFiles(root: FileSystemDirectoryHandle) {
  const picoDir = await getDir(root, [PICO_DIR]);
  let gameData: GameData | null = null;
  let settings: ParsedSettings | null = null;
  if (picoDir) {
    const gameDataText = await readFileText(picoDir, GAMEDATA_FILE);
    if (gameDataText !== null) {
      try {
        gameData = parseGameData(gameDataText);
      } catch {
        gameData = null;
      }
    }
    const settingsText = await readFileText(picoDir, SETTINGS_FILE);
    if (settingsText !== null) {
      try {
        settings = parseSettings(settingsText);
      } catch {
        settings = null;
      }
    }
  }
  return { gameData, settings };
}

export function SdProvider({ children }: { children: ReactNode }) {
  const [root, setRoot] = useState<FileSystemDirectoryHandle | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<LibraryFile[]>([]);
  const [coverIndex, setCoverIndex] = useState<CoverIndex>({
    nds: new Set(),
    gba: new Set(),
    user: new Set(),
  });
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [settings, setSettings] = useState<ParsedSettings | null>(null);
  const [cardInfo, setCardInfo] = useState<CardInfo>(EMPTY_CARD_INFO);

  const loadFrom = useCallback(async (rootHandle: FileSystemDirectoryHandle) => {
    setProgress('Scanning game library…');
    setGames(await scanLibrary(rootHandle, SYSTEMS));
    setProgress('Reading covers…');
    setCoverIndex(await readCoverIndex(rootHandle));
    setProgress('Reading launcher data…');
    const launcher = await readLauncherFiles(rootHandle);
    setGameData(launcher.gameData);
    setSettings(launcher.settings);
    setCardInfo(await readCardInfo(rootHandle));
    setProgress(null);
  }, []);

  const openSd = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const rootHandle = await pickSdRoot();
      if (!(await looksLikeDspicoSd(rootHandle))) {
        setError('That folder has no /_pico directory — pick the root of a DSpico SD card.');
        return;
      }
      setRoot(rootHandle);
      await loadFrom(rootHandle);
    } catch (e) {
      // user cancelling the picker is not an error
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [loadFrom]);

  const refresh = useCallback(async () => {
    if (!root) return;
    setLoading(true);
    try {
      await loadFrom(root);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [root, loadFrom]);

  const value = useMemo(
    () => ({
      root,
      loading,
      progress,
      error,
      games,
      coverIndex,
      gameData,
      settings,
      cardInfo,
      openSd,
      refresh,
    }),
    [
      root,
      loading,
      progress,
      error,
      games,
      coverIndex,
      gameData,
      settings,
      cardInfo,
      openSd,
      refresh,
    ],
  );

  return <SdContext.Provider value={value}>{children}</SdContext.Provider>;
}

/** Access the SD state; must be used under an SdProvider. */
// eslint-disable-next-line react-refresh/only-export-components -- context + hook is the idiomatic pairing
export function useSd(): SdState {
  const state = useContext(SdContext);
  if (!state) throw new Error('useSd must be used within SdProvider');
  return state;
}
