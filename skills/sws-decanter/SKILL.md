---
name: sws-decanter
description: Use Decanter, Stanford's design system, correctly. Use when setting up styling on a Stanford site, when asked about Stanford colors, spacing, typography or components, when Tailwind is involved, or when someone reaches for tailwind.config.js on a Stanford project.
---

# Decanter 8

Stanford's design system. **Version 8 is CSS-first on Tailwind 4.** Version 7
was a Tailwind 3 JavaScript preset. These are architecturally different and the
difference is the single most common source of failure.

## Install it with the beta tag, or you get v7

**Checked 2026-09-01.** `latest` is **7.5.3**, `beta` is **8.0.0-beta.0**.

```bash
npm i decanter@beta     # correct today
npm i decanter          # gets 7.5.3. WRONG for new work
```

A bare install getting v7 is the opposite of what was briefly true in August,
when the alpha sat on `latest`. Drop the tag once 8.0.0 reaches `latest`, and
record whatever resolved in `.sws/manifest.yml`.

The git form (`github:SU-SWS/decanter#v8`) appears in existing SWS projects and
is valid. Never flag it as an error.

## The whole integration

```css
/* src/styles/global.css */
@import 'decanter';
```

One line — **unless the site has a form**, which needs a second import:

```css
@import 'decanter';
@import 'decanter/forms';
```

Omitting it silently drops `.input`, `.select`, `.textarea`, `.checkbox`,
`.radio`, `.label`, `.legend`, `.fieldset` and the global form-element reset.
Nothing errors; the form just renders unstyled. `decanter/forms` is not
standalone — import it alongside `decanter` or `decanter/minimal`.

```js
// astro.config.mjs
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ vite: { plugins: [tailwindcss()] } });
```

Verified working against real builds. Specifically:

- **Do not add `@import 'tailwindcss'`.** Decanter's own `index.css` already
  does it. Doing both is harmless but redundant, costing about 340 bytes.
- **Do not add `@source`.** Tailwind roots source detection at the entry CSS
  file's project, not at the file containing the `tailwindcss` import, so
  consumer markup is found normally. Adding `@source` produces byte-identical
  output. This was tested with a controlled experiment; do not re-litigate it.
- **Do not create `tailwind.config.js`.** Decanter 8 has no JS config.
  Reaching for one signals a v7 mental model.
- **Do not install `@astrojs/tailwind`.** Dead package, supports neither current
  Astro nor Tailwind 4. Use `@tailwindcss/vite`.
- **Do not install `tailwindcss` directly.** It arrives transitively.
- **Do not install `@tailwindcss/forms` directly.** It still arrives
  transitively; in v8 only its *styles* are gated behind the `decanter/forms`
  entry point (see below).

For Next, use `@tailwindcss/postcss` instead of the Vite plugin. See
`ccc-bulletin` for a working example.

## Confirm you got v8, because v7 fails silently

```bash
node -p "require('./node_modules/decanter/package.json').version"   # expect 8.x
node -p "require('./node_modules/decanter/package.json').main"      # expect src/css/index.css
ls node_modules/decanter/node_modules 2>/dev/null                   # expect nothing
```

If `main` is `tailwind.config.js`, you have v7. If
`node_modules/decanter/node_modules/tailwindcss` exists, you have v7 **and** a
nested Tailwind 3 underneath a top-level Tailwind 4, which produces a build that
half works and errors that make no sense. Delete `node_modules` and the lockfile,
then reinstall.

You will also see the git form in existing SWS projects, and it is valid:

```json
"decanter": "github:SU-SWS/decanter#v8"
"decanter": "https://github.com/SU-SWS/decanter.git#v8"
```

Prefer the npm form for new work, since it is versioned and lockfile-friendly.
Never flag the git form as an error.

## Where the tokens are

Decanter 8 exposes everything as CSS custom properties, readable offline with no
account or network:

```
node_modules/decanter/src/css/theme/
  colors.css               Stanford Identity colors
  breakpoint.css
  font-family.css
  font-size.css
  gap.css
  line-height.css
  responsive-spacing.css
  screen-margins.css
  spacing.css
  transition-duration.css
```

**Read these files rather than guessing token names.** `decanter/colors` is also
directly importable. Components live in `src/css/components/` (button,
centered-container, form, list, logo, skiplink, stretched-link, table, wysiwyg),
utilities in `src/css/utilities/`, and custom variants in
`src/css/custom-variants.css`.

Colors follow the Stanford Identity Guide: `--color-cardinal-red` is `#8C1515`,
with `-light`, `-dark`, `-xdark`, `-xxdark` variants, plus a `black` scale from
`--color-black` (`#2E2D29`) through `--color-black-30` and similar. Use the
token, never the hex.

## Entry points

| Import | When |
|---|---|
| `@import 'decanter'` | Default. Use this |
| `@import 'decanter/forms'` | **Required if the site has a form.** Not standalone |
| `@import 'decanter/minimal'` | Only when something else already owns base element styling, such as a Drupal theme |
| `@import 'decanter/colors'` | Tokens only |

`minimal` is **not** a reduced design system. The only difference is
`base/base-minimal.css` (623 bytes) versus `base/base.css` (3,286 bytes). Theme,
components, utilities, and variants are identical. On a fresh Astro site
`minimal` just removes resets you need.

## Fonts and icons

Decanter ships no font assets. Import `fonts.css` for the full set or
`fonts-basic.css` for sans, serif, and the Stanford ligature logo font. Google
Fonts supplies Source Sans 3 and Source Serif 4; the logo ligature font comes
from the University Communications media CDN. **Decanter 8 dropped Roboto Slab
and Roboto Mono**: `font-slab` is gone and `font-mono` falls through to
Tailwind's system stack.

Use **Heroicons**. Do not use FontAwesome Pro: `adapt-stanford-homesite` does,
behind a licence-gated preinstall token check, and a unit site inheriting that
gets an install failure and a licence nobody mentioned.

## Class composition

`cnbuilder` in Astro and Storyblok projects, pinned at `^3.1.0` across seven SWS
repos. The decoupled Drupal family uses `clsx` plus `tailwind-merge` instead.
Both are legitimate. Pick one per project, not per file.

## When Decanter and something else disagree

**Decanter 8's CSS wins on token names and values.** Two specific cases:

`www.stanford.edu` does not consume Decanter. It is its own system, derived from
Decanter, and currently influencing Decanter 8. Its brand furniture is
authoritative because brand is brand, and its **tokens are a parallel
vocabulary**. Copying its CSS into a Decanter project produces something that
looks approximately right and does not use the design system, which passes
visual review and fails every token check.

`decanter.stanford.edu` and the Figma library currently document **v7**. Useful
for visual intent, not for v8 token names.

## Migrating a v7 project

The consumption model changes entirely: `presets: [require('decanter')]` becomes
`@import 'decanter'`, and `tailwind.config.js` goes away. Tailwind 3 to 4 is a
separate migration with its own codemod.

**The class-level delta is documented.** Upstream `UPGRADE.md` has the full table
and `standards/patterns/decanter.md` reproduces it with the four traps called out.
Do not guess which utilities moved, and do not re-derive it.

The traps, in one line each: `type-N` is smaller than `text-mN` below `lg`;
`children:` → `*:` reverses variant order and the intuitive form is wrong;
`break-words` still compiles but silently loses its v7 behaviour, so switch to
`wrap-anywhere`; and `aspect-w-*` / `aspect-h-*` stop generating anything.

Also audit for `.a11y-hidden` and `.accessibility-hidden`, removed in 7.5.0.
Elements using them become **visible** rather than erroring, and if you wanted
screen-reader-only text you need `sr-only`, not a rename.
