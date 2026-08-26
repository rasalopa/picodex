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
    version: '0.8.0',
    date: '2026-08-26',
    changes: [
      {
        text: {
          en: 'PicoDex speaks Spanish. The switch is in the footer and it remembers your choice, and on a first visit it follows your browser. Every view, every dialog and every message, including the ones about what is wrong with your card.',
          es: 'PicoDex habla español. El conmutador está en el pie y recuerda tu elección; la primera vez sigue al idioma del navegador. Todas las vistas, todos los diálogos y todos los mensajes, incluidos los que explican qué le pasa a tu tarjeta.',
        },
      },
      {
        text: {
          en: 'This panel is translated too, and the dates now read the way your language writes them.',
          es: 'Este panel también está traducido, y las fechas se leen como las escribe tu idioma.',
        },
      },
      {
        text: {
          en: 'A long game name no longer gets cut short when you edit its play stats: the title wraps to a second line instead.',
          es: 'Un nombre de juego largo ya no se corta al editar sus estadísticas: el título pasa a una segunda línea.',
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
        },
      },
      {
        text: {
          en: 'The health check now recognises the loader files of every flashcart build and says which one your card carries, like "Loader v1.7.1, the R4 build". A card that used to show unrecognised files just because it was not a DSpico now identifies cleanly.',
          es: 'La revisión de salud ahora reconoce los archivos del loader de cada build de flashcart y dice cuál lleva tu tarjeta, por ejemplo "Loader v1.7.1, el build R4". Una tarjeta que antes mostraba archivos sin reconocer solo por no ser un DSpico ahora se identifica sin ruido.',
        },
      },
      {
        text: {
          en: 'The play-stats tab and the Pico Enhanced badge only appear when the card actually runs the Enhanced launcher, detected from the launcher itself.',
          es: 'La pestaña de estadísticas y la insignia de Pico Enhanced solo aparecen cuando la tarjeta corre de verdad el launcher Enhanced, detectado desde el propio launcher.',
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
        },
      },
      {
        text: {
          en: 'Cover galleries open from memory. The covers a system showed once are kept decoded, so reopening it, even after a reload, no longer reads and redraws every image off the card.',
          es: 'Las galerías de carátulas abren desde memoria. Las carátulas que un sistema ya mostró se conservan decodificadas, así que reabrirlo, incluso tras recargar la página, ya no lee ni redibuja cada imagen desde la tarjeta.',
        },
      },
      {
        text: {
          en: 'Box art catalogs are kept for a week instead of downloaded every visit, and when GitHub is out of requests a stored catalog still finds art for nearly every game. The rate-limit message now says the budget is spent and when it comes back.',
          es: 'Los catálogos de carátulas se guardan una semana en lugar de bajarse en cada visita, y cuando GitHub se queda sin peticiones un catálogo guardado sigue encontrando arte para casi todos los juegos. El mensaje del límite ahora dice que el presupuesto se agotó y cuándo vuelve.',
        },
      },
      {
        text: {
          en: 'Scanning a large library for missing covers is quicker: the ROM headers are read a few at a time instead of one after another.',
          es: 'Buscar carátulas faltantes en una biblioteca grande es más rápido: las cabeceras de las ROMs se leen de varias en varias en lugar de una por una.',
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
        },
      },
      {
        text: {
          en: 'A compatibility sheet for every NDS game: what the loader does for it at boot, the save type and size it will create, and whether an anti-piracy fix or a game patch applies to your exact ROM revision.',
          es: 'Una hoja de compatibilidad para cada juego de NDS: qué hace el loader por él al arrancar, el tipo y tamaño de save que creará, y si a tu revisión exacta de la ROM le aplica un fix antipiratería o un parche.',
        },
      },
      {
        text: {
          en: 'Clearer warning in the folder banner editor when two systems share a folder: it now says that saving changes the icon and name of both, instead of only mentioning that they share one.',
          es: 'Aviso más claro en el editor de banner de carpeta cuando dos sistemas comparten una: ahora dice que guardar cambia el icono y el nombre de ambos, en lugar de solo mencionar que la comparten.',
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
        },
      },
      {
        text: {
          en: 'Play stats got box art: most played, recently played and favorites now show each game’s cover thumbnail.',
          es: 'Las estadísticas ganaron carátulas: los más jugados, los recientes y los favoritos ahora muestran la miniatura de cada juego.',
        },
      },
      {
        text: {
          en: 'A fresh landing page with feature cards — plus this "What’s new" panel.',
          es: 'Una página de inicio nueva con tarjetas de funciones, más este panel de novedades.',
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
        },
      },
      {
        text: {
          en: 'The health check stopped offering to clean up the macOS system folders it can never remove. They are shown as an informational note instead.',
          es: 'La revisión de salud dejó de ofrecer limpiar las carpetas de sistema de macOS que nunca puede borrar. Ahora se muestran como una nota informativa.',
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
        },
      },
      {
        text: {
          en: 'The SD health check now works on macOS-protected cards instead of aborting on a .Trashes folder.',
          es: 'La revisión de salud ahora funciona en tarjetas tocadas por macOS en lugar de abortar al ver una carpeta .Trashes.',
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
        },
      },
      {
        text: {
          en: 'Drag-and-drop ROM import, favorites and play stats, a file-association editor, a folder-banner editor and an SD health check.',
          es: 'Importa ROMs arrastrándolas, favoritos y estadísticas de juego, un editor de asociaciones de archivos, un editor de banner de carpetas y una revisión de salud de la SD.',
        },
      },
    ],
  },
];
