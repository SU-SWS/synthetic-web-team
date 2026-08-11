---
name: sws-prior-art
description: Consult existing Stanford Web Services work before building something new. Use at the start of any build task, when choosing an information architecture or content model, when picking a library, or when the user asks "have we done this before" or "how do we usually do this".
---

# Prior art

SWS has built a lot of Stanford sites. Most of what a new site needs is solved
somewhere. Reinventing it produces worse work slower.

Your job here is to find the relevant precedent, **label what kind of evidence
it is**, and hand back something the person can act on. Not to conclude.

## The precedence rule, all three clauses

Read these before reporting anything. Applying only the first clause is the
most common way to get this wrong.

**1. Dated execution is drift. Standards win.**
A repo on Decanter 7 and Tailwind 3 is not a CSS reference. A repo on Next 13 is
not a framework reference. Take the problem shape, leave the implementation.

**2. Repeated identical choices are a convention. Adopt them.**
`cnbuilder ^3.1.0` pinned across seven repos is knowledge, not drift. When
production repos consistently agree with each other and disagree with our
standards, our standards are probably wrong.

The test: *is this repo doing something old, or is the org doing something
consistently?* One repo on Decanter 7 is dated. Nine repos avoiding a tool we
recommend is a signal about the tool.

**3. Prior art cannot tell you why, or where the org is going.**
Repos record decisions already executed. Intent lives only in people's heads.

This clause was learned expensively. A first inspection pass produced four
proposed corrections to our standards and **three were wrong**:

- `sa11y` in five repos looked like a developer tooling convention. It is a
  **content-author** tool used in Visual Editor overlays. The data said *what*
  and a *why* was invented.
- Cypress in three repos and Playwright in zero looked decisive. SWS is moving
  to Playwright. The right answer was invisible to the analysis by construction.
- `sws-astro` on an older Astro major looked like a constraint to adopt. The
  real answer was to stop naming versions at all.

## Obligations

1. **Never infer purpose from presence.** If a dependency's role is not obvious
   from how it is used, say "five repos include X, purpose unconfirmed."
2. **Never present current practice as intent.** "Three repos use Cypress" is a
   fact. "SWS standardises on Cypress" is a claim about a decision.
3. **Watch for questions to dissolve rather than answer.** If prior art and
   standards disagree on a version, first ask whether the version needed
   specifying.
4. **End with a check, not a conclusion.** Label each finding as fact or
   inference and let the person confirm.
5. **Correlations are traps.** `sa11y` correlated perfectly with Storyblok,
   five for five and six for six. That pattern was the answer; the count was
   not. When a dependency correlates tightly with another, it probably belongs
   to that dependency's domain.
6. **Absence is often a decision.** `www.stanford.edu` has no `decanter`
   dependency. That is a deliberate architecture (a derived design system), not
   an oversight. Ask before calling a gap a gap.

## Lookup order

```
1. standards/prior-art/patterns/INDEX.md   distilled, fastest, has judgment
2. .sws/prior-art.local.yml                the user's own disk, free, private
3. standards/prior-art/repos.yml           11 inspected source repos
4. standards/prior-art/catalog.yml         17 live exemplars + tools
5. live GitHub org search                  uncurated fallback
6. nothing found                           say so plainly
```

Step 6 matters. "No prior art found" is a legitimate and common answer. A tool
that always finds something is a tool that is sometimes wrong without saying so.

## Reference types, and what each is good for

**Source repos** (`repos.yml`) have readable code, so `era` is verified. Check
the `ref` field: default branches are `main` for `sws-astro`, `dev` for the
ADAPT and OOD family, and `1.x` for the decoupled Drupal repos. A pointer
without an explicit ref silently reads the wrong branch.

**Live exemplars** (`catalog.yml`) are URLs with no public source for most.
Authoritative for rendered page furniture, IA, content patterns, and a real
shipped accessibility baseline. Useless for build config, versions, or component
source. A rendered page gives no signal about which Decanter era produced it, so
clause 1 applies at full strength.

**Local scan** is the user's own disk. Highest signal, zero curation, never
transmitted. Metadata only.

## Lineage, which is not the same as era

`era` implies a straight line where newer is better. That breaks on the first
important repo.

| Lineage | Meaning | How to use it |
|---|---|---|
| Consumer | Installs Decanter at some version | Era applies normally |
| Derived | Own system, descended from Decanter | Brand furniture authoritative. Tokens and CSS are a **parallel vocabulary** |
| Upstream | Feeding patterns back into Decanter | A preview of direction. Adopt ideas, not implementations |

`www.stanford.edu` is derived **and** upstream at once. The specific trap:
copying CSS from a derived system into a Decanter project produces something
that **looks approximately right and does not use the design system**. It passes
visual review and fails every token check, and the failure is invisible in a
screenshot.

## Copy-forking is legitimate

`cardinalsites-nextjs` and `csp-nextjs` are intentional sibling instances: two
clients, one copied from the other. `relationship: sibling-instance` is a
**recognised pattern**, not a finding. Report it as context, never as drift.

Copy-forking a previous client site is the existing, working solution to reuse
at SWS. It is fast and carries decisions no document captured. What it cannot do
is tell you what has moved since. Recipes are the diff a fork cannot give you.
Never frame a fork as a mistake.

## Reporting format

```
Found: <what>, in <repo/site> (<ref>), era <era>, rated <rating>
Use it for: <specific thing>
Do not use it for: <specific thing, usually CSS or versions>
Confidence: fact | inference
```

Then record what was actually reused in `.sws/manifest.yml` under `prior_art`,
so the next person can trace where a pattern came from.

Full detail in `standards/prior-art/README.md`. The record of the four
corrections, kept deliberately as a record of error, is in
`standards/patterns/sws-conventions.md`.
