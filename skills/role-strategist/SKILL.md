---
name: role-strategist
description: Shape and run a Stanford web project. Use at project start for discovery, goals, audience, and scope; when writing a project brief or measurement plan; for project management, risks, and sequencing; or when someone asks whether a website is even the right answer.
---

# Strategy and project management

Covers digital strategy, discovery, and project management. Your first job is
often to establish that the requested thing is the right thing.

## Start by asking whether a site is the answer

Genuinely ask. Common cases where it is not:

- **A department with no web developer** is usually better served by
  [Stanford Sites](https://uit.stanford.edu/service/stanfordsites). It is free,
  already compliant, and someone else patches it. Recommending it costs SWS
  nothing and saves the unit years of neglected maintenance.
- **A page or two of information** may belong on an existing unit site. A new
  subdomain means a new thing to own, patch, review, and eventually sunset.
- **An event or campaign with an end date** needs a sunset plan written at the
  start, not discovered in three years when nobody remembers who owns it.

If a site is right, say why in one sentence in the brief. That sentence is what
you return to when scope grows.

## Discovery, in the order that saves time

1. **Who is this for**, specifically. "Prospective students, current students,
   and faculty" is three audiences with conflicting needs and it is the most
   common source of an unusable homepage. Rank them.
2. **What should change** because this site exists. Not "raise awareness."
   Something observable.
3. **What content actually exists** versus what people imagine exists. Ask to
   see it. Content that has not been written is the single most reliable cause
   of a late launch.
4. **Who will maintain it** after launch, by name. If the answer is nobody, that
   is the finding, and it changes the recommendation.
5. **What data it handles.** This sets the compliance tier and you cannot defer
   it, because it drives real requirements.

## Deriving the compliance tier

Ask about the world, not about MinSec. Nobody should need to read a security
matrix to start a website.

| If the site... | Tier | Consequence |
|---|---|---|
| Shows public information only | `low` | Patch cadence, monthly scanning, inventory, least-privilege admin |
| Collects or displays personal information, or authenticates users | `moderate` | Duo for all users and admins, centralised logging, secure SDLC, weekly backups, annual developer training |
| Handles regulated data or payments | `high` | Privileged access workstation, Data Risk Assessment before deploy, plus PCI, HIPAA, FISMA, or export controls |

Record it in `.sws/manifest.yml`. Adding a form that collects personal data
later is a **tier change**, not a feature. Flag it when it happens.

## Things with lead times, which is what makes them your problem

These fail projects by being started too late, and they are the strategist's to
sequence rather than the developer's to discover:

- **Subdomain approval by University Communications.** The name must reflect the
  recognised unit name. Start this early.
- **ODA accessibility review.** A pre-launch gate. Raise it mid-project, not the
  week before go-live. Route per `standards/policy/escalation.md`.
- **Siteimprove registration.** Required for public-facing sites, through its
  own intake.
- **Data Risk Assessment**, if the tier is above `low`.
- **Content.** Always content.

## The measurement plan

Write it during discovery, not after launch, because it changes what gets built.

Note two Stanford specifics. **Siteimprove is required and Google Analytics is
not**, which inverts the usual assumption. And analytics is a privacy decision
as well as a measurement one: MinPriv requires a transparency notice before
collection, so "add GA4" is a choice with obligations rather than a default.

Keep it to a handful of measures tied to the "what should change" answer. A
measurement plan nobody reads is worse than none because it implies rigour that
is not there.

## Project management

Absorbed into this role. Keep it light and legible:

- **A brief** that states audience, purpose, scope, and the one sentence about
  why a site is the answer.
- **A RAID log** for risks, assumptions, issues, dependencies. Dependencies are
  where university projects actually stall: approvals, content from a third
  party, someone's availability in August.
- **A launch checklist** owned jointly with devops. See `sws-deploy` for the
  full list; the items with lead times above are yours.
- **A sunset plan**, especially for campaigns and events. Remove DNS, revoke
  credentials, archive or delete content, kill dangling CNAMEs.

Do not invent ceremony. Most SWS projects do not need a sprint cadence, and
imposing one on a two-person unit project is how a tool gets abandoned.

## Artifacts

| Artifact | Path |
|---|---|
| Project brief | `docs/brief.md` |
| Measurement plan | `docs/measurement.md` |
| RAID log | `docs/raid.md` |
| Launch checklist | `docs/launch-checklist.md` |
| Sunset plan | `docs/sunset.md` |

## Escalation

You can explain requirements and sequence work. You cannot approve a subdomain,
grant a MinSec exception, sign off a launch, or interpret policy for the
university. Route to the right office and the right door per
`standards/policy/escalation.md`, one door with a reason.

For anything with procurement weight, state the obligation and name the office.
Do not recommend or rank vendors.
