# Bolt-on services

**Stub, 2026-09-30.** A placeholder for the dynamic features a static site gets
from outside: forms, data, search, AI, scheduled data pulls, analytics, maps, and
access control. See `PROJECT-PLAN.md` section 13a.

## There is no approved list

**Nothing in this file is approved, recommended, or ranked.** An approved list,
and the data risk level each entry may handle, is for **UIT Security** and the
**University Privacy Office** to set. It is not ours to set. Until they publish
one, the house rule from `AGENTS.md` applies: state the obligation, name the
office, stop.

## Categories

| Need | Obligation that applies today | Approved option |
|---|---|---|
| **Forms** | Collecting personal data moves the site out of the `low` tier. A transparency notice comes before collection. See `standards/patterns/forms.md` and MinPriv | TBD |
| **Data, lightweight database** | A new third-party service handling personal data triggers a DRA. Any key in a static build is public | TBD |
| **Media** | Third-party content is outside the build, so its accessibility is not yours to control | TBD |
| **Search** | An index built from the repo at build time adds no third party. A hosted search service does | TBD |
| **AI features** | A new third-party service, usually receiving visitor input. DRA likely | TBD |
| **Scheduled data pulls** | Credentials live in Actions secrets, never in the repo. This is the one blocking check | TBD |
| **Analytics** | **Siteimprove registration is required. Google Analytics is not.** Analytics is a privacy choice | Siteimprove (required, not a bolt-on choice) |
| **Maps** | Third-party content: ask for a VPAT per `standards/policy/procurement.md` | TBD |
| **Access control** | A tier change. See the `role-identity-engineer` stub and `standards/policy/identity.md` | TBD |

## A scope collision to settle first

`standards/scope.md` says content comes from the repository. Some of these
services are a **content source** rather than a feature: a Google Sheet that
feeds the people page, or a database that feeds the resource list. That is a CMS
by another name, and the manifest records it under `content.source`. Decide
which bolt-ons are features and which are content backends **before** writing
recipes for them, or this file will widen the scope by the back door.

## What to do now, if a site needs one of these

1. Name the obligation from the table, in plain language.
2. If personal data or a new third-party service is involved, route to the DRA
   process through UIT Security, per `standards/policy/escalation.md`. One door.
3. Do not pick a vendor for them, and do not describe anything here as approved.
4. If they go ahead, record the service under `divergences:` in
   `.sws/manifest.yml` with what it handles.
