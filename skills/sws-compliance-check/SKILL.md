---
name: sws-compliance-check
description: Run and interpret the Stanford compliance report. Use when the user asks whether a site is compliant, ready to launch, or accessible, when sws check or sws doctor output needs explaining, or when a compliance finding needs fixing or accepting.
---

# Running and reading the report

```bash
sws doctor        # friendly local report, always exits 0
sws a11y          # axe over the built routes, then hover and focus states
sws perf          # measure the performance budget, always exits 0
sws check         # the full run, used in CI
```

`sws a11y` needs `@playwright/test`, `@axe-core/playwright`, and a browser in the
project. It runs **two** measurements in one browser launch and writes
`.sws/axe-results.json` and `.sws/state-results.json`; `doctor` and `check` read
those files rather than launching a browser themselves. **Order matters: build,
`a11y`, then `check`.** If an a11y criterion reads `unknown`, the reason is in
the finding — usually it was never run, or the results predate the current build.

The second measurement is the one people have not seen before. **axe cannot see
a hover or focus state at all**, because it audits one static snapshot of the DOM
and a hover state only exists while a pointer is over the element. So a control
whose entire hover state is a colour swap passes axe and fails WCAG 1.4.1. The
state runner moves a real mouse and presses a real Tab key, then diffs computed
style and classifies each change as a colour or as a non-colour cue:

| Finding | Means |
|---|---|
| `a11y.state.hover-non-color` | A hover state changes colour and nothing else. Fix: `hover:underline`, or `hover:no-underline` where the link is underlined at rest |
| `a11y.state.focus-non-color` | Same for keyboard focus. `hocus:underline` covers both states at once |
| `a11y.state.focus-visible` | A control reached by Tab changes nothing at all on focus. Usually a removed outline |

Controls are grouped by tag and class list and measured once per distinct shape,
with the instance count reported, so "x8" means one fix in one component. Icon
and image controls are flagged too, and there the fix is an outline or a border
rather than an underline — an underline has nothing to draw on.

Findings come from the recipe's `acceptance.yml`, which is the definition of
correct for that project. Read it rather than inventing criteria.

## Result states, and one that matters more than it looks

`pass` · `fail` · `unknown` · `acknowledged` · `not_applicable`

**`unknown` is never a pass and never scores.** Any check that can fail to
execute must report it: axe needs a real browser, the footer check needs built
output, branch protection needs admin scope on the token. If a check could not
run, say so in exactly those words.

This exists because of a real failure: a harness printed `TOTAL VIOLATIONS: 0`
while axe had silently failed to load. A report that says "clean" when it means
"did not run" is worse than no report. Never present an `unknown` as good news.

## Severity

Everything is **advisory** except one thing.

`minweb.no-secrets` is the only blocking criterion in the system, because
committed credentials are the only irreversible harm and MinWeb names them
explicitly.

The message differs by context, and this matters:

- **On a pull request**, blocking stops the leak from landing.
- **On a push to `main`**, the commit is already in the remote's history.
  Blocking only prevents publishing the credential on a public website, which is
  still worth stopping. So the message must be, in this order: **rotate the
  credential now**, because blocking the deploy does not un-leak it, then clean
  the history, then push again.

A failure that only says "secret detected" teaches nothing and gets worked
around.

## How to explain findings

Group by what the person can do, not by policy chapter.

1. **Blocking launch** — the footer link set is wrong, ownership is missing,
   axe violations exist
2. **Should fix** — heading order, missing meta descriptions, contrast,
   colour-only hover and focus states
3. **Consider** — structured data, performance budget
4. **Could not check** — the `unknown` bucket, with the reason for each
5. **Accepted** — acknowledged findings, with review dates

For each finding give the specific fix and the policy behind it. "Add an alt
attribute" is fine. "Add an alt attribute; WCAG 2.1 AA and Admin Guide 6.8.1
require it, and ODA handles barrier reports" is better because it survives being
questioned by someone's manager.

Report per item, not in aggregate. "The footer is wrong" is not actionable.
"Trademarks points at `trademarks.stanford.edu`; the canonical target is Admin
Guide policy 1.5.4" is.

## Never overstate what passing means

A green run means **roughly 30 percent** of accessibility issues are absent, per
ODA's own guidance. It is a floor, not conformance. The manual WCAG 2.1 AA
checklist covers the rest, and Siteimprove applies further criteria after launch.

**Siteimprove and axe are not comparable**, and someone will ask why the two
numbers differ. Siteimprove runs its own engine (Alfa), scores AAA and
best-practice findings that are outside a 2.1 AA target, and weights most issues
site-wide. `standards/policy/accessibility.md` has the full explanation.

When reporting: present them side by side with distinct labels, **never as one
number or a delta.**

## Accepting a finding

When something cannot be fixed now, that is a supported action rather than a
workaround. Write it to `.sws/acknowledged.yml`:

```yaml
- check: a11y.contrast
  path: src/components/Legacy.astro
  reason: Vendor widget; contrast fix requested from vendor 2026-08-04
  accepted_by: sheamck@stanford.edu
  date: 2026-08-11
  review_by: 2026-11-10
```

It then moves out of the nag and into an "accepted risks" section. This is the
same shape a MinSec temporary exception takes, so the record is useful beyond
this tool. Resurface expired `review_by` dates once, kindly, without lecturing.

**Never edit `acceptance.yml` or a fragment to make a project pass.** Fragments
change when upstream changes, with a date. If a criterion genuinely seems wrong,
say so and let a person decide.

## Where the report goes

`sws check` publishes itself when it detects GitHub Actions: a **persistent "Site
health" issue** on a push to the default branch, or **one PR comment** on a pull
request. Both are updated in place rather than duplicated. `sws doctor` shows a
local "since your last run" delta from a gitignored file, which is separate from
the project trend on purpose — one person's local runs should not move the shared
number.

Publishing never fails the build. If a token or permission is missing the CLI
says so on stdout and carries on.

## Tone

The score exists to motivate, not to judge. Report the number and the trend,
name the biggest win available, and stop. Do not moralise about a low score, do
not pad a good one with warnings, and never refuse to proceed with a task
because a check failed.

Someone who finds this obstructive stops using it, and then nothing is
compliant. That tradeoff is the whole design.
