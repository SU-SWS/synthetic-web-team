---
policy: minweb
title: MinWeb, the minimum standard for Stanford websites
reviewed: 2026-09-01
---

# MinWeb

The baseline every Stanford website has to meet. Short, unglamorous, and the
source of most launch-blocking surprises, because the items with lead times are
approvals rather than code.

## Scope, which is wider than people assume

MinWeb applies to **every `stanford.edu` site, plus Stanford-branded `.org` and
`.com` sites**. Moving off the primary domain does not shed the standards.
`sup.org` is the live example.

It also reaches hosted site builders. MinWeb explicitly notes that platforms
like Wix and Squarespace **shift the vulnerability and accessibility burden onto
the site owner** rather than removing it. Worth naming when someone proposes one
as the easy option.

## The requirements

| Requirement | Detail | Mechanism |
|---|---|---|
| **Named business owner** | Valid Stanford affiliation and email, discoverable on the site | `minweb.ownership`, read from `.sws/manifest.yml` and the rendered page |
| **Named technical administrator** | Same | Same criterion |
| **MFA, or SSO with MFA, on all administrative logins** | Every admin login, no exceptions | Manual attestation on the launch checklist |
| **HTTPS with a live certificate** | UIT runs an SSL service | Deploy configuration plus a post-deploy check |
| **No API keys or credentials in Git** | The one irreversible harm in the whole standard | `minweb.no-secrets`, **the only blocking check in this system** |
| **Subdomain reflects the recognised unit name** | Approved by University Communications. Vanity URLs are not permitted for personal pages | Manual, and it has a lead time |
| **Stanford Global Footer, exact** | Immutable link set and order | `footer.*`, against `standards/fragments/global-footer.yml` |
| **Accessibility barrier-reporting link** | The Accessibility link in the Global Footer | Part of the footer contract |
| **Siteimprove registration** | Required for public-facing sites, through its own intake. **Google Analytics is not required** | Recorded in `.sws/manifest.yml`, nagged post-deploy |
| **DNS audits** | Dangling CNAMEs are a subdomain-takeover risk | Manual, part of secure sunset |

Two of these routinely surprise people, so say them plainly:

1. **Siteimprove is required and Google Analytics is not.** This inverts the
   usual assumption, and analytics carries privacy obligations of its own. See
   [`privacy.md`](privacy.md).
2. **A subdomain name is not yours to approve.** You can advise on a name.
   University Communications approves it. Raise it during discovery, not the week
   before launch, and route per [`escalation.md`](escalation.md).

## Secrets: why this is the only gate

Everything in this project is advisory except committed credentials, because
that is the only finding where the harm cannot be undone by fixing it later.

The message has to change with the context, and getting this wrong is how a gate
gets worked around:

- **On a pull request**, blocking stops the leak from landing.
- **On a push to `main`**, the commit is already in the remote's history.
  Blocking only prevents publishing the credential on a public website, which is
  a real second exposure and worth stopping. But the useful order is: **rotate
  the credential now**, because blocking the deploy does not un-leak it, then
  clean the history, then push again.

"Secret detected" on its own teaches nothing.

In practice SWS handles this institutionally: secrets live in HashiCorp Vault,
not `.env` files, via `netlify-plugin-vault-variables` in the Storyblok family
and `node-vault` in the decoupled Drupal family. That makes the secrets check a
backstop rather than the primary control, which is a good position to be in and
does not make the check redundant.

## Secure sunset

The step everyone forgets, and it is a MinWeb-adjacent obligation rather than
housekeeping. When a site retires: remove DNS, revoke credentials, archive or
delete content, and kill dangling CNAME records.

Ask for a sunset plan at the start of any campaign or event site, not at the end.
A dangling CNAME pointing at a decommissioned service is a subdomain takeover
waiting to happen.

## What this file does not cover

- Patch cadence, scanning, and inventory: [`minsec.md`](minsec.md)
- WCAG conformance and ODA: [`accessibility.md`](accessibility.md)
- Transparency notices and cookies: [`privacy.md`](privacy.md)
- Footer and Identity Bar specifics: [`brand.md`](brand.md)
- Which office, and which door: [`escalation.md`](escalation.md)
