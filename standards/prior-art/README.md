# Prior art

**SWS has built a lot of websites. The agent should look at them before inventing something.**

This directory is how that happens without vendoring anyone's code, and without dragging superseded standards into new work.

## Scope note: most of this prior art is CMS-backed, and the CMS is not in scope

**Read this before copying anything.** `standards/scope.md` scopes this package
to **static content authored in the repo, with no CMS.** Six SWS repos run
Storyblok and five run decoupled Drupal, so most of the record below is
CMS-backed work.

That record is **not rewritten to match the current scope**, because it is
evidence rather than instruction. It is still correct about what SWS built.

So when prior art shows you a Storyblok or Drupal pattern:

- It is **still true** about what SWS did, and the work is not wrong.
- It is **not a recipe you can follow here**, because there is no tested CMS
  path in this package.
- Cite it for the **shape of the problem** — content modelling, IA, component
  composition, host wiring — and not for the content plumbing.

This is the ordinary precedence rule doing its job: prior art tells you how we
solved a shape of problem, standards tell you what to build it with, and when
they disagree, standards win.


## The precedence rule

This is the whole design, and everything below serves it:

> **Prior art tells you _how we solved a shape of problem_.**
> **Standards tell you _what to build it with_.**
> **When they disagree, standards win. Always. No exceptions.**

An SWS site from 2023 is a legitimate reference for information architecture, content modelling, navigation patterns, component composition, form flows, and the hundred small editorial decisions that make a Stanford site feel like one. It is never a reference for Decanter version, Tailwind syntax, WCAG target, build tooling, or hosting config.

Without this rule, prior art actively makes the output worse. Most existing SWS sites encode Decanter 6 SCSS/BEM or Decanter 7's Tailwind 3 preset, WCAG 2.0 rather than 2.1, and build tooling that predates Astro. An agent that treats "how we did it last time" as authoritative will confidently produce a 2023 site. So every reference carries an era, and the skill that consults them states the rule before it states the findings.

### The distinction that makes the rule usable

The rule above is necessary but incomplete, and the first inspection pass proved it. Applied naively it would have thrown away the most valuable findings of the whole exercise. Two things look alike in a repo and are not:

**Dated execution is drift. Standards win.**
A repo on Decanter 7 and Tailwind 3 is not a CSS reference. A repo on Next 13 is not a framework reference. Note the era, take the problem shape, leave the implementation.

**Repeated independent choices are knowledge. Standards should change.**
Five repos choosing `sa11y`, seven pinning the same `cnbuilder` version, and zero choosing pnpm are not drift. They are facts about how SWS works that no amount of research or reasoning would have surfaced. When production repos consistently agree with each other and disagree with our standards, **our standards are probably wrong.** Eleven production repos outrank one author's assumption.

The test: *is this repo doing something old, or is the org doing something consistently?* One repo on Decanter 7 is dated. Nine repos avoiding a tool we recommend is a signal about the tool.

**Count lineages, not repos.** This clause said "independent" from the start, and the word is load-bearing. An earlier version of this section cited *"four opting out of Turbopack"* alongside the examples above. That example was **wrong, and it was checked with SWS on 2026-09-01**: the four decoupled-Drupal repos run `--webpack` because of one point-in-time decision to not adopt Turbopack, and Turbopack is in fact the forward choice for Next.js. The four repos are **one family**, so the flag was copied along with everything else.

This is the failure mode copy-forking creates, and copy-forking is a practice this project explicitly endorses: `csp-nextjs` was made by copying `cardinalsites-nextjs`, deliberately and correctly. The consequence for inspection is that **N repos in one lineage agreeing is one data point, not N.** Four sibling repos sharing a flag is weaker evidence than two unrelated repos sharing one.

So before treating agreement as a convention, ask whether the repos are siblings. If they are, you have found a **frozen decision**, which is a fact about the past. Whether it is still the intent needs the third clause below — a person.

### Third clause: prior art cannot tell you why, or where the org is going

**This is the clause that matters most, and it was learned the hard way.**

The first inspection pass produced four proposed corrections to our standards. **Three were wrong**, and each failed in a way an agent will reliably reproduce:

- **`sa11y` in five repos** looked like a developer tooling convention. It is a **content-author** tool used in Visual Editor overlays. The dependency data said *what*, and I supplied a *why* that was wrong. Acting on it would have put an authoring tool into a CI pipeline where it does nothing, while leaving the real gap (accessibility of content published after launch) unaddressed.
- **Cypress in three repos, Playwright in zero** looked decisive. SWS is moving to Playwright. Lockfiles record decisions already executed and say nothing about direction, so the correct answer was invisible to the analysis by construction.
- **`sws-astro` on Astro 6** looked like a version constraint to adopt. The actual answer was to stop naming versions anywhere in the recipes. A version mismatch is often a design smell rather than a decision.

So:

> **Prior art establishes what the org does. It cannot establish why, and it cannot establish where the org is going. Both require asking a person.**

Practical obligations on the agent:

1. **Never infer purpose from presence.** If a dependency's role is not obvious from how it is used, say "five repos include `sa11y`, purpose unconfirmed" rather than "SWS uses `sa11y` for X."
2. **Never present current practice as intent.** "Three repos use Cypress" is a fact. "SWS standardises on Cypress" is a claim about a decision, and it needs a human.
3. **Watch for questions that should be dissolved instead of answered.** If prior art and standards disagree on a version, first ask whether the version needed specifying at all.
4. **End step 0 with a check, not a conclusion.** Report findings as findings, flag which are facts and which are inferences, and let the person confirm before any of it hardens into a standard.

### Era is not a timeline: lineage matters

The `era` field implies a straight line, decanter-6 to 7 to 8, where newer is better. That model broke on the first repo that mattered.

**`www.stanford.edu` does not consume Decanter.** It is its own design system, heavily derived from Decanter, and it is currently *influencing Decanter 8*. It sits **upstream** of the design system, not downstream. So it is simultaneously ahead of Decanter 8 in some respects and incompatible with it in others, and no single `era` value can express that.

Three relationships to the design system, not one axis:

| Lineage | Meaning | How to use it |
|---|---|---|
| **Consumer** | Installs Decanter at some version | Era applies normally. Newer is better |
| **Derived** | Its own system, descended from Decanter | Brand furniture still authoritative, because brand is brand. Tokens and CSS are a **parallel vocabulary**, not Decanter's |
| **Upstream** | Feeding patterns back into Decanter | A preview of where the system is going. Adopt ideas, not implementations |

`www.stanford.edu` is derived *and* upstream at once.

The trap this creates is specific and worth naming: copying CSS from a derived system into a Decanter project produces something that **looks approximately right and does not use the design system**. It will pass a visual review and fail every token-level check, and the failure is invisible in a screenshot. An agent must therefore check lineage, not just era, before borrowing anything at the CSS or token layer.

This also means "the design system" is not a single source of truth at any given instant. There is a live feedback loop from a flagship project into Decanter, which is healthy and how design systems should actually evolve, but it means the honest answer to "what does Stanford's design system say?" is sometimes "Decanter 8 says X, and the homesite is piloting Y."

### Copy-forking is the incumbent, and it works

`cardinalsites-nextjs` and `csp-nextjs` are intentional sibling instances: two clients, one repo copied to make the other. Not divergence to reconcile.

That is worth sitting with, because **copy-forking a previous client site is the existing solution to the problem this project is trying to solve.** It is not a bad practice. It is fast, it carries real working code, and it preserves decisions no document captured. Any agent that treats a near-duplicate repo as a problem to flag has misunderstood the shop.

What copy-forking does not do is carry standards forward or tell you what changed since. A fork made 18 months ago inherits that era's Decanter, that era's a11y target, and that era's dependency set, silently and permanently. So the honest positioning for this project is not "stop copy-forking," it is: keep the reuse, add a way to know what has moved. Recipes are the diff that a fork cannot give you.

Practically: when the agent finds two near-identical repos, `relationship: sibling-instance` is a **recognised, legitimate pattern**, not a finding. Report it as context, never as drift.

### Correlations are the most seductive trap `sa11y` correlated **perfectly** with Storyblok across all 11 repos, five for five and six for six. That pattern was the answer, and I reported the count instead. A strong correlation with another dependency usually means the tool belongs to *that* dependency's domain, so look at what it co-occurs with before deciding what it is for.

The mirror-image trap is an *absence*. `www.stanford.edu` had no `decanter` dependency, and I logged it as a gap to explain. It was a deliberate architectural fact: a derived design system. A missing dependency is a design decision at least as often as it is an oversight, so ask before calling it either.

Full record in `standards/patterns/sws-conventions.md`, kept deliberately as a record of error rather than tidied up, because the pattern of failure is more reusable than the conclusions.

## Three tiers, cheapest first

Curation is the expensive part, so the tiers are ordered so that the free ones carry most of the load.

### Tier 1: local scan. Zero curation.

Most SWS people have ten to fifty Stanford repos already on disk. That is the highest-signal, lowest-effort corpus available and it never leaves the machine.

```bash
sws prior-art scan
```

Walks the roots configured in `.sws/config.yml` (defaults: the parent of the current directory, plus `~/Sites`, `~/Projects`, `~/code` if they exist), and indexes anything that looks like Stanford web work: a `decanter` dependency, a `stanford.edu` string in a footer or config, a `stanford_basic` theme, or an `su-` class prefix. Writes `.sws/prior-art.local.yml`, which is **gitignored** and never transmitted.

For each project it records path, detected stack, detected Decanter major, last commit date, and which recognisable patterns it contains. It does not copy code. When the agent needs an implementation it reads the file from disk at that moment.

Privacy matters here: client work and private repos are on these disks. The scan records paths and metadata only, the index stays local, and nothing in this system uploads project contents anywhere.

### Tier 2: the org catalog. Light curation, highest value.

`catalog.yml` in this directory. A hand-maintained list of SWS repos with the one thing no automated system can supply: **judgment**. Which one is the good one. Which one is a cautionary tale. Which one everybody copies and shouldn't.

No code, just metadata and file pointers. Small enough that one person can keep it honest, and it is the only place where "this is how we do it" carries authority.

### Tier 3: live search. Zero curation, fallback.

When tiers 1 and 2 have nothing, the MCP tool `sws_prior_art(query)` runs a code search across the `SU-SWS` GitHub org. Always current, no maintenance, but uncurated: results carry no signal about whether the code found is exemplary or abandoned. Treat as a lead, not an answer, and check the era before borrowing anything.

### Live exemplars: a different kind of reference

Most of SWS's best work is not reachable as source. [Awesome-Decanter](https://github.com/SU-SWS/Awesome-Decanter) lists 17 shipped Stanford sites as **URLs**, and for many of them there is no public repo. That is not a gap, it is a distinct and in some ways better reference type, because a live site shows what actually survived launch.

What a live exemplar can teach:

- **Rendered page furniture.** The Identity Bar and Global Footer as actually shipped, which is the most compliance-relevant markup in the system.
- **Information architecture.** Navigation depth, labelling, URL structure, how a large Stanford unit organises itself.
- **Content patterns.** Page types, hierarchy, editorial voice, how long a real Stanford page is.
- **Decanter in the wild.** Which utilities and components get used, and which get worked around.
- **A shipped accessibility baseline.** Run axe against a peer site to see what Stanford sites actually achieve, not what a spec says.

What it cannot teach: build config, dependency versions, component source, or CSS architecture. Those come from the recipe, always. The precedence rule applies with extra force here, because a rendered page gives no signal at all about which Decanter era produced it.

**The Global Footer verification corpus.** This is the most valuable single use of the live exemplars. Our `standards/fragments/global-footer.yml` is the highest-stakes normative fragment we maintain and it is currently unverified. Rather than trusting one source, `sws prior-art verify-footer` can fetch the rendered footer from all 17 exemplars, extract the link sets, and report the consensus plus any outliers. `www.stanford.edu` is the canonical reference among them. A link set that agrees across seventeen shipped Stanford sites is far stronger evidence than a documentation page, and the outliers are informative in their own right, since they are either drift to report or legitimate variants we do not know about.

## The pattern ledger, harvested not authored

`patterns/` holds distilled write-ups of recurring solved problems. The important design decision is **how entries get there**: nobody sits down to write them.

When a role skill solves something and the user confirms it worked, `sws harvest` offers to append an entry pointing at the implementation just written:

```
That event listing pattern isn't in the ledger. Add it? (y/n)
  → patterns/event-listing.md, pointing at this repo and file
```

Prior art then accumulates as a byproduct of use, which is the only model that survives contact with a busy team. It also follows the nagging-not-blocking rule: `harvest` offers, never demands, and declining costs nothing.

Each pattern is short on purpose: the problem, the shape of the solution, the canonical implementation to look at, the era it was written in, and what to watch out for. It is a signpost, not documentation.

## Lookup order

```
sws prior-art find "<what you are building>"

  1. patterns/INDEX.md          distilled, fastest, has judgment
  2. .sws/prior-art.local.yml   the user's own disk, free, private
  3. catalog.yml                curated org work
  4. sws_prior_art(query)       live org search, uncurated
  5. nothing found              say so plainly and generate from the recipe
```

Step 5 matters. "No prior art found" is a legitimate and common answer, and saying it plainly is better than returning a weak match that sends the agent down the wrong path. A tool that always finds something is a tool that is sometimes wrong without telling you.

## What the agent must do with the results

1. **State the era** of anything it borrows from, and what it is therefore not borrowing.
2. **Reconcile against current standards** before writing anything, not after.
3. **Record what it reused** in `.sws/manifest.yml` under `prior_art`, so the next person can trace where a pattern came from.
4. **Never copy build config, dependency versions, or CSS architecture** from prior art. Those come from the recipe, always.

## Files

| File | Maintained by | Contents |
|---|---|---|
| `README.md` | SWS | This document. The precedence rule lives here |
| `catalog.yml` | SWS, by hand | Curated repos with era and judgment |
| `patterns/INDEX.md` | `sws harvest` | One line per pattern |
| `patterns/*.md` | `sws harvest`, edited by humans | Distilled solutions |
| `.sws/prior-art.local.yml` | `sws prior-art scan` | Local index. Gitignored, never transmitted |
