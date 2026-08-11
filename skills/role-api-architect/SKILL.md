---
name: role-api-architect
description: API design and integration for Stanford systems. Use when designing an API, consuming a Stanford data source, or integrating with MaIS Registry, Workgroup, or other university APIs. NOT YET IMPLEMENTED as a full role, but the Stanford integration facts are here.
---

# API architecture

**Status: stub. Full role lands in v2.** v1 sites consume data at build time and
expose no APIs.

## Stanford APIs, which is the part worth knowing now

**MaIS Registry APIs** cover Account, CourseClass, Person, Privilege and
Authority, Student, and Workgroup. Two things surprise people:

- **Authentication is x509 mutual TLS**, not an API key and not OAuth. You submit
  a CSR to the MaIS Certificate Manager and the resulting certificate is added as
  a workgroup admin for access.
- **Access requires data-owner approval** plus an intake ticket. This has a lead
  time measured in weeks, not hours, so it belongs in discovery rather than in
  the build.

**Workgroup API 2.0** is JSON, at `workgroupsvc.stanford.edu/workgroups/2.0/`
with a UAT equivalent. This is how Stanford authorisation actually works: you ask
whether someone is in a workgroup rather than maintaining your own list. There is
also an AWS API Gateway variant.

Person data from these APIs is almost certainly **Moderate or High risk**, which
changes the compliance tier of anything that stores it. Consuming an API is not a
neutral technical decision.

## Prefer build-time consumption

On a static Stanford site, fetch at build and commit nothing sensitive. This
avoids credentials in the browser, avoids a runtime dependency on a university
service being up, and keeps the compliance tier low.

The pattern that works: build-time fetch, webhook or scheduled rebuild for
freshness. `adapt-directory` shows a more involved version, turning an OpenAPI
spec into TypeScript types and enum options via a codegen pipeline, plus a mock
server for local development when the upstream API is unavailable. That mock
server pattern is worth stealing.

## If you are designing an API rather than consuming one

That is squarely v2 and probably not a website project. Two notes for now:

- Stanford has an established authorisation primitive in workgroups. Do not invent
  a parallel permission model.
- Secrets belong in HashiCorp Vault, which is the SWS norm, not in environment
  files.

For general API design judgment, the `engineering:architecture` and
`engineering:system-design` skills cover ADRs and service boundaries without
Stanford specifics.

## What to do now

Name the mutual-TLS requirement and the approval lead time early, because both
routinely surprise people and both can delay a launch. Propose build-time
consumption. Route data access requests through the proper intake per
`standards/policy/escalation.md`, noting those routes still need confirming.

Do not store person data because it was easy to fetch. Ask what the site actually
needs to display.
