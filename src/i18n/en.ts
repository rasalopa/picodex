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
 * A translation is one file that mirrors this one, and that is the part a
 * translator owns. Reaching the screen still needs a maintainer: the `Lang`
 * union and the dictionary map in src/i18n/index.tsx, the footer switch in
 * src/App.tsx, and `LocalizedText` in src/lib/changelog.ts all name the two
 * current languages one by one.
 */
export const en = {
  app: {
    tabs: {
      library: 'Library',
      covers: 'Covers',
      stats: 'Pico Enhanced',
      associations: 'Associations',
      health: 'Health',
    },
    sections: 'Sections',
    openSdFolder: 'Open SD card folder',
    reload: 'Reload',
    reloading: 'Reloading…',
    whatsNew: "What's new",
    footerLicense: 'MIT licensed · no telemetry',
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
      'Your browser does not support the File System Access API. Please use a Chromium-based browser (Chrome, Edge, Brave, Opera).',
    waitingForFolder: 'Waiting for folder…',
    whatsNewButton: "What's new in PicoDex",
    features: {
      boxArtTitle: 'Box art',
      boxArtBody: 'Finds games without covers and fetches launcher-ready art.',
      libraryTitle: 'Your library',
      libraryBody: 'Every system on the card at a glance, with cover coverage.',
      statsTitle: 'Play stats',
      statsBody: 'Favorites, most played and recents — with the Pico Launcher Enhanced fork.',
      healthTitle: 'Card health',
      healthBody:
        'Spots macOS junk, orphaned saves, and a loader whose files came from different releases.',
      bannersTitle: 'Folder banners',
      bannersBody: 'Give each system folder a proper icon and display name.',
      associationsTitle: 'File associations',
      associationsBody: 'Point each ROM extension at its emulator, no JSON editing.',
    },
  },
  sd: {
    scanningLibrary: 'Scanning game library…',
    scanningLibraryCount: (count: number) => `Scanning game library… ${count} files`,
    readingCovers: 'Reading covers…',
    readingLauncherData: 'Reading launcher data…',
    waitingAccess: 'Waiting for access to the card…',
    needsAccess: (name: string) => `PicoDex needs access to ${name} to open it.`,
    noPicoAnymore: 'That folder has no /_pico directory any more — pick a card.',
    noPicoPickRoot:
      'That folder has no /_pico directory — pick the root of a Pico Launcher SD card.',
    noPicoOnCard: 'No /_pico directory on the SD card.',
    fsDenied:
      'macOS denied access to an entry on the card — it may be a system-protected folder (like .Trashes) or the card may be mounted read-only.',
  },
  associations: {
    title: 'File associations',
    openCard: 'Open an SD card to edit file associations.',
    // Sentences that wrap a <code> element are split in parts; the JSX joins them.
    noSettings1: 'No ',
    noSettings2: ' found — run Pico Launcher once on your DSpico so it creates ',
    noSettings3: ', then refresh.',
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
    invalidExt: 'Enter a valid file extension (dots are ignored).',
    hint: 'Enter the extension without the dot. Common emulator paths: ',
    picoMissing: 'The /_pico directory is missing from the SD card.',
    restartWarning:
      'The launcher reads associations at boot — restart your DS after saving for the changes to take effect.',
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
    addedNoCover: 'Added, no cover match',
    duplicate: 'Duplicate (skipped)',
    skipped: 'Skipped (already on card)',
    unknownType: 'Unknown type',
    failed: 'Failed',
    failedWith: (message: string) => `Failed (${message})`,
    gamesDirError: 'Could not open the games directory',
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
      'Finds games without cover art, fetches matching box art from libretro-thumbnails and writes launcher-ready BMP covers to your SD card.',
    scanFailed: (message: string) => `Scan failed: ${message}`,
    scanning: (done: number, total: number) => `Scanning ${done}/${total}…`,
    fetchResults: 'Fetch results',
    fetchingCounter: (done: number, total: number) => `Fetching covers — ${done}/${total} done`,
    batchFinished: (written: number, noMatch: number, failed: number) =>
      `Batch finished: ${written} written · ${noMatch} without match · ${failed} failed`,
    writtenCoverAlt: (fileName: string) => `Written cover for ${fileName}`,
    jobStatus: {
      pending: 'Queued',
      matched: 'Downloading…',
      written: 'Written',
      'no-match': 'No match',
      error: 'Failed',
    },
    noBoxartFound: 'No box art found in the catalog',
    unknownError: 'Unknown error',
    catalogUnavailable: 'Boxart catalog unavailable',
    coversDirFailed: 'Could not open the covers directory',
    noGames: 'No games found on this SD card.',
    allCovered: (count: number) =>
      count === 1 ? 'Your game already has a cover.' : `All ${count} games already have covers.`,
    missingRegionLabel: 'Games missing covers',
    missingTitle: 'Missing covers',
    selectAll: 'Select all',
    selectNone: 'Select none',
    fetching: 'Fetching…',
    fetchCount: (count: number) => (count === 1 ? 'Fetch 1 cover' : `Fetch ${count} covers`),
    noGamecode: 'no gamecode — saved as user cover',
  },
  coverPicker: {
    dialogLabel: (game: string) => `Change cover for ${game}`,
    title: (game: string) => `Change cover — ${game}`,
    close: 'Close',
    searchPlaceholder: (system: string) => `Search ${system} box art…`,
    searchLabel: 'Search box art',
    catalogFailed: (message: string) => `Could not load the box art catalog: ${message}`,
    retry: 'Retry',
    loadingCatalog: 'Loading box art catalog…',
    noMatches: (query: string) => `No box art matches “${query}”.`,
    current: 'Current',
    currentAlt: (game: string) => `Current cover of ${game}`,
    newCover: 'New',
    composingPreview: 'Composing preview…',
    newAlt: (game: string) => `New cover preview for ${game}`,
    previewFailed: (message: string) => `Preview failed: ${message}`,
    writeFailed: (message: string) => `Write failed: ${message}`,
    // Rendered before a <code> path; the JSX adds the space and the path.
    writes: 'Writes',
    useCover: 'Use this cover',
    writing: 'Writing…',
    coversDirMissing: 'Could not open the covers directory',
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
    noGames1: 'No games found on the card. PicoDex scans every folder (except ',
    noGames2: ') for known ROM extensions, so your games can live in ',
    noGames3: ', a ',
    noGames4: ' folder, or anywhere else.',
    gameCount: (count: number) => (count === 1 ? '1 game' : `${String(count)} games`),
    covers: (covered: number, count: number, approximate: boolean) =>
      `${String(covered)}/${String(count)} covers${approximate ? ' (approx.)' : ''}`,
    approxTitle: (systemLabel: string) =>
      `Approximate: ${systemLabel} covers are keyed by ROM gamecode, which cannot be matched to files without reading each ROM. This is the number of cover files present, capped at the game count.`,
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
    apiVersion: (version: number) => `API v${String(version)}`,
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
    noHeader: "This ROM's header could not be read, so there is nothing to check it against.",
    noGameCode:
      "This ROM carries no usable game code, so the loader's lists cannot be looked up for it.",
    noLists: 'No loader lists were found on this SD card.',
    revisionUnreadable: 'revision unreadable (assuming rev 0)',
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
      const noun = entryVersions.length === 1 ? 'revision' : 'revisions';
      const revs = entryVersions.join(', ');
      const romPart =
        romVersion === null
          ? "this ROM's revision is unreadable (assuming rev 0)"
          : `this ROM is revision ${String(romVersion)}`;
      return `A ${kind} exists for ${noun} ${revs}, but ${romPart} — the loader only applies exact matches.`;
    },
    ap: {
      notListed: 'Not listed, which is not the same as “no fix needed”.',
      skipped: 'The loader skips anti-piracy for this kind of ROM.',
      applies: (dsProtectVersion: string | null) =>
        `Fix included (DS Protect ${dsProtectVersion ?? 'unknown'}).`,
      listUnavailable: 'aplist.bin is missing or unreadable — nothing to check against.',
    },
    save: {
      homebrewNone: 'The loader creates no save file for homebrew.',
      dsiWareNone: 'This DSiWare title declares no save data.',
      dsiWare: (pubSize: string, prvSize: string | null) =>
        `DSiWare: a ${pubSize} .pub${prvSize ? ` and a ${prvSize} .prv` : ''}, sized from the ROM header.`,
      nandHeader: (size: string) => `NAND, ${size} (from the ROM header)`,
      defaultSize: 'Not listed — the loader defaults to 512 KB.',
      none: 'None — this game does not save.',
      listed: (type: string, size: string) => `${type}, ${size}`,
    },
    patch: {
      notListed: 'Not listed, which is not the same as “nothing to fix”.',
      skipped: 'The loader skips game patches for this kind of ROM.',
      applied: (count: number) =>
        count === 1 ? '1 patch applied at boot.' : `${String(count)} patches applied at boot.`,
      listUnavailable: 'patchlist.bin is missing or unreadable — nothing to check against.',
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
          'Some games freeze on purpose when they notice a flashcart, and the loader undoes that at boot. This row can only read one file on your card, aplist.bin. The loader also carries fixes inside itself for games that are not in that file, and those are invisible from here.',
        dsiware:
          'Anti-piracy protection is a cartridge thing. DSiWare titles were never on a cartridge, so the loader does not run that step for them at all.',
        homebrew:
          'Anti-piracy protection is something retail games do. The loader runs none of that machinery for homebrew, so there is nothing to check.',
      },
      save: {
        retail:
          'Original cartridges have a save chip inside; the loader recreates it as a file on the SD card, sized for this game.',
        dsiware:
          'DSiWare saves to files rather than to a cartridge chip. The loader creates them next to the ROM at the sizes the ROM itself declares, so no list is involved.',
        homebrew:
          'Homebrew manages its own files on the SD card, so the loader does not create a save for it. Anything this ROM saves, it saves by itself.',
      },
      patch: {
        retail:
          'A few games need small one-off fixes to run correctly from a flashcart. This row can only read one file on your card, patchlist.bin, and the loader carries other fixes inside itself that are invisible from here.',
        dsiware:
          'A few games need small one-off fixes to run correctly from a flashcart. The loader applies these to DSiWare too - unlike the save and anti-piracy steps, this one is not skipped. It can only read one file on your card, patchlist.bin, and the loader carries other fixes inside itself that are invisible from here.',
        homebrew:
          'These fixes exist to make retail games run from a flashcart. The loader applies none of them to homebrew, which runs as built.',
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
      'Scaled to fit 32×32 and quantized to 15 colors — the preview above is exactly what the DS will show.',
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
    resolving: 'Resolving game…',
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
      'The game library could not be re-read (see the error above), so the scan was cancelled — its results would be unreliable.',
    scannedFiles: (count: number) => (count === 1 ? 'Scanned 1 file.' : `Scanned ${count} files.`),
    skippedFolders: (count: number) =>
      count === 1
        ? 'Skipped 1 folder macOS would not let the browser read:'
        : `Skipped ${count} folders macOS would not let the browser read:`,
    // ConfirmDelete's two-step prompt
    deleting: 'Deleting…',
    yesDelete: 'Yes, delete',
    no: 'No',
    junkTitle: 'macOS junk',
    junkNone: 'No macOS junk files found.',
    junkCount: (count: number, size: string) =>
      count === 1 ? `1 junk file (${size})` : `${count} junk files (${size})`,
    // Sentences that wrap <code>/<a>/<strong> elements are split in parts; the JSX joins them.
    junkKinds1: '— ',
    junkKinds2: ' AppleDouble files and ',
    junkKinds3: '.',
    showJunk: 'Show junk files',
    junkCleanLabel: (count: number) => `Clean up ${count} ${count === 1 ? 'file' : 'files'}`,
    junkConfirmLabel: (count: number) =>
      `Confirm delete ${count} ${count === 1 ? 'file' : 'files'}?`,
    junkDeleteFailed: (files: string) =>
      `Could not delete: ${files}. macOS protects some of its own files from other apps — they are harmless to the launcher.`,
    macosKeeps1: 'macOS keeps ',
    macosKeeps2:
      ' on the card. It recreates them every time you plug it into a Mac, so they are left alone — they are harmless to the launcher.',
    fsevents1: ' holds only a ',
    fsevents2: ' marker — an intentional logging-prevention setup.',
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
    ambiguityIdentical: ' Those two ship byte-identical files, so nothing can tell them apart.',
    ambiguityIncomplete:
      ' It could not be narrowed further: the files that differ between those releases are missing or not recognised here.',
    releasesBehind1: (count: number, atLeast: boolean) =>
      `${atLeast ? 'At least ' : ''}${count} ${count === 1 ? 'release' : 'releases'} behind `,
    releasesBehind2: '.',
    newestKnownCandidate: (tag: string) =>
      `${tag} is the newest release PicoDex knows of, and one of those candidates is it.`,
    newestKnownMaybe: 'That is the newest release PicoDex knows of. Something newer may exist.',
    newestRelease: 'That is the newest release.',
    mixed1: (agreeing: number) =>
      `The loader is only half updated: ${agreeing} of these files are from `,
    mixed2: ', but ',
    andJoiner: ' and ',
    mixed3: (count: number) =>
      `${count === 1 ? 'is' : 'are'} not. That usually happens after copying some of the files over but not the rest.`,
    copyAgain1: 'Copy them all again from a single ',
    copyAgainRelease: 'pico-loader release',
    copyAgainOverwrites: ' — note that also overwrites the unrecognised files listed below.',
    copyAgainEnd: '.',
    unrecognisedAll:
      "None of these files match a release PicoDex recognises — and it knows every flashcart's build of each release, so these are likely from a release newer than this build of PicoDex, or edited by hand. Nothing is wrong on the card as far as this check can tell.",
    unrecognisedListed1:
      'Not from a release PicoDex recognises, so they were left out of the answer above: ',
    unrecognisedListed2: '. Hand-editing them is normal — people do tune ',
    unrecognisedListed3: ' — and a release newer than this build of PicoDex looks the same way.',
    githubNewer1: 'GitHub reports ',
    githubNewer2: (tag: string) =>
      ` as the newest pico-loader release, which this build of PicoDex does not know about yet. Everything above still holds: it just cannot tell you whether ${tag} is newer than what your card has.`,
    unreadable: 'Could not be read, so they were not checked: ',
    optional1: 'Optional files not on the card: ',
    optional2: ' — fine to leave out.',
    savesTitle: 'Orphaned saves',
    savesSkipped:
      'Skipped: no games were found on the card, so every save would wrongly look orphaned.',
    savesAllOk: 'Every save file belongs to a game on the card.',
    savesOrphans: (count: number) =>
      count === 1
        ? '1 save file has no matching ROM in its own folder — the launcher only pairs a save with a ROM sitting next to it. Saves may hold game progress and deleting them is permanent — select only the ones you are sure about.'
        : `${count} save files have no matching ROM in their own folder — the launcher only pairs a save with a ROM sitting next to it. Saves may hold game progress and deleting them is permanent — select only the ones you are sure about.`,
    savesDeleteLabel: (count: number) => `Delete selected (${count})`,
    savesConfirmLabel: (count: number) =>
      `Confirm permanently delete ${count} save ${count === 1 ? 'file' : 'files'}?`,
    coversTitle: 'Orphaned user covers',
    coversSkipped:
      'Skipped: no games were found on the card, so every user cover would wrongly look orphaned.',
    coversAllOk: 'Every user cover belongs to a game on the card.',
    coversOrphans1: (count: number) => (count === 1 ? '1 cover in ' : `${count} covers in `),
    coversOrphans2: (count: number) =>
      ` ${count === 1 ? 'matches' : 'match'} no ROM. Covers can be regenerated from the Covers tab, so they are pre-selected.`,
    coversCleanLabel: (count: number) => `Clean up selected (${count})`,
    coversConfirmLabel: (count: number) =>
      `Confirm delete ${count} ${count === 1 ? 'cover' : 'covers'}?`,
  },
};

/** The contract every language file must satisfy. */
export type Dict = typeof en;
