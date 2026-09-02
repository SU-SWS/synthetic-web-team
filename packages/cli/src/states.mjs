// Interactive-state runner: does hover and focus feedback survive without
// colour vision?
//
// WHY THIS EXISTS AS A SEPARATE MEASUREMENT. axe-core cannot answer this. It
// audits one static snapshot of the DOM, and a hover or focus state does not
// exist in a snapshot -- it exists only while a pointer is over an element or
// the keyboard has landed on it. So `hover:text-poppy-light` with nothing else
// in the hover rule is invisible to axe and reads as a clean page, which is
// exactly the false negative this project treats as worse than a false
// positive. It was found on this project's own site by a person, not by a tool.
//
// WHAT IT CHECKS. For every interactive control, compare the computed style at
// rest against the same style under `:hover` and under keyboard `:focus`. If
// the only thing that changed is a colour, that is a finding: WCAG 2.1 SC 1.4.1
// via technique G183, which requires a non-colour cue on both hover and focus
// wherever colour distinguishes a control. If nothing changed under focus at
// all, that is SC 2.4.7. The usual fix is one class: add an underline on hover
// and focus, or remove one that is there at rest.
//
// HOW IT MEASURES. Real interaction, not simulation. `page.hover()` moves an
// actual mouse, and focus comes from actually pressing Tab, because Chromium
// only matches `:focus-visible` when focus arrived by keyboard -- calling
// `el.focus()` from script silently reads the wrong state and would report
// `focus-visible:` styles as missing. Tab traversal has a second benefit: it
// measures precisely the set of controls a keyboard user can reach.
//
// Same honesty rule as axe and perf: anything that could not be measured
// writes a status other than `ok`, and the reader in checks.mjs turns that into
// `unknown`. There is no path here that produces a clean result without the
// browser having actually reported one.

import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  serve, launchChromium, settleAnimations, revealAll, routeFor, newestMtime, writeResults,
} from './browser.mjs';

export const RESULTS_PATH = join('.sws', 'state-results.json');
export const SCHEMA = 1;

// Everything focusable, plus the things authors make clickable without making
// them focusable. The unfocusable ones still get a hover verdict, and their
// absence from the Tab order is a different (and worse) finding that the
// keyboard section of the manual checklist owns.
export const CONTROL_SELECTOR = [
  'a[href]', 'button', 'summary', 'input', 'select', 'textarea',
  '[role="button"]', '[role="link"]', '[role="tab"]', '[role="menuitem"]',
  '[tabindex]:not([tabindex="-1"])', '[contenteditable=""]', '[contenteditable="true"]',
].join(',');

// Distinct class-and-tag shapes to measure per route. In a utility-CSS project
// the class list IS the style, so one measurement per shape covers every
// instance of a component; the count of instances is reported alongside. The
// cap keeps a 200-link A-Z index from turning one route into a minute of mouse
// moves.
const MAX_SHAPES = 40;

// Hard ceiling on Tab presses. Generous enough for a long page, finite so a
// focus trap ends the loop instead of the run.
const MAX_TAB = 400;

// Longest wait for a hover or focus transition to finish. Resolves as soon as
// the transition does -- CSS transitions appear in `document.getAnimations()`
// -- so on the common case of no transition this costs nothing. It exists
// because a 200ms `transition: color` read at 0ms reports the colour it started
// from, which would make a real colour-only change look like no change at all.
const STATE_SETTLE_MS = 500;

// --------------------------------------------------------------------------
// property classification, which is the whole judgment of this check
// --------------------------------------------------------------------------
//
// A property is COLOUR if changing it alone leaves the control the same shape,
// weight, and decoration -- which is precisely the change someone with a colour
// vision deficiency, a monochrome display, or a high-contrast mode may not
// perceive. `filter` is here because the overwhelming use on a hover state is
// `brightness()` or `saturate()`, both of which are colour.
const COLOUR_PROPS = new Set([
  'color', 'background-color', 'border-top-color', 'border-right-color',
  'border-bottom-color', 'border-left-color', 'outline-color',
  'text-decoration-color', 'fill', 'stroke', 'filter', '-webkit-text-fill-color',
]);

// Properties whose value carries a colour inside a larger structure. Compared
// with colours stripped out, so `box-shadow: 0 0 0 2px red` -> `... blue` reads
// as a colour change, while `none` -> `0 0 0 2px red` reads as a ring appearing.
const COLOUR_BEARING = new Set(['box-shadow', 'text-shadow', 'background-image']);

// Everything else in the watch list below is a non-colour cue: a shape, a
// weight, a decoration, a position, or something appearing.
const WATCH = [
  ...COLOUR_PROPS, ...COLOUR_BEARING,
  'text-decoration-line', 'text-decoration-style', 'text-decoration-thickness',
  'text-underline-offset', 'outline-style', 'outline-width', 'outline-offset',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-right-radius', 'border-bottom-left-radius',
  'font-weight', 'font-style', 'letter-spacing', 'text-transform', 'font-variant-caps',
  'transform', 'scale', 'rotate', 'translate',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'visibility', 'display', 'position', 'clip-path', 'content', 'opacity',
];

const stripColours = (v) => String(v)
  .replace(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\([^()]*(?:\([^()]*\)[^()]*)*\)/g, 'C')
  .replace(/#[0-9a-f]{3,8}\b/gi, 'C');

const num = (v) => parseFloat(v);

/**
 * Classify one changed property as a colour change or a non-colour cue.
 * Returns 'colour' | 'cue' | null (null means "not a real change").
 *
 * The two special cases are the ones that decide real sites:
 *
 *   opacity   0 -> 1 is something APPEARING, which is a cue: it is how a
 *             pseudo-element underline bar is usually built. 1 -> 0.7 is
 *             dimming, which is colour. Treating all opacity as a cue would
 *             pass every "fade the text a bit" hover; treating none of it as a
 *             cue would fail the standard underline-bar pattern.
 *   width/height on a PSEUDO-ELEMENT is the same bar built the other way,
 *             `width: 0` -> `width: 100%`. On the element itself it is
 *             excluded, because an unrelated scrollbar appearing during the
 *             measurement changes widths and would fake a cue -- a false pass,
 *             which is the failure mode that matters here.
 */
function classify(prop, from, to, { pseudo }) {
  if (from === to) return null;

  if (prop === 'opacity') {
    const a = num(from), b = num(to);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 'colour';
    // Appearing or disappearing entirely.
    if ((a === 0) !== (b === 0)) return 'cue';
    return 'colour';
  }

  if (prop === 'width' || prop === 'height') return pseudo ? 'cue' : null;

  if (COLOUR_BEARING.has(prop)) {
    return stripColours(from) === stripColours(to) ? 'colour' : 'cue';
  }

  return COLOUR_PROPS.has(prop) ? 'colour' : 'cue';
}

/**
 * Diff two fingerprints. Keys are `scope|property`, where scope is `self`,
 * `::before`, `::after`, `kidN`, or `kidN::after` -- so the pseudo-element rule
 * above can be applied from the key alone.
 */
export function diffState(rest, state) {
  const colours = [];
  const cues = [];
  for (const key of Object.keys(state)) {
    if (!(key in rest)) continue;
    const cut = key.indexOf('|');
    const scope = key.slice(0, cut);
    const prop = key.slice(cut + 1);
    const verdict = classify(prop, rest[key], state[key], { pseudo: scope.includes('::') });
    if (verdict === 'cue') cues.push(`${scope} ${prop}`);
    else if (verdict === 'colour') colours.push(`${scope} ${prop}`);
  }
  return {
    changed: cues.length > 0 || colours.length > 0,
    // A cue anywhere in the control's own subtree is enough. `group-hover:` and
    // `hover:*:` put the underline on a descendant, and a reader does not care
    // which element carries it.
    cues, colours,
    verdict: cues.length ? 'cue' : (colours.length ? 'colour-only' : 'no-change'),
  };
}

// --------------------------------------------------------------------------
// in-page helpers
// --------------------------------------------------------------------------
//
// Installed once per page, then called by index. Written as one string-passed
// function because `page.evaluate` serialises the callback and closures do not
// travel with it.

function installProbe(cfg) {
  const { watch, selector, maxShapes, pseudoExtra } = cfg;

  const styleOf = (el, pseudo) => {
    const cs = getComputedStyle(el, pseudo || undefined);
    const out = {};
    const props = pseudo ? [...watch, ...pseudoExtra] : watch;
    // `|` and not `:` -- a `::before` scope contains colons, and splitting on
    // the first one yielded an empty scope and a property name of
    // ":before:color", which matched nothing in the colour list and therefore
    // scored every pseudo-element colour change as a non-colour CUE. That is a
    // false pass, the exact failure mode this check exists to prevent, and it
    // hid three real findings on this project's own site until the inventory
    // printed the cue it thought it had found.
    for (const p of props) out[`${pseudo || 'self'}|${p}`] = cs.getPropertyValue(p);
    return out;
  };

  // The control, its two pseudo-elements, and a bounded number of descendants.
  // Descendants matter because the underline is frequently on an inner span,
  // and the pseudo-elements matter because it is frequently on `::after`.
  const fingerprint = (el) => {
    const out = { ...styleOf(el, null), ...styleOf(el, '::before'), ...styleOf(el, '::after') };
    const kids = [...el.querySelectorAll('*')].slice(0, 8);
    kids.forEach((kid, i) => {
      const cs = getComputedStyle(kid);
      for (const p of watch) out[`kid${i}|${p}`] = cs.getPropertyValue(p);
      for (const pseudo of ['::before', '::after']) {
        const ps = getComputedStyle(kid, pseudo);
        for (const p of [...watch, ...pseudoExtra]) out[`kid${i}${pseudo}|${p}`] = ps.getPropertyValue(p);
      }
    });
    return out;
  };

  // Short, stable, human-readable path. Long enough to find the element in a
  // template, short enough to print in a terminal report.
  const path = (el) => {
    const parts = [];
    for (let n = el; n && n.nodeType === 1 && parts.length < 4; n = n.parentElement) {
      if (n.id) { parts.unshift(`#${n.id}`); break; }
      const tag = n.tagName.toLowerCase();
      const sibs = n.parentElement ? [...n.parentElement.children].filter((c) => c.tagName === n.tagName) : [];
      parts.unshift(sibs.length > 1 ? `${tag}:nth-of-type(${sibs.indexOf(n) + 1})` : tag);
    }
    return parts.join(' > ');
  };

  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    return !el.closest('[aria-hidden="true"]');
  };

  const kindOf = (el) => {
    const tag = el.tagName.toLowerCase();
    const role = (el.getAttribute('role') || '').toLowerCase();
    if (tag === 'a' || role === 'link') return 'link';
    if (tag === 'button' || role === 'button' || (tag === 'input' && /^(submit|button|reset|image)$/i.test(el.type))) return 'button';
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return 'field';
    if (tag === 'summary') return 'disclosure';
    return role || tag;
  };

  // The state-variant classes on the element, e.g. `hover:text-poppy-light`.
  // In a utility-CSS project this is usually the entire fix, so put it in the
  // report rather than making someone open the template to find it.
  const stateClasses = (el) => (el.getAttribute('class') || '').split(/\s+/)
    .filter((c) => /^(?:[a-z0-9-]+:)*(?:hover|focus|focus-visible|hocus|active|group-hover|group-focus)[:-]/.test(c))
    .slice(0, 6);

  const controls = [];
  const shapes = new Map();
  let skipped = 0;

  for (const el of document.querySelectorAll(selector)) {
    if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') continue;
    if (!visible(el)) continue;

    const cls = (el.getAttribute('class') || '').trim().replace(/\s+/g, ' ');
    const shape = `${el.tagName.toLowerCase()}|${el.getAttribute('role') || ''}|${cls}`;

    if (shapes.has(shape)) { shapes.get(shape).occurrences += 1; continue; }
    if (shapes.size >= maxShapes) { skipped += 1; continue; }

    const idx = controls.length;
    el.setAttribute('data-sws-state', String(idx));
    const label = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
    const entry = {
      idx,
      shape,
      target: path(el),
      label: label.slice(0, 48),
      kind: kindOf(el),
      // No text means the fix is not an underline: an icon or image control
      // needs a border, ring, or shape change instead. Worth carrying into the
      // report so the advice is not wrong for a logo link.
      graphic: !label,
      classes: stateClasses(el),
      occurrences: 1,
    };
    shapes.set(shape, entry);
    controls.push(entry);
  }

  window.__swsStates = {
    controls,
    skipped,
    at: (idx) => document.querySelector(`[data-sws-state="${idx}"]`),
    fingerprint: (idx) => {
      const el = window.__swsStates.at(idx);
      return el ? fingerprint(el) : null;
    },
    // Read back which pseudo-classes actually applied at read time. This is the
    // guard that keeps the check honest: a "no cue" verdict is only reported
    // when the browser confirms the state was really active, and a control that
    // is hovered while being measured for focus is reported as inconclusive
    // rather than as a finding.
    stateOf: (idx) => {
      const el = window.__swsStates.at(idx);
      if (!el) return null;
      const m = (s) => { try { return el.matches(s); } catch { return false; } };
      return { hover: m(':hover'), focus: m(':focus'), focusVisible: m(':focus-visible') };
    },
    activeIdx: () => {
      const a = document.activeElement;
      if (!a || a === document.body || a === document.documentElement) return null;
      const own = a.getAttribute('data-sws-state');
      if (own !== null) return Number(own);
      // Focus landed inside a control we tagged (a link wrapping a span, say).
      const owner = a.closest('[data-sws-state]');
      return owner ? Number(owner.getAttribute('data-sws-state')) : -1;
    },
    blur: () => document.activeElement && document.activeElement.blur && document.activeElement.blur(),
  };

  return { controls, skipped };
}

// --------------------------------------------------------------------------
// one route
// --------------------------------------------------------------------------

async function measureRoute({ page, origin, route }) {
  const resp = await page.goto(`${origin}${route}`, { waitUntil: 'load', timeout: 30_000 });
  if (!resp || !resp.ok()) throw new Error(`HTTP ${resp ? resp.status() : 'no response'}`);

  // Same two steps, same order, and the same reasons as the axe runner: entry
  // motion holds below-fold content at `opacity: 0` until it is scrolled into
  // view, and an unsettled animation is read mid-fade. An `opacity: 0` control
  // is skipped as invisible, so without the scroll this check would silently
  // measure only what is above the fold.
  await revealAll(page);
  await settleAnimations(page);

  const { controls, skipped } = await page.evaluate(installProbe, {
    watch: WATCH, selector: CONTROL_SELECTOR, maxShapes: MAX_SHAPES,
    pseudoExtra: ['width', 'height'],
  });

  const rests = new Map();
  for (const c of controls) {
    const rest = await page.evaluate((i) => window.__swsStates.fingerprint(i), c.idx);
    if (rest) rests.set(c.idx, rest);
  }

  // ---- focus, by actually pressing Tab ------------------------------------
  //
  // Before the mouse has moved, so nothing is hovered and the two states
  // cannot be confused. Chromium only matches `:focus-visible` for
  // keyboard-driven focus, which is why this is a Tab loop and not a series of
  // `el.focus()` calls.
  const focus = new Map();
  let reached = 0;
  await page.evaluate(() => { window.__swsStates.blur(); window.scrollTo(0, 0); });
  let first = null;
  for (let press = 0; press < MAX_TAB; press++) {
    await page.keyboard.press('Tab');
    const idx = await page.evaluate(() => window.__swsStates.activeIdx());
    if (idx === null) break;           // focus left the document: end of the order
    if (idx === -1) continue;          // focusable, but not a control we track
    reached += 1;
    first ??= idx;
    // Landing on the first control again means the Tab order wrapped.
    if (focus.has(idx)) { if (idx === first && press > 0) break; continue; }
    await settleAnimations(page, STATE_SETTLE_MS);
    const [fp, st] = await Promise.all([
      page.evaluate((i) => window.__swsStates.fingerprint(i), idx),
      page.evaluate((i) => window.__swsStates.stateOf(i), idx),
    ]);
    focus.set(idx, { fp, st });
  }

  // ---- hover, by actually moving the mouse -------------------------------
  const hover = new Map();
  await page.evaluate(() => window.__swsStates.blur());
  for (const c of controls) {
    try {
      await page.hover(`[data-sws-state="${c.idx}"]`, { timeout: 2000 });
    } catch (err) {
      // Covered by a sticky header, moving under the pointer, or not reachable
      // by a mouse at all -- the visually hidden skip link is the standard
      // example, and it is the one control on this project's own site that
      // lands here. Not a finding either way: it is unmeasured, and it says so.
      hover.set(c.idx, { fp: null, st: null, why: err.message.split('\n')[0].slice(0, 120) });
      continue;
    }
    await settleAnimations(page, STATE_SETTLE_MS);
    const [fp, st] = await Promise.all([
      page.evaluate((i) => window.__swsStates.fingerprint(i), c.idx),
      page.evaluate((i) => window.__swsStates.stateOf(i), c.idx),
    ]);
    hover.set(c.idx, { fp, st });
  }

  // ---- verdicts -----------------------------------------------------------
  const findings = [];
  const counts = {
    controls: controls.length,
    instances: controls.reduce((a, c) => a + c.occurrences, 0),
    focusReached: focus.size,
    hoverColourOnly: 0,
    focusColourOnly: 0,
    focusNoChange: 0,
    inconclusive: 0,
  };

  // Every measured shape, with its verdict, whether or not it is a finding.
  // The findings list alone is not auditable: "one hover problem" gives no way
  // to tell a clean control from one the mouse never reached, and that
  // distinction is the whole difference between a pass and an unknown.
  const inventory = [];

  const record = (c, state, verdict, d) => {
    findings.push({
      state,
      verdict,
      target: c.target,
      label: c.label,
      kind: c.kind,
      graphic: c.graphic,
      // Only the classes for the state being reported. A hover finding that
      // lists four `focus-visible:` utilities alongside the one hover utility
      // buries the fix in the noise, and the terminal line was 300 characters.
      classes: c.classes.filter((cls) => (state === 'hover'
        ? /(?:^|:)(?:hover|hocus|group-hover)[:-]/.test(cls)
        : /(?:^|:)(?:focus|focus-visible|hocus|group-focus)[:-]/.test(cls))).slice(0, 3),
      occurrences: c.occurrences,
      changed: verdict === 'colour-only' ? d.colours.slice(0, 4) : [],
    });
  };

  for (const c of controls) {
    const entry = {
      target: c.target, label: c.label, kind: c.kind, occurrences: c.occurrences,
      classes: c.classes, hover: 'unmeasured', focus: 'unreached',
    };
    inventory.push(entry);

    const rest = rests.get(c.idx);
    if (!rest) { counts.inconclusive += 1; continue; }

    const h = hover.get(c.idx);
    if (h?.fp && h.st?.hover && !h.st.focusVisible) {
      const d = diffState(rest, h.fp);
      // No hover state at all is not a finding here. Hover feedback is not
      // required by WCAG; what is required is that when it exists, the cue is
      // not colour alone -- and for a control identified by colour, that a cue
      // exists on hover AND focus. The focus half is checked below, and it is
      // the half that is actually mandatory.
      entry.hover = d.verdict;
      // Which cue was found, capped. Without this the inventory says "cue" and
      // gives a reviewer no way to tell a real underline from an artefact of
      // the measurement, which is the one thing that would let this check fool
      // itself into a false pass.
      entry.hoverCue = d.cues.slice(0, 3);
      if (d.verdict === 'colour-only') { counts.hoverColourOnly += 1; record(c, 'hover', 'colour-only', d); }
    } else {
      // The mouse could not be put over it, or `:hover` did not apply when it
      // was read. Unmeasured, not clean.
      counts.inconclusive += 1;
      entry.hover = 'unmeasured';
      if (h?.why) entry.hoverWhy = h.why;
    }

    const f = focus.get(c.idx);
    if (f?.fp && f.st?.focus) {
      const d = diffState(rest, f.fp);
      entry.focus = d.verdict;
      entry.focusCue = d.cues.slice(0, 3);
      entry.focusVisible = f.st.focusVisible === true;
      if (d.verdict === 'colour-only') { counts.focusColourOnly += 1; record(c, 'focus', 'colour-only', d); }
      else if (d.verdict === 'no-change') { counts.focusNoChange += 1; record(c, 'focus', 'no-change', d); }
    }
  }

  return {
    route, controls: controls.length, shapesSkipped: skipped,
    counts, findings, inventory, focusReached: reached,
  };
}

// --------------------------------------------------------------------------
// the run
// --------------------------------------------------------------------------

/**
 * Measure hover and focus state on every built route. Always resolves; never
 * throws. `status` is `ok` only when every route was really measured.
 */
export async function runStates({ root, dist, html }) {
  const started = new Date().toISOString();
  const bail = (status, detail) => writeResults(root, RESULTS_PATH, {
    schema: SCHEMA, status, detail, generated: started, routes: [],
  });

  if (!dist || !existsSync(dist)) return bail('no-build', 'no build output found; run the build first');
  if (!html.length) {
    return bail('no-build', `no HTML found in ${relative(root, dist) || dist}; run the build first`);
  }

  const { browser, playwrightPkg, error } = await launchChromium(root);
  if (error) {
    return bail(/Playwright package/.test(error) ? 'deps-missing' : 'browser-unavailable', error);
  }

  const srv = await serve(dist);
  const routes = [];

  try {
    const context = await browser.newContext();
    for (const file of html) {
      const route = routeFor(dist, file);
      const page = await context.newPage();
      try {
        const r = await measureRoute({ page, origin: srv.origin, route });
        routes.push({ ...r, file: relative(root, file), status: 'ok' });
      } catch (err) {
        routes.push({ route, file: relative(root, file), status: 'error', error: err.message });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close().catch(() => {});
    await srv.stop();
  }

  const failed = routes.filter((r) => r.status !== 'ok');
  const sum = (k) => routes.reduce((a, r) => a + (r.counts?.[k] ?? 0), 0);

  return writeResults(root, RESULTS_PATH, {
    schema: SCHEMA,
    status: failed.length === 0 ? 'ok' : (failed.length === routes.length ? 'error' : 'partial'),
    detail: failed.length ? `${failed.length} of ${routes.length} route(s) could not be measured` : undefined,
    generated: started,
    finished: new Date().toISOString(),
    distMtime: newestMtime(dist),
    criteria: ['WCAG 2.1 SC 1.4.1 (G183)', 'WCAG 2.1 SC 2.4.7'],
    versions: { playwright: playwrightPkg, browser: browser.version() },
    totals: {
      routes: routes.length,
      controls: sum('controls'),
      instances: sum('instances'),
      hoverColourOnly: sum('hoverColourOnly'),
      focusColourOnly: sum('focusColourOnly'),
      focusNoChange: sum('focusNoChange'),
      inconclusive: sum('inconclusive'),
    },
    routes,
  });
}
