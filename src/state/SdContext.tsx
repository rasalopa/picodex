import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  parseGameData,
  serializeGameData,
  toggleFavorite as toggleGameDataFavorite,
  type GameData,
} from '../lib/gamedata';
import { parseLoaderApiVersion, parseNdsRomTitle } from '../lib/loader';
import { parseSettings, type ParsedSettings } from '../lib/settings';
import {
  COVERS,
  GAMEDATA_FILE,
  SETTINGS_FILE,
  PICO_DIR,
  friendlyFsError,
  getDir,
  listEntries,
  looksLikeDspicoSd,
  pickSdRoot,
  readFileBytes,
  readFileText,
  scanLibrary,
  writeFileText,
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
  /**
   * Re-reads library, covers and launcher files from the open SD. Resolves
   * `false` when the re-read failed (the message lands in `error`) — callers
   * whose results depend on a current library must not proceed then.
   */
  refresh: () => Promise<boolean>;
  /**
   * Toggles a game's favorite flag and writes `/_pico/gamedata.json` back to
   * the card. No-op on stock launchers (`gameData === null`): PicoDex never
   * creates the file — a stock launcher would not read it and a stray file
   * would only confuse users. Concurrent calls queue behind each other; the
   * returned promise never rejects — write failures surface via `error`.
   */
  toggleFavorite(fileName: string, gameCode?: string | null): Promise<void>;
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
  /**
   * Mirror of `gameData` for the write queue: a queued toggle must build on
   * the data of the toggle that just finished, not on the (possibly stale)
   * state its closure captured when the user clicked.
   */
  const gameDataRef = useRef<GameData | null>(null);
  /** Serializes gamedata.json writes: each toggle queues behind the last. */
  const writeChain = useRef<Promise<void>>(Promise.resolve());

  const loadFrom = useCallback(async (rootHandle: FileSystemDirectoryHandle) => {
    // in-flight favorite writes must commit before re-reading gamedata.json,
    // or the reload could revert them with a pre-toggle snapshot
    await writeChain.current;
    setProgress('Scanning game library…');
    setGames(await scanLibrary(rootHandle, SYSTEMS));
    setProgress('Reading covers…');
    setCoverIndex(await readCoverIndex(rootHandle));
    setProgress('Reading launcher data…');
    const launcher = await readLauncherFiles(rootHandle);
    gameDataRef.current = launcher.gameData;
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
        setError(friendlyFsError(e));
      }
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [loadFrom]);

  const refresh = useCallback(async (): Promise<boolean> => {
    if (!root) return false;
    setLoading(true);
    try {
      await loadFrom(root);
      return true;
    } catch (e) {
      setError(friendlyFsError(e));
      return false;
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [root, loadFrom]);

  const toggleFavorite = useCallback(
    (fileName: string, gameCode?: string | null): Promise<void> => {
      const run = async (): Promise<void> => {
        // stock launcher: no gamedata.json on the card means nothing to
        // toggle — never create the file (see the SdState doc above)
        if (root === null || gameDataRef.current === null) return;
        try {
          const next = toggleGameDataFavorite(gameDataRef.current, fileName, gameCode);
          const text = serializeGameData(next);
          const picoDir = await getDir(root, [PICO_DIR]);
          if (picoDir === null) throw new Error('No /_pico directory on the SD card');
          await writeFileText(picoDir, GAMEDATA_FILE, text);
          // write-then-state: a failed write never desyncs us from the card
          gameDataRef.current = next;
          setGameData(next);
        } catch (e) {
          setError(friendlyFsError(e));
        }
      };
      // queue, don't reject: `run` handles its own failures, so the chain
      // always settles and later toggles still go through
      const queued = writeChain.current.then(run);
      writeChain.current = queued;
      return queued;
    },
    [root],
  );

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
      toggleFavorite,
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
      toggleFavorite,
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
