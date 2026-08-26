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

## Translations

PicoDex ships in English and Spanish, and more languages are welcome. The split is deliberate:
**the dictionary is yours, the wiring is mine.**

What a translation is:

- `src/i18n/en.ts` is the source of truth — 370 entries in 15 groups, about 515 lines.
- `src/i18n/es.ts` is what a finished translation looks like. Copy that one, not `en.ts`: it opens
  with `export const es: Dict = {`, and keeping the `: Dict` annotation is what makes TypeScript
  tell you about a key you missed instead of shipping a blank label.
- Plain strings stay plain. Anything with a value in the middle is a function, so you can move the
  value wherever your language wants it.
- Some sentences are split in two, like `releasesBehind1` and `releasesBehind2`, because a version
  number sits between the halves. The spaces have to live inside your strings — `src/i18n/spacing.test.ts`
  checks that nothing ends up glued to the value.
- Only translate what is ours. A loader filename, a game code or an SD error we pass through is not
  ours to change.

What you do **not** have to do: the language list, the footer switch and the "What's new" panel all
name the current two languages one by one today, so a third language needs a handful of edits outside
your file. That part is mine. I would rather do it once with a real translation in hand than guess at
it in advance.

**Open an issue before you start.** Two people translating the same language into two different
dictionaries is the one outcome nobody wants, and a 515-line file is too much work to duplicate.

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
