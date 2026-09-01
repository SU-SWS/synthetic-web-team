---
name: role-identity-engineer
description: Stanford authentication and authorisation. Use when a site needs login, SSO, SAML, OIDC, Shibboleth, Duo two-step, workgroup-based permissions, or any question about restricting content to certain people. NOT YET IMPLEMENTED as a full role, but read this before writing any auth code.
---

# Identity, authentication, authorisation

**Status: stub. Full role lands in v2.** Static sites in v1 have no authenticated
surface by design.

Read this anyway before writing auth code, because improvising Stanford
authentication is one of the few places where getting it wrong has consequences
beyond a bad website.

## Do not improvise this

Adding authentication changes the **compliance tier** from `low` to at least
`moderate`, which attaches real obligations: Duo for all users and admins,
centralised logging to Splunk, secure SDLC with code review and static analysis,
annual developer training, and weekly encrypted backups. If the site touches
regulated data it goes to `high` and requires a Data Risk Assessment before
deployment plus administrative access from a privileged access workstation.

So "add a login" is never a feature. Flag it as a tier change, name the
obligations, and route to UIT Security.

## What is actually true at Stanford

The authoritative summary, including the OIDC constraints and the yearly RP
secret expiry, is `standards/policy/identity.md`. Repeated here because a stub
that makes you open another file to learn the one dangerous fact is a bad stub.

Verified as of August 2026, and worth knowing even in stub form:

- **SAML 2.0 via Shibboleth is the primary recommended path** for enterprise web
  applications. Registration is self-service through SPDB. Typical stack is a
  Shibboleth SP with Apache.
- **WebAuth is archived legacy.** Do not build against it.
- **OIDC is supported** by the same Shibboleth IdP, with real constraints:
  confidential clients only, authorization code flow only, PKCE enforced in
  production, user consent required for claim release, and the **RP secret
  expires yearly**, which is an operational trap. Discovery at
  `https://login.stanford.edu/.well-known/openid-configuration`.
- **Duo two-step is required for all applications.**
- **Authorisation is workgroup-based**, via Workgroup Manager and the Workgroup
  API 2.0 (JSON), not by maintaining your own user lists.
- **MaIS Registry APIs** use x509 mutual TLS, with a CSR submitted to the MaIS
  Certificate Manager and data-owner approval.

## Prior art that exists today

`cardinalsites-nextjs` (`1.x` branch) is the only SAML implementation across the
SWS repos: `passport-saml`, `xml-encryption`, `jose`, plus `node-vault` for
secrets. It is the reference for this work and the key input to the v2 role. Note
its era is Decanter 7, so borrow the auth patterns and not the CSS.

**Which SDK, answered 2026-09-01.** `weblogin-auth-sdk` is **the preferred
package for all Stanford auth** — SAML, integrating with **Weblogin**, the
primary SSO. `adapt-auth-sdk` is SAML too but is **for alumni-based websites
only**. It appears in `adapt-directory` and `adapt-online-giving`; do not read
those usages as a general endorsement. See `standards/policy/identity.md`.

## What to do now

1. Say that authenticated Stanford applications are outside what this project
   currently covers.
2. Name the tier change and its obligations.
3. Point at `cardinalsites-nextjs` as the working example.
4. Route to UIT Security and the authentication service owners per
   `standards/policy/escalation.md`.
5. Do not hand-roll session handling, do not store Stanford credentials, and do
   not build a local user table as a shortcut.

Also worth saying: often the right answer is not authentication at all. If the
requirement is "only our department should see this," a private repo, a
non-indexed path, or simply not publishing it may serve better than standing up
an SP.
