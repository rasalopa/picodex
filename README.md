# PicoDex

<img src="docs/logo.png" width="96" align="right" alt="" />

[![CI](https://github.com/rasalopa/picodex/actions/workflows/ci.yml/badge.svg)](https://github.com/rasalopa/picodex/actions/workflows/ci.yml)
[![Deploy](https://github.com/rasalopa/picodex/actions/workflows/deploy.yml/badge.svg)](https://rasalopa.github.io/picodex/)
[![Release](https://img.shields.io/github/v/release/rasalopa/picodex?color=e04b62)](https://github.com/rasalopa/picodex/releases)
[![License](https://img.shields.io/github/license/rasalopa/picodex)](LICENSE)

> Verwalte die SD-Karte deines [Pico Launcher](https://github.com/LNH-team/pico-launcher) direkt im Browser, auf dem [DSpico](https://github.com/LNH-team/dspico) oder jedem anderen Flashcart, auf dem er läuft. Cover, Bibliotheksorganisation, Favoriten und Spielstatistiken. Keine Installation, kein Backend, deine Dateien verlassen nie deinen Rechner.

![Bibliotheksübersicht mit Cover-Abdeckung pro System](docs/screenshots/library.png)

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/gallery.jpg" alt="Cover-Galerie mit Favoriten- und Spiel-Badges" /></td>
    <td width="50%"><img src="docs/screenshots/cover-picker.jpg" alt="Manuelle Cover-Auswahl mit Katalogsuche" /></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/stats.png" alt="Spielstatistiken aus Pico Launcher Enhanced" /></td>
    <td width="50%"><img src="docs/screenshots/health.png" alt="Kartencheck, der anzeigt, welche Pico-Loader-Version auf der Karte läuft" /></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/compat.jpg" alt="Loader-Kompatibilität pro Spiel: Kopierschutz-Fix, Speichertyp und -größe, Spiel-Patches" /></td>
    <td width="50%"><img src="docs/screenshots/landing.png" alt="PicoDex-Startseite mit den Funktionskarten" /></td>
  </tr>
  <tr>
    <td colspan="2"><img src="docs/screenshots/screenshots.jpg" alt="Screenshot-Galerie: jede Aufnahme auf der Karte, beide DS-Bildschirme in einem Bild untereinander" /></td>
  </tr>
</table>

## Was es kann

- 📂 **SD-Karte öffnen**: direkt im Browser (File System Access API) und die gesamte Bibliothek auf einen Blick sehen: Spiele pro System, Cover-Abdeckung und, falls du [Pico Launcher Enhanced](https://github.com/rasalopa/pico-launcher-enhanced) benutzt, deine Favoriten, durchgespielten Spiele und Spielstatistiken (die du zur Korrektur auch von Hand bearbeiten kannst).
- 🖼 **Cover-Manager**: findet Spiele ohne Cover, gleicht sie mit den [libretro-thumbnails](https://github.com/libretro-thumbnails)-Katalogen ab (No-Intro-Benennung, regionsabhängig), zeigt eine Vorschau und schreibt launcher-fertige BMPs nach `/_pico/covers/`.
- 🎮 **Bibliotheksorganisation**: ROM-Dateien auf die Seite ziehen, PicoDex erkennt das System, legt sie unter `Games/` ab und holt die passenden Cover.
- 📁 **Ordner-Banner**: gib jedem Systemordner ein eigenes Icon und einen Anzeigenamen (`banner.bnr`), direkt im Browser erzeugt.
- 🔗 **Dateizuordnungs-Editor**: weise jeder ROM-Endung ihren Emulator zu, ohne `settings.json` von Hand zu bearbeiten.
- 🩺 **Kartencheck**: findet macOS-Müll­dateien, fehlende Loader-Dateien sowie verwaiste Spielstände oder Cover. Ohne Bestätigung wird nichts gelöscht. Außerdem erkennt er, welche [Pico-Loader](https://github.com/LNH-team/pico-loader)-Version auf deiner Karte läuft, und bemerkt, wenn Loader-Dateien auf einer Karte aus verschiedenen Versionen stammen.
- 📸 **Screenshot-Galerie**: jede Aufnahme, die [Pico Launcher Enhanced](https://github.com/rasalopa/pico-launcher-enhanced) speichert, wenn du START gedrückt hältst, mit beiden DS-Bildschirmen untereinander in einem Bild. Du kannst sie in voller Größe ansehen, als PNG speichern oder von der Karte löschen.
- 🎮 **Loader-Kompatibilität pro Spiel**: für jedes NDS-Spiel, was der Loader beim Start damit tut (Kopierschutz-Fix, Speichertyp und -größe, spielspezifische Patches), abgeglichen mit der exakten Revision deiner ROM.

Alles läuft clientseitig. PicoDex hat keinen Server, keine Accounts und keine Telemetrie.

## Voraussetzungen

- Ein Chromium-basierter Browser (Chrome, Edge, Brave, Opera). Firefox und Safari unterstützen die File System Access API mit Schreibzugriff auf Verzeichnisse noch nicht.
- Eine Pico-Launcher-SD-Karte: jedes Flashcart mit einem `/_pico`-Ordner: der DSpico oder ein R4, DSTT, Acekard usw., auf dem Pico Launcher läuft.

## Benutzung

**Direkt nutzen: https://rasalopa.github.io/picodex/**. Keine Installation nötig.

Oder lokal ausführen:

```bash
git clone https://github.com/rasalopa/picodex.git
cd picodex
npm install
npm run dev
```

Öffne die angezeigte URL, klicke auf **Open SD card** und wähle deine eingebundene SD-Karte aus.

PicoDex startet im dunklen Design. Die Schaltfläche neben der Sprachauswahl in der Fußzeile wechselt
zum hellen Design oder lässt es deinem System folgen.

## Entwicklung

```bash
npm run dev          # dev server
npm test             # unit tests (vitest)
npm run lint         # oxlint
npm run format:check # prettier
npm run build        # production build
```

Die interessante Logik liegt in [`src/lib/`](src/lib/) als reines, abhängigkeitsfreies TypeScript: Parsing von NDS-/GBA-Headern, Kodierung von BMPs im Launcher-Format, Erzeugung von `banner.bnr`, Titelabgleich für Box-Art sowie die Formate `gamedata.json`/`settings.json` des Pico Launcher. Die React-App ist nur eine dünne Hülle darüber.

Wenn du mithelfen möchtest, lies [CONTRIBUTING.md](CONTRIBUTING.md); was jede Version gebracht hat, steht in [CHANGELOG.md](CHANGELOG.md).

## Danksagungen

- Dem [LNH-Team](https://github.com/LNH-team) für den DSpico, das offene Flashcart, das das alles erst Spaß macht, und für den Pico Launcher.
- [libretro-thumbnails](https://github.com/libretro-thumbnails) für die Box-Art-Sammlungen.
- claude.ai, das mir die readme übersetzt hat (und nur die readme!)

## Lizenz

[MIT](LICENSE)
