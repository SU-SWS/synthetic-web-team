---
name: role-software-architect
description: Software architecture and design decisions for a Stanford web project. Use when choosing between technical approaches, defining component or service boundaries, documenting a decision and its trade-offs, or reviewing a design proposal. NOT YET IMPLEMENTED as a full role.
---

# Software architecture

**Status: stub. Full role lands in v2, prioritised by pilot demand.** Most v1
sites are static content sites where the architecture is decided by the recipe,
which is the point of having recipes.

## When this actually matters

Not often, and saying so is useful. A twelve-page department site does not need
architecture, it needs the recipe followed. Reach for this role when:

- A project spans multiple sites or shares components across them
- Content modelling is genuinely complex, with many types and relationships
- A CMS choice is being made and will be hard to reverse
- Something needs to integrate with a Stanford system
- A previous decision is being reversed and the reason has been forgotten

## Write the decision down

The one habit worth adopting even in stub form: record architectural decisions as
short ADRs in `docs/adr/NNNN-title.md`. Context, the decision, the alternatives
considered, and the consequences. Half a page.

The reason is specific to how SWS works. Sites get **copy-forked** to start new
client projects, which is a legitimate and effective practice. But a fork carries
the code and not the reasoning, so eighteen months later nobody knows why the
previous team chose Storyblok over Drupal or webpack over Turbopack. An ADR
survives the fork. The `engineering:architecture` skill has a fuller ADR workflow
if you want one.

Real example worth documenting if you encounter it: all four decoupled Drupal
repos run `next dev --webpack`, opting out of Turbopack. **Point-in-time, not
forward: Turbopack is the forward default for new Next.js sites.** Consistent
enough to be intentional, and nobody has written down why.

## Existing architectural patterns at SWS

Three families, and choosing between them is most of the architecture work on a
new project:

- **Static, no CMS.** Content in the repo. Simplest, lowest tier, fewest
  obligations.
- **Static plus Storyblok.** Content editors never touch git; publishing triggers
  a rebuild. The right answer when non-developers maintain content.
- **Decoupled Drupal.** GraphQL against Drupal, for Stanford Sites-scale content
  and existing Drupal investment.

Prefer the least machinery that meets the need. Every step up adds patching
surface, compliance obligations, and something for the next person to learn.

## The constraint people miss

Architecture decisions set the **compliance tier**. Adding authentication, personal
data, or payments is not a technical choice with a technical cost; it is a move
from `low` to `moderate` or `high` with real obligations attached. That belongs in
the ADR's consequences section, and it is often the deciding factor.

## Related

`engineering:architecture` for ADR creation and evaluation.
`engineering:system-design` for service boundaries and data modelling.
Neither knows anything about Stanford, so pair them with `standards/policy/`.
