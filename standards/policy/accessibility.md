---
policy: accessibility
title: Accessibility, WCAG 2.1 AA, Siteimprove, and ODA
reviewed: 2026-09-01
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

## Four signals, none sufficient alone

| Signal | When | Catches |
|---|---|---|
| **`sa11y`** in the CMS Visual Editor overlay | While authors edit | Content problems, before publish |
| **axe** via Playwright in CI | Every build | ~30 percent of issues in the built site |
| **Manual checklist** | Pre-launch, and on significant change | The other ~70 percent |
| **Siteimprove** | After launch, continuously | Its own criteria, site-wide |

`sa11y` is a **content-author** tool, not a developer tool. It belongs in the
Visual Editor overlay on a CMS-backed site, because content published after
launch is the accessibility risk no CI run can reach.

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
- **Meaning not carried by colour alone.**
- **Alt text quality.** `alt="image"` passes the presence check and fails the
  human.
- **Reflow at 320 pixels and 400 percent zoom.**
- **`prefers-reduced-motion` honoured.**
- **Captions and audio description on all new video**, which Stanford policy
  requires. Not optional, not a nice-to-have.
- **Plain language and reading level**, which is cognitive accessibility. See
  [`../patterns/content.md`](../patterns/content.md).
- **Error recovery.** Can someone who makes a mistake fix it without starting
  over.

Record results in `docs/a11y/manual-checklist.md`, dated, with who did it.

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
