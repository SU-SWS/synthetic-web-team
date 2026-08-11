---
name: role-qa-engineer
description: Test strategy and quality assurance for a Stanford site. Use for test planning, exploratory and manual testing, regression strategy, cross-browser and device coverage, or deciding what is worth automating. PARTIALLY IMPLEMENTED: the automated harness ships today, test strategy does not.
---

# Quality assurance

**Status: stub, and deliberately so.** The automated part already ships in
`role-devops`: Playwright plus `@axe-core/playwright` against every built route.
What is missing is the judgment part, which is the part that actually needs a
person.

## What already runs

- Playwright with axe on every route, asserting WCAG 2.1 AA tags
- Build verification
- 47 acceptance criteria per recipe
- Link checking and a post-deploy sweep
- A weekly recipe canary that generates a project from scratch and checks it

Playwright is the forward default. Three SWS repos run Cypress with e2e and
component testing (`adapt-stanford-homesite`, `adapt-directory`, `ccc-bulletin`),
and `ccc-bulletin` adds BackstopJS visual regression. **Never convert an existing
Cypress suite.**

## Two rules that matter more than coverage

**A check that cannot run must report `unknown`, never `pass`.** This is not
hypothetical here: a harness in this project once printed `TOTAL VIOLATIONS: 0`
while axe had silently failed to load. A report that says "clean" when it means
"did not run" is worse than no report. axe needs a real browser; the footer check
needs built output.

**Every acceptance criterion must map to an implemented check.** A criterion with
no check is a wish. Delete it or implement it. This is a useful forcing function
on what is worth requiring at all.

## What is not automated, and mostly cannot be

This is the real content of the missing role:

- **Exploratory testing.** Someone using the site with intent, trying to break it.
  Finds more than any suite on a small site.
- **The ~70 percent of accessibility issues** automation cannot see. Keyboard
  operability end to end, screen reader sense-making, alt text quality, focus
  order, error recovery. Owned by `role-accessibility-lead`.
- **Content correctness.** Is the deadline right, is the tuition figure current,
  does the form actually reach someone. No tool knows.
- **Real device testing.** Emulation is not a phone.
- **Cross-browser** beyond the one Chromium the CI runs.
- **The states nobody designed**: empty, too much content, longest plausible name,
  the unit that provided almost nothing.

## Proportionality, because this is a static site

Do not build a test pyramid for a twelve-page department site. The honest advice
for most SWS unit sites:

1. The automated a11y and build checks that already ship.
2. A short **manual pre-launch pass**: click every nav item, submit every form,
   check every external link, view on one real phone.
3. Exploratory testing by someone who did not build it.

Unit tests earn their place when there is logic worth testing. On a content site
there usually is not, and writing them anyway produces a suite people delete.

## What a real test plan would add

Risk-based prioritisation: what fails, how likely, how bad, and therefore what
gets attention. Plus regression scope on change, browser and device matrix tied to
actual analytics rather than a generic list, and an agreed definition of done.

`adapt-stanford-homesite` is the reference for testing rigour at flagship scale:
Storybook with the a11y addon, Cypress e2e and component, Jest, MSW mocking. Read
it for what thorough looks like, not as a shopping list. This project deliberately
ships no component workshop.

Full role lands in v2, prioritised by pilot demand.
