import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { fsMessage } from './fsMessage';
import type { ReactNode } from 'react';
import { forgetCard, loadLastCard, rememberCard } from '../lib/lastCard';
import {
  parseGameData,
  serializeGameData,
  setGameStats,
  toggleFlag,
  type GameData,
  type GameStats,
} from '../lib/gamedata';
import { isEnhancedLauncher, parseLoaderApiVersion, parseNdsRomTitle } from '../lib/loader';
import { parseApList, parsePatchList, parseSaveList, type LoaderLists } from '../lib/loaderlists';
import { parseSettings, type ParsedSettings } from '../lib/settings';
import {
  COVERS,
  GAMEDATA_FILE,
  SETTINGS_FILE,
  PICO_DIR,
  getDir,
  isAccessError,
  listEntries,
  looksLikeDspicoSd,
  pickSdRoot,
  ensureReadWritePermission,
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
  /** True when `_picoboot.nds` is the Pico Launcher Enhanced fork (banner marker). */
  isEnhancedFork: boolean;
}

/** Names present in each cover folder, lowercased, extension included. */
export interface CoverIndex {
  nds: Set<string>;
  gba: Set<string>;
  user: Set<string>;
}

/**
 * A user-facing progress or error message, as a descriptor rather than a
 * string: the context has no business knowing the active language, so it
 * records WHAT happened and the UI renders it through the dictionary
 * (see src/i18n/messages.ts). `raw` carries texts we do not own, like a
 * DOMException message, shown as-is.
 */
export type SdMessage =
  | { key: 'scanningLibrary' }
  | { key: 'scanningLibraryCount'; count: number }
  | { key: 'readingCovers' }
  | { key: 'readingLauncherData' }
  | { key: 'waitingAccess' }
  | { key: 'needsAccess'; name: string }
  | { key: 'noPicoAnymore' }
  | { key: 'noPicoPickRoot' }
  | { key: 'noPicoOnCard' }
  | { key: 'fsDenied' }
  | { key: 'raw'; text: string };

export interface SdState {
  root: FileSystemDirectoryHandle | null;
  /** True while opening or rescanning. */
  loading: boolean;
  /** Human-readable description of the current loading phase, when any. */
  progress: SdMessage | null;
  error: SdMessage | null;
  games: LibraryFile[];
  coverIndex: CoverIndex;
  /** Parsed /_pico/gamedata.json, or null on stock launchers. */
  gameData: GameData | null;
  /** Parsed /_pico/settings.json, or null when missing/unreadable. */
  settings: ParsedSettings | null;
  /** Launcher/loader component info detected on the card. */
  cardInfo: CardInfo;
  /**
   * Parsed loader compatibility lists (`/_pico/aplist.bin`, `savelist.bin`,
   * `patchlist.bin`), or `null` until a card is open. Once open, each per-list
   * field is `null` when its file is absent or unparseable.
   */
  loaderLists: LoaderLists | null;
  openSd: () => Promise<void>;
  /**
   * The card from the last visit, offered so a return visit skips the picker.
   * `undefined` while we are still looking, `null` when there is none or once
   * one has been opened or dismissed.
   */
  lastCard: { name: string; ready: boolean } | null | undefined;
  /**
   * Opens the remembered card. Asks for permission when it has lapsed, so call
   * this from a click. Forgets the card and resolves false if it is gone.
   */
  openLastCard: () => Promise<boolean>;
  /** Stops offering the remembered card, without touching the open one. */
  dismissLastCard: () => void;
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
  /** Same contract as {@link toggleFavorite}, for the completed flag. */
  toggleCompleted(fileName: string, gameCode?: string | null): Promise<void>;
  /**
   * Overwrites a game's launch count and play time, same write contract as
   * {@link toggleFavorite} (queued, never rejects, no-op on stock launchers).
   */
  setStats(fileName: string, gameCode: string | null | undefined, stats: GameStats): Promise<void>;
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
  isEnhancedFork: false,
};

async function readCardInfo(root: FileSystemDirectoryHandle): Promise<CardInfo> {
  const info: CardInfo = { ...EMPTY_CARD_INFO };
  try {
    const handle = await root.getFileHandle('_picoboot.nds');
    const file = await handle.getFile();
    info.launcherModified = file.lastModified;
    const bytes = new Uint8Array(await file.arrayBuffer());
    info.launcherTitle = parseNdsRomTitle(bytes);
    info.isEnhancedFork = isEnhancedLauncher(bytes);
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
  const loaderLists: LoaderLists = { ap: null, save: null, patch: null };
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
    // Loader compatibility lists. An absent file leaves its list null. When a
    // file is present, the tolerant ap/save parsers always produce an array
    // (floored to whole entries, mirroring the loader's factories); only the
    // patchlist parser can still return null, for a structurally broken file.
    //
    // Guarded one by one. readFileBytes only swallows a missing entry and rethrows
    // the rest, so a list that exists but will not open (macOS lock, antivirus, a
    // failing card) would throw out of this function and discard the gamedata.json
    // and settings.json already parsed above - taking every heart, completed mark
    // and play badge with it, over a file that only feeds the compat sheet. A null
    // list is exactly the "cannot tell" that sheet already knows how to report.
    try {
      const apBytes = await readFileBytes(picoDir, 'aplist.bin');
      if (apBytes !== null) loaderLists.ap = parseApList(apBytes);
    } catch (error) {
      if (!isAccessError(error)) throw error;
    }
    try {
      const saveBytes = await readFileBytes(picoDir, 'savelist.bin');
      if (saveBytes !== null) loaderLists.save = parseSaveList(saveBytes);
    } catch (error) {
      if (!isAccessError(error)) throw error;
    }
    try {
      const patchBytes = await readFileBytes(picoDir, 'patchlist.bin');
      if (patchBytes !== null) loaderLists.patch = parsePatchList(patchBytes);
    } catch (error) {
      if (!isAccessError(error)) throw error;
    }
  }
  return { gameData, settings, loaderLists };
}

export function SdProvider({ children }: { children: ReactNode }) {
  const [root, setRoot] = useState<FileSystemDirectoryHandle | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<SdMessage | null>(null);
  const [error, setError] = useState<SdMessage | null>(null);
  const [games, setGames] = useState<LibraryFile[]>([]);
  const [coverIndex, setCoverIndex] = useState<CoverIndex>({
    nds: new Set(),
    gba: new Set(),
    user: new Set(),
  });
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [settings, setSettings] = useState<ParsedSettings | null>(null);
  const [cardInfo, setCardInfo] = useState<CardInfo>(EMPTY_CARD_INFO);
  const [loaderLists, setLoaderLists] = useState<LoaderLists | null>(null);
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
    setProgress({ key: 'scanningLibrary' });
    setGames(
      await scanLibrary(rootHandle, SYSTEMS, (filesSeen) => {
        // large collections take a while: show the walk is alive
        setProgress({ key: 'scanningLibraryCount', count: filesSeen });
      }),
    );
    setProgress({ key: 'readingCovers' });
    setCoverIndex(await readCoverIndex(rootHandle));
    setProgress({ key: 'readingLauncherData' });
    const launcher = await readLauncherFiles(rootHandle);
    gameDataRef.current = launcher.gameData;
    setGameData(launcher.gameData);
    setSettings(launcher.settings);
    setLoaderLists(launcher.loaderLists);
    setCardInfo(await readCardInfo(rootHandle));
    setProgress(null);
  }, []);

  // Card from the last visit. Only a query, never a prompt, so this is safe on
  // load; opening it is a separate, user-initiated step. `undefined` while the
  // lookup is still running, so the welcome screen can wait rather than offer
  // the picker and swap it out from under the pointer a moment later.
  const [lastCardHandle, setLastCardHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [lastCard, setLastCard] = useState<{ name: string; ready: boolean } | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let cancelled = false;
    void loadLastCard().then((remembered) => {
      if (cancelled) return;
      if (remembered === null) {
        setLastCard(null);
        return;
      }
      setLastCardHandle(remembered.handle);
      setLastCard({ name: remembered.handle.name, ready: remembered.ready });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissLastCard = useCallback(() => {
    setLastCard(null);
    setLastCardHandle(null);
    void forgetCard();
  }, []);

  const openLastCard = useCallback(async (): Promise<boolean> => {
    if (lastCardHandle === null) return false;
    setError(null);
    setLoading(true);
    try {
      setProgress({ key: 'waitingAccess' });
      if (!(await ensureReadWritePermission(lastCardHandle))) {
        // Denying the prompt is a choice, not a failure, but saying nothing
        // looks like a dead button. The card stays remembered so it can be
        // opened on the next try.
        setError({ key: 'needsAccess', name: lastCardHandle.name });
        return false;
      }
      if (!(await looksLikeDspicoSd(lastCardHandle))) {
        // the folder is still there but is not a card any more
        setError({ key: 'noPicoAnymore' });
        dismissLastCard();
        return false;
      }
      setRoot(lastCardHandle);
      setLastCard(null);
      await loadFrom(lastCardHandle);
      return true;
    } catch (e) {
      // Keep the card remembered: a read that failed once (a card pulled mid
      // scan, a locked file) says nothing about whether it will work next time,
      // and forgetting it would send the user back to the picker for good.
      setError(fsMessage(e));
      return false;
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [lastCardHandle, loadFrom, dismissLastCard]);

  const openSd = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const rootHandle = await pickSdRoot();
      if (!(await looksLikeDspicoSd(rootHandle))) {
        setError({ key: 'noPicoPickRoot' });
        return;
      }
      setRoot(rootHandle);
      setLastCard(null);
      void rememberCard(rootHandle);
      await loadFrom(rootHandle);
    } catch (e) {
      // user cancelling the picker is not an error
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError(fsMessage(e));
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
      setError(fsMessage(e));
      return false;
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [root, loadFrom]);

  // Serialized gamedata.json write: applies `mutate` to the current data,
  // writes the result to the card, then commits it to state (write-then-state
  // so a failed write never desyncs us). Each call queues behind the last on
  // writeChain. Stock launcher (no gamedata.json) is a no-op: PicoDex never
  // creates the file (see the SdState doc above).
  const runGameDataWrite = useCallback(
    (mutate: (data: GameData) => GameData): Promise<void> => {
      const run = async (): Promise<void> => {
        if (root === null || gameDataRef.current === null) return;
        try {
          const next = mutate(gameDataRef.current);
          const text = serializeGameData(next);
          const picoDir = await getDir(root, [PICO_DIR]);
          if (picoDir === null) {
            setError({ key: 'noPicoOnCard' });
            return;
          }
          await writeFileText(picoDir, GAMEDATA_FILE, text);
          gameDataRef.current = next;
          setGameData(next);
        } catch (e) {
          setError(fsMessage(e));
        }
      };
      // queue, don't reject: `run` handles its own failures, so the chain
      // always settles and later writes still go through
      const queued = writeChain.current.then(run);
      writeChain.current = queued;
      return queued;
    },
    [root],
  );

  const toggleFavorite = useCallback(
    (fileName: string, gameCode?: string | null): Promise<void> =>
      runGameDataWrite((data) => toggleFlag(data, fileName, gameCode, 'favorite')),
    [runGameDataWrite],
  );

  const toggleCompleted = useCallback(
    (fileName: string, gameCode?: string | null): Promise<void> =>
      runGameDataWrite((data) => toggleFlag(data, fileName, gameCode, 'completed')),
    [runGameDataWrite],
  );

  const setStats = useCallback(
    (fileName: string, gameCode: string | null | undefined, stats: GameStats): Promise<void> =>
      runGameDataWrite((data) => setGameStats(data, fileName, gameCode, stats)),
    [runGameDataWrite],
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
      loaderLists,
      openSd,
      lastCard,
      openLastCard,
      dismissLastCard,
      refresh,
      toggleFavorite,
      toggleCompleted,
      setStats,
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
      loaderLists,
      openSd,
      lastCard,
      openLastCard,
      dismissLastCard,
      refresh,
      toggleFavorite,
      toggleCompleted,
      setStats,
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
