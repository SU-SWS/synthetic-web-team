#!/usr/bin/env node
// The classification half of the interactive-state check, tested in isolation.
//
// WHY THIS GATE EXISTS. The browser half of that check needs Chromium and a
// built site; the judgment half is pure and is where the damage happens. It
// shipped with a real bug: fingerprint keys were `scope:property`, and a
// `::before` scope contains colons, so splitting on the first one produced a
// property name of ":before:color" that matched nothing in the colour list and
// was therefore scored as a NON-COLOUR CUE. Every pseudo-element colour change
// became a passing cue. Three real findings on this project's own site read as
// clean, and the check that exists to prevent false negatives was producing
// them.
//
// A false negative here is the worst outcome in the whole system: a false
// positive gets investigated, a clean report gets trusted. So the cases below
// are weighted towards "this must NOT be reported as a cue".

import { diffState } from '../packages/cli/src/states.mjs';

let failures = 0;
const fail = (m) => { console.log(`FAIL  ${m}`); failures++; };

// One fingerprint pair per case. Keys are `scope|property`, as the probe emits.
const CASES = [
  // ---- must be colour-only, i.e. reported --------------------------------
  ['text colour swap on the element',
    { 'self|color': 'rgb(255, 255, 255)' }, { 'self|color': 'rgb(255, 87, 51)' }, 'colour-only'],
  ['background and border colour, no cue',
    { 'self|background-color': 'rgba(0, 0, 0, 0)', 'self|border-top-color': 'rgb(100, 100, 100)' },
    { 'self|background-color': 'rgb(24, 24, 24)', 'self|border-top-color': 'rgb(255, 255, 255)' }, 'colour-only'],
  ['THE REGRESSION: colour inherited by a pseudo-element is still colour',
    { 'self|color': 'rgb(255, 255, 255)', '::before|color': 'rgb(255, 255, 255)', '::before|outline-color': 'rgb(255, 255, 255)' },
    { 'self|color': 'rgb(255, 87, 51)', '::before|color': 'rgb(255, 87, 51)', '::before|outline-color': 'rgb(255, 87, 51)' },
    'colour-only'],
  ['colour on a descendant is still colour',
    { 'kid0|color': 'rgb(1, 1, 1)', 'kid0::after|color': 'rgb(1, 1, 1)' },
    { 'kid0|color': 'rgb(2, 2, 2)', 'kid0::after|color': 'rgb(2, 2, 2)' }, 'colour-only'],
  ['box-shadow that only changes colour',
    { 'self|box-shadow': 'rgb(1, 1, 1) 0px 0px 0px 2px' },
    { 'self|box-shadow': 'rgb(9, 9, 9) 0px 0px 0px 2px' }, 'colour-only'],
  ['filter brightness is a colour change',
    { 'self|filter': 'none' }, { 'self|filter': 'brightness(1.2)' }, 'colour-only'],
  ['dimming with opacity is a colour change',
    { 'self|opacity': '1' }, { 'self|opacity': '0.7' }, 'colour-only'],
  ['gradient recoloured, same geometry',
    { 'self|background-image': 'linear-gradient(rgb(1, 1, 1), rgb(2, 2, 2))' },
    { 'self|background-image': 'linear-gradient(rgb(8, 8, 8), rgb(9, 9, 9))' }, 'colour-only'],
  ['element width alone is not a cue: a scrollbar can move it',
    { 'self|width': '100px' }, { 'self|width': '104px' }, 'no-change'],

  // ---- must be a cue, i.e. NOT reported ----------------------------------
  ['underline appearing',
    { 'self|text-decoration-line': 'none' }, { 'self|text-decoration-line': 'underline' }, 'cue'],
  ['underline being removed',
    { 'self|text-decoration-line': 'underline' }, { 'self|text-decoration-line': 'none' }, 'cue'],
  ['underline on an inner span',
    { 'kid1|text-decoration-line': 'none' }, { 'kid1|text-decoration-line': 'underline' }, 'cue'],
  ['the browser focus ring',
    { 'self|outline-style': 'none', 'self|outline-width': '0px' },
    { 'self|outline-style': 'auto', 'self|outline-width': '1px' }, 'cue'],
  ['a ring appearing, colour and all',
    { 'self|box-shadow': 'none' }, { 'self|box-shadow': 'rgb(1, 1, 1) 0px 0px 0px 2px' }, 'cue'],
  ['pseudo-element bar growing from zero width',
    { '::after|width': '0px' }, { '::after|width': '96px' }, 'cue'],
  ['pseudo-element bar revealed from opacity 0',
    { '::after|opacity': '0' }, { '::after|opacity': '1' }, 'cue'],
  ['border getting thicker',
    { 'self|border-bottom-width': '1px' }, { 'self|border-bottom-width': '3px' }, 'cue'],
  ['weight change',
    { 'self|font-weight': '400' }, { 'self|font-weight': '600' }, 'cue'],
  ['the skip link becoming visible',
    { 'self|position': 'absolute', 'self|clip-path': 'inset(50%)' },
    { 'self|position': 'static', 'self|clip-path': 'none' }, 'cue'],

  // ---- must be nothing ----------------------------------------------------
  ['identical fingerprints',
    { 'self|color': 'rgb(1, 1, 1)', 'self|text-decoration-line': 'none' },
    { 'self|color': 'rgb(1, 1, 1)', 'self|text-decoration-line': 'none' }, 'no-change'],
  ['a key only present in one fingerprint is ignored, not guessed at',
    { 'self|color': 'rgb(1, 1, 1)' },
    { 'self|color': 'rgb(1, 1, 1)', 'kid0|text-decoration-line': 'underline' }, 'no-change'],
];

for (const [name, rest, state, want] of CASES) {
  const got = diffState(rest, state);
  if (got.verdict !== want) {
    fail(`${name}: expected ${want}, got ${got.verdict}` +
      ` (cues: ${got.cues.join(', ') || 'none'}; colours: ${got.colours.join(', ') || 'none'})`);
  }
}

// A cue anywhere in the subtree wins over any number of colour changes: the
// reader does not care which element carries the underline.
const mixed = diffState(
  { 'self|color': 'rgb(1, 1, 1)', 'kid0|text-decoration-line': 'none' },
  { 'self|color': 'rgb(2, 2, 2)', 'kid0|text-decoration-line': 'underline' },
);
if (mixed.verdict !== 'cue') fail(`colour plus a cue must read as a cue, got ${mixed.verdict}`);
if (!mixed.colours.length) fail('the colour change should still be recorded alongside the cue');

console.log(`${CASES.length + 1} classification cases`);
console.log(failures ? `\n${failures} failure(s)` : '\nAll classification cases passed.');
process.exit(failures ? 1 : 0);
