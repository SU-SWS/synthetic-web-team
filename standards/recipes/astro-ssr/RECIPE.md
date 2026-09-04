# Recipe: astro-ssr

**Generate a compliant Stanford Astro site with Decanter 8, served with a
runtime.**

| | |
|---|---|
| Recipe ID | `astro-ssr` |
| Status | Draft. **Not executed end to end.** See Provenance |
| Compliance tier | Low risk. Escalate to `moderate` if the site collects personal data |
| Acceptance | `acceptance.yml` in this directory, which extends `astro-static` |
| Hosting | Netlify or Vercel. Pick per `standards/hosting/` |
| Content source | **The repo. No CMS** — see `standards/scope.md` |
| Versions | **None specified by design.** Install latest |

## This recipe is `astro-static` plus two things

Read [`astro-static/RECIPE.md`](../astro-static/RECIPE.md) first and follow it.
Everything about Decanter, Tailwind, the Identity Bar, the Global Footer,
required content, motion, and the accessibility harness is **identical** and is
not repeated here. Duplicating it would guarantee it drifts.

The only differences are:

1. An **adapter** and `output: 'server'` instead of `output: 'static'`.
2. **Response headers**, which a static build cannot send.

If you do not need item 2 or a server runtime, **stop and use `astro-static`.**
It is free to host, has fewer moving parts, and is cheaper to keep compliant.

## When to use this

You need one or more of:

- **Response headers** — the default security set in
  `standards/hosting/capabilities.yml`.
- **Real redirects and rewrites**, which matters if the site replaces a legacy
  site with inbound links. `sulgryphon-nextjs`'s `vercel.json` is the reference:
  nine rules catching `/node/*`, `/wp-content/*`, `*.php`.
- **Server-rendered routes** — a search results page, a form handler, content
  that must be fresh per request.

**A runtime does not mean a CMS.** Content still comes from the repo; see
`standards/scope.md`. Server rendering here is for headers, redirects, search,
and forms, not for fetching content from a backend.

**Be honest about the size of this.** MinWeb requires none of it. Headers are
good engineering, not policy. A twelve-page department site needs none of this
and should be static.

**Prefer this over `next-ssr` for a content site.** Same capability, much less
weight, and no React unless you ask for it via `@astrojs/react` islands. Reach
for Next when you actually want the React ecosystem or a decoupled Drupal front
end, not for headers alone.

## Choosing a host

**SWS runs both Netlify and Vercel**, one per family, and neither is a house
default. Full profiles are in `standards/hosting/`.

| If the unit... | Host |
|---|---|
| Already administers a Netlify account | **Netlify.** `standards/hosting/netlify.yml` |
| Already administers a Vercel account | **Vercel.** `standards/hosting/vercel.yml` |
| Has neither, and wants the better-trodden path | Netlify, to inherit the ADAPT family's Vault wiring |
| Has neither and no budget | You want `astro-static` on GitHub Pages |

An account someone already knows how to administer beats any shared-tooling
argument. Record the choice in `.sws/manifest.yml` under `hosting`, and do not
introduce a third host on your own — that is a procurement question for the
office, not a technical preference.

**Note on prior art:** no SWS Astro project runs SSR today. `sws-astro` is
static and has no deploy config at all. So this recipe's Astro-plus-Decanter
half is well-trodden and its hosting half is **reasoned from the Next families,
not copied from a running Astro site.** Treat the adapter specifics as
unverified until someone executes this.

## Steps

Follow `astro-static` steps 1, 2, 4, 5, 6, 7 unchanged. Replace step 3, and add
steps 3b and 8b below.

### 3. Wire Tailwind, Decanter, and the adapter

Identical to `astro-static` step 3 except for `output` and `adapter`:

```js
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import netlify from '@astrojs/netlify';   // or: import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://<unit>.stanford.edu',   // still required: sitemap + canonical URLs
  output: 'server',
  adapter: netlify(),
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  vite: { plugins: [tailwindcss()] },
});
```

```bash
npm install @astrojs/netlify      # or @astrojs/vercel
```

Install latest; do not pin. Four things to get right:

- **`site` is still not optional.** Same as static: without it `@astrojs/sitemap`
  emits nothing and canonical URLs are wrong, failing two acceptance criteria.
  Server rendering does not supply it for you.
- **`output: 'server'`, not `'hybrid'`.** `'hybrid'` was removed from Astro. With
  `'server'`, opt individual pages back into prerendering with
  `export const prerender = true`, which is the modern equivalent and the right
  default for most pages on a content site.
- **`src/styles/global.css` is still one line**: `@import 'decanter'`. The
  adapter changes nothing about the Decanter integration.
- **`base` is not needed.** Both hosts serve from the root. `base` is a GitHub
  Pages subpath concern.

### 3b. Security headers

**Ship the sensible defaults, switched on. Leave CSP off.** The canonical values
are in `standards/hosting/capabilities.yml` under `default_header_set`; take them
from there if this table ever disagrees.

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `origin-when-cross-origin` |
| `Permissions-Policy` | `geolocation=(), camera=(), microphone=(), midi=(), payment=(), usb=()` |
| `X-Frame-Options` | `SAMEORIGIN` |

That set is deliberately the headers that **cannot break a page**. On Astro, set
them in host config rather than in application code — it applies to prerendered
and server-rendered routes alike, which per-route middleware does not:

**Netlify** — `netlify.toml`:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Strict-Transport-Security = "max-age=31536000; includeSubDomains; preload"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "origin-when-cross-origin"
    Permissions-Policy = "geolocation=(), camera=(), microphone=(), midi=(), payment=(), usb=()"
    X-Frame-Options = "SAMEORIGIN"
```

**Vercel** — `vercel.json`, using the `headers` array shown in
`standards/hosting/vercel.yml`.

Two notes on the values:

1. **`SAMEORIGIN`, not `DENY`.** `DENY` breaks a CMS Visual Editor preview and
   then needs a second policy to work around itself. **There is no CMS here**
   (`standards/scope.md`), so that problem is absent and `SAMEORIGIN` is simply
   the right answer — do not import the homesite's two-policy pattern to solve
   a problem you do not have.
2. **`X-Frame-Options` is the simple option.** If you prefer
   `frame-ancestors`, that is a CSP directive, and CSP is opt-in — see below.

#### Content-Security-Policy is optional, and off by default

**Confirmed by SWS 2026-09-03: nonce-based CSP is a nice-to-have.** MinWeb
requires no response headers at all, so a site without a CSP is fully compliant.

It is off by default because of **who absorbs the breakage**. CSP is the one
header that breaks pages, and it breaks them when someone *edits content*, not
when someone deploys. An owner embeds a YouTube video, a Qualtrics survey, or a
Google Font; the browser blocks it silently; and the person least able to
diagnose it is the one holding the problem.

- **Never build a CSP from a domain allowlist.** It drifts, ends up allowing
  everything, and makes every future embed a support ticket.
- **If you add one**, use `'strict-dynamic'` with per-request nonces. Astro can
  generate a nonce in middleware, but note that **prerendered pages cannot carry
  a per-request nonce** — this is the genuine Astro-specific wrinkle. On Netlify,
  `@netlify/plugin-csp-nonce` injects at the edge and sidesteps it. On Vercel
  there is no equivalent.
- **Start with `Content-Security-Policy-Report-Only`.** It cannot break a page by
  construction and still tells you what a real policy would have blocked.
- **Record it in `.sws/manifest.yml`** as a divergence, and name who owns the
  breakage.

### 8b. Deploy

Replaces `astro-static` step 8. Both hosts deploy from their git integration
rather than from a Pages workflow:

- **Push to `main` deploys.** Keep the GitHub Actions workflow for checks only.
- **Do not add branch protection or required status checks.** Each quietly
  converts push-to-main into a pull-request requirement, and campus editors
  working through the GitHub web UI cannot open one.
- **Both hosts give per-PR preview URLs.** That is the real gain over Pages. Do
  not make pull requests mandatory in order to get it.
- **Secrets come from Vault**, not `.env`. `node-vault` is the host-portable
  option; `netlify-plugin-vault-variables` is the Netlify-specific one. Committed
  credentials are the only thing in this system that fails a build.
- **MFA on the host dashboard.** MinWeb's "MFA on all administrative logins"
  includes the hosting dashboard, which can trigger a deploy and read
  environment variables. Most-missed item in `capabilities.yml`.

**To provision Netlify, use the `sws-netlify` skill.** It drives the account,
team, and site-creation steps in `standards/hosting/netlify.yml`, and is honest
about the one step that cannot be scripted: connecting the repo needs a GitHub
App authorization in a browser, the same shape of limit as GitHub account
creation in `sws-github`. **For Vercel, use the `sws-vercel` skill** instead;
it carries the same honest limit at its own `connect-repo` step.

### 9. Verify

```bash
npm run build
sws a11y
sws perf
npx sws check
```

`sws a11y` and `sws perf` serve the build locally, so they behave the same as on
a static build. Note that **`sws check` cannot verify a served header** without a
deployed URL: it reads config and reports `unknown` rather than `pass` when it
cannot follow the value. Check the real headers against the deployed site once
it is up.

## Swap points

| Swap | Cost |
|---|---|
| `astro-static` instead | **Usually the better choice.** Free hosting, fewer moving parts. You give up response headers, real redirects, and preview URLs |
| `next-ssr` instead | Same capability, more weight. Right if you want the React ecosystem or a decoupled Drupal front end; wrong if you only want headers |
| Netlify or Vercel, either way | **Not a divergence.** SWS runs both. Pick what the unit administers |
| `output: 'static'` with a host adapter | Legitimate and often overlooked: a fully static build deploys to Netlify or Vercel unchanged and still gets headers, redirects, and previews from host config. **You do not need `output: 'server'` for headers.** Take this if you want the host but not the runtime |
| A CSP, nonce-based | Supported and welcome. You take on the support cost of a policy that breaks at content-edit time, plus the prerendered-nonce wrinkle above. Name who owns it |
| A CMS for content | **Out of scope for now, and not a swap you can take here.** See `standards/scope.md`. Content comes from the repo. Eleven SWS repos are CMS-backed in production, so the capability exists at SWS — just not as anything this recipe can hand you |

Record every swap in `.sws/manifest.yml` under `divergences` with a one-line
reason.

## Known gotchas

All ten from `astro-static` still apply. These are additional:

1. **`output: 'hybrid'`.** Removed from Astro. Use `'server'` plus
   `export const prerender = true` per page.
2. **Dropping `site` because the server "knows" the URL.** It does not. The
   sitemap and canonical URLs still need it.
3. **Reaching for `output: 'server'` when you only wanted headers.** A static
   build on Netlify or Vercel gets headers from host config. See the swap table.
4. **Setting headers in middleware instead of host config.** Middleware does not
   run for prerendered routes, so you get headers on some pages and not others —
   and the pages that miss out are the ones most likely to be public.
5. **Expecting a per-request CSP nonce on a prerendered page.** It cannot work by
   construction. Use edge injection or drop the CSP.
6. **Setting the same header in both host config and application code.** On
   Netlify the `netlify.toml` value wins; on Vercel the collision is not merged
   predictably. Pick one place.
7. **Assuming the adapter is interchangeable mid-project.** Swapping
   `@astrojs/netlify` for `@astrojs/vercel` also means moving secrets, redirects,
   headers, and DNS. Decide the host before launch, not after.

## Provenance

Astro, Decanter 8, and Tailwind 4 wiring inherited wholesale from
`astro-static`, which **was** executed end to end on 2026-08-10.

**The SSR and hosting half of this recipe has not been executed, and no SWS
Astro project runs SSR.** `sws-astro` is static with no deploy config. The
adapter configuration, the header mechanisms, and the prerendered-nonce
limitation are reasoned from the Astro documentation and from how the Next
families do the equivalent thing on the same two hosts — not copied from a
running Astro deployment. Treat the step ordering as reasoned rather than
proven, and executing it is the next task for this recipe.

Written 2026-09-03, alongside `standards/hosting/`. The header and CSP posture
follows the SWS answer of the same day: security headers ship with sensible
defaults, and a CSP locked to specific domains is explicitly not wanted because
it puts a non-technical owner one embed away from a page they cannot fix.
