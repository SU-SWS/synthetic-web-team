---
policy: minpriv
title: Privacy, MinPriv, cookies, and the Data Risk Assessment
reviewed: 2026-09-01
---

# Privacy

Stanford's policy name is **MinPriv**. This file also covers the cookie question
and the Data Risk Assessment, because in practice people meet all three at once.

## Do not build a cookie consent banner

**No consent banner is required at Stanford.** This is settled, and the guidance
actively says not to add one.

The disclosure obligation is satisfied by the **Privacy link in the Stanford
Global Footer**, whose upstream title is literally "Privacy and cookie policy."
The Cookie Policy lives centrally on `www.stanford.edu`; individual sites do not
restate it.

Two consequences worth stating explicitly:

- **A hand-rolled banner is worse than none**, because it implies a consent
  mechanism that does not exist behind it.
- **No consent vendor is centrally licensed**, so there is nothing to recommend.
  If a unit has a genuine need for consent tooling, that is a conversation with
  the University Privacy Office, and the choice gets recorded in
  `.sws/manifest.yml` under `privacy.consent_tooling` with the reason.

The `privacy.consent-tooling-declared` check exists for exactly that case: it
does not ban consent tooling, it flags tooling nobody declared.

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
