import type { Dict } from './en';

/**
 * Spanish. Mirrors `en.ts` key for key - TypeScript fails the build if a key
 * is missing or a function signature drifts, so a translation can never be
 * silently incomplete.
 */
export const es: Dict = {
  app: {
    tabs: {
      library: 'Biblioteca',
      covers: 'Carátulas',
      stats: 'Pico Enhanced',
      associations: 'Asociaciones',
      health: 'Salud',
    },
    sections: 'Secciones',
    openSdFolder: 'Abrir la carpeta de la tarjeta SD',
    reload: 'Recargar',
    reloading: 'Recargando…',
    whatsNew: 'Novedades',
    footerLicense: 'Licencia MIT · sin telemetría',
    language: 'Idioma',
  },
  welcome: {
    tagline:
      'Gestiona tu tarjeta SD de Pico Launcher desde el navegador — en el DSpico o cualquier flashcart que lo ejecute. Tus archivos nunca salen de tu equipo.',
    openSd: 'Abrir tarjeta SD',
    opening: 'Abriendo…',
    openLast: (name: string) => `Abrir ${name}`,
    lastCardReady: 'La tarjeta que tenías abierta la última vez.',
    lastCardAskAgain:
      'La tarjeta que tenías abierta la última vez. Tu navegador volverá a pedir acceso.',
    pickDifferent: 'Elegir otra tarjeta',
    unsupported:
      'Tu navegador no soporta la File System Access API. Usa un navegador basado en Chromium (Chrome, Edge, Brave, Opera).',
    waitingForFolder: 'Esperando la carpeta…',
    whatsNewButton: 'Novedades de PicoDex',
    features: {
      boxArtTitle: 'Carátulas',
      boxArtBody: 'Encuentra los juegos sin carátula y baja el arte listo para el launcher.',
      libraryTitle: 'Tu biblioteca',
      libraryBody: 'Todos los sistemas de la tarjeta de un vistazo, con su cobertura de carátulas.',
      statsTitle: 'Estadísticas de juego',
      statsBody: 'Favoritos, más jugados y recientes — con el fork Pico Launcher Enhanced.',
      healthTitle: 'Salud de la tarjeta',
      healthBody:
        'Detecta la basura de macOS, guardados huérfanos y un loader con archivos de versiones distintas.',
      bannersTitle: 'Banners de carpeta',
      bannersBody: 'Dale a cada carpeta de sistema su icono y nombre visible.',
      associationsTitle: 'Asociaciones de archivos',
      associationsBody: 'Asigna cada extensión de ROM a su emulador, sin editar JSON.',
    },
  },
  sd: {
    scanningLibrary: 'Escaneando la biblioteca…',
    scanningLibraryCount: (count: number) => `Escaneando la biblioteca… ${count} archivos`,
    readingCovers: 'Leyendo carátulas…',
    readingLauncherData: 'Leyendo datos del launcher…',
    waitingAccess: 'Esperando acceso a la tarjeta…',
    needsAccess: (name: string) => `PicoDex necesita acceso a ${name} para abrirla.`,
    noPicoAnymore: 'Esa carpeta ya no contiene /_pico — elige una tarjeta.',
    noPicoPickRoot:
      'Esa carpeta no tiene /_pico — elige la raíz de una tarjeta SD de Pico Launcher.',
    noPicoOnCard: 'No hay carpeta /_pico en la tarjeta SD.',
    fsDenied:
      'macOS denegó el acceso a una entrada de la tarjeta — puede ser una carpeta protegida del sistema (como .Trashes) o la tarjeta puede estar montada en solo lectura.',
  },
  associations: {
    title: 'Asociaciones de archivos',
    openCard: 'Abre una tarjeta SD para editar las asociaciones.',
    noSettings1: 'No se encontró ',
    noSettings2: ' — arranca Pico Launcher una vez en tu DSpico para que cree ',
    noSettings3: ' y recarga.',
    intro1: 'Elige qué aplicación abre el launcher para cada extensión de archivo. Se guarda en ',
    intro2: '.',
    emptyList: 'Aún no hay asociaciones — añade una abajo.',
    extension: 'Extensión',
    appPath: 'Ruta de la aplicación',
    actions: 'Acciones',
    pathFor: (ext: string) => `Ruta de la aplicación para archivos .${ext}`,
    removeFor: (ext: string) => `Quitar la asociación .${ext}`,
    remove: 'Quitar',
    add: 'Añadir',
    invalidExt: 'Escribe una extensión válida (los puntos se ignoran).',
    hint: 'Escribe la extensión sin el punto. Rutas de emuladores comunes: ',
    picoMissing: 'La carpeta /_pico no está en la tarjeta SD.',
    restartWarning:
      'El launcher lee las asociaciones al arrancar — reinicia tu DS después de guardar para que los cambios surtan efecto.',
    emptyPaths:
      'Las rutas de aplicación no pueden estar vacías. Rellena o quita las filas en blanco.',
    discard: 'Descartar cambios',
    saveToSd: 'Guardar en la SD',
    saving: 'Guardando…',
  },
  statsEditor: {
    dialogLabel: (game: string) => `Editar estadísticas de ${game}`,
    title: (game: string) => `Editar estadísticas — ${game}`,
    close: 'Cerrar',
    launches: 'Partidas',
    playTime: 'Tiempo de juego',
    hours: 'Horas',
    minutes: 'Minutos',
    cancel: 'Cancelar',
    save: 'Guardar',
    saving: 'Guardando…',
  },
  changelog: {
    dialogLabel: 'Novedades de PicoDex',
    title: 'Novedades',
    close: 'Cerrar',
    fullNotes: 'Notas completas en GitHub',
  },
  dropImport: {
    queued: 'En cola',
    copying: 'Copiando…',
    added: 'Añadida',
    addedCover: 'Añadida, carátula descargada',
    addedNoCover: 'Añadida, sin carátula que encaje',
    duplicate: 'Duplicada (omitida)',
    skipped: 'Omitida (ya está en la tarjeta)',
    unknownType: 'Tipo desconocido',
    failed: 'Falló',
    failedWith: (message: string) => `Falló (${message})`,
    gamesDirError: 'No se pudo abrir la carpeta de juegos',
    overlayBusy: 'Importación en curso…',
    overlayDrop: 'Suelta ROMs para añadirlas a tu tarjeta',
    resultsLabel: 'Resultados de la importación de ROMs',
    importing: 'Importando ROMs…',
    finished: 'Importación terminada',
    addedCount: (count: number) => (count === 1 ? '1 añadida' : `${String(count)} añadidas`),
    dismissLabel: 'Cerrar los resultados de la importación',
    busyTitle: 'Importación en curso',
    dismiss: 'Cerrar',
  },
  stats: {
    duration: (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`,
    favorite: 'Favorito',
    noStatsTitle: 'Aún no hay estadísticas de juego',
    noStatsBody:
      'registra el número de partidas, el tiempo de juego y si cada juego es favorito. Lanza algo desde el launcher y aparecerá aquí.',
    gamesPlayed: 'Títulos jugados',
    favorites: 'Favoritos',
    completed: 'Completados',
    totalLaunches: 'Partidas totales',
    totalPlayTime: 'Tiempo de juego total',
    mostPlayed: 'Más jugados',
    recentlyPlayed: 'Jugados recientemente',
    game: 'Juego',
    launches: 'Partidas',
    playTime: 'Tiempo de juego',
    noneLaunched: 'Aún no se ha lanzado ningún juego.',
    noFavorites: 'Aún no hay favoritos — pulsa X sobre un juego en el launcher para añadir uno.',
  },
  covers: {
    regionLabel: 'Carátulas',
    title: 'Carátulas',
    openCard: 'Abre una tarjeta SD para gestionar las carátulas.',
    intro:
      'Encuentra los juegos sin carátula, baja el arte correspondiente de libretro-thumbnails y escribe carátulas BMP listas para el launcher en tu tarjeta SD.',
    scanFailed: (message: string) => `Falló el escaneo: ${message}`,
    scanning: (done: number, total: number) => `Escaneando ${done}/${total}…`,
    fetchResults: 'Resultados de la descarga',
    fetchingCounter: (done: number, total: number) => `Bajando carátulas — ${done}/${total} listas`,
    batchFinished: (written: number, noMatch: number, failed: number) =>
      `Lote terminado: ${written} escritas · ${noMatch} sin coincidencia · ${failed} fallidas`,
    writtenCoverAlt: (fileName: string) => `Carátula escrita para ${fileName}`,
    jobStatus: {
      pending: 'En cola',
      matched: 'Descargando…',
      written: 'Escrita',
      'no-match': 'Sin coincidencia',
      error: 'Falló',
    },
    noBoxartFound: 'No se encontró carátula en el catálogo',
    unknownError: 'Error desconocido',
    catalogUnavailable: 'El catálogo de carátulas no está disponible',
    coversDirFailed: 'No se pudo abrir la carpeta de carátulas',
    noGames: 'No se encontraron juegos en esta tarjeta SD.',
    allCovered: (count: number) =>
      count === 1 ? 'Tu juego ya tiene carátula.' : `Los ${count} juegos ya tienen carátula.`,
    missingRegionLabel: 'Juegos sin carátula',
    missingTitle: 'Carátulas que faltan',
    selectAll: 'Seleccionar todos',
    selectNone: 'Deseleccionar todos',
    fetching: 'Bajando…',
    fetchCount: (count: number) => (count === 1 ? 'Bajar 1 carátula' : `Bajar ${count} carátulas`),
    noGamecode: 'sin gamecode — se guarda como carátula de usuario',
  },
  coverPicker: {
    dialogLabel: (game: string) => `Cambiar la carátula de ${game}`,
    title: (game: string) => `Cambiar carátula — ${game}`,
    close: 'Cerrar',
    searchPlaceholder: (system: string) => `Buscar carátulas de ${system}…`,
    searchLabel: 'Buscar carátulas',
    catalogFailed: (message: string) => `No se pudo cargar el catálogo de carátulas: ${message}`,
    retry: 'Reintentar',
    loadingCatalog: 'Cargando el catálogo de carátulas…',
    noMatches: (query: string) => `No hay carátulas que coincidan con «${query}».`,
    current: 'Actual',
    currentAlt: (game: string) => `Carátula actual de ${game}`,
    newCover: 'Nueva',
    composingPreview: 'Componiendo la vista previa…',
    newAlt: (game: string) => `Vista previa de la nueva carátula de ${game}`,
    previewFailed: (message: string) => `Falló la vista previa: ${message}`,
    writeFailed: (message: string) => `Falló la escritura: ${message}`,
    // Va antes de una ruta en <code>; el JSX añade el espacio y la ruta.
    writes: 'Escribe en',
    useCover: 'Usar esta carátula',
    writing: 'Escribiendo…',
    coversDirMissing: 'No se pudo abrir la carpeta de carátulas',
  },
  library: {
    overviewLabel: 'Resumen de la biblioteca',
    games: 'Juegos',
    systems: 'Sistemas',
    favorites: 'Favoritos',
    playTime: 'Tiempo de juego',
    playTimeValue: (totalMinutes: number) => {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${String(hours)}h ${String(minutes)}m`;
    },
    noGames1: 'No hay juegos en la tarjeta. PicoDex escanea todas las carpetas (excepto ',
    noGames2: ') buscando extensiones de ROM conocidas, así que tus juegos pueden estar en ',
    noGames3: ', en una carpeta ',
    noGames4: ' o en cualquier otro sitio.',
    gameCount: (count: number) => (count === 1 ? '1 juego' : `${String(count)} juegos`),
    covers: (covered: number, count: number, approximate: boolean) =>
      `${String(covered)}/${String(count)} carátulas${approximate ? ' (aprox.)' : ''}`,
    approxTitle: (systemLabel: string) =>
      `Aproximado: las carátulas de ${systemLabel} se identifican por el gamecode de la ROM, que no se puede cruzar con los archivos sin leer cada ROM. Es el número de archivos de carátula presentes, con tope en el número de juegos.`,
    viewGames: 'Ver juegos →',
    editBannerFor: (systemLabel: string) => `Editar el banner de la carpeta de ${systemLabel}`,
    editBannerTitle: (systemLabel: string) =>
      `Editar el banner de la carpeta ${systemLabel} (icono y nombre que muestra el launcher)`,
    cardComponentsLabel: 'Componentes de la tarjeta',
    onThisCard: 'En esta tarjeta',
    launcher: 'Launcher',
    picoLoader: 'Pico Loader',
    notFound: 'No encontrado',
    enhancedChip: 'Pico Enhanced',
    updatedOn: (date: string) => `· actualizado el ${date}`,
    apiVersion: (version: number) => `API v${String(version)}`,
    capabilities: {
      gameLoading: 'Carga de juegos',
      returnToLauncher: 'Volver al launcher',
      cheats: 'Cheats',
    },
  },
  compat: {
    dialogLabel: (title: string) => `Compatibilidad del loader para ${title}`,
    kicker: 'Compatibilidad del loader',
    close: 'Cerrar',
    noHeader:
      'No se pudo leer la cabecera de esta ROM, así que no hay nada contra lo que comprobarla.',
    noGameCode:
      'Esta ROM no trae un código de juego usable, así que no se pueden consultar las listas del loader para ella.',
    noLists: 'No se encontraron listas del loader en esta tarjeta SD.',
    revisionUnreadable: 'revisión ilegible (se asume rev 0)',
    revision: (n: number) => `revisión ${String(n)}`,
    apLabel: 'Arreglo antipiratería',
    saveLabel: 'Guardado',
    patchLabel: 'Parche específico del juego',
    saveTypes: {
      none: 'Ninguno',
      eeprom: 'EEPROM',
      flash: 'Flash',
      nand: 'NAND',
      unknown: 'Desconocido',
    },
    mismatch: (kind: 'fix' | 'patch', entryVersions: number[], romVersion: number | null) => {
      const thing = kind === 'fix' ? 'un arreglo' : 'un parche';
      const noun = entryVersions.length === 1 ? 'la revisión' : 'las revisiones';
      const revs = entryVersions.join(', ');
      const romPart =
        romVersion === null
          ? 'la revisión de esta ROM es ilegible (se asume rev 0)'
          : `esta ROM es la revisión ${String(romVersion)}`;
      return `Existe ${thing} para ${noun} ${revs}, pero ${romPart} — el loader solo actúa cuando la coincidencia es exacta.`;
    },
    ap: {
      notListed: 'No está en la lista, que no es lo mismo que “no necesita arreglo”.',
      skipped: 'El loader se salta la antipiratería para este tipo de ROM.',
      applies: (dsProtectVersion: string | null) =>
        `Arreglo incluido (DS Protect ${dsProtectVersion ?? 'desconocida'}).`,
      listUnavailable: 'aplist.bin falta o es ilegible — no hay contra qué comprobar.',
    },
    save: {
      homebrewNone: 'El loader no crea archivo de guardado para homebrew.',
      dsiWareNone: 'Este título DSiWare no declara datos de guardado.',
      dsiWare: (pubSize: string, prvSize: string | null) =>
        `DSiWare: un .pub de ${pubSize}${prvSize ? ` y un .prv de ${prvSize}` : ''}, con tamaños tomados de la cabecera de la ROM.`,
      nandHeader: (size: string) => `NAND, ${size} (de la cabecera de la ROM)`,
      defaultSize: 'No está en la lista — el loader usa 512 KB por defecto.',
      none: 'Ninguno — este juego no guarda.',
      listed: (type: string, size: string) => `${type}, ${size}`,
    },
    patch: {
      notListed: 'No está en la lista, que no es lo mismo que “nada que arreglar”.',
      skipped: 'El loader se salta los parches de juego para este tipo de ROM.',
      applied: (count: number) =>
        count === 1
          ? '1 parche aplicado al arrancar.'
          : `${String(count)} parches aplicados al arrancar.`,
      listUnavailable: 'patchlist.bin falta o es ilegible — no hay contra qué comprobar.',
    },
    hints: {
      ap: {
        retail:
          'Algunos juegos se congelan a propósito cuando detectan una flashcart, y el loader deshace eso al arrancar. Esta fila solo puede leer un archivo de tu tarjeta, aplist.bin. El loader también lleva arreglos integrados para juegos que no están en ese archivo, y esos no se ven desde aquí.',
        dsiware:
          'La protección antipiratería es cosa de cartuchos. Los títulos DSiWare nunca estuvieron en un cartucho, así que el loader no ejecuta ese paso para ellos.',
        homebrew:
          'La protección antipiratería es algo que hacen los juegos comerciales. El loader no ejecuta nada de esa maquinaria para homebrew, así que no hay nada que comprobar.',
      },
      save: {
        retail:
          'Los cartuchos originales llevan un chip de guardado dentro; el loader lo recrea como un archivo en la tarjeta SD, con el tamaño de este juego.',
        dsiware:
          'DSiWare guarda en archivos en vez de en un chip de cartucho. El loader los crea junto a la ROM con los tamaños que la propia ROM declara, así que no interviene ninguna lista.',
        homebrew:
          'El homebrew gestiona sus propios archivos en la tarjeta SD, así que el loader no le crea un guardado. Lo que esta ROM guarde, lo guarda por su cuenta.',
      },
      patch: {
        retail:
          'Unos pocos juegos necesitan pequeños arreglos puntuales para funcionar bien desde una flashcart. Esta fila solo puede leer un archivo de tu tarjeta, patchlist.bin, y el loader lleva otros arreglos integrados que no se ven desde aquí.',
        dsiware:
          'Unos pocos juegos necesitan pequeños arreglos puntuales para funcionar bien desde una flashcart. El loader también se los aplica a DSiWare — a diferencia de los pasos de guardado y antipiratería, este no se salta. Solo puede leer un archivo de tu tarjeta, patchlist.bin, y el loader lleva otros arreglos integrados que no se ven desde aquí.',
        homebrew:
          'Estos arreglos existen para que los juegos comerciales funcionen desde una flashcart. El loader no aplica ninguno al homebrew, que se ejecuta tal cual se compiló.',
      },
    },
  },
  banner: {
    dialogLabel: (system: string) => `Editar el banner de carpeta de ${system}`,
    heading: (path: string) => `Banner de carpeta — ${path}/`,
    close: 'Cerrar',
    sharedNote: (others: string, last: string) =>
      `Esta carpeta contiene ${others} y ${last}. Comparten un solo banner, así que guardar aquí cambia el icono y el nombre de todos.`,
    loadFailed: (detail: string) => `No se pudo leer el banner actual: ${detail}`,
    readingCurrent: 'Leyendo el banner actual…',
    previewLabel: 'Vista previa del banner',
    titleLabel: 'Título',
    titlePlaceholder: 'Título de carpeta que muestra el launcher',
    iconLegend: 'Icono',
    iconSource: 'Origen del icono',
    keepCurrent: 'Mantener el actual',
    fromImage: 'Desde una imagen',
    fromGame: 'Desde un juego',
    imageFileLabel: 'Archivo de imagen del icono',
    imageHint:
      'Escalada a 32×32 y cuantizada a 15 colores — la vista previa de arriba es exactamente lo que mostrará la DS.',
    imageFailed: (detail: string) => `No se pudo leer la imagen: ${detail}`,
    gamePicker: 'Juego del que tomar el icono',
    chooseGame: 'Elige un juego…',
    readingRom: 'Leyendo el banner de la ROM…',
    noRomBanner: 'Esta ROM no tiene icono de banner.',
    cannotOpen: (path: string) => `No se pudo abrir ${path}`,
    removeConfirm: (file: string) => `¿Quitar ${file}?`,
    remove: 'Quitar',
    removing: 'Quitando…',
    cancel: 'Cancelar',
    removeBanner: 'Quitar banner',
    writes: 'Escribe en ',
    writing: 'Escribiendo…',
    saveBanner: 'Guardar banner',
    writeFailed: (detail: string) => `Falló la escritura: ${detail}`,
    removeFailed: (detail: string) => `Falló el borrado: ${detail}`,
  },
  gallery: {
    sectionLabel: (system: string) => `Juegos de ${system}`,
    back: '← Biblioteca',
    shownOf: (shown: number, total: number) => `${shown} de ${total}`,
    gameCount: (count: number) => (count === 1 ? '1 juego' : `${count} juegos`),
    searchPlaceholder: (system: string) => `Buscar en ${system}…`,
    searchLabel: (system: string) => `Buscar juegos de ${system}`,
    filters: 'Filtros',
    favorites: 'Favoritos',
    completed: 'Completados',
    loadError: (message: string) => `No se pudieron cargar las carátulas: ${message}`,
    loadingCovers: (done: number, total: number) => `Cargando carátulas ${done}/${total}…`,
    noGames: (system: string) => `No hay juegos de ${system} en esta tarjeta SD.`,
    noMatches: 'Ningún juego coincide con tu búsqueda.',
    playTime: (hours: number, minutes: number) => `${hours}h ${minutes}m`,
    launches: (count: number) => `${count}x`,
    coverAlt: (title: string) => `Carátula de ${title}`,
    changeCover: (title: string) => `Cambiar la carátula de ${title}`,
    resolving: 'Identificando el juego…',
    pickBoxArt: 'Elige la carátula correcta',
    toggleFavorite: (title: string) => `Alternar favorito de ${title}`,
    removeFavorite: 'Quitar de favoritos',
    markFavorite: 'Marcar como favorito',
    toggleCompleted: (title: string) => `Alternar completado de ${title}`,
    unmarkCompleted: 'Desmarcar como completado',
    markCompleted: 'Marcar como completado',
    editStats: (title: string) => `Editar estadísticas de ${title}`,
    correctStats: 'Corregir partidas y tiempo de juego',
    loaderCompat: (title: string) => `Compatibilidad del loader para ${title}`,
    loaderCompatHint: 'Qué hace el loader con este juego',
  },
  health: {
    title: 'Salud de la tarjeta',
    openCard: 'Abre una tarjeta SD para hacer un chequeo de salud.',
    intro:
      'Revisa la tarjeta en busca de basura de macOS, archivos del loader que falten, guardados huérfanos y carátulas huérfanas. No se borra nada sin confirmación.',
    scanCard: 'Escanear tarjeta',
    scanning: 'Escaneando…',
    scanningCount: (count: number) =>
      count === 1 ? 'Escaneando… 1 archivo' : `Escaneando… ${count} archivos`,
    libraryRereadFailed:
      'No se pudo releer la biblioteca (mira el error de arriba), así que el escaneo se canceló — sus resultados no serían fiables.',
    scannedFiles: (count: number) =>
      count === 1 ? 'Se escaneó 1 archivo.' : `Se escanearon ${count} archivos.`,
    skippedFolders: (count: number) =>
      count === 1
        ? 'Se omitió 1 carpeta que macOS no dejó leer al navegador:'
        : `Se omitieron ${count} carpetas que macOS no dejó leer al navegador:`,
    deleting: 'Borrando…',
    yesDelete: 'Sí, borrar',
    no: 'No',
    junkTitle: 'Basura de macOS',
    junkNone: 'No se encontraron archivos basura de macOS.',
    junkCount: (count: number, size: string) =>
      count === 1 ? `1 archivo basura (${size})` : `${count} archivos basura (${size})`,
    junkKinds1: '— archivos AppleDouble ',
    junkKinds2: ' y ',
    junkKinds3: '.',
    showJunk: 'Ver archivos basura',
    junkCleanLabel: (count: number) =>
      count === 1 ? 'Limpiar 1 archivo' : `Limpiar ${count} archivos`,
    junkConfirmLabel: (count: number) =>
      count === 1 ? '¿Confirmas borrar 1 archivo?' : `¿Confirmas borrar ${count} archivos?`,
    junkDeleteFailed: (files: string) =>
      `No se pudieron borrar: ${files}. macOS protege algunos de sus archivos frente a otras apps — son inofensivos para el launcher.`,
    macosKeeps1: 'macOS mantiene ',
    macosKeeps2:
      ' en la tarjeta. Los recrea cada vez que la conectas a un Mac, así que se dejan en paz — son inofensivos para el launcher.',
    fsevents1: ' solo contiene un marcador ',
    fsevents2: ' — una configuración intencional para impedir el registro de eventos.',
    loaderTitle: 'Archivos del loader',
    loaderAllPresent: 'Están todos los archivos necesarios del loader.',
    loaderMissing1: 'Falta ',
    loaderMissing2: ' — el loader lo necesita para arrancar juegos.',
    downloadFrom1: 'Descárgalos de las ',
    downloadReleases: 'versiones de pico-loader',
    downloadFrom2: ' y copia los archivos en ',
    downloadFrom3: '.',
    loaderIs: 'Loader ',
    orJoiner: ' o ',
    loaderBuild1: ', build ',
    loaderBuild2: '.',
    loaderEnd: '.',
    ambiguityIdentical:
      ' Esas dos traen archivos idénticos byte a byte, así que nada puede distinguirlas.',
    ambiguityIncomplete:
      ' No se pudo afinar más: los archivos que difieren entre esas versiones faltan o no se reconocen aquí.',
    releasesBehind1: (count: number, atLeast: boolean) =>
      `${atLeast ? 'Al menos ' : ''}${count} ${count === 1 ? 'versión' : 'versiones'} por detrás de`,
    releasesBehind2: '.',
    newestKnownCandidate: (tag: string) =>
      `${tag} es la versión más nueva que PicoDex conoce, y es una de esas candidatas.`,
    newestKnownMaybe:
      'Esa es la versión más nueva que PicoDex conoce. Puede existir algo más nuevo.',
    newestRelease: 'Esa es la versión más nueva.',
    mixed1: (agreeing: number) =>
      `El loader está actualizado solo a medias: ${agreeing} de estos archivos son de `,
    mixed2: ', pero ',
    andJoiner: ' y ',
    mixed3: (count: number) =>
      count === 1
        ? 'no lo es. Suele pasar al copiar solo algunos de los archivos y no el resto.'
        : 'no lo son. Suele pasar al copiar solo algunos de los archivos y no el resto.',
    copyAgain1: 'Vuelve a copiarlos todos desde una sola ',
    copyAgainRelease: 'versión de pico-loader',
    copyAgainOverwrites:
      ' — ojo, eso también sobrescribe los archivos no reconocidos listados abajo.',
    copyAgainEnd: '.',
    unrecognisedAll:
      'Ninguno de estos archivos coincide con una versión que PicoDex reconozca — y conoce el build de cada flashcart para cada versión, así que probablemente son de una versión más nueva que este build de PicoDex, o están editados a mano. Por lo que este chequeo puede saber, la tarjeta no tiene nada mal.',
    unrecognisedListed1:
      'No son de una versión que PicoDex reconozca, así que quedaron fuera de la respuesta de arriba: ',
    unrecognisedListed2: '. Editarlos a mano es normal — la gente ajusta ',
    unrecognisedListed3: ' — y una versión más nueva que este build de PicoDex se ve igual.',
    githubNewer1: 'GitHub reporta ',
    githubNewer2: (tag: string) =>
      ` como la versión más nueva de pico-loader, que este build de PicoDex aún no conoce. Todo lo de arriba sigue valiendo: solo que no puede decirte si ${tag} es más nueva que lo que hay en tu tarjeta.`,
    unreadable: 'No se pudieron leer, así que no se comprobaron: ',
    optional1: 'Archivos opcionales que no están en la tarjeta: ',
    optional2: ' — no pasa nada por no tenerlos.',
    savesTitle: 'Guardados huérfanos',
    savesSkipped:
      'Omitido: no se encontraron juegos en la tarjeta, así que todos los guardados parecerían huérfanos sin serlo.',
    savesAllOk: 'Todos los guardados pertenecen a un juego de la tarjeta.',
    savesOrphans: (count: number) =>
      count === 1
        ? '1 guardado no tiene una ROM que le corresponda en su propia carpeta — el launcher solo empareja un guardado con una ROM que esté a su lado. Los guardados pueden contener progreso de juego y borrarlos es permanente — selecciona solo los que tengas claros.'
        : `${count} guardados no tienen una ROM que les corresponda en su propia carpeta — el launcher solo empareja un guardado con una ROM que esté a su lado. Los guardados pueden contener progreso de juego y borrarlos es permanente — selecciona solo los que tengas claros.`,
    savesDeleteLabel: (count: number) => `Borrar seleccionados (${count})`,
    savesConfirmLabel: (count: number) =>
      count === 1
        ? '¿Confirmas borrar permanentemente 1 guardado?'
        : `¿Confirmas borrar permanentemente ${count} guardados?`,
    coversTitle: 'Carátulas de usuario huérfanas',
    coversSkipped:
      'Omitido: no se encontraron juegos en la tarjeta, así que todas las carátulas de usuario parecerían huérfanas sin serlo.',
    coversAllOk: 'Todas las carátulas de usuario pertenecen a un juego de la tarjeta.',
    coversOrphans1: (count: number) => (count === 1 ? '1 carátula en ' : `${count} carátulas en `),
    coversOrphans2: (count: number) =>
      count === 1
        ? ' no corresponde a ninguna ROM. Las carátulas se pueden regenerar desde la pestaña Carátulas, así que vienen preseleccionadas.'
        : ' no corresponden a ninguna ROM. Las carátulas se pueden regenerar desde la pestaña Carátulas, así que vienen preseleccionadas.',
    coversCleanLabel: (count: number) => `Limpiar seleccionadas (${count})`,
    coversConfirmLabel: (count: number) =>
      count === 1 ? '¿Confirmas borrar 1 carátula?' : `¿Confirmas borrar ${count} carátulas?`,
  },
};
