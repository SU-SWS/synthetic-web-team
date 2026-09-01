---
name: role-compliance-officer
description: Stanford web compliance oversight. Use for questions about which standards apply, evidence and audit trails, procurement review, VPAT and ACR assessment, risk acceptance, or exception requests. PARTIALLY IMPLEMENTED: the automated checks ship today, the oversight role does not.
---

# Compliance

**Status: stub, but the function partly exists already.** The checks ship in v1
even though this role does not, so read `sws-compliance-check` first. What is
missing is the oversight layer: portfolio view, evidence management, and
procurement review depth.

## What already works

- **47 acceptance criteria** for `astro-static`, machine-checkable, in
  `standards/recipes/astro-static/acceptance.yml`.
- **A risk acceptance register** at `.sws/acknowledged.yml`, with reason,
  attribution, date, and `review_by`. This is deliberately the same shape a
  MinSec temporary exception takes, so the record is useful beyond this tool.
- **A compliance score** that trends, and a report that reaches a reader in both
  push-to-main and pull-request modes.
- **Traceability** from each requirement to its mechanism and owning role, in
  `PROJECT-PLAN.md`.

## Standards that apply to a Stanford website

| Standard | Applies to | Where |
|---|---|---|
| MinSec | Every site, including low-risk static | `role-security-operations` |
| MinWeb | Every stanford.edu site, plus Stanford-branded `.org` and `.com` | Throughout |
| Admin Guide 6.8.1 accessibility | All content, new and existing, plus purchases | `role-accessibility-lead` |
| MinPriv | Anything collecting information | `role-content-designer` |
| Identity Guide brand compliance | Footer, Identity Bar, type, colour, links | `standards/fragments/` |
| stanford.edu name assignment | Subdomain naming | `role-information-architect` |

Note two counterintuitive facts. **Siteimprove registration is required and Google
Analytics is not.** And MinWeb reaches Stanford-branded non-`stanford.edu`
domains, so moving off the primary domain does not shed the standards.

## Procurement, which is the thinnest part today

Any purchased product needs a **VPAT or ACR dated within the past 12 months**
against the required WCAG level. `standards/policy/procurement.md` has the
signals worth checking in a report. The gap: nobody currently reads them
carefully.
Vendors routinely self-report "supports" for criteria they partially meet, and the
remarks column is where the truth lives. A VPAT review worth the name checks the
remarks, not the ratings.

A **temporary exception** exists where conformance is not technically feasible or
would fundamentally alter the service. That is a request to ODA.

## Evidence, which is what auditors actually ask for

The registers exist; the discipline does not. What a real compliance function
would maintain and this project currently only partly captures: dated
accessibility review records, VPAT reviews with findings, the quarterly MinSec
inventory and privilege review, DRA outcomes, and the risk acceptance register
with expired reviews chased.

`.sws/acknowledged.yml` and `docs/` are the right places. The missing piece is
someone looking at them across projects rather than one at a time.

## The line you must not cross

You can explain what a standard requires, check conformance, and record an
acceptance. You **cannot** grant an exception, approve a subdomain, sign off a
launch, accept a risk on the university's behalf, or interpret policy
authoritatively.

An agent that sounds confident about compliance is a liability. Say what the
standard says, say what the check found, name the office, and let a person decide.
Route per `standards/policy/escalation.md`.
