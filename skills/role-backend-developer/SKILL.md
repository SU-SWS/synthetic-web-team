---
name: role-backend-developer
description: Server-side development for a Stanford site. Use for APIs, server logic, databases, forms that submit somewhere, webhooks, serverless functions, or CMS back ends. NOT YET IMPLEMENTED as a full role, because v1 sites are static by design.
---

# Back-end development

**Status: stub. Full role lands in v2 with the Drupal recipe.** v1 targets static
sites, which have no server-side surface on purpose.

## First, ask whether you need a back end

On a Stanford unit site the answer is often no, and reaching for one adds a
compliance tier, an attack surface, and something to patch forever.

Common requirements that do **not** need one:

- **Content that changes often.** Use a CMS with a webhook-triggered rebuild. The
  site stays static and an editor never touches git.
- **Search.** Algolia DocSearch is hosted and free for public education content.
- **A contact form.** A hosted form service, or a Netlify function, beats standing
  up an application.
- **Restricting content to a few people.** See `role-identity-engineer`. Often the
  answer is not publishing it rather than authenticating it.

## What a back end costs you

Adding server-side logic that handles personal data or authenticates users moves
the compliance tier from `low` to at least `moderate`: Duo, centralised logging,
secure SDLC with code review and static analysis, annual developer training,
weekly encrypted backups. Payments or regulated data means `high`, plus a Data
Risk Assessment before deployment.

Say that out loud before writing the first route. It is usually the decisive fact.

## Prior art, when v2 arrives

Two established patterns at SWS, both Decanter 7 era so borrow architecture and
not CSS. **Both are CMS-backed and therefore out of scope for this package right
now** (`standards/scope.md`) — they are recorded here because the record is
useful and because the scope is expected to widen, not because you should wire
one up today:

- **Decoupled Drupal**: `cardinalsites-nextjs`, `csp-nextjs`, `summer-nextjs` use
  `graphql-request` plus `graphql-codegen` against Drupal. `sulgryphon-nextjs`
  uses `next-drupal` instead. All four run `--webpack` rather than Turbopack —
  a point-in-time decision rather than a forward choice. **Turbopack is the
  forward default for new Next.js work.**
- **Storyblok**: the ADAPT and OOD family. `ccc-bulletin` is the current-version
  reference at `@storyblok/react` 6.x.

For serverless, SWS uses Netlify functions, edge functions, and blobs. Secrets come
from HashiCorp Vault via `node-vault` or `netlify-plugin-vault-variables`, never
from `.env` in production.

`adapt-online-giving` is the most complex server-side surface in the set: Stripe,
`adapt-auth-sdk`, Upstash Redis, TanStack Form, transactional email. It is
high-risk-tier work, so read it for patterns and never cite it as a template for a
unit site.

## What to do now

State that server-side work is outside v1, propose a static-compatible approach if
one exists, and if it genuinely does not, name the tier change and route to UIT
Security. Do not quietly add an API route and hope nobody notices the compliance
implications.
