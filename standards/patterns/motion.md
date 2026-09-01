# Motion

**Decanter has no motion guidance.** It ships tokens for colour, type, spacing
and `transition-duration`, and stops there — so every Stanford site invents its
own, and most invent badly. This file is the missing layer.

Reference implementation: **[sws-astro](https://github.com/SU-SWS/sws-astro)**
([live](https://sws-astro.netlify.app/)), whose `AnimateInView` component is the
house pattern. Design values come from the University Communications homesite
motion guidelines. Everything measured below was measured on this project's own
docs site, which is built to this file.

## The shape of good motion here

Four properties, and they are not stylistic preferences:

1. **On viewport entry, not on load.** Animating below-fold content at load
   means it finishes before anyone scrolls to it — motion spent where nobody is
   looking, and a page that is already over by the time you arrive.
2. **Once.** Replaying every time an element scrolls past turns a page into a
   slideshow and makes re-reading actively unpleasant.
3. **Staggered when several things arrive together.** A row of four cards
   appearing simultaneously reads as a flicker. Offset them and it reads as a
   sequence.
4. **Short.** 500ms for the movement, 150ms between staggered siblings. Motion
   is the punctuation, not the sentence.

## Do not animate the first screenful

The hero is already in the viewport when the page loads, so an entry animation
there delays the one thing the reader came for — and the `h1` is usually the LCP
element, so you are animating your own Largest Contentful Paint.

Start motion below the fold. This project's docs site has a completely static
hero and animates from the first section down.

## Values

From the homesite motion guidelines. Use these before inventing your own.

| Motion | Property | Duration | Easing |
|---|---|---|---|
| **Card / block entry** | `scale` 95% → 100% | 500ms | `cubic-bezier(0.80, 0, 0.20, 1)` |
| Text and image inside it | `opacity` 0 → 100% | 167ms, delayed 500ms | `cubic-bezier(0.33, 0, 0.67, 1)` |
| Image container reveal | `border-radius` 220px → 0 | 500ms | `cubic-bezier(0.05, 0, 0, 1)` |
| **Skeleton pulse** | `opacity` 100% → 25% → 100% | 1500ms each way | `cubic-bezier(0.40, 0, 0.20, 1)` |
| **Sequential reveal** | stagger between siblings | 150ms | — |

The reference component simplifies this to one duration (500ms) and `easeOut`,
which is `cubic-bezier(0, 0, 0.2, 1)`. That is a reasonable default; reach for
the table when a specific composition needs it.

**Stagger increments of 150ms, and cap the total.** Four cards at 150ms means
the last starts at 450ms, which is fine. Twelve cards means the last starts at
1.65s, by which time the reader has scrolled past it. Above roughly six
siblings, stagger in groups or drop the stagger.

### The variant set

Keep the number of distinct motions on a site finite and reviewable. The
reference implementation ships seven, which is enough:

`fadeIn` · `zoomIn` (scale 0.6) · `sharpen` (blur 20px → 0) ·
`slideInFromLeft` / `slideInFromRight` (x ±100) · `slideUp` / `slideDown`
(y ±80) · plus `none`.

`slideUp` is the default and should stay the default. Distances are modest on
purpose: 80px reads as arrival, 400px reads as a stunt.

## Only animate `transform` and `opacity`

Both are composited, so they do not trigger layout or paint. Animating
`width`, `height`, `top`, `margin` or `padding` forces reflow on every frame and
janks on the hardware a lot of campus actually uses.

This applies to hover too. `hover:pl-40` on a card reflows its neighbours —
that is jitter, not feedback. **Hover motion is affordance: a 200ms colour or
shadow change, and nothing that moves layout.** Avoid `transition: all`, which
animates properties you did not think about.

## Reduced motion is an exit, not a shorter animation

`prefers-reduced-motion: reduce` means *render the static thing*. Not faster,
not smaller — absent.

Two layers, because they cover different failures:

```css
/* 1. The hidden starting state applies only when motion is welcome. */
@media (prefers-reduced-motion: no-preference) {
  .js [data-animate] { opacity: 0; transform: translateY(80px); }
}

/* 2. Backstop for CSS transitions and anything third-party that forgets. */
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Do not forget `scroll-behavior`.** A smooth-scrolled anchor jump is motion,
and it is the one people most often leave in.

In the React component the equivalent is `useReducedMotion()` returning the
plain element — no motion wrapper, no transform, and no hydration cost for
someone who asked not to be animated at.

## The failure that matters most: content that never appears

**If the hidden state ships in the HTML and the JavaScript does not run, the
content is gone.** Not degraded — invisible, with no indication anything is
missing.

This is not hypothetical. The React reference component renders its initial
state server-side, so every animated block ships as
`style="opacity:0;transform:translateY(80px)"`. Measured on this project's docs
site before the fix: **13 blocks, including entire sections, permanently
invisible with JavaScript disabled.**

The fix is to make the hidden state conditional on JavaScript being present:

```html
<!-- In <head>, before first paint, so it cannot flash. -->
<script>document.documentElement.classList.add('js');</script>
```

and scope the hidden rule to `.js` as above. If the script never runs, nothing
is ever hidden.

A `<noscript><style>` override also works and is better than nothing, but it
only covers *disabled* JavaScript. A script error later on the page leaves
JavaScript enabled and your content hidden, and `<noscript>` will not fire.
Prefer the class.

## Two implementations, and the cost of each

Both use **[`motion`](https://motion.dev)** (formerly framer-motion), which is
the SWS choice. What differs is whether you pay for React.

### Vanilla — default for an Astro site

`motion`'s main entry exports `animate`, `inView`, `stagger`, `scroll` with no
React at all. One small script, initial state in CSS:

```ts
import { animate, inView } from 'motion';

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  for (const el of document.querySelectorAll<HTMLElement>('[data-animate]')) {
    let stop: () => void;
    stop = inView(el, () => {
      animate(el, { opacity: 1, y: 0 }, {
        duration: 0.5,
        ease: [0, 0, 0.2, 1],
        delay: Number(el.dataset.animateDelay ?? 0),
      });
      stop?.();                       // once
    }, { amount: 0.15 });
  }
}
```

Markup opts in with `data-animate` and `data-animate-delay="0.15"`.

### React — when the project already has React

`AnimateInView` from sws-astro: `motion/react` plus `LazyMotion` with
`domAnimation` so the runtime is code-split, `useInView(ref, { once })`,
`useReducedMotion()`, and a `variants` map. Used with `client:visible` so the
island does not hydrate until needed. Read that component rather than
reimplementing it.

### The measurement

Both approaches on the same page, same animations, measured with `sws perf`:

| | JavaScript | Verdict |
|---|---|---|
| `motion/react` + React 19 island | **266.7 KB** | Breaches the 150 KB js budget |
| Vanilla `motion` | **60.4 KB** | Within budget |

**77% less JavaScript for identical motion.** React accounted for almost all of
it: 184 KB of runtime plus 8 KB of glue, to fade in some text.

So: **if React is already in the project, use the component.** sws-astro is
React-based and its choice is right for it. If the only reason you would add
React is the animation, use the vanilla API. A `role-frontend-developer` rule
applies directly here — *no client-side framework for static content* — and 267
KB to animate a documentation page is exactly what it is warning about.

## What not to build

- **Infinite or looping animation** on anything decorative. Under WCAG 2.2.2,
  motion lasting more than five seconds needs a mechanism to pause, stop or
  hide it. A looping background is a compliance obligation you did not need.
- **Parallax and scroll-jacking.** Both reliably cause nausea for people with
  vestibular disorders, and scroll-jacking breaks the scrollbar as a position
  indicator.
- **Animation that delays content.** A spinner in front of text that is already
  in the HTML is a worse experience than the text.
- **Motion that moves focus.** If an element animates away from where it was
  when focused, keyboard users lose their place.
- **Animating a hash target.** Landing on `#install` should put you at
  `#install`, not somewhere en route to it.
- **Autoplaying video as decoration.** Different problem, same instinct.
  Captions and audio description are required on new video regardless — see
  [`../policy/accessibility.md`](../policy/accessibility.md).

## Skeleton loading

A skeleton is a placeholder for content that genuinely cannot arrive quickly —
a large dataset, a slow upstream API. It reduces *perceived* load time by
showing the shape of what is coming.

Pulse `opacity` 100% → 25% → 100%, 1500ms each direction,
`cubic-bezier(0.40, 0, 0.20, 1)`.

**Do not use one for content you already have.** On a static Stanford site the
HTML arrives with the content in it, so a skeleton is a fake delay. And a
looping pulse is exactly the >5s motion WCAG 2.2.2 asks you to be able to stop,
so if it can run indefinitely, it needs a way out.

Mark it `aria-hidden="true"` and give the live region a real status, or a screen
reader announces a wall of nothing.

## Testing: two things automation gets wrong

Both were found building this file's own reference site, and both are handled by
`sws a11y` and `sws perf`. If you write your own harness, handle them.

**1. axe skips invisible content, so entry motion creates a blind spot.**
Below-fold elements sit at `opacity: 0` until scrolled to, and axe correctly
treats an invisible element as not applicable — so it audits nothing inside
them. Measured here: **116 rule-nodes unscrolled versus 145 scrolled.** Thirteen
blocks silently unaudited, reported as a clean pass. A false negative in an
accessibility check is worse than a false positive, because a false positive
gets investigated.

**2. Mid-animation elements produce false contrast failures.** axe reads
*computed* colour, so an element captured part-way through a fade reports the
blend against its backdrop. This site once produced four `color-contrast`
violations at ratios of 1.05 to 1.55 — foregrounds like `#f9f9f9` on white — all
false, all caused by measuring at 2% opacity.

So the order is: **scroll the whole page, then wait for animations to settle,
then audit.** Scrolling is what starts the animations that then need to finish.

A related trap for performance measurement: lazily hydrated islands do not
request their JavaScript until they approach the viewport, so measuring only the
initial load reports the page as if that code did not exist. Here that was 52.9
KB reported against 319.6 KB actual.

## The manual check

Automation cannot tell you whether motion is *good*, only whether it is present.
On the pre-launch checklist:

- Set `prefers-reduced-motion` in the OS and reload. Is everything readable,
  with no movement?
- Disable JavaScript and reload. Is all content visible?
- Tab through the page. Does anything animate away from a focused element?
- Read the page twice. Does the motion get annoying the second time?
- Watch it on a slow device, not a development machine.
