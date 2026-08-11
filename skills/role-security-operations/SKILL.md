---
name: role-security-operations
description: Stanford security operations for a website. Use for MinSec compliance, patching cadence, vulnerability scanning, logging, incident response, or questions about what security standards apply to a site. NOT YET IMPLEMENTED as a full role, but the applicable standards are summarised here.
---

# Security operations

**Status: stub. Full role lands in v2.** The MinSec obligations that apply to a
static site are already carried by `role-devops` and `sws-deploy`; what is missing
here is the operational depth for anything above `low` risk.

## The thing people get wrong

**MinSec applies to low-risk static sites.** There is no exemption for "it's just
a brochure site." A static site is not exempt, it is just cheap to comply with.

At every tier, including `low`:

- Patch high-severity findings within **7 days**, others within **90**, using NVD
  severity ratings, and stay on supported versions.
- **Monthly vulnerability scanning** (Qualys), remediating severity 4 to 5 in 7
  days and severity 3 in 90.
- **Quarterly inventory** recording risk class and data volume.
- **Quarterly account and privilege review**, password complexity, and SUNet
  login via SAML where authentication exists.
- Minimum necessary services exposed through the network firewall.

`moderate` adds Duo for all users and admins, centralised logging to Splunk,
secure SDLC with security as a design requirement plus code review and static
analysis, annual SISA developer training, and weekly encrypted backups.

`high` adds administrative access only from a privileged access workstation, a
**Data Risk Assessment before deployment**, and whichever of PCI DSS, HIPAA,
FISMA, or export controls applies.

## What ships today without this role

Dependabot covers part of the patch cadence. The secrets gate is the one blocking
check in the system. HTTPS and certificate requirements are in the deploy path.
Vault-based secret management is the SWS norm rather than `.env` files.

What does **not** ship: scanning enrolment, the inventory process, logging
pipelines, the privilege review cadence, or incident response.

## What to do now

Write the runbook. Most of what MinSec requires at `low` tier is a documented
process and a named human rather than code, and the failure mode is that nobody
writes it down and the quarterly review never happens.

`docs/ops/runbook.md` should name: who patches, who reviews accounts and how
often, where the inventory lives, what happens when a scan flags something, and
who to call.

## Escalation

A **MinSec temporary exception** is submitted by the Business Owner and can run up
to three years. That is a request to UIT Security, not a decision you make.

For a suspected incident, do not improvise: route to UIT Security immediately.
Route per `standards/policy/escalation.md`, and note the security routes there are
still marked as needing confirmation.

Do not recommend or rank security vendors or scanning products. State the
obligation, name the office.
