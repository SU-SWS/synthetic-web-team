---
name: sws-diverge
description: Leave the preferred Stanford Web Services stack deliberately and correctly. Use when the user wants a different framework, CMS, host, or library than the recipe specifies, when they push back on a standard, or when a recipe's default does not fit their situation.
---

# Diverging on purpose

The standards are defaults, not a cage. Deviating is supported and expected.
Your job is to make divergence a **documented decision** rather than either a
refusal or a silent drift.

Three failure modes to avoid, in order of how annoying they are:

1. **Refusing.** "The standard says Astro" is not an answer. The person has
   context you do not.
2. **Silently abandoning the standards.** Switching framework and quietly
   dropping the footer check, the a11y target, and the ownership requirement
   along with it.
3. **Relitigating.** Re-raising a divergence that is already recorded in the
   manifest, every session.

## What to do

**1. Find the swap point.** Every recipe has a table of supported deviations
with the cost of each. Read it and quote the cost plainly. If the swap is listed,
this is a two-minute conversation, not a negotiation.

**2. Separate what changes from what does not.** This is the important part.
Most divergences change the *implementation* and change nothing about the
*obligations*. Moving from GitHub Pages to Netlify does not alter the HTTPS
requirement, the footer, the accessibility target, the named owners, or
Siteimprove registration. Say which obligations survive, explicitly, because
that is exactly what gets lost.

**3. Name what stops being automatic.** Some divergences move a requirement from
"handled by the recipe" to "yours to satisfy." Dropping Decanter means the
Identity Bar and Global Footer become hand-maintained while every brand and a11y
check still applies, with nothing helping you pass them. That is usually the
decisive fact.

**4. Record it.** In `.sws/manifest.yml`:

```yaml
divergences:
  - from: astro-static
    changed: Next.js instead of Astro
    reason: Team maintains three other Next apps and shares components
    cost_accepted: >
      Static export forfeits redirects, headers, and image optimization
    date: 2026-08-11
    by: sheamck@stanford.edu
```

The record is what lets the next person understand the project, and it is what
stops `sws doctor` nagging about a choice already made deliberately.

**5. Say when a swap is genuinely unsupported.** Not everything is a preference.
Tailwind 3 with Decanter 8 does not work, because Decanter 8 requires Tailwind 4.
That is a fact, not a standard, and the honest answer is that the combination
will not build.

## Divergences that are not divergences

Do not record these, and do not treat them as departures:

- **Using yarn instead of npm.** Both are in production use at SWS. Respect what
  the project has and never convert it.
- **Cypress instead of Playwright** on a project that already has Cypress.
  Playwright is the forward default for new work, not a migration mandate.
- **`clsx` plus `tailwind-merge` instead of `cnbuilder`.** Both are house
  conventions, split by project family.
- **Installing Decanter from the git v8 branch.** Two SWS projects do; it is
  valid.
- **Copy-forking a previous client site to start a new one.** This is how SWS
  works and it works. `csp-nextjs` was made from `cardinalsites-nextjs`
  deliberately. Add a way to see what has changed since; do not frame the fork
  as a mistake.

## Requests that are out of scope rather than divergent

**A CMS is the live example.** `standards/scope.md` scopes this package to
static content authored in the repo, and it has no tested CMS path — not
Storyblok, not decoupled Drupal.

That is **not a divergence you can record and move on from.** A divergence is
choosing something different to build the same thing with; this is asking for a
capability the package does not ship. Recording `divergences: [storyblok]` in
the manifest would imply a supported swap point exists, and it does not.

So handle it differently:

- **Say plainly that it is not covered yet.** Eleven SWS repos are CMS-backed in
  production, so the capability exists in the org. There is just no tested
  recipe here, and saying so beats shipping guidance nobody has run.
- **Ask what they actually need.** Often it is "a non-developer must edit the
  copy," which GitHub web UI editing already handles for one or two people.
- **If they need a real CMS**, that is a legitimate project. Point them at
  Stanford Sites if they will maintain the site alone, or raise it as scope for
  a `*-storyblok` overlay. Do not build half a content backend to avoid the
  conversation.
- **Out of scope is not forbidden.** Do not tell anyone they cannot have a CMS,
  and do not imply the existing SWS CMS work is wrong.

## Divergences that change the compliance tier

Different category, and these are not yours to wave through. If a divergence
introduces personal data collection, authentication, or payments, the site moves
from `low` to `moderate` or `high` risk. New obligations attach: Duo, centralised
logging, secure SDLC, backups, possibly a Data Risk Assessment before deploy.

Flag it as a tier change rather than a feature, name the obligations, and point
at the right office per `standards/policy/escalation.md`. You are not the
approver.

## What never bends

Divergence does not reach these, because they are policy rather than preference:

- WCAG 2.1 AA as the target
- The Global Footer contract and the Identity Bar
- Named business owner and technical administrator
- HTTPS with a live certificate
- No committed credentials
- Siteimprove registration for public-facing sites
- Subdomain naming approved by University Communications

A person can still choose not to satisfy one of these. That is what
`.sws/acknowledged.yml` is for: a dated, attributed, reasoned risk acceptance
with a review date, which is the same shape a MinSec temporary exception takes.
It is a supported action. It is not the same as the requirement going away, and
the report keeps showing it under accepted risks.
