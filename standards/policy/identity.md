---
policy: identity
title: Authentication and authorisation at Stanford
reviewed: 2026-09-01
---

# Identity, authentication, authorisation

**v1 static sites have no authenticated surface by design.** This file exists
because improvising Stanford authentication is one of the few places where
getting it wrong has consequences beyond a bad website.

The full role lands in v2. Read this before writing any auth code.

## "Add a login" is a tier change, not a feature

Adding authentication moves the site from `low` to at least `moderate`, which
attaches: Duo for all users and admins, centralised logging to Splunk, secure
SDLC with code review and static analysis, annual developer training, and weekly
encrypted backups. Regulated data takes it to `high`, adding a privileged access
workstation and a Data Risk Assessment before deployment.

See [`minsec.md`](minsec.md) for the full tier table and
[`privacy.md`](privacy.md) for the DRA.

So: flag the tier change, name the obligations, and route to UIT Security. Do not
let a login arrive as a checkbox.

## What is actually true at Stanford

Verified as of August 2026.

| Fact | Detail |
|---|---|
| **SAML 2.0 is the primary recommended path** | Stanford's SSO service is **Weblogin**, implemented on Shibboleth. Registration is self-service through SPDB. Typical stack is a Shibboleth SP with Apache. `weblogin-auth-sdk` is the SDK that wraps this — see below |
| **WebAuth is archived legacy** | Do not build against it |
| **OIDC is supported** | Same Shibboleth IdP. Discovery at `https://login.stanford.edu/.well-known/openid-configuration` |
| **Duo two-step is required** | For all applications |
| **Authorisation is workgroup-based** | Workgroup Manager and Workgroup API 2.0 (JSON). Ask whether someone is in a workgroup; do not maintain your own user list |
| **MaIS Registry APIs use x509 mutual TLS** | CSR submitted to the MaIS Certificate Manager, plus data-owner approval |

### The OIDC constraints, which are the operational traps

- **Confidential clients only.**
- **Authorization code flow only.**
- **PKCE enforced in production.**
- **User consent required** for claim release.
- **The RP secret expires yearly.** This is the one that breaks a working site
  twelve months after launch, so put it in the runbook with a date.

## Prior art

`cardinalsites-nextjs` (the `1.x` branch) is the **only SAML implementation
across the SWS repos**: `passport-saml`, `xml-encryption`, `jose`, plus
`node-vault` for secrets. It is the reference for this work.

Its era is **Decanter 7**, so borrow the auth patterns and not the CSS. The
precedence rule applies with full force: see `standards/prior-art/README.md`.

### Which auth SDK, which was an open question and is now answered

**Answered by SWS, 2026-09-01.** Both are SAML libraries, and they are not
interchangeable:

| Package | Use it for |
|---|---|
| **`weblogin-auth-sdk`** | **The preferred package for everything.** Integrates with **Weblogin**, Stanford's primary SSO |
| `adapt-auth-sdk` | **Alumni-based websites only.** Not the general path |

`adapt-auth-sdk` appears at `^1.0.20` and `^2.1.0` in `adapt-directory` and
`adapt-online-giving`, neither of which is an alumni site in the obvious sense —
so **do not read those two usages as a general endorsement.** Reach for
`weblogin-auth-sdk` unless the site is specifically alumni-facing, and confirm
with SWS either way.

Neither package's npm/registry availability has been verified here; both are
understood to be internal SWS packages. Ask rather than guessing at an install
line.

## Rules

1. **Do not hand-roll session handling.**
2. **Do not store Stanford credentials.**
3. **Do not build a local user table as a shortcut.**
4. **Do not invent a parallel permission model.** Stanford has workgroups.
5. Secrets go in **HashiCorp Vault**, the SWS norm, not environment files.

## Often the right answer is no authentication

If the requirement is "only our department should see this," then a private repo,
a non-indexed path, or simply not publishing it may serve better than standing up
a service provider. Ask what the site actually needs to restrict, and to whom,
before reaching for SAML.

Route to UIT Security and the authentication service owners per
[`escalation.md`](escalation.md).
