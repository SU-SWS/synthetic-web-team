---
policy: brand
title: Brand and the Stanford Identity Guide
reviewed: 2026-09-01
---

# Brand and identity

Governed by the **Stanford Identity Guide**. Two pieces of page furniture are
non-negotiable; everything between them is yours to design.

## What is actually binding, which is less than people assume

This distinction matters more than anything else in this file, and getting it
wrong makes the whole toolchain feel like an obstacle:

| Binding | Not binding |
|---|---|
| The Global Footer: exact link set, exact order, nothing else inside | Which components you build, and how they look |
| The Identity Bar, with nothing above it but a skip link | Page composition, layout, motion, imagery |
| The required Privacy and Accessibility links | Whether you match `www.stanford.edu` |
| Stanford type and colour as the site's visual basis | Every specific Decanter class and token choice |

**Policy governs only a sliver of the aesthetic.** Decanter is the *easiest
compliant path* — it hands you the footer, the Identity Bar and the tokens for
free — but it is **not a hard line on design choices**. A unit that wants to be
creative above the page furniture should be encouraged, not corrected. That
includes adopting a pattern seen on `www.stanford.edu` that has not yet landed in
Decanter 8: fine, go ahead, just know you own it until it does.

Stanford runs on carrots rather than sticks, and a person who feels blocked by
brand guidance goes their own way entirely — which is a worse outcome for brand
than a slightly unusual card component. Report the footer problem. Leave the
design alone.

The byte-exact contract lives in
`standards/fragments/global-footer.yml`. **Read it; do not type the footer from
memory.** Two of its ten URLs were wrong in this project's own first draft
because they were typed from memory.

## Page furniture, in this order

1. **Skip navigation link.** The only thing permitted above the Identity Bar.
2. **Stanford Identity Bar.** Nothing above it but the skip link.
3. Local header, navigation, page content. **Design freely here.**
4. Optional **local footer**. Unit links go here.
5. **Stanford Global Footer.** Immutable, exact.

## The Identity Bar has a fixed height

It is brand furniture, not a design opportunity. It appears on every Stanford
site, so an inconsistent one is obvious the moment two sites sit side by side.

The exact markup is `standards/fragments/identity-bar.yml`. Use it verbatim:

```html
<div class="bg-cardinal-red px-20 pt-5 pb-1 sm:px-30 md:px-50 lg:px-30">
  <a class="logo inline-block text-20 leading-none text-white no-underline hocus:text-white hocus:underline"
     href="https://www.stanford.edu">Stanford University<span class="sr-only"> (link is external)</span></a>
</div>
```

Three things people get wrong, all of which this project got wrong first:

- **`pt-5 pb-1`, not `py-*`.** Five pixels above and one below on Decanter's
  scale, giving a bar about 29px tall. A `py-12` container measures roughly 44px.
- **`logo`, not `font-serif`.** `.logo` is a Decanter *component* class carrying
  `--font-stanford` and its discretionary ligatures. `font-serif` renders in
  Source Serif 4 and loses them. `.logo` also forces cardinal red on hover and
  focus, which is why `hocus:text-white` is needed inside the red bar.
- **No centred wrapper.** The padding sits directly on the red container.
  Wrapping the link in `mx-auto max-w-*` moves the logo relative to every other
  Stanford site.

`brand.identity-bar.exact` verifies this by **classes, not measured pixels** —
the bar still drifts about 0.7px across viewports, and a brand check that wobbles
gets switched off.

### The ligature font is required, not optional

**Load the Stanford font wherever the Identity Bar appears.** Decanter's
`--font-stanford` is `Stanford, "Source Serif 4", Georgia, Times, …`, and
**Decanter 8 publishes no font assets** — `static/fonts/stanford.woff2` is in its
repository but not in the npm package. So a project that installs Decanter and
does nothing else gets the Source Serif 4 fallback: the wordmark renders in the
wrong typeface and the bar measures 28.8px instead of 30.8px. Nothing errors,
which is why `brand.identity-bar.font-loaded` exists.

```css
@font-face {
  font-family: 'Stanford';
  src:
    url('https://www-media.stanford.edu/assets/fonts/stanford.woff2') format('woff2'),
    url('https://www-media.stanford.edu/assets/fonts/stanford.woff') format('woff');
  font-weight: 300;
  font-display: swap;
}
```

Plus `<link rel="preconnect" href="https://www-media.stanford.edu" crossorigin>`,
since it is a separate origin and the bar is the first thing painted. That origin
will appear in `sws perf`'s third-party list: one 3.8 KB Stanford-hosted font, so
not a MinPriv concern, but expect to see it.

**A correction worth recording.** An earlier version of this file said not to add
the font, reasoning that the Decanter documentation site loads only Google Fonts
and renders the fallback too. That took current practice on one site as intent —
the error pattern in
[`../patterns/sws-conventions.md`](../patterns/sws-conventions.md). Decanter v7
shipped a `fonts.css` that loaded this exact font from this exact CDN.

## The Global Footer is immutable

Per the Identity Guide, its links **may not be altered, reordered, or added to,
and nothing else may go inside it**.

**Unit links in the Global Footer is the single most common brand violation.**
They belong in the local footer above it.

Structural facts that a check must get right, and that an earlier draft here got
wrong:

- The links are in **two lists inside one `<nav>`**, not one list of ten. A check
  written against a flat list produces false failures on correct markup.
- `nav` carries `aria-label="global footer menu"`.
- A stacked white Stanford logo, which is a link.
- Two copyright lines: `© Stanford University.` and
  `Stanford, California 94305.`

**List one, Stanford-wide wayfinding, four links in this order:** Stanford Home,
Maps & Directions, Search Stanford, Emergency Info.

**List two, policy and compliance, six links in this order:** Terms of Use,
Privacy, Copyright, Trademarks, Non-Discrimination, Accessibility.

Two of those targets are corrections worth knowing, because the obvious guess is
wrong in both cases:

| Link | Canonical target | The wrong guess |
|---|---|---|
| Trademarks | Admin Guide policy 1.5.4 | `trademarks.stanford.edu` |
| Non-Discrimination | Student Services student policies | `equity.stanford.edu` |

Two links carry compliance weight beyond brand:

- **Privacy** satisfies the cookie disclosure obligation. See
  [`privacy.md`](privacy.md).
- **Accessibility** satisfies the MinWeb barrier-reporting requirement. See
  [`accessibility.md`](accessibility.md).

## Type, colour, and links

Decanter supplies all of it as tokens. **Use the token, never the hex.** The
mechanics, token file paths, and entry points are in
[`../patterns/decanter.md`](../patterns/decanter.md).

`--color-cardinal-red` is `#8C1515`. If you find yourself typing that string,
use the token instead.

Contrast is the trap: Decanter's palette contains **both passing and failing
combinations, and the token name will not tell you which**. Check pairings at
design time.

## A specific trap: www.stanford.edu is not Decanter

The Stanford homesite runs **its own design system**, derived from Decanter and
currently influencing Decanter 8. It sits **upstream** of the design system
rather than downstream, and it has no `decanter` dependency. That absence is a
deliberate architecture, not an oversight.

So:

- Its **brand furniture is authoritative**, because brand is brand and it is the
  canonical site.
- Its **tokens and CSS are a parallel vocabulary.** Copying them into a Decanter
  project produces something that looks approximately right and does not use the
  design system. **That failure passes visual review and is invisible in a
  screenshot**, which is what makes it worth naming.
- It is a **preview of where Decanter 8 is going.** Read it for direction, not as
  a target to match today.

The same caution applies to `decanter.stanford.edu` and the Figma library, which
currently document **v7**: good for visual intent, useless for v8 token names. A
new Decanter 8 documentation site is in progress; until it ships, the shipped CSS
is the authority.

**When Figma and Decanter's CSS disagree, the CSS wins** on token names and
values.

## Fonts and icons

Decanter ships no font assets. Import `fonts.css` for the full set or
`fonts-basic.css` for sans, serif, and the Stanford ligature logo font. Google
Fonts supplies **Source Sans 3 and Source Serif 4**; the logo ligature font comes
from the University Communications media CDN.

**Decanter 8 no longer ships Roboto Slab or Roboto Mono.** `font-slab` is removed
outright, and `font-mono` is no longer overridden — it falls through to Tailwind's
default system monospace stack. If a design calls for a slab or a specific
monospace face, that is now yours to load and declare. See
[`../patterns/decanter.md`](../patterns/decanter.md).

Use **Heroicons**. Do not use FontAwesome Pro: one SWS repo does, behind a
licence-gated preinstall token check, and a unit site inheriting that gets an
install failure and a licence nobody mentioned.

## What an agent may not do

Change the footer. Reorder it. Add a unit link to it. Put anything above the
Identity Bar except the skip link. Edit
`standards/fragments/global-footer.yml` to make a project pass.

That fragment changes when **upstream** changes, and the change gets dated.
