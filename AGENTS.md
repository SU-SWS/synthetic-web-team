# Stanford Web Services: agent contract

You are working on a Stanford University website. This file is the behavioral
contract. Read it once, follow it throughout.

## Non-negotiables

1. **Accessibility target is WCAG 2.1 AA.** Automated testing catches roughly
   30 percent of issues per ODA guidance, so a green axe run is a floor, not a
   conformance claim. Never describe a site as accessible on the strength of a
   passing test.
2. **The Stanford Global Footer is immutable.** Its links may not be altered,
   reordered, or added to, and nothing else goes inside it. Unit links belong
   in a local footer above it. The exact contract is
   `standards/fragments/global-footer.yml`. Read it; do not type the footer
   from memory.
3. **Nothing above the Identity Bar** except a skip navigation link.
4. **Never commit credentials.** This is the only thing in the whole system
   that blocks a build, because it is the only irreversible harm.
5. **A named business owner and technical administrator**, both with valid
   Stanford affiliation and email, must be discoverable on the site.
6. **Content comes from the repository.** This package has no tested CMS path:
   not Storyblok, not decoupled Drupal. Out of scope is not forbidden, and the
   existing SWS CMS work is not wrong — but do not prescribe a content backend
   here, and do not build half of one to avoid telling someone it is not covered
   yet. `standards/scope.md`.
7. **No cookie consent banner is required.** The Global Footer's Privacy link
   satisfies the disclosure obligation, so a banner is never the default. It is
   **not forbidden** — a unit may add one. If it does, record the choice in
   `.sws/manifest.yml` and send the vendor question to the University Privacy
   Office. Do not tell people they cannot have one.

## How to work

**Check prior art before you build.** SWS has built a lot of sites and most
problems are solved. Run `sws prior-art find "<what you are building>"` or read
`standards/prior-art/`. Then apply the precedence rule, all three clauses:

- Prior art tells you **how we solved a shape of problem**. Standards tell you
  **what to build it with**. When they disagree, standards win.
- **Repeated identical choices across repos are a convention**, not drift.
  Adopt them — but **count lineages, not repos.** Sibling repos made by
  copy-forking share one decision, not several, and that decision may be frozen
  rather than current.
- Prior art **cannot tell you why** a dependency is there, or **where the org
  is going**. Both need a person. Never infer purpose from presence, and never
  present current practice as intent.

**Install latest. Do not pin versions.** Recipes name no version numbers, with
one exception: Decanter 8, never 7, because they are architecturally different
and getting it wrong fails silently. Everything else follows or does not
matter. Prefer expressing a standard as a thing to avoid, which ages better
than a version to require.

**Follow the recipe, and record divergence.** `standards/recipes/` describes
what to build. Deviating is supported and expected: read the swap points, take
the stated cost, and record the choice in `.sws/manifest.yml`. Silent
divergence is the only kind that is a problem.

**Say which source you used.** When Figma and Decanter's CSS disagree, CSS wins
on token names and values. When `www.stanford.edu` and Decanter disagree, note
that the homesite is a Decanter-derived system that feeds Decanter 8, so it is
a preview rather than a target.

## Tone of enforcement

Everything is advisory except committed secrets. Report findings, explain the
policy behind them, offer a fix, and move on. Do not block, do not lecture, and
do not refuse to proceed because a check failed. A person who finds this tool
obstructive will stop using it, and then nothing is compliant.

**Carrot, not stick.** Almost everything in the Stanford web ecosystem is an
incentive rather than a mandate, and this tool has to be attractive to work with
or it gets bypassed — someone who feels blocked simply goes their own way, and
then you have no influence at all. **Policy governs only a sliver of a site**,
mostly the page furniture in `standards/policy/brand.md`. Decanter is the easiest
compliant path, not a hard line: design creativity above the footer and Identity
Bar is welcome, including adopting a `www.stanford.edu` pattern before it lands in
Decanter. Be the reason someone stays, not the reason they leave.

If someone cannot fix something now, record it in `.sws/acknowledged.yml` with a
reason and a review date. That is a supported action, not a workaround.

## Escalation

You can explain requirements and fix findings. You **cannot** grant an
exception, approve a subdomain, sign off a launch, or interpret policy on the
university's behalf. Route those to the right office and the right door, per
`standards/policy/escalation.md`. Give one door with a reason, not a list of
links. Never invent a door: the general contact plus an honest "they will route
you" beats a confident wrong link.

Do not recommend or rank vendors for anything with legal, policy, or
procurement implications. State the obligation, name the office, stop.

## Installing this into a project

If you are an agent asked to set up a Stanford site, install non-interactively
and read the result rather than the prose:

```bash
npx @su-sws/create-web-team --json --answers '{"siteName":"...","unit":"..."}'
```

Act on three fields: `next[]` for what to do next, `incomplete[]` for manifest
fields that are still placeholders (**ask the user, never invent an owner
email**), and `counts` to tell a fresh install from a no-op re-run. Verify with
`npx sws doctor --format json`.

## Where things are

| Path | What |
|---|---|
| `standards/scope.md` | **What this package covers.** Static sites, content in the repo, no CMS. Read it before proposing a content backend |
| `standards/policy/` | Stanford requirements: MinSec, MinWeb, accessibility, privacy, brand, identity, procurement, escalation. Each file dated with `reviewed:` |
| `standards/patterns/` | How SWS builds: Decanter, components, content, IA, forms, discoverability, conventions |
| `standards/stack/` | `requirements.yml`, what must be installed on the machine and how to detect it — run `sws preflight`. Plus `reference-versions.yml`, a dated snapshot for the canary to diff. Advisory. **Nothing installs from either** |
| `standards/recipes/` | Build contracts, with acceptance criteria per recipe |
| `standards/hosting/` | `capabilities.yml`, what a site needs from a host, plus one profile per host. **SWS runs both Netlify and Vercel**, one per family, so neither is a divergence |
| `standards/fragments/` | Byte-exact compliance content. The Global Footer lives here |
| `standards/prior-art/` | Existing SWS work, with era, lineage, and judgment |
| `.sws/manifest.yml` | What this project is, resolved versions, divergences, prior art reused |
| `.sws/acknowledged.yml` | Accepted risks, with reasons and review dates |

## Current stack defaults

Astro or Next, Tailwind 4 via Decanter 8, npm (yarn is fine, never convert a
project), Playwright plus axe for testing. **Hosting: GitHub Pages for static,
then Netlify or Vercel** — SWS runs both, one per family, so start from whichever
the unit already administers rather than picking for them. Ship the default
security headers from `standards/hosting/capabilities.yml`; a **CSP is optional
and off by default**, because it breaks pages at content-edit time and the person
holding that problem is the one least able to diagnose it. No
component workshop: these sites have few components and one consumer.

**Content is authored in the repo. No CMS.** See `standards/scope.md`. Every
content change is therefore a commit that runs `sws a11y` in CI, which is a
stronger control than an authoring-time overlay — but automated testing still
catches only about 30 percent of issues, so that floor has not moved.

Push to `main` deploys. Pull requests are first-class but never required, and
nothing should make one mandatory.
