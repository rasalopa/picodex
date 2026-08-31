# Changelog

Curated highlights, newest first. The in-app "What's new" panel shows the same list, in the
reader's language, sourced from [`src/lib/changelog.ts`](src/lib/changelog.ts) — an entry here has
a counterpart there. The [Releases](https://github.com/rasalopa/picodex/releases) carry the full
notes for each version.

## 0.9.0 — 2026-08-31

- **PicoDex speaks Russian, and it came from the community.** [@BrooksPMA](https://github.com/BrooksPMA)
  claimed Russian in the translations issue and had all 397 strings in a pull request the same day.
  Every view, every dialog and every card message, not a partial pass.
- **The open-translations model paid off on its first try.** v0.8.1 made every key optional so a
  language could ship half finished and never hold up a release. This one did not need that safety
  net, but it is what made saying yes easy: read it, run the gate, merge.

## 0.8.1 — 2026-08-26

- **Anyone can translate PicoDex now, and a translation does not have to be finished.** Every key in
  a language file is optional and anything left out reads in English, so thirty strings translated is
  a real contribution rather than a draft. A language that had to be complete before it shipped would
  have blocked every release after it.
- **One registry decides which languages exist.** The footer switch, the date formats, the language
  the page reports and the browser detection all read from it, so adding a language is its own file
  plus two lines. [CONTRIBUTING.md](CONTRIBUTING.md#translations) has the six steps.

## 0.8.0 — 2026-08-26

- **PicoDex speaks Spanish.** The switch is in the footer and it remembers your choice; on a first
  visit it follows your browser. Every view, every dialog and every message, including the ones
  about what is wrong with your card. No i18n library: two typed dictionaries and a hook, and the
  type system refuses a dictionary with a key missing.
- **The "What's new" panel is translated too**, and dates are formatted for the active language
  instead of being written in English.
- **A long game name no longer gets cut short** when you edit its play stats: the title wraps to a
  second line instead of truncating.

## 0.7.0 — 2026-08-14

- **Works with any flashcart that runs Pico Launcher**, not just the DSpico. An R4, a DSTT, an
  Acekard — if the card has a `/_pico` folder, PicoDex understands it.
- **The health check recognises the loader files of every flashcart build** and says which one your
  card carries, like "Loader v1.7.1, the R4 build". A card that used to show unrecognised files
  just because it was not a DSpico now identifies cleanly.
- **The play-stats tab and the Pico Enhanced badge appear only when the card runs the Enhanced
  launcher**, detected from the launcher itself.

## 0.6.0 — 2026-08-10

- **PicoDex remembers the card you had open last time** and offers to reopen it, so coming back is
  one click instead of the folder picker and a full rescan.
- **Cover galleries open from memory.** The covers a system showed once are kept decoded, so
  reopening it, even after a reload, no longer reads and redraws every image off the card.
- **Box art catalogs are kept for a week** instead of downloaded every visit, and when GitHub is out
  of requests a stored catalog still finds art for nearly every game. The rate-limit message says
  the budget is spent and when it comes back.
- **Scanning a large library for missing covers is quicker:** ROM headers are read a few at a time
  instead of one after another.

## 0.5.0 — 2026-08-05

- **The health check works out which Pico Loader release your card is running**, and warns when its
  files came from different releases — a half-finished update the launcher gives no sign of.
- **A compatibility sheet for every NDS game:** what the loader does for it at boot, the save type
  and size it will create, and whether an anti-piracy fix or a game patch applies to your exact ROM
  revision.
- **Clearer warning in the folder banner editor when two systems share a folder:** it says that
  saving changes the icon and name of both, instead of only mentioning that they share one.

## 0.4.0 — 2026-07-26

- **Search and filter the cover gallery:** find games by name (accents ignored) and narrow the grid
  to favorites or completed games.
- **Play stats got box art:** most played, recently played and favorites show each game's cover
  thumbnail.
- **A fresh landing page with feature cards**, plus the in-app "What's new" panel.

## 0.3.1 — 2026-07-22

- **Edit play stats by hand.** Click the play badge on a cover to correct a game's launch count and
  play time. ([#2](https://github.com/rasalopa/picodex/issues/2))

## 0.3.0 — 2026-07-22

- **Homebrew ROMs sharing the `####` placeholder game code no longer bleed** favorites, completed
  marks and stats into each other.
- **The health check stopped offering to clean up the macOS system folders it can never remove.**
  They are shown as an informational note instead.

## 0.2.0 — 2026-07-19

- **Completed-game marks.** A green check on each cover toggles the completed flag, byte-compatible
  with the launcher.
- **The SD health check works on macOS-protected cards** instead of aborting on a `.Trashes` folder.

## 0.1.0 — 2026-07-19

- **First release.** Library overview, per-system cover galleries, a missing-cover scanner with
  automatic box art fetch, and a manual cover picker.
- **Drag-and-drop ROM import**, favorites and play stats, a file-association editor, a folder-banner
  editor and an SD health check.
