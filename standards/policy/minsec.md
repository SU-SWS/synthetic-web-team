---
policy: minsec
title: MinSec, minimum security standards, and the risk tiers
reviewed: 2026-09-01
---

# MinSec and the compliance tier

**This file is the canonical tier table.** Skills cite it rather than restating
it, because it was previously duplicated in eight places and duplicated policy
drifts.

## The thing people get wrong

**MinSec applies to low-risk static sites.** There is no exemption for "it's
just a brochure site." A static site is not exempt from MinSec, it is merely
cheap to comply with.

## Deriving the tier

Ask about the world, not about MinSec. Nobody should have to read a security
matrix to start a website.

| If the site... | Tier |
|---|---|
| Shows public information only | `low` |
| Collects or displays personal information, or authenticates users | `moderate` |
| Handles regulated data or payments | `high` |

Record the answer and the reasoning in `.sws/manifest.yml` under `tier` and
`tier_because`.

**A tier change is not a feature.** Adding a login, a form that collects personal
data, or a payment processor moves the site up this table and attaches real
obligations. Flag it as a tier change when it happens, name the new obligations,
and do not let it land quietly.

## Obligations by tier

Each tier is **cumulative**: `moderate` carries everything in `low`.

### `low`, which is every site

- Patch **high-severity findings within 7 days**, others **within 90**, using
  NVD severity ratings, and stay on supported versions.
- **Monthly vulnerability scanning** (Qualys). Remediate severity 4 to 5 within
  7 days and severity 3 within 90.
- **Quarterly inventory** recording risk class and data volume.
- **Quarterly account and privilege review**, plus password complexity, and SUNet
  login via SAML wherever authentication exists.
- **Least-privilege administrative accounts.**
- Minimum necessary services exposed through the network firewall.

### `moderate` adds

- **Duo two-step for all users and admins.**
- **Centralised logging** to Splunk.
- **Secure SDLC**: security as a design requirement, code review, static analysis.
- **Annual SISA developer training.**
- **Weekly encrypted backups.**

### `high` adds

- **Administrative access only from a privileged access workstation.**
- **A Data Risk Assessment before deployment.** See [`privacy.md`](privacy.md).
- Whichever of **PCI DSS, HIPAA, FISMA, or export controls** applies.

## The servers tier, which self-hosting invokes

If you run a server, the MinSec **Servers** row applies at every risk level:
patching, monthly Qualys scanning, quarterly NetDB or SUSI inventory, host
firewall default-deny, and credential review. `moderate` adds Duo, centralised
logging, sysadmin training, CrowdStrike, an IDS such as OSSEC or Tripwire, and
data-centre hosting. `high` adds privileged access workstations and a DRA.

**Managed static hosting sheds nearly all of this**, which is the real argument
for it over a VM.

## What ships as code, and what does not

Automation covers less of MinSec than people expect, and being honest about the
split is the point of this section.

| Covered today | How |
|---|---|
| Part of the patch cadence | Dependabot, grouped, weekly |
| Committed credentials | The one blocking check |
| HTTPS and certificates | Deploy path |
| Secret storage | Vault, the SWS norm |

| **Not** covered, and needs a person | Why |
|---|---|
| Scanning enrolment | Lives at the infrastructure layer, not in the repo |
| The quarterly inventory | Process, not code |
| Logging pipelines | Infrastructure |
| The privilege review cadence | Process, and the one most often skipped |
| Incident response | Route to UIT Security immediately; do not improvise |

**So write the runbook.** Most of what MinSec requires at `low` tier is a
documented process and a named human. The failure mode is that nobody writes it
down and the quarterly review never happens. `docs/ops/runbook.md` should name
who patches, who reviews accounts and how often, where the inventory lives, what
happens when a scan flags something, and who to call.

## Temporary exceptions

A **MinSec temporary exception** is submitted by the Business Owner and can run
for **up to three years**. That is a request to UIT Security, not a decision an
agent or a developer makes.

Worth knowing: `.sws/acknowledged.yml` deliberately takes the same shape a
temporary exception does, with a reason, attribution, date, and `review_by`. The
record is therefore useful beyond this tool.

Route per [`escalation.md`](escalation.md), and note the security routes there are
still marked as needing confirmation.

**Do not recommend or rank security vendors or scanning products.** State the
obligation, name the office, stop.
