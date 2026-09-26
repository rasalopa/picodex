/**
 * English strings, the source of truth for PicoDex's UI copy.
 *
 * The shape here defines the contract: `es.ts` (and any future language) must
 * provide exactly these keys with these types, or the build fails. Plain
 * strings stay plain; anything that needs a value interpolated is a function,
 * so a translation can reorder the sentence around the value freely.
 *
 * Deliberately NOT `as const`: the literal types would force every language
 * to repeat the English text verbatim. `typeof en` with widened strings is
 * the contract a translation file has to satisfy.
 *
 * A translation is one file that mirrors this one, and it does not have to
 * mirror all of it: `Translation<Dict>` in ./languages makes every key
 * optional and falls back to the English here, so a language can ship a
 * quarter translated and grow. See CONTRIBUTING.md for the two edits it takes.
 */
export const en = {
  app: {
    tabs: {
      library: 'Library',
      covers: 'Covers',
      stats: 'Pico Enhanced',
      associations: 'Associations',
      screenshots: 'Screenshots',
      health: 'Health',
    },
    sections: 'Sections',
    openSdFolder: 'The SD card you have open',
    reload: 'Reload',
    reloading: 'Reloading…',
    whatsNew: "What's new",
    footerLicense: 'Open source (MIT) · no tracking',
    language: 'Language',
  },
  welcome: {
    tagline:
      'Manage your Pico Launcher SD card from the browser — on the DSpico or any flashcart that runs it. Your files never leave your machine.',
    openSd: 'Open SD card',
    opening: 'Opening…',
    openLast: (name: string) => `Open ${name}`,
    lastCardReady: 'The card you had open last time.',
    lastCardAskAgain: 'The card you had open last time. Your browser will ask for access again.',
    pickDifferent: 'Pick a different card',
    unsupported:
      "Your browser can't open folders on your computer, and PicoDex needs that to read your SD card. Open this page in Chrome, Edge or Opera on a desktop or laptop computer.",
    waitingForFolder: 'Waiting for folder…',
    whatsNewButton: "What's new in PicoDex",
    features: {
      boxArtTitle: 'Box art',
      boxArtBody: 'Finds games without covers and fetches launcher-ready art.',
      libraryTitle: 'Your library',
      libraryBody: 'Every system on your card at a glance, and how many of its games have a cover.',
      statsTitle: 'Play stats',
      statsBody:
        'Favorites, most played and recently played games, if you use Pico Launcher Enhanced.',
      healthTitle: 'Card health',
      healthBody:
        'Spots macOS junk, orphaned saves, and a loader whose files came from different releases.',
      bannersTitle: 'Folder banners',
      bannersBody: 'Give each system folder a proper icon and display name.',
      associationsTitle: 'File associations',
      associationsBody:
        'Choose which emulator opens each type of ROM, without editing files by hand.',
    },
  },
  sd: {
    scanningLibrary: 'Scanning game library…',
    scanningLibraryCount: (count: number) => `Scanning game library… ${count} files`,
    readingCovers: 'Reading covers…',
    readingLauncherData: 'Reading launcher data…',
    waitingAccess: 'Waiting for access to the card…',
    needsAccess: (name: string) =>
      `PicoDex needs your permission to open ${name}. Press Open ${name} again and allow access when your browser asks.`,
    noPicoAnymore:
      "PicoDex can't find the /_pico folder on that card. If the card isn't connected, connect it first. Then press Open SD card and choose it.",
    noPicoPickRoot:
      "PicoDex can't find a /_pico folder there. Choose the SD card itself, not a folder inside it. If you already did, Pico Launcher isn't set up on this card yet.",
    noPicoOnCard:
      "PicoDex couldn't save your change because it can't find the /_pico folder on the card any more. Check that the card is still connected, then press Reload.",
    fsDenied:
      'Your computer blocked PicoDex from a file or folder on the card. Usually this means the card is locked or read-only. Check the lock switch on the side of the SD card or its adapter, unlock it if needed, then reconnect the card and press Reload.',
    fsNotFound:
      "PicoDex can't find the card, or a file on it, any more. Check that the card is still connected, then press Reload.",
  },
  errors: {
    rateLimited: 'GitHub is limiting box art searches for now. Try again in an hour.',
    rateLimitedUntil: (time: string) =>
      `GitHub is limiting box art searches until ${time}. Try again after that.`,
    catalogFailed: (status: number) =>
      `GitHub couldn't send the list of box art (error ${status}). Try again in a few minutes.`,
    catalogUnreadable:
      "GitHub's answer didn't contain the list of box art. Try again in a few minutes.",
    imageDownloadFailed: (status: number): string =>
      status === 404
        ? "This box art isn't available any more."
        : `The box art couldn't be downloaded (error ${status}). Try again in a few minutes.`,
    imageUnreadable: "PicoDex can't read this picture.",
    canvasFailed: "Your browser couldn't draw the picture. Reload the page and try again.",
    offline: "PicoDex couldn't reach GitHub. Check your internet connection and try again.",
  },
  associations: {
    title: 'File associations',
    openCard: 'Open an SD card to edit file associations.',
    // Sentences that wrap a <code> element are split in parts; the JSX joins them.
    noSettings1: 'No ',
    noSettings2: ' found — run Pico Launcher once on your flashcart so it creates ',
    noSettings3: ', then press Reload.',
    settingsInvalid1: 'PicoDex found ',
    settingsInvalid2:
      " but can't read it: it is not a valid settings file. Don't start Pico Launcher until it is fixed: if the launcher can't read it either, it replaces it with a default one and your file associations would be lost. Open it in a text editor and look for a missing comma, quote or bracket near the place below, or put back a copy you saved. Then press Reload.",
    settingsBom1: 'PicoDex found ',
    settingsBom2:
      ", but it starts with a byte order mark (BOM), an invisible mark some editors add when saving. The launcher can't read a file that starts with it and would replace it with a default one, and your file associations would be lost. Don't start Pico Launcher yet: open the file in a text editor, save it as UTF-8 without BOM, then press Reload.",
    settingsNotObject1: 'PicoDex found ',
    settingsNotObject2:
      ', but it does not hold settings: its content is not a JSON object, so there are no file associations to show. Replace its content with {} or delete the file, then press Reload.',
    settingsUnreadable1: 'PicoDex found ',
    settingsUnreadable2:
      " but couldn't open it. Another program may be using it, or the card may have a problem. Don't start Pico Launcher until PicoDex can open it: if the launcher can't read it either, it replaces it with a default one and your file associations would be lost. Close any program that is using the card, then press Reload.",
    settingsDetail: 'Details: ',
    notRead:
      "PicoDex could not finish reading this card, so it can't tell whether settings.json is there. Fix the problem shown above, then press Reload.",
    intro1: 'Choose which application the launcher opens for each file extension. Stored in ',
    intro2: '.',
    emptyList: 'No file associations yet — add one below.',
    extension: 'Extension',
    appPath: 'Application path',
    actions: 'Actions',
    pathFor: (ext: string) => `Application path for .${ext} files`,
    removeFor: (ext: string) => `Remove .${ext} association`,
    remove: 'Remove',
    add: 'Add',
    invalidExt: 'Type the letters of the extension, for example nes.',
    hint: 'Enter the extension without the dot. Common emulator paths: ',
    picoMissing:
      "Nothing was saved: PicoDex can't find the /_pico folder on the card any more. Check that the card is still connected, press Reload and save again.",
    restartWarning: 'Once saved, your changes apply the next time Pico Launcher starts on your DS.',
    emptyPaths: 'Application paths cannot be empty. Fill in or remove the blank rows.',
    discard: 'Discard changes',
    saveToSd: 'Save to SD',
    saving: 'Saving…',
  },
  statsEditor: {
    dialogLabel: (game: string) => `Edit play stats for ${game}`,
    title: (game: string) => `Edit stats — ${game}`,
    close: 'Close',
    launches: 'Launches',
    playTime: 'Play time',
    hours: 'Hours',
    minutes: 'Minutes',
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving…',
  },
  changelog: {
    dialogLabel: "What's new in PicoDex",
    title: "What's new",
    close: 'Close',
    fullNotes: 'Full release notes on GitHub',
  },
  dropImport: {
    // Row status labels, one per import phase.
    queued: 'Queued',
    copying: 'Copying…',
    added: 'Added',
    addedCover: 'Added, cover fetched',
    addedNoCover: 'Added, no cover found',
    duplicate: 'Skipped (already on card or dropped twice)',
    skipped: 'Skipped (already on card)',
    unknownType: 'Skipped (not a supported ROM file)',
    failed: 'Failed',
    failedWith: (message: string) => `Failed (${message})`,
    gamesDirError: 'Could not open the Games folder on the card',
    overlayBusy: 'Import in progress…',
    overlayDrop: 'Drop ROMs to add them to your card',
    resultsLabel: 'ROM import results',
    importing: 'Importing ROMs…',
    finished: 'Import finished',
    addedCount: (count: number) => (count === 1 ? '1 added' : `${String(count)} added`),
    dismissLabel: 'Dismiss import results',
    busyTitle: 'Import in progress',
    dismiss: 'Dismiss',
  },
  stats: {
    // Minutes rendered as a play-time string (125 → "2h 5m"); each language owns its unit abbreviations.
    duration: (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`,
    favorite: 'Favorite',
    noStatsTitle: 'No play stats yet',
    // Rendered right after the "Pico Launcher Enhanced" link, which the JSX places first.
    noStatsBody:
      'records a launch count, play time and favorite for every game. Launch something from the launcher and it shows up here.',
    gamesPlayed: 'Games played',
    favorites: 'Favorites',
    completed: 'Completed',
    totalLaunches: 'Total launches',
    totalPlayTime: 'Total play time',
    mostPlayed: 'Most played',
    recentlyPlayed: 'Recently played',
    game: 'Game',
    launches: 'Launches',
    playTime: 'Play time',
    noneLaunched: 'No games have been launched yet.',
    noFavorites: 'No favorites yet — press X on a game in the launcher to add one.',
  },
  covers: {
    regionLabel: 'Cover art',
    title: 'Covers',
    openCard: 'Open an SD card to manage covers.',
    intro:
      'Finds the games on your card without a cover and downloads box art for them from libretro-thumbnails. The covers are saved straight to your card, ready for the launcher.',
    scanFailed: (message: string) => `Scan failed: ${message}`,
    scanning: (done: number, total: number) => `Scanning ${done}/${total}…`,
    fetchResults: 'Fetch results',
    fetchingCounter: (done: number, total: number) => `Fetching covers — ${done}/${total} done`,
    batchFinished: (written: number, noMatch: number, failed: number) =>
      `Done: ${written} saved · ${noMatch} not found · ${failed} failed`,
    writtenCoverAlt: (fileName: string) => `Written cover for ${fileName}`,
    jobStatus: {
      pending: 'Queued',
      matched: 'Downloading…',
      written: 'Written',
      'no-match': 'No match',
      error: 'Failed',
    },
    viaBannerTitle: 'found by the name stored in the game',
    noBoxartFound:
      "No box art found. You can pick one by hand with the pencil on the game's cover in Library.",
    unknownError: 'Unknown error',
    catalogUnavailable:
      'Could not download the box art list. Check your internet connection and try again.',
    coversDirFailed:
      'Could not open the _pico/covers folder on your card. Check that the card is still connected and try again.',
    noGames: 'No games found on this SD card.',
    allCovered: (count: number) =>
      count === 1 ? 'Your game already has a cover.' : `All ${count} games already have covers.`,
    missingRegionLabel: 'Games missing covers',
    missingTitle: 'Missing covers',
    selectAll: 'Select all',
    selectNone: 'Select none',
    fetching: 'Fetching…',
    fetchCount: (count: number) => (count === 1 ? 'Fetch 1 cover' : `Fetch ${count} covers`),
    noGamecode: 'no game code, so the cover goes by the file name (renaming the file loses it)',
  },
  coverPicker: {
    dialogLabel: (game: string) => `Change cover for ${game}`,
    title: (game: string) => `Change cover — ${game}`,
    close: 'Close',
    searchPlaceholder: (system: string) => `Search ${system} box art…`,
    searchLabel: 'Search box art',
    ownImageHint:
      'Any PNG or JPG works. It is stretched to fill the cover, the same way the downloaded box art is.',
    catalogFailed: (message: string) =>
      `Could not download the box art list. You can press Retry, or use a picture from your computer in the next tab. Details: ${message}`,
    retry: 'Retry',
    loadingCatalog: 'Loading box art catalog…',
    noMatches: (query: string) => `No box art matches “${query}”.`,
    current: 'Current',
    currentAlt: (game: string) => `Current cover of ${game}`,
    newCover: 'New',
    composingPreview: 'Composing preview…',
    newAlt: (game: string) => `New cover preview for ${game}`,
    previewFailed: (message: string) =>
      `Could not prepare this picture. Try again or pick another one. Details: ${message}`,
    writeFailed: (message: string) => `Could not save to the card. ${message}`,
    // Rendered before a <code> path; the JSX adds the space and the path.
    writes: 'Saves to',
    writing: 'Writing…',
    coversDirMissing: 'Could not open the _pico/covers folder on your card.',
    iconHint:
      "The small picture next to the game's name in the launcher list. DS games usually bring their own, and this one replaces it. Other systems have none, so this adds one. Your image is fitted into 32×32 without stretching, and transparent parts stay transparent.",
    iconNone: 'No custom icon',
    iconInvalidOnCard:
      'The icon file on the card is not in the format the launcher reads, so the console shows a blank icon. Saving a new one replaces it.',
    iconBannerNote:
      'This game has its own banner file in _pico/banners, and the launcher takes the icon from there. An icon saved here would not show. To use your own icon, move that banner file out of _pico/banners first.',
    iconCurrentAlt: (game: string) => `Current icon of ${game}`,
    iconNewAlt: (game: string) => `New icon preview for ${game}`,
    iconsDirMissing: 'Could not open the _pico/icons folder on your card.',
    tabBoxArt: 'Box art',
    tabCoverFile: 'Cover from your computer',
    tabIconFile: 'Icon from your computer',
    topScreen: 'Top screen',
    bottomScreen: 'Bottom screen',
    save: 'Save',
    nothingToSave: 'Pick a cover or an icon first',
    builtInIconAlt: (game: string) => `Icon built into ${game}`,
    bannerIconAlt: (game: string) => `Icon from the banner file of ${game}`,
  },
  library: {
    overviewLabel: 'Library overview',
    games: 'Games',
    systems: 'Systems',
    favorites: 'Favorites',
    playTime: 'Play time',
    // Formats a minute total as "Xh Ym" (e.g. 125 → "2h 5m").
    playTimeValue: (totalMinutes: number) => {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${String(hours)}h ${String(minutes)}m`;
    },
    // Sentence around three <code> elements (/_pico, Games/nds, roms/); the JSX joins the parts.
    noGames1: 'No games found on the card. PicoDex looks in every folder except ',
    noGames2: ', so your games can be in ',
    noGames3: ', a ',
    noGames4: ' folder or anywhere else. Copy your games to the card and press Reload.',
    gameCount: (count: number) => (count === 1 ? '1 game' : `${String(count)} games`),
    covers: (covered: number, count: number, approximate: boolean) =>
      `${String(covered)}/${String(count)} covers${approximate ? ' (approx.)' : ''}`,
    approxTitle: (systemLabel: string) =>
      `Estimate. For ${systemLabel}, PicoDex counts the cover files on your card instead of checking each game, so it can be off. The Covers tab shows exactly which games have no cover.`,
    viewGames: 'View games →',
    editBannerFor: (systemLabel: string) => `Edit folder banner for ${systemLabel}`,
    editBannerTitle: (systemLabel: string) =>
      `Edit the ${systemLabel} folder banner (icon and display name shown in the launcher)`,
    cardComponentsLabel: 'Card components',
    onThisCard: 'On this card',
    launcher: 'Launcher',
    picoLoader: 'Pico Loader',
    notFound: 'Not found',
    enhancedChip: 'Pico Enhanced',
    updatedOn: (date: string) => `· updated ${date}`,
    apiVersion: (version: number) => `Installed (API v${String(version)})`,
    // Labels for the loader's API capabilities, shown next to the version.
    // Keyed to match loaderApiCapabilities()'s return values.
    capabilities: {
      gameLoading: 'Game loading',
      returnToLauncher: 'Return to launcher',
      cheats: 'Cheats',
    },
  },
  compat: {
    dialogLabel: (title: string) => `Loader compatibility for ${title}`,
    kicker: 'Loader compatibility',
    close: 'Close',
    noHeader:
      'PicoDex could not read this game file, so it cannot show what the loader does with it. The file may be damaged or only partly copied: try copying it to the card again.',
    noGameCode:
      'This game file has no readable game code, which is common with homebrew. PicoDex needs that code to check this game, so there is nothing to show here. If the game starts, there is nothing to do.',
    noLists:
      'The loader files this check needs (aplist.bin, savelist.bin, patchlist.bin) are not in /_pico. The Health tab shows which loader files are missing.',
    revisionUnreadable: 'revision unknown (the loader treats it as revision 0)',
    revision: (n: number) => `revision ${String(n)}`,
    apLabel: 'Anti-piracy fix',
    saveLabel: 'Save',
    patchLabel: 'Game-specific patch',
    // Display labels for the loader's save memory types.
    saveTypes: {
      none: 'None',
      eeprom: 'EEPROM',
      flash: 'Flash',
      nand: 'NAND',
      unknown: 'Unknown',
    },
    // Amber-warning sentence for a version mismatch: entries exist for this
    // game but none for the ROM's revision. When the header revision was
    // unreadable the loader assumed revision 0, so the wording softens.
    mismatch: (kind: 'fix' | 'patch', entryVersions: number[], romVersion: number | null) => {
      const thing = kind === 'fix' ? 'a fix' : 'a patch';
      const noun = entryVersions.length === 1 ? 'revision' : 'revisions';
      const revs = entryVersions.join(', ');
      const romPart =
        romVersion === null
          ? "your copy's revision could not be read (the loader then assumes revision 0)"
          : `your copy is revision ${String(romVersion)}`;
      return `The loader has ${thing} for ${noun} ${revs} of this game, but ${romPart}, so it is not used. If the game freezes or misbehaves, this may be why.`;
    },
    ap: {
      notListed: "Not in aplist.bin. Most games don't need this fix.",
      skipped: 'Not needed. The loader skips this step for homebrew and DSiWare.',
      applies: (dsProtectVersion: string | null) =>
        `Fixed at boot by the loader (DS Protect ${dsProtectVersion ?? 'unknown'}).`,
      listUnavailable:
        'aplist.bin is missing from /_pico or cannot be read, so this cannot be checked. The loader needs this file: check the Health tab.',
    },
    save: {
      homebrewNone: 'The loader creates no save file for homebrew.',
      dsiWareNone: 'This DSiWare game does not save.',
      dsiWare: (pubSize: string, prvSize: string | null) =>
        `Saves to a ${pubSize} .pub${prvSize ? ` and a ${prvSize} .prv` : ''} next to the game.`,
      nandHeader: (size: string) => `NAND, ${size}`,
      defaultSize: 'Not in savelist.bin, so the loader creates a 512 KB save file.',
      none: 'None — this game does not save.',
      listed: (type: string, size: string) => `${type}, ${size}`,
    },
    patch: {
      notListed: "Not in patchlist.bin. Most games don't need a patch.",
      skipped: 'Not needed. The loader does not patch homebrew.',
      applied: (count: number) =>
        count === 1 ? '1 patch applied at boot.' : `${String(count)} patches applied at boot.`,
      listUnavailable:
        "patchlist.bin is missing from /_pico or cannot be read, so this cannot be checked. Older pico-loader releases don't have this file, and updating the loader adds it.",
    },
    // Explanatory hints, per row and per ROM kind. They cannot be fixed
    // strings: the retail wording talks about the list this row reads, which
    // is meaningless for a ROM whose kind means the loader never reaches that
    // step, and the save hint describes recreating a cartridge chip, which
    // flatly contradicts "creates no save file for homebrew" sitting right
    // above it.
    hints: {
      ap: {
        retail:
          'Some games freeze on purpose when they detect a flashcart. The loader prevents that at boot, using aplist.bin and a few fixes built into the loader itself. PicoDex can only check aplist.bin.',
        dsiware:
          'Anti-piracy protection is a cartridge thing. DSiWare titles were never on a cartridge, so the loader does not run that step for them at all.',
        homebrew:
          'Anti-piracy protection is something retail games do. The loader runs none of that machinery for homebrew, so there is nothing to check.',
      },
      save: {
        retail:
          'Original cartridges have a save chip inside. The loader replaces it with a save file on your SD card.',
        dsiware:
          'DSiWare games save to files, not to a cartridge chip. The loader creates those files next to the game, at the sizes the game asks for.',
        homebrew:
          'Homebrew manages its own files on the SD card, so the loader does not create a save for it. Anything this ROM saves, it saves by itself.',
      },
      patch: {
        retail:
          'A few games need a small fix to run correctly from a flashcart. The loader applies it at boot, from patchlist.bin or from fixes built into the loader itself. PicoDex can only check patchlist.bin.',
        dsiware:
          'A few games need a small fix to run correctly from a flashcart, and DSiWare games can get one too. The loader applies it at boot, from patchlist.bin or from fixes built into the loader itself. PicoDex can only check patchlist.bin.',
        homebrew:
          'These fixes are for retail games. The loader does not apply any of them to homebrew, which runs as it is.',
      },
    },
  },
  banner: {
    dialogLabel: (system: string) => `Edit folder banner for ${system}`,
    heading: (path: string) => `Folder banner — ${path}/`,
    close: 'Close',
    sharedNote: (others: string, last: string) =>
      `This folder holds ${others} and ${last}. They share one banner, so saving here changes the icon and name of all of them.`,
    loadFailed: (detail: string) => `Could not read the current banner: ${detail}`,
    readingCurrent: 'Reading current banner…',
    previewLabel: 'Banner preview',
    titleLabel: 'Title',
    titlePlaceholder: 'Folder title shown by the launcher',
    iconLegend: 'Icon',
    iconSource: 'Icon source',
    keepCurrent: 'Keep current',
    fromImage: 'From image',
    fromGame: 'From a game',
    imageFileLabel: 'Icon image file',
    imageHint:
      'Your image is resized to fit 32×32 and reduced to 15 colors. The preview above shows exactly how it will look on the DS.',
    imageFailed: (detail: string) => `Could not read the image: ${detail}`,
    gamePicker: 'Game to take the icon from',
    chooseGame: 'Choose a game…',
    readingRom: 'Reading ROM banner…',
    noRomBanner: 'This ROM has no banner icon.',
    cannotOpen: (path: string) => `Could not open ${path}`,
    removeConfirm: (file: string) => `Remove ${file}?`,
    remove: 'Remove',
    removing: 'Removing…',
    cancel: 'Cancel',
    removeBanner: 'Remove banner',
    writes: 'Writes ',
    writing: 'Writing…',
    saveBanner: 'Save banner',
    writeFailed: (detail: string) => `Write failed: ${detail}`,
    removeFailed: (detail: string) => `Remove failed: ${detail}`,
  },
  gallery: {
    sectionLabel: (system: string) => `${system} games`,
    back: '← Library',
    shownOf: (shown: number, total: number) => `${shown} of ${total}`,
    gameCount: (count: number) => (count === 1 ? '1 game' : `${count} games`),
    searchPlaceholder: (system: string) => `Search ${system}…`,
    searchLabel: (system: string) => `Search ${system} games`,
    filters: 'Filters',
    favorites: 'Favorites',
    completed: 'Completed',
    loadError: (message: string) => `Could not load covers: ${message}`,
    loadingCovers: (done: number, total: number) => `Loading covers ${done}/${total}…`,
    noGames: (system: string) => `No ${system} games on this SD card.`,
    noMatches: 'No games match your search.',
    playTime: (hours: number, minutes: number) => `${hours}h ${minutes}m`,
    launches: (count: number) => `${count}x`,
    coverAlt: (title: string) => `Cover of ${title}`,
    changeCover: (title: string) => `Change cover for ${title}`,
    resolving: 'Reading the game…',
    pickBoxArt: 'Pick the correct box art',
    toggleFavorite: (title: string) => `Toggle favorite for ${title}`,
    removeFavorite: 'Remove from favorites',
    markFavorite: 'Mark as a favorite',
    toggleCompleted: (title: string) => `Toggle completed for ${title}`,
    unmarkCompleted: 'Unmark as completed',
    markCompleted: 'Mark as completed',
    editStats: (title: string) => `Edit play stats for ${title}`,
    correctStats: 'Correct launch count and play time',
    loaderCompat: (title: string) => `Loader compatibility for ${title}`,
    loaderCompatHint: 'What the loader does for this game',
  },
  health: {
    title: 'Card health',
    openCard: 'Open an SD card to run a health check.',
    intro:
      'Checks the card for macOS junk, missing loader files, orphaned saves and orphaned covers. Nothing is deleted without confirmation.',
    scanCard: 'Scan card',
    scanning: 'Scanning…',
    scanningCount: (count: number) =>
      count === 1 ? 'Scanning… 1 file' : `Scanning… ${count} files`,
    libraryRereadFailed:
      "PicoDex couldn't read the games on your card (see the error above), so it stopped the scan. Check that the card is still connected, then press Scan card again.",
    scannedFiles: (count: number) => (count === 1 ? 'Scanned 1 file.' : `Scanned ${count} files.`),
    skippedFolders: (count: number) =>
      count === 1
        ? 'Skipped 1 folder your computer would not let PicoDex open (normal for system folders):'
        : `Skipped ${count} folders your computer would not let PicoDex open (normal for system folders):`,
    // ConfirmDelete's two-step prompt
    deleting: 'Deleting…',
    yesDelete: 'Yes, delete',
    no: 'No',
    junkTitle: 'macOS junk',
    junkNone: 'No macOS junk files found.',
    junkCount: (count: number, size: string) =>
      count === 1 ? `1 junk file (${size})` : `${count} junk files (${size})`,
    // Sentences that wrap <code>/<a>/<strong> elements are split in parts; the JSX joins them.
    junkKinds1: 'left behind by macOS: ',
    junkKinds2: ' files and ',
    junkKinds3: '. They are safe to delete.',
    showJunk: 'Show junk files',
    junkCleanLabel: (count: number) => `Clean up ${count} ${count === 1 ? 'file' : 'files'}`,
    junkConfirmLabel: (count: number) =>
      `Confirm delete ${count} ${count === 1 ? 'file' : 'files'}?`,
    junkDeleteFailed: (files: string) =>
      `Could not delete: ${files}. They don't affect the launcher, so you can leave them.`,
    macosKeeps1: 'macOS keeps ',
    macosKeeps2:
      " on the card and puts them back every time you plug it into a Mac. They don't affect the launcher, so you can leave them.",
    fsevents1: ' only holds a ',
    fsevents2:
      ' file, which stops macOS from keeping a log of file changes on the card. Leave it as it is.',
    loaderTitle: 'Loader files',
    loaderAllPresent: 'All required loader files are present.',
    loaderMissing1: '',
    loaderMissing2: ' is missing — the loader needs it to boot games.',
    downloadFrom1: 'Download from ',
    downloadReleases: 'pico-loader releases',
    downloadFrom2: ' and copy the files into ',
    downloadFrom3: '.',
    loaderIs: 'Loader ',
    orJoiner: ' or ',
    loaderBuild1: ', the ',
    loaderBuild2: ' build.',
    loaderEnd: '.',
    ambiguityIdentical:
      ' These versions have exactly the same files, so it makes no difference which one you have.',
    ambiguityIncomplete:
      " PicoDex can't tell which, because the files that tell them apart are missing or not recognised. If your games start, there is nothing to do.",
    releasesBehind1: (count: number, atLeast: boolean) =>
      `${atLeast ? 'At least ' : ''}${count} ${count === 1 ? 'release' : 'releases'} behind `,
    releasesBehind2:
      '. To update, download it from the pico-loader releases and copy all its files into /_pico.',
    newestKnownCandidate: (tag: string) =>
      `One of them is ${tag}, the newest version PicoDex knows, so you may already be up to date.`,
    newestKnownMaybe: 'That is the newest release PicoDex knows of. Something newer may exist.',
    newestRelease: 'That is the newest release.',
    mixed1: (agreeing: number) =>
      agreeing === 1
        ? 'Your loader is only half updated: 1 of its files is from '
        : `Your loader is only half updated: ${agreeing} of its files are from `,
    mixed2: ', but ',
    andJoiner: ' and ',
    mixed3: (count: number) =>
      `${count === 1 ? 'is' : 'are'} not. That usually happens after copying some of the files over but not the rest.`,
    copyAgain1: 'Copy them all again from a single ',
    copyAgainRelease: 'pico-loader release',
    copyAgainOverwrites:
      ". This also replaces the files PicoDex doesn't recognise (listed below), so if you edited any of them by hand, keep a copy first.",
    copyAgainEnd: '.',
    unrecognisedAll:
      "PicoDex doesn't recognise any of these files, so it can't tell which loader version you have. That happens when they come from a release newer than PicoDex or have been edited by hand. If your games start, there is nothing to do.",
    unrecognisedListed1:
      "PicoDex doesn't recognise these files, so it left them out when working out the version: ",
    unrecognisedListed2: '. That happens when they have been edited by hand (common with ',
    unrecognisedListed3: '), come from a loader release newer than PicoDex or from your own build.',
    unrecognisedFine: 'If your games start, there is nothing to do.',
    githubNewer1: 'The newest pico-loader on GitHub is ',
    githubNewer2: (tag: string) =>
      `. PicoDex doesn't know ${tag} yet, so it can't tell if your card already has it. If you want it, download it from the pico-loader releases and copy all its files into /_pico.`,
    unreadable:
      "PicoDex couldn't open some loader files, so it didn't check them. Scan again, and if it keeps happening, copy them again from the pico-loader release. Files: ",
    optional1: 'Optional files not on the card: ',
    optional2: ' — fine to leave out.',
    savesTitle: 'Orphaned saves',
    savesSkipped:
      "Not checked: PicoDex found no games on the card, so it can't tell which saves belong to a game.",
    savesAllOk: 'Every save file belongs to a game on the card.',
    savesOrphans: (count: number) =>
      count === 1
        ? "1 save file has no game with the same name next to it, so the launcher won't use it. If you moved or renamed a game, move or rename its save the same way to keep your progress. Deleting is permanent: tick only the saves you are sure you don't need."
        : `${count} save files have no game with the same name next to them, so the launcher won't use them. If you moved or renamed a game, move or rename its save the same way to keep your progress. Deleting is permanent: tick only the saves you are sure you don't need.`,
    savesDeleteLabel: (count: number) => `Delete selected (${count})`,
    savesConfirmLabel: (count: number) =>
      `Confirm permanently delete ${count} save ${count === 1 ? 'file' : 'files'}?`,
    coversTitle: 'Orphaned user covers',
    coversSkipped:
      "Not checked: PicoDex found no games on the card, so it can't tell which covers belong to a game.",
    coversAllOk: 'Every user cover belongs to a game on the card.',
    coversOrphans1: (count: number) => (count === 1 ? '1 cover in ' : `${count} covers in `),
    coversOrphans2: (count: number): string =>
      count === 1
        ? " doesn't match any game on the card, usually because the game was renamed or deleted. It is ticked for deletion: untick it if you want to keep it. You can get covers again from the Covers tab."
        : " don't match any game on the card, usually because the games were renamed or deleted. They are ticked for deletion: untick any you want to keep. You can get covers again from the Covers tab.",
    coversCleanLabel: (count: number) => `Clean up selected (${count})`,
    coversConfirmLabel: (count: number) =>
      `Confirm delete ${count} ${count === 1 ? 'cover' : 'covers'}?`,
  },
  screenshots: {
    regionLabel: 'Screenshots',
    title: 'Screenshots',
    intro: 'Every capture on the card, both screens of a moment stacked into one picture.',
    openCard: 'Open an SD card to see its screenshots.',
    // Sentence around a <kbd> element; the JSX puts the key between the halves.
    empty1: 'This card has no screenshots yet. On the launcher, hold ',
    empty2: ' for about half a second to save both screens.',
    listing: 'Reading the screenshots folder…',
    loading: (done: number, total: number) => `Reading screenshots ${done}/${total}…`,
    loadError: (message: string) => `Could not read the screenshots: ${message}`,
    count: (count: number) => (count === 1 ? '1 capture' : `${String(count)} captures`),
    captureAlt: (id: string) => `Capture ${id}`,
    topOnly: 'top screen only',
    bottomOnly: 'bottom screen only',
    unreadable: 'Could not be read',
    open: 'View full size',
    close: 'Close',
    download: 'Save as PNG',
    previous: 'Previous capture',
    next: 'Next capture',
    deleteCapture: 'Delete',
    confirmDelete: 'Delete this capture from the card?',
    yesDelete: 'Yes, delete',
    no: 'No',
    deleting: 'Deleting…',
    folderGone: 'The screenshots folder is not on the card any more.',
    deleteError: (message: string) => `Could not delete it: ${message}`,
    deleted: (name: string) => `${name} deleted from the card.`,
  },
};

/** The contract every language file must satisfy. */
export type Dict = typeof en;
