# Recipe: astro-static

**Generate a compliant Stanford static site with Astro, Decanter 8, and GitHub Pages.**

| | |
|---|---|
| Recipe ID | `astro-static` |
| Status | Draft. Executed end to end on 2026-08-10 |
| Versions | **None specified by design.** Install latest. See below |
| Compliance tier | Low risk. Escalate to `moderate` overlay if the site collects personal data |
| Acceptance | `acceptance.yml` in this directory |

## When to use this

Public-facing informational Stanford site: department, lab, program, project, event, or documentation. Content is authored in the repo or comes from Storyblok. No user accounts, no personal data collection, no server-side logic.

**Do not use this for:** anything requiring authentication (needs the identity overlay, not yet written), anything storing personal or research data (needs a DRA first), or a site a non-technical unit will maintain alone (point them at Stanford Sites instead, it is free and already compliant).

## Before you generate anything

**Step 0 is not optional: check prior art.** SWS has built a lot of sites. Most of what a new site needs has been solved, and reinventing it produces worse work slower.

```
1. Run:  sws prior-art find "<what you are about to build>"
2. Read what it returns before writing code.
3. Record what you reused in .sws/manifest.yml under `prior_art`.
```

For this recipe specifically, start with these three:

| Reference | For |
|---|---|
| [`sws-astro`](https://github.com/SU-SWS/sws-astro) (`main`) | The canonical Astro + Decanter 8 + Tailwind 4 wiring |
| [`ccc-bulletin`](https://github.com/SU-SWS/ccc-bulletin) (`dev`) | Decanter 8 on Next, plus current Storyblok and a full test setup |
| [`adapt-stanford-homesite`](https://github.com/SU-SWS/adapt-stanford-homesite) (`dev`) | `www.stanford.edu` itself. The reference for testing rigour and shipped page furniture |

**Mind the default branch.** It is `main` for `sws-astro`, `dev` for the ADAPT and OOD family, and `1.x` for the decoupled Drupal repos. A pointer without an explicit ref reads the wrong branch silently.

**Precedence rule, absolute:** prior art tells you *how we solved a shape of problem*. Current standards tell you *what to build with*. When they disagree, standards win, every time, with no exceptions. An SWS site from 2023 is a legitimate reference for navigation structure, content modelling, and component composition. It is never a reference for Decanter version, Tailwind syntax, WCAG target, or build tooling. See `standards/prior-art/README.md`.

## Constraints

Cite these, not version numbers. Verify at generation time and record what resolved.

**The canonical reference for this recipe is [`SU-SWS/sws-astro`](https://github.com/SU-SWS/sws-astro).** It is SWS's own Astro + Decanter + Tailwind implementation. When this recipe and that repo disagree, investigate before assuming the recipe is right.

### Install latest. Do not pin.

This recipe deliberately **does not specify versions**. Install the current release of everything and let the resolver do its job. Version numbers in a document start rotting the day they are written, and a recipe that names them turns into a starter template with extra steps.

There is exactly one exception, and it exists because a dist-tag makes it easy to get wrong:

| Constraint | Why it is load-bearing |
|---|---|
| **Decanter 8, not 7** | v7 is a Tailwind 3 JS preset and v8 is CSS-first. This is a breaking architecture change, and `npm i decanter` currently resolves to v7. Everything else in this recipe follows from getting this right |

Tailwind 4 needs no separate constraint: it arrives transitively through Decanter 8. Node needs no constraint: whatever the current Astro requires is what you need. Astro majors need no constraint: use the latest.

Three things to **avoid** rather than pin:

- **No `@astrojs/tailwind`.** Dead package. Use `@tailwindcss/vite`.
- **No `tailwind.config.js`.** Decanter 8 has no JS config; creating one signals a v7 mental model.
- **No `output: 'hybrid'`.** Removed from Astro. Use `'static'`.

If a resolved major turns out to break this recipe, that is a finding for the recipe canary to report and a sentence for us to change, not a reason to freeze consumers on old versions.

## Steps

### 1. Scaffold with the upstream tool

Do not hand-write project boilerplate and do not copy a template. Run the official scaffolder at current latest:

```bash
npm create astro@latest -- --template minimal --typescript strict --no-install --no-git
```

Then record what resolved, for the manifest rather than for a gate:

```bash
node -p "require('./node_modules/astro/package.json').version"   # after install
```

Record it, do not judge it. The point is that the manifest and the compliance report can say what this project actually runs. There is no version to compare against.

**If the scaffolder fails, do not abandon the recipe.** `create-astro` performs a connectivity precheck and fetches templates from `codeload.github.com`, which is blocked on some Stanford networks, in CI sandboxes, and behind some proxies. Observed failure mode is `error Unable to connect to the internet` even when the npm registry is reachable.

Fallback, in order:

1. Retry on a different network, or set `HTTPS_PROXY` appropriately.
2. If still blocked, hand-create the four files the minimal template contains: `package.json` with `astro` plus a `build` script, `astro.config.mjs`, `tsconfig.json` extending `astro/tsconfigs/strict`, and `src/pages/index.astro`. That is a documented fallback, not a template we maintain, and steps 2 through 8 are unchanged.

The recipe is the artifact and the scaffolder is a convenience over it. Never block a user because an upstream tool could not reach the network.

### 2. Install dependencies

```bash
npm install
npm install -D @tailwindcss/vite @astrojs/sitemap
npm install decanter
```

**Confirm you got Decanter 8, because getting 7 fails silently.** v7 is a Tailwind 3 JS preset and v8 is CSS-first, so nothing else in this recipe works against v7. If `latest` has not moved to 8.x in your environment, install `decanter@^8` explicitly.

You will also see the **git form** in existing SWS projects, and it is valid:

```json
"decanter": "github:SU-SWS/decanter#v8"                   // sws-astro
"decanter": "https://github.com/SU-SWS/decanter.git#v8"   // ccc-bulletin
```

Both predate the npm publish. Prefer the npm form for new work, since it is versioned and lockfile-friendly, but never flag the git form as an error.

Verify, because the failure is silent:

```bash
node -p "require('./node_modules/decanter/package.json').version"     # expect 8.x
node -p "require('./node_modules/decanter/package.json').main"        # expect src/css/index.css
ls node_modules/decanter/node_modules 2>/dev/null                     # expect nothing
```

If `main` is `tailwind.config.js` you have v7. If `node_modules/decanter/node_modules/tailwindcss` exists, you have v7 **and** a nested Tailwind 3 sitting underneath a top-level Tailwind 4, which produces a build that half works and error messages that make no sense. Delete `node_modules` and the lockfile and reinstall with the right tag.

`tailwindcss` and `@tailwindcss/forms` arrive transitively through Decanter 8. Verified. Do not install them directly.

### 3. Wire Tailwind and Decanter

`astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://<unit>.stanford.edu',   // required for sitemap + canonical URLs
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  vite: { plugins: [tailwindcss()] },
});
```

`src/styles/global.css` is **one line**:

```css
@import 'decanter';
```

That is the entire integration. Specifically:

- Do **not** add `@import 'tailwindcss'`. Decanter's `index.css` already does it. Doing both is harmless but redundant, costing about 340 bytes.
- Do **not** add `@source`. Verified unnecessary: Tailwind roots source detection at the entry CSS file's project, not at the file containing the `tailwindcss` import. Adding it produces byte-identical output.
- Do **not** create `tailwind.config.js`.
- Use `decanter/minimal` **only** when something else already owns base element styling, which for a fresh Astro site it does not. The only difference is a lighter base reset (623 bytes versus 3,286), not a reduced token or component set.

`site` is not optional. Without it `@astrojs/sitemap` emits nothing and canonical URLs are wrong, which fails two acceptance criteria.

### 4. Build the required page furniture

Every page uses one layout containing, in this order:

1. Skip navigation link. The only thing permitted above the Identity Bar.
2. **Stanford Identity Bar.** Use `fragments/identity-bar.html`. Nothing may go above it except the skip link.
3. Local header, navigation, and page content. Unit-specific, design freely within Decanter.
4. Optional local footer.
5. **Stanford Global Footer.** Use `fragments/global-footer.html` verbatim.

**The Global Footer is immutable.** Per the Stanford Identity Guide its links may not be altered, reordered, or added to, and nothing else may go inside it. Unit links belong in the local footer above it. This is the single highest-value automated check in the system, so expect `sws check` to be strict about it.

**The contract is `standards/fragments/global-footer.yml`**, extracted from the upstream `decanter-web` component and read directly by `sws check`. Three things there that are easy to get wrong:

- The links are in **two lists inside one `<nav>`**, four then six, not a single list of ten.
- Trademarks points at **Admin Guide policy 1.5.4**, not `trademarks.stanford.edu`.
- Non-Discrimination points at **Student Services**, not `equity.stanford.edu`.

The last two were wrong in this project's first draft, which is a good argument for reading the fragment rather than typing the footer from memory. The copyright block is two lines, including the Stanford, California 94305 address.

### 5. Required content

| What | Where | Notes |
|---|---|---|
| Accessibility link | Global Footer | Points at `https://www.stanford.edu/site/accessibility`. Satisfies the barrier-reporting requirement |
| Privacy link | Global Footer | Points at the central policy. **Do not build a cookie banner.** None is required, and a hand-rolled one implies a consent mechanism that does not exist. If someone insists they need consent management, do not evaluate vendors: send them to the [University Privacy Office](https://privacy.stanford.edu) |
| Business owner + technical admin | `src/pages/about.astro` footer or About page | MinWeb requires both be identifiable, with valid Stanford affiliation and email |
| Page title + meta description | Every page | Unique per page |
| `robots.txt` | `public/robots.txt` | Sitemap reference, plus explicit AI crawler sections. Allow retrieval bots (`OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`, `Googlebot`, `Bingbot`); treat training crawlers as a unit policy decision. See `standards/patterns/discoverability.md` |
| JSON-LD | Layout | `EducationalOrganization` or `Organization`, plus `BreadcrumbList`. **For rich results, not for AI citation** — Google states no special markup is needed for generative AI features |
| `llms.txt` | Skip it | **Do not add one to a marketing site.** Verified: 97% of published `llms.txt` files receive zero requests and AI search crawlers read HTML directly. It is fetched by IDE coding agents, so it belongs on documentation sites only |

### 6. Motion and animations (optional, recommended for marketing sites)

Motion increases engagement when used purposefully, but it must serve the content, not distract from it. Use motion to:

- **Guide attention**: Draw focus to key CTAs or benefits
- **Improve perceived performance**: Fade elements in while content loads
- **Reward interaction**: Smooth transitions on hover and click
- **Establish brand tone**: Motion is a design choice, not a default

Use **Framer Motion** for animations. It integrates cleanly with Astro islands and respects accessibility preferences out of the box.

```bash
npm install framer-motion
```

**Key rule**: Things inside moving things should not also move. Parent animations take priority; child elements stay static.

**Guidelines:**

1. **Respect `prefers-reduced-motion`**: Always honor OS-level motion preferences. Framer Motion respects this automatically with the `AnimatePresence` API, but also provide a CSS fallback:

   ```css
   @media (prefers-reduced-motion: reduce) {
     * {
       animation-duration: 0.01ms !important;
       transition-duration: 0.01ms !important;
     }
   }
   ```

2. **Keep animations brief**: 300–600ms for most interactions. Longer than 800ms feels sluggish.

3. **Use appropriate easing**: `easeOut` for entrances (feels snappy), `easeInOut` for state changes.

4. **Common patterns with Framer Motion:**
   - **Fade-in on scroll**: Wrap sections in `<motion.div>` with `initial={{ opacity: 0 }}` and `whileInView={{ opacity: 1 }}`.
   - **Button hover lift**: Use `whileHover={{ y: -2 }}` with shadow via className.
   - **Scale on hover**: `whileHover={{ scale: 1.05 }}` for gentle growth.
   - **Staggered animations**: Use `staggerChildren` for sequential child animations.
   - **Avoid nested motion**: Parent container animates; children remain static. Do not animate both a parent and child element independently.

5. **Performance**: Framer Motion uses `transform` and `opacity` by default (GPU-accelerated). Let the library handle optimization.

6. **Testing**: Verify animations work smoothly at typical device speeds. A 60fps target means 16.67ms per frame. Test on real devices, not just desktop browsers.

7. **Accessibility in motion**:
   - Animations must not auto-play audio or video without user consent.
   - Avoid flashing or strobing (3+ flashes per second) — this can trigger seizures.
   - Provide text alternatives or skip animations for critical content.

**Example: Fade-in on scroll with Astro island**

```tsx
'use client';

import { motion } from 'framer-motion';

export default function FadeInSection({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      viewport={{ once: true, amount: 0.3 }}
    >
      {children}
    </motion.div>
  );
}
```

**When not to use motion**: Static informational or documentation sites gain little from animations and risk appearing less serious or harder to scan. Opt out by simply not defining animations.

### 7. Accessibility harness

Target is **WCAG 2.1 AA**.

```bash
npm install -D @playwright/test @axe-core/playwright
npx playwright install --with-deps chromium
```

Add a test that walks every route in the built output and asserts zero violations tagged `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`.

**Playwright is the forward direction** even though existing SWS repos use Cypress. `adapt-stanford-homesite`, `adapt-directory`, and `ccc-bulletin` all run Cypress with e2e and component testing, so expect to see it, and do not convert an existing project. New work uses Playwright.

Two things this harness does **not** cover, and the report must say so:

- Roughly 70 percent of accessibility issues, per ODA guidance. A green run is a floor, not conformance. The manual checklist in `role-accessibility-lead` covers the rest.
- **Content authored after launch.** Everything here tests the built site at build time. It says nothing about what an editor publishes next week. If this site gets a CMS, see the `sa11y` note in the Storyblok swap below, which is how SWS gives authors a11y feedback while they edit.

Siteimprove applies further criteria after launch, and its registration is a MinWeb requirement.

**No component workshop.** This recipe does not set up a browsable component library. A department program site has a handful of components and one consumer, so the workshop costs more to maintain than it returns, and Astro support for the usual tooling is community-maintained anyway. Test the rendered pages.

If you later need **component-level** a11y assertions, Vitest plus `axe-core` against rendered components gets you there without a workshop. Reach for that when a component library gains real reuse across projects, not before.

State plainly in the project's own docs that automated testing catches roughly 30 percent of accessibility issues, per ODA guidance. The manual checklist in `role-accessibility-lead` covers the rest, and Siteimprove applies further criteria after launch.

### 8. Deploy to GitHub Pages

**Push to `main` deploys. Pull requests are supported but never required.**

Trigger on both, and let the deploy job decide:

```yaml
on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:
```

Then gate only the deploy: `if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'`. A pull request gets a build plus `sws check`; a push to `main` gets a build, `sws check`, and a deploy.

**Do not set up branch protection, required status checks, or a protected environment beyond `github-pages`.** Each one quietly turns push-to-main into a pull-request requirement, and this recipe's audience includes people editing a page through the GitHub web UI who will not open a pull request to fix a typo.

Note that GitHub Pages serves **one site**, so a pull request gets checks but **no preview URL**. Netlify and Vercel give per-PR previews for free, which is a real reason to move once review matters. Say so rather than letting someone expect previews here.

Use the first-party actions in the documented **two-job** pattern: a `build` job running `configure-pages` → build → `upload-pages-artifact`, and a `deploy` job with `needs: build` running `deploy-pages`.

Current majors as of August 2026: `actions/checkout@v5`, `actions/setup-node@v6`, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v4`, `actions/deploy-pages@v5` (v4 also valid). Check the release pages at generation time rather than trusting this line.

Two version traps. `upload-pages-artifact@v4` requires `deploy-pages@v4` or newer, and **artifact actions v3 are no longer supported for Pages** as of a December 2024 deprecation. Separately, **older action majors emit a Node 20 deprecation warning**: Node 24 became the default JavaScript action runtime in 2026 and Node 20 is being removed from hosted runners, so `checkout@v4` and `setup-node@v4` produce noise even though they still run. Use the current majors.

Required, and not optional:

```yaml
permissions:
  contents: read      # checkout
  pages: write        # create the Pages deployment
  id-token: write     # OIDC token that deploy-pages verifies
  issues: write       # update the persistent "Site health" issue on trunk
  pull-requests: write  # PR comment, when a PR is what fired
concurrency:
  group: pages
  cancel-in-progress: false
# on the deploy job only:
environment:
  name: github-pages
  url: ${{ steps.deployment.outputs.page_url }}
```

`issues: write` and `pull-requests: write` exist so the advisory report can reach a reader in either mode. Drop either one and the corresponding report destination silently stops working.

On `cancel-in-progress: false`: this follows GitHub's Pages guidance and means queued runs all execute in order, so nothing gets skipped. If your editors make many rapid small edits and only the latest matters, `true` is faster. Either is defensible; know which you chose.

**Set repo Settings → Pages → Source to "GitHub Actions" before the first run.** This is outside the workflow, it is the single most commonly forgotten step, and the failure it produces does not obviously point at it:

```
Branch "main" is not allowed to deploy to github-pages
due to environment protection rules.
```

That message reads like a permissions problem. It usually means Pages source is still "Deploy from a branch", so the `github-pages` environment kept its default deployment-branch protection. Switching the source reconfigures the environment. If it persists, check Settings → Environments → github-pages → Deployment branches and allow your default branch.

Worth knowing that this project forgot it on the first run of its own Pages workflow, having written the warning one paragraph earlier.

**Two gotchas that will cost you an afternoon:**

1. **`upload-pages-artifact@v4` excludes dotfiles.** If the build output needs `.nojekyll`, `.well-known/`, or any other hidden file, verify it survives the artifact or build the tar yourself. Astro does not normally need `.nojekyll`, but anything serving `.well-known` will.
2. **Subpath deploys need `base`** set in `astro.config.mjs`. Without it, internal links work locally and break in production.

Branch-based deploys and `peaceiris/actions-gh-pages` still function but are the legacy path; that action's own README points users to the official one. Prefer artifact-based deployment for new work.

### 9. Verify

```bash
npx astro build
sws check
```

Fix what the report flags, or record a deliberate exception in `.sws/acknowledged.yml` with a reason and a `review_by` date. Everything is advisory except committed secrets.

## Swap points

Deviation is expected and supported. Each swap below is legitimate; the cost column is what you take on by choosing it.

| Swap | Cost |
|---|---|
| Next.js instead of Astro | Static export forfeits `redirects`, `headers`, `rewrites`, Proxy, ISR, Server Actions, and default-loader image optimization. Route Handlers become `GET`-only. Use `next-static` recipe |
| yarn instead of npm | Fine. npm is primary at SWS, yarn secondary, and both are in production use. Respect whatever the project already has and never convert it. Advice touching dependency overrides must be manager-aware, since npm `overrides` and yarn `resolutions` differ |
| Netlify instead of Pages | Expected as the second step, and **Netlify is where SWS runs**: functions, blobs, edge functions, CSP nonce plugin, and Vault-backed env vars are all in production use. MinWeb HTTPS and live-certificate requirements become yours to satisfy |
| Vercel instead of Netlify | Supported, but it means leaving the platform every other SWS project uses, so you lose the shared tooling and the institutional knowledge with it |
| Cypress instead of Playwright | Reasonable if the project already has Cypress, which three SWS repos do. Playwright is the forward default; do not convert an existing Cypress suite just to match |
| `clsx` + `tailwind-merge` instead of `cnbuilder` | Both are in SWS use. `cnbuilder` in the Astro and Storyblok families, `clsx` + `tailwind-merge` in the decoupled Drupal family. Pick one per project, not per file |
| No Decanter | Identity Bar and Global Footer become hand-maintained, and every brand and a11y check still applies with nothing helping you pass them. Rarely worth it |
| `decanter/minimal` | Only if something else owns base element styles. On a fresh Astro site this just removes needed resets |
| Storyblok for content | **The real answer for non-technical units**: an editor never touches GitHub, because publishing fires a webhook that builds and deploys. Fetch at build time with `version: 'published'`. Astro has no ISR primitive, so freshness comes from webhook-triggered rebuilds. Keep the Visual Editor bridge in a preview-only build. **Add `sa11y` to the Visual Editor overlay**: it gives content authors accessibility feedback while they edit, which is the only way to catch issues in content published after launch. Every SWS Storyblok project does this |
| Algolia DocSearch for search | Recommended default. Free for public education content, no crawler to run |
| Coveo instead of Algolia | Enterprise licensing and sales-gated. Atomic web components drop into Astro islands cleanly, but it is over-scoped for most unit sites |
| Tailwind 3 | **Not a supported swap.** Decanter 8 requires Tailwind 4 |

Record every swap in `.sws/manifest.yml` under `divergences`, with a one-line reason. That record is what lets the next person understand the project, and it is what `sws doctor` reads to stop nagging about a choice you already made deliberately.

## Known gotchas

1. **Installing `decanter` without a tag.** Gets v7. The single most likely way to fail this recipe. See step 2.
2. **A nested `node_modules/decanter/node_modules/tailwindcss`.** Means v7 crept in under a v4 top level. Half-working build, nonsensical errors.
3. **Missing `site` in config.** Silently breaks the sitemap and canonical URLs.
4. **Subpath deploys without `base`.** Works locally, breaks in production.
5. **Reaching for `tailwind.config.js`.** Signals a Decanter 7 mental model. There is no JS config in v8.
6. **Installing `@astrojs/tailwind`.** Dead package. Will appear to work, then fail.
7. **Adding unit links to the Global Footer.** They go in the local footer above it.
8. **Building a cookie consent banner.** Not required at Stanford, and a homegrown one is worse than none.
9. **Assuming a green axe run means conformance.** It means roughly 30 percent of issues are absent.
10. **Trusting an a11y result that never ran.** axe needs a real browser. If Chromium is unavailable the result is "unknown," not "clean." `sws check` reports those differently and so should you.

## Provenance

**This recipe has been executed end to end**, not just written. On 2026-08-10, following it literally produced a building two-page Astro site with Decanter 8 and Tailwind 4 at then-current versions, and 18 of the 20 automatable acceptance criteria were verified passing against the built output. Confirmed applying correctly: Decanter tokens (`text-cardinal-red`, `text-black-70`), Decanter utilities (`type-2`, `type-3`), Decanter components (`.button`), and arbitrary Tailwind utilities from `.astro` markup (`mt-[19px]`).

The Decanter 8 integration in step 3 was separately verified with a controlled test confirming `@source` has no effect on output. See Appendix B of the project plan.

Defects found by executing rather than reviewing, all now fixed above: the wrong Decanter dist-tag (`@next` does not exist), the nested-Tailwind trap, the scaffolder's network precheck, and two acceptance criteria whose prose was too loose to check correctly.

**Not yet verified:** the Global Footer link set in `fragments/global-footer.html` against the current Identity Guide, and the GitHub Pages action versions. Both are marked in place.
