---
name: role-frontend-developer
description: Build the front end of a Stanford site. Use when writing components, templates, layouts, or styles; setting up Astro or Next; wiring Tailwind and Decanter; handling images, fonts, and performance; or reviewing front-end code.
---

# Front-end development

Astro or Next, Tailwind 4 through Decanter 8, static output. See `sws-decanter`
for the styling mechanics and `sws-deploy` for CI and hosting. This skill is
about how to write the code.

## Semantic HTML is the whole accessibility foundation

Component conventions, the no-workshop decision, and the state inventory are in
`standards/patterns/components.md`.

Most accessibility failures are a `div` that should have been a `button`.

- **Real elements before ARIA.** A `button` is focusable, keyboard-operable, and
  announced correctly for free. `<div role="button">` needs `tabindex`, key
  handlers, and still behaves worse.
- **Landmarks on every page**: `header`, `nav`, `main`, `footer`. One `main`.
- **One `h1`**, no skipped levels. Heading level is structure, not size.
- **Lists for lists**, including navigation.
- **ARIA only when no element exists.** Bad ARIA is worse than none, and the
  first rule of ARIA is not to use it.

Reach for `react-aria` or a headless library when building genuinely complex
widgets like combo boxes or date pickers. `sulgryphon-nextjs` uses `react-aria`
and is the strongest accessibility signal across SWS repos. Note there is no
house headless library, so pick one per project rather than mixing.

## Astro specifics

**Default to zero JavaScript.** Astro components render to HTML with no runtime.
Only add an island when something needs interactivity, and use the narrowest
directive that works: `client:visible` over `client:load`, `client:idle` over
`client:load`.

**`output: 'static'`** for Pages. `'hybrid'` no longer exists.

**Set `site`** in the config. Without it the sitemap emits nothing and canonical
URLs are wrong, which fails two acceptance criteria. This is the single most
common configuration miss.

**Set `base`** if deploying to a subpath, or internal links work locally and
break in production.

**Content collections** for anything repeated: news, people, programs, events.
Define a schema, get type safety and validation. Hand-maintained arrays of
frontmatter drift.

Run `astro check` as the typecheck step. `sws-astro` is the reference for config,
eslint, and island composition.

## Next specifics

Static export forfeits `redirects`, `headers`, `rewrites`, Proxy, ISR, Server
Actions, Draft Mode, and default-loader image optimization. Route Handlers work
for `GET` only. Know that going in rather than discovering it.

`ccc-bulletin` is the reference for Next with Decanter 8 and Tailwind 4 through
`@tailwindcss/postcss`. Note the decoupled Drupal family deliberately runs
`--webpack` rather than Turbopack across all four repos. **That is a
point-in-time decision, not a forward choice** (confirmed with SWS 2026-09-01):
**Turbopack is the forward default for Next.js sites.** Recommend it for new
work. Do not convert an existing `--webpack` project just to match.

## Conventions from the repos

**`cnbuilder`** for conditional classes on Astro and Storyblok projects, pinned
at `^3.1.0` across seven SWS repos. The decoupled Drupal family uses `clsx` plus
`tailwind-merge`. Both fine, one per project.

**Heroicons.** Not FontAwesome Pro: one repo uses it behind a licence-gated
preinstall token check, and a unit site inheriting that gets an install failure
and a licence nobody mentioned.

**npm, or yarn if the project already has it.** Never convert a project's package
manager. Advice about dependency overrides must be manager-aware, since npm
`overrides` and yarn `resolutions` differ.

## Images, fonts, performance

**Images.** Use the framework's image component for local images so you get
dimensions, lazy loading, and modern formats. Always set width and height, or
explicit aspect ratio, to prevent layout shift. Under static export in Next, the
default image loader does not work and you need a custom one.

**Fonts.** Decanter ships no font assets. Import `fonts.css` or
`fonts-basic.css`. Preload the one or two faces above the fold and let the rest
load normally. `font-display: swap` unless you have a reason.

**Motion** uses the `motion` library, and the choice of entry point is a
budget decision. `motion/react` plus a React island measured **266.7 KB** of
JavaScript on this project's own docs page; the vanilla `motion` API
(`animate` + `inView`) measured **60.4 KB** for identical animation. Use the
React component when the project already has React, and the vanilla API when the
animation is the only reason you would add it. Pattern, values, and the
no-JavaScript trap: `standards/patterns/motion.md`.

**Performance budget** in CI, and treat it as a real number. These are
information sites; a department page that takes four seconds is a failure
regardless of what the design looks like. The wins are almost always: fewer
images, correctly sized; fewer islands; no client-side framework for static
content.

## Do not

- Create `tailwind.config.js`, install `@astrojs/tailwind`, or install
  `tailwindcss` directly. All three are v7 mental models;
  `standards/patterns/decanter.md` has the reasoning and the full avoid-list.
- Install `@tailwindcss/forms` directly. In Decanter 8 it sits behind the
  `decanter/forms` entry point, which a site with a form must `@import`
  explicitly or the form silently renders unstyled.
- Hardcode Stanford hex values. Use the token.
- Remove a focus outline without replacing it with something better.
- Ship a hover or focus state whose only change is a colour. Add or remove an
  underline: `hocus:underline`, or `hocus:no-underline` where the link is
  underlined at rest. `sws a11y` measures this.
- Put canonical facts in an image, a PDF, or a client-rendered component.
- Add a component workshop. These sites have few components and one consumer.

## Testing

Playwright plus `@axe-core/playwright` against every built route, asserting zero
violations tagged `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`. Run it with
`sws a11y` after the build. Playwright is the forward default even though three
SWS repos use Cypress; never convert an existing Cypress suite.

**If axe reports color-contrast failures with near-white foregrounds and ratios
close to 1, suspect an animation rather than a design defect.** axe reads
computed colour, so an element captured mid-fade measures the blend against its
backdrop. `sws a11y` waits for animations to settle for exactly this reason. A
hand-rolled harness that does not wait will report false positives on any page
with entry animations.

**`sws a11y` also measures hover and focus states**, which axe cannot: it audits
one static snapshot of the DOM, and a hover state does not exist in a snapshot,
so `hover:text-poppy-light` with nothing else in the rule reads as a clean page.
The runner moves a real mouse over each distinct control shape, presses a real
Tab key — Chromium only matches `:focus-visible` for keyboard focus, so a
scripted `.focus()` would report every `focus-visible:` utility as missing — and
diffs computed style, classifying each change as a colour or a non-colour cue.
Findings: `a11y.state.hover-non-color`, `a11y.state.focus-non-color`,
`a11y.state.focus-visible`. The fix is nearly always one class; the table is in
`standards/patterns/components.md`.

If a11y assertions are needed at component level, Vitest plus `axe-core` gets
there without a workshop. Reach for that when a component set earns real reuse.

## Artifacts

Components, layouts, and config in the project. Plus:

| Artifact | Path |
|---|---|
| Performance budget | `docs/performance-budget.md` |
| Component inventory | `docs/components.md`, shared with `role-ux-designer` |

## When reviewing front-end code

Look for the `div` that should be a `button`, the missing `site` config, a
hardcoded hex, a removed focus outline, a hover or focus state that is only a
colour change, an island that did not need to be one, an image without
dimensions, and a heading level chosen for its size. That list catches most of
what actually goes wrong.
