/** One shipped change, optionally tied to a GitHub issue that requested it. */
export interface ChangelogChange {
  text: string;
  /** GitHub issue number this resolved, linked in the UI when present. */
  issue?: number;
}

/** A released version and its curated highlights. */
export interface ChangelogEntry {
  version: string;
  /** Display date, e.g. "Jul 22, 2026". */
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
    version: '0.5.0',
    date: 'Aug 9, 2026',
    changes: [
      {
        text: 'The health check now works out which Pico Loader release your card is running, and warns when its files came from different releases — a half-finished update the launcher gives no sign of.',
      },
      {
        text: 'A compatibility sheet for every NDS game: what the loader does for it at boot, the save type and size it will create, and whether an anti-piracy fix or a game patch applies to your exact ROM revision.',
      },
      {
        text: 'The folder banner editor now says up front when a folder is shared by two systems, because one banner serves both.',
      },
    ],
  },
  {
    version: '0.4.0',
    date: 'Jul 24, 2026',
    changes: [
      {
        text: 'Search and filter the cover gallery: find games by name (accents ignored) and narrow the grid to favorites or completed games.',
      },
      {
        text: 'Play stats got box art: most played, recently played and favorites now show each game’s cover thumbnail.',
      },
      {
        text: 'A fresh landing page with feature cards — plus this "What’s new" panel.',
      },
    ],
  },
  {
    version: '0.3.1',
    date: 'Jul 22, 2026',
    changes: [
      {
        text: "Edit play stats by hand. Click the play badge on a cover to correct a game's launch count and play time.",
        issue: 2,
      },
    ],
  },
  {
    version: '0.3.0',
    date: 'Jul 22, 2026',
    changes: [
      {
        text: 'Homebrew ROMs sharing the "####" placeholder game code no longer bleed favorites, completed marks and stats into each other.',
      },
      {
        text: 'The health check stopped offering to clean up the macOS system folders it can never remove. They are shown as an informational note instead.',
      },
    ],
  },
  {
    version: '0.2.0',
    date: 'Jul 19, 2026',
    changes: [
      {
        text: 'Completed-game marks. A green check on each cover toggles the completed flag, byte-compatible with the launcher.',
      },
      {
        text: 'The SD health check now works on macOS-protected cards instead of aborting on a .Trashes folder.',
      },
    ],
  },
  {
    version: '0.1.0',
    date: 'Jul 19, 2026',
    changes: [
      {
        text: 'First release. Library overview, per-system cover galleries, a missing-cover scanner with automatic box art fetch, and a manual cover picker.',
      },
      {
        text: 'Drag-and-drop ROM import, favorites and play stats, a file-association editor, a folder-banner editor and an SD health check.',
      },
    ],
  },
];
