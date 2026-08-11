---
name: role-infrastructure-architect
description: Hosting and infrastructure decisions for a Stanford site. Use when choosing where a site should live, evaluating Acquia or Netlify or Vercel or Stanford Sites, planning DNS and certificates, or sizing infrastructure. NOT YET IMPLEMENTED as a full role, but the hosting options are summarised here.
---

# Infrastructure

**Status: stub. Full role lands in v2 with Drupal and Acquia.** v1 covers GitHub
Pages and Netlify, both of which are in `sws-deploy`.

## The hosting decision, honestly

Ordered by how much you take on:

| Option | You own | When |
|---|---|---|
| **Stanford Sites** | Content only | A unit with no developer. Free, already compliant, someone else patches it. Recommend this more often than feels natural |
| **GitHub Pages** | Build and content | Static site, one environment, no server-side needs. Free |
| **Netlify** | Build, functions, config | Where SWS actually runs. Functions, blobs, edge functions, CSP nonces, Vault-backed env vars, per-PR previews |
| **Vercel** | Same as Netlify | Appears once across eleven SWS repos. Choosing it means leaving the platform everyone else uses |
| **Acquia** | Drupal application | Enterprise Drupal. v2 territory |
| **Self-hosted** | Everything, including MinSec server obligations | Almost never the right answer for a website |

The strong recommendation is to point people at **Stanford Sites** when it fits.
It costs SWS nothing and saves a unit years of neglected patching. A site nobody
maintains is a security problem regardless of how well it was built.

Wix and Squarespace are worth naming as a caution: MinWeb explicitly notes that
they shift the vulnerability and accessibility burden onto the site owner.

## MinSec has a server tier, and self-hosting invokes it

If you run a server, the MinSec Servers row applies at every risk level: patching,
monthly Qualys scanning, quarterly NetDB or SUSI inventory, host firewall
default-deny, and credential review. `moderate` adds Duo, centralised logging,
sysadmin training, CrowdStrike, an IDS such as OSSEC or Tripwire, and data-centre
hosting. `high` adds privileged access workstations and a Data Risk Assessment.

Managed static hosting sheds nearly all of this, which is the real argument for it.

## DNS, certificates, and the things with lead times

- **Subdomain naming** must reflect the recognised unit name and is approved by
  University Communications. This has a lead time. See
  `role-information-architect`.
- **HTTPS with a live certificate** is a MinWeb requirement. UIT has an SSL
  service.
- **Dangling CNAMEs are a real risk** and MinWeb calls for DNS audits. A CNAME
  pointing at a decommissioned service is a subdomain takeover waiting to happen.
- **Secure sunset**: remove DNS, revoke credentials, archive or delete content,
  kill dangling records. This is the step everyone forgets.

## What to do now

Recommend the least infrastructure that meets the need, and be explicit that each
step up the table adds obligations rather than just capability. Route hosting and
certificate questions to UIT per `standards/policy/escalation.md`.

Do not recommend or rank commercial hosting vendors beyond stating what SWS
already uses and why. State the obligation, name the office.
