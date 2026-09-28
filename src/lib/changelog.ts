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
    version: '0.10.3',
    date: '2026-09-28',
    changes: [
      {
        text: {
          en: "The Health tab lists the covers on the card that Pico Launcher can't show, with the reason. They usually come from saving a picture with an image editor; saving the cover again from the Covers tab fixes it.",
          es: 'La pestaña Salud lista las carátulas de la tarjeta que Pico Launcher no puede mostrar, con el motivo. Suelen venir de guardar la imagen con un editor; guardar la carátula otra vez desde la pestaña Carátulas lo arregla.',
        },
      },
      {
        text: {
          en: 'Custom icons and folder banners now say that they need a Pico Launcher newer than v1.3.0, which ignores both files. Newer builds and Pico Launcher Enhanced show them.',
          es: 'Los iconos propios y los banners de carpeta ahora avisan de que necesitan un Pico Launcher más nuevo que la v1.3.0, que ignora ambos archivos. Las builds más nuevas y Pico Launcher Enhanced los muestran.',
        },
      },
      {
        text: {
          en: 'The file association examples use the emulator names from the community setup guide, and only emulators that take the game from the launcher. Mega Drive games with the .smd extension are now listed.',
          es: 'Los ejemplos de asociaciones usan los nombres de emuladores de la guía de la comunidad, y solo emuladores que reciben el juego desde el launcher. Los juegos de Mega Drive con extensión .smd ya aparecen en la lista.',
        },
      },
    ],
  },
  {
    version: '0.10.2',
    date: '2026-09-27',
    changes: [
      {
        text: {
          en: 'Saves kept in a saves folder next to the games, the way TWiLight Menu++ and Pico Launcher Enhanced do it, are no longer reported as orphaned. The health check looks for the game in the folder above too.',
          es: 'Los guardados que viven en una carpeta saves junto a los juegos, como hacen TWiLight Menu++ y Pico Launcher Enhanced, ya no salen como huérfanos. La revisión de salud busca el juego también en la carpeta de arriba.',
        },
      },
      {
        text: {
          en: "A game with a save next to it and another in the saves folder is pointed out, with which launcher reads which. PicoDex can't tell which one is newer, so it leaves both.",
          es: 'Un juego con un guardado al lado y otro en la carpeta saves se señala, diciendo qué launcher lee cada uno. PicoDex no puede saber cuál es más reciente, así que deja los dos.',
        },
      },
    ],
  },
  {
    version: '0.10.1',
    date: '2026-09-26',
    changes: [
      {
        text: {
          en: "A settings file PicoDex can't read is no longer mistaken for a missing one. It says what is wrong with it and to fix it before starting Pico Launcher, which would replace it with a default one.",
          es: 'Un archivo de ajustes que PicoDex no puede leer ya no se confunde con uno que no existe. Dice qué le pasa y que lo arregles antes de arrancar Pico Launcher, que lo sustituiría por uno de fábrica.',
        },
      },
      {
        text: {
          en: "Errors now say what happened and what to do next, in your language: no connection, GitHub limiting the box art searches, a picture the browser can't read, a card pulled out mid-read.",
          es: 'Los errores ahora dicen qué pasó y qué hacer, en tu idioma: sin conexión, GitHub limitando las búsquedas de carátulas, una imagen que el navegador no puede leer, una tarjeta desconectada a medias.',
        },
      },
      {
        text: {
          en: 'Every text rewritten to speak plainly: what you are looking at and whether you need to do anything, instead of how PicoDex works inside.',
          es: 'Todos los textos reescritos para hablar claro: qué estás viendo y si tienes que hacer algo, en vez de cómo funciona PicoDex por dentro.',
        },
      },
    ],
  },
  {
    version: '0.10.0',
    date: '2026-09-16',
    changes: [
      {
        text: {
          en: "Use any picture on your computer as a game's cover or icon. PicoDex converts it to the format the launcher reads. It also tells you when an icon file already on your card is one the launcher can't show. Icons work for GBA games too, which don't come with one.",
          es: 'Usa cualquier imagen de tu equipo como carátula o icono de un juego. PicoDex la convierte al formato que lee el launcher. También te avisa cuando un icono que ya está en tu tarjeta es uno que el launcher no puede mostrar. Los iconos también funcionan en los juegos de GBA, que no traen uno propio.',
          ru: 'Используйте любое изображение на компьютере в качестве обложки или иконки игры. PicoDex преобразует его в формат, который ожидает лаунчер. Иконки работают и на GBA, хотя сами игры не содержат никаких иконок.',
        },
        issue: 5,
      },
      {
        text: {
          en: "The cover dialog now looks like the console: the cover and title on the top screen, and on the bottom screen the game's row in the list, between the games that sit next to it. The cover and the icon are saved together.",
          es: 'El diálogo de carátula ahora se ve como la consola: la carátula y el título en la pantalla de arriba, y en la de abajo la fila del juego en la lista, entre los juegos que tiene al lado. La carátula y el icono se guardan juntos.',
          ru: 'Структура обложки как на самой консоли: обложка и название находятся на верхнем экране, а строка браузера — среди своих настоящих соседей снизу. Обложка и значок сохраняются вместе.',
        },
      },
      {
        text: {
          en: 'Every screenshot on your card, both DS screens in one picture. Open one full size, save it as a PNG, or delete it from the card.',
          es: 'Todas las capturas de tu tarjeta, con las dos pantallas en una sola imagen. \u00c1brelas a tama\u00f1o completo, gu\u00e1rdalas como PNG o b\u00f3rralas de la tarjeta.',
          ru: 'Все скриншоты на вашей карте, оба экрана DS на одном изображении. Откройте любой в полном размере, сохраните его как PNG или удалите с карты.',
        },
      },
      {
        text: {
          en: "DS games whose file names are in Chinese, Japanese, Korean or Cyrillic now find their covers: PicoDex reads the title stored inside the game. If it still can't tell which game it is, it leaves the cover empty instead of picking the wrong one.",
          es: 'Los juegos de DS con el nombre de archivo en chino, japonés, coreano o cirílico ya encuentran su carátula: PicoDex lee el título que el juego lleva guardado. Si aun así no sabe qué juego es, deja la carátula vacía en vez de poner una equivocada.',
        },
        issue: 6,
      },
      {
        text: {
          en: 'Automatic covers no longer pick a demo or beta version of a game when box art for the full game exists.',
          es: 'Las carátulas automáticas ya no eligen la demo o la beta de un juego cuando existe la carátula del juego completo.',
          ru: 'Обложки больше не привязываются к демоверсии или бета-сборке, если полная версия игры уже есть в каталоге.',
        },
      },
      {
        text: {
          en: "Fetching many covers at once no longer fails on a card that doesn't have a covers folder yet.",
          es: 'Traer muchas carátulas a la vez ya no falla en una tarjeta que todavía no tiene carpeta de carátulas.',
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
          en: "PicoDex is now in Russian, translated by BrooksPMA. If you'd like to translate it into your language, CONTRIBUTING.md on GitHub explains how.",
          es: 'PicoDex ya está en ruso, traducido por BrooksPMA. Si quieres traducirlo a tu idioma, CONTRIBUTING.md en GitHub explica cómo.',
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
          en: "PicoDex can now be translated into any language. A translation can be published before it is finished: anything not translated yet appears in English. If you'd like PicoDex in your language, CONTRIBUTING.md has the steps.",
          es: 'PicoDex ya se puede traducir a cualquier idioma. Una traducción se puede publicar antes de estar terminada: lo que aún no esté traducido aparece en inglés. Si quieres PicoDex en tu idioma, CONTRIBUTING.md tiene los pasos.',
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
          en: "PicoDex is now in Spanish. Change the language at the bottom of the page. PicoDex remembers your choice, and on your first visit it uses your browser's language. Views, dialogs and the messages about problems on your card are translated.",
          es: 'PicoDex ya está en español. Cambia el idioma al pie de la página. PicoDex recuerda tu elección y, la primera vez, usa el idioma de tu navegador. Las vistas, los diálogos y los mensajes sobre problemas de tu tarjeta están traducidos.',
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
          en: 'The health check now recognises Pico Loader on other flashcarts too, not only the DSpico, and tells you which one your card has, like "Loader v1.7.1, the R4 build". Cards that aren\'t a DSpico no longer show their loader files as unrecognised.',
          es: 'La revisión de salud ahora reconoce Pico Loader también en otros flashcarts, no solo en el DSpico, y te dice cuál lleva tu tarjeta, por ejemplo "Loader v1.7.1, build R4". Las tarjetas que no son un DSpico ya no muestran sus archivos del loader como no reconocidos.',
          ru: 'Проверка состояния карты памяти теперь распознаёт файлы загрузчика для каждой сборки flash-карт и сообщает, какая именно установлена на вашей карте, например «Loader v1.7.1, сборка R4». Карта, которая раньше показывала неизвестные файлы только потому, что это была не DSpico, теперь корректно определяется.',
        },
      },
      {
        text: {
          en: 'The play stats tab and the Pico Enhanced badge now appear only when your card runs Pico Enhanced.',
          es: 'La pestaña de estadísticas y la insignia de Pico Enhanced ahora solo aparecen cuando tu tarjeta usa Pico Enhanced.',
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
          en: 'PicoDex remembers the card you had open last time and offers to reopen it with one click, without going through the folder picker again.',
          es: 'PicoDex recuerda la tarjeta que tenías abierta la última vez y te ofrece reabrirla con un clic, sin pasar otra vez por el selector de carpetas.',
        },
      },
      {
        text: {
          en: 'Cover galleries open faster: covers you have already seen show up straight away, even after reloading the page.',
          es: 'Las galerías de carátulas abren más rápido: las carátulas que ya viste aparecen al instante, incluso después de recargar la página.',
          ru: 'Галереи обложек открываются из памяти. Обложки, которые система уже показывала, хранятся в декодированном виде, поэтому при повторном открытии, даже после перезагрузки страницы, больше не требуется заново считывать и отрисовывать каждое изображение с карты.',
        },
      },
      {
        text: {
          en: 'The Covers tab keeps the list of available box art for a week instead of downloading it on every visit, so it still finds covers when GitHub limits how often it can be asked. When that happens, the message tells you when to try again.',
          es: 'La pestaña Carátulas guarda la lista de carátulas disponibles durante una semana en lugar de bajarla en cada visita, así que sigue encontrando carátulas cuando GitHub limita las consultas. Cuando eso pasa, el mensaje te dice cuándo volver a intentarlo.',
        },
      },
      {
        text: {
          en: 'Looking for missing covers in a large library is faster.',
          es: 'Buscar carátulas que faltan en una biblioteca grande es más rápido.',
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
          en: 'The health check now tells you which Pico Loader version is on your card. It also warns you when the loader files come from different versions, which usually means an update was only half copied. The launcher gives no sign of this.',
          es: 'La revisión de salud ahora te dice qué versión de Pico Loader hay en tu tarjeta. También te avisa cuando los archivos del loader vienen de versiones distintas, lo que suele significar que una actualización se copió a medias. El launcher no da ninguna señal de esto.',
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
          en: 'Homebrew games no longer mix up their favorites, completed marks and play stats with each other.',
          es: 'Los juegos homebrew ya no mezclan entre sí sus favoritos, marcas de completado y estadísticas.',
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
          en: 'Mark games as completed: click the green check on a cover. The mark is saved on the card in the same format the launcher uses.',
          es: 'Marca juegos como completados: haz clic en el check verde de una carátula. La marca se guarda en la tarjeta en el mismo formato que usa el launcher.',
        },
      },
      {
        text: {
          en: 'The health check no longer stops halfway on cards used on a Mac. It used to trip over the hidden .Trashes folder.',
          es: 'La revisión de salud ya no se detiene a medias en tarjetas usadas en un Mac. Antes tropezaba con la carpeta oculta .Trashes.',
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
