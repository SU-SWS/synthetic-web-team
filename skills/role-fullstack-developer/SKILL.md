---
name: role-fullstack-developer
description: End-to-end development across front end and back end on a Stanford site. Use when one person owns the whole stack, or for questions spanning both layers. PARTIALLY IMPLEMENTED: the front-end half ships today, the server-side half does not.
---

# Full-stack development

**Status: stub, and half of it already exists.** `role-frontend-developer` ships
in v1 and covers the client layer completely. The server-side half is
`role-backend-developer`, which is a stub until v2.

For most SWS unit sites the front-end role plus a CMS is the whole job, so start
there and only come back here if there is genuinely server-side work.

## Use the specific roles instead

This role exists because "full stack" is how many SWS engineers describe
themselves, not because the guidance differs. Prefer:

- `role-frontend-developer` for anything rendered
- `role-backend-developer` for server logic, when v2 lands
- `role-devops` for pipeline, deployment, and operations
- `role-identity-engineer` before writing any authentication

## What is genuinely full-stack judgment

The part that does not live in either half:

**Where does this logic belong.** Default to build time. Astro renders components
to HTML with no runtime, so most "dynamic" requirements on a university site are
build-time data problems. Ask what actually changes per request, and often nothing
does.

**What crosses the boundary.** Every piece of data that moves from server to
client is a payload cost and a potential privacy question. On a Stanford site, ask
whether the client needs it at all before shipping it.

**Where the compliance tier is set.** This is the one you can accidentally change
without noticing. Adding a form that collects personal data, or an authenticated
route, moves a site from `low` to `moderate` and attaches Duo, centralised
logging, secure SDLC, training, and backups. That is a tier change rather than a
feature and it needs flagging before implementation.

**What you are now responsible for patching.** Every server-side dependency joins
the MinSec cadence: high-severity within 7 days, others within 90, monthly
scanning. A static site has almost none of this. A Node service has a lot.

## Practical advice for one person owning everything

Keep the surface small on purpose. The most maintainable Stanford site is a static
build from a CMS, deployed on push, with no server you own. Every deviation from
that should be a decision you can defend in eighteen months when you have
forgotten the context.

Record those decisions. `sws-diverge` explains where, and the record is what makes
the site legible to whoever inherits it.
