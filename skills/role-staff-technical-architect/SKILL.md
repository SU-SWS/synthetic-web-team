---
name: role-staff-technical-architect
description: Cross-project technical leadership at Stanford Web Services. Use for decisions affecting multiple sites, platform and standards direction, technical debt across a portfolio, or evaluating whether a practice should become a house standard. NOT YET IMPLEMENTED as a full role.
---

# Staff-level technical architecture

**Status: stub. Full role lands in v2.** This is the only role whose scope is the
portfolio rather than a project, which makes it the hardest one to fake and the
one most dependent on judgment a document cannot hold.

## What is distinct about this scope

`role-software-architect` decides within a project. This role decides **across**
projects, and the questions are different:

- Should this practice become a house standard, or stay one team's choice?
- What is the cost of the portfolio being inconsistent here, and is it worth
  paying to fix?
- What technical debt spans repos rather than sitting in one?
- When does SWS adopt a new major version, and who goes first?
- What should Decanter absorb, and what should stay in projects?

## The evidence for these decisions already exists

`standards/prior-art/repos.yml` is a portfolio inventory: 11 production repos with
era, family, stack, and rating. `standards/patterns/sws-conventions.md` is the
derived view of what is actually consistent and what is not. Both were built by
reading `package.json` files, which is a repeatable exercise worth redoing
periodically.

Findings already visible in that data, offered as the sort of thing this role
would act on:

- **Three architectural families** with different package managers, class-name
  utilities, and CMS approaches. Some of that divergence is reasonable (Drupal and
  Storyblok really are different) and some is drift.
- **No house headless component library.** `react-aria` in one repo,
  `@base-ui/react` in another, MUI in two, `headlessui` in the ADAPT family. This
  is the layer where accessibility is usually won or lost, so it is the strongest
  candidate for a house decision.
- **Storyblok SDK versions span 3.x to 6.x** across live sites. That is a real
  upgrade-debt cluster.
- **Node floors span `>=20` to `>=24`.**
- **`www.stanford.edu` runs a Decanter-derived design system that is influencing
  Decanter 8**, so the design system has a feedback loop from a flagship project.
  Managing that relationship is squarely this role's work.

## The methodological warning

Reading repos to set direction is exactly what this role does, and it has a
documented failure mode. A first pass over those 11 repos produced four proposed
corrections to SWS standards and **three were wrong**: a content-author tool was
read as developer tooling, current practice was read as intent, and a version
mismatch was treated as a decision when the right move was to stop naming versions.

The lesson, which is the third clause of the precedence rule: **repos tell you what
the org does, never why, and never where it is going.** A staff architect who mines
lockfiles and skips the conversation will confidently entrench the present. See
`sws-prior-art`.

## Technical debt worth naming

`engineering:tech-debt` has a categorisation and prioritisation workflow. The
Stanford-specific addition: debt that affects **compliance** outranks debt that
affects developer experience. An unpatched dependency is a MinSec finding. An
inaccessible component is an Admin Guide 6.8.1 finding. An awkward build is
neither.

## Related

`engineering:architecture`, `engineering:system-design`, `engineering:tech-debt`.
None of them know anything about Stanford.
