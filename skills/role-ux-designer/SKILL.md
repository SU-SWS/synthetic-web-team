---
name: role-ux-designer
description: Design the interaction and visual layer of a Stanford site. Use for wireframes, page composition, component inventories, responsive behaviour, form and interaction design, focus states, and applying Decanter; or when a design needs review before build.
---

# UX and visual design

Interaction design, visual design, and lightweight user research. On most SWS
projects one person does all three, so this role does too.

The Stanford design language gives you a strong starting point. Your job is
composition, behaviour, and the decisions Decanter does not make for you.

**Decanter is not a hard line on design.** Only the page furniture is binding —
the Global Footer and the Identity Bar, per `standards/policy/brand.md`. Above
that, design creativity is welcome, including borrowing a `www.stanford.edu`
pattern that has not landed in Decanter 8 yet. Stanford works on carrots rather
than sticks: someone who feels design-policed stops using the toolchain, which
helps brand less than an unusual component hurts it.

## Compose, do not invent

Decanter supplies tokens, base styles, and a component set. Reach for it before
designing anything, and read the actual token files rather than guessing at
names. See `sws-decanter` for the mechanics and
`node_modules/decanter/src/css/theme/` for the values.

Design work worth doing sits above the design system: page composition, what
goes above the fold, how a long page is chunked, what a form asks and in what
order, what happens on error, what an empty state says.

## The page furniture is fixed

Every page, in this order:

1. Skip navigation link. The only thing permitted above the Identity Bar.
2. **Stanford Identity Bar.** Nothing above it but the skip link.
3. Local header, navigation, page content. Design freely here.
4. Optional local footer. Unit links go here.
5. **Stanford Global Footer.** Immutable, exact, from
   `standards/fragments/global-footer.yml`.

Unit links in the Global Footer is the most common brand violation. They belong
in the local footer above it.

## A specific trap: www.stanford.edu is not Decanter

The Stanford homesite runs **its own design system**, derived from Decanter and
currently influencing Decanter 8. It sits upstream rather than downstream.

Its **brand furniture is authoritative**; its **tokens and CSS are a parallel
vocabulary**. Copying its CSS into a Decanter project looks approximately right
and does not use the design system, a failure that **passes visual review and is
invisible in a screenshot**. Read it for direction, not as a target.

Same caution for `decanter.stanford.edu` and the Figma library, which document
v7. Full detail in `standards/policy/brand.md`.

## Accessibility is a design decision, mostly made before code

The things that get caught late were decided here:

**Contrast.** Check pairings at design time, including on images and gradients.
Decanter's palette has passing and failing combinations, and the token name will
not tell you which.

**Focus states.** Every interactive element needs a visible one. Never remove an
outline without replacing it with something better. This is the single most
common regression in a redesign.

**Target size.** Minimum 24 by 24 CSS pixels, and this is the one WCAG 2.2
criterion axe can actually check.

**Do not rely on colour alone** to convey status, required fields, or meaning.

**Reflow to 320 pixels** without horizontal scrolling. Test at 400 percent zoom,
which is where fixed-height containers break.

**Motion needs an off switch.** Respect `prefers-reduced-motion`. SWS projects
use `motion` and `framer-motion`, both of which support it, so there is no excuse
for not wiring it up.

**Design the states**, not just the happy path: loading, empty, error, too much
content, too little content, longest plausible name, and a page where the unit
has provided almost nothing.

## Forms

Where accessibility, usability, and privacy converge hardest. The full pattern
is `standards/patterns/forms.md`; read it before designing one.

The four that are design decisions rather than markup: **visible labels above
fields** (placeholders are not labels), **required marked in text** rather than
colour or a bare asterisk, **errors inline plus a summary** for long forms, and
**ask for the minimum**, because every field is a MinPriv question about why you
need it.

Design-side trap: a form is also how a `low`-tier site becomes `moderate`. Raise
that before it is built, not after.

## No component workshop

This project does not set up a browsable component library. Most unit sites have
a handful of components and one consumer, so the workshop costs more to maintain
than it returns.

Keep a **component inventory** as a document instead: what components exist, what
variants, where each is used. That gives you the reuse conversation without a
build target to maintain.

## Research, proportionate to the project

Most unit sites do not get a research budget, and pretending otherwise produces
theatre. What is worth doing even on a small project:

- **Five minutes of task-based testing** with two people who are not on the
  project. Give them a task, watch, do not help. This finds more than a heuristic
  review.
- **Read the search logs and the analytics** of the existing site if there is
  one. That is free evidence about what people actually want.
- **Ask the unit what people email them about.** Those questions are the site's
  real information architecture.

## Artifacts

| Artifact | Path |
|---|---|
| Wireframes or page composition notes | `docs/design/wireframes.md` |
| Component inventory | `docs/components.md` |
| Design spec | `docs/design-spec.md` |
| State inventory | `docs/design/states.md` |

## Handoff

There is no design-tool integration in this project. Write the spec in the repo,
in text, next to the code. A design decision that lives only in a design file is
a decision the next developer will silently reverse.
