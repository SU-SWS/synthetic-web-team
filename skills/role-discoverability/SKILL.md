---
name: role-discoverability
description: Make a Stanford site findable, in search engines and AI answer engines. Use for metadata, structured data, sitemaps, robots.txt, AI crawler policy, site search integration, or when someone asks about SEO, GEO, AEO, llms.txt, or getting cited by ChatGPT.
---

# SEO and GEO

Full evidence-graded doctrine with sources and confidence markers in
`standards/patterns/discoverability.md`. Read it before making claims, because
this is the most hype-saturated area in the project and the citations are what
end an unproductive argument.

## The short version

Four things drive inclusion in AI answers, per the largest available
meta-analysis: **be crawlable, rank in conventional search, answer the question
directly, and do not suppress your own snippets.** Everything else is
second-order.

Good SEO plus clean semantic HTML is most of GEO. That is unsatisfying and it is
what the evidence says.

## Do the SEO properly

- **Unique title and meta description** on every page.
- **Correct heading hierarchy.** One `h1`, no skipped levels.
- **Canonical URLs**, which requires `site` set in the framework config. Missing
  it is the most common failure and it silently breaks the sitemap too.
- **`sitemap.xml`**, via `@astrojs/sitemap` or the Next equivalent.
- **Internal linking** with descriptive link text.
- **Core Web Vitals budget** in CI.
- **Stable URLs.** See `role-information-architect`; changing a URL is a
  migration.

## Structured data, for rich results and not for AI

Ship JSON-LD: `EducationalOrganization` or `Organization`, plus `Course`,
`Event`, `Person`, `BreadcrumbList` as applicable.

**Google states plainly (May 2026) that no special markup, schema, AI text file,
or Markdown is needed to appear in generative AI features.** Structured data is
for rich results. Observational studies find 65 to 71 percent of AI-cited pages
carry schema, but that is confounded: schema correlates with sites that are
simply better built.

So implement it, and **record internally that it is not an AI-citation lever**,
so nobody claims credit for it later. Being straight about this is more valuable
than the markup.

## AI crawlers come in three kinds

The most useful operational fact, because the choice is not binary.

| Purpose | OpenAI | Anthropic | Perplexity | Google |
|---|---|---|---|---|
| Training | `GPTBot` | `ClaudeBot` | `PerplexityBot` | `Google-Extended` (token only) |
| Search index | `OAI-SearchBot` | `Claude-SearchBot` | — | `Googlebot` |
| User-triggered | `ChatGPT-User` | `Claude-User` | `Perplexity-User` | `Google-Agent` |

Allowing `OAI-SearchBot` while disallowing `GPTBot` means visible in ChatGPT
search, excluded from training. Officially supported.

Two traps: **`Google-Extended` and `Applebot-Extended` are robots.txt tokens, not
crawlers**, so they never appear in logs. And **there is no Copilot user agent**,
because Copilot is fed by `Bingbot`, so blocking it blocks Bing search.

**Write an explicit `robots.txt`.** Only about 8 percent of sites with a
robots.txt have any AI rules, so silence is a default rather than a decision.
Allow the retrieval and user-triggered bots. Treat training crawlers as a **unit
policy decision**, not something we impose: for public-mission content there is
little reason to block, while licensed library content, embargoed theses, and
anything with student data should be behind authentication regardless of bot.

Note that robots.txt is a preference, not a control. `Bytespider` has been
observed crawling disallowed paths, and Perplexity operates undeclared stealth
crawlers. Enforcement needs WAF or edge rules.

## Structure for extraction

The one practice with real evidence: **a direct one- or two-sentence answer at
the top of the page.** Roughly 44 percent of LLM citations come from the first 30
percent of a document.

Then: clear H2 and H3 hierarchy, short paragraphs, dated pages, named authors,
and **canonical facts in HTML text rather than only in a PDF or a JS-rendered
component.** A PDF-only tuition figure is invisible to search and to AI.

This overlaps almost entirely with `role-content-designer`. That is the point.

## `llms.txt` belongs on documentation sites only

Across 500 million AI bot visits in a 90-day window, only 408 targeted
`llms.txt`. 97 percent of published files receive zero requests. No major AI lab
has committed to reading it.

But **IDE coding agents fetch it routinely** (Cursor, Claude Code, Copilot,
Cline, Aider), which is why Stripe, Vercel, and Anthropic ship one.

So: `llms.txt` on a docs site, for the agent audience. **Not on a unit marketing
site**, where it signals a misunderstanding. Never present it as an SEO or GEO
tactic.

## What to push back on

**The "+40 percent GEO visibility" figure.** The underlying KDD '24 paper is real
and peer-reviewed. The first critical survey (Sciences Po, July 2026) reviewed 45
studies and found the number is a relative maximum on one metric in one fixed
configuration, that **no reviewed GEO technique shows a stable, longitudinal,
cross-platform causal effect**, and that GEO rewrites can **cut AI retrieval by 16
percent**. Cite it.

**Q&A and FAQ blocks added for AI citation** measure slightly *negative*.

**"4.3x more likely if fresh"** is an unsourced inflation of a real ~25.7 percent
effect.

**Correlation tables sold as ranking factors** are observational data from
vendors selling monitoring tools.

**`ai.txt`, `noai`, and Cloudflare's Content Signals** are unenforced
preferences. John Mueller said Content Signals has no effect for any crawler.
**IETF `aipref`** has drafts and no RFC. Track all of it, build on none of it.

**Do not name or rank a GEO vendor.** State the obligation, name the office.

## Google's AI Overviews opt-out exists. Do not use it.

A Search Console toggle launched June 2026 excludes a property from AI Overviews
and AI Mode without affecting normal Search. The Gemini app is excluded from the
opt-out.

Recommend against it for Stanford. A 51-institution study found a **35 percent
brand-mention rate but only 10.5 percent owned-domain citation**, a 24.5-point
gap, and only about a third of institutions have any AI-search strategy.
Stanford's problem is too few citations to stanford.edu, not too many.

## Site search

Below roughly fifty pages, good navigation beats search. Above that:

- **Algolia DocSearch** is the default. Free for public education content, no
  crawler to run. v5 also ships a first-party Ask AI side panel.
- **`algoliasearch` plus `react-instantsearch`** when you need faceting beyond
  DocSearch. Four SWS repos use this, including `react-instantsearch-nextjs` for
  App Router.
- **Coveo** only when enterprise unified search is genuinely warranted. It is
  sales-gated and over-scoped for a unit site. `adapt-directory` is the reference.

Design the zero-results and empty states. That is where search gets judged.

## Artifacts

| Artifact | Path |
|---|---|
| Metadata and structured data plan | `docs/seo.md` |
| `robots.txt` | `public/robots.txt` |
| Search configuration | `docs/search.md` |

## One action item with a deadline

From **15 September 2026** Cloudflare blocks Training and Agent bots by default
for new domains and all existing free-tier customers. Any Stanford site on
Cloudflare free tier may be silently opted into blocking. Check the zone settings
before that date so it is a decision rather than a discovery.
