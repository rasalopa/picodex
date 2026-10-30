/**
 * Deutsche Übersetzung für PicoDex.
 * Originaler Text aus 'en.ts':
 * 
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
export const de = {
  app: {
    tabs: {
      library: 'Bibliothek',
      covers: 'Cover',
      stats: 'Pico Enhanced',
      associations: 'Zuordnungen',
      screenshots: 'Screenshots',
      health: 'Zustand',
    },
    sections: 'Kapitel',
    openSdFolder: 'Die geöffnete SD-Karte',
    reload: 'Neu laden',
    reloading: 'Lädt neu…',
    whatsNew: "Was ist neu? (EN)",
    footerLicense: 'Open source (MIT) · no tracking',
    language: 'Sprache',
    /** Label and tooltip of the repository card in the header. */
    repoCard: (slug: string) => `${slug} auf GitHub`,
    repoCardStats: (slug: string, stars: string, forks: string) =>
      `${slug} auf GitHub. Stars: ${stars}. Forks: ${forks}.`,
    themeDark: 'Dunkel',
    themeLight: 'Hell',
    themeSystem: 'wie System',
    /** Label and tooltip of the footer theme button: the pick now, then what a click picks. */
    themeButton: (current: string, next: string) =>
      `Theme: ${current}. Klicken, um auf ${next} zu wechseln.`,
  },
  welcome: {
    tagline:
      'Manage deine Pico Launcher SD-Karte vom Browser — entweder DSpico oder eine andere Flash-Karte, die Pico Launcher verwendet. Deine Dateien bleiben immer auf diesem Gerät.',
    openSd: 'Öffne SD-Karte',
    opening: 'öffne…',
    openLast: (name: string) => `Öffne ${name}`,
    lastCardReady: 'Die Karte, die du das letzte mal geöffnet hattest.',
    lastCardAskAgain: 'Die Karte, die du das letzte mal geöffnet hattest. Dein Browser wird nochmal nach Zugriff fragen.',
    pickDifferent: 'Wähle eine andere Karte',
    unsupported:
      "Dein Browser kann keine Ordner auf deinem Computer öffnen, PicoDex braucht das, um die SD-Karte zu lesen. Öffne diese Seite in einem Chromium-basierten Broser (Chrome, Edge, Opera) an einem Desktop oder Laptop.",
    waitingForFolder: 'Warte auf Ordner…',
    whatsNewButton: "Was ist neu in PicoDex?",
    features: {
      boxArtTitle: 'Box Art',
      boxArtBody: 'Findet Spiele ohne Cover und ruft Cover für Pico Launcher ab.',
      libraryTitle: 'Deine Bibliothek',
      libraryBody: 'Alle Systeme auf deiner Karte auf einem Blick und wie viele davon ein Cover besitzen.',
      statsTitle: 'Spielstatistiken',
      statsBody:
        'Favoriten, meist gespielt und zuletzt gespielte Spiele, falls du Pico Launcher Enhanced verwendest.',
      healthTitle: 'Zustand der Karte',
      healthBody:
        'Findet macOS Reste, übrige Spielstände, oder Dateien, die von einer anderen Veröffentlichung übrig sind.',
      bannersTitle: 'Ordnerbilder',
      bannersBody:
        'Gebe jedem System ein schönes Icon und Name. Benötigt Pico Launcher neuer als v1.3.0.',
      associationsTitle: 'Dateizuordnungen',
      associationsBody:
        'Wähle aus, welcher Emulator welche ROM startet, ohne die Dateien von Hand zu bearbeiten.',
    },
  },
  sd: {
    scanningLibrary: 'Scanne Spielebibliothek…',
    scanningLibraryCount: (count: number) => `Scanne Spielebibliothek… ${count} Dateien`,
    readingCovers: 'Lese Cover…',
    readingLauncherData: 'Lese Launcher-Daten…',
    waitingAccess: 'Warte auf Zugriff der Karte…',
    needsAccess: (name: string) =>
      `PicoDex benötigt die Erlaubnis, um ${name} zu öffnen. Klicke "${name} öffnen" nochmal und erteile die Erlaubnis, wenn der Browser dich dazu auffordert.`,
    noPicoAnymore:
      "PicoDex kann nicht den /_pico Ordner auf der SD-Karte finden. Wenn die SD-Karte nicht verbunden ist, stecke sie (erneut) ein. Drücke danach auf SD-Karte öffnen und wähle den Speicherort",
    noPicoPickRoot:
      "PicoDex kann hier keinen /_pico Ordner finden. Wähle das Stammverzeichnis (root) der SD-Karte, nicht einen Ordner darin. Wenn du das bereits getan hast, wurde PicoLauncher noch nicht eingerichtet",
    noPicoOnCard:
      "PicoDex kann die Änderungen nicht speichern, weil es den /_pico Ordner nicht mehr finden kann. Prüfe, ob die SD-Karte noch verbunden ist und drücke anschließend auf Neu laden.",
    fsDenied:
      'Dein Computer blockiert die Bearbeitung von PicoDex. Normalerweise heißt das, dass der Schreibschutz der Karte oder der Dateien darin aktiviert wurde. Überprüfe den LOCK Schieber der SD-Karte (Adapter) und versuche es nochmal.',
    fsNotFound:
      "PicoDex kann die SD-Karte ode reine Datei nicht mehr finden. Prüfe, ob die SD-Karte noch verbunden ist und drücke anschließend auf Neu laden.",
  },
  errors: {
    rateLimited: 'GitHub limitiert im Moment die Suche nach Box Art. Versuche es in einer Stunde erneut.',
    rateLimitedUntil: (time: string) =>
      `GitHub limitiert im Moment die Suche nach Box Art bis ${time}. Versuche es danach erneut.`,
    catalogFailed: (status: number) =>
      `GitHub kann nicht die Liste der Box Art bereitstellen: (error ${status}). Versuche es in ein paar Minuten erneut.`,
    catalogUnreadable:
      "GitHub kann die Liste der Box Art lesen. Versuche es in ein paar Minuten erneut.",
    imageDownloadFailed: (status: number): string =>
      status === 404
        ? "Diese Box Art ist leider nicht mehr verfügbar :( ."
        : `Das Box Art konnte nicht heruntergeladen werden: (error ${status}). Versuche es in ein paar Minuten erneut.`,
    imageUnreadable: "PicoDex kann dieses Bild nicht verarbeiten.",
    canvasFailed: "Dein Browser kann dieses Bild nicht darstellen. Lade die Seite neu und versuche es erneut.",
    offline: "PicoDex kann GitHub nicht erreichen. Prüfe deine Internet-Einstellungen und versuche es erneut.",
  },
  associations: {
    title: 'Dateizuordnungen',
    openCard: 'Öffne eine SD-Karteum die Dateizuordnungen zu bearbeiten.',
    // Sätze, die ein <code> Element enthalten, werden in Teile geschnitten; das (der/die ??) JSX setzt sie wieder zusammen.
    noSettings1: 'Kein ',
    noSettings2: ' gefunden — starte Pico Launcher mindestens einmal, um  ',
    noSettings3: ', zu erzeugen, danach drücke auf Neu Laden.',
    settingsInvalid1: 'PicoDex gefunden ',
    settingsInvalid2:
      " aber es kann nicht gelesen werden: Es ist keine gültige Konfigurationsdatei. Starte Pico Launcher nicht, bis es repariert wurde: wenn es der Launcher auch nicht lesen kann, wird es mit Standardeinstellungen erstellt und deine eigenen Zuordnungen gingen verloren. Öffne es in einem Text Editor (Editor, Notepad++, nano etc) und schau nach einem fehlendem Komma, Hochkomma oder Klammer in der Nähe des angegebenen Ortes. Alternativ ersetze die Datei mit einer vorher angelegten Kopie. Drücke dann auf Neu Laden.",
    settingsBom1: 'PicoDex gefunden  ',
    settingsBom2:
      ", aber es startet mit einem byte order mark (BOM), ein unsichtbares Zeichen, das manche Editoren während dem Speichern hinzufügen. Der Launcher kann diese Datei nicht lesen und würde es mit Standardeinstellungen ersetzen und deine eigenen Zuordnungen gingen verloren. Starte Pico Launcher noch nicht: Öffne die Datei in einem anderen Editor (Notepad++) und speichere es im Zeichenformat UTF-8 ohne BOM ab, danach drücke auf Neu Laden.",
    settingsNotObject1: 'PicoDex gefunden  ',
    settingsNotObject2:
      ', aber es enthält keine Daten: Der Inhalt ist kein JSON Object, also gibt es keine Zuordnung. Ersetze den Ihnalt mit {} oder lösche die Datei, danach drücke auf Neu Laden.',
    settingsUnreadable1: 'PicoDex gefunden  ',
    settingsUnreadable2:
      " aber es kann nicht gelesen werden. Ein anderes Programm greift möglicherweis enoch darauf zu, oder die SD-Karte hat ein Problem. Starte nicht Pico Launcher, bis PicoDex es öffnen kann: Wenn der Launcher es nicht lesen kann, werden Standardeinstellungen verwendet und deine eigenen Zuordnungen gingen verloren. Schliese alle Anwendungen/Programme, die Zugriff auf die SD-Karte haben könnten und drücke danach auf Neu Laden.",
    settingsDetail: 'Details: ',
    notRead:
      "PicoDex kann die Datei nicht zu Ende lesen - es weiß nicht, ob settings.json existiert. Löse das oben angezeigte Problem und drücke danach auf Neu Laden.",
    intro1: 'Wähle aus, welche Anwendung der Launcher öffnet, basierend auf der Datei-Endung. Inhalt gespeichert in ',
    intro2: '.',
    emptyList: 'Noch keine Dateizuordnung vorhanden — füge unten eine neue hinzu.',
    extension: 'Datei-Endung',
    appPath: 'Pfad der Anwendung',
    actions: 'Aktion',
    pathFor: (ext: string) => `Anwendungspfad für .${ext} Dateien`,
    removeFor: (ext: string) => `entferne .${ext} zuordnung`,
    remove: 'Entfernen',
    add: 'Verknüpfen',
    invalidExt: 'Gebe die Buchstaben der Endung ein, z.b. nes.',
    hint: 'Gebe die Endung ohne Punkt ein. Hier sind die Emulatoren meist gespeichert: ',
    picoMissing:
      "Es wurde nichts gespeichert: PicoDex kann den Ordner /_pico nicht mehr finden. Prüfe, ob die Karte noch eingesteckt ist, speichere und lade neu.",
    restartWarning: 'Once saved, your changes apply the next time Pico Launcher starts on your DS.',
    emptyPaths: 'Der Anwendungspfad kann nicht leer sein. Schreibe etwas rein oder lösche den leeren Eintrag.',
    discard: 'Änderungen verwerfen',
    saveToSd: 'Speichere auf SD',
    saving: 'Speichervorgang…',
  },
  statsEditor: {
    dialogLabel: (game: string) => `Bearbeite Spielstatistiken für ${game}`,
    title: (game: string) => `Spielstatistiken bearbeitet — ${game}`,
    close: 'Schließen',
    launches: 'Gestartet',
    playTime: 'Spieldauer',
    hours: 'Stunden',
    minutes: 'Minuten',
    cancel: 'Abbrechen',
    save: 'Speichern',
    saving: 'speichert…',
  },
  changelog: {
    dialogLabel: "Was gibt's neues in PicoDex",
    title: "Was ist neu?",
    close: 'Schließen',
    fullNotes: 'Alle Änderungen auf GitHub',
  },
  dropImport: {
    // Row status labels, one per import phase.
    queued: 'Eingereiht',
    copying: 'kopiere…',
    added: 'hinzugefügt',
    addedCover: 'hinzugefügt, Cover gefunden',
    addedNoCover: 'hinzugefügt, kein Cover gefunden',
    duplicate: 'Übersprungen (bereits vorhanden oder doppelt heruntergeladen)',
    skipped: 'übersprungen (bereits vorhanden)',
    unknownType: 'übersprungen (keine unterstützte ROM)',
    failed: 'fehlgeschlagen',
    failedWith: (message: string) => `Fehler: (${message})`,
    gamesDirError: 'Kann den Ordner mit den Spielen nicht öffnen',
    overlayBusy: 'Import läuft…',
    overlayDrop: 'Lasse hier ROMs fallen, um sie deiner Bibliothek hinzuzufügen',
    resultsLabel: 'Zusammenfassung der Importe',
    importing: 'Füge ROMs hinzu…',
    finished: 'Hinzufügen abgeschlossen!',
    addedCount: (count: number) => (count === 1 ? '1 hinzugefügt' : `${String(count)} ROMs hinzugefügt`),
    dismissLabel: 'Report schließen',
    busyTitle: 'Importvorgang läuft',
    dismiss: 'schließen',
  },
  stats: {
    // Minutes rendered as a play-time string (125 → "2h 5m"); each language owns its unit abbreviations.
    duration: (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`,
    favorite: 'Favoriten',
    noStatsTitle: 'Noch keine Statistiken',
    // Rendered right after the "Pico Launcher Enhanced" link, which the JSX places first.
    noStatsBody:
      'Protokolliert die Anzahl an Spielstarts, Spieldauer und Lieblingsspiel für jedes Spiel. Starte ein Spiel aus Pico Launcher und es wird dir hier angezeigt.',
    gamesPlayed: 'Spiele gespielt',
    favorites: 'Favoriten/Lieblingsspiele',
    completed: 'Durchgespielt',
    totalLaunches: 'Spielstarts',
    totalPlayTime: 'Spieldauer',
    mostPlayed: 'Meistgespielt',
    recentlyPlayed: 'Zuletzt gespielt',
    game: 'Spiel',
    launches: 'Gestartet',
    playTime: 'Spieldauer',
    noneLaunched: 'Bisher wurde noch kein Spiel gestartet.',
    noFavorites: 'Noch kein Spiel als Favorit markiert - Drücke X im Pico Launcher, um es als Favorit hinzuzufügen.',
  },
  covers: {
    regionLabel: 'Cover Art',
    title: 'Covers',
    openCard: 'Öffne eine SD-Karte, um die Cover zu bearbeiten.',
    intro:
      'Findet Spiele ohne Cover und lädt diese von libretro-thumbnails für dich herunter. Die Cover werden direkt auf der SD-Karte gespeichert, bereits optimiert für Pico Launcher.',
    scanFailed: (message: string) => `Scan fehlgeschlagen: ${message}`,
    scanning: (done: number, total: number) => `Scanne ${done}/${total}…`,
    fetchResults: 'Rufe Ergebnisse ab...',
    fetchingCounter: (done: number, total: number) => `Rufe Cover ab — ${done}/${total} fertig`,
    batchFinished: (written: number, noMatch: number, failed: number) =>
      `Fertig: ${written} gespeichert · ${noMatch} nicht gefunden · ${failed} fehlgeschlagen`,
    writtenCoverAlt: (fileName: string) => `Cover für ${fileName} erstellt`,
    jobStatus: {
      pending: 'Wartet',
      matched: 'lädt herunter…',
      written: 'geschrieben',
      'no-match': 'Keine Übereinstimmung',
      error: 'Fehler',
    },
    viaBannerTitle: 'Anhand des im SPiel gespeicherten Namens gefunden',
    noBoxartFound:
      "Keine Box Art gefunden. Du kannst manuell mit dem Stift-Symbol eines auswählen. Das findest du auf dem Cover in der Übersicht der Spielebibliothek.",
    unknownError: 'Unbekannter Fehler...',
    catalogUnavailable:
      'Konnte nicht die Box Art Liste herunterladen. Prüfe deine Interneteinstellungen und versuche es erneut.',
    coversDirFailed:
      'Das Verzeichnis _pico/covers kann nicht auf der SD-Karte geöffnet werden. Überprüfe, dass die Karte noch verbunden ist und versuche es erneut.',
    noGames: 'Auf dieser Karte wurden keine Spiele gefunden.',
    allCovered: (count: number) =>
      count === 1 ? 'Dein Spiel hat bereits ein Cover.' : `Alle ${count} Spiele haben bereits ein Cover.`,
    missingRegionLabel: 'Spiele ohne Cover',
    missingTitle: 'Fehlende Cover',
    selectAll: 'Alle auswählen',
    selectNone: 'Keine Auswählen',
    fetching: 'abrufen...',
    fetchCount: (count: number) => (count === 1 ? 'Rufe 1 Cover ab' : `Rufe ${count} Cover ab`),
    noGamecode: 'Kein Spielecode gefunden, das Cover wird dem Dateinamen zugeordnet. Wird das entsprechende Spiel umbenannt, verliert es auch sein Cover. Es muss wieder neu hinzugefügt werden',
  },
  coverPicker: {
    dialogLabel: (game: string) => `Ändere Cover für ${game}`,
    title: (game: string) => `Cover ändern — ${game}`,
    close: 'Schließen',
    searchPlaceholder: (system: string) => `Suche nach ${system} Box Art…`,
    searchLabel: 'Suche nach Box Art',
    ownImageHint:
      'Jede PNG oder JPG ist möglich. Es wird gestreckt, um das Cover auszufüllen. Genau so wie ein heruntergeladenes Box Art.',
    catalogFailed: (message: string) =>
      `Konnte nicht die Box Art Liste herunterladen. Du kannst auf erneut versuchen drücken, um es nochmals zu probieren, oder ein eigenes Cover von deinem Computer im nächsten Tab verwenden. Details: ${message}`,
    retry: 'erneut versuchen',
    loadingCatalog: 'Lade Box Art Katalog…',
    noMatches: (query: string) => `Kein passendes Box Art für “${query}” gefunden.`,
    current: 'Aktuell',
    currentAlt: (game: string) => `Aktuelles Cover für ${game}`,
    newCover: 'neu',
    composingPreview: 'Generiere Vorschau…',
    newAlt: (game: string) => `Vorschau für neues Cover von ${game}`,
    previewFailed: (message: string) =>
      `Das Bild kann nicht verarbeitet werden. Versuch es nochmal oder wähle ein anderes Bild. Details: ${message}`,
    writeFailed: (message: string) => `Kann nicht auf die SD-Karte speichern. ${message}`,
    // Rendered before a <code> path; the JSX adds the space and the path.
    writes: 'Speichert auf',
    writing: 'schreibe...',
    coversDirMissing: 'Kann nicht den Ordner _pico/covers auf deiner SD-Karte öffnen.',
    iconHint:
      "Das kleine Icon neben dem Spieletitel in der Liste des Launchers. DS-Spiele haben normalerweise ihr eigenes, diese Option kan diese überschreiben. Andere Systeme haben keine Icons, also werden einfach welche hinzugefügt. Dein Bild wird auf 32x32 Pixel verkleinert, transparente Pixel bleiben transparent.",
    iconNone: 'Kein eigenes Icon',
    iconNeedsNewer:
      "Eigene Icons werden nur mit Pico Launcher neuer als 1.3.0 funktionieren. Seit Version 1.3.0 wird das Icon auf der SD-Karte gespeichert. Wird mit einer älteren Version gestartet, wird das Icon des jeweiligen Spieles gezeigt.",
    iconInvalidOnCard:
      'Das Format des Icon auf der SD-Karte kann nicht vom Launcher gelesen werden, deswegen wird ein leeres angezeigt. Speichere ein neues, damit dieses angezeigt wird.',
    iconBannerNote:
      'Dieses Spiel hat sein eigenes Icon in _pico/banners, und der Launcher lädt auch dieses. Ein hier gespeichertes Icon würde also nicht angezeigt werden. Damit dein eigenes Icon angezeigt werden kann, muss das in _pico/banners entfernt werden.',
    iconCurrentAlt: (game: string) => `Aktuelles Icon von ${game}`,
    iconNewAlt: (game: string) => `Vorschau des neuen Icons für ${game}`,
    iconsDirMissing: 'Kann den Ordner _pico/icons auf der SD-Karte nicht öffnen.',
    tabBoxArt: 'Box Art',
    tabCoverFile: 'Cover von deinem Computer',
    tabIconFile: 'Icons von deinem Computer',
    topScreen: 'Oberer Bildschirm',
    bottomScreen: 'Unterer Bildschirm',
    save: 'Speichern',
    nothingToSave: 'Wähle zuerst ein Banner oder Icon aus',
    builtInIconAlt: (game: string) => `Offizielles Icon von ${game}`,
    bannerIconAlt: (game: string) => `Alternatives Icon aus der Banner-Datei von ${game}`,
  },
  library: {
    overviewLabel: 'Übersicht Bibliothek',
    games: 'Spiele',
    systems: 'Systeme',
    favorites: 'Favoriten',
    playTime: 'Spieldauer',
    // Formats a minute total as "Xh Ym" (e.g. 125 → "2h 5m").
    playTimeValue: (totalMinutes: number) => {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${String(hours)}h ${String(minutes)}m`;
    },
    // Sentence around three <code> elements (/_pico, Games/nds, roms/); the JSX joins the parts.
    noGames1: 'Es wurden keine Spiele gefunden. PicoDex sucht in jedem Ordner, außer in ',
    noGames2: ', also können die Spiele z.b. in ',
    noGames3: ', sein, in ',
    noGames4: ' , oder in einen anderen Ordner. Kopiere deine Spiele auf deine SD-Karte und drücke auf Neu Laden.',
    gameCount: (count: number) => (count === 1 ? 'Ein Spiel' : `${String(count)} Spiele`),
    covers: (covered: number, count: number, approximate: boolean) =>
      `${String(covered)}/${String(count)} Cover ${approximate ? ' (ungefähr)' : ''}`,
    approxTitle: (systemLabel: string) =>
      `Erwartet. Für ${systemLabel}, PicoDex zählt die Cover-Dateien, anstelle jedes Spiel zu überprüfen. Die tatsächliche ANzahl kann daher abweichen. Der Cover Tab zeigt aber die genaue Anzahl, wie viele Spiele kein Cover haben.`,
    viewGames: 'Zeige Spiele →',
    editBannerFor: (systemLabel: string) => `Bearbeite das Banner für ${systemLabel}`,
    editBannerTitle: (systemLabel: string) =>
      `Bearbeite das Banner für ${systemLabel} Ordner. (Icon und Banner werden im Launcher angezeigt)`,
    cardComponentsLabel: 'Kartenkomponenten',
    onThisCard: 'Auf dieser Karte',
    launcher: 'Launcher',
    picoLoader: 'Pico Loader',
    notFound: 'Nicht gefunden',
    enhancedChip: 'Pico Enhanced',
    updatedOn: (date: string) => `· Geupdatet am ${date}`,
    apiVersion: (version: number) => `Installiert (API v${String(version)})`,
    // Labels for the loader's API capabilities, shown next to the version.
    // Keyed to match loaderApiCapabilities()'s return values.
    capabilities: {
      gameLoading: 'Spiel lädt',
      returnToLauncher: 'Zurück zum Launcher',
      cheats: 'Cheats',
    },
  },
  compat: {
    dialogLabel: (title: string) => `Loader Kompatibilität für ${title}`,
    kicker: 'Loader Kompatibilität',
    close: 'Schließen',
    noHeader:
      'PicoDex kann die Datei nicht lesen, also kann es auch nicht anzeigen, was der Launcher damit macht. Die Datei kann womöglich beschädigt sein oder unvollständig (Kopierfehler). Kopiere die Datei erneut auf die SD-Karte.',
    noGameCode:
      'Dieses Spiel hat keinen (offiziellen) Spielecode, was häufig auftritt bei Homebrew oder Hacks. PicoDex benötigt diesen Code, um das Spiel zu prüfen, jedoch gibt es da nichts zu sehen. Wenn das Spiel startet, ist alles in Ordnung und sonst nichts weiter zu tun.',
    noLists:
      'Die loader-Dateien, die benötigt werden (aplist.bin, savelist.bin, patchlist.bin) befinden sich nicht in /_pico. DerHealth-Tab zeigt welche Dateien fehlen.',
    revisionUnreadable: 'Revision unbekannt (Der Loader behandelt ihn daher als V0)',
    revision: (n: number) => `Revision ${String(n)}`,
    apLabel: 'Anti-piracy fix',
    saveLabel: 'Speichern',
    patchLabel: 'Spielspezifischer Patch',
    // Display labels for the loader's save memory types.
    saveTypes: {
      none: 'keiner',
      eeprom: 'EEPROM',
      flash: 'Flash',
      nand: 'NAND',
      unknown: 'unbekannt',
    },
    // Amber-warning sentence for a version mismatch: entries exist for this
    // game but none for the ROM's revision. When the header revision was
    // unreadable the loader assumed revision 0, so the wording softens.
    mismatch: (kind: 'fix' | 'patch', entryVersions: number[], romVersion: number | null) => {
      const thing = kind === 'fix' ? 'ein fix' : 'ein patch';
      const noun = entryVersions.length === 1 ? 'Revision' : 'Revisionen';
      const revs = entryVersions.join(', ');
      const romPart =
        romVersion === null
          ? "Die Revision deiner Kopie kann nicht gelesen werden. Sie wird als Revision 0 behandelt."
          : `Die Revision der ROM ist ${String(romVersion)}`;
      return `[Issue GitHub] Pico Loader hat ${thing} für ${noun} ${revs} dieses Spiels, aber ${romPart}, wird daher nicht verwendet. Wenn das SPiel einfriert, wird das der Grund sein.`;
    },
    ap: {
      notListed: "Nicht in aplist.bin. Die meisten Spiele benötigen diesen Fix nicht.",
      skipped: 'Nicht benötigt. Pico Loader überspringt diesen Schritt für Homebrew und DSiWare.',
      applies: (dsProtectVersion: string | null) =>
        `Wird beim Start von Pico Loader angewendet (DS Protect ${dsProtectVersion ?? 'unknown'}).`,
      listUnavailable:
        'aplist.bin fehlt /_pico oder kann nicht gelesen werden, daher kann es nicht überprüft werden. Pico Loader benötigt diese Datei: Prüfe den Tab "Zustand".',
    },
    save: {
      homebrewNone: 'Pico Loader erstellt keinen Speicherstand für Homebrew.',
      dsiWareNone: 'Diese DSiWare-Spiel speichert nicht(s).',
      dsiWare: (pubSize: string, prvSize: string | null) =>
        `Speichert den Spielstand als ${pubSize} .pub${prvSize ? ` und eine ${prvSize} .prv` : ''} im selben Verzeichnis.`,
      nandHeader: (size: string) => `NAND, ${size}`,
      defaultSize: 'Nicht in savelist.bin enthalten, Pico Loader erstellt ein 512 KB Speicherstand.',
      none: 'keiner — Dieses Spiel speichert nichts.',
      listed: (type: string, size: string) => `${type}, ${size}`,
    },
    patch: {
      notListed: "Nicht in patchlist.bin enthalten. die meisten Spiele benötigen dies nicht.",
      skipped: 'Nicht benötigt. Pico Loader patcht keine Homebrew.',
      applied: (count: number) =>
        count === 1 ? 'Ein Patch bei Start angewendet.' : `${String(count)} Patches bei start angewendet.`,
      listUnavailable:
        "patchlist.bin fehlt im Ordner/_pico oder kann nicht gelesen werden. Ältere Versionen von Pico-Loader haben diese Datei noch nicht, ein Update fügt die Datei hinzu.",
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
          'Manche Spiele frieren absichtlich ein, wenn sie von einer Flashkarte gestartet werden. Pico Loader verhindert das beim Start mit aplist.binund ein paar Kniffe, die bereits in Pico Loader eingebaut sind. PicoDex überprüft nur aplist.bin.',
        dsiware:
          'Anti-Piracy-Maßnahmen ist eher eine Sache der Spielmodule an sich. DSiWare wurde nie als Cartridge veröffentlicht, also lädt Pico Loader das auch gar nicht.',
        homebrew:
          'Anti-piracy-Maßnahmen ist eher was für Retail-Spiele. Pico Loader lädt keines dafür für Homebrew, da das keinen Sinn ergibt. Es gibt da ja nichts zum Überprüfen.',
      },
      save: {
        retail:
          'Originale Spielmodule/Cartridges haben einen Speicherbaustein eingebaut. Pico Loader simuliert diesen mit einer .sav-Datei auf der SD-Karte.',
        dsiware:
          'DSiWare-Spiele speichern in Dateien, nicht auf einen Speicherbaustein. Pico Loader simuliert diesen mit einer Datei der entsprechenden Größe und Namen auf der SD-Karte.',
        homebrew:
          'Homebrew managed die Speicherstände auf ihre eigene, unterschiedliche Weise, deswegen wird von Pico Loader keine .sav-Datei erstellt. Alles, was an Spielstände erstellt wird, kommt von dem Homebrew, nicht von Pico Loader.',
      },
      patch: {
        retail:
          'Ein paar Spiele benötigen einen kleinen Fix, um korrekt von einer Flashkarte gestartet werden zu können. Pico Loader mach dies beim Start entweder von patchlist.bin oder von den Eingebauten. PicoDex überprüft lediglich die Datei patchlist.bin.',
        dsiware:
          'Ein paar DSi-Spiele benötigen einen kleinen Fix, um korrekt von einer Flashkarte gestartet werden zu können. Pico Loader mach dies beim Start entweder von patchlist.bin oder von den Eingebauten. PicoDex überprüft lediglich die Datei patchlist.bin.A few games need a small fix to run correctly from a flashcart, and DSiWare games can get one too. The loader applies it at boot, from patchlist.bin or from fixes built into the loader itself. PicoDex can only check patchlist.bin.',
        homebrew:
          'Diese Patches sind für Retail-Spiele. PicoLoader führt diese also auch nicht aus, da Homebrew das nicht benötigt und ohne diese startet.',
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
    readingCurrent: 'Lese momentane Banner ein…',
    previewLabel: 'Banner-Vorschau',
    titleLabel: 'Titel',
    titlePlaceholder: 'Ordnernamen, der im Launcher angezeigt wird',
    iconLegend: 'Icon',
    iconSource: 'Icon-Quelle',
    keepCurrent: 'Momentanes behalten',
    fromImage: 'Von Bild',
    fromGame: 'Von einem Spiel',
    imageFileLabel: 'Icon Bild-Datei',
    needsNewer:
      "Ordner-Banner setzen Pico Launcher Version 1.3.0 oder neuer voraus. Seit dem 1.3.0 Release behält die Konsole den Ordnernamen und Icon.",
    imageHint:
      'Dein Bild wurde auf 32x32 eingepasst und auf 15 Farben konvertiert. Die Vorschau oben stellt exakt dar, wie es später auf dem aussehen wird.',
    imageFailed: (detail: string) => `Kann das Bild nich lesen: ${detail}`,
    gamePicker: 'Spiel, aus dem das Icon verwendet wird',
    chooseGame: 'Wähle ein Spiel…',
    readingRom: 'Lese ROM-Banner…',
    noRomBanner: 'Diese ROM hat kein Banner-Icon.',
    cannotOpen: (path: string) => `Kann den Pfad ${path} nicht öffnen`,
    removeConfirm: (file: string) => `Lösche ${file}?`,
    remove: 'entfernen',
    removing: 'entferne…',
    cancel: 'Abbrechen',
    removeBanner: 'Entferne Banner',
    writes: 'Schreibe ',
    writing: 'Schreiben…',
    saveBanner: 'Speichere Banner',
    writeFailed: (detail: string) => `Schreiben fehlgeschlagen: ${detail}`,
    removeFailed: (detail: string) => `Entfernen fehlgeschlagen: ${detail}`,
  },
  gallery: {
    sectionLabel: (system: string) => `${system} Spiele`,
    back: '← Bibliothek',
    shownOf: (shown: number, total: number) => `${shown} von ${total}`,
    gameCount: (count: number) => (count === 1 ? 'Ein Spiel' : `${count} games`),
    searchPlaceholder: (system: string) => `Suche ${system}…`,
    searchLabel: (system: string) => `Suche ${system} Spiele`,
    filters: 'Filter',
    favorites: 'Favoriten',
    completed: 'Beendet',
    loadError: (message: string) => `Konnte die Cover nicht laden: ${message}`,
    loadingCovers: (done: number, total: number) => `Lade Cover ${done}/${total}…`,
    noGames: (system: string) => `Kein ${system} Spiele auf dieser SD-Karte.`,
    noMatches: 'Es wurden keine Spiele gefunden, die deiner Sche entsprechen.',
    playTime: (hours: number, minutes: number) => `${hours}h ${minutes}m`,
    launches: (count: number) => `${count}x`,
    coverAlt: (title: string) => `Cover von ${title}`,
    changeCover: (title: string) => `Ändere Cover von ${title}`,
    resolving: 'Lese Spiel…',
    pickBoxArt: 'Wähle die korrekte Box-Art aus...',
    toggleFavorite: (title: string) => `Schalte Favorit um für ${title}`,
    removeFavorite: 'Entferne aus den Favoriten',
    markFavorite: 'Als Favorit markieren',
    toggleCompleted: (title: string) => `${title} als komplettiert markieren`,
    unmarkCompleted: 'als nicht-beendet markieren',
    markCompleted: 'Als komplettiert markieren',
    editStats: (title: string) => `Edit play stats for ${title}`,
    correctStats: 'Korrigiere Spielzeit und Spielstarts für das ausgewählte Spiel',
    loaderCompat: (title: string) => `Loader Kompatibilität für ${title}`,
    loaderCompatHint: 'Was der Loader für das Spiel macht',
  },
  health: {
    title: 'Zustand der Karte',
    openCard: 'Öffne eine SD-Karte, um deren Zustand zu überprüfen.',
    intro:
      'Findet macOS Reste, übrige Spielstände, oder (Cover-)Dateien, die von einer anderen Veröffentlichung übrig sind. Es wird nichts ohne Nachfragen verändert/gelöscht.',
    scanCard: 'Scanne SD-Karte',
    scanning: 'Scanne…',
    scanningCount: (count: number) =>
      count === 1 ? 'Scanne… 1 Datei' : `Scanne… ${count} Dateien`,
    libraryRereadFailed:
      "PicoDex konnte die Spiele auf der SD-Karte nicht scannen, siehe Fehlermeldung. Deshalb wurde der Scan abgebrochen. Prüfe, ob die SD-Karte noch verbunden ist und versuche es erneut.",
    scannedFiles: (count: number) => (count === 1 ? 'Eine Datei gescannt' : `${count} Dateien gescannt.`),
    skippedFolders: (count: number) =>
      count === 1
        ? 'Einen Ordner übersprungen. Wahrscheinlich ein Systemordner, den PicoDex nicht öffnen kann. Das ist normal.'
        : `${count} Ordner übersprungen. Wahrscheinlich mehrere Systemordner, die PicoDex nicht öffnen können. Das ist normal.`,
    // ConfirmDelete's two-step prompt
    deleting: 'lösche…',
    yesDelete: 'Ja, löschen',
    no: 'nein',
    junkTitle: 'macOS Reste',
    junkNone: 'Keine macOS Reste gefunden',
    junkCount: (count: number, size: string) =>
      count === 1 ? `1 junk file (${size})` : `${count} junk files (${size})`,
    // Sentences that wrap <code>/<a>/<strong> elements are split in parts; the JSX joins them.
    junkKinds1: 'Von macOS zurückgelassen: ',
    junkKinds2: ' Dateien und ',
    junkKinds3: '. DIese kann man bedenkenlos löschen.',
    showJunk: 'Zeige Junk-Dateien',
    junkCleanLabel: (count: number) => `Säubere ${count} ${count === 1 ? 'Datei' : 'Dateien'}`,
    junkConfirmLabel: (count: number) =>
      `Wirklich ${count} ${count === 1 ? 'Datei' : 'Dateien'}?`,
    junkDeleteFailed: (files: string) =>
      `Konnte nicht gelöscht werden: ${files}. Diese beeinflussen nicht den Launcher, also können sie bleiben.`,
    macosKeeps1: 'macOS behält ',
    macosKeeps2:
      " auf der Karte und schreibt diese immer wieder drauf, sobald die SD-Karte wieder in einen MAC eingesteckt wird. Sie beeinflussen den Launcher oder PicoDex in keiner Weise.",
    fsevents1: ' enthält nur ',
    fsevents2:
      ' Datei, die macOS davon abhält, Log-Dateien in diesem Verzeichnis/SD-Karte abzulegen. Lass es so wie es ist.',
    loaderTitle: 'Loader Dateien',
    loaderAllPresent: 'Alle benötigten Loader-Dateien sind vorhanden.',
    loaderMissing1: '',
    loaderMissing2: ' fehlt — der Loader benötigt diese, um Spiele auszuführen.',
    downloadFrom1: 'Lade von ',
    downloadReleases: 'pico-loader releases herunter',
    downloadFrom2: ' und kopiere diese Dateien in ',
    downloadFrom3: '.',
    loaderIs: 'Loader ',
    orJoiner: ' oder ',
    loaderBuild1: ', der/die/die/den/dessen ',
    loaderBuild2: ' Build.',
    loaderEnd: '.',
    ambiguityIdentical:
      ' Diese Builds haben genau gleiche Dateien, also macht es keinen Unterschied, welche du verwendest.',
    ambiguityIncomplete:
      " PicoDex kann nicht bestimmen, welche es ist. Die Dateien, die zur Unterscheidung notwendig sind, sind fehlerhaft oder nicht vorhanden. Wenn deine Spiele starten, gibt es nichts zu tun.",
	  /*
	  * Folgende Zeilen werden erstmal nicht übersetzt, da eine Möglichkeit zum Update von Pico Launcher über PicoDex vorgeschlagen wurde
	  */
    releasesBehind1: (count: number, atLeast: boolean) =>
      `${atLeast ? 'Mindestens um ' : ''}${count} ${count === 1 ? 'release' : 'releases'} veraltet `,
    releasesBehind2:
      '. zum Updaten, lade die neueste Version von der pico-loader release-Seite herunter und kopiere die entpackten Dateien in das /_pico Verzeichnis.',
    newestKnownCandidate: (tag: string) =>
      `Eine davon ist ${tag}, die neueste Version, die PicoDex kennt. Du könntest aktuell sein.`,
    newestKnownMaybe: 'Das ist die neueste Version, die PicoDex kennt. Etwas neueres könnte existieren.',
    newestRelease: 'Das ist die neueste Version.',
    mixed1: (agreeing: number) =>
      agreeing === 1
        ? 'Der Pico Loader ist unvollständig aktualisiert. Eine Datei davon ist von '
        : `Der Pico Loader ist unvollständig aktualisiert: ${agreeing} der Dateien sind von `,
    mixed2: ', aber ',
    andJoiner: ' und ',
    mixed3: (count: number) =>
      `${count === 1 ? 'ist' : 'sind'} es nicht. Das kommt daher, dass nur ein Teil der Dateien kopiert wurden und manche möglicherweise nicht.`,
    copyAgain1: 'Kopiere sie alle nochmal von einer ',
    copyAgainRelease: 'pico-loader release',
    copyAgainOverwrites:
      ". Das ersetzt auch Dateien, die PicoDex nicht erkennt (unten). Wenn welche davon manuell bearbeitet wurden, erstelle von diesen ein Backup.",
    copyAgainEnd: '.',
    unrecognisedAll:
      "PicoDex erkennt keine Dateien davon, kannnicht erkennen, welcher Loader verwendet wird. Eine Ursache kann sein, dass der Loader neuer ist, als PicoDex oder wenn manuell Änderungen vorgenommen wurden. Wenn die Spiele starten, gibt es nichts weiter zu tun.",
    unrecognisedListed1:
      "PicoDex kann diese Dateien nicht zuordnen, diese werden ausgelassen, wenn mit der neuen Version gearbeitet wird: ",
    unrecognisedListed2: '. Das passiert, wenn manuell Änderungen vorgenommen wurden. Üblicherweise ',
    unrecognisedListed3: ', die von einem neueren Build von PicoDex stammt oder deinem eigenen Build.',
    unrecognisedFine: 'Wenn deine Spiele starten, gibt es nichts weiter zu tun.',
    githubNewer1: 'Die neueste Version von pico-loader auf GitHub ist ',
    githubNewer2: (tag: string) =>
      `. PicoDex kennt ${tag} noch nicht, deshalb kann PicoDex nicht bestimmen, ob es sich bereits auf der SD-Karte befindet. Wenn du möchtest, lade die aktuellsten Daten von pico-loader auf GitHub herunter und kopiere sie in /_pico.`,
    unreadable:
      "PicoDex konnte manche loader-Dateien nicht öffnen, diese wurden nicht überprüft, scanne dann erneut. Falls das wieder passiert, kopiere folgende Dateien von einer neuen pico-loader Release: ",
    optional1: 'Optionale Dateien, die nicht auf der SD-Karte vorhanden sind: ',
    optional2: ' — kann man auch weglassen.',
    savesTitle: 'Saves ohne Zuordnungen',
    savesSkipped:
      "Nicht Überprüft: PicoDex hat keine Spiele auf der Karte gefunden, es weiß nicht, welche Datei zu einem Spiel gehört.",
    savesAllOk: 'Jedes sav-Datei gehört zu einem Spiel.',
    savesOrphans: (count: number) =>
      count === 1
        ? "Eine sav-Datei kann keinem Spiel zugeordnet werden: Es wurde kein Spiel mit dem gleichen Namen in dessen Ordner gefunden, oder in dem ROM-Ordner, in dem der darinliegende saves-Ordner gefunden wurde. Der Launcher wird die Datei nicht verwenden. Wenn du die Datei umbenannt oder verschoben hast, tu dies auch mit der sav-Datei, um den Spielfortschritt nicht zu verlieren. Das Löschen ist permanent: Markiere nur die Spielstände, die du auch wirklich nicht mehr brauchst."
        : `${count} sav-Dateien können keinem Spiel zugeordnet werden: Es wurden keine Spiele mit den entsprechenden Namen in deren Ordner gefunden, oder in dem ROM-Ordner, in dem der darinliegende saves-Ordner gefunden wurde. Der Launcher wird die Dateien nicht verwenden. Wenn du die Dateien umbenannt oder verschoben hast, tu dies auch mit den sav-Dateien, um den Spielfortschritt nicht zu verlieren. Das Löschen ist permanent: Markiere nur die Spielstände, die du auch wirklich nicht mehr brauchst.`,
    savesDeleteLabel: (count: number) => `Lösche (${count}) Spielstände`,
    savesDuplicates: (count: number) =>
      count === 1
        ? "Ein Spiel hat zwei sav-Dateien: Eines im gleichen Verzeichnis wie die ROM und einmal im saves-Ordner. Pico Launcher verwendet die Datei, die im selben Verzeichnis ist, wie die ROM, TWiLight Menu++ hingegen wird standardmäßig die sav-Datei im saves-Ordner verwenden. Der Spielstand wird (standardmäßig) nicht mit beiden Loadern geteilt. PicoDex kann nicht unterscheiden, welche Datei neuer ist, deswegen wird keine verändert. Wenn du nur einen Launcher verwendest, wird die andere sav-Datei nicht benötigt; verwendest du beide Launcher, lösche eine sav-Datei und verwende diese für beide Launcher. Wenn das jedoch so gewollt ist, ignoriere diesen Hinweis."
        : `${count} Spiele haben zwei sav-Dateien: Eines im gleichen Verzeichnis wie die ROM und einmal im saves-Ordner. Pico Launcher verwendet die Dateien, die im selben Verzeichnis ist, wie die ROMs, TWiLight Menu++ hingegen wird standardmäßig die sav-Dateien im saves-Ordner verwenden. Der Spielstand wird (standardmäßig) nicht mit beiden Loadern geteilt. PicoDex kann nicht unterscheiden, welche Dateien neuer sind, deswegen wird keine verändert. Wenn du nur einen Launcher verwendest, wird die andere sav-Datei nicht benötigt; verwendest du beide Launcher, lösche eine sav-Datei und verwende diese für beide Launcher. Wenn das jedoch so gewollt ist, ignoriere diesen Hinweis.`,
    savesDuplicateBeside: 'Im gleichen Verzeichnis wie die ROM: ',
    savesDuplicateInFolder: 'Im saves-Ordner: ',
    savesConfirmLabel: (count: number) =>
      `Sollen wirklich ${count} Spielstände gelöscht werden${count === 1 ? 'file' : 'files'}?`,
    coversTitle: 'Orphaned user covers',
    coversSkipped:
      "Not checked: PicoDex gefunden  no games on the card, so it can't tell which covers belong to a game.",
    coversAllOk: 'Every user cover belongs to a game on the card.',
    coversOrphans1: (count: number) => (count === 1 ? '1 cover in ' : `${count} covers in `),
    coversOrphans2: (count: number): string =>
      count === 1
        ? " doesn't match any game on the card, usually because the game was renamed or deleted. It is ticked for deletion: untick it if you want to keep it. You can get covers again from the Covers tab."
        : " don't match any game on the card, usually because the games were renamed or deleted. They are ticked for deletion: untick any you want to keep. You can get covers again from the Covers tab.",
    coversCleanLabel: (count: number) => `Clean up selected (${count})`,
    badCoversTitle: "Covers the launcher can't show",
    badCoversAllOk: 'Every cover on the card is in the format the launcher reads.',
    badCovers: (count: number) =>
      count === 1
        ? '1 cover is not in the format the launcher reads, so on the console it shows as noise or not at all. It usually comes from saving the picture with an image editor. Open the game in the Covers tab and save the cover again: PicoDex writes it in the right format.'
        : `${count} covers are not in the format the launcher reads, so on the console they show as noise or not at all. They usually come from saving the picture with an image editor. Open each game in the Covers tab and save the cover again: PicoDex writes it in the right format.`,
    coversConfirmLabel: (count: number) =>
      `Confirm delete ${count} ${count === 1 ? 'cover' : 'covers'}?`,
  },
  screenshots: {
    regionLabel: 'Screenshots',
    title: 'Screenshots',
    intro: 'Jede Aufnahme auf der SD-Karte, beide Bildschirme zu einem Bild.',
    openCard: 'Öffne eine SD-Karte, um die Screenshots zu sehen.',
    // Sentence around a <kbd> element; the JSX puts the key between the halves.
    empty1: 'Es wurden noch keine Screenshots erstellt. Drücke und halte im Launcher ',
    empty2: ' für ungefähr eine halbe Sekunde, um ein Bild beider Bildschirme zu speichern.',
    listing: 'Lese Screenshot-Ordner…',
    loading: (done: number, total: number) => `Lese Screenshot-Ordner ${done}/${total}…`,
    loadError: (message: string) => `Kann den Screenshot-Ordner nicht lesen: ${message}`,
    count: (count: number) => (count === 1 ? 'Eine Aufnahme' : `${String(count)} Aufnahmen`),
    captureAlt: (id: string) => `Aufnahme ${id}`,
    topOnly: 'Nur oberer Bildschirm',
    bottomOnly: 'Nur unterer Bildschirm',
    unreadable: 'Kann nicht gelesen werden',
    open: 'Öffne',
    close: 'Schließen',
    download: 'als PNG speichern',
    previous: 'vorherige Aufnahme',
    next: 'nächste Aufnahme',
    deleteCapture: 'löschen',
    confirmDelete: 'Soll dieser Screenshot von der SD-Karte gelöscht werden?',
    yesDelete: 'Ja, löschen',
    no: 'Nein',
    deleting: 'lösche……',
    folderGone: 'Der Screenshot-Ordner befindet sich nicht mehr auf der SD-Karte.',
    deleteError: (message: string) => `Kann nicht gelöscht werden: ${message}`,
    deleted: (name: string) => `${name} von der SD-Karte gelöscht.`,
  },
};

/** The contract every language file must satisfy. */
export type Dict = typeof de;
