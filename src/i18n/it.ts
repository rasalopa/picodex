/**
 * Italian strings for PicoDex, mirroring `en.ts` key by key.
 *
 * Wording conventions: "scheda" always means the SD card, so the app's tabs are
 * called "sezioni" in running text to keep the two apart. Launcher, loader,
 * flashcart, box art and ROM stay in English, as Italian players say them.
 */
import type { Dict } from './en';
import type { Translation } from './languages';

export const it: Translation<Dict> = {
  app: {
    tabs: {
      library: 'Libreria',
      covers: 'Copertine',
      stats: 'Pico Enhanced',
      associations: 'Associazioni',
      screenshots: 'Screenshot',
      health: 'Diagnostica',
    },
    sections: 'Sezioni',
    openSdFolder: 'La scheda SD aperta',
    reload: 'Ricarica',
    reloading: 'Ricarico…',
    whatsNew: 'Novità',
    footerLicense: 'Open source (MIT) · nessun tracciamento',
    language: 'Lingua',
    /** Label and tooltip of the repository card in the header. */
    repoCard: (slug: string) => `${slug} su GitHub`,
    repoCardStats: (slug: string, stars: string, forks: string) =>
      `${slug} su GitHub. Stelle: ${stars}. Fork: ${forks}.`,
    themeDark: 'Scuro',
    themeLight: 'Chiaro',
    themeSystem: 'Sistema',
    /** Label and tooltip of the footer theme button: the pick now, then what a click picks. */
    themeButton: (current: string, next: string) =>
      `Tema: ${current}. Fai clic per passare a ${next}.`,
  },
  welcome: {
    tagline:
      'Gestisci la scheda SD di Pico Launcher dal browser, sul DSpico o su qualsiasi flashcart che lo esegue. I tuoi file non lasciano mai il tuo computer.',
    openSd: 'Apri scheda SD',
    opening: 'Apertura…',
    openLast: (name: string) => `Apri ${name}`,
    lastCardReady: "La scheda che avevi aperto l'ultima volta.",
    lastCardAskAgain:
      "La scheda che avevi aperto l'ultima volta. Il browser ti chiederà di nuovo l'accesso.",
    pickDifferent: "Scegli un'altra scheda",
    unsupported:
      'Il tuo browser non può aprire le cartelle del computer, e PicoDex ne ha bisogno per leggere la scheda SD. Apri questa pagina con Chrome, Edge o Opera su un computer fisso o portatile.',
    waitingForFolder: 'In attesa della cartella…',
    whatsNewButton: 'Novità di PicoDex',
    features: {
      boxArtTitle: 'Copertine',
      boxArtBody: 'Trova i giochi senza copertina e scarica immagini pronte per il launcher.',
      libraryTitle: 'La tua libreria',
      libraryBody:
        "Tutti i sistemi della scheda a colpo d'occhio, e quanti dei loro giochi hanno una copertina.",
      statsTitle: 'Statistiche di gioco',
      statsBody:
        'Preferiti, giochi più giocati e giocati di recente, se usi Pico Launcher Enhanced.',
      healthTitle: 'Stato della scheda',
      healthBody:
        'Individua i file spazzatura di macOS, i salvataggi orfani e un loader con file di versioni diverse.',
      bannersTitle: 'Banner delle cartelle',
      bannersBody:
        "Dai a ogni cartella di sistema un'icona e un nome visualizzato. Richiede un Pico Launcher più recente della v1.3.0.",
      associationsTitle: 'Associazioni dei file',
      associationsBody:
        'Scegli quale emulatore apre ogni tipo di ROM, senza modificare file a mano.',
    },
  },
  sd: {
    scanningLibrary: 'Analisi della libreria…',
    scanningLibraryCount: (count: number) => `Analisi della libreria… ${count} file`,
    readingCovers: 'Lettura delle copertine…',
    readingLauncherData: 'Lettura dei dati del launcher…',
    waitingAccess: "In attesa dell'accesso alla scheda…",
    needsAccess: (name: string) =>
      `PicoDex ha bisogno del tuo permesso per aprire ${name}. Premi di nuovo Apri ${name} e consenti l'accesso quando il browser lo chiede.`,
    noPicoAnymore:
      'PicoDex non trova la cartella /_pico su quella scheda. Se la scheda non è collegata, collegala. Poi premi Apri scheda SD e selezionala.',
    noPicoPickRoot:
      'PicoDex non trova una cartella /_pico lì. Scegli la radice della scheda SD, non una cartella al suo interno. Se lo hai già fatto, Pico Launcher non è ancora installato su questa scheda.',
    noPicoOnCard:
      'PicoDex non ha potuto salvare la modifica perché non trova più la cartella /_pico sulla scheda. Controlla che la scheda sia ancora collegata, poi premi Ricarica.',
    fsDenied:
      "Il computer ha impedito a PicoDex di accedere a un file o a una cartella della scheda. Di solito significa che la scheda è bloccata o in sola lettura. Controlla l'interruttore di blocco sul lato della scheda SD o del suo adattatore, sbloccalo se serve, poi ricollega la scheda e premi Ricarica.",
    fsNotFound:
      'PicoDex non trova più la scheda, o un file su di essa. Controlla che la scheda sia ancora collegata, poi premi Ricarica.',
  },
  errors: {
    rateLimited: "GitHub sta limitando le ricerche di copertine. Riprova tra un'ora.",
    rateLimitedUntil: (time: string) =>
      `GitHub sta limitando le ricerche di copertine fino alle ${time}. Riprova dopo quell'ora.`,
    catalogFailed: (status: number) =>
      `GitHub non è riuscito a inviare l'elenco delle copertine (errore ${status}). Riprova tra qualche minuto.`,
    catalogUnreadable:
      "La risposta di GitHub non conteneva l'elenco delle copertine. Riprova tra qualche minuto.",
    imageDownloadFailed: (status: number): string =>
      status === 404
        ? 'Questa copertina non è più disponibile.'
        : `Non è stato possibile scaricare la copertina (errore ${status}). Riprova tra qualche minuto.`,
    imageUnreadable: 'PicoDex non riesce a leggere questa immagine.',
    canvasFailed: "Il browser non è riuscito a disegnare l'immagine. Ricarica la pagina e riprova.",
    offline:
      'PicoDex non è riuscito a raggiungere GitHub. Controlla la connessione a Internet e riprova.',
  },
  associations: {
    title: 'Associazioni dei file',
    openCard: 'Apri una scheda SD per modificare le associazioni dei file.',
    // Sentences that wrap a <code> element are split in parts; the JSX joins them.
    noSettings1: 'Nessun file ',
    noSettings2: ' trovato: avvia Pico Launcher una volta sul flashcart perché crei ',
    noSettings3: ', poi premi Ricarica.',
    settingsInvalid1: 'PicoDex ha trovato ',
    settingsInvalid2:
      ' ma non riesce a leggerlo: non è un file di impostazioni valido. Non avviare Pico Launcher finché non è sistemato: se nemmeno il launcher riesce a leggerlo, lo sostituisce con uno predefinito e perderesti le tue associazioni dei file. Aprilo in un editor di testo e cerca una virgola, una virgoletta o una parentesi mancante vicino al punto indicato sotto, oppure rimetti una copia che avevi salvato. Poi premi Ricarica.',
    settingsBom1: 'PicoDex ha trovato ',
    settingsBom2:
      ', ma inizia con un byte order mark (BOM), un segno invisibile che alcuni editor aggiungono al salvataggio. Il launcher non riesce a leggere un file che inizia così e lo sostituirebbe con uno predefinito, e perderesti le tue associazioni dei file. Non avviare ancora Pico Launcher: apri il file in un editor di testo, salvalo come UTF-8 senza BOM, poi premi Ricarica.',
    settingsNotObject1: 'PicoDex ha trovato ',
    settingsNotObject2:
      ', ma non contiene impostazioni: il suo contenuto non è un oggetto JSON, quindi non ci sono associazioni dei file da mostrare. Sostituisci il contenuto con {} o elimina il file, poi premi Ricarica.',
    settingsUnreadable1: 'PicoDex ha trovato ',
    settingsUnreadable2:
      ' ma non è riuscito ad aprirlo. Potrebbe essere in uso da un altro programma, o la scheda potrebbe avere un problema. Non avviare Pico Launcher finché PicoDex non riesce ad aprirlo: se nemmeno il launcher riesce a leggerlo, lo sostituisce con uno predefinito e perderesti le tue associazioni dei file. Chiudi i programmi che stanno usando la scheda, poi premi Ricarica.',
    settingsDetail: 'Dettagli: ',
    notRead:
      'PicoDex non è riuscito a finire di leggere questa scheda, quindi non sa se settings.json è presente. Risolvi il problema indicato sopra, poi premi Ricarica.',
    intro1: 'Scegli quale applicazione apre il launcher per ogni estensione di file. Salvate in ',
    intro2: '.',
    emptyList: 'Ancora nessuna associazione: aggiungine una qui sotto.',
    extension: 'Estensione',
    appPath: "Percorso dell'applicazione",
    actions: 'Azioni',
    pathFor: (ext: string) => `Percorso dell'applicazione per i file .${ext}`,
    removeFor: (ext: string) => `Rimuovi l'associazione .${ext}`,
    remove: 'Rimuovi',
    add: 'Aggiungi',
    invalidExt: "Scrivi le lettere dell'estensione, per esempio nes.",
    hint: "Inserisci l'estensione senza il punto. Percorsi comuni degli emulatori: ",
    picoMissing:
      'Non è stato salvato nulla: PicoDex non trova più la cartella /_pico sulla scheda. Controlla che la scheda sia ancora collegata, premi Ricarica e salva di nuovo.',
    restartWarning:
      'Una volta salvate, le modifiche hanno effetto al prossimo avvio di Pico Launcher sul DS.',
    emptyPaths:
      'I percorsi delle applicazioni non possono essere vuoti. Compila o rimuovi le righe vuote.',
    discard: 'Annulla modifiche',
    saveToSd: 'Salva sulla SD',
    saving: 'Salvataggio…',
  },
  statsEditor: {
    dialogLabel: (game: string) => `Modifica le statistiche di gioco di ${game}`,
    title: (game: string) => `Modifica statistiche — ${game}`,
    close: 'Chiudi',
    launches: 'Avvii',
    playTime: 'Tempo di gioco',
    hours: 'Ore',
    minutes: 'Minuti',
    cancel: 'Annulla',
    save: 'Salva',
    saving: 'Salvataggio…',
  },
  changelog: {
    dialogLabel: 'Novità di PicoDex',
    title: 'Novità',
    close: 'Chiudi',
    fullNotes: 'Note di rilascio complete su GitHub',
  },
  dropImport: {
    // Row status labels, one per import phase.
    queued: 'In coda',
    copying: 'Copia…',
    added: 'Aggiunto',
    addedCover: 'Aggiunto, copertina scaricata',
    addedNoCover: 'Aggiunto, nessuna copertina trovata',
    duplicate: 'Saltato (già sulla scheda o trascinato due volte)',
    skipped: 'Saltato (già sulla scheda)',
    unknownType: 'Saltato (non è un file ROM supportato)',
    failed: 'Non riuscito',
    failedWith: (message: string) => `Non riuscito (${message})`,
    gamesDirError: 'Impossibile aprire la cartella Games sulla scheda',
    overlayBusy: 'Importazione in corso…',
    overlayDrop: 'Rilascia le ROM per aggiungerle alla scheda',
    resultsLabel: "Risultati dell'importazione delle ROM",
    importing: 'Importazione delle ROM…',
    finished: 'Importazione completata',
    addedCount: (count: number) => (count === 1 ? '1 aggiunto' : `${String(count)} aggiunti`),
    dismissLabel: "Chiudi i risultati dell'importazione",
    busyTitle: 'Importazione in corso',
    dismiss: 'Chiudi',
  },
  stats: {
    // Minutes rendered as a play-time string (125 → "2h 5m"); each language owns its unit abbreviations.
    duration: (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`,
    favorite: 'Preferito',
    noStatsTitle: 'Ancora nessuna statistica di gioco',
    // Rendered right after the "Pico Launcher Enhanced" link, which the JSX places first.
    noStatsBody:
      'registra il numero di avvii, il tempo di gioco e i preferiti per ogni gioco. Avvia qualcosa dal launcher e comparirà qui.',
    gamesPlayed: 'Giochi giocati',
    favorites: 'Preferiti',
    completed: 'Completati',
    totalLaunches: 'Avvii totali',
    totalPlayTime: 'Tempo di gioco totale',
    mostPlayed: 'Più giocati',
    recentlyPlayed: 'Giocati di recente',
    game: 'Gioco',
    launches: 'Avvii',
    playTime: 'Tempo di gioco',
    noneLaunched: 'Non è ancora stato avviato nessun gioco.',
    noFavorites: 'Ancora nessun preferito: premi X su un gioco nel launcher per aggiungerlo.',
  },
  covers: {
    regionLabel: 'Copertine',
    title: 'Copertine',
    openCard: 'Apri una scheda SD per gestire le copertine.',
    intro:
      'Trova i giochi della scheda senza copertina e scarica le box art da libretro-thumbnails. Le copertine vengono salvate direttamente sulla scheda, pronte per il launcher.',
    scanFailed: (message: string) => `Analisi non riuscita: ${message}`,
    scanning: (done: number, total: number) => `Analisi ${done}/${total}…`,
    fetchResults: 'Risultati del download',
    fetchingCounter: (done: number, total: number) =>
      `Download delle copertine — ${done}/${total} completate`,
    batchFinished: (written: number, noMatch: number, failed: number) =>
      `Fatto: ${written} salvate · ${noMatch} non trovate · ${failed} non riuscite`,
    writtenCoverAlt: (fileName: string) => `Copertina salvata per ${fileName}`,
    jobStatus: {
      pending: 'In coda',
      matched: 'Download…',
      written: 'Salvata',
      'no-match': 'Nessuna corrispondenza',
      error: 'Non riuscita',
    },
    viaBannerTitle: 'trovata con il nome memorizzato nel gioco',
    noBoxartFound:
      'Nessuna box art trovata. Puoi sceglierne una a mano con la matita sulla copertina del gioco nella Libreria.',
    unknownError: 'Errore sconosciuto',
    catalogUnavailable:
      "Impossibile scaricare l'elenco delle box art. Controlla la connessione a Internet e riprova.",
    coversDirFailed:
      'Impossibile aprire la cartella _pico/covers sulla scheda. Controlla che la scheda sia ancora collegata e riprova.',
    noGames: 'Nessun gioco trovato su questa scheda SD.',
    allCovered: (count: number) =>
      count === 1
        ? 'Il tuo gioco ha già una copertina.'
        : `Tutti i ${count} giochi hanno già una copertina.`,
    missingRegionLabel: 'Giochi senza copertina',
    missingTitle: 'Copertine mancanti',
    selectAll: 'Seleziona tutto',
    selectNone: 'Deseleziona tutto',
    fetching: 'Download…',
    fetchCount: (count: number) =>
      count === 1 ? 'Scarica 1 copertina' : `Scarica ${count} copertine`,
    noGamecode:
      'nessun codice del gioco, quindi la copertina segue il nome del file (rinominando il file la perdi)',
  },
  coverPicker: {
    dialogLabel: (game: string) => `Cambia la copertina di ${game}`,
    title: (game: string) => `Cambia copertina — ${game}`,
    close: 'Chiudi',
    searchPlaceholder: (system: string) => `Cerca box art ${system}…`,
    searchLabel: 'Cerca box art',
    ownImageHint:
      'Va bene qualsiasi PNG o JPG. Viene allungata per riempire la copertina, come le box art scaricate.',
    catalogFailed: (message: string) =>
      `Impossibile scaricare l'elenco delle box art. Puoi premere Riprova, oppure usare un'immagine del tuo computer nella scheda successiva. Dettagli: ${message}`,
    retry: 'Riprova',
    loadingCatalog: 'Caricamento del catalogo delle box art…',
    noMatches: (query: string) => `Nessuna box art corrisponde a “${query}”.`,
    current: 'Attuale',
    currentAlt: (game: string) => `Copertina attuale di ${game}`,
    newCover: 'Nuova',
    composingPreview: 'Preparazione anteprima…',
    newAlt: (game: string) => `Anteprima della nuova copertina di ${game}`,
    previewFailed: (message: string) =>
      `Impossibile preparare questa immagine. Riprova o scegline un'altra. Dettagli: ${message}`,
    writeFailed: (message: string) => `Impossibile salvare sulla scheda. ${message}`,
    // Rendered before a <code> path; the JSX adds the space and the path.
    writes: 'Salva in',
    writing: 'Scrittura…',
    coversDirMissing: 'Impossibile aprire la cartella _pico/covers sulla scheda.',
    iconHint:
      "La piccola immagine accanto al nome del gioco nell'elenco del launcher. I giochi DS di solito hanno la propria, e questa la sostituisce. Gli altri sistemi non ne hanno, quindi questa ne aggiunge una. L'immagine viene adattata a 32×32 senza deformarla, e le parti trasparenti restano trasparenti.",
    iconNone: 'Nessuna icona personalizzata',
    iconNeedsNewer:
      "Le icone personalizzate richiedono un Pico Launcher più recente della v1.3.0. Con la release v1.3.0 l'icona viene salvata sulla scheda, ma la console continua a mostrare quella del gioco.",
    iconInvalidOnCard:
      "Il file dell'icona sulla scheda non è nel formato che il launcher legge, quindi la console mostra un'icona vuota. Salvandone una nuova lo sostituisci.",
    iconBannerNote:
      "Questo gioco ha un proprio file banner in _pico/banners, e il launcher prende l'icona da lì. Un'icona salvata qui non verrebbe mostrata. Per usare la tua icona, sposta prima quel file banner fuori da _pico/banners.",
    iconCurrentAlt: (game: string) => `Icona attuale di ${game}`,
    iconNewAlt: (game: string) => `Anteprima della nuova icona di ${game}`,
    iconsDirMissing: 'Impossibile aprire la cartella _pico/icons sulla scheda.',
    tabBoxArt: 'Box art',
    tabCoverFile: 'Copertina dal computer',
    tabIconFile: 'Icona dal computer',
    topScreen: 'Schermo superiore',
    bottomScreen: 'Schermo inferiore',
    save: 'Salva',
    nothingToSave: "Scegli prima una copertina o un'icona",
    builtInIconAlt: (game: string) => `Icona integrata in ${game}`,
    bannerIconAlt: (game: string) => `Icona dal file banner di ${game}`,
  },
  library: {
    overviewLabel: 'Panoramica della libreria',
    games: 'Giochi',
    systems: 'Sistemi',
    favorites: 'Preferiti',
    playTime: 'Tempo di gioco',
    // Formats a minute total as "Xh Ym" (e.g. 125 → "2h 5m").
    playTimeValue: (totalMinutes: number) => {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${String(hours)}h ${String(minutes)}m`;
    },
    // Sentence around three <code> elements (/_pico, Games/nds, roms/); the JSX joins the parts.
    noGames1: 'Nessun gioco trovato sulla scheda. PicoDex cerca in tutte le cartelle tranne ',
    noGames2: ', quindi i tuoi giochi possono stare in ',
    noGames3: ', in una cartella ',
    noGames4: ' o in qualsiasi altro posto. Copia i giochi sulla scheda e premi Ricarica.',
    gameCount: (count: number) => (count === 1 ? '1 gioco' : `${String(count)} giochi`),
    covers: (covered: number, count: number, approximate: boolean) =>
      `${String(covered)}/${String(count)} copertine${approximate ? ' (circa)' : ''}`,
    approxTitle: (systemLabel: string) =>
      `Stima. Per ${systemLabel}, PicoDex conta i file delle copertine sulla scheda invece di controllare ogni gioco, quindi potrebbe non essere esatta. La sezione Copertine mostra con precisione quali giochi non hanno una copertina.`,
    viewGames: 'Vedi i giochi →',
    editBannerFor: (systemLabel: string) => `Modifica il banner della cartella di ${systemLabel}`,
    editBannerTitle: (systemLabel: string) =>
      `Modifica il banner della cartella di ${systemLabel} (icona e nome mostrati nel launcher)`,
    cardComponentsLabel: 'Componenti della scheda',
    onThisCard: 'Su questa scheda',
    launcher: 'Launcher',
    picoLoader: 'Pico Loader',
    notFound: 'Non trovato',
    enhancedChip: 'Pico Enhanced',
    updatedOn: (date: string) => `· aggiornato il ${date}`,
    apiVersion: (version: number) => `Installato (API v${String(version)})`,
    // Labels for the loader's API capabilities, shown next to the version.
    // Keyed to match loaderApiCapabilities()'s return values.
    capabilities: {
      gameLoading: 'Caricamento giochi',
      returnToLauncher: 'Ritorno al launcher',
      cheats: 'Trucchi',
    },
  },
  compat: {
    dialogLabel: (title: string) => `Compatibilità del loader per ${title}`,
    kicker: 'Compatibilità del loader',
    close: 'Chiudi',
    noHeader:
      'PicoDex non è riuscito a leggere questo file di gioco, quindi non può mostrare cosa ne fa il loader. Il file potrebbe essere danneggiato o copiato solo in parte: prova a copiarlo di nuovo sulla scheda.',
    noGameCode:
      "Questo file di gioco non ha un codice del gioco leggibile, cosa comune con l'homebrew. PicoDex ha bisogno di quel codice per controllare il gioco, quindi qui non c'è niente da mostrare. Se il gioco parte, non c'è niente da fare.",
    noLists:
      'I file del loader che servono a questo controllo (aplist.bin, savelist.bin, patchlist.bin) non sono in /_pico. La sezione Diagnostica mostra quali file del loader mancano.',
    revisionUnreadable: 'revisione sconosciuta (il loader la tratta come revisione 0)',
    revision: (n: number) => `revisione ${String(n)}`,
    apLabel: 'Correzione anti-pirateria',
    saveLabel: 'Salvataggio',
    patchLabel: 'Patch specifica del gioco',
    // Display labels for the loader's save memory types.
    saveTypes: {
      none: 'Nessuno',
      eeprom: 'EEPROM',
      flash: 'Flash',
      nand: 'NAND',
      unknown: 'Sconosciuto',
    },
    // Amber-warning sentence for a version mismatch: entries exist for this
    // game but none for the ROM's revision. When the header revision was
    // unreadable the loader assumed revision 0, so the wording softens.
    mismatch: (kind: 'fix' | 'patch', entryVersions: number[], romVersion: number | null) => {
      const thing = kind === 'fix' ? 'una correzione' : 'una patch';
      const noun = entryVersions.length === 1 ? 'la revisione' : 'le revisioni';
      const revs = entryVersions.join(', ');
      const romPart =
        romVersion === null
          ? 'non è stato possibile leggere la revisione della tua copia (in quel caso il loader assume la revisione 0)'
          : `la tua copia è la revisione ${String(romVersion)}`;
      return `Il loader ha ${thing} per ${noun} ${revs} di questo gioco, ma ${romPart}, quindi non viene usata. Se il gioco si blocca o si comporta in modo strano, potrebbe essere questo il motivo.`;
    },
    ap: {
      notListed:
        'Non è in aplist.bin. La maggior parte dei giochi non ha bisogno di questa correzione.',
      skipped: 'Non necessaria. Il loader salta questo passaggio per homebrew e DSiWare.',
      applies: (dsProtectVersion: string | null) =>
        `Corretta all'avvio dal loader (DS Protect ${dsProtectVersion ?? 'sconosciuto'}).`,
      listUnavailable:
        'aplist.bin manca da /_pico o non può essere letto, quindi non è possibile controllarlo. Il loader ha bisogno di questo file: controlla la sezione Diagnostica.',
    },
    save: {
      homebrewNone: "Il loader non crea alcun file di salvataggio per l'homebrew.",
      dsiWareNone: 'Questo gioco DSiWare non salva.',
      dsiWare: (pubSize: string, prvSize: string | null) =>
        `Salva in un file .pub da ${pubSize}${prvSize ? ` e un .prv da ${prvSize}` : ''} accanto al gioco.`,
      nandHeader: (size: string) => `NAND, ${size}`,
      defaultSize: 'Non è in savelist.bin, quindi il loader crea un file di salvataggio da 512 KB.',
      none: 'Nessuno: questo gioco non salva.',
      listed: (type: string, size: string) => `${type}, ${size}`,
    },
    patch: {
      notListed: 'Non è in patchlist.bin. La maggior parte dei giochi non ha bisogno di una patch.',
      skipped: "Non necessaria. Il loader non applica patch all'homebrew.",
      applied: (count: number) =>
        count === 1
          ? "1 patch applicata all'avvio."
          : `${String(count)} patch applicate all'avvio.`,
      listUnavailable:
        'patchlist.bin manca da /_pico o non può essere letto, quindi non è possibile controllarlo. Le release più vecchie di pico-loader non hanno questo file, e aggiornando il loader viene aggiunto.',
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
          "Alcuni giochi si bloccano di proposito quando rilevano un flashcart. Il loader lo impedisce all'avvio, usando aplist.bin e alcune correzioni integrate nel loader stesso. PicoDex può controllare solo aplist.bin.",
        dsiware:
          'La protezione anti-pirateria riguarda le cartucce. I titoli DSiWare non sono mai stati su cartuccia, quindi il loader non esegue affatto quel passaggio per loro.',
        homebrew:
          "La protezione anti-pirateria è una cosa dei giochi commerciali. Il loader non esegue niente di tutto ciò per l'homebrew, quindi non c'è niente da controllare.",
      },
      save: {
        retail:
          'Le cartucce originali contengono un chip di salvataggio. Il loader lo sostituisce con un file di salvataggio sulla scheda SD.',
        dsiware:
          'I giochi DSiWare salvano su file, non su un chip della cartuccia. Il loader crea quei file accanto al gioco, delle dimensioni richieste dal gioco.',
        homebrew:
          "L'homebrew gestisce i propri file sulla scheda SD, quindi il loader non crea un salvataggio per esso. Tutto ciò che questa ROM salva, lo salva da sola.",
      },
      patch: {
        retail:
          "Alcuni giochi hanno bisogno di una piccola correzione per funzionare bene da un flashcart. Il loader la applica all'avvio, da patchlist.bin o dalle correzioni integrate nel loader stesso. PicoDex può controllare solo patchlist.bin.",
        dsiware:
          "Alcuni giochi hanno bisogno di una piccola correzione per funzionare bene da un flashcart, e anche i giochi DSiWare possono averne una. Il loader la applica all'avvio, da patchlist.bin o dalle correzioni integrate nel loader stesso. PicoDex può controllare solo patchlist.bin.",
        homebrew:
          "Queste correzioni sono per i giochi commerciali. Il loader non ne applica nessuna all'homebrew, che gira così com'è.",
      },
    },
  },
  banner: {
    dialogLabel: (system: string) => `Modifica il banner della cartella di ${system}`,
    heading: (path: string) => `Banner della cartella — ${path}/`,
    close: 'Chiudi',
    sharedNote: (others: string, last: string) =>
      `Questa cartella contiene ${others} e ${last}. Condividono un solo banner, quindi salvando qui cambi l'icona e il nome di tutti.`,
    loadFailed: (detail: string) => `Impossibile leggere il banner attuale: ${detail}`,
    readingCurrent: 'Lettura del banner attuale…',
    previewLabel: 'Anteprima del banner',
    titleLabel: 'Titolo',
    titlePlaceholder: 'Titolo della cartella mostrato dal launcher',
    iconLegend: 'Icona',
    iconSource: "Origine dell'icona",
    keepCurrent: 'Mantieni attuale',
    fromImage: "Da un'immagine",
    fromGame: 'Da un gioco',
    imageFileLabel: "File immagine dell'icona",
    needsNewer:
      "I banner delle cartelle richiedono un Pico Launcher più recente della v1.3.0. Con la release v1.3.0 la console mantiene il nome e l'icona semplici della cartella.",
    imageHint:
      "L'immagine viene ridimensionata a 32×32 e ridotta a 15 colori. L'anteprima qui sopra mostra esattamente come apparirà sul DS.",
    imageFailed: (detail: string) => `Impossibile leggere l'immagine: ${detail}`,
    gamePicker: "Gioco da cui prendere l'icona",
    chooseGame: 'Scegli un gioco…',
    readingRom: 'Lettura del banner della ROM…',
    noRomBanner: "Questa ROM non ha un'icona nel banner.",
    cannotOpen: (path: string) => `Impossibile aprire ${path}`,
    removeConfirm: (file: string) => `Rimuovere ${file}?`,
    remove: 'Rimuovi',
    removing: 'Rimozione…',
    cancel: 'Annulla',
    removeBanner: 'Rimuovi banner',
    writes: 'Scrive ',
    writing: 'Scrittura…',
    saveBanner: 'Salva banner',
    writeFailed: (detail: string) => `Scrittura non riuscita: ${detail}`,
    removeFailed: (detail: string) => `Rimozione non riuscita: ${detail}`,
  },
  gallery: {
    sectionLabel: (system: string) => `Giochi ${system}`,
    back: '← Libreria',
    shownOf: (shown: number, total: number) => `${shown} di ${total}`,
    gameCount: (count: number) => (count === 1 ? '1 gioco' : `${count} giochi`),
    searchPlaceholder: (system: string) => `Cerca in ${system}…`,
    searchLabel: (system: string) => `Cerca giochi ${system}`,
    filters: 'Filtri',
    favorites: 'Preferiti',
    completed: 'Completati',
    loadError: (message: string) => `Impossibile caricare le copertine: ${message}`,
    loadingCovers: (done: number, total: number) => `Caricamento copertine ${done}/${total}…`,
    noGames: (system: string) => `Nessun gioco ${system} su questa scheda SD.`,
    noMatches: 'Nessun gioco corrisponde alla ricerca.',
    playTime: (hours: number, minutes: number) => `${hours}h ${minutes}m`,
    launches: (count: number) => `${count}x`,
    coverAlt: (title: string) => `Copertina di ${title}`,
    changeCover: (title: string) => `Cambia la copertina di ${title}`,
    resolving: 'Lettura del gioco…',
    pickBoxArt: 'Scegli la box art corretta',
    toggleFavorite: (title: string) => `Aggiungi o togli ${title} dai preferiti`,
    removeFavorite: 'Togli dai preferiti',
    markFavorite: 'Aggiungi ai preferiti',
    toggleCompleted: (title: string) => `Segna o togli ${title} come completato`,
    unmarkCompleted: 'Togli da completati',
    markCompleted: 'Segna come completato',
    editStats: (title: string) => `Modifica le statistiche di gioco di ${title}`,
    correctStats: 'Correggi numero di avvii e tempo di gioco',
    loaderCompat: (title: string) => `Compatibilità del loader per ${title}`,
    loaderCompatHint: 'Cosa fa il loader per questo gioco',
  },
  health: {
    title: 'Stato della scheda',
    openCard: 'Apri una scheda SD per eseguire un controllo.',
    intro:
      'Controlla la scheda alla ricerca di file spazzatura di macOS, file del loader mancanti, salvataggi orfani e copertine orfane. Niente viene eliminato senza conferma.',
    scanCard: 'Analizza scheda',
    scanning: 'Analisi…',
    scanningCount: (count: number) => (count === 1 ? 'Analisi… 1 file' : `Analisi… ${count} file`),
    libraryRereadFailed:
      "PicoDex non è riuscito a leggere i giochi della scheda (vedi l'errore sopra), quindi ha interrotto l'analisi. Controlla che la scheda sia ancora collegata, poi premi di nuovo Analizza scheda.",
    scannedFiles: (count: number) =>
      count === 1 ? 'Analizzato 1 file.' : `Analizzati ${count} file.`,
    skippedFolders: (count: number) =>
      count === 1
        ? 'Saltata 1 cartella che il computer non ha permesso a PicoDex di aprire (normale per le cartelle di sistema):'
        : `Saltate ${count} cartelle che il computer non ha permesso a PicoDex di aprire (normale per le cartelle di sistema):`,
    // ConfirmDelete's two-step prompt
    deleting: 'Eliminazione…',
    yesDelete: 'Sì, elimina',
    no: 'No',
    junkTitle: 'File spazzatura di macOS',
    junkNone: 'Nessun file spazzatura di macOS trovato.',
    junkCount: (count: number, size: string) =>
      count === 1 ? `1 file spazzatura (${size})` : `${count} file spazzatura (${size})`,
    // Sentences that wrap <code>/<a>/<strong> elements are split in parts; the JSX joins them.
    junkKinds1: 'lasciati da macOS: file ',
    junkKinds2: ' e ',
    junkKinds3: '. Si possono eliminare senza problemi.',
    showJunk: 'Mostra i file spazzatura',
    junkCleanLabel: (count: number) => `Elimina ${count} file`,
    junkConfirmLabel: (count: number) => `Confermi l'eliminazione di ${count} file?`,
    junkDeleteFailed: (files: string) =>
      `Impossibile eliminare: ${files}. Non influiscono sul launcher, quindi puoi lasciarli.`,
    macosKeeps1: 'macOS mantiene ',
    macosKeeps2:
      ' sulla scheda e li ricrea ogni volta che la colleghi a un Mac. Non influiscono sul launcher, quindi puoi lasciarli.',
    fsevents1: ' contiene solo un file ',
    fsevents2:
      ", che impedisce a macOS di tenere un registro delle modifiche ai file sulla scheda. Lascialo così com'è.",
    loaderTitle: 'File del loader',
    loaderAllPresent: 'Tutti i file necessari del loader sono presenti.',
    loaderMissing1: 'Manca ',
    loaderMissing2: ': il loader ne ha bisogno per avviare i giochi.',
    downloadFrom1: 'Scaricali dalle ',
    downloadReleases: 'release di pico-loader',
    downloadFrom2: ' e copia i file in ',
    downloadFrom3: '.',
    loaderIs: 'Loader ',
    orJoiner: ' o ',
    loaderBuild1: ', build ',
    loaderBuild2: '.',
    loaderEnd: '.',
    ambiguityIdentical:
      ' Queste versioni hanno esattamente gli stessi file, quindi non fa differenza quale tu abbia.',
    ambiguityIncomplete:
      " PicoDex non riesce a capire quale, perché i file che le distinguono mancano o non sono riconosciuti. Se i giochi partono, non c'è niente da fare.",
    releasesBehind1: (count: number, atLeast: boolean) =>
      `Indietro di ${atLeast ? 'almeno ' : ''}${count} ${count === 1 ? 'versione' : 'versioni'} rispetto a `,
    releasesBehind2:
      '. Per aggiornare, scaricala dalle release di pico-loader e copia tutti i suoi file in /_pico.',
    newestKnownCandidate: (tag: string) =>
      `Una di queste è la ${tag}, la versione più recente che PicoDex conosce, quindi potresti essere già aggiornato.`,
    newestKnownMaybe:
      'È la release più recente che PicoDex conosce. Potrebbe esisterne una più nuova.',
    newestRelease: 'È la release più recente.',
    mixed1: (agreeing: number) =>
      agreeing === 1
        ? 'Il loader è aggiornato solo a metà: 1 dei suoi file proviene dalla '
        : `Il loader è aggiornato solo a metà: ${agreeing} dei suoi file provengono dalla `,
    mixed2: ', ma ',
    andJoiner: ' e ',
    mixed3: (count: number) =>
      `${count === 1 ? 'proviene' : 'provengono'} da un'altra versione. Di solito succede dopo aver copiato solo una parte dei file e non il resto.`,
    copyAgain1: "Ricopiali tutti da un'unica ",
    copyAgainRelease: 'release di pico-loader',
    copyAgainOverwrites:
      '. Questo sostituisce anche i file che PicoDex non riconosce (elencati sotto), quindi se ne hai modificato qualcuno a mano, tienine prima una copia.',
    copyAgainEnd: '.',
    unrecognisedAll:
      "PicoDex non riconosce nessuno di questi file, quindi non può capire quale versione del loader hai. Succede quando provengono da una release più recente di PicoDex o sono stati modificati a mano. Se i giochi partono, non c'è niente da fare.",
    unrecognisedListed1:
      'PicoDex non riconosce questi file, quindi li ha esclusi nel determinare la versione: ',
    unrecognisedListed2: '. Succede quando sono stati modificati a mano (capita spesso con ',
    unrecognisedListed3:
      '), oppure provengono da una release di pico-loader più recente di PicoDex o da una tua build.',
    unrecognisedFine: "Se i giochi partono, non c'è niente da fare.",
    githubNewer1: 'Il pico-loader più recente su GitHub è ',
    githubNewer2: (tag: string) =>
      `. PicoDex non conosce ancora la ${tag}, quindi non può dire se la tua scheda ce l'ha già. Se la vuoi, scaricala dalle release di pico-loader e copia tutti i suoi file in /_pico.`,
    unreadable:
      'PicoDex non è riuscito ad aprire alcuni file del loader, quindi non li ha controllati. Analizza di nuovo, e se continua a succedere, ricopiali dalla release di pico-loader. File: ',
    optional1: 'File opzionali non presenti sulla scheda: ',
    optional2: ': puoi farne a meno.',
    savesTitle: 'Salvataggi orfani',
    savesSkipped:
      'Non controllato: PicoDex non ha trovato giochi sulla scheda, quindi non può capire quali salvataggi appartengono a un gioco.',
    savesAllOk: 'Ogni file di salvataggio appartiene a un gioco sulla scheda.',
    savesOrphans: (count: number) =>
      count === 1
        ? "1 file di salvataggio non appartiene a nessun gioco: non c'è un gioco con lo stesso nome nella sua cartella, né nella cartella superiore quando il salvataggio si trova in una cartella saves. Il launcher non lo userà. Se hai spostato o rinominato un gioco, sposta o rinomina il suo salvataggio allo stesso modo per non perdere i progressi. L'eliminazione è definitiva: seleziona solo i salvataggi di cui sei sicuro di non aver bisogno."
        : `${count} file di salvataggio non appartengono a nessun gioco: non c'è un gioco con lo stesso nome nella loro cartella, né nella cartella superiore quando il salvataggio si trova in una cartella saves. Il launcher non li userà. Se hai spostato o rinominato un gioco, sposta o rinomina il suo salvataggio allo stesso modo per non perdere i progressi. L'eliminazione è definitiva: seleziona solo i salvataggi di cui sei sicuro di non aver bisogno.`,
    savesDeleteLabel: (count: number) => `Elimina selezionati (${count})`,
    savesDuplicates: (count: number) =>
      count === 1
        ? "1 gioco ha il file di salvataggio due volte: uno accanto al gioco e uno nella cartella saves. Pico Launcher usa quello accanto al gioco e TWiLight Menu++ quello nella cartella saves, quindi i progressi fatti in uno non compaiono nell'altro. PicoDex non può sapere quale copia contiene i progressi più recenti, quindi non tocca nessuna delle due. Se usi un solo launcher, l'altra copia non serve; se li usi entrambi, tieni la copia con i tuoi progressi e rimuovi l'altra."
        : `${count} giochi hanno il file di salvataggio due volte: uno accanto al gioco e uno nella cartella saves. Pico Launcher usa quello accanto al gioco e TWiLight Menu++ quello nella cartella saves, quindi i progressi fatti in uno non compaiono nell'altro. PicoDex non può sapere quale copia contiene i progressi più recenti, quindi non tocca nessuna delle due. Se usi un solo launcher, l'altra copia non serve; se li usi entrambi, tieni la copia con i tuoi progressi e rimuovi l'altra.`,
    savesDuplicateBeside: 'accanto al gioco: ',
    savesDuplicateInFolder: 'nella cartella saves: ',
    savesConfirmLabel: (count: number) =>
      count === 1
        ? "Confermi l'eliminazione definitiva di 1 file di salvataggio?"
        : `Confermi l'eliminazione definitiva di ${count} file di salvataggio?`,
    coversTitle: 'Copertine utente orfane',
    coversSkipped:
      'Non controllato: PicoDex non ha trovato giochi sulla scheda, quindi non può capire quali copertine appartengono a un gioco.',
    coversAllOk: 'Ogni copertina utente appartiene a un gioco sulla scheda.',
    coversOrphans1: (count: number) => (count === 1 ? '1 copertina in ' : `${count} copertine in `),
    coversOrphans2: (count: number): string =>
      count === 1
        ? " non corrisponde a nessun gioco sulla scheda, di solito perché il gioco è stato rinominato o eliminato. È selezionata per l'eliminazione: deselezionala se vuoi tenerla. Puoi scaricare di nuovo le copertine dalla sezione Copertine."
        : " non corrispondono a nessun gioco sulla scheda, di solito perché i giochi sono stati rinominati o eliminati. Sono selezionate per l'eliminazione: deseleziona quelle che vuoi tenere. Puoi scaricare di nuovo le copertine dalla sezione Copertine.",
    coversCleanLabel: (count: number) => `Elimina selezionate (${count})`,
    badCoversTitle: 'Copertine che il launcher non può mostrare',
    badCoversAllOk: 'Ogni copertina sulla scheda è nel formato che il launcher legge.',
    badCovers: (count: number) =>
      count === 1
        ? "1 copertina non è nel formato che il launcher legge, quindi sulla console appare come rumore o non appare affatto. Di solito succede salvando l'immagine con un editor di immagini. Apri il gioco nella sezione Copertine e salva di nuovo la copertina: PicoDex la scrive nel formato giusto."
        : `${count} copertine non sono nel formato che il launcher legge, quindi sulla console appaiono come rumore o non appaiono affatto. Di solito succede salvando l'immagine con un editor di immagini. Apri ogni gioco nella sezione Copertine e salva di nuovo la copertina: PicoDex la scrive nel formato giusto.`,
    coversConfirmLabel: (count: number) =>
      count === 1
        ? "Confermi l'eliminazione di 1 copertina?"
        : `Confermi l'eliminazione di ${count} copertine?`,
  },
  screenshots: {
    regionLabel: 'Screenshot',
    title: 'Screenshot',
    intro:
      'Ogni cattura sulla scheda, con i due schermi dello stesso momento uniti in una sola immagine.',
    openCard: 'Apri una scheda SD per vederne gli screenshot.',
    // Sentence around a <kbd> element; the JSX puts the key between the halves.
    empty1: 'Questa scheda non ha ancora screenshot. Nel launcher, tieni premuto ',
    empty2: ' per circa mezzo secondo per salvare entrambi gli schermi.',
    listing: 'Lettura della cartella degli screenshot…',
    loading: (done: number, total: number) => `Lettura degli screenshot ${done}/${total}…`,
    loadError: (message: string) => `Impossibile leggere gli screenshot: ${message}`,
    count: (count: number) => (count === 1 ? '1 cattura' : `${String(count)} catture`),
    captureAlt: (id: string) => `Cattura ${id}`,
    topOnly: 'solo schermo superiore',
    bottomOnly: 'solo schermo inferiore',
    unreadable: 'Impossibile leggerla',
    open: 'Vedi a dimensione piena',
    close: 'Chiudi',
    download: 'Salva come PNG',
    previous: 'Cattura precedente',
    next: 'Cattura successiva',
    deleteCapture: 'Elimina',
    confirmDelete: 'Eliminare questa cattura dalla scheda?',
    yesDelete: 'Sì, elimina',
    no: 'No',
    deleting: 'Eliminazione…',
    folderGone: 'La cartella degli screenshot non è più sulla scheda.',
    deleteError: (message: string) => `Impossibile eliminarla: ${message}`,
    deleted: (name: string) => `${name} eliminata dalla scheda.`,
  },
};
