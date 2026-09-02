# Components

How SWS builds components, and the one structural decision that surprises people.

## No component workshop. Deliberately.

**This project ships no Storybook, no browsable component library, no workshop
build target.**

The reasoning: most unit sites have a handful of components and exactly **one
consumer**. A workshop costs more to maintain than it returns at that scale, and
it becomes a second build to keep green.

What replaces it: a **component inventory** as a document. What components exist,
what variants, where each is used. That gives you the reuse conversation without
a build target.

`docs/components.md`, shared between `role-ux-designer` and
`role-frontend-developer`.

**When the decision would flip:** a component set with genuine multi-project
reuse. `adapt-stanford-homesite` runs Storybook with the a11y addon, plus Cypress
e2e and component tests, Jest, and MSW mocking. That is what thorough looks like
at flagship scale. Read it for reference, not as a shopping list.

If component-level a11y assertions are needed, **Vitest plus `axe-core`** gets
there without a workshop.

## Semantic HTML is the whole accessibility foundation

**Most accessibility failures are a `div` that should have been a `button`.**

- **Real elements before ARIA.** A `button` is focusable, keyboard-operable, and
  announced correctly for free. `<div role="button">` needs `tabindex`, key
  handlers, and still behaves worse.
- **Landmarks on every page**: `header`, `nav`, `main`, `footer`. One `main`.
- **One `h1`**, no skipped levels. **Heading level is structure, not size.**
- **Lists for lists**, including navigation.
- **ARIA only when no element exists.** Bad ARIA is worse than none, and the
  first rule of ARIA is not to use it.
- **Tables are for data.** Real headers, real scope. Never for layout.

For genuinely complex widgets (combo boxes, date pickers), reach for a headless
library. `sulgryphon-nextjs` uses `react-aria` and is the strongest accessibility
signal across the SWS repos.

**There is no house headless library, and that is confirmed rather than
assumed** (asked of SWS, 2026-09-01). `react-aria`, `@base-ui/react`, MUI and
headlessui are all in use across SWS repos, and no choice has been made between
them. Pick one per project rather than mixing.

That absence is worth understanding rather than filling in. This is the layer
where accessibility is usually won or lost, so with no house choice to lean on,
**the guidance in this project is the control** — which is a large part of why it
exists. When you pick a library, judge it on keyboard behaviour, focus
management, and announced state, and say which of those you checked. Do not
declare a house standard on the org's behalf; that is not an agent's call.

## Naming and composition

**Class composition:** `cnbuilder` on Astro and Storyblok projects, pinned at
`^3.1.0` across seven SWS repos. The decoupled Drupal family uses `clsx` plus
`tailwind-merge`. Both are legitimate conventions; pick one per project, not per
file. See [`decanter.md`](decanter.md).

**Styling:** tokens from Decanter, never hardcoded hex. Never remove a focus
outline without replacing it with something better — that is the single most
common regression in a redesign.

**Icons:** Heroicons.

## Motion

Entry motion belongs to the block, not the component: wrap it at the call site
with `data-animate` (or `AnimateInView`) rather than baking an animation into
every component. That keeps the set of motions on a site finite and lets a
reviewer see it in one place.

State motion — hover, focus, active, open — belongs in the component's CSS, is
capped at 200ms, and must not move layout. See [`motion.md`](motion.md).

## Hover and focus must change more than colour

**A state whose only change is a colour is not a state for a lot of readers.**
Every hover and focus state needs one cue that survives monochrome: an
underline, an outline, a border width, a weight, a shape.

For text links and buttons the answer is nearly always an underline, in whichever
direction the rest state leaves free:

| Rest state | Hover and focus |
|---|---|
| `no-underline` | `hocus:underline` |
| `underline` | `hocus:no-underline` |
| Colour change you want to keep | Keep it, and add the underline as well |
| Icon or image control, no text | `hocus:outline`, a border width, or a shape change — an underline has nothing to draw on |

`hocus:` is the Decanter variant covering hover and focus together; plain
Tailwind is `hover: focus-visible:`. Where the underline belongs on an inner
element rather than the whole control — a wordmark next to a badge, say — put
`group` on the control and `group-hover:underline group-focus:underline` on the
text.

Two things that look like cues and are not: a `filter: brightness()` shift, and
an opacity change that dims rather than reveals. Both are colour.

`sws a11y` measures this with a real mouse and a real Tab key, so it is checked
rather than reviewed: `a11y.state.hover-non-color`,
`a11y.state.focus-non-color`, `a11y.state.focus-visible`. The reasoning and the
WCAG basis are in
[`../policy/accessibility.md`](../policy/accessibility.md#state-feedback-must-not-be-colour-alone).

## Design the states, not the happy path

A component is not done when it renders the expected content. Cover:

- loading
- empty
- error
- too much content
- too little content
- the longest plausible name
- the unit that provided almost nothing

That last one is the realistic case on a Stanford unit site, and it is the one
that gets skipped. Record the inventory in `docs/design/states.md`.

## Astro-specific composition

**Default to zero JavaScript.** Astro components render to HTML with no runtime.
Only add an island when something genuinely needs interactivity, and use the
narrowest directive that works: `client:visible` over `client:load`,
`client:idle` over `client:load`.

**Content collections** for anything repeated: news, people, programs, events.
Define a schema and get type safety and validation. Hand-maintained arrays of
frontmatter drift.

`sws-astro` is the reference for config, eslint, and island composition.

## Images and fonts inside components

- Use the framework's image component for local images: dimensions, lazy loading,
  modern formats.
- **Always set width and height, or an explicit aspect ratio.** This prevents
  layout shift, and it is a component-level concern rather than a page-level one.
- Under Next static export the default image loader does not work; you need a
  custom one.
- Preload the one or two font faces above the fold, let the rest load normally.
  `font-display: swap` unless you have a reason.

## What to look for in review

The list that catches most of what actually goes wrong:

1. The `div` that should be a `button`.
2. A hardcoded Stanford hex.
3. A removed focus outline, or a hover state that is only a colour change.
4. An island that did not need to be one.
5. An image without dimensions.
6. A heading level chosen for its size.
7. A component that only handles the happy path.
