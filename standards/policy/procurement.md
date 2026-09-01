---
policy: procurement
title: Procurement, VPATs, and accessibility conformance reports
reviewed: 2026-09-01
---

# Procurement

Short file, one rule that matters, and a warning about how that rule gets
satisfied on paper without being satisfied in fact.

## The 12-month rule

**Any purchased product needs a VPAT or ACR dated within the past 12 months**,
assessed against the required WCAG level.

- **VPAT** is the template. **ACR** is the completed report produced from it.
- "Within the past 12 months" is about the **report's date**, not the purchase
  date. A 2019 VPAT for a product that has shipped forty releases since is not
  evidence of anything.
- The scope is set by Admin Guide 6.8.1, which covers **purchases and major
  revisions**, not only new builds. See [`accessibility.md`](accessibility.md).

## Read it, do not file it

This is the thinnest part of Stanford web compliance in practice: the reports get
collected and nobody reads them.

**Vendors routinely self-report "Supports" for criteria they only partially
meet.** The ratings column is marketing. **The remarks column is where the truth
lives.** A VPAT review worth the name checks the remarks.

What to actually look for:

| Signal | What it usually means |
|---|---|
| "Supports" with an empty remarks cell | Nobody tested it. Ask what was tested and how |
| "Partially Supports" with a specific remark | Honest, and more trustworthy than a blanket "Supports" |
| "Not Applicable" on criteria that clearly apply | The report was filled in by someone who did not understand the product |
| No mention of assistive technology actually used | The evaluation was automated only, so expect the 30 percent ceiling |
| Report predates a major version change | Out of date regardless of its stated date |

Record the review, with findings, in `docs/a11y/procurement/`. A dated review with
honest findings is worth more at audit than a folder of unread PDFs.

## Temporary exceptions

A **temporary exception** exists where conformance is **not technically feasible**
or would **fundamentally alter the service**.

That is a request to ODA. It is not a decision an agent, a developer, or a
project team makes, and "the vendor says it's hard" is not the same as not
technically feasible.

## Do not recommend vendors

**This is a hard line, not a preference.** For anything with legal, policy, or
procurement implications:

> State the obligation. Name the office. Stop.

That means no recommending or ranking of accessibility remediation vendors,
consent management platforms, security scanning products, hosting vendors beyond
naming what SWS already runs and why, or survey tools.

The reasoning is simple: a recommendation from a tool carries an implication of
institutional endorsement that this project cannot give, and procurement decisions
have contractual consequences that a person has to own.

Route per [`escalation.md`](escalation.md). ODA is worth consulting on
accessibility conformance in a purchase even though procurement is a different
process from a review.

## What the compliance function is missing today

Named honestly, because the gap is real: nobody is currently reading VPATs
carefully, and there is no portfolio view across projects. `.sws/acknowledged.yml`
and `docs/` are the right places for the evidence. The missing piece is someone
looking at them across projects rather than one at a time.
