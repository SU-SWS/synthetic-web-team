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

The obligations at every tier, cumulative, are in
`standards/policy/minsec.md`. That file is the canonical table and it also
covers the MinSec **Servers** row, which self-hosting invokes and which is the
real argument for managed static hosting.

The four that bite a `low`-tier static site, so you can say them without
opening the file: **patch high-severity findings within 7 days and others
within 90**, **monthly Qualys scanning**, **quarterly inventory**, and
**quarterly account and privilege review**.

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
