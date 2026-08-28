/**
 * Russian translation for PicoDex
 */

export const ru = {
  app: {
    tabs: {
      library: 'Библиотека',
      covers: 'Обложки',
      stats: 'Статистика',
      associations: 'Связи файлов',
      health: 'Состояние',
    },

    sections: 'Разделы',
    openSdFolder: 'Открыть папку SD-карты',
    reload: 'Обновить',
    reloading: 'Обновление…',
    whatsNew: 'Что нового',
    footerLicense: 'Лицензия MIT · без телеметрии',
    language: 'Язык',
  },

  welcome: {
    tagline:
      'Управляйте SD-картой Pico Launcher прямо в браузере — на DSpico или любом флеш-картридже, который его запускает. Ваши файлы  никуда не отправляются с вашего компьютера.',
    openSd: 'Открыть SD-карту',
    opening: 'Открытие…',
    openLast: (name: string) => `Открыть ${name} `,
    lastCardReady: 'Карта, которую вы открывали в прошлый раз.',
    lastCardAskAgain:
      'Карта, которую вы открывали в прошлый раз. Браузер снова запросит разрешение на доступ.',
    pickDifferent: 'Выбрать другую карту',
    unsupported:
      'Ваш браузер не поддерживает File System Access API. Используйте браузер на основе Chromium (Chrome, Edge, Brave или Opera).',
    waitingForFolder: 'Ожидание папки…',
    whatsNewButton: 'Что нового в PicoDex',
    features: {
      boxArtTitle: 'Обложки игр',
      boxArtBody:
        'Находит игры без обложек и загружает изображения, готовые для использования в лаунчере.',
      libraryTitle: 'Ваша библиотека',
      libraryBody: 'Вся система на карте в одном месте, с информацией о наличии обложек.',
      statsTitle: 'Статистика игры',
      statsBody:
        'Избранное, самые запускаемые и недавно запускавшиеся игры — с форком Pico Launcher Enhanced.',
      healthTitle: 'Состояние карты',
      healthBody:
        'Находит мусорные файлы macOS, сохранения от удалённых игр и файлы, не относящиеся к текущей версии прошивки.',
      bannersTitle: 'Баннеры папок',
      bannersBody: 'Задайте каждой папке системы собственную иконку и отображаемое имя.',
      associationsTitle: 'Связи файлов',
      associationsBody: 'Привяжите эмулятор к ROMs без ручного редактирования JSON.',
    },
  },
  sd: {
    scanningLibrary: 'Сканирование библиотеки игр…',
    scanningLibraryCount: (count: number) => `Сканирование библиотеки игр… файлов: ${count} `,
    readingCovers: 'Чтение обложек…',
    readingLauncherData: 'Чтение данных лаунчера…',
    waitingAccess: 'Ожидание доступа к карте…',
    needsAccess: (name: string) => `Для открытия ${name} PicoDex требуется доступ к нему.`,
    noPicoAnymore: 'В этой папке больше нет каталога /_pico — выберите карту.',
    noPicoPickRoot: 'В этой папке нет каталога /_pico — выберите корень SD-карты Pico Launcher.',
    noPicoOnCard: 'На SD-карте нет каталога /_pico.',
    fsDenied:
      'macOS запретила доступ к одному из объектов на карте — возможно, это защищённая системой папка (например, .Trashes), либо карта смонтирована только для чтения.',
  },
  associations: {
    title: 'Связи файлов',
    openCard: 'Откройте SD-карту, чтобы изменить связи файлов.',
    noSettings1: 'Нет ',
    noSettings2: ' найден — один раз запустите Pico Launcher на DSpico, чтобы он создал ',
    noSettings3: ', затем обновите страницу.',
    intro1:
      'Выберите приложение, которое лаунчер будет открывать для каждого расширения файла. Настройки хранятся в ',
    intro2: '.',
    emptyList: 'Связей файлов пока нет — добавьте первую ниже.',
    extension: 'Расширение',
    appPath: 'Путь к приложению',
    actions: 'Действия',
    pathFor: (ext: string) => `Путь к приложению для файлов.${ext} `,
    removeFor: (ext: string) => `Удалить связь для.${ext} `,
    remove: 'Удалить',
    add: 'Добавить',
    invalidExt: 'Введите корректное расширение файла (точки игнорируются).',
    hint: 'Введите расширение без точки. Распространённые пути к эмуляторам: ',
    picoMissing: 'На SD-карте отсутствует каталог /_pico.',
    restartWarning:
      'Лаунчер считывает связи при загрузке — после сохранения перезапустите DS, чтобы изменения вступили в силу.',
    emptyPaths: 'Пути к приложениям не могут быть пустыми. Заполните пустые строки или удалите их.',
    discard: 'Отменить изменения',
    saveToSd: 'Сохранить на SD',
    saving: 'Сохранение…',
  },
  statsEditor: {
    dialogLabel: (game: string) => `Редактировать статистику игры ${game} `,
    title: (game: string) => `Редактирование статистики — ${game} `,
    close: 'Закрыть',
    launches: 'Запуски',
    playTime: 'Время игры',
    hours: 'Часы',
    minutes: 'Минуты',
    cancel: 'Отмена',
    save: 'Сохранить',
    saving: 'Сохранение…',
  },
  changelog: {
    dialogLabel: 'Что нового в PicoDex',
    title: 'Что нового',
    close: 'Закрыть',
    fullNotes: 'Полные патчноуты на GitHub',
  },
  dropImport: {
    queued: 'В очереди',
    copying: 'Копирование…',
    added: 'Добавлено',
    addedCover: 'Добавлено, обложка загружена',
    addedNoCover: 'Добавлено, подходящая обложка не найдена',
    duplicate: 'Дубликат (пропущено)',
    skipped: 'Пропущено (уже есть на карте)',
    unknownType: 'Неизвестный тип',
    failed: 'Ошибка',
    failedWith: (message: string) => `Ошибка(${message})`,
    gamesDirError: 'Не удалось открыть каталог игр',
    overlayBusy: 'Импорт выполняется…',
    overlayDrop: 'Перетащите ROM-файлы сюда, чтобы добавить их на карту',
    resultsLabel: 'Результаты импорта ROM',
    importing: 'Импорт ROM…',
    finished: 'Импорт завершён',
    addedCount: (count: number) => (count === 1 ? 'Добавлен 1' : `Добавлено: ${String(count)} `),
    dismissLabel: 'Скрыть результаты импорта',
    busyTitle: 'Импорт выполняется',
    dismiss: 'Скрыть',
  },
  stats: {
    duration: (minutes: number) => `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`,
    favorite: 'Избранное',
    noStatsTitle: 'Статистика игры пока отсутствует',
    noStatsBody:
      'записывает количество запусков, время игры и статус избранного для каждой игры. Запустите игру из лаунчера — и она появится здесь.',
    gamesPlayed: 'Сыграно игр',
    favorites: 'Избранное',
    completed: 'Пройдено',
    totalLaunches: 'Всего запусков',
    totalPlayTime: 'Общее время игры',
    mostPlayed: 'Самые запускаемые',
    recentlyPlayed: 'Недавно запущенные',
    game: 'Игра',
    launches: 'Запуски',
    playTime: 'Время игры',
    noneLaunched: 'Игры ещё не запускались.',
    noFavorites: 'Избранного пока нет — нажмите X на игре в лаунчере, чтобы добавить её.',
  },
  covers: {
    regionLabel: 'Обложки',
    title: 'Обложки',
    openCard: 'Откройте SD-карту, чтобы управлять обложками.',
    intro:
      'Находит игры без обложек, загружает подходящие изображения с libretro-thumbnails и записывает на SD-карту обложки BMP, готовые для использования лаунчером.',
    scanFailed: (message: string) => `Ошибка сканирования: ${message} `,
    scanning: (done: number, total: number) => `Сканирование ${done}/${total}…`,
    fetchResults: 'Результаты загрузки обложек',
    fetchingCounter: (done: number, total: number) => `Загрузка обложек — готово ${done}/${total}`,
    batchFinished: (written: number, noMatch: number, failed: number) =>
      `Пакетная обработка завершена: записано ${written} · без совпадения ${noMatch} · ошибок ${failed}`,
    writtenCoverAlt: (fileName: string) => `Записанная обложка для ${fileName}`,
    jobStatus: {
      pending: 'В очереди',
      matched: 'Загрузка…',
      written: 'Записано',
      'no-match': 'Совпадение не найдено',
      error: 'Ошибка',
    },
    noBoxartFound: 'В каталоге обложка не найдена',
    unknownError: 'Неизвестная ошибка',
    catalogUnavailable: 'Каталог обложек недоступен',
    coversDirFailed: 'Не удалось открыть каталог обложек',
    noGames: 'На этой SD-карте игры не найдены.',
    allCovered: (count: number) =>
      count === 1 ? 'У вашей игры уже есть обложка.' : `У всех ${count} игр уже есть обложки.`,
    missingRegionLabel: 'Игры без обложек',
    missingTitle: 'Нет обложек',
    selectAll: 'Выбрать все',
    selectNone: 'Снять выделение со всех',
    fetching: 'Загрузка…',
    fetchCount: (count: number) =>
      count === 1 ? 'Загрузить 1 обложку' : `Загрузить ${count} обложек`,
    noGamecode: 'нет gamecode — сохранено как пользовательская обложка',
  },
  coverPicker: {
    dialogLabel: (game: string) => `Изменить обложку для ${game}`,
    title: (game: string) => `Изменение обложки — ${game}`,
    close: 'Закрыть',
    searchPlaceholder: (system: string) => `Поиск обложек ${system}…`,
    searchLabel: 'Поиск обложек',
    catalogFailed: (message: string) => `Не удалось загрузить каталог обложек: ${message}`,
    retry: 'Повторить',
    loadingCatalog: 'Загрузка каталога обложек…',
    noMatches: (query: string) => `Обложки по запросу «${query}» не найдены.`,
    current: 'Текущая',
    currentAlt: (game: string) => `Текущая обложка игры ${game}`,
    newCover: 'Новая',
    composingPreview: 'Подготовка предпросмотра…',
    newAlt: (game: string) => `Предпросмотр новой обложки для ${game}`,
    previewFailed: (message: string) => `Ошибка предпросмотра: ${message}`,
    writeFailed: (message: string) => `Ошибка записи: ${message}`,
    writes: 'Записывается',
    useCover: 'Использовать эту обложку',
    writing: 'Запись…',
    coversDirMissing: 'Не удалось открыть каталог обложек',
  },
  library: {
    overviewLabel: 'Обзор библиотеки',
    games: 'Игры',
    systems: 'Системы',
    favorites: 'Избранное',
    playTime: 'Время игры',
    playTimeValue: (totalMinutes: number) => {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${String(hours)} ч ${String(minutes)} мин`;
    },
    noGames1: 'Игры на карте не найдены. PicoDex сканирует каждую папку (кроме ',
    noGames2: ') в поисках известных расширений ROM, поэтому игры могут находиться в ',
    noGames3: ', в папке ',
    noGames4: ' или ещё где угодно.',
    gameCount: (count: number) => (count === 1 ? '1 игра' : `${String(count)} игр`),
    covers: (covered: number, count: number, approximate: boolean) =>
      `${String(covered)}/${String(count)} обложек${approximate ? ' (прибл.)' : ''}`,
    approxTitle: (systemLabel: string) =>
      `Приблизительное значение: обложки ${systemLabel} сопоставляются по gamecode ROM, который нельзя сопоставить с файлами без чтения каждого ROM. Это количество найденных файлов обложек, ограниченное числом игр.`,
    viewGames: 'Просмотреть игры →',
    editBannerFor: (systemLabel: string) => `Изменить баннер папки ${systemLabel}`,
    editBannerTitle: (systemLabel: string) =>
      `Изменить баннер папки ${systemLabel} (иконку и отображаемое имя в лаунчере)`,
    cardComponentsLabel: 'Компоненты карты',
    onThisCard: 'На этой карте',
    launcher: 'Лаунчер',
    picoLoader: 'Pico Loader',
    notFound: 'Не найден',
    enhancedChip: 'Pico Enhanced',
    updatedOn: (date: string) => `· обновлено ${date}`,
    apiVersion: (version: number) => `API v${String(version)}`,
    capabilities: {
      gameLoading: 'Загрузка игр',
      returnToLauncher: 'Возврат в лаунчер',
      cheats: 'Читы',
    },
  },
  compat: {
    dialogLabel: (title: string) => `Совместимость загрузчика для ${title}`,
    kicker: 'Совместимость загрузчика',
    close: 'Закрыть',
    noHeader: 'Не удалось прочитать заголовок этого ROM, поэтому сравнивать его не с чем.',
    noGameCode:
      'Этот ROM не содержит пригодного для использования game code, поэтому списки загрузчика для него проверить невозможно.',
    noLists: 'На этой SD-карте списки загрузчика не найдены.',
    revisionUnreadable: 'версия не читается (предполагается ревизия 0)',
    revision: (n: number) => `ревизия ${String(n)}`,
    apLabel: 'Защита от пиратства',
    saveLabel: 'Сохранение',
    patchLabel: 'Патч для конкретной игры',
    saveTypes: {
      none: 'Нет',
      eeprom: 'EEPROM',
      flash: 'Flash',
      nand: 'NAND',
      unknown: 'Неизвестно',
    },
    mismatch: (kind: 'fix' | 'patch', entryVersions: number[], romVersion: number | null) => {
      const noun = entryVersions.length === 1 ? 'ревизия' : 'ревизии';
      const revs = entryVersions.join(', ');
      const romPart =
        romVersion === null
          ? 'ревизию этого ROM прочитать не удалось (предполагается ревизия 0)'
          : `этот ROM — ревизия ${String(romVersion)}`;
      return `Для ${noun} ${revs} существует ${kind === 'fix' ? 'исправление' : 'патч'}, но ${romPart} — загрузчик применяет их только при точном совпадении.`;
    },
    ap: {
      notListed: 'В списке отсутствует, что не означает «исправление не требуется».',
      skipped: 'Загрузчик пропускает проверку защиты от пиратства для этого типа ROM.',
      applies: (dsProtectVersion: string | null) =>
        `Исправление включено (DS Protect ${dsProtectVersion ?? 'неизвестно'}).`,
      listUnavailable: 'aplist.bin отсутствует или не читается — проверить не с чем.',
    },
    save: {
      homebrewNone: 'Для homebrew загрузчик не создаёт файл сохранения.',
      dsiWareNone: 'Эта игра DSiWare нет данных сохранения.',
      dsiWare: (pubSize: string, prvSize: string | null) =>
        `DSiWare: файл .pub размером ${pubSize}${prvSize ? ` и файл .prv размером ${prvSize}` : ''}, размер определён из заголовка ROM.`,
      nandHeader: (size: string) => `NAND, ${size} (из заголовка ROM)`,
      defaultSize: 'В списке отсутствует — загрузчик использует размер 512 КБ по умолчанию.',
      none: 'Нет — эта игра не сохраняет данные.',
      listed: (type: string, size: string) => `${type}, ${size}`,
    },
    patch: {
      notListed: 'В списке отсутствует, что не означает «исправление не требуется».',
      skipped: 'Загрузчик пропускает игровые патчи для этого типа ROM.',
      applied: (count: number) =>
        count === 1
          ? 'При запуске применён 1 патч.'
          : `При запуске применено патчей: ${String(count)}.`,
      listUnavailable: 'patchlist.bin отсутствует или не читается — проверить не с чем.',
    },
    hints: {
      ap: {
        retail:
          'Некоторые игры намеренно зависают, обнаружив флеш-картридж, и загрузчик устраняет эту защиту при запуске. Эта строка может прочитать только один файл на вашей карте — aplist.bin. Кроме того, загрузчик содержит встроенные исправления для игр, которых нет в этом файле, и здесь они не отображаются.',
        dsiware:
          'Защита от пиратства относится к картриджам. Игры DSiWare никогда не выпускались на картриджах, поэтому загрузчик вообще не выполняет для них этот этап.',
        homebrew:
          'Защита от пиратства используется коммерческими играми. Для homebrew загрузчик не запускает этот механизм, поэтому проверять здесь нечего.',
      },
      save: {
        retail:
          'В оригинальных картриджах установлен чип памяти сохранения; загрузчик эмулирует его в виде файла на SD-карте, используя размер, необходимый этой игре.',
        dsiware:
          'Игры DSiWare сохраняют данные в файлы, а не в чип картриджа. Загрузчик создаёт их рядом с ROM с размерами, указанными самим ROM, поэтому список для этого не требуется.',
        homebrew:
          'Homebrew самостоятельно управляет файлами на SD-карте, поэтому загрузчик не создаёт для него файл сохранения. Всё, что сохраняет этот ROM, он сохраняет самостоятельно.',
      },
      patch: {
        retail:
          'Некоторым играм требуются небольшие специальные исправления, чтобы корректно работать с флеш-картриджа. Эта строка может прочитать только один файл на вашей карте — patchlist.bin. Кроме того, загрузчик содержит другие встроенные исправления, которые здесь не отображаются.',
        dsiware:
          'Некоторым играм требуются небольшие специальные исправления, чтобы корректно работать с флеш-картриджа. Загрузчик применяет их и к DSiWare — в отличие от сохранения и защиты от пиратства, этот этап не пропускается. Он может прочитать только один файл на вашей карте — patchlist.bin. Кроме того, загрузчик содержит другие встроенные исправления, которые здесь не отображаются.',
        homebrew:
          'Эти исправления нужны для запуска коммерческих игр с флеш-картриджа. К homebrew загрузчик их не применяет — оно запускается в исходном виде.',
      },
    },
  },
  banner: {
    dialogLabel: (system: string) => `Изменить баннер папки ${system}`,
    heading: (path: string) => `Баннер папки — ${path}/`,
    close: 'Закрыть',
    sharedNote: (others: string, last: string) =>
      `В этой папке находятся ${others} и ${last}. Они используют один общий баннер, поэтому сохранение здесь изменит иконку и имя всех этих элементов.`,
    loadFailed: (detail: string) => `Не удалось прочитать текущий баннер: ${detail}`,
    readingCurrent: 'Чтение текущего баннера…',
    previewLabel: 'Предпросмотр баннера',
    titleLabel: 'Название',
    titlePlaceholder: 'Название папки, отображаемое лаунчером',
    iconLegend: 'Иконка',
    iconSource: 'Источник иконки',
    keepCurrent: 'Оставить текущую',
    fromImage: 'Из изображения',
    fromGame: 'Из игры',
    imageFileLabel: 'Файл изображения иконки',
    imageHint:
      'Масштабируется до 32×32 и преобразуется в 15 цветов — именно это изображение DS покажет в итоге.',
    imageFailed: (detail: string) => `Не удалось прочитать изображение: ${detail}`,
    gamePicker: 'Игра, из которой взять иконку',
    chooseGame: 'Выберите игру…',
    readingRom: 'Чтение баннера ROM…',
    noRomBanner: 'В этом ROM нет иконки баннера.',
    cannotOpen: (path: string) => `Не удалось открыть ${path}`,
    removeConfirm: (file: string) => `Удалить ${file}?`,
    remove: 'Удалить',
    removing: 'Удаление…',
    cancel: 'Отмена',
    removeBanner: 'Удалить баннер',
    writes: 'Записывается ',
    writing: 'Запись…',
    saveBanner: 'Сохранить баннер',
    writeFailed: (detail: string) => `Ошибка записи: ${detail}`,
    removeFailed: (detail: string) => `Ошибка удаления: ${detail}`,
  },
  gallery: {
    sectionLabel: (system: string) => `Игры ${system}`,
    back: '← Библиотека',
    shownOf: (shown: number, total: number) => `${shown} из ${total}`,
    gameCount: (count: number) => (count === 1 ? '1 игра' : `${count} игр`),
    searchPlaceholder: (system: string) => `Поиск среди игр ${system}…`,
    searchLabel: (system: string) => `Поиск среди игр ${system}`,
    filters: 'Фильтры',
    favorites: 'Избранное',
    completed: 'Пройдено',
    loadError: (message: string) => `Не удалось загрузить обложки: ${message}`,
    loadingCovers: (done: number, total: number) => `Загрузка обложек ${done}/${total}…`,
    noGames: (system: string) => `На этой SD-карте нет игр ${system}.`,
    noMatches: 'По вашему запросу игры не найдены.',
    playTime: (hours: number, minutes: number) => `${hours} ч ${minutes} мин`,
    launches: (count: number) => `${count}×`,
    coverAlt: (title: string) => `Обложка игры ${title}`,
    changeCover: (title: string) => `Изменить обложку для ${title}`,
    resolving: 'Определение игры…',
    pickBoxArt: 'Выберите правильную обложку',
    toggleFavorite: (title: string) => `Изменить статус избранного для ${title}`,
    removeFavorite: 'Убрать из избранного',
    markFavorite: 'Добавить в избранное',
    toggleCompleted: (title: string) => `Изменить статус прохождения для ${title}`,
    unmarkCompleted: 'Снять отметку «Пройдено»',
    markCompleted: 'Отметить как пройденную',
    editStats: (title: string) => `Редактировать статистику игры ${title}`,
    correctStats: 'Исправить количество запусков и время игры',
    loaderCompat: (title: string) => `Совместимость загрузчика для ${title}`,
    loaderCompatHint: 'Что загрузчик делает с этой игрой',
  },
  health: {
    title: 'Состояние карты',
    openCard: 'Откройте SD-карту, чтобы проверить её состояние.',
    intro:
      'Проверяет карту на наличие мусорных файлов macOS, отсутствующих файлов загрузчика, сохранения и обложки от удалённых игр. Ничего не удаляется без подтверждения.',
    scanCard: 'Проверить карту',
    scanning: 'Сканирование…',
    scanningCount: (count: number) =>
      count === 1 ? 'Сканирование… 1 файл' : `Сканирование… файлов: ${count}`,
    libraryRereadFailed:
      'Не удалось повторно прочитать библиотеку игр (см. ошибку выше), поэтому сканирование отменено — его результаты были бы недостоверными.',
    scannedFiles: (count: number) =>
      count === 1 ? 'Просмотрен 1 файл.' : `Просмотрено файлов: ${count}.`,
    skippedFolders: (count: number) =>
      count === 1
        ? 'Пропущена 1 папка, которую macOS не разрешила браузеру прочитать:'
        : `Пропущено папок: ${count}, которые macOS не разрешила браузеру прочитать:`,
    deleting: 'Удаление…',
    yesDelete: 'Да, удалить',
    no: 'Нет',
    junkTitle: 'Мусорные файлы macOS',
    junkNone: 'Мусорные файлы macOS не найдены.',
    junkCount: (count: number, size: string) =>
      count === 1 ? `1 мусорный файл (${size})` : `${count} мусорных файлов (${size})`,
    junkKinds1: '— ',
    junkKinds2: ' файлов AppleDouble и ',
    junkKinds3: '.',
    showJunk: 'Показать мусорные файлы',
    junkCleanLabel: (count: number) =>
      `Очистить: ${count} ${count === 1 ? 'файл' : 'файла/файлов'}`,
    junkConfirmLabel: (count: number) =>
      `Подтвердить удаление: ${count} ${count === 1 ? 'файла' : 'файлов'}?`,
    junkDeleteFailed: (files: string) =>
      `Не удалось удалить: ${files}. macOS защищает некоторые собственные файлы от других приложений — для лаунчера они безвредны.`,
    macosKeeps1: 'macOS сохраняет на карте ',
    macosKeeps2:
      '. macOS создаёт их заново при каждом подключении карты к Mac, поэтому они остаются — для лаунчера они безвредны.',
    fsevents1: ' содержит только ',
    fsevents2: ' — намеренно созданный маркер для предотвращения журналирования.',
    loaderTitle: 'Файлы загрузчика',
    loaderAllPresent: 'Все необходимые файлы загрузчика присутствуют.',
    loaderMissing1: '',
    loaderMissing2: ' отсутствует — загрузчику он необходим для запуска игр.',
    downloadFrom1: 'Скачайте из ',
    downloadReleases: 'выпусков pico-loader',
    downloadFrom2: ' и скопируйте файлы в ',
    downloadFrom3: '.',
    loaderIs: 'Загрузчик ',
    orJoiner: ' или ',
    loaderBuild1: ', сборка ',
    loaderBuild2: '.',
    loaderEnd: '.',
    ambiguityIdentical:
      ' Эти два варианта содержат побитово идентичные файлы, поэтому отличить их невозможно.',
    ambiguityIncomplete:
      ' Определить точнее не удалось: файлы, различающие эти выпуски, отсутствуют или не распознаны.',
    releasesBehind1: (count: number, atLeast: boolean) =>
      `${atLeast ? 'Как минимум ' : ''}${count} ${count === 1 ? 'выпуск' : 'выпуска/выпусков'} отстаёт от `,
    releasesBehind2: '.',
    newestKnownCandidate: (tag: string) =>
      `${tag} — самый новый выпуск, известный PicoDex, и один из найденных вариантов — именно он.`,
    newestKnownMaybe:
      'Это самый новый выпуск, известный PicoDex. Возможно, существует более новый.',
    newestRelease: 'Это самый новый выпуск.',
    mixed1: (agreeing: number) =>
      `Загрузчик обновлён лишь частично: ${agreeing} ${agreeing === 1 ? 'файл' : 'файлов'} из этих файлов относятся к `,
    mixed2: ', но ',
    andJoiner: ' и ',
    mixed3: (count: number) =>
      `${count === 1 ? 'остальной файл — нет' : 'остальные файлы — нет'}. Обычно это происходит, когда часть файлов скопировали, а остальные — нет.`,
    copyAgain1: 'Скопируйте все файлы заново из одного выпуска ',
    copyAgainRelease: 'pico-loader',
    copyAgainOverwrites:
      ' — обратите внимание: это также перезапишет нераспознанные файлы, перечисленные ниже.',
    copyAgainEnd: '.',
    unrecognisedAll:
      'Ни один из этих файлов не соответствует выпуску, который распознаёт PicoDex. PicoDex знает сборку каждого выпуска для каждого флеш-картриджа, поэтому, скорее всего, эти файлы относятся к выпуску, который новее этой версии PicoDex, либо были изменены вручную. Судя по этой проверке, с картой всё в порядке.',
    unrecognisedListed1:
      'Не относятся к выпуску, который распознаёт PicoDex, поэтому они не были учтены выше: ',
    unrecognisedListed2:
      '. Ручное редактирование этих файлов — обычное дело: пользователи действительно изменяют ',
    unrecognisedListed3:
      ' — и выпуск, более новый, чем эта версия PicoDex, выглядит таким же образом.',
    githubNewer1: 'GitHub сообщает, что ',
    githubNewer2: (tag: string) =>
      ` — самый новый выпуск pico-loader, о котором эта версия PicoDex ещё не знает. Всё сказанное выше остаётся в силе: PicoDex просто не может определить, новее ли ${tag} того, что установлено на вашей карте.`,
    unreadable: 'Не удалось прочитать, поэтому они не проверялись: ',
    optional1: 'Необязательные файлы, отсутствующие на карте: ',
    optional2: ' — их можно не добавлять.',
    savesTitle: 'Осиротевшие сохранения',
    savesSkipped:
      'Пропущено: на карте не найдено игр, поэтому любое сохранение ошибочно выглядело бы осиротевшим.',
    savesAllOk: 'Каждый файл сохранения относится к игре на карте.',
    savesOrphans: (count: number) =>
      count === 1
        ? '1 файл сохранения не имеет соответствующего ROM в своей папке — лаунчер связывает сохранение только с ROM, находящимся рядом с ним. Сохранения могут содержать прогресс игры, а их удаление необратимо — выбирайте только те файлы, в удалении которых уверены.'
        : `${count} файлов сохранения не имеют соответствующего ROM в своих папках — лаунчер связывает сохранение только с ROM, находящимся рядом с ним. Сохранения могут содержать прогресс игры, а их удаление необратимо — выбирайте только те файлы, в удалении которых уверены.`,
    savesDeleteLabel: (count: number) => `Удалить выбранные (${count})`,
    savesConfirmLabel: (count: number) =>
      `Подтвердить безвозвратное удаление ${count} ${count === 1 ? 'файла сохранения' : 'файлов сохранения'}?`,
    coversTitle: 'Осиротевшие пользовательские обложки',
    coversSkipped:
      'Пропущено: на карте не найдено игр, поэтому любая пользовательская обложка ошибочно выглядела бы осиротевшей.',
    coversAllOk: 'Каждая пользовательская обложка относится к игре на карте.',
    coversOrphans1: (count: number) => (count === 1 ? '1 обложка в ' : `${count} обложек в `),
    coversOrphans2: (count: number) =>
      ` ${count === 1 ? 'не соответствует' : 'не соответствуют'} ни одному ROM. Обложки можно заново сгенерировать на вкладке «Обложки», поэтому они предварительно выбраны.`,
    coversCleanLabel: (count: number) => `Очистить выбранные (${count})`,
    coversConfirmLabel: (count: number) =>
      `Подтвердить удаление ${count} ${count === 1 ? 'обложки' : 'обложек'}?`,
  },
};

export type Dict = typeof ru;
