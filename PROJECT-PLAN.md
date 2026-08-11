# Synthetic Web Team: Project Plan

**A portable, convention-first agent team that reproduces Stanford Web Services practice inside any AI coding tool.**

| | |
|---|---|
| Owner | Shea McKinney, Stanford Web Services |
| Status | Draft for review, rev 2 |
| Date | 10 August 2026 |
| Repo | `github.com/SU-SWS/synthetic-web-team` (public) |
| License | GPL-3.0-or-later |
| npm scope | `@su-sws` |

---

## 1. Executive summary

We are building a distributable package that lets any Stanford person open any AI coding tool and immediately have the working knowledge of a full SWS web team: strategy, IA, content, UX, front end, accessibility, discoverability, and delivery. Installation is a wizard. The output is a working, compliant, Decanter-styled static site on GitHub Pages, with a clear path to Netlify or Vercel and later Drupal.

Everything we ship is Markdown, YAML, and a small CLI. **No application code, no templates, no design system fork.** The site gets generated at current versions on the user's machine, and what makes it trustworthy is a set of checks rather than a blessed starting point.

**What this replaces, and what it does not.** SWS already has a working answer to "reuse what we built": copy the last client's repo. `csp-nextjs` was made by copying `cardinalsites-nextjs`, deliberately, and that is a good practice. It is fast, it carries genuinely working code, and it preserves a hundred decisions no document ever captured. What it cannot do is tell you what has moved since. A fork made 18 months ago silently inherits that era's Decanter, that era's accessibility target, and that era's dependency set. So the goal is not to stop copy-forking. It is to **keep the reuse and add a way to know what changed**, which is precisely what a recipe is and a fork is not.

Four commitments shape every decision below, and they share one instinct: own the contract, not the artifact.

**Convention over compilation.** The portable core is `AGENTS.md` plus `SKILL.md` skills. These are read natively by Claude Code, Cursor, VS Code Copilot, Codex, Gemini CLI, Antigravity, Zed, and Cline with no build step and no translation layer. We do not take on a third-party rule compiler, generated-file drift, or a CI gate that exists only to police our own tooling.

**The wizard is the emitter.** Native per-editor files get written once, at install time, based on what the wizard detects on the machine. After that they are ordinary Markdown that a Stanford developer can read, diff, and edit by hand. There is no ongoing regeneration relationship and nothing to keep in sync.

**Nagging, not blocking.** Adoption is the whole game. A tool that fails someone's build on a contrast ratio will be uninstalled by Friday. Everything is advisory: friendly reports, PR comments, a visible score that trends. Exactly one thing hard-fails, committed secrets, because that harm is irreversible and MinWeb names it explicitly.

**Recipes, not starter code.** We do not package, vendor, or maintain application code. Instead we maintain **recipes**: requirement documents an agent follows to generate a project at whatever the current versions are, delegating boilerplate to the upstream official scaffolders (`npm create astro@latest` and friends). This is the same instinct as convention-over-compilation applied one layer up. A template starts rotting the day it is committed and every consumer inherits the rot; a recipe that says what must be true stays correct across upstream releases, and lets the user swap pieces deliberately. The tradeoff is that we lose the template as a canary for upstream breakage, which we replace with a scheduled job that runs each recipe against current-latest and reports drift.

---

## 2. Decisions locked

| Decision | Choice | Consequence |
|---|---|---|
| Distribution | Convention only, wizard emits native files once | No compiler dependency, no drift CI, fully hand-editable |
| Role scope v1 | 8 roles built, 11 honest stubs, 5 disciplines absorbed | Full roster visible, no false depth |
| Wizard | `npx` CLI as the engine, optional MCP server as a second entry point | Works from any terminal and from inside any agent |
| Deliverable shape | **Recipes, not starter packages.** No vendored application code | Nothing to keep updated, users get current versions, swaps are first-class |
| Recipes v1 | Astro and Next.js, both | Covers static-first and React-oriented SWS work |
| Enforcement | Advisory everywhere, hard block on secrets only | Supportive, out of the way, one real safety net |
| Home | Public `SU-SWS` repo, GPL-3.0-or-later | License-compatible with Decanter, other universities can adopt |
| Accessibility | WCAG 2.1 AA, single track | No dual-track reporting. Siteimprove criteria reported alongside |
| Design system | **Decanter 8 only**, CSS-first on Tailwind 4 | No Tailwind 3 pin, no preset bridge, no separate tokens package |
| Cookies | No consent banner. Central policy on www.stanford.edu | Guidance actively tells units not to build one |
| `decanter-mcp` | Not a v1 dependency | Our MCP reads Decanter's own CSS. Revisit when it supports v8 |

**Naming.** `synthetic-web-team` is a good working name and I would keep it as the repo. For the user-facing command I recommend `sws`, because people will type it constantly. Alternative project names that fit the Decanter metaphor if you want something warmer: **Cellar** (where the decanters live), **Steward**, **Farm**.

---

## 3. Research findings that shape the design

These are the constraints that actually changed the architecture. Full sourcing in section 16.

### Stanford policy realities

**The standard is WCAG 2.1 Level AA.** Published policy (Admin Guide 6.8.1, the UIT accessibility policy page) still states 2.0 A and AA, and Decanter's own README still carries a 2.0 AA badge, but Stanford is moving to 2.1 and SWS has set 2.1 AA as the working standard for this project. The tooling targets 2.1 AA throughout with no dual-track reporting, which removes a whole category of confusion from the report. Where published policy text lags, `standards/policy/accessibility.md` says so explicitly and dates the note.

**Four accessibility signals, covering two different populations.** Playwright plus axe gates the build. The manual checklist covers the roughly 70 percent axe cannot see. Siteimprove applies its own criteria post-launch. And **`sa11y` runs in the CMS Visual Editor overlay so content authors get accessibility feedback while they edit**, which is used across every SWS Storyblok project and which the first draft of this plan missed entirely.

That fourth one closes a gap the other three structurally cannot. Everything in CI tests the site as built, and says nothing about what an editor publishes next week. On a CMS-backed site most accessibility debt arrives *after* launch, through content, so an authoring-time control is the only thing that reaches it. It also means accessibility is partly a `role-content-designer` concern rather than solely `role-accessibility-lead`.

**Siteimprove and axe are not comparable, and the report must not imply they are.** Siteimprove runs **Alfa**, its own open-source ACT-rules engine, not axe-core. Its Accessibility score spans **A, AA, and AAA** plus two non-normative categories, WAI-ARIA authoring practices and Best Practices, so AAA and best-practice failures drag the number even though Stanford's target is 2.1 AA. Scoring is proprietary and weighted: most issues are assessed **site-wide**, meaning one violation anywhere can cap the score, with only about 30 points available from per-page resolution. It also reports **"Potential Issues"** requiring human confirmation, a bucket with no axe equivalent and the usual explanation for "Siteimprove found more than axe."

Two consequences. The report presents them **side by side with distinct labels**, never as one number or a delta, and it states that a score below 100 may be entirely AAA and best-practice findings that are out of scope for the policy target. And **ACT rule IDs are the only clean join key** if we ever want to correlate the two, since rule names and granularity differ. Siteimprove publishes a rules list and API IDs for exactly that purpose.

Minor open item: Siteimprove's scoring docs describe WCAG 2.1 while its product material claims the NextGen module validates 2.2 AA. Probably stale docs against a newer engine, but worth confirming in Stanford's own tenant, which usually has a conformance-target selector. The report presents all three and does not treat any of them as sufficient alone. ODA's own guidance is the honest framing to quote: automated tools catch roughly 30 percent of errors. A green axe run is a floor, not a conformance claim, and the report says that in plain language rather than implying otherwise. axe-core 4.13.0 covers 2.1 AA well; for reference, it covers only one of the six criteria new in 2.2 (`target-size`), which is worth knowing when 2.2 eventually arrives but is not a v1 concern.

**Siteimprove registration is required for public-facing Stanford sites. Google Analytics is not required.** GA appears in MinWeb only as an example third-party service. This inverts the usual assumption and it changes the launch checklist: Siteimprove intake is a hard step, analytics is a choice with privacy consequences.

**The Stanford Global Footer is immutable.** Per the Identity Guide, the required links (Stanford Home, Maps & Directions, Search Stanford, Emergency Info, Terms of Use, Privacy, Copyright, Trademarks, Non-Discrimination, Accessibility, copyright line) may not be altered and nothing else may go in the Global Footer. Nothing may appear above the Identity Bar except skip-nav. This is mechanically checkable and is the single highest-value automated check we can write.

**And it is now verifiable empirically rather than by trusting a doc.** The 17 live exemplars in `prior-art/catalog.yml` are a consensus corpus: `sws prior-art verify-footer` fetches the rendered footer from all of them, extracts the link sets, and reports the agreed set plus outliers, with `www.stanford.edu` as the canonical tiebreaker. A link set that agrees across seventeen shipped Stanford sites is stronger evidence than a documentation page, and the outliers are useful either way, since each one is either drift worth reporting or a legitimate variant we did not know about. This closes the biggest unverified item in the project without needing anyone's permission.

**MinSec applies to Low-risk static sites.** Even the lowest tier requires the 7-day / 90-day patch cadence, monthly Qualys scanning, quarterly inventory with risk class, quarterly privilege review, and least-privilege admin accounts. A static site is not exempt, it is just cheap to comply with. MinWeb adds a named business owner and technical admin exposed in the footer or About page, MFA or SSO-with-MFA on all admin logins, HTTPS with a live certificate, no API keys in Git, and University Communications approval of the subdomain name.

**No cookie consent banner is required, and the Cookie Policy lives centrally on www.stanford.edu.** Confirmed by SWS. Sites satisfy their cookie obligation through the Global Footer's Privacy link, which already resolves to the central policy. What still applies is MinPriv's transparency requirement, a notice before collection, and the DRA trigger when a site introduces third-party services or starts collecting personal information. Those are content and process obligations, not a UI widget.

**Resolved, including the one apparent counter-example.** `summer-nextjs` ships `react-cookiebot`, the only cookie-consent tooling across 11 inspected repos. SWS confirms **no cookie banner service is centrally licensed**, and that instance was a client requirement for that specific site. So it is a documented one-off rather than a pattern, and it does not contradict the policy.

Final guidance: no banner is required, do not hand-roll one, and **do not name a vendor**. If a site has a genuine reason to need consent management, that is a conversation with the University Privacy Office, not a component choice and not ours to recommend.

### Route, don't recommend

That last point generalises into a principle the whole project should follow. **For anything with legal, policy, or procurement implications, the standards name the responsible university office rather than a product.**

Three reasons it matters here. SWS is not the university's procurement or privacy authority, and guidance that reads like an endorsement quietly implies it is. Anything purchased is subject to the VPAT/ACR requirement and a possible Data Risk Assessment, so a recommendation that skips those steps is actively unhelpful. And a named vendor in a standards document ages badly and gets adopted without the conversation that should have preceded it, which is worse than saying nothing.

Applies to consent management, analytics platforms, accessibility remediation vendors, payment processing, and authentication services. The pattern is: state the obligation, name the office, stop.

**Naming the office is only half of it.** Handing someone three links and letting them pick is a link farm, not routing. `standards/policy/escalation.md` records which **door** to use for each situation, and the agent gives one answer rather than a menu. ODA is the worked example: a launch means requesting an **accessibility review** and it needs lead time, a question while building means **office hours** (Tuesdays 11am with registration and bring a URL, or the Thursday Siteimprove drop-in via the `#cop-siteimprove` Slack channel), and anything else means the **general contact**. The practical detail is the part that saves a round trip.

Two guardrails in that file. **Never invent a door**: general contact plus an honest "they will route you" beats a confident wrong link. And **never substitute the agent for the office**: it can explain what WCAG 2.1 AA requires and fix findings, and it cannot grant an exception, approve a subdomain, sign off a launch, or interpret policy on the university's behalf. Contrast with technical choices like Astro or Decanter, where we should absolutely have an opinion, because those carry no policy weight and the cost of being wrong is a refactor rather than a compliance finding.

**Identity, when we get there:** SAML 2.0 via Shibboleth is the primary recommended path and WebAuth is archived legacy. OIDC is supported by the same IdP but confidential clients only, authorization code flow only, PKCE enforced in production, RP secret expires yearly. Duo two-step is required for all applications. Authorization is workgroup-based via the Workgroup API 2.0. MaIS Registry APIs use x509 mutual TLS. None of this is in scope for v1 static sites, which is precisely why the identity role is a stub.

### Tooling realities

**We target Decanter 8, which is a CSS-first rewrite on Tailwind 4.** I read the `v8` branch directly. This is not a version bump, it is an architecture change, and it deletes the single largest technical constraint the earlier draft of this plan was built around.

| | Decanter 7.4.0 | Decanter 8 (`v8` branch) |
|---|---|---|
| Model | JS Tailwind preset | CSS-first, no JS config at all |
| `main` | `tailwind.config.js` | `src/css/index.css` |
| Tailwind | `^3.4.17` (hard dependency) | `^4.1.16` |
| Consumed by | `presets: [require('decanter')]` | `@import 'decanter';` |
| Build | Tailwind 3 CLI / PostCSS | `@tailwindcss/postcss`, optional `@tailwindcss/cli` |
| Exports | config files | `.`, `./minimal`, `./colors`, `./src/*` |

`src/css/index.css` is five lines, and the first one matters:

```css
@import 'tailwindcss';
@import './theme/all.css';
@import './components/all.css';
@import './utilities/all.css';
@import './custom-variants.css';
@import './base/base.css';
```

Consequences, all favourable:

- **No Tailwind 3 pin.** We pin Tailwind 4.1.16 or later, matching Decanter's own dependency.
- **No `@config` bridge, no `overrides`/`resolutions` hack, no duplicate Tailwind install.** All of that machinery is unnecessary.
- **`@su-sws/decanter-tokens` is cancelled.** Decanter 8 *is* the CSS-first token layer. `src/css/theme/` already exposes `colors`, `breakpoint`, `font-family`, `font-size`, `gap`, `line-height`, `responsive-spacing`, `screen-margins`, `spacing`, and `transition-duration` as CSS. One less package for us to build and one less negotiation.
- **Decanter imports Tailwind itself**, so the consumer writes `@import 'decanter';` *instead of* `@import 'tailwindcss';`, not in addition to it. Doing both is the mistake people will make.
- **`decanter/colors` is directly importable**, which makes the token surface trivially readable by our own MCP server.

Separately, `@astrojs/tailwind@6.0.2` is dead (last published March 2025, supports neither Astro 6/7 nor Tailwind 4) and must never appear in our configs. The Astro path is `@tailwindcss/vite`.

### Verified against `8.0.0-alpha.1`

I built the Phase 0 spike against the alpha tag rather than waiting. **My `@source` hypothesis was wrong, and the integration is simpler than I predicted.**

I had reasoned that because `@import 'tailwindcss'` sits inside `node_modules/decanter/src/css/index.css`, Tailwind 4's source detection would root itself in `node_modules` and be ignored, so consumers would get Decanter's CSS but no utilities from their own markup. That is not how it behaves. Tailwind roots detection at the **entry** CSS file's project, not at the file containing the `tailwindcss` import, so the consumer's markup is found normally.

Real Astro 7.2.0 + `@tailwindcss/vite` 4.3.3 + `decanter@8.0.0-alpha.1`, with `src/styles/global.css` containing exactly one line, `@import 'decanter';`:

| Test | Result |
|---|---|
| Arbitrary utility `mt-[719px]` in a `.astro` file | Generated |
| Decanter color utilities `text-cardinal-red`, `bg-black-30` | Generated |
| Opacity modifier `text-cardinal-red/33`, `bg-digital-red/50` | Generated |
| Decanter utility `type-2` | Generated |
| Decanter component `.button` | Present |
| Adding `@source '../../src'` | **Byte-identical output. No effect.** |
| No git repo, and entry CSS nested three levels deep | Still detects markup correctly |

**So the canonical setup is one line and no `@source`.** That removes a Phase 0 blocker, removes a planned automated check, and removes a paragraph of caveats from `sws-decanter`.

Two further corrections to my own earlier claims:

- **`decanter/minimal` is not a smaller or leaner design system.** The only difference between `index.css` and `index-minimal.css` is `base/base.css` (3,286 bytes) versus `base/base-minimal.css` (623 bytes). Theme, components, utilities, and custom variants are identical. It is a lighter **base element reset**, not a reduced scope, and the built output is 9.9 KB versus 11.7 KB. It is therefore the right choice when something else already owns base element styling (Drupal, an existing theme), **not** automatically the right default for the plain-HTML starter, which is what I had assumed. Corrected in section 11.
- **Double-importing is harmless, not a breakage.** `@import 'tailwindcss';` followed by `@import 'decanter';` produces no errors, no warnings, and no duplicated preflight (Tailwind dedupes it), costing about 340 bytes. It is redundant and worth mentioning in the skill, but it does not warrant an automated check. Downgraded from a check to a note.

### The npm publish, and one thing to fix

`decanter@8.0.0-alpha.1` is now on npm, the `version` field is correct, and a bare `npm i decanter` installs cleanly and pulls `tailwindcss@4.3.3` transitively.

**However, the alpha was published to the `latest` dist-tag.** Verified:

```
dist-tags: { latest: '8.0.0-alpha.1', alpha: '6.0.0-alpha.1' }
$ npm i decanter   →   8.0.0-alpha.1
```

Two consequences. Anyone running a bare `npm install decanter` today, including every Stanford unit starting a new project and following the current v7 docs, silently gets a prerelease of a breaking architecture change. And the `alpha` tag still points at `6.0.0-alpha.1`, so it is not doing the job the name implies. Existing projects pinned to `^7.4.0` are safe, because npm will not resolve a prerelease into a caret range, so the exposure is limited to fresh installs. That is still the population most likely to be confused by it.

Suggested fix, if it matches the intent:

```bash
npm dist-tag add decanter@7.4.0 latest
npm dist-tag add decanter@8.0.0-alpha.1 next
```

Then the recipe installs `decanter@next` until 8.0.0 is final. Worth confirming rather than assuming, since publishing 8 to `latest` deliberately would be a reasonable call if the intent is to push adoption of v8 before the docs land.

Also still open: the v8 README drift noted above.

**Feedback worth sending to the Decanter team.** The `v8` branch has documentation drift that will trip early adopters: `package.json` still reads `"version": "7.4.0"`, the README still says "Version: 7" and carries the WCAG 2.0 AA badge, and the README's "import specific parts" section points at `decanter/src/css/theme.css`, `components.css`, `utilities.css`, and `base.css`, none of which exist. The real paths are `src/css/theme/all.css`, `src/css/components/all.css`, `src/css/utilities/all.css`, and `src/css/base/base.css`. Cheap fixes, and better landed before we ship guidance that has to work around them.

**No component workshop, deliberately.** Storybook is still the market default and the research supported adopting it, but most sites this project serves have a handful of components and exactly one consumer. A browsable library costs more to maintain than it returns at that scale, and Astro support for it is community-maintained rather than first-party, so it would have been the least reliable dependency in the stack. Component-level a11y assertions remain available through Vitest plus `axe-core` if a component set ever earns real reuse. Dropped from the plan.

**Next.js static export still works but is the weaker starter.** Next 16.3.0 supports `output: 'export'` in App Router, but forfeits `redirects`, `headers`, `rewrites`, Proxy (the renamed middleware), ISR, Server Actions, Draft Mode, and default-loader image optimization. Route Handlers work for `GET` only. Astro is the default recommendation; Next exists for teams whose React surface justifies it.

**Astro 7 shipped 22 June 2026, the second major in five months.** Content layer, server islands, view transitions, fonts, sessions, and CSP are all stable. `output: 'hybrid'` is gone. Treat 7.x as young and pin exactly.

**No first-party Storyblok MCP exists.** Only abandoned third-party packages. Schema-as-code is real via CLI v4 (component pull/push, TS type generation, migrations with `--dry-run`), but its own README says v4 documentation is still in development. `SU-SWS/decanter-mcp` exists and is active but is a **private** repo with a public endpoint, so we need to ask the Decanter team about depending on it.

**MCP spec 2026-07-28 is a breaking change.** It is stateless (no `initialize`, no session ID), requires a new `server/discover` method and `resultType`, and deprecates Roots, Sampling, and Logging on a 12-month clock. Transports are stdio and Streamable HTTP only. If we build an MCP server, build it against 2026-07-28.

**Runtime:** Node 24 LTS for new work (Node 26 is Current, not yet LTS). Note that SWS repos run `>=20` to `>=24`, with most on 22, so a check must not fail an existing project for being on 22.

**Package manager: npm primary, yarn secondary.** An earlier draft proposed pnpm, justified partly by needing `overrides` for the Decanter/Tailwind clash. Decanter 8 removed that clash and the justification with it. Inspecting 11 SWS repos found npm across the ADAPT and OOD family, yarn 4.x across the decoupled Drupal family, and pnpm in none. Our repo uses npm; recipes respect whatever a project already has and never convert it. Advice touching dependency overrides must be manager-aware, since npm `overrides` and yarn `resolutions` differ. See `standards/patterns/sws-conventions.md`.

### The convention that converged

Without any compiler, these paths are read natively today:

- `AGENTS.md` at repo root: the behavioral contract. Now Linux Foundation property under the Agentic AI Foundation. No formal schema, no frontmatter. Codex truncates project docs at 32 KiB; community consensus is 150 lines or less for real effect.
- `.agents/skills/<name>/SKILL.md`: read by Codex, Cursor, Gemini CLI, Zed, Antigravity, Cline.
- `.claude/skills/<name>/SKILL.md`: read by Claude Code, **and by VS Code Copilot directly** (`chat.agentSkillsLocations` defaults include it).
- Skill frontmatter: `name` and `description` are the only universally required and universally supported keys. Body target 1,500 to 2,000 words, details in `references/`, code in `scripts/`, templates in `assets/`.

Everything beyond that is per-tool. Subagent frontmatter vocabularies, hook event names, and permission semantics do not translate, which is exactly why we are not translating them.

---

## 4. Architecture

Five layers, each independently useful, each degrading gracefully if the layer above is absent.

```
┌─────────────────────────────────────────────────────────────┐
│ L4  Recipes         astro-static · next-static · html        │
│                     Requirement docs + acceptance criteria.  │
│                     Generated fresh, never vendored.         │
├─────────────────────────────────────────────────────────────┤
│ L3  Advisory        sws doctor · sws check · CI reports       │
│     enforcement     Nag ladder. Secrets are the one gate.    │
│                     Also: recipe canary vs current-latest.   │
├─────────────────────────────────────────────────────────────┤
│ L2  Wizard          npx @su-sws/create-web-team              │
│                     Detects editors, emits native files,     │
│                     runs the upstream scaffolder + recipe    │
│                     Optional: @su-sws/mcp for in-agent use   │
├─────────────────────────────────────────────────────────────┤
│ L1  Portable core   AGENTS.md + 8 role skills + 11 stubs     │
│                     + shared reference skills + MCP map      │
│                     Works unaided in 9+ tools                │
├─────────────────────────────────────────────────────────────┤
│ L0  Source of truth standards/  policy · patterns · recipes  │
│                     Human-authored, human-reviewed,          │
│                     Markdown + YAML, no build step           │
└─────────────────────────────────────────────────────────────┘
```

**L3 and L4 are now load-bearing for each other.** With no template to copy, the acceptance criteria in each recipe are the only thing standing between "the agent generated something" and "the agent generated something compliant." So every recipe requirement that matters must have a corresponding check in L3, and `sws check` becomes the definition of a correct project rather than a nice-to-have. That coupling is deliberate and it is the main design consequence of dropping starters.

**L0 is not compiled into L1.** L1 skills *cite* L0 documents by path and quote them where quoting is short. A skill that needs the full Global Footer link list reads `standards/policy/minweb.md` at runtime through the host tool's own file reading. This is progressive disclosure using the filesystem, which is the mechanism every one of these tools already implements, and it means a policy correction is a one-file edit with no regeneration.

**Version negotiation.** Each installed project gets `.sws/manifest.yml` recording the standards version, the editors emitted for, the compliance tier, and the stack. `sws doctor` compares it to the installed package and says "your standards are 3 minor versions behind, run `sws update` to see what changed." It never updates without being asked.

---

## 5. Repository layout

```
synthetic-web-team/                        pnpm workspace, Node 24
├── AGENTS.md                              our own contract, dogfooded
├── standards/                             L0: the source of truth
│   ├── policy/
│   │   ├── minsec.md                      risk tiers, patch cadence, Qualys, inventory
│   │   ├── minweb.md                      owner, MFA, HTTPS, naming, footer, secrets
│   │   ├── accessibility.md               WCAG 2.1 AA + Siteimprove criteria + ODA
│   │   ├── privacy.md                     MinPriv, DRA triggers, cookie OPEN QUESTION
│   │   ├── identity.md                    SAML primary, OIDC constraints, Duo, workgroups
│   │   ├── brand.md                       Identity Bar, Global Footer, type, color, links
│   │   ├── procurement.md                 VPAT/ACR 12-month rule, temporary exception
│   │   └── escalation.md                  which office, and WHICH DOOR
│   ├── patterns/
│   │   ├── decanter.md                    v8 CSS-first import, tokens, minimal vs full
│   │   ├── components.md                  SWS component conventions, naming, slots
│   │   ├── sws-conventions.md             what SWS actually does, from 11 repos
│   │   ├── discoverability.md             SEO + GEO doctrine, evidence-graded
│   │   ├── content.md                     Stanford voice, plain language, headings
│   │   ├── ia.md                          nav depth, URL design, taxonomy, redirects
│   │   └── forms.md                        labels, errors, required-field patterns
│   ├── stack/
│   │   ├── constraints.yml                the ONE load-bearing constraint, and
│   │   │                                  things to avoid. No version ranges
│   │   ├── reference-versions.yml          dated snapshot for the canary to diff.
│   │   │                                  Advisory. Nothing installs from it
│   │   ├── astro.md · next.md · storyblok.md · drupal.md
│   │   ├── hosting.md                     Pages → Netlify/Vercel → Acquia
│   │   └── search.md                      Algolia DocSearch default, Coveo when
│   ├── prior-art/                          consult before generating
│   │   ├── README.md                      the precedence rule, both halves
│   │   ├── catalog.yml                    17 live exemplars + tools
│   │   ├── repos.yml                      11 inspected source repos
│   │   └── patterns/                      harvested, not authored
│   ├── recipes/                            L4: the generation contracts
│   │   ├── astro-static/
│   │   │   ├── RECIPE.md                  build order, decisions, swap points
│   │   │   ├── acceptance.yml             what sws check must verify
│   │   │   └── fragments/                 NORMATIVE content only (see below)
│   │   ├── next-static/
│   │   ├── html-static/                   v2
│   │   └── add-to-existing/               retrofit an existing project
│   ├── checks/                            machine-readable check definitions
│   │   ├── footer.yml · identity.yml · a11y.yml · seo.yml · geo.yml
│   │   └── secrets.yml                    the one blocking check
│   └── artifacts/                         deliverable templates, see section 8
├── AGENTS.md                              L1: the behavioral contract (100 lines)
├── CLAUDE.md                              thin pointer: @AGENTS.md
├── skills/<name>/SKILL.md                 L1: source of truth for all skills
│                                          copied to .agents/skills + .claude/skills
├── packages/
│   ├── standards/                         @su-sws/standards  (ships L0 + L1 content)
│   ├── cli/                               @su-sws/sws-cli    → binary `sws`
│   ├── create-web-team/                   @su-sws/create-web-team  (the wizard)
│   └── mcp/                               @su-sws/mcp        (spec 2026-07-28)
├── docs/                                  the public docs site (Astro + Starlight)
│                                          also our own dogfooding of astro-static
└── .github/workflows/
    ├── advisory.yml                       our own nag ladder, dogfooded
    └── recipe-canary.yml                  weekly: run every recipe vs latest
```

---

## 5a. What a recipe is

A recipe is the unit that replaces a starter package. It is a requirement document, not a codebase, and it has four parts.

**1. Delegate the boilerplate.** The recipe never describes how to make an Astro project. It says to run the upstream official scaffolder at current latest, then verify what came back:

```
Run: npm create astro@latest -- --template minimal --typescript strict
Then record the resolved astro version in .sws/manifest.yml.
Record it, do not judge it. There is no version to compare against.
```

This is how users get current versions for free, and how we avoid owning a single line of boilerplate.

**Recipes name no versions.** An earlier draft had a `constraints.yml` of allowed major ranges plus a canary to flag when latest moved past them, which on reflection is a version-pinning scheme wearing a different hat, recreating exactly the rot that dropping starter packages was meant to avoid. Constraints now exist only where a version boundary is genuinely load-bearing, meaning getting it wrong produces a broken or non-compliant result. Across the entire `astro-static` recipe there is **exactly one**: Decanter 8 rather than 7, because it is a breaking architecture change and `npm i decanter` currently resolves to v7. Tailwind 4 arrives transitively. Node requirements come from whatever Astro needs. Astro majors are just latest.

Where a standard needs to constrain something, prefer expressing it as a **thing to avoid**, which ages far better than a version to require: no `@astrojs/tailwind`, no `tailwind.config.js`, no `output: 'hybrid'`. Those stay true across releases.

**2. Add the Stanford layer as intent, not code.** Requirements are stated so they remain true across upstream changes:

> The entry CSS imports Decanter and nothing else. Do not add `@import 'tailwindcss'`, Decanter already imports it. Do not create a `tailwind.config.js`, Decanter 8 has no JS config. Do not install `@astrojs/tailwind`, it is dead. Use `@tailwindcss/vite` in the Vite plugin array.

That paragraph stays correct whether Astro is on 7 or 9, and it is short enough to live inside a skill.

**3. Name the swap points explicitly.** Every recipe has a section listing where the user may deviate and what each deviation costs:

| Swap | Cost |
|---|---|
| Next instead of Astro | Loses `redirects`, `headers`, image optimization under static export |
| No Decanter | Global Footer and Identity Bar become hand-maintained; brand checks still apply |
| Coveo instead of Algolia | Enterprise licensing, sales-gated; Atomic web components drop into islands fine |
| Different host | MinWeb HTTPS and cert requirements are unchanged and now yours to satisfy |

This is `sws-diverge` made concrete per recipe, and it is the mechanism by which "follow our preferred stack but let me diverge" actually works instead of the agent either refusing or silently abandoning the standards.

**4. Acceptance criteria that L3 can verify.** The end of every recipe is a machine-checkable contract:

```yaml
# standards/recipes/astro-static/acceptance.yml
- id: footer.global
  requires: Stanford Global Footer present, link set exact, order exact
  check: footer
- id: brand.identity-bar
  requires: Identity Bar present, nothing above it except skip-nav
  check: identity
- id: decanter.entry
  requires: entry CSS imports decanter; no tailwind.config.js; no @astrojs/tailwind
  check: decanter
- id: a11y.axe
  requires: zero axe violations at WCAG 2.1 AA on every built route
  check: a11y
```

**Step 0 of every recipe is consulting prior art.** SWS has built a lot of sites, and most of what a new site needs has already been solved. `standards/prior-art/` structures that in three tiers ordered so the free ones carry the load: a **local scan** of the user's own disk (zero curation, never transmitted, and the highest-signal corpus available since most SWS people have dozens of Stanford repos already checked out), a **curated org catalog** supplying the one thing automation cannot, which is judgment about which implementation is the good one, and **live GitHub org search** as an uncurated fallback.

**Prior art needs a human in the loop, and this is not a small caveat.** The first inspection pass over 11 SWS repos produced four proposed corrections to our standards, and **three were wrong**: `sa11y` was read as a developer tool when it is a content-author tool, Cypress was read as a standard when SWS is moving to Playwright, and an Astro version mismatch was read as a decision when the right answer was to stop naming versions. The precedence rule therefore has a third clause: **prior art establishes what an org does, and cannot establish why, or where it is going.** Repos record decisions already executed. Intent lives only in people's heads. So step 0 ends with a check rather than a conclusion, findings are labelled as fact or inference, and the agent never infers purpose from presence. The full record is kept in `standards/patterns/sws-conventions.md` as a record of error, because the failure pattern is more reusable than the conclusions were.

Plus a fourth reference type the original design missed. Most of SWS's best work is not reachable as source: Awesome-Decanter lists 17 shipped Stanford sites as **URLs**, with no public repo for most. That turns out to be a feature rather than a gap, because a live site shows what actually survived launch. Live exemplars are authoritative for rendered page furniture, IA, content patterns, Decanter usage in the wild, and a real shipped a11y baseline, and useless for build config, dependency versions, or component source. The precedence rule applies with extra force here, since a rendered page gives no signal at all about which Decanter era produced it. A `patterns/` ledger accumulates distilled write-ups, and critically it is **harvested rather than authored**: when a role skill solves something and the user confirms it worked, `sws harvest` offers to append an entry pointing at what was just written. Prior art grows as a byproduct of use, which is the only model that survives a busy team.

The design problem here is not retrieval, it is **precedence**. Most existing SWS sites encode Decanter 6 SCSS/BEM or Decanter 7's Tailwind 3 preset, WCAG 2.0, and pre-Astro tooling. An agent that treats "how we did it last time" as authoritative will confidently produce a 2023 site. So one rule governs everything: **prior art tells you how we solved a shape of problem, standards tell you what to build it with, and when they disagree standards win with no exceptions.** Every catalog entry therefore carries a mandatory `era` and an explicit `use_for` / `do_not_use_for` split, and `cautionary` is a first-class rating so the repos people keep copying by mistake are documented as such. See `standards/prior-art/README.md`.

**Normative fragments are the one exception to "no code."** Some content must be byte-exact for compliance and paraphrasing it creates real risk: the Global Footer link set, the Identity Bar structure, the accessibility statement, the privacy notice. Those live in `fragments/` and we do maintain them, because they are **compliance content, not application code**, they change on Stanford's schedule rather than npm's, and getting them wrong is a policy problem rather than a bug. Everything else in a recipe is prose and acceptance criteria. `sws_footer_html` in the MCP server serves the footer fragment at generation time so there is one source for it.

---

## 6. The role roster

Roles are skills, not subagents. This is the portability decision paying off: a `SKILL.md` with `name` and `description` loads in nine tools unaided, whereas a subagent definition loads in one.

### Built in v1 (8)

Each ships as `packages/standards/skills/role-<name>/` containing `SKILL.md` (under 2,000 words), `references/` (the long-form detail), `assets/` (templates), and where useful `scripts/`.

| Skill | Owns | Key artifacts it produces |
|---|---|---|
| `role-strategist` | Discovery, goals, audience, scope, measurement plan, project management, RAID, stakeholder map | Project brief, measurement plan, RAID log, launch checklist |
| `role-information-architect` | Sitemap, taxonomy, navigation depth, URL design, redirect map, subdomain naming per UComm policy | Sitemap, URL and redirect map, taxonomy, nav spec |
| `role-content-designer` | Content design, copywriting, Stanford voice, plain language, headings, alt text, microcopy, link text | Content model, page tables, copy deck, alt-text register |
| `role-ux-designer` | Interaction and visual design, Decanter application, responsive behavior, lightweight user research | Wireframes, component inventory, design spec |
| `role-frontend-developer` | Astro and Next, Tailwind with Decanter 8, components, performance budget | Components, config, performance budget |
| `role-accessibility-lead` | WCAG 2.1 AA, axe integration, Siteimprove, the manual checklist for the ~70 percent axe cannot see, ODA process, accessibility statement, VPAT review | A11y test plan, manual checklist results, accessibility statement, remediation log |
| `role-discoverability` | SEO and GEO, metadata, structured data, sitemaps, robots and AI-crawler directives, `llms.txt`, Algolia or Coveo integration | Metadata plan, JSON-LD, `sitemap.xml`, `robots.txt`, `llms.txt`, search config |
| `role-devops` | Repo setup, CI, GitHub Pages then Netlify or Vercel, the advisory gate wiring, environment and secrets hygiene, the automated QA harness | Workflows, deploy config, environment matrix, `sws check` wiring |

### Absorbed into the built 8 (5)

Named explicitly so nobody thinks they were forgotten. Each requested discipline has a section inside its host skill, with its own heading, so the guidance is findable by name.

| Requested | Lives in |
|---|---|
| Design (visual) | `role-ux-designer` |
| Project management | `role-strategist` |
| Copywriting | `role-content-designer` |
| GEO | `role-discoverability` |
| Accessibility expert | `role-accessibility-lead` (same discipline as "accessibility") |

### Stubs in v1 (11)

Each stub is one page and does three things honestly: states what the role covers, links the governing Stanford policy or standard, and says "not yet implemented, here is the roadmap phase." A stub that pretends to be a role is worse than no role.

`role-user-researcher` · `role-security-operations` · `role-infrastructure-architect` · `role-software-architect` · `role-staff-technical-architect` · `role-backend-developer` · `role-fullstack-developer` · `role-compliance-officer` · `role-identity-engineer` (SSO, authn, authz) · `role-api-architect` · `role-qa-engineer`

Two notes on the stubs. The **compliance officer's** checks ship in v1 inside L3 even though the advisory role does not, so the function exists before the persona does. The **QA engineer's** automated portion also ships in v1 inside `role-devops` and L3; the stub covers test strategy, exploratory testing, and manual regression, which is the part that genuinely needs a person.

### Shared skills (not roles)

| Skill | Purpose |
|---|---|
| `sws-onboard` | Reads `.sws/manifest.yml` and orients the agent: what stack, what tier, what is already done |
| `sws-compliance-check` | Runs `sws check`, reads the report, explains findings in plain language, offers fixes |
| `sws-decanter` | Decanter 8 tokens and classes, the one-line CSS-first import, when to use `minimal` (something else owns base element styles) versus the default, and the v7-to-v8 differences for anyone with an existing project |
| `sws-deploy` | Pages, then Netlify or Vercel, with the MinSec and MinWeb pre-launch steps inline |
| `sws-diverge` | **The escape hatch.** How to leave the preferred stack deliberately: what to document, what compliance obligations survive the divergence, and how to record it in `.sws/acknowledged.yml` |
| `sws-prior-art` | Look at what SWS already built before generating. Carries the precedence rule, the lookup order, and the obligation to state the era of anything borrowed |

`sws-diverge` matters more than it looks. The brief says the environment should follow preferred stacks "but allow the end user to diverge when they request." A skill that makes divergence a first-class, documented act is how you get that without the agent either refusing or silently abandoning the standards.

---

## 7. The wizard

`npx @su-sws/create-web-team` in a new directory, or `npx @su-sws/create-web-team add` in an existing one.

### Interview flow

```
1  What are you making?
   → New site  |  Add SWS standards to an existing project  |  Just the agent team, no site

2  Which AI tools do you use?           [detected: Claude Code ✓, Cursor ✓, VS Code ✓]
   → multi-select, pre-checked from detection, always overridable

3  What is the site for?
   → audience, one-line purpose, unit name        (seeds the project brief)

4  Data and risk
   → "Will this site collect or display anything beyond public information?"
     No → Low risk    |  Personal info → Moderate, flags DRA  |  Unsure → walks the tree
   → sets the compliance tier, not the user's job to know MinSec tiers

5  Stack
   → Astro (recommended)  |  Next.js  |  I will decide later
   → CMS: none / Storyblok / Drupal (v2)
   → search: none / Algolia DocSearch / Coveo

6  Where does it deploy?
   → GitHub Pages (recommended first)  |  Netlify  |  Vercel  |  not yet

7  Who owns it?
   → business owner and technical admin, name + Stanford email
   → MinWeb requires these be identifiable; we collect once and place them correctly

8  Review and confirm            shows every file it will write, then writes them

9  Generate the project?         (only if step 1 was "new site")
   → runs the upstream scaffolder at current latest
   → applies the recipe
   → runs `sws check` and shows the first report
   → or: "skip, I'll do it myself" and hands the recipe to the agent
```

Step 4 is the important design move. Nobody should have to read the MinSec matrix to start a website. The wizard asks about the world, and derives the tier.

Step 9 is the recipe decision made concrete. The wizard **shells out to `npm create astro@latest`** rather than unpacking a template, then applies the Stanford layer, then immediately runs the checks so the user sees a green report on a project they just made. Two things follow from this. Version resolution happens on the user's machine at their moment in time, and gets recorded in `.sws/manifest.yml` so the report can say what was actually installed. And if the upstream scaffolder changes its flags or prompts, the wizard degrades gracefully to "here is the recipe, the agent in your editor can follow it" rather than failing, because the recipe is the real artifact and the automation is a convenience over it.

### What gets emitted, per editor

Universal, always written:

```
AGENTS.md                          ≤150 lines, the behavioral contract
.agents/skills/<19 skills>/        the portable skill set
.sws/manifest.yml                  standards version, editors, tier, stack
.sws/acknowledged.yml              risk acceptances and divergences, starts empty
standards/                         vendored L0 subset relevant to this project
```

Then, only for editors actually present:

| Editor detected | Emitted |
|---|---|
| Claude Code | `CLAUDE.md` (thin, `@AGENTS.md`), `.claude/skills/` (copy), `.mcp.json` |
| VS Code + Copilot | `.github/copilot-instructions.md` (thin), `.vscode/mcp.json`. Skills already resolve from `.claude/skills` |
| Cursor | `.cursor/rules/sws.mdc` (thin, `alwaysApply: true`), `.cursor/mcp.json`. Skills resolve from `.agents/skills` |
| Antigravity | `GEMINI.md` (thin, because Antigravity ranks it above `AGENTS.md`), `.agents/mcp_config.json` |
| Codex CLI | `.codex/config.toml` MCP block. `AGENTS.md` and `.agents/skills` already resolve |
| Zed | Nothing extra. `AGENTS.md` and `.agents/skills` resolve |
| Windsurf / Devin | `.devin/rules/sws.md`, `.devin/mcp_config.json` |
| Cline, Roo, Junie, Kiro, Continue | Thin stub, documented in `docs/editors.md` |

Two deliberate choices here. **The per-editor files are thin pointers, not content copies**, so there is no place for content to diverge. And **each emitted file is self-sufficient about the fact that it is a pointer**, because precedence and merge order are not uniform across these tools and layering cannot be relied on.

### Optional MCP server

`@su-sws/mcp`, built against spec 2026-07-28 (stateless, `server/discover`, Streamable HTTP plus stdio). It is a second entry point, never a requirement. Tools:

- `sws_get_standard(topic)` returns the relevant L0 document
- `sws_check(path)` runs the advisory checks and returns structured findings
- `sws_decanter_token(query)` resolves a Decanter token, class, or color
- `sws_footer_html(unit)` returns a correct, current Stanford Global Footer
- `sws_scaffold(kind, options)` drives the wizard programmatically

The footer tool alone justifies the server: the Global Footer is immutable, frequently gotten wrong, and mechanically generable.

**On `SU-SWS/decanter-mcp`.** It is fine to lean on for Decanter 7 work today, but not for Decanter 8, and since we are v8-only there is nothing for us to depend on in v1. That turns out to be the better design anyway: `sws_decanter_token` reads the installed package's own CSS directly, parsing `node_modules/decanter/src/css/theme/*.css` and `decanter/colors`. Because Decanter 8 is CSS-first, its tokens are plain custom properties in files we can read, so the tool is **version-accurate by construction** rather than by staying in sync with a separate service. Revisit depending on `decanter-mcp` once it is updated for v8, at which point deferring to it becomes the right call.

---

## 8. Artifacts the system produces

Beyond code, the team produces the documents an SWS engagement produces. Each is a template in `standards/artifacts/`, each is owned by a role, each is optional.

| Artifact | Owner | Format |
|---|---|---|
| Project brief | strategist | `docs/brief.md` |
| Measurement plan | strategist | `docs/measurement.md` |
| RAID log | strategist | `docs/raid.md` |
| Sitemap and URL map | IA | `docs/ia/sitemap.md`, `redirects.csv` |
| Content model | content designer | `docs/content-model.md` |
| Page tables and copy deck | content designer | `docs/content/*.md` |
| Component inventory | UX designer | `docs/components.md` |
| Design spec | UX designer | `docs/design-spec.md` |
| Accessibility test plan | a11y lead | `docs/a11y/test-plan.md` |
| Manual WCAG checklist | a11y lead | `docs/a11y/manual-checklist.md` |
| Accessibility statement | a11y lead | `src/pages/accessibility.*` |
| Metadata and structured data plan | discoverability | `docs/seo.md` |
| Compliance report | L3 | `.sws/report.html` + `report.json` |
| Risk acceptance register | L3 | `.sws/acknowledged.yml` |
| Pre-launch checklist | strategist + devops | `docs/launch-checklist.md` |
| ADR set | architect roles (v2) | `docs/adr/NNNN-*.md` |

The **pre-launch checklist** is the one that carries the most compliance weight, because it is where the steps no automation can do get named: Siteimprove intake submitted, subdomain approved by University Communications, business owner and technical admin recorded, SSL certificate live, Privacy and Security consult if the tier calls for it, DRA if triggered.

---

## 9. Advisory enforcement: the nag ladder

Five tiers of increasing visibility and decreasing frequency. Only tier 5's secret check can fail a build.

**Tier 1, in-editor, continuous.** Skills mention the relevant requirement when the agent touches relevant code. Building a footer? The footer skill loads and states the immutable link list. This is guidance at the moment of authorship and it is the cheapest correction there is.

**Tier 2, `sws doctor`, on demand.** A friendly local report. Always exits 0. Groups findings as "blocking launch" / "should fix" / "consider", each with the specific policy citation and a suggested fix. Prints a score and the delta since last run.

**Tier 3, pre-commit, opt-in and skippable.** Installed by the wizard only if the user says yes. Prints warnings to stdout and commits anyway. The secrets check is the exception and aborts.

**Tier 4, CI, on every change.** `sws check` runs and reports. **The job succeeds regardless of findings.** A separate, small, fast secrets job is the only one allowed to fail.

Where the report goes depends on how the change arrived, because **pull requests are supported, not assumed** (see below).

| Trigger | Report destination |
|---|---|
| Push to `main` | Job summary via `$GITHUB_STEP_SUMMARY`, plus one long-lived **"Site health" issue updated in place**, plus the HTML report as an artifact |
| Pull request | Annotations on changed lines, one collapsible PR comment with score and trend, plus the artifact |

The job summary and the updated issue matter more than they sound. A job summary needs no permissions and renders formatted markdown on the run page. A single issue that gets rewritten rather than duplicated is findable by someone who has never opened the Actions tab, notifies watchers, and accumulates a visible history in its own edit trail. Neither requires understanding CI.

**Tier 5, post-deploy sweep.** `@axe-core/cli` against the deployed sitemap, plus a link check, plus a reminder about Siteimprove registration if `.sws/manifest.yml` does not record it. Results land in the report, and optionally as a scheduled issue.

### Two workflow modes, and GitHub should be invisible in one of them

**Push to `main` deploys. Pull requests are first-class but never required.**

This is a real constraint rather than a preference, because the audience splits. An SWS engineer wants review, preview checks, and annotations on changed lines. A department administrator editing a page wants to change a word and have the site update. A workflow that requires a branch, a pull request, and a merge to fix a typo will not be used by the second group, and the honest outcome is that they go back to whatever they were doing before.

So the workflow triggers on both `push: main` and `pull_request`, and everything downstream adapts to which one fired. Concretely:

- **No branch protection, no required status checks, no protected environments.** Each of those silently converts push-to-main into a pull-request requirement. The recipe does not set them up and the checks do not ask for them.
- **The report finds the reader** rather than expecting the reader to find CI: job summary and a persistent issue on trunk pushes, annotations and a PR comment on pull requests.
- **Editing through the GitHub web UI is a supported path.** Edit a file, commit to `main`, the site updates. For many campus users this is the whole interface, and it is push-to-main by construction.
- **A CMS makes git disappear entirely.** With Storyblok, a content editor never touches GitHub: publish fires a webhook, the build runs, the site deploys. That is the real answer to "as invisible as possible" for content work, and it is why the Storyblok swap matters more for non-technical units than for engineers.
- **One workflow file.** No branch strategy to learn, no environments to configure beyond the `github-pages` one that Pages requires.

**Preview deploys, honestly.** On Netlify and Vercel, pull requests get preview URLs for free and the review experience is genuinely better. GitHub Pages has one site and no per-PR previews without extra machinery we are not going to build. So on Pages, a pull request gets **checks and a report but no preview**, and the recipe says so rather than letting someone expect otherwise.

**The secrets gate on trunk needs different words.** Blocking a pull request stops a leak from landing. Blocking a push to `main` does not, because the commit is already in the remote's history. What it does prevent is publishing the credential on a public website, which is a meaningful second exposure and worth stopping. But the message has to be useful rather than smug: the key is already in your git history, so **rotate it first**, then clean the history. A failure that only says "secret detected" teaches nothing and gets worked around.

### The recipe canary

Dropping starter packages removes our early warning system for upstream breakage. A committed template fails loudly in CI when Astro ships a breaking major; a recipe fails silently in a user's terminal six weeks later. So `recipe-canary.yml` runs weekly in our own repo: for each recipe, scaffold from scratch against current-latest, apply the recipe, run `sws check`, and open an issue if anything fails or if a resolved major version moved past what `constraints.yml` allows.

This is a strictly better trade than maintaining starters. We test the **contract** rather than a frozen instance of it, the job is roughly one workflow file, and a canary failure tells us exactly one thing: the recipe needs a sentence changed. Compare that to a starter, where the same upstream change means bumping dependencies, fixing the build, re-running a11y tests, and cutting a release across two codebases.

The canary is also what makes "install latest, pin nothing" safe rather than reckless. Consumers get current versions, and we find out about a breaking upstream release within a week, on our own repo, before a Stanford unit hits it. It keeps `reference-versions.yml` honest without anyone remembering to update it.

### The score, and why it works better than a gate

A single number, 0 to 100, weighted across accessibility, MinWeb, brand and identity, discoverability, and hygiene. It appears in the PR comment, in `sws doctor`, and as a README badge. **It trends.** The PR comment says "94, up from 91" or "88, down from 94, three new contrast findings in `Hero.astro`."

Social pressure from a visible number that your colleagues also see moves behavior at least as well as a failing build, and it does not make people uninstall the tool. It also gives SWS something it does not currently have: a comparable measure across Stanford sites.

### Risk acceptance as the pressure valve

Any finding can be acknowledged into `.sws/acknowledged.yml`:

```yaml
- check: a11y.contrast
  path: src/components/Legacy.astro
  reason: Vendor widget, contrast fix requested from vendor 2026-08-04
  accepted_by: sheamck@stanford.edu
  date: 2026-08-10
  review_by: 2026-11-10
```

Acknowledged findings drop out of the nag and into a separate "accepted risks" section of the report. This turns nagging into a documented decision trail, which is what a MinSec temporary exception actually requires anyway, and it means the honest answer to "I know, I can't fix it right now" is a supported action rather than ignoring a warning forever. `review_by` dates resurface on expiry.

### What gets checked

Mechanically checkable and shipping in v1: Global Footer link set and order, Identity Bar presence and nothing above it except skip-nav, business owner and technical admin present, HTTPS-only, accessibility link present and resolving, `robots.txt` and `sitemap.xml` present and valid, page title and meta description present and unique, heading order, image alt presence, axe-core violations at component and page level against WCAG 2.1 AA, Lighthouse performance budget, committed secrets, version pins drifted from `standards/stack/pins.yml`, Siteimprove registration recorded.

One Decanter 8 check survived the spike: `@astrojs/tailwind` present at all, which is a dead package and a known config error. The two others I had planned are gone, because testing showed the failures they guarded against do not exist. A missing `@source` is not a failure mode, and a double Tailwind import is merely redundant. Both become notes in `sws-decanter` instead of checks. This is the enforcement layer working as intended: every check must earn its place by catching a failure that actually happens.

Explicitly not automatable, and stated as such in the report: roughly 70 percent of accessibility issues per ODA's own guidance, content quality and plain language, whether the subdomain name is UComm-approved, whether a DRA is needed, and MinSec patch cadence and Qualys scanning, which live at the infrastructure layer rather than in the repo.

---

## 10. Compliance traceability

The plan is only credible if every requirement lands somewhere specific.

| Requirement | Source | Mechanism | Role |
|---|---|---|---|
| WCAG 2.1 AA conformance | Admin Guide 6.8.1, moving to 2.1 | axe in CI + manual checklist + Siteimprove + statement | a11y lead |
| Accessibility barrier reporting link | MinWeb / ODA | Footer check | a11y lead |
| Captions and audio description on new video | Accessibility policy | Content checklist, manual | content designer |
| VPAT/ACR within 12 months for purchases | UIT procurement | Procurement checklist in artifacts | compliance (stub) |
| Siteimprove criteria beyond WCAG | Siteimprove | Post-launch scan, reported alongside axe | a11y lead |
| Named business owner and technical admin | MinWeb | Wizard step 7 + footer/About check | strategist |
| MFA or SSO-with-MFA on all admin logins | MinWeb | Launch checklist, manual attest | devops |
| No API keys in Git | MinWeb | **The one blocking gate** | devops |
| HTTPS with live certificate | MinWeb | Deploy config + post-deploy check | devops |
| Subdomain reflects unit, UComm approved | UComm naming policy | Launch checklist, manual | strategist |
| Identity Bar, Global Footer, type, color, link style | Identity Guide | Footer and identity checks + Decanter | UX designer |
| Terms, Privacy, Copyright, Trademarks, Non-Discrimination links | Global Footer | Footer check | UX designer |
| Siteimprove registration | MinWeb | Manifest field + post-deploy nag | devops |
| Patch cadence 7/90 days, monthly Qualys, quarterly inventory | MinSec Applications | Dependabot + documented runbook | secops (stub) |
| Quarterly account and privilege review | MinSec | Runbook in artifacts | secops (stub) |
| Transparency notice before collection, purpose limitation | MinPriv | Privacy page template + content checklist | content designer |
| DRA before deploy when sensitive data or third parties | UIT Security | Wizard step 4 flags it, launch checklist | compliance (stub) |
| Cookie disclosure | Central Cookie Policy on www.stanford.edu | Global Footer Privacy link. **No banner, and guidance actively says not to add one** | content designer |
| Duo two-step, SAML/OIDC constraints, workgroup authz | UIT Authentication | v2, identity role | identity (stub) |

---

## 11. Design, UX, and Decanter

The design layer is where "follow our patterns" becomes real, and it is the layer most likely to be weak if we are not careful, because design knowledge resists compression into Markdown better than policy does.

**v1 approach.** `role-ux-designer` and `sws-decanter` carry Decanter 8's tokens, spacing scale, type scale, color roles, and the composition rules for the standard page furniture (Identity Bar, local header, nav, hero, local footer, Global Footer). The recipes assemble those compositions at generation time, with the byte-exact pieces coming from `fragments/` and the rest described as intent.

This is the layer where dropping starters costs the most, and it is worth being honest about that. A committed starter demonstrates a good-looking page; a recipe describes one. The mitigation is that the pieces where fidelity actually matters legally, the Identity Bar and Global Footer, are exactly the pieces we keep as normative fragments, and `docs/` is itself built from the Astro recipe, so there is always one real, current, public example to point at without maintaining it as a product.

Decanter 8's CSS-first model changes the quality of this guidance for the better. In v7 we would have been describing a JS preset's theme object in prose. In v8 the tokens are CSS custom properties in named files, so the skill can point at `decanter/colors` and `src/css/theme/spacing.css` and be right by construction. Decanter's docs at `decanter.stanford.edu` are cited rather than duplicated, with the caveat that they currently document v7.

**The design system is not monolithic, and the plan should stop implying it is.** `www.stanford.edu` does not consume Decanter. It is its own system, heavily derived from Decanter, and currently **influencing Decanter 8**. So it sits upstream of the design system rather than downstream, and it is simultaneously ahead of Decanter 8 in places and incompatible with it in others.

Three consequences for this layer. Its **brand furniture is authoritative**, because brand is brand and this is the canonical site. Its **tokens and CSS are a parallel vocabulary**, and copying them into a Decanter 8 project produces something that looks approximately right while not using the design system, a failure that passes visual review and is invisible in a screenshot. And it is a **preview of where Decanter 8 is going**, which makes it the right thing for `role-ux-designer` to read for direction and the wrong thing to match today.

This is why `prior-art/` tracks **lineage** (consumer, derived, upstream) alongside era. A linear version timeline cannot express a flagship project that feeds the system it descends from. **Open question:** when a unit wants a pattern that exists on the homesite but not yet in Decanter 8, do they wait or adopt early?

**Design tool integration is out of scope.** No design-tool connection ships in v1, and nothing in any recipe depends on one. The token surface the agent needs is already available for free and offline in `node_modules/decanter/src/css/theme/`, as CSS custom properties with stable names, which needs no account, seat, or network. That is the path every consumer gets.

**The dormant React components.** `decanter-react` and `decanter-react-forms` were last pushed in 2021 and 2022, and predate the v8 architecture entirely. The Next recipe therefore builds components against Decanter 8's CSS directly rather than depending on dormant packages. Worth confirming with the Decanter team whether revival is planned.

---

## 12. Discoverability: SEO and GEO

**SEO is settled practice** and `role-discoverability` covers it conventionally: title and description discipline, heading structure, canonical URLs, `sitemap.xml` via `@astrojs/sitemap`, internal linking, JSON-LD for `Organization`, `EducationalOrganization`, `Course`, `Event`, `Person`, `BreadcrumbList`, image and font performance, Core Web Vitals budget in CI.

**GEO research is now done, and it mostly says do less.** Full doctrine with confidence markers and sources in `standards/patterns/discoverability.md`. The headline: four things drive AI citation, per the largest available meta-analysis, and they are **be crawlable, rank in conventional search, answer the question directly, and don't suppress your own snippets.** Good SEO plus clean semantic HTML is most of GEO. Six findings changed the plan.

**`llms.txt` is not a GEO tactic.** Across 500M AI bot visits in a 90-day window, only 408 targeted `llms.txt`; 97% of published files receive zero requests; no major AI lab has committed to reading it. But **IDE coding agents fetch it routinely** (Cursor, Claude Code, Copilot, Cline, Aider), which is why Stripe, Vercel, and Anthropic ship one. So it belongs on documentation sites for the agent audience, and the earlier plan to emit one from a unit site's content collection is now explicitly discouraged.

**Structured data is not an AI retrieval factor.** Google's own May 2026 guidance states no special markup, schema, or AI text file is needed to appear in generative AI features. We still ship JSON-LD, for rich results, and the acceptance criteria now say so explicitly so nobody claims AI credit for it later.

**Google shipped an AI Overviews opt-out** in Search Console in June 2026, which corrects an assumption in the earlier draft that you could not opt out without losing Search. We recommend **against** using it: a 51-institution study found a 35% brand-mention rate but only a 10.5% owned-domain citation rate, a 24.5-point gap, and only about a third of institutions have any AI-search strategy. Stanford's problem is too few citations to stanford.edu, not too many.

**The "+40% GEO" figure is a misreading.** The underlying KDD '24 paper is real, but the first critical survey (Sciences Po, July 2026) reviewed 45 studies and found the number is a relative maximum on one metric in one fixed configuration, that no reviewed GEO technique shows a stable cross-platform causal effect, and that **GEO rewrites can cut AI retrieval by 16%**. Relatedly, Q&A and FAQ formatting for AI citation measures slightly *negative*. `role-discoverability` cites this survey prominently, because it is the fastest way to end an unproductive conversation about a retainer.

**Nothing in the standards space is enforceable yet.** IETF `aipref` has two Standards-Track drafts and no RFC. Cloudflare's Content Signals Policy has no known crawler adoption, and John Mueller said it has no effect. `ai.txt` and `noai` have no first-party compliance commitments. Track all of it, build on none of it.

**One action item with a real deadline.** From **15 September 2026** Cloudflare blocks Training and Agent bots by default for new domains and **all existing free-tier customers**. Any Stanford site on Cloudflare free tier may be silently opted into blocking AI crawlers in about five weeks. That should be a decision, not a discovery. Worth flagging to whoever owns Cloudflare zones at Stanford, independent of this project.

Also worth keeping: **DocSearch v5.0.0** (6 August 2026) ships `@docsearch/sidepanel-js` for an Ask AI surface, in the free-for-education tier. A concrete way to participate in AI answering without betting on an unproven standard.

---

## 13. Roadmap

Seven phases, roughly six months to a v1 launch to SWS. Weeks are relative; indicative dates assume a start the week of 17 August 2026.

**Phase 0, Foundations and sign-off (weeks 1 to 2, Aug 17 to Aug 28)**
Repo, pnpm workspace, GPL-3.0, CI skeleton, dogfooded `AGENTS.md`. Re-run the GEO research with search available. Send the v8 version-field and README drift notes to the Decanter team and settle the npm publish plan. Book review conversations with ODA and University Communications. **The Decanter 8 integration spike is already done** (section 3), so Phase 0 is now shorter than planned and Phase 2 is unblocked on its critical technical unknown.
*Exit: `standards/policy/*.md` drafted and in review.*

**Phase 1, Portable core (weeks 3 to 6, Aug 31 to Sep 25)**
L0 complete. The 8 built role skills, the 11 stubs, the 5 shared skills. `AGENTS.md` template at 150 lines or less. Manual install verified in Claude Code, Cursor, VS Code Copilot, Codex, and Antigravity.
*Exit: a developer can copy `.agents/skills/` into a project by hand and the roles work in five tools.*

**Phase 2, Wizard and the Astro recipe (weeks 7 to 10, Sep 28 to Oct 23)**
`@su-sws/create-web-team` with detection, emission, and scaffolder delegation. `standards/recipes/astro-static/` with its acceptance criteria and normative fragments. GitHub Pages deploy via `actions/upload-pages-artifact` and `actions/deploy-pages`. Compliant footer, identity bar, accessibility statement, and privacy page generated from day one.
*Exit: `npx` to a live, compliant GitHub Pages site in under ten minutes, with nothing vendored.*

**Phase 3, Advisory enforcement and the canary (weeks 11 to 13, Oct 26 to Nov 13)**
`sws doctor` and `sws check`, with every `acceptance.yml` criterion from the Astro recipe backed by a real check, since the recipe is only as good as its verification. HTML and JSON reports, the score, the PR comment, the trend. `.sws/acknowledged.yml`. Secrets as the single gate. axe against every built route via `@axe-core/playwright`. `recipe-canary.yml` running weekly.
*Exit: a generated project produces a useful, non-blocking report people want to read, and the canary is green.*

**Phase 4, Next recipe and real hosting (weeks 14 to 16, Nov 16 to Dec 4)**
`standards/recipes/next-static/` covering Next static export, with the unsupported-feature list stated in the recipe so nobody is surprised after the fact. Netlify and Vercel deploy paths. Preview-deploy report integration. Canary extended to both recipes.
*Exit: both recipes generate projects that deploy to all three targets.*

**Phase 5, MCP and Storyblok (weeks 17 to 20, Dec 7 to Jan 8)**
`@su-sws/mcp` against spec 2026-07-28. A Storyblok add-on recipe for the Astro path using the current `@storyblok/astro`, schema-as-code via the Storyblok CLI, and webhook-triggered rebuilds since Astro has no ISR primitive. Algolia DocSearch add-on recipe.
*Exit: a Storyblok-backed Astro site generated from recipes, and the MCP server working in at least three editors.*

**Phase 6, Pilot and launch (weeks 21 to 23, Jan 11 to Jan 29)**
Three to five real pilot projects with SWS members and one or two campus units. Docs site. Editor compatibility matrix. Onboarding session. Public launch.
*Exit: five projects using it, and a feedback loop that is actually running.*

**v2 and beyond (Feb 2027 onward)**
Drupal and Acquia recipe, which is where `decanter/minimal` genuinely belongs since Drupal themes already own base element styling. Stanford Sites and `stanford_basic` alignment. The remaining 11 roles, prioritized by pilot demand. The identity tier (SAML, OIDC, Duo, workgroups). `html-static` recipe for non-developer units on the full `decanter` entry point. Defer to `decanter-mcp` once it supports v8. Coveo where enterprise search is warranted.

---

## 14. Success metrics

| Metric | 90-day target |
|---|---|
| Sites created via the wizard | 15 |
| SWS members with it installed | 12 of the team |
| Median compliance score at first deploy | 85 or above |
| Median time from `npx` to live Pages site | under 15 minutes |
| Editors verified working | 5 or more |
| Lines of application code we maintain | **0** |
| Recipe canary green rate | above 90 percent of weekly runs |
| Uninstall or abandonment rate | under 15 percent |
| Accessibility findings caught pre-launch vs post-launch | 4 to 1 or better |
| Risk acceptances recorded with rationale | more than 0, which proves the valve is being used rather than warnings ignored |

The uninstall rate and the acceptance-register usage are the two that tell us whether "supportive but out of the way" actually landed. A high score with zero recorded acceptances probably means people are gaming or ignoring the checks.

---

## 15. Open questions and risks

### Resolved since the first draft

1. ~~Cookie and consent guidance.~~ **No banner required, Cookie Policy lives centrally on www.stanford.edu.** Guidance now actively tells units not to build one.
2. ~~Decanter's Tailwind 4 path.~~ **Decanter 8 is CSS-first on Tailwind 4.1.16 and ships before we release.** We target v8 only. The `decanter-tokens` package is cancelled and the Tailwind 3 pin is gone.
3. ~~`SU-SWS/decanter-mcp`.~~ **Not a v1 dependency.** Fine for v7 work, not for v8, and we are v8-only. Our MCP reads Decanter's own CSS instead. Revisit when `decanter-mcp` supports v8.
4. ~~WCAG framing.~~ **WCAG 2.1 AA, single track**, with Siteimprove's own criteria reported alongside.

5. ~~The Decanter 8 `@source` behavior.~~ **Tested against `8.0.0-alpha.1`. No `@source` needed.** The canonical setup is one line. See the verification table in section 3.

### Blocking, needed in Phase 0

1. **Answer the five remaining questions from the repo inspection.** Listed at the bottom of `standards/prior-art/repos.yml`. Two are already resolved: the homesite is a Decanter-derived system feeding Decanter 8, and the `cardinalsites`/`csp` pair are intentional sibling instances. The most consequential of what remains: what is `adapt-auth-sdk` and is it the sanctioned path for Stanford auth, and does a unit adopt a homesite pattern that has not yet landed in Decanter 8?

2. **Rate the prior-art catalog.** Harvesting is done: 17 live exemplars and 4 tools are in `catalog.yml`, taken from [Awesome-Decanter](https://github.com/SU-SWS/Awesome-Decanter). What is missing is the judgment layer, which is the part only SWS can supply. Every entry carries `era: unverified` and most carry `rating: TBD`, and my `use_for` values are inferred from each site's evident purpose rather than from inspection. The inspection pass is ordered by value per minute in the file, and it is fine for it to demote entries to `sound` and move on. Ten well-judged entries beat seventeen unjudged ones.

3. **Decanter 8's npm publish plan.** The alpha exists as a **git tag only**, not on the npm registry (`npm view decanter@8.0.0-alpha.1` returns 404), and `package.json` at that tag still reads `"version": "7.4.0"`. Our starters can install from the git tag today, which is how the spike ran, but shipping to campus needs a real npm version. Confirm the target date, that it publishes as `8.0.0`, and whether it goes to `latest` or a `next` tag first (that choice determines whether existing v7 consumers get pulled forward unexpectedly).
4. **Whether Decanter 8 docs will exist at release.** `decanter.stanford.edu` documents v7, and the v8 README points at file paths that do not exist. If v8 ships without docs, `sws-decanter` becomes the de facto v8 documentation for our users, which is a larger authoring job than planned and one we should not take on accidentally.
5. **The v7-to-v8 class-level delta.** The spike proved the build integration works; it did not enumerate which v7 utility and component classes changed, moved, or disappeared. `sws-decanter` needs that list to help anyone migrating an existing site, and the Decanter team almost certainly has it in an `UPGRADE.md` already (v7's exists).

### Research gaps to close

4. ~~GEO, entirely.~~ **Done.** See `standards/patterns/discoverability.md` and section 12.
5. ~~GitHub Pages action versions.~~ **Done.** `configure-pages@v5`, `upload-pages-artifact@v4`, `deploy-pages@v5`, two-job pattern, plus the dotfile-exclusion gotcha. In the recipe.
6. ~~Siteimprove's criteria beyond WCAG.~~ **Done.** Alfa engine, A/AA/AAA plus non-normative categories, proprietary site-wide weighting, Potential Issues bucket. Report design updated accordingly.
7. ~~WCAG 2.2 status and EAA applicability.~~ **Done.** WCAG 2.2 has been a full Recommendation since October 2023 and is also ISO/IEC 40500:2025; 2.0, 2.1, and 2.2 are all simultaneously valid, so a 2.1 AA target is not obsolete. WCAG 3.0 is a Working Draft with no firm timeline, Candidate Recommendation targeted around Q4 2027 and Recommendation 2028 or later. On the EAA: it targets private-sector economic operators, while EU public universities are covered by the separate Web Accessibility Directive 2016/2102, which binds member-state bodies rather than US institutions. Realistic triggers for Stanford would be an EU-established entity or selling covered consumer services into the EU, such as paid online courses or ticketing. Its technical requirements resolve to EN 301 549, which harmonises to WCAG 2.1 AA, so our target already carries most of the load. **This is inference from scope rules, not legal advice, and a real determination belongs to the General Counsel.**
8. **Netlify and Vercel platform specifics.** Still open. CLI versions are verified (netlify-cli 27.1.1, vercel 58.9.0), but `netlify.toml` and `vercel.json` schema details and 2026 platform features are not. Lower priority, since Phase 2 targets GitHub Pages.

### Standing risks

| Risk | Severity | Mitigation |
|---|---|---|
| Editor formats churn faster than we maintain | Medium | Convention-only is the mitigation. `AGENTS.md` and `SKILL.md` are the two most stable surfaces in the ecosystem, and the emitted per-editor files are thin pointers we can regenerate or delete |
| Decanter 8 stays in alpha longer than expected | Low | Now published, and the recipe installs whatever tag we point at. Change one line to move from `next` to `latest`. Do **not** add a v7 fallback path, it would become legacy we support forever |
| Decanter 8 introduces breaking changes late in its own alpha | Medium | Our Decanter surface is one line of CSS plus the token references in `sws-decanter`. The canary catches breakage weekly |
| Upstream breaks a recipe and we find out from a user | Medium | `recipe-canary.yml` weekly. This is the risk we deliberately accepted by dropping starters, and the canary is the whole mitigation, so it must ship in Phase 3 rather than slipping |
| Generated projects vary in quality because there is no template | Medium | Acceptance criteria plus `sws check`. Any requirement not backed by a check is a requirement that will not hold, which is a useful forcing function on what we bother to require |
| Astro is young, two majors in five months | Medium | Recipes install latest and record what resolved. The canary catches a breaking major within a week, and the fix is a sentence in a recipe. `legacy.collections` as the escape hatch |
| Advisory-only means nothing improves | Medium | The score, the trend, the PR comment, the badge, and the acceptance register are the behavioral design. Revisit at 90 days against the metrics in section 14 |
| Policy content goes stale | High | L0 is small, cited, and dated. Each policy file carries a `reviewed:` date and `sws doctor` nags when one is over a year old. Same nag ladder, applied to ourselves |
| Scope creep into a Drupal platform product | High | v1 is static sites to Pages. Drupal is explicitly v2. `sws-diverge` absorbs one-off requests without expanding the supported surface |
| Nobody adopts it | High | Three to five pilots in Phase 6 before public launch, and the uninstall metric as an honest tripwire |

---

## 16. Sources

**Stanford**
[SWS](https://uit.stanford.edu/sws) · [Stanford Sites](https://uit.stanford.edu/service/stanfordsites) · [Minimum Security Standards](https://uit.stanford.edu/guide/securitystandards) · [Risk classifications](https://uit.stanford.edu/guide/riskclassifications) · [Data Risk Assessment](https://uit.stanford.edu/security/dra) · [Minimum Web Standards](https://uit.stanford.edu/guide/webstandards) · [Minimum Privacy Standards](https://uit.stanford.edu/guide/privacystandards) · [Accessibility policy](https://uit.stanford.edu/accessibility/policy) · [Admin Guide 6.8.1](https://adminguide.stanford.edu/chapters/computing/digital-accessibility/accessibility-electronic-content) · [Office of Digital Accessibility](https://uit.stanford.edu/accessibility) · [Footer accessibility guide](https://uit.stanford.edu/accessibility/guides/web-applications/footer) · [Siteimprove](https://uit.stanford.edu/accessibility/testing/siteimprove) · [Accessibility procurement](https://uit.stanford.edu/accessibility/procurement) · [Brand compliance](https://identity.stanford.edu/digital/web-design/brand-compliance/) · [stanford.edu naming policy](https://ucomm.stanford.edu/policies-and-guidance/stanfordedu-name-assignment-policy) · [Cookie Policy](https://www.stanford.edu/cookie-policy/) · [Online Privacy Policy](https://www.stanford.edu/site/privacy/) · [Privacy Office](https://privacy.stanford.edu) · [Authentication](https://uit.stanford.edu/service/authentication) · [SAML](https://uit.stanford.edu/service/saml) · [OIDC](https://uit.stanford.edu/service/oidc) · [Two-step](https://uit.stanford.edu/service/authentication/twostep) · [Workgroup API 2.0](https://uit.stanford.edu/developers/apis/workgroup2.0) · [MaIS APIs](https://uit.stanford.edu/developers/apis)

**Decanter**
[Docs (v7)](https://decanter.stanford.edu/) · [Repo](https://github.com/SU-SWS/decanter) · **[v8 branch](https://github.com/SU-SWS/decanter/tree/v8)** · [v8 package.json](https://github.com/SU-SWS/decanter/blob/v8/package.json) · [v8 src/css/index.css](https://github.com/SU-SWS/decanter/blob/v8/src/css/index.css) · [v8 src/css/theme](https://github.com/SU-SWS/decanter/tree/v8/src/css/theme) · [v8 README](https://github.com/SU-SWS/decanter/blob/v8/README.md) · [Installation (v7)](https://decanter.stanford.edu/for-developers/installation) · [FAQ](https://decanter.stanford.edu/decanter-faq) · [npm](https://www.npmjs.com/package/decanter) · [stanford_basic](https://github.com/SU-SWS/stanford_basic)

**Agent standards**
[agents.md](https://agents.md) · [spec repo](https://github.com/agentsmd/agents.md) · [Agent Skills spec](https://agentskills.io/specification) · [Claude Code docs](https://code.claude.com/docs) · [Agentic AI Foundation](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation) · [Cursor rules](https://cursor.com/docs/rules) · [VS Code custom instructions](https://code.visualstudio.com/docs/agent-customization/custom-instructions) · [Copilot custom instructions support](https://docs.github.com/en/copilot/reference/custom-instructions-support) · [Antigravity rules and workflows](https://antigravity.google/docs/rules-workflows) · [Devin rules](https://docs.devin.ai/cli/extensibility/rules) · [MCP spec 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28) · [MCP registry](https://registry.modelcontextprotocol.io) · [rulesync](https://github.com/dyoshikawa/rulesync) · [ruler](https://github.com/intellectronica/ruler)

**Discoverability and AI crawlers**
[Google AI features guidance](https://developers.google.com/search/docs/appearance/ai-features) · [Google Search AI controls](https://blog.google/products-and-platforms/products/search/search-ai-features-controls/) · [OpenAI bots](https://developers.openai.com/api/docs/bots) · [Anthropic crawler](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) · [IETF aipref WG](https://datatracker.ietf.org/wg/aipref/about/) · [Cloudflare Content Signals](https://blog.cloudflare.com/content-signals-policy/) · [Cloudflare AI traffic changelog](https://developers.cloudflare.com/changelog/post/2026-07-01-ai-traffic-options/) · [Cloudflare crawl-to-refer](https://blog.cloudflare.com/ai-search-crawl-refer-ratio-on-radar/) · [Perplexity stealth crawlers](https://blog.cloudflare.com/perplexity-is-using-stealth-undeclared-crawlers-to-evade-website-no-crawl-directives/) · [GEO paper, KDD '24](https://arxiv.org/abs/2311.09735) · [Critical survey of 45 GEO studies](https://arxiv.org/abs/2607.14035) · [Q&A formatting study](https://arxiv.org/abs/2604.25707) · [Publisher blocking study](https://arxiv.org/html/2512.24968v4) · [AI citation factors meta-analysis](https://signal.zyppy.com/p/ai-citation-ranking-factors) · [UPCEA higher-ed AI search gap](https://upcea.edu/ai-search-gap-higher-education/) · [ai.robots.txt UA list](https://github.com/ai-robots-txt/ai.robots.txt)

**Accessibility tooling and standards**
[WCAG 2.2](https://www.w3.org/TR/WCAG22/) · [WCAG overview](https://www.w3.org/WAI/standards-guidelines/wcag/) · [ACT rules implementations](https://w3c.github.io/wcag-act/act-implementations.html) · [Siteimprove A/AA/AAA scoring](https://help.siteimprove.com/support/solutions/articles/80000448503-levels-a-aa-aaa-errors-in-siteimprove-accessibility-explained) · [Siteimprove target score](https://help.siteimprove.com/support/solutions/articles/80001152008-accessibility-site-target-score) · [Siteimprove checks guide](https://help.siteimprove.com/support/solutions/articles/80000448514) · [Siteimprove API IDs](https://help.siteimprove.com/support/solutions/articles/80000448497)

**Deployment**
[GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) · [deploy-pages releases](https://github.com/actions/deploy-pages/releases) · [upload-pages-artifact releases](https://github.com/actions/upload-pages-artifact/releases) · [configure-pages releases](https://github.com/actions/configure-pages/releases) · [Artifact v3 deprecation for Pages](https://github.blog/changelog/2024-12-05-deprecation-notice-github-pages-actions-to-require-artifacts-actions-v4-on-github-com/)

**Stack**
[astro](https://www.npmjs.com/package/astro) · [@astrojs/tailwind](https://www.npmjs.com/package/@astrojs/tailwind) · [next](https://www.npmjs.com/package/next) · [tailwindcss](https://www.npmjs.com/package/tailwindcss) · [axe-core](https://www.npmjs.com/package/axe-core) · [@axe-core/playwright](https://www.npmjs.com/package/@axe-core/playwright) · [@storyblok/astro](https://www.npmjs.com/package/@storyblok/astro) · [netlify-cli](https://www.npmjs.com/package/netlify-cli) · [vercel](https://www.npmjs.com/package/vercel) · [node](https://www.npmjs.com/package/node) · [npm](https://www.npmjs.com/package/npm)

---

## Appendix A: reference versions as of 10 August 2026

**These are reference points, not pins.** Because we generate rather than vendor, recipes install at current latest and record what they resolved. This list is what "current" looked like on 10 August 2026, verified against the npm registry, and it exists so the canary and `standards/stack/constraints.yml` have a baseline to compare against. Recipes cite **constraints** (Node 24 LTS or newer, Tailwind 4, Decanter 8, no `@astrojs/tailwind`), which are durable, rather than these numbers, which are not.

The GitHub Actions triplet is **not** in this list because it could not be verified.

```yaml
runtime:
  node: "24.15"          # Active LTS. Not 20 (ruled out by engines), not 26 (Current)
  pnpm: "11.21.0"
  npm: "12.0.2"          # requires node 24.15+

astro:
  astro: "7.2.0"
  "@astrojs/mdx": "7.0.5"
  "@astrojs/sitemap": "3.7.3"
  "@astrojs/react": "6.0.2"
  "@astrojs/netlify": "8.2.0"
  "@astrojs/vercel": "11.0.5"

next:
  next: "16.3.0"

styling:
  # decanter 8.0.0-alpha.1 is now published to npm, on the `latest` dist-tag.
  # A bare `npm i decanter` therefore installs the alpha. See section 3.
  # Recipe should install `decanter@next` once the dist-tags are corrected.
  decanter: "8.0.0-alpha.1"
  tailwindcss: "^4.1.16"       # decanter 8's own dependency; came in transitively
  "@tailwindcss/vite": "4.3.3" # the Astro compile path
  "@tailwindcss/typography": "0.5.20"
  # @tailwindcss/forms arrives via decanter's dependencies
  # DO NOT USE @astrojs/tailwind: dead since Astro 6, last published 2025-03-26

# No component workshop. Deliberate: see section 3.

testing:
  "axe-core": "4.13.0"
  "@axe-core/playwright": "4.12.1"
  "@axe-core/cli": "4.12.1"
  "@playwright/test": "1.62.1"
  vitest: "4.1.10"
  vite: "8.2.1"

cms:
  "@storyblok/astro": "10.2.3"
  "@storyblok/react": "7.2.4"
  storyblok: "4.22.0"          # CLI

search:
  "@docsearch/react": "5.0.0"
  algoliasearch: "5.56.0"
  "react-instantsearch": "7.42.0"

hosting:
  "netlify-cli": "27.1.1"
  vercel: "58.9.0"
github_actions:                # verified 2026-08-10; check releases at gen time
  "actions/configure-pages": v5
  "actions/upload-pages-artifact": v4   # NOTE: excludes dotfiles
  "actions/deploy-pages": v5            # v4 also valid; must be >= artifact major
  # artifact actions v3 are no longer supported for Pages (Dec 2024 deprecation)
```

## Appendix B: the verified Decanter 8 integration

Built and confirmed working against `decanter@8.0.0-alpha.1`, `astro@7.2.0`, `@tailwindcss/vite@4.3.3`. This is the whole integration, and it is short enough to be the core of `recipes/astro-static/RECIPE.md` rather than a template. No `tailwind.config.js`, no `@source`, no Astro Tailwind integration.

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  vite: { plugins: [tailwindcss()] },
});
```

```css
/* src/styles/global.css */
@import 'decanter';
```

```astro
---
// src/pages/index.astro
import '../styles/global.css';
---
<div class="mt-8 text-cardinal-red bg-black-30 type-2">
  <a class="button">Works</a>
</div>
```

Confirmed generating: arbitrary utilities (`mt-[719px]`), Decanter color tokens, opacity modifiers (`text-cardinal-red/33`), Decanter utilities (`type-2`), and Decanter components (`.button`). Output 11.7 KB for the full entry point, 9.9 KB for `decanter/minimal`, the difference being base element styles only.
