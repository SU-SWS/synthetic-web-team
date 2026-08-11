# Discoverability: SEO, and what to actually do about AI

**Researched 10 August 2026. This is the most hype-saturated area in the project, so every claim below carries a confidence marker and the "do not do this" list is as important as the recommendations.**

Confidence: **HIGH** = first-party source (vendor docs, IETF datatracker, arXiv). **MEDIUM** = multiple independent secondary sources. **LOW** = single secondary source, probably agency content.

## The short version

Four things drive inclusion in AI answers, per the largest available meta-analysis: **be crawlable, rank in conventional search, answer the question directly, and don't suppress your own snippets.** Everything else is second-order. (MEDIUM, [Zyppy meta-analysis, May 2026](https://signal.zyppy.com/p/ai-citation-ranking-factors))

That is not a satisfying answer, and it is why this area attracts so much vendor noise. Good SEO plus clean semantic HTML is most of GEO.

## What is settled

### AI crawlers come in three kinds, controlled separately

This is the single most useful operational fact, because it means the choice is not binary. (HIGH, [OpenAI bots docs](https://developers.openai.com/api/docs/bots), [Anthropic crawler support](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler))

| Purpose | OpenAI | Anthropic | Perplexity | Google |
|---|---|---|---|---|
| **Training** | `GPTBot` | `ClaudeBot` | `PerplexityBot` | `Google-Extended` (token only) |
| **Search index** | `OAI-SearchBot` | `Claude-SearchBot` | — | `Googlebot` |
| **User-triggered fetch** | `ChatGPT-User` | `Claude-User` | `Perplexity-User` | `Google-Agent` |

Allowing `OAI-SearchBot` while disallowing `GPTBot` means visible in ChatGPT search, excluded from training. Officially supported.

Two traps. **`Google-Extended` and `Applebot-Extended` are robots.txt tokens, not crawlers** — they make zero requests and will never appear in your logs. And **there is no Copilot user agent**: Microsoft Copilot is fed by `Bingbot`, so blocking it blocks Bing search. (HIGH)

### Google now has an AI Overviews opt-out, and Stanford should not use it

A **"Search generative AI" toggle in Search Console → Settings** launched 3 June 2026, honored from 17 June. It excludes a property from AI Overviews and AI Mode while leaving normal Search untouched, and Google states it is not a ranking signal. The **Gemini app is explicitly excluded** from the opt-out. (HIGH on existence, MEDIUM on detail: [blog.google](https://blog.google/products-and-platforms/products/search/search-ai-features-controls/), [9to5Google 2026-06-02](https://9to5google.com/2026/06/02/google-ai-mode-overviews-opt-out/))

This corrects an earlier assumption in this project that you could not opt out of AI Overviews without losing Search. You now can.

**We still recommend against it for Stanford**, because the higher-ed data points the other way. A 51-institution study found a **35% average brand-mention rate but only a 10.5% owned-domain citation rate**, a 24.5-point gap, and only about a third of institutions have any AI-search strategy at all. (MEDIUM, [UPCEA](https://upcea.edu/ai-search-gap-higher-education/)) Prospective students are asking AI about Stanford whether Stanford participates or not. The problem is too few citations to stanford.edu, not too many.

### Google says structured data is not an AI retrieval factor

Google's *"Optimizing your website for generative AI features on Google Search"* (circa 15 May 2026) states plainly that **no special markup, schema, AI text file, or Markdown is needed** to appear in generative AI features. Structured data remains valuable for rich results. (HIGH, [developers.google.com](https://developers.google.com/search/docs/appearance/ai-features))

Observational work does find 65–71% of AI-cited pages carry structured data, but that is confounded: schema correlates with sites that are simply better built. (MEDIUM/contested)

**So: ship JSON-LD for rich results, and record internally that it is not an AI-citation lever**, so nobody claims credit for it later.

### llms.txt is for coding agents, not search engines

Across 500M AI bot visits in a 90-day window, only **408** targeted `llms.txt` directly. 97% of published files receive zero requests. No major AI company has committed to reading it, and correlation studies find no citation lift. GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, and Google-Extended overwhelmingly crawl HTML directly. (HIGH)

But **IDE agents do fetch it routinely** — Cursor, Claude Code, Copilot, Cline, Aider all look for `/llms.txt` and `/llms-full.txt` when pointed at a documentation site, which is why Stripe, Vercel, Cloudflare, and Anthropic all ship one.

**Implication for us:** `llms.txt` belongs on documentation sites for the coding-agent audience. It is not a GEO tactic. Our own docs site should have one; a department's marketing site has no reason to.

### Cloudflare changes defaults on 15 September 2026, and someone should check

From **15 September 2026**, Cloudflare blocks Training and Agent bots **by default** for new domains, new sites on existing accounts, and **all existing free-tier customers** on ad-displaying pages. Search bots stay allowed. (HIGH, [Cloudflare changelog 2026-07-01](https://developers.cloudflare.com/changelog/post/2026-07-01-ai-traffic-options/), [TechCrunch](https://techcrunch.com/2026/07/01/cloudflares-new-policy-pushes-ai-companies-to-pay-for-publishers-content/))

**Action item with a real deadline:** any Stanford site behind Cloudflare's free tier may be silently opted into blocking AI training and agent crawlers in about five weeks. That should be a deliberate choice, not a default someone discovers later. Worth a note to whoever owns Cloudflare zones at Stanford.

### Some crawlers simply do not comply

`Bytespider` (ByteDance) has been repeatedly observed crawling disallowed paths. Perplexity operates **undeclared stealth crawlers** impersonating Chrome on macOS, rotating IPs and ASNs outside its published ranges, at 3–6M extra requests per day when its declared bot is blocked. In the same test OpenAI's `ChatGPT-User` fetched robots.txt, obeyed, and stopped. (HIGH, [Cloudflare](https://blog.cloudflare.com/perplexity-is-using-stealth-undeclared-crawlers-to-evade-website-no-crawl-directives/))

robots.txt is a preference, not a control. Enforcement needs WAF or edge rules.

### The crawl-to-referral ratio is enormous

Cloudflare Radar, mid-2026: Google roughly 5:1, Perplexity 186:1, OpenAI 848:1, Anthropic 4,580:1. (HIGH, [Cloudflare Radar](https://blog.cloudflare.com/ai-search-crawl-refer-ratio-on-radar/)) AI referrals are about **1% of total sessions** while organic search has fallen below 25% of traffic share for the first time. (MEDIUM, vendor panels)

Useful context for expectation-setting: AI is a large crawl cost and a small traffic source today. Do not let anyone reframe 1% as either a crisis or a win.

## What is contested

**Does blocking AI crawlers hurt you?** Genuinely unresolved. Zhao (Rutgers) and Berman (Wharton) find blocking LLM crawlers associated with a **7% to 23% reduction** in visits depending on window and method, across three traffic panels. (HIGH that the study exists, [arXiv 2512.24968](https://arxiv.org/html/2512.24968v4); the range across revisions is real and should be cited as a range)

Against that: 70.6% of sites blocking `ChatGPT-User` and 92.3% blocking `Google-Extended` still appeared in citations, because blocks only bind labs that honor them. (MEDIUM)

**`noai` / `noimageai`** adoption is growing (88,000+ domains) but they remain a DeviantArt community convention with **no first-party compliance commitment** from OpenAI, Anthropic, or Google that could be verified. Claims that they are respected appear only in agency sources. (adoption MEDIUM, compliance LOW)

## What is vendor hype

**The "+40% GEO visibility" number.** The underlying paper (Aggarwal et al., KDD '24, [arXiv 2311.09735](https://arxiv.org/abs/2311.09735)) is real and peer-reviewed. But the first critical survey (Martinez, Sciences Po, [arXiv 2607.14035](https://arxiv.org/abs/2607.14035), 15 July 2026) reviewed **45 studies** and concluded the 40% figure is a *relative maximum on one metric in one fixed-context configuration*, conditional on the source already being in context, and that **no reviewed GEO technique shows a stable, longitudinal, cross-platform causal effect** on discoverability or clicks. It further reports GEO rewrites can **cut AI retrieval by 16%**. (HIGH)

This is the single most important citation in this document. Anyone selling a GEO retainer priced against "+40%" is selling a misreading of one table.

**Q&A and FAQ formatting for AI citation** measures slightly *negative*: mean influence 0.0947 for Q&A pages versus 0.1005 for non-Q&A, a 5.74% decrease. (HIGH, [arXiv 2604.25707](https://arxiv.org/abs/2604.25707))

**"4.3x more likely to be cited if fresh"** is an unsourced inflation of a real ~25.7% effect. (MEDIUM)

**Correlation tables sold as ranking factors** — brand mentions r=0.664, YouTube r=0.737, backlinks r=0.218 — are observational data from vendors selling monitoring tools. Directionally interesting, causally worthless. (LOW)

**`ai.txt`** (Spawning, 2023) has no standards-body adoption and no confirmed enforcement. **Cloudflare's Content Signals Policy** has no known crawler adoption; John Mueller stated it has "no effects whatsoever for any crawler or LLM." (HIGH, [seroundtable](https://www.seroundtable.com/google-cloudflare-content-signals-41631.html))

**IETF `aipref`** is real: two Standards-Track drafts published 28 April 2026, expiring 30 October 2026, no RFC number, no ratified vocabulary. (HIGH, [datatracker](https://datatracker.ietf.org/wg/aipref/about/)) Track it, do not build on it.

## Standard for Stanford sites

1. **Do the SEO properly.** Unique titles and descriptions, correct heading hierarchy, canonical URLs, `sitemap.xml`, internal linking, Core Web Vitals budget. This is most of GEO.
2. **Write a real `robots.txt` with explicit AI sections.** Only about 8% of sites with robots.txt have any AI rules. Allow retrieval and user-triggered bots (`OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`, `ChatGPT-User`, `Claude-User`, `Googlebot`, `Bingbot`). Treat training crawlers (`GPTBot`, `ClaudeBot`, `CCBot`, `Google-Extended`, `Applebot-Extended`) as a **unit policy decision**, not a default we impose. For public-mission content there is little reason to block; licensed library content, embargoed theses, and anything with student data should be behind auth regardless of bot.
3. **Structure for extraction.** A one- or two-sentence direct answer at the top of each page (44.2% of LLM citations come from the first 30% of a document), clear H2/H3 hierarchy, short paragraphs, dated pages, named authors. Put canonical facts — deadlines, tuition, accreditation, program requirements — in **plain HTML text, never only in a PDF or a JS-rendered component.**
4. **Ship JSON-LD** for `EducationalOrganization`, `Organization`, `Course`, `Event`, `BreadcrumbList`. For rich results. Not for AI citation.
5. **`llms.txt` only on documentation sites**, for the coding-agent audience.
6. **Do not use the Search Console AI opt-out** without a specific reason and a conversation.
7. **Check your Cloudflare zone before 15 September 2026.**
8. **Instrument server logs, not vendor dashboards.** Track AI user agents and your own crawl-to-referral ratio.

## Do not do this

- Do not block `Googlebot` or `Bingbot` to escape AI answers. You lose Search and Copilot with them.
- Do not use site-wide `nosnippet` or `max-snippet:0` as an AI control. It destroys your organic snippets.
- Do not rely on `Google-Extended` to stay out of AI Overviews. It never did that.
- Do not rely on `noai`, `noimageai`, `ai.txt`, or Content Signals as enforcement. All are unenforced preferences.
- Do not implement anything from `draft-ietf-aipref-*` in production.
- Do not buy a GEO retainer priced against the "+40%" figure.
- Do not add FAQ or Q&A blocks purely for AI citation. The measured effect is slightly negative.
- Do not publish canonical facts only inside PDFs.
- Do not present `llms.txt` as an SEO or GEO tactic.
- Do not name or rank a GEO vendor. See "route, don't recommend" in the project plan.

## Gaps

Not closed, because `web_fetch` was unavailable and only search summaries were accessible: whether the Search Console AI toggle is now globally available or still staged, whether any AI lab has *formally* committed to `noai` (no first-party statement found), and primary-source confirmation of Cloudflare's "8.5% of the top web" coverage figure.
