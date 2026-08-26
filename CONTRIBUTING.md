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

PicoDex ships in English and Spanish, and more languages are welcome — **including a partial one.**
Every key is optional and anything you leave out reads in English, so thirty strings translated is a
real contribution, not a draft.

**You do not need a DSpico or an SD card for this**, whatever the section above says. A browser is
enough: the language switch works on the landing page.

### Adding a language

1. Fork, clone, and `npm install`. `npm run dev` gives you the app on <http://localhost:5173>.

2. Create `src/i18n/<code>.ts`, named for your language's [BCP-47](https://en.wikipedia.org/wiki/IETF_language_tag)
   tag — `pt` for Portuguese, `pt-BR` if you specifically mean Brazilian. The tag is also what
   formats dates and what the page reports as its language, so pick the one you mean.

   ```ts
   import type { Dict } from './en';
   import type { Translation } from './languages';

   export const pt: Translation<Dict> = {
     app: {
       tabs: { library: 'Biblioteca' },
     },
   };
   ```

   `Translation<Dict>` is what makes every key optional. TypeScript still checks the keys you do
   write, so a typo is an error rather than a blank label.

3. Add two lines to [`src/i18n/languages.ts`](src/i18n/languages.ts) — an import, and an entry in
   the registry. The label is what the footer button shows.

   ```ts
   import { pt } from './pt';

   const REGISTRY = {
     en: { label: 'EN' },
     es: { label: 'ES', translation: es },
     pt: { label: 'PT', translation: pt },
   } satisfies Record<string, Entry>;
   ```

   That is the whole wiring. Nothing else in the app names a language.

4. Your language now appears in the footer. Click it. Everything you have translated is in your
   language and everything else is in English — that is working correctly, not a bug.

5. Copy keys over from [`src/i18n/en.ts`](src/i18n/en.ts) as you go: 370 entries in 15 groups, about
   515 lines, and it is the list of everything there is to say.
   [`src/i18n/es.ts`](src/i18n/es.ts) is worth reading for how the awkward ones were handled.

6. `npm test` and `npm run format` before opening the PR. A commit like
   `feat(i18n): add portuguese translation` fits the style below.

### Worth knowing before you start

- **Plain strings stay plain. Anything with a value in the middle is a function**, so you can put
  the value where your language wants it: `(count) => \`${count} games\`` can become
  `(count) => \`juegos: ${count}\``.
- **Some sentences are split in two** — `releasesBehind1` and `releasesBehind2` — because a version
  number sits between the halves. The spaces have to live inside your strings, and word order can
  differ, which is the whole reason the split exists. `src/i18n/spacing.test.ts` fails if something
  ends up glued to the value, and it checks your language automatically.
- **Some text is not ours to translate.** A loader filename, a game code, an error the browser or
  the SD card handed us — leave those alone.
- **The "What's new" panel is a separate list** in `src/lib/changelog.ts`, one entry per release.
  Translating it is optional and English is the fallback there too, so untranslated release notes in
  your language are expected, not missing.
- **Open an issue first.** Two people translating the same language into two different dictionaries
  is the one outcome nobody wants, and 515 lines is too much work to duplicate.

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
