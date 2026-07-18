# Contributing to PicoDex

Thanks for your interest! PicoDex is a small, focused project — contributions of all sizes are welcome.

## Getting started

```bash
git clone https://github.com/rasalopa/picodex.git
cd picodex
npm install
npm run dev
```

You will need a Chromium-based browser and, ideally, a DSpico SD card (a folder with a `/_pico` directory inside is enough to test most flows).

## Ground rules

- **Pure logic goes in `src/lib/`** — dependency-free TypeScript with unit tests, no DOM/React imports. UI goes in `src/` components. If a feature mixes both, split it.
- **Tests**: anything in `src/lib/` needs vitest coverage. Run `npm test` before opening a PR.
- **Formatting**: `npm run format` (prettier) and `npm run lint` must pass. CI enforces both.
- **No new runtime dependencies** without discussing it in an issue first — the whole point of PicoDex is being small and auditable.
- **Binary formats** (BMP covers, `banner.bnr`, ROM headers) follow what Pico Launcher actually reads. When in doubt, the launcher source is the spec.

## Commit style

Conventional commits, imperative mood, lowercase:

```
feat(covers): match japanese boxarts by romaji title
fix(banner): correct crc for titles over 100 chars
docs: explain firefox limitations
```

## Pull requests

- One topic per PR, small enough to review in one sitting.
- Describe the user-visible change and how you tested it.
- Screenshots/GIFs for UI changes are appreciated.

## Reporting bugs

Use the bug report template. Always include: browser + version, OS, and what your SD layout looks like (`Games/` folders, launcher version) when relevant.
