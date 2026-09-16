# PicoDex

<img src="docs/logo.png" width="96" align="right" alt="" />

[![CI](https://github.com/rasalopa/picodex/actions/workflows/ci.yml/badge.svg)](https://github.com/rasalopa/picodex/actions/workflows/ci.yml)
[![Deploy](https://github.com/rasalopa/picodex/actions/workflows/deploy.yml/badge.svg)](https://rasalopa.github.io/picodex/)
[![Release](https://img.shields.io/github/v/release/rasalopa/picodex?color=e04b62)](https://github.com/rasalopa/picodex/releases)
[![License](https://img.shields.io/github/license/rasalopa/picodex)](LICENSE)

> Manage your [Pico Launcher](https://github.com/LNH-team/pico-launcher) SD card from the browser — on the [DSpico](https://github.com/LNH-team/dspico) or any flashcart that runs it. Covers, library organization, favorites and play stats. No install, no backend, your files never leave your machine.

![Library overview with per-system cover coverage](docs/screenshots/library.png)

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/gallery.jpg" alt="Cover gallery with favorites and play badges" /></td>
    <td width="50%"><img src="docs/screenshots/cover-picker.jpg" alt="Manual cover picker with catalog search" /></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/stats.png" alt="Play statistics from Pico Launcher Enhanced" /></td>
    <td width="50%"><img src="docs/screenshots/health.png" alt="Card health check reporting which Pico Loader release the card is running" /></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/compat.jpg" alt="Per-game loader compatibility: anti-piracy fix, save type and size, game patches" /></td>
    <td width="50%"><img src="docs/screenshots/landing.png" alt="PicoDex landing page with its feature cards" /></td>
  </tr>
  <tr>
    <td colspan="2"><img src="docs/screenshots/screenshots.jpg" alt="Screenshot gallery: every capture on the card, both DS screens stacked into one picture" /></td>
  </tr>
</table>

## What it does

- 📂 **Open your SD card** directly in the browser (File System Access API) and see your whole library at a glance: games per system, cover coverage, and — if you use [Pico Launcher Enhanced](https://github.com/rasalopa/pico-launcher-enhanced) — your favorites, completed games and play stats (which you can also edit by hand for corrections).
- 🖼 **Cover manager**: finds games without box art, matches them against the [libretro-thumbnails](https://github.com/libretro-thumbnails) catalogs (No-Intro naming, region-aware), previews the result and writes launcher-ready BMPs to `/_pico/covers/`.
- 🎮 **Library organizer**: drop ROM files onto the page — PicoDex detects the system, places them under `Games/`, and fetches their covers.
- 📁 **Folder banners**: give each system folder a proper icon and display name (`banner.bnr`), generated in the browser.
- 🔗 **File association editor**: point each ROM extension at its emulator without hand-editing `settings.json`.
- 🩺 **Card health check**: finds macOS junk files, missing loader files and orphaned saves or covers — nothing is deleted without confirmation. It also identifies which [Pico Loader](https://github.com/LNH-team/pico-loader) release your card is running, and spots a card whose loader files came from different releases.
- 📸 **Screenshot gallery**: every capture [Pico Launcher Enhanced](https://github.com/rasalopa/pico-launcher-enhanced) saves when you hold START, both DS screens stacked into one picture. View one full size, save it as a PNG, or delete it from the card.
- 🎮 **Per-game loader compatibility**: for any NDS game, what the loader will do for it at boot — anti-piracy fix, save type and size, game-specific patches — matched against your ROM's exact revision.

Everything runs client-side. PicoDex has no server, no accounts and no telemetry.

## Requirements

- A Chromium-based browser (Chrome, Edge, Brave, Opera). Firefox and Safari do not yet ship the directory-write File System Access API.
- A Pico Launcher SD card: any flashcart with a `/_pico` folder — the DSpico, or an R4, DSTT, Acekard, etc. running Pico Launcher.

## Using it

**Use it now: https://rasalopa.github.io/picodex/** — no install needed.

Or run it locally:

```bash
git clone https://github.com/rasalopa/picodex.git
cd picodex
npm install
npm run dev
```

Open the printed URL, click **Open SD card**, and pick your mounted SD.

## Development

```bash
npm run dev          # dev server
npm test             # unit tests (vitest)
npm run lint         # oxlint
npm run format:check # prettier
npm run build        # production build
```

The interesting logic lives in [`src/lib/`](src/lib/) as pure, dependency-free TypeScript: NDS/GBA header parsing, launcher-format BMP encoding, `banner.bnr` building, box-art title matching, and the Pico Launcher `gamedata.json`/`settings.json` formats. The React app is a thin shell over it.

See [CONTRIBUTING.md](CONTRIBUTING.md) if you want to help, and [CHANGELOG.md](CHANGELOG.md) for what each
release brought.

## Acknowledgements

- The [LNH team](https://github.com/LNH-team) for DSpico and Pico Launcher — the open flashcart that makes this fun.
- [libretro-thumbnails](https://github.com/libretro-thumbnails) for the box art collections.

## License

[MIT](LICENSE)
