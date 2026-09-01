# Decanter 8

**Stanford's design system. Version 8 is CSS-first on Tailwind 4.** Version 7 was
a Tailwind 3 JavaScript preset. These are architecturally different, and the
difference is the single most common source of failure on a Stanford project.

**Decanter 8, never 7, is the one load-bearing version constraint in this entire
project.** Everything else installs at latest. This one is named because getting
it wrong fails silently.

**Decanter is the easiest compliant path, not a mandate.** It is worth reaching
for because it hands you the Global Footer, the Identity Bar and the Stanford
tokens without you maintaining them — that is the carrot. It is **not a hard line
on design choices**, and a project that diverges deliberately is doing a supported
thing (see the `sws-diverge` skill). What survives any divergence is the page
furniture and the policy links: `../policy/brand.md`.

Upstream migration docs, and the authority for everything in the migration
section below:

- **7.x → 8.x:** <https://github.com/SU-SWS/decanter/blob/main/UPGRADE.md>
- **v7 deprecations:** <https://github.com/SU-SWS/decanter/blob/v7/UPGRADE.md>
  (a strict subset of the above; the v7 branch simply lacks the 8.x section)

## Installing it, which is the part that changed

**Checked 2026-09-01.** The dist-tags moved, and the old advice is now wrong:

| dist-tag | Version |
|---|---|
| `latest` | **7.5.3** |
| `beta` | **8.0.0-beta.0** |
| `alpha` | `8.0.0-alpha.1` |

```bash
npm i decanter@beta        # correct today
npm i decanter             # gets 7.5.3. WRONG for new work
```

**A bare `npm i decanter` installs v7.** This is the opposite of what was true in
August 2026, when the alpha briefly sat on `latest`. It is also the safer
arrangement, because existing v7 consumers are no longer pulled forward
unexpectedly.

Drop the `@beta` once 8.0.0 ships to `latest`. Record what actually resolved in
`.sws/manifest.yml` — record it, do not judge it.

You will also see the git form in existing SWS projects, and it is valid:

```json
"decanter": "github:SU-SWS/decanter#v8"
```

Prefer the npm form for new work, since it is versioned and lockfile-friendly.
**Never flag the git form as an error.**

## The whole integration

```css
/* src/styles/global.css */
@import 'decanter';
```

One line — **unless the site has a form.** See the next section.

```js
// astro.config.mjs
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ vite: { plugins: [tailwindcss()] } });
```

For Next, use `@tailwindcss/postcss` instead of the Vite plugin. `ccc-bulletin`
is the working example.

## Form styles are opt-in in v8, and this fails silently

**The single most consequential v8 change for a Stanford unit site.**

In v7 the form classes and the `@tailwindcss/forms` reset came with the package.
In v8 they moved behind their own entry point:

```css
@import 'decanter';
@import 'decanter/forms';   /* ONLY if the site has forms */
```

Verified against `8.0.0-beta.0`: the package exports `./forms` →
`src/css/forms.css`.

What you lose by omitting it: the classes `.input`, `.select`, `.textarea`,
`.checkbox`, `.radio`, `.label`, `.legend`, `.fieldset`, **and the global
form-element reset**. Nothing errors. The form just renders unstyled, which is
the kind of failure that reaches production because the build stayed green.

**`decanter/forms` is not standalone.** Import it alongside `decanter` or
`decanter/minimal`, which supply the theme variables and root font size it
depends on.

## Things to avoid, which age better than versions to require

- **Do not add `@import 'tailwindcss'`.** Decanter's own `index.css` already does
  it. Doing both is harmless but redundant, costing about 340 bytes.
- **Do not add `@source`.** Tailwind roots source detection at the entry CSS
  file's project, not at the file containing the `tailwindcss` import, so consumer
  markup is found normally. Adding `@source` produces **byte-identical output**.
  Tested with a controlled experiment; do not re-litigate it.
- **Do not create `tailwind.config.js`.** Decanter 8 ships no `tailwind.config.js`
  and no TypeScript declarations for one. Reaching for it signals a v7 mental
  model. Anything you had in `theme.extend` moves to your own `@theme` block.
- **Do not install `@astrojs/tailwind`.** Dead package, supports neither current
  Astro nor Tailwind 4.
- **Do not install `tailwindcss` directly.** It arrives transitively through
  Decanter.
- **Do not install `@tailwindcss/forms` directly.** It is still a declared
  dependency of Decanter 8 (`^0.5.11`, verified in `8.0.0-beta.0`) and still
  installs. What changed in v8 is that its reset and Decanter's form classes are
  only *emitted* when you `@import 'decanter/forms'`. The package is transitive;
  the styles are opt-in. Do not conflate the two.
- **Do not hardcode Stanford hex values.** Use the token.

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
then reinstall with `@beta`.

## Entry points

| Import | When |
|---|---|
| `@import 'decanter'` | Default. Use this |
| `@import 'decanter/forms'` | **Required if the site has a form.** Not standalone; import alongside one of the two above |
| `@import 'decanter/minimal'` | Only when something else already owns base element styling, such as a Drupal theme |
| `@import 'decanter/colors'` | Tokens only |

`minimal` is **not** a reduced design system, and the name misleads people. The
only difference is `base/base-minimal.css` (623 bytes) versus `base/base.css`
(3,286 bytes). Theme, components, utilities, and variants are identical. On a
fresh Astro site, `minimal` just removes resets you need.

## Where the tokens are

Decanter 8 exposes everything as CSS custom properties, readable offline with no
account and no network:

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
directly importable. Components live in `src/css/components/`, utilities in
`src/css/utilities/`, and custom variants in `src/css/custom-variants.css`.

Colors follow the Stanford Identity Guide: `--color-cardinal-red` is `#8C1515`,
with `-light`, `-dark`, `-xdark`, `-xxdark` variants, plus a `black` scale from
`--color-black` (`#2E2D29`) through `--color-black-30` and similar.

**The token name will not tell you whether a pairing passes contrast.** Decanter's
palette contains both passing and failing combinations. Check at design time.

## Fonts in v8: two families are gone

Decanter 8 **no longer ships Roboto Slab or Roboto Mono.**

| Utility | v8 behaviour |
|---|---|
| `font-slab` | **Removed.** The utility does not exist. Use `font-serif`, or define your own slab family |
| `font-mono` | **No longer overridden.** Still core Tailwind, but resolves to Tailwind's default system monospace stack, not Roboto Mono. To keep Roboto Mono, load it and set `--font-mono` in your own `@theme` |
| `font-sans` / `font-serif` | Still lead with **Source Sans 3** and **Source Serif 4**. The superseded `Source Sans Pro` / `Source Serif Pro` fallbacks behind them are gone |

The Pro-fallback removal is **inert for most projects**, because `fonts.css` and
`fonts-basic.css` only ever loaded the current families. It bites only if you load
the Pro families yourself — in which case ensure Source Sans 3 and Source Serif 4
are also available, or text falls through to Helvetica Neue and Georgia.

Decanter ships no font assets. Import `fonts.css` for the full set or
`fonts-basic.css` for sans, serif, and the Stanford ligature logo font. See
[`../policy/brand.md`](../policy/brand.md), which owns the brand side, including
the Heroicons-not-FontAwesome-Pro rule.

## Class composition

`cnbuilder` in Astro and Storyblok projects, pinned at `^3.1.0` across seven SWS
repos. The decoupled Drupal family uses `clsx` plus `tailwind-merge` instead.
Both are legitimate. **Pick one per project, not per file.**

## Migrating a v7 project

The consumption model changes entirely: `presets: [require('decanter')]` becomes
`@import 'decanter'`, and `tailwind.config.js` goes away. Tailwind 3 to 4 is a
separate migration with its own codemod
(<https://tailwindcss.com/docs/upgrade-guide>).

### The class-level delta

From upstream `UPGRADE.md`. Font utilities are in the Fonts section above.

| v7 | v8 |
|---|---|
| `break-words` | `wrap-anywhere` |
| `font-regular` | `font-normal` |
| `link-regular` | `link-normal` |
| `foggy`, `foggy-light`, `foggy-dark` | `fog`, `fog-light`, `fog-dark` (identical values) |
| `facebook`, `twitter`, `instagram`, `linkedin`, `youtube` | Arbitrary values: `#4267B2`, `#1DA1F2`, `#E1306C`, `#0077B5`, `#FF0000`, e.g. `bg-[#4267B2]` |
| `text-shadow`, `-md`, `-lg` | `text-shadow-legacy`, `-legacy-md`, `-legacy-lg` |
| `rounded` | `rounded-[0.3rem]` |
| `text-vertical-lr` | `[writing-mode:vertical-lr]` |
| `text-m0` … `text-m9` | `type-0` … `type-9`, **or** `text-[1.25em]`, `[1.56em]`, `[1.95em]`, `[2.44em]`, `[3.05em]`, `[3.81em]`, `[4.77em]`, `[5.96em]`, `[7.45em]` |
| `text-09em`, `-text-m1` | `text-[.9em]` (no `type-*` equivalent; 0.9em is not on the scale) |
| `rs-p-neg1`, `rs-m-neg1` | `p-11 md:p-12 2xl:p-13`, `m-11 md:m-12 2xl:m-13` |
| `rs-p-neg2`, `rs-m-neg2` | `p-8 md:p-9 2xl:p-10`, `m-8 md:m-9 2xl:m-10` |
| `embed-container` | `aspect-video` (or `aspect-16/9`) on the wrapper, `size-full` on the embed |
| `aspect-w-*`, `aspect-h-*` | `aspect-<w>/<h>`, e.g. `aspect-4/3` |
| `aspect-none` | `aspect-auto` |
| `credits` | `text-[max(1.6rem,0.9em)] leading-snug italic text-cool-grey` |
| `children:`, `children-hover:`, `children-focus:`, `children-focus-visible:` | `*:`, `hover:*:`, `focus:*:`, `focus-visible:*:` |

The negative responsive spacing replacements cover **all** margin and padding
variants: `pt pr pb pl px py mt mr mb ml mx my`.

### Four traps in that table

**1. `type-N` is not `text-mN`. Pick deliberately.** `type-N` is the recommended
target, but it matches `text-mN` only at `lg` and up. Below that it is
deliberately smaller (`1.15^N` mobile, `1.2^N` at `md`, against `text-mN`'s flat
`1.25^N`) and it adds proportional letter spacing. `type-6` is 3.81em on desktop
like `text-m6` but **2.31em on mobile**. Use the arbitrary bracket value if you
need the v7 rendering preserved at every breakpoint. `type-0` and `text-m0` are
identical.

**2. `children:` → `*:` reverses variant order, and the intuitive form is
wrong.** `hover:*:underline` compiles to `& > *:hover`, which is what
`children-hover:` did. `*:hover:underline` compiles to `&:hover > *` — every child
of a hovered *parent*, a different thing. Plain `children:` → `*:` is exact, and
prefixes stack unchanged (`sm:children:` → `sm:*:`).

**3. `break-words` still exists, and that is the problem.** v7 amended core
Tailwind's `break-words` with `word-break: break-word` to force a long email
address onto a second line. v8 drops the override, so `break-words` left in your
markup **keeps working as plain Tailwind, silently without the v7 behaviour**. Use
`wrap-anywhere`. No error, no build failure, just a layout that quietly regressed.

**4. Aspect-ratio utilities changed hands.** v7 loaded
`@tailwindcss/aspect-ratio`, which suppressed core `aspect-*`. v8 drops the
plugin: `aspect-auto`, `aspect-square`, `aspect-video` now generate CSS, and
`aspect-w-*` / `aspect-h-*` / `aspect-none` generate **nothing**. Also,
`aspect-w-*` absolutely positioned direct children to fill the box; the
`aspect-ratio` property does not, so add `size-full` to the child.

### If you are still on v7 and not ready to move

Migrating the deprecated classes now makes the v8 upgrade a no-op. Every v7→v8
row above except the font utilities already works in v7.5.x and emits unchanged
CSS, so it is safe to do early. Use `aspect-[16/9]` rather than `aspect-video`
while on v7, because the named core utilities generate nothing until v8.

### Two v7.5.0 removals worth auditing for

**`.accessibility-hidden` and `.a11y-hidden` were removed in 7.5.0.** This does
not break the build; elements relying on them simply **become visible**. Search
templates for both names before upgrading.

Their documented behaviour was also wrong for years, which matters more than the
removal: they were described as visually hiding content while keeping it available
to screen readers. **They never did that — they hid content from everyone.** The
correct replacement depends on what you actually wanted:

| What you want | Use |
|---|---|
| Hide from everyone when `aria-hidden="true"` | `aria-hidden:hidden` (exact swap) |
| Visually hide, keep for screen readers | `sr-only`, with `focus:not-sr-only` for skip links |

See [`../policy/accessibility.md`](../policy/accessibility.md).

**`@tailwindcss/forms` moved to 0.5.11**, whose base styles now use
`input:where([type='…'])` instead of bare attribute selectors. `:where()`
contributes no specificity, so a bare `input { … }` rule in your own CSS that
previously lost to the forms base styles now ties and wins on source order. Also
fixed: `<input type="file" multiple>` was picking up `select` styling. Decanter's
own `.input`, `.select`, `.textarea` are unaffected.

## Documentation status

`decanter.stanford.edu` and the Figma library currently document **v7**. Good for
visual intent, useless for v8 token names. **When Figma and Decanter's CSS
disagree, the CSS wins** on token names and values.

Upstream has a real `UPGRADE.md` and a `CHANGELOG.md`, so the migration story is
documented. Prefer them over this file where they disagree, and correct this file
when they do.

**A new Decanter 8 documentation site is in progress** (noted 2026-09-01, no date
announced). Until it lands, the shipped CSS in `node_modules/decanter/src/css/`
remains the authority for token names, and this file covers only what SWS
consumers operationally need. **Do not author v8 reference documentation here** —
no token catalogues, no per-component class lists. That job belongs upstream, and
duplicating it now creates a second thing to keep correct. Re-point this section
when the site ships.
