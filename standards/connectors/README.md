# Connectors

**Stub, 2026-09-30.** A connector pulls content from a canonical Stanford source,
such as events, news, or profiles, into a site, so nobody retypes or scrapes what
the university already publishes. See `PROJECT-PLAN.md` section 13a.

| Connector | Source | Platform | Status |
|---|---|---|---|
| [Events](events/CONNECTOR.md) | events.stanford.edu | Localist | Stub. Public API confirmed reachable |
| [News](news/CONNECTOR.md) | news.stanford.edu | Squiz Matrix | Stub. API not yet located |
| [Profiles](profiles/CONNECTOR.md) | cap.stanford.edu | CAP | Stub. Access not yet confirmed |

**None of these is a tested integration.** Each file says what has been checked
and what has not. An agent asked to wire one up should say that it is a stub,
use what is known, and not invent endpoints, fields, or credentials.

## The shape every connector takes

A proposal to be tested in the first real build, not a settled standard.

1. **Fetch at build time or on a schedule, never from the visitor's browser.**
   The site stays static, no key ever reaches the browser, a source outage does
   not break a page, and the accessibility checks see the content, because it is
   in the built HTML.
2. **Snapshot into the repository.** A scheduled GitHub Actions job fetches the
   source, writes a data file such as `src/data/events.json`, and commits it to
   `main`. Push to `main` deploys, so every content change is a commit that runs
   `sws a11y`. That is the same control `standards/scope.md` relies on for
   content authored in the repo. The cost is a commit from a bot on every change.
   Fetching at build time without committing is the alternative: fewer commits,
   but the content never appears in git history.
3. **Credentials live in Actions secrets.** Never in the repository and never in
   the build output. Committed credentials are the one check that blocks.
4. **Link back to the source.** Each item links to its canonical page on the
   source site. Republishing full text as if it were yours creates duplicate
   content and a second copy to keep current. The source stays authoritative.
5. **Permission belongs to the system owner.** Being able to reach an API is not
   the same as being allowed to depend on it. Confirm with whoever runs the
   source before a site relies on it. Where that owner is not known, use the
   general UIT contact and say that is what you are doing, per
   `standards/policy/escalation.md`.

## A scope question this raises

`standards/scope.md` says content comes from the repository. The snapshot
pattern keeps that true where it matters, because the content goes through git
and the checks. Whether it counts as content from the repo is a call for SWS to
make, and it should be made before the first connector moves out of stub.

## What a connector is not

- **Not an embed.** Localist and others offer JavaScript widgets that render in
  the browser. Those are third-party content whose accessibility is not yours to
  control. See `standards/patterns/bolt-ons.md`.
- **Not a CMS.** A connector reads someone else's published content. It gives
  the site no editing interface.
