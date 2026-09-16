import type { Lang } from '../i18n/languages';

/**
 * The same sentence in as many app languages as have it; the panel shows the
 * active one and falls back to English for the rest.
 *
 * English is required and the others are not, on purpose: a language added after
 * a release should not owe a translation of every entry before it, and a release
 * should not wait on one.
 */
export type LocalizedText = { en: string } & Partial<Record<Lang, string>>;

/** One shipped change, optionally tied to a GitHub issue that requested it. */
export interface ChangelogChange {
  text: LocalizedText;
  /** GitHub issue number this resolved, linked in the UI when present. */
  issue?: number;
}

/** A released version and its curated highlights. */
export interface ChangelogEntry {
  version: string;
  /** Release day as YYYY-MM-DD; the panel formats it for the active language. */
  date: string;
  changes: ChangelogChange[];
}

/** Repository base URL for issue and release links. */
export const REPO_URL = 'https://github.com/rasalopa/picodex';

/**
 * Curated highlights, newest first. Single source of truth for the in-app
 * "What's new" panel: keep it to the changes worth surfacing to a new user,
 * not every commit. The GitHub Releases carry the full notes.
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.10.0',
    date: '2026-09-16',
    changes: [
      {
        text: {
          en: 'Use any image on your computer as a game\u2019s cover or icon. PicoDex converts it to what the launcher expects and refuses what the launcher would refuse. Icons work on GBA too, where games carry none of their own.',
          es: 'Usa cualquier imagen de tu ordenador como car\u00e1tula o icono de un juego. PicoDex la convierte a lo que espera el launcher y rechaza lo que el launcher rechazar\u00eda. Los iconos tambi\u00e9n funcionan en GBA, donde los juegos no traen ninguno.',
        },
        issue: 5,
      },
      {
        text: {
          en: 'The cover dialog is laid out like the console: the cover and title on the top screen, the browser row among its real neighbours on the bottom one. Cover and icon save together.',
          es: 'El di\u00e1logo de car\u00e1tula se ve como la consola: la car\u00e1tula y el t\u00edtulo en la pantalla de arriba, y la fila del navegador entre sus vecinos reales en la de abajo. La car\u00e1tula y el icono se guardan juntos.',
        },
      },
      {
        text: {
          en: 'Every screenshot on your card, both DS screens in one picture. Open one full size, save it as a PNG, or delete it from the card.',
          es: 'Todas las capturas de tu tarjeta, con las dos pantallas en una sola imagen. \u00c1brelas a tama\u00f1o completo, gu\u00e1rdalas como PNG o b\u00f3rralas de la tarjeta.',
        },
      },
      {
        text: {
          en: 'Games with Chinese, Japanese, Korean or Cyrillic file names get their covers: PicoDex reads the title the ROM carries inside itself. And when there is nothing to match on, it leaves the cover empty rather than fetching the wrong one.',
          es: 'Los juegos con el nombre de fichero en chino, japon\u00e9s, coreano o cir\u00edlico ya encuentran su car\u00e1tula: PicoDex lee el t\u00edtulo que el ROM lleva dentro. Y cuando no hay nada con lo que emparejar, deja la car\u00e1tula vac\u00eda en vez de traer la equivocada.',
        },
        issue: 6,
      },
      {
        text: {
          en: 'Covers no longer land on a kiosk demo or a beta build when the release itself is in the catalog.',
          es: 'Las car\u00e1tulas ya no acaban en una demo de quiosco o una beta cuando la versi\u00f3n de verdad est\u00e1 en el cat\u00e1logo.',
        },
      },
      {
        text: {
          en: 'The cover batch no longer races itself on a card that has no covers folder yet, which used to fail most of the batch.',
          es: 'El lote de car\u00e1tulas ya no compite consigo mismo en una tarjeta que a\u00fan no tiene carpeta de car\u00e1tulas, que hac\u00eda fallar casi todo el lote.',
        },
      },
    ],
  },
  {
    version: '0.9.0',
    date: '2026-08-31',
    changes: [
      {
        text: {
          en: 'PicoDex speaks Russian, translated by BrooksPMA. If you would like your language next, CONTRIBUTING.md has the steps and there is an issue to claim one.',
          es: 'PicoDex habla ruso, traducido por BrooksPMA. Si quieres que el siguiente sea tu idioma, CONTRIBUTING.md tiene los pasos y hay un issue para reclamarlo.',
          ru: 'PicoDex говорит по-русски благодаря переводу BrooksPMA. Если вы хотите добавить свой язык следующим, в CONTRIBUTING.md описаны необходимые шаги, а также есть issue, который можно взять в работу.',
        },
      },
    ],
  },
  {
    version: '0.8.1',
    date: '2026-08-26',
    changes: [
      {
        text: {
          en: 'PicoDex can be translated into any language now, and a translation does not have to be finished to ship - whatever a language has not covered yet reads in English. If you would like to see PicoDex in your language, CONTRIBUTING.md has the steps.',
          es: 'PicoDex ya se puede traducir a cualquier idioma, y una traducción no tiene que estar terminada para publicarse: lo que un idioma todavía no cubra se lee en inglés. Si quieres ver PicoDex en tu idioma, CONTRIBUTING.md tiene los pasos.',
          ru: 'PicoDex теперь можно перевести на любой язык, и перевод не обязательно должен быть завершён до конца — всё, что ещё не переведено, будет отображаться на английском. Если вы хотите видеть PicoDex на своём языке, то CONTRIBUTING.md содержит все инструкции.',
        },
      },
    ],
  },
  {
    version: '0.8.0',
    date: '2026-08-26',
    changes: [
      {
        text: {
          en: 'PicoDex speaks Spanish. The switch is in the footer and it remembers your choice, and on a first visit it follows your browser. Every view, every dialog and every message, including the ones about what is wrong with your card.',
          es: 'PicoDex habla español. El conmutador está en el pie y recuerda tu elección; la primera vez sigue al idioma del navegador. Todas las vistas, todos los diálogos y todos los mensajes, incluidos los que explican qué le pasa a tu tarjeta.',
          ru: 'PicoDex говорит по-испански. Переключатель находится в нижней части страницы и запоминает ваш выбор, а при первом посещении использует язык браузера. Переведены все страницы, диалоги и сообщения, включая те, которые рассказывают о проблемах с вашей картой.',
        },
      },
      {
        text: {
          en: 'This panel is translated too, and the dates now read the way your language writes them.',
          es: 'Este panel también está traducido, y las fechas se leen como las escribe tu idioma.',
          ru: 'Этот раздел тоже переведён, а даты теперь отображаются в соответствии с правилами вашего языка.',
        },
      },
      {
        text: {
          en: 'A long game name no longer gets cut short when you edit its play stats: the title wraps to a second line instead.',
          es: 'Un nombre de juego largo ya no se corta al editar sus estadísticas: el título pasa a una segunda línea.',
          ru: 'Длинное название игры больше не обрезается при редактировании игровой статистики: теперь оно переносится на вторую строку.',
        },
      },
    ],
  },
  {
    version: '0.7.0',
    date: '2026-08-14',
    changes: [
      {
        text: {
          en: 'PicoDex works with any flashcart that runs Pico Launcher, not just the DSpico. An R4, a DSTT, an Acekard — if the card has a /_pico folder, PicoDex understands it.',
          es: 'PicoDex funciona con cualquier flashcart que corra Pico Launcher, no solo el DSpico. Una R4, una DSTT, una Acekard: si la tarjeta tiene una carpeta /_pico, PicoDex la entiende.',
          ru: 'PicoDex работает с любой flash-картой, на которой запускается Pico Launcher, а не только с DSpico. R4, DSTT, Acekard — если на карте есть папка /_pico, PicoDex её распознает.',
        },
      },
      {
        text: {
          en: 'The health check now recognises the loader files of every flashcart build and says which one your card carries, like "Loader v1.7.1, the R4 build". A card that used to show unrecognised files just because it was not a DSpico now identifies cleanly.',
          es: 'La revisión de salud ahora reconoce los archivos del loader de cada build de flashcart y dice cuál lleva tu tarjeta, por ejemplo "Loader v1.7.1, el build R4". Una tarjeta que antes mostraba archivos sin reconocer solo por no ser un DSpico ahora se identifica sin ruido.',
          ru: 'Проверка состояния карты памяти теперь распознаёт файлы загрузчика для каждой сборки flash-карт и сообщает, какая именно установлена на вашей карте, например «Loader v1.7.1, сборка R4». Карта, которая раньше показывала неизвестные файлы только потому, что это была не DSpico, теперь корректно определяется.',
        },
      },
      {
        text: {
          en: 'The play-stats tab and the Pico Enhanced badge only appear when the card actually runs the Enhanced launcher, detected from the launcher itself.',
          es: 'La pestaña de estadísticas y la insignia de Pico Enhanced solo aparecen cuando la tarjeta corre de verdad el launcher Enhanced, detectado desde el propio launcher.',
          ru: 'Вкладка игровой статистики и значок Pico Enhanced отображаются только тогда, когда карта действительно запускает Enhanced launcher, что определяется непосредственно по самому загрузчику.',
        },
      },
    ],
  },
  {
    version: '0.6.0',
    date: '2026-08-10',
    changes: [
      {
        text: {
          en: 'PicoDex remembers the card you had open last time and offers to reopen it, so coming back is one click instead of the folder picker and a full rescan.',
          es: 'PicoDex recuerda la tarjeta que tenías abierta la última vez y ofrece reabrirla: volver es un clic en lugar del selector de carpetas y un escaneo completo.',
          ru: 'PicoDex запоминает карту, которую вы открывали в прошлый раз, и предлагает открыть её снова, поэтому вернуться к работе можно одним кликом вместо выбора папки и повторного сканирования.',
        },
      },
      {
        text: {
          en: 'Cover galleries open from memory. The covers a system showed once are kept decoded, so reopening it, even after a reload, no longer reads and redraws every image off the card.',
          es: 'Las galerías de carátulas abren desde memoria. Las carátulas que un sistema ya mostró se conservan decodificadas, así que reabrirlo, incluso tras recargar la página, ya no lee ni redibuja cada imagen desde la tarjeta.',
          ru: 'Галереи обложек открываются из памяти. Обложки, которые система уже показывала, хранятся в декодированном виде, поэтому при повторном открытии, даже после перезагрузки страницы, больше не требуется заново считывать и отрисовывать каждое изображение с карты.',
        },
      },
      {
        text: {
          en: 'Box art catalogs are kept for a week instead of downloaded every visit, and when GitHub is out of requests a stored catalog still finds art for nearly every game. The rate-limit message now says the budget is spent and when it comes back.',
          es: 'Los catálogos de carátulas se guardan una semana en lugar de bajarse en cada visita, y cuando GitHub se queda sin peticiones un catálogo guardado sigue encontrando arte para casi todos los juegos. El mensaje del límite ahora dice que el presupuesto se agotó y cuándo vuelve.',
          ru: 'Каталоги обложек теперь хранятся неделю вместо повторной загрузки при каждом посещении, а когда у GitHub заканчиваются доступные запросы, сохранённый каталог всё равно находит обложку почти для каждой игры. Сообщение об ограничении запросов теперь сообщает, что лимит исчерпан, и когда он восстановится.',
        },
      },
      {
        text: {
          en: 'Scanning a large library for missing covers is quicker: the ROM headers are read a few at a time instead of one after another.',
          es: 'Buscar carátulas faltantes en una biblioteca grande es más rápido: las cabeceras de las ROMs se leen de varias en varias en lugar de una por una.',
          ru: 'Сканирование большой библиотеки на предмет отсутствующих обложек стало быстрее: заголовки ROM читаются по несколько штук за раз, а не по одной.',
        },
      },
    ],
  },
  {
    version: '0.5.0',
    date: '2026-08-05',
    changes: [
      {
        text: {
          en: 'The health check now works out which Pico Loader release your card is running, and warns when its files came from different releases — a half-finished update the launcher gives no sign of.',
          es: 'La revisión de salud ahora deduce qué versión de Pico Loader corre tu tarjeta, y avisa cuando sus archivos vienen de versiones distintas: una actualización a medias de la que el launcher no da ninguna señal.',
          ru: 'Проверка состояния теперь определяет, какую версию Pico Loader использует ваша карта, и предупреждает, если её файлы взяты из разных версий — то есть обновление завершилось не полностью, хотя загрузчик никак об этом не сообщает.',
        },
      },
      {
        text: {
          en: 'A compatibility sheet for every NDS game: what the loader does for it at boot, the save type and size it will create, and whether an anti-piracy fix or a game patch applies to your exact ROM revision.',
          es: 'Una hoja de compatibilidad para cada juego de NDS: qué hace el loader por él al arrancar, el tipo y tamaño de save que creará, y si a tu revisión exacta de la ROM le aplica un fix antipiratería o un parche.',
          ru: 'Таблица совместимости для каждой игры NDS: что загрузчик делает с ней при запуске, какой тип и размер сохранения будет создан, а также применимы ли к вашей конкретной ревизии ROM исправление защиты от пиратства или патч игры.',
        },
      },
      {
        text: {
          en: 'Clearer warning in the folder banner editor when two systems share a folder: it now says that saving changes the icon and name of both, instead of only mentioning that they share one.',
          es: 'Aviso más claro en el editor de banner de carpeta cuando dos sistemas comparten una: ahora dice que guardar cambia el icono y el nombre de ambos, en lugar de solo mencionar que la comparten.',
          ru: 'Более понятное предупреждение в редакторе баннера папки, когда две системы используют одну папку: теперь оно сообщает, что сохранение изменит значок и название обеих систем, а не просто упоминает, что они используют общую папку.',
        },
      },
    ],
  },
  {
    version: '0.4.0',
    date: '2026-07-26',
    changes: [
      {
        text: {
          en: 'Search and filter the cover gallery: find games by name (accents ignored) and narrow the grid to favorites or completed games.',
          es: 'Busca y filtra la galería de carátulas: encuentra juegos por nombre (ignorando acentos) y reduce la cuadrícula a favoritos o completados.',
          ru: 'Поиск и фильтрация галереи обложек: находите игры по названию (диакритические знаки игнорируются) и отфильтровывайте сетку, оставляя только избранные или пройденные игры.',
        },
      },
      {
        text: {
          en: 'Play stats got box art: most played, recently played and favorites now show each game’s cover thumbnail.',
          es: 'Las estadísticas ganaron carátulas: los más jugados, los recientes y los favoritos ahora muestran la miniatura de cada juego.',
          ru: 'В игровой статистике появились обложки: для самых часто запускаемых, недавно запущенных и избранных игр теперь показываются миниатюры обложек.',
        },
      },
      {
        text: {
          en: 'A fresh landing page with feature cards — plus this "What’s new" panel.',
          es: 'Una página de inicio nueva con tarjetas de funciones, más este panel de novedades.',
          ru: 'Новая главная страница с карточками функций — и этот раздел «Что нового».',
        },
      },
    ],
  },
  {
    version: '0.3.1',
    date: '2026-07-22',
    changes: [
      {
        text: {
          en: "Edit play stats by hand. Click the play badge on a cover to correct a game's launch count and play time.",
          es: 'Edita las estadísticas a mano. Haz clic en la insignia de partidas de una carátula para corregir las partidas y el tiempo de juego de ese juego.',
          ru: 'Редактируйте игровую статистику вручную. Нажмите на значок статистики на обложке, чтобы исправить количество запусков и время игры.',
        },
        issue: 2,
      },
    ],
  },
  {
    version: '0.3.0',
    date: '2026-07-22',
    changes: [
      {
        text: {
          en: 'Homebrew ROMs sharing the "####" placeholder game code no longer bleed favorites, completed marks and stats into each other.',
          es: 'Los homebrew que comparten el código de juego "####" ya no se mezclan entre sí los favoritos, las marcas de completado ni las estadísticas.',
          ru: 'Homebrew ROM с кодом игры-заполнителем «####» больше не смешивают между собой избранные игры, отметки о прохождении и статистику.',
        },
      },
      {
        text: {
          en: 'The health check stopped offering to clean up the macOS system folders it can never remove. They are shown as an informational note instead.',
          es: 'La revisión de salud dejó de ofrecer limpiar las carpetas de sistema de macOS que nunca puede borrar. Ahora se muestran como una nota informativa.',
          ru: 'Проверка состояния больше не предлагает удалить системные папки macOS, которые она всё равно не может удалить. Теперь вместо этого они отображаются как информационное сообщение.',
        },
      },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-07-19',
    changes: [
      {
        text: {
          en: 'Completed-game marks. A green check on each cover toggles the completed flag, byte-compatible with the launcher.',
          es: 'Marcas de juego completado: un check verde en cada carátula la activa y desactiva, compatible byte a byte con el launcher.',
          ru: 'Отметки о прохождении игр. Зелёная галочка на каждой обложке переключает отметку о прохождении и остаётся побайтно совместимой с загрузчиком.',
        },
      },
      {
        text: {
          en: 'The SD health check now works on macOS-protected cards instead of aborting on a .Trashes folder.',
          es: 'La revisión de salud ahora funciona en tarjetas tocadas por macOS en lugar de abortar al ver una carpeta .Trashes.',
          ru: 'Проверка состояния SD-карты теперь работает с картами, изменёнными macOS, вместо того чтобы прерываться при обнаружении папки .Trashes.',
        },
      },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-07-19',
    changes: [
      {
        text: {
          en: 'First release. Library overview, per-system cover galleries, a missing-cover scanner with automatic box art fetch, and a manual cover picker.',
          es: 'Primera versión. Vista general de la biblioteca, galerías de carátulas por sistema, un escáner de carátulas faltantes con bajada automática de arte y un selector manual.',
          ru: 'Первый релиз. Обзор библиотеки, галереи обложек для каждой системы, сканер отсутствующих обложек с автоматической загрузкой изображений и ручной выбор обложки.',
        },
      },
      {
        text: {
          en: 'Drag-and-drop ROM import, favorites and play stats, a file-association editor, a folder-banner editor and an SD health check.',
          es: 'Importa ROMs arrastrándolas, favoritos y estadísticas de juego, un editor de asociaciones de archivos, un editor de banner de carpetas y una revisión de salud de la SD.',
          ru: 'Импорт ROM методом перетаскивания, избранные игры и игровая статистика, редактор сопоставления файлов, редактор баннеров папок и проверка состояния SD-карты.',
        },
      },
    ],
  },
];
