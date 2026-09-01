// Entry motion, without React.
//
// Same behaviour as the SWS reference component (SU-SWS/sws-astro's
// AnimateInView): animate once, on viewport entry, staggered when several
// elements arrive together. The difference is cost — see the measurement in
// standards/patterns/motion.md. This site has no other reason to ship React,
// so it does not.
//
// Contract with the markup:
//   data-animate          opt in
//   data-animate-delay    seconds, for stagger. Optional.
//
// The hidden starting state lives in CSS, not here, and is applied only when
// JavaScript is present AND the reader has not asked for reduced motion. That
// ordering is what keeps content visible when either is untrue.

import { animate, inView } from 'motion';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!REDUCED) {
  for (const el of document.querySelectorAll<HTMLElement>('[data-animate]')) {
    // `stop` is referenced inside the callback that assigns it. Safe because the
    // callback cannot fire until after `inView` returns.
    let stop: () => void;
    stop = inView(
      el,
      () => {
        animate(
          el,
          { opacity: 1, y: 0 },
          {
            duration: 0.5,
            ease: [0, 0, 0.2, 1], // easeOut, matching the reference component
            delay: Number(el.dataset.animateDelay ?? 0),
          },
        );
        // Once. Motion is arrival, not decoration: replaying on every scroll
        // past turns the page into a slideshow.
        stop?.();
      },
      { amount: 0.15 },
    );
  }
}
