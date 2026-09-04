# Recipe: next-ssr

**Generate a compliant Stanford Next.js site with Decanter 8, served with a
runtime.**

| | |
|---|---|
| Recipe ID | `next-ssr` |
| Renamed from | `next-netlify`, on 2026-09-03. See "Choosing a host" below |
| Status | Draft |
| Compliance tier | `low` for a content site. Rises if you add a form collecting personal data, auth, or payments |
| Content source | **The repo. No CMS** — see `standards/scope.md` |
| Acceptance | `acceptance.yml` in this directory, which extends `astro-static` |
| Hosting | Netlify or Vercel. Pick per `standards/hosting/` |
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

## Why a runtime, and not static hosting

This recipe exists because some things need a **server response**, and a static
build cannot produce one. Choosing it buys you:

- **Response headers**, including the default security header set in
  `standards/hosting/capabilities.yml`. Static export emits files, not headers.
- `redirects` and `rewrites`, which matter enormously on a site replacing a
  legacy one.
- Proxy (Next's renamed middleware), ISR, Server Actions, Draft Mode, Route
  Handlers beyond `GET`, and default-loader image optimization — all of which
  `output: 'export'` forfeits.

**Be honest about the size of this.** MinWeb requires none of it. The header set
is good engineering, not policy, and a content site that needs no redirects and
no server logic is better served by `astro-static` on GitHub Pages for free.
Reach for this recipe when you need what is in that list, not by default.

**If you want static output, use `astro-static`.** Choosing Next for a content
site and then statically exporting it gives you the worst of both: React's weight
without its capabilities.

## Choosing a host

**This recipe was called `next-netlify` until 2026-09-03**, which was a mistake
worth explaining, because the reasoning behind it was wrong in a way that would
have shown in the output. The old text said Netlify is "where SWS runs" and that
choosing Vercel meant leaving the platform every other project uses. In fact SWS
runs **both**, split cleanly by family:

| Family | Host |
|---|---|
| `storyblok-next-netlify` (ADAPT/OOD, 6 repos) | Netlify |
| `decoupled-drupal` (Cardinal Sites, 5 repos) | Vercel |

That is two lineages and two decisions, not a majority and an outlier.

**So the recipe does not pick for you. Start from where the unit already is:**

| If the unit... | Host |
|---|---|
| Already administers a Netlify account | **Netlify.** `standards/hosting/netlify.yml` |
| Already administers a Vercel account | **Vercel.** `standards/hosting/vercel.yml` |
| Has neither, and wants the better-trodden path for a content site | Netlify, to inherit the ADAPT family's Vault wiring |
| Has no account and no budget, and needs no runtime | You want `astro-static` on GitHub Pages |

An account someone already knows how to administer is worth more than the
shared-tooling argument. Record the choice in `.sws/manifest.yml` under
`hosting`. Do not introduce a third host on your own: that is a procurement
question, and it goes to the office, not to us.

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

`tailwindcss` and `@tailwindcss/forms` both still arrive transitively through
Decanter, but in v8 the form styles are only emitted if the project imports
`decanter/forms` explicitly. A site with a form needs that second import. Do
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

### 5. Security headers

**Ship the sensible defaults, switched on. Leave CSP off.** In
`next.config.ts`, return these from `headers()`:

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `origin-when-cross-origin` |
| `Permissions-Policy` | `geolocation=(), camera=(), microphone=(), midi=(), payment=(), usb=()` |
| `X-Frame-Options` | `SAMEORIGIN` |

That set is deliberately the headers that **cannot break a page**. It is the
canonical list in `standards/hosting/capabilities.yml`; take it from there
rather than from here if the two ever disagree.

Two notes on the values:

1. **`SAMEORIGIN`, not `DENY`.** The homesite uses `DENY` and then needs a
   second policy for the CMS Visual Editor route it has to let be iframed.
   **This recipe has no CMS**, so that whole problem is absent and `SAMEORIGIN`
   is simply the right answer. Do not import the two-policy pattern from the
   homesite to solve a problem you do not have.
2. **Gate on the deploy environment.** The homesite checks whether it is on the
   host and returns `[]` locally. Copy that, or spend a day fighting your own
   headers in development.

#### Content-Security-Policy is optional, and off by default

**Confirmed by SWS 2026-09-03: nonce-based CSP is a nice-to-have.** MinWeb
requires no response headers at all, so a site without a CSP is fully compliant.

The reason it is off by default is not effort, it is **who absorbs the
breakage**. A CSP is the one header that breaks pages, and it breaks them when
someone *edits content*, not when someone deploys. A content owner embeds a
YouTube video, a Qualtrics survey, or a Google Font; the browser blocks it
silently; and the person who can least diagnose it is the person holding the
problem.

So:

- **Never build a CSP from a domain allowlist.** It drifts, it ends up allowing
  everything, and every future embed is a support ticket.
- **If you do add one**, use `'strict-dynamic'` with per-request nonces. On
  Netlify, `@netlify/plugin-csp-nonce` injects them at the edge. On Vercel there
  is no equivalent and you write it in `proxy.ts` yourself.
- **Start with `Content-Security-Policy-Report-Only`.** It cannot break a page by
  construction, and it tells you what a real policy would have blocked.
- **Record it in `.sws/manifest.yml`.** It is a divergence from this default, and
  somebody should have agreed to own the breakage.

Worth knowing: **none of the five Vercel-hosted SWS repos sets any security
headers**, and `sulgryphon-nextjs`'s `headers()` sets only `X-Robots-Tag` for
non-production. That is permitted, not a finding — but do not copy it either.
New work should ship the default set above.

### 6. Images

Set `images.remotePatterns` for whatever actually serves your images. With
content in the repo, most images are local and need no entry at all — add hosts
only for what you genuinely fetch remotely, typically `**.stanford.edu`. Do not
use a wildcard: the point of the list is that it is a list.

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

### 8. Motion and animations (optional, recommended for marketing sites)

Motion increases engagement when used purposefully, but it must serve the content, not distract from it. Use motion to:

- **Guide attention**: Draw focus to key CTAs or benefits
- **Improve perceived performance**: Fade elements in while content loads
- **Reward interaction**: Smooth transitions on hover and click
- **Establish brand tone**: Motion is a design choice, not a default

Use **motion** for animations. It integrates seamlessly with Next.js and respects accessibility preferences out of the box.

```bash
npm install motion
```

**Key rule**: Things inside moving things should not also move. Parent animations take priority; child elements stay static.

**Guidelines:**

1. **Respect `prefers-reduced-motion`**: Always honor OS-level motion preferences. `motion` respects this automatically, but also provide a CSS fallback:

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

4. **Common patterns with motion:**
   - **Fade-in on scroll**: Wrap sections in `<motion.div>` with `initial={{ opacity: 0 }}` and `whileInView={{ opacity: 1 }}`.
   - **Button hover lift**: Use `whileHover={{ y: -2 }}` with shadow via className.
   - **Scale on hover**: `whileHover={{ scale: 1.05 }}` for gentle growth.
   - **Staggered animations**: Use `staggerChildren` for sequential child animations.
   - **Avoid nested motion**: Parent container animates; children remain static. Do not animate both a parent and child element independently.

5. **Performance**: `motion` uses `transform` and `opacity` by default (GPU-accelerated). Let the library handle optimization.

6. **Testing**: Verify animations work smoothly at typical device speeds. A 60fps target means 16.67ms per frame. Test on real devices, not just desktop browsers.

7. **Accessibility in motion**:
   - Animations must not auto-play audio or video without user consent.
   - Avoid flashing or strobing (3+ flashes per second) — this can trigger seizures.
   - Provide text alternatives or skip animations for critical content.

**Example: Fade-in on scroll with Next.js**

```tsx
'use client';

import { motion } from 'motion';

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

### 9. Testing

Playwright plus `@axe-core/playwright` against every route, asserting zero
violations tagged `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`.

Both baselines run **Cypress** rather than Playwright, with e2e and component
testing, and the homesite adds Jest and MSW. Playwright is the forward default for
new work; **never convert an existing Cypress suite.** Expect to see Cypress when
reading either baseline.

**No component workshop.** The homesite runs Storybook with the a11y addon, which
is right at flagship scale and wrong for a unit site with a handful of components
and one consumer. Read it for what thorough looks like, not as a shopping list.

### 10. Secrets

**Not `.env` in production.** SWS uses HashiCorp Vault, via
`netlify-plugin-vault-variables` in this family. Follow that rather than
introducing a new pattern. Committed credentials are the only thing in this system
that fails a build.

### 11. Verify

```bash
npm run build
npx sws check
```

## Swap points

| Swap | Cost |
|---|---|
| `astro-static` instead | **Usually the better choice for a content site.** Less weight, simpler hosting, works on GitHub Pages |
| Static export (`output: 'export'`) | Forfeits CSP and security headers, `redirects`, `rewrites`, Proxy, ISR, Server Actions, Draft Mode, and default-loader image optimization. Route Handlers become `GET`-only. If you want this, you want `astro-static` |
| Vercel instead of Netlify, or the reverse | **Not a divergence.** SWS runs both, one per family. Pick per `standards/hosting/`, and prefer whichever the unit already administers. The only real asymmetry: `@netlify/plugin-csp-nonce` has no Vercel equivalent, which costs you nothing unless you opt into CSP |
| A CSP, nonce-based | Supported and welcome. You are taking on the support cost of a policy that breaks at content-edit time. Name who owns that |
| A CMS, either Storyblok or decoupled Drupal | **Out of scope for now, and not a swap you can take here.** See `standards/scope.md`. Eleven SWS repos do this in production, so the capability exists — just not as anything this recipe can hand you. Raise it in discovery rather than building half of it |
| Cypress instead of Playwright | Reasonable if the project already has it. Both baselines do |
| `clsx` + `tailwind-merge` instead of `cnbuilder` | Both are in SWS use, split by project family. One per project |
| yarn instead of npm | Fine. `ccc-bulletin` uses yarn 4, the homesite uses npm. Never convert a project |

## Known gotchas

1. **Installing `decanter` without confirming the major.** v7 is a Tailwind 3 JS preset; nothing here works against it.
2. **Copying the homesite's `styles/global.css` verbatim.** Its first line is `@import 'tailwindcss'` because it does not use Decanter. Yours must be `@import 'decanter'`.
3. **Copying the homesite's `tailwind/theme.css`.** That is its derived design system, a parallel token vocabulary. Yours should be short and only contain deviations.
4. **Scaffolding with `--tailwind`.** Conflicts with the Decanter integration.
5. **Importing the homesite's two-CSP pattern.** It exists to let a CMS Visual Editor iframe the site. There is no CMS here, so it solves nothing and adds a policy to maintain.
6. **CSP headers enabled locally.** Gate them on the deploy environment or fight them all day.
7. **Assuming static export is a small change.** It removes the entire reason to use this recipe over `astro-static`.
8. **FontAwesome Pro**, inherited from the homesite. Licence-gated, fails installs.

## Provenance

Next.js configuration shape, CSP and security header approach, PostCSS config, and
file organisation read from `adapt-stanford-homesite` (`dev`) on 2026-08-11.
Decanter 8 integration read from `ccc-bulletin` (`dev`) the same day. Both private.

Hosting facts corrected on 2026-09-03 after SWS named the Vercel family, and
`sulgryphon-nextjs` and `press-nextjs` were then read directly to verify it.
Those two are public. The header and CSP posture in step 5 changed the same day,
on the SWS answer that CSP is a nice-to-have and that defaults must not put a
non-technical owner in trouble.

**Not yet executed end to end.** `astro-static` was validated by running it;
this recipe has not been, and until it is, treat the step ordering as reasoned
rather than proven. That is the next task for it.
