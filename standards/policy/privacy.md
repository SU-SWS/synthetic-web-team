---
policy: minpriv
title: Privacy, MinPriv, cookies, and the Data Risk Assessment
reviewed: 2026-09-01
---

# Privacy

Stanford's policy name is **MinPriv**. This file also covers the cookie question
and the Data Risk Assessment, because in practice people meet all three at once.

## No cookie consent banner is required

**And that is the whole claim. Not required is not the same as forbidden.**

The disclosure obligation is satisfied by the **Privacy link in the Stanford
Global Footer**, whose upstream title is literally "Privacy and cookie policy."
The Cookie Policy lives centrally on `www.stanford.edu`; individual sites do not
restate it.

So a banner is never the default, and a site without one is fully compliant.

**A developer may still add one.** Units have reasons this project cannot see: an
analytics posture, a European audience, a decision taken above them. Nothing here
prohibits it, and an agent that tells someone they cannot have a cookie banner is
interpreting policy on the university's behalf, which the escalation rules
explicitly forbid.

What to say instead, if someone adds one:

- **It is a deliberate addition, so write it down.** Record it in
  `.sws/manifest.yml` under `privacy.consent_tooling` with the reason. Both
  consent checks pass once it is declared, and neither blocks anything.
- **It is now yours to keep accessible.** A banner is a focus trap, a contrast
  surface and a keyboard target that nobody upstream maintains for you.
- **The vendor question is not ours.** No consent vendor is centrally licensed,
  so do not evaluate or rank them. Send it to the University Privacy Office.

Two checks cover this and both are advisory: `privacy.consent-ui-declared` for
markup written in the repo, and `privacy.consent-tooling-declared` for a
third-party package. Each flags an **undeclared** choice, never the choice
itself.

## MinPriv: transparency before collection

**A transparency notice is required before collection.** Any form needs to say,
in plain language and *before* the reader fills it in:

- what is collected,
- why,
- and what happens to it.

Plus **purpose limitation**: data collected for one stated purpose is not
repurposed silently.

This applies to research too. A survey collecting anything personal needs a
transparency notice, purpose limitation, and appropriate storage. Introducing a
third-party survey tool may trigger a DRA.

**Ask for the minimum.** Every field on a form is a MinPriv question about why
you need it. See [`../patterns/forms.md`](../patterns/forms.md).

## Analytics is a privacy decision

Two Stanford specifics that invert the usual assumption:

1. **Siteimprove registration is required. Google Analytics is not.**
2. Because MinPriv requires a transparency notice before collection, "add GA4" is
   **a choice with obligations attached**, not a default.

Write the measurement plan during discovery, when it can still change what gets
built. See [`minweb.md`](minweb.md) for the Siteimprove requirement itself.

## The Data Risk Assessment

A **DRA is required before deploy** when the site collects personal information
or introduces third-party services, and unconditionally at `high` tier. See
[`minsec.md`](minsec.md) for the tiers.

The triggers, concretely:

- Personal information is collected or displayed.
- A new third-party service is introduced.
- Regulated data or payments are involved.
- Authentication is added, which is itself a tier change.

DRA has a lead time and it is a pre-deploy gate, so it belongs in discovery. A
**Privacy and Security consult** is recommended pre-launch at `moderate` tier and
above.

**To find the third parties a site actually contacts, run `sws perf`.** It lists
every third-party origin the built pages request, which is the concrete input to
this question and is easy to be wrong about from memory. A font CDN counts. This
project's own docs site turned out to contact two Google Fonts origins for 157 KB,
which nobody had decided — it is Decanter's default, since Decanter ships no font
assets. Self-hosting fonts removes the origin and is usually faster.

Route per [`escalation.md`](escalation.md). The DRA route there is still marked as
needing confirmation, so use the general contact and say that is what you are
doing rather than inventing a door.

## Required content that is not yours to reword

- The **Privacy** link in the Global Footer. Immutable.
- The **Accessibility** link in the Global Footer. Immutable.
- Both are byte-exact in `standards/fragments/global-footer.yml`. See
  [`brand.md`](brand.md).

## The line

An agent can explain what MinPriv requires, draft a transparency notice, and flag
a DRA trigger. It **cannot** decide that a DRA is unnecessary, approve a data
collection, or interpret privacy policy on the university's behalf. State the
obligation, name the office, stop.
