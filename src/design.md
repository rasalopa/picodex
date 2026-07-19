# PicoDex design language

Internal reference. Dark, sober, raspberry accent. Not flashy: motion is minimal, borders are
quiet, color means something. Tokens live in `src/index.css`.

## Tokens

- Surfaces: `--bg` (page), `--bg-raised` (cards/inputs), `--bg-hover` (hover fills).
- Lines: `--border` (default), `--border-strong` (hover/emphasis).
- Text: `--text` (body), `--text-strong` (rare emphasis, e.g. key numbers), `--text-dim` (secondary).
- Status: `--ok` / `--ok-soft` (good), `--warn` (caution), `--accent` / `--accent-soft`
  (brand + destructive). No other colors, ever.
- Shape and depth: `--radius` (10px), `--shadow-card`, `--shadow-modal`.

## Type scale

`0.78rem` fine print/labels · `0.875rem` body-small · `1rem` body · `1.15rem` section titles ·
`1.4rem` view titles. Numeric table cells get `font-variant-numeric: tabular-nums`.

## Spacing

Multiples of `0.25rem`. Cards pad `1rem`; gaps between sections `1.25rem`; grid gaps `0.75rem`.

## Shared patterns (utility classes in index.css)

- `.section-title` — section header: 0.75rem, uppercase, letter-spacing 0.07em, `--text-dim`.
  Use it wherever a section needs a small header (the `library-view__card-info-title` look).
- `.card` — shared surface: `--bg-raised`, 1px `--border`, `--radius`, `--shadow-card`, 1rem pad.
  Add `.card--interactive` only when clickable: hover swaps to `--bg-hover` / `--border-strong`.
  Non-interactive cards get **no** hover state.
- Chips/badges — the `library-view__chip` pattern: 999px radius, `--accent-soft` background,
  `--accent` text, 0.75rem, weight 600.
- Empty/info states — centered, `padding: 2.5rem 1rem`, `--text-dim`, optionally a 1.5rem
  emoji/mark line above. No borders; keep them quiet.
- Tables — header row 0.78rem uppercase dim; body rows `border-top: 1px solid var(--border)`;
  row hover `--bg-hover` (tables sit on card surfaces, where `--bg-raised` would be
  invisible); cell padding `0.5rem 0.75rem`.
- Buttons — base styles are global. Destructive: transparent background, 1px `--accent` border,
  `--accent` text; go solid only on hover.
- Modals — overlay `rgb(0 0 0 / 0.55)` + `backdrop-filter: blur(3px)`; dialog is the card
  pattern plus `--shadow-modal`; header row with title and an X close button.

## Motion

Transitions only on background / border / opacity / transform, `0.15s ease`. One entrance
animation is allowed: modals and results panels fade in with `opacity` +
`translateY(6px) -> 0` over `0.18s`. Nothing else moves.

`prefers-reduced-motion: reduce` disables all animations and transitions globally
(see index.css) and freezes the ProgressBar slider into a static bar; determinate fills stay.

## Rules of thumb

- Reuse the utilities above before writing new card/header CSS; adopt them incrementally.
- Existing class names stay; refine their rules or add modifiers (`block__elem--mod`).
- No new colors, no new dependencies, no layout rewrites.
