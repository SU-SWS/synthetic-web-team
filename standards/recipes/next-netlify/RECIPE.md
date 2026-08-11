# Recipe: next-netlify

**Generate a compliant Stanford Next.js site on Netlify, with Decanter 8.**

| | |
|---|---|
| Recipe ID | `next-netlify` |
| Status | Draft |
| Compliance tier | Depends. `low` for content-only. Storyblok alone does not raise it |
| Acceptance | `acceptance.yml` in this directory, which extends `astro-static` |
| Versions | **None specified by design.** Install latest |

## Two baselines, and which part comes from which

This recipe is assembled from two real SWS projects, because neither one alone is
the right model.

| From | What | Why |
|---|---|---|
| [`adapt-stanford-homesite`](https://github.com/SU-SWS/adapt-stanford-homesite) (`dev`) | The **Next.js setup**: config shape, CSP and security headers, PostCSS, file organisation, testing, Vault secrets, Netlify environment detection | It is `www.stanford.edu`, the most scrutinised Stanford property, and its engineering setup is the most complete in the org |
| [`ccc-bulletin`](https://github.com/SU-SWS/ccc-bulletin) (`dev`) | The **Decanter 8 integration** | It is the only Next project consuming Decanter 8, and the homesite deliberately does not consume Decanter at all |

**Why the split matters.** `www.stanford.edu` runs its own design system, derived
from Decanter and currently influencing Decanter 8. Its `styles/global.css` opens
with `@import 'tailwindcss'` and pulls in a local `tailwind/` directory. Its
tokens are a **parallel vocabulary**, not Decanter's, so copying them into a
Decanter project produces something that looks approximately right and does not
use the design system. That failure passes visual review and is invisible in a
screenshot.

Both repos are **private**. If you cannot read them, everything you need is below.

## Why Netlify and not GitHub Pages

The homesite baseline depends on **response headers** for Content Security Policy
and the security header set. Static export emits files, not headers, so it cannot
carry them. Under `output: 'export'` Next also forfeits `redirects`, `rewrites`,
Proxy (the renamed middleware), ISR, Server Actions, Draft Mode, and default-loader
image optimization, and Route Handlers become `GET`-only.

So this recipe targets **Netlify**, which is where SWS runs anyway: functions,
blobs, edge functions, the CSP nonce plugin, and Vault-backed environment
variables are all in production use.

**If you need GitHub Pages, use `astro-static` instead.** It is a better fit for
static hosting and it is the cheaper thing to maintain. Choosing Next for a
content site and then statically exporting it gives you the worst of both: React's
weight without its capabilities.

## Steps

### 1. Scaffold with the upstream tool

```bash
npx create-next-app@latest --typescript --app --no-tailwind --eslint
```

`--no-tailwind` is deliberate: the scaffolder's Tailwind setup conflicts with the
Decanter integration below. Record the resolved Next version in
`.sws/manifest.yml`. Record it, do not judge it.

If the scaffolder fails on a network precheck, hand-create the four files it
would have made and continue. The recipe is the artifact; the scaffolder is a
convenience over it.

### 2. Install

```bash
npm install decanter
npm install -D @tailwindcss/postcss
```

Confirm you got Decanter 8, because v7 fails silently:

```bash
node -p "require('./node_modules/decanter/package.json').version"   # expect 8.x
node -p "require('./node_modules/decanter/package.json').main"      # expect src/css/index.css
ls node_modules/decanter/node_modules 2>/dev/null                   # expect nothing
```

`tailwindcss` and `@tailwindcss/forms` arrive transitively through Decanter. Do
not install them directly, and do not create a `tailwind.config.js`.

Also install, matching the house conventions: `cnbuilder` for conditional
classes, `@heroicons/react` for icons. **Not FontAwesome Pro**, which the homesite
uses behind a licence-gated preinstall token check; a unit site inheriting that
gets an install failure and a licence nobody mentioned.

### 3. PostCSS

`postcss.config.mjs`, identical in both baselines:

```js
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
export default config;
```

Next uses PostCSS here. `@tailwindcss/vite` is the Astro path and does not apply.

### 4. Styles: bulletin's first line, homesite's organisation

`styles/global.css`:

```css
@import 'decanter';
@import '../tailwind/theme.css';
@import '../tailwind/base.css';
@import '../tailwind/utilities.css';
```

**That first line is the whole Decanter integration.** Note what it is not:

- Not `@import 'tailwindcss'`. Decanter imports Tailwind itself. The homesite has
  that line only because it does not use Decanter.
- Not `@source` anything. Verified unnecessary; Tailwind roots detection at the
  entry CSS file's project.
- Not a `tailwind.config.js`.

Then split project-specific CSS into a `tailwind/` directory, which is how both
baselines organise it:

```
tailwind/
  theme.css             @theme block: project token EXTENSIONS
  base.css              project base element styles
  utilities.css         project utilities
  custom-variants.css   optional
```

**Extend Decanter's tokens in `theme.css`, and annotate every deviation.**
`ccc-bulletin` does this well and it is worth copying as a habit:

```css
@theme {
  --breakpoint-2xl: 1440px;   /* Differs from Decanter */
  --container-2xl: 1440px;    /* Differs from Decanter */

  /* Project-specific colours, namespaced so they read as additions */
  --color-blue-navy: #272e5c;
}
```

A comment marking a deliberate divergence at the token level is the same
discipline as recording one in `.sws/manifest.yml`. Silent divergence is the only
kind that is a problem.

### 5. Security headers and CSP, from the homesite

This is the most valuable thing the homesite baseline gives you, and it is the
part a static site cannot have. In `next.config.ts`, return these from
`headers()`:

| Header | Value |
|---|---|
| `Content-Security-Policy` | Built per environment. See below |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `origin-when-cross-origin` |
| `Permissions-Policy` | Deny what you do not use: geolocation, camera, microphone, midi, and so on |
| `X-Frame-Options` | `DENY` on the app |

Three things the homesite does that are worth imitating:

1. **Two CSP policies, not one.** The app gets `frame-ancestors 'none'`. The
   Storyblok Visual Editor route gets `frame-ancestors https://*.storyblok.com`,
   because it must be iframed by the CMS. One policy cannot serve both.
2. **`noindex, nofollow` on the editor route**, plus a path-exclusion pattern so
   the app policy does not apply to it.
3. **Headers only in the deployed environment.** The homesite checks whether it
   is on Netlify and returns `[]` locally, which keeps local development from
   fighting the policy.

Use `'strict-dynamic'` with nonces rather than a host allowlist for scripts.
`@netlify/plugin-csp-nonce` injects the nonces at the edge. A CSP built from a
long list of allowed hosts drifts and eventually allows everything.

### 6. Images

Set `images.remotePatterns` for whatever actually serves your images. For
Storyblok that is the `a.storyblok.com` family. Do not use a wildcard: the point
of the list is that it is a list.

### 7. Required content

Same as `astro-static`, and the contract is shared:

- **Global Footer** from `standards/fragments/global-footer.yml`. Immutable: same
  links, same order, two lists of four and six, both copyright lines. Generate it
  from the contract rather than transcribing it, because transcription is how two
  of its URLs were wrong in this project's first draft.
- **Identity Bar**, with nothing above it but a skip link.
- **Named business owner and technical administrator** with Stanford emails.
- **`robots.txt`** with explicit AI crawler sections. See
  `standards/patterns/discoverability.md`.
- **JSON-LD** for rich results, and **not** as an AI-citation measure.
- **No cookie banner.** The Global Footer Privacy link satisfies disclosure.
- **No `llms.txt`** on a unit site.

### 8. Testing

Playwright plus `@axe-core/playwright` against every route, asserting zero
violations tagged `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`.

Both baselines run **Cypress** rather than Playwright, with e2e and component
testing, and the homesite adds Jest and MSW. Playwright is the forward default for
new work; **never convert an existing Cypress suite.** Expect to see Cypress when
reading either baseline.

**No component workshop.** The homesite runs Storybook with the a11y addon, which
is right at flagship scale and wrong for a unit site with a handful of components
and one consumer. Read it for what thorough looks like, not as a shopping list.

### 9. Secrets

**Not `.env` in production.** SWS uses HashiCorp Vault, via
`netlify-plugin-vault-variables` in this family. Follow that rather than
introducing a new pattern. Committed credentials are the only thing in this system
that fails a build.

### 10. Verify

```bash
npm run build
npx sws check
```

## Swap points

| Swap | Cost |
|---|---|
| `astro-static` instead | **Usually the better choice for a content site.** Less weight, simpler hosting, works on GitHub Pages |
| Static export (`output: 'export'`) | Forfeits CSP and security headers, `redirects`, `rewrites`, Proxy, ISR, Server Actions, Draft Mode, and default-loader image optimization. Route Handlers become `GET`-only. If you want this, you want `astro-static` |
| Vercel instead of Netlify | Supported, but you leave the platform every other SWS project uses and lose the shared tooling. `@netlify/plugin-csp-nonce` has no direct equivalent |
| Decoupled Drupal instead of Storyblok | `graphql-request` plus `graphql-codegen`, per `cardinalsites-nextjs`. Note that family deliberately runs `--webpack` rather than Turbopack across all four repos |
| Cypress instead of Playwright | Reasonable if the project already has it. Both baselines do |
| `clsx` + `tailwind-merge` instead of `cnbuilder` | Both are in SWS use, split by project family. One per project |
| yarn instead of npm | Fine. `ccc-bulletin` uses yarn 4, the homesite uses npm. Never convert a project |

## Known gotchas

1. **Installing `decanter` without confirming the major.** v7 is a Tailwind 3 JS preset; nothing here works against it.
2. **Copying the homesite's `styles/global.css` verbatim.** Its first line is `@import 'tailwindcss'` because it does not use Decanter. Yours must be `@import 'decanter'`.
3. **Copying the homesite's `tailwind/theme.css`.** That is its derived design system, a parallel token vocabulary. Yours should be short and only contain deviations.
4. **Scaffolding with `--tailwind`.** Conflicts with the Decanter integration.
5. **One CSP for both the app and the editor route.** The editor must be iframable by Storyblok; the app must not be.
6. **CSP headers enabled locally.** Gate them on the deploy environment or fight them all day.
7. **Assuming static export is a small change.** It removes the entire reason to use this recipe over `astro-static`.
8. **FontAwesome Pro**, inherited from the homesite. Licence-gated, fails installs.

## Provenance

Next.js configuration shape, CSP and security header approach, PostCSS config, and
file organisation read from `adapt-stanford-homesite` (`dev`) on 2026-08-11.
Decanter 8 integration read from `ccc-bulletin` (`dev`) the same day. Both private.

**Not yet executed end to end.** `astro-static` was validated by running it;
this recipe has not been, and until it is, treat the step ordering as reasoned
rather than proven. That is the next task for it.
