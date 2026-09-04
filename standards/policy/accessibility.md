---
policy: accessibility
title: Accessibility, WCAG 2.1 AA, Siteimprove, and ODA
reviewed: 2026-09-02
---

# Accessibility

## The standard, and the wrinkle in it

**The target is WCAG 2.1 AA.**

Published Stanford policy (**Admin Guide 6.8.1**) still states WCAG **2.0 A and
AA**, and the university is moving to 2.1, which SWS has set as the working
standard. Where policy text lags the working standard, say so and date the note
rather than pretending the discrepancy does not exist.

Admin Guide 6.8.1 covers **existing content, new content, and purchases or major
revisions**. Not just new work. That scope is the part most often missed.

For context on whether a 2.1 target is obsolete: WCAG 2.0, 2.1, and 2.2 are all
simultaneously valid W3C Recommendations. 2.2 has been a Recommendation since
October 2023 and is also ISO/IEC 40500:2025. WCAG 3.0 is a Working Draft with no
firm timeline. So 2.1 AA is a current target, not a legacy one. WCAG 2.2 adds six
criteria and axe covers exactly one of them (`target-size`), which is a useful
measure of how far automation reaches.

## The 30 percent number, which is the most useful sentence here

**Automated testing catches roughly 30 percent of accessibility issues.** That is
ODA's own figure.

Say it out loud, every time. A green axe run is a **floor, not a conformance
claim**. Never describe a site as accessible on the strength of a passing test,
and never let a report imply it.

## Five signals, none sufficient alone

| Signal | When | Catches |
|---|---|---|
| **Content review in git** | Every content change | Content problems, before publish. Under this package's static-content scope every edit is a commit, so it runs the two CI signals below |
| **axe** via Playwright in CI | Every build | ~30 percent of issues in the built site |
| **State audit**, in the same `sws a11y` run | Every build | Hover and focus states that change colour and nothing else, which axe cannot see |
| **Manual checklist** | Pre-launch, and on significant change | The rest |
| **Siteimprove** | After launch, continuously | Its own criteria, site-wide |

**On the `sa11y` row that used to head that table.** `sa11y` is a
**content-author** tool, not a developer tool, and it belongs in the Visual
Editor overlay on a CMS-backed site, because content published after launch is
the accessibility risk no CI run can reach. **This package has no CMS** — see
`standards/scope.md` — so content arrives through git and CI reaches all of it.
The tool returns when a CMS does.

That is a genuine improvement, and it is also the smaller of the two limits.
The 30 percent ceiling above is untouched by it.

## Siteimprove and axe are not comparable

This causes recurring confusion, so be precise.

Siteimprove runs **Alfa**, its own ACT-rules engine, not axe-core. Its
Accessibility score spans **A, AA, and AAA** plus two non-normative categories,
WAI-ARIA authoring practices and Best Practices. So AAA and best-practice
findings drag a number whose policy target is 2.1 AA.

Scoring is **proprietary and weighted**: most issues are assessed **site-wide**,
meaning one violation anywhere can cap the score, with only about 30 points
available from per-page work. It also reports **"Potential Issues"** requiring
human confirmation, a bucket with no axe equivalent, and the usual explanation
for "Siteimprove found more than axe."

Present them **side by side with distinct labels, never as one number or a
delta**. Explain that a score below 100 may be entirely AAA and best-practice
findings out of scope for the policy target. **ACT rule IDs are the only clean
join key** if the two ever need correlating.

Siteimprove **registration** is a MinWeb requirement, not an accessibility one.
See [`minweb.md`](minweb.md).

## What automation cannot see

The manual checklist is the substance of the work. Structure it around what axe
provably misses:

- **Keyboard operability end to end.** Focus order matches visual order, focus is
  always visible, nothing traps focus, modals return focus on close.
- **Screen reader pass** on key templates: landmarks, heading outline, link
  lists, announced form errors.
- **Contrast in context**, including text on images and gradients, and in every
  state: hover, focus, disabled, visited.
- **Meaning not carried by colour alone.** The hover and focus half of this is
  now measured — see [State feedback](#state-feedback-must-not-be-colour-alone)
  below — but colour used to carry meaning in charts, status badges, required
  fields, and map keys still needs a person.
- **Alt text quality.** `alt="image"` passes the presence check and fails the
  human.
- **Reflow at 320 pixels and 400 percent zoom.**
- **`prefers-reduced-motion` honoured**, meaning the static thing renders rather
  than a faster animation. And **content still visible with JavaScript
  disabled**: entry motion that ships its hidden state in the HTML makes content
  permanently invisible if the script never runs, which happened on this
  project's own site to 13 blocks. See
  [`../patterns/motion.md`](../patterns/motion.md).
- **Captions and audio description on all new video**, which Stanford policy
  requires. Not optional, not a nice-to-have.
- **Plain language and reading level**, which is cognitive accessibility. See
  [`../patterns/content.md`](../patterns/content.md).
- **Error recovery.** Can someone who makes a mistake fix it without starting
  over.

Record results in `docs/a11y/manual-checklist.md`, dated, with who did it.

## State feedback must not be colour alone

**Hover and focus states have to change something other than colour.** Adding an
underline, or removing one that is there at rest, is the fix in almost every
case: it is one class, it costs no layout, and it reads in monochrome, in Windows
High Contrast, and to anyone with a colour vision deficiency.

The basis in WCAG 2.1:

| Criterion | What it gives you |
|---|---|
| **1.4.1 Use of Color** (A), technique **G183** | Where colour identifies a control, a non-colour cue is required on **both** hover **and** focus. G183 is the technique that makes an unstyled-looking link conformant, and it is a package: 3:1 contrast against surrounding text *plus* the cue on hover *plus* the cue on focus. Two out of three is not the technique |
| **2.4.7 Focus Visible** (AA) | Focus must be visible at all. A control whose focus state changes nothing fails here, and the usual cause is a removed outline that was never replaced |
| **1.4.11 Non-text Contrast** (AA) | A focus indicator needs 3:1 against what is behind it, so a colour swap between two similar tones fails even where a cue exists |

**SWS applies the cue rule to every interactive control, not only to links that
depend on colour at rest.** That is deliberately stricter than G183 read
narrowly, for two reasons: a reader cannot tell which of your links happens to
carry an underline, and "is this link distinguishable from surrounding text"
is a judgment that changes every time the design does, so it is not a rule an
author can apply reliably or a check can measure honestly.

**This is measured, by `sws a11y`.** axe cannot see it — it audits one static
snapshot of the DOM, and a hover state does not exist in a snapshot — so a
control whose whole hover state is `hover:text-poppy-light` reads as a clean
page. The runner moves a real mouse, presses a real Tab key, and diffs computed
style, classifying each change as a colour or as a non-colour cue. Findings:
`a11y.state.hover-non-color`, `a11y.state.focus-non-color`,
`a11y.state.focus-visible`.

Found on this project's own site by a person, not a tool, which is the whole
argument for the manual checklist. Four control shapes were colour-only on
hover: the header wordmark, a bordered secondary button, the code-card copy
button, and a `<summary>`. All four were one class each.

## Two ways an automated a11y result lies to you

Both were hit for real while building this project's own harness, and both make a
report worse than no report.

**1. axe can succeed without running.** A harness here once printed
`TOTAL VIOLATIONS: 0` while axe had silently failed to load. A clean result and a
result that never happened look identical in a report. The rule that follows:
**anything that cannot run reports `unknown`, never `pass`**, and `unknown`
withholds the criterion's points rather than awarding them. `sws a11y` checks that
axe classified at least one rule before believing a clean result.

**2. Animations produce false contrast failures.** axe reads *computed* colour, so
an element captured mid-fade measures the blend against its backdrop. This
project's own site produced four `color-contrast` violations at ratios of 1.05 to
1.55, foregrounds like `#f9f9f9` on white — all false, all caused by `opacity-0`
plus a delayed `fadeInUp ... forwards`. `sws a11y` waits for animations to settle
before auditing.

**So: if you see near-white foregrounds and ratios close to 1, suspect the
harness before you suspect the design.** And treat a stale results file as no
result at all — a pass recorded against a previous build is not evidence about
this one.

## Hiding things correctly, which Decanter documented wrongly for years

A recurring and genuine confusion, now settled upstream. There are **two
different** things people mean by "hidden," and picking the wrong one is either a
silent accessibility bug or a visible layout bug.

| What you want | Use |
|---|---|
| Hidden from **everyone**, in sync with `aria-hidden="true"` | `aria-hidden:hidden` |
| **Visually** hidden, still announced by screen readers | `sr-only` |
| Visually hidden until focused — the skip link pattern | `sr-only focus:not-sr-only` |

**Decanter's `.accessibility-hidden` and `.a11y-hidden` were removed in 7.5.0**,
and the docs describing them were wrong: they were said to hide content visually
while keeping it available to screen readers. **They never did that. They hid
content from everyone.** Anything relying on them for screen-reader-only text was
already broken.

Two practical consequences:

1. **Audit before upgrading.** Removal does not break the build — elements that
   used those classes simply **become visible**. Grep templates for
   `a11y-hidden` and `accessibility-hidden`.
2. **If you wanted the screen-reader behaviour, you need `sr-only`**, not a
   rename. This is the case worth checking by hand, because the markup looks
   correct either way.

See [`../patterns/decanter.md`](../patterns/decanter.md) for the migration detail.

## Responding to a reported barrier

A defined obligation, and the first step is the one most often skipped.

1. **Acknowledge in writing to the reporter.**
2. **Copy ODA**, including the date and the issue.
3. ODA coordinates the review, fix, and timeframe.
4. If it genuinely cannot be remediated, provide **alternative access** to the
   content or function.
5. Log it in `docs/a11y/remediation-log.md`.

## The accessibility statement

Every site needs the **Accessibility** link in the Global Footer, pointing at
Stanford's barrier-reporting page. That is the requirement and it is not yours to
reword. See [`brand.md`](brand.md).

A site-specific statement on top of that is good practice. Be honest in it: name
the standard (WCAG 2.1 AA), state known limitations, give a contact, and date it.
**A statement claiming full conformance without a manual audit behind it is worse
than none.**

## Purchases

Any purchased product needs a **VPAT or ACR dated within the past 12 months**.
See [`procurement.md`](procurement.md).

## ODA, and the temporary exception

Three doors, chosen by situation, never listed. Route per
[`escalation.md`](escalation.md).

A **temporary exception** exists where conformance is not technically feasible or
would fundamentally alter the service. That is a request to ODA, not a decision
an agent makes.

## Tone

Accessibility advice fails when it moralises. Name the barrier, name who it
affects, give the fix, note the policy, move on. Someone who finds this preachy
stops listening, which helps nobody.
