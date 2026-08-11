# SWS conventions, derived from production repos

**What SWS actually does, established by reading 11 production repos on 2026-08-10, then corrected by SWS on the same day.**

Source: `standards/prior-art/repos.yml`. Method: `package.json` on each default branch, followed by a review conversation.

## Read this part first

The first version of this document proposed four corrections to the project's standards, drawn from what the repos showed. **Three of the four were wrong.** They are preserved below with the correction, because the pattern of error is more useful than the conclusions were.

| I claimed | Reality | My error |
|---|---|---|
| Use Astro 6, since `sws-astro` does | Astro 7 is fine. More importantly, **stop naming versions at all** | Solved the wrong problem. I treated a version mismatch as needing a decision when it needed to be designed away |
| `sa11y` is the house dev a11y tool | It is a **content-author** tool in Visual Editor overlays | Inferred purpose from presence. A dependency tells you *what*, never *why* |
| Use Cypress, since Playwright appears nowhere | **Playwright**, because that is where the market is going | Read current practice as intent. Where a team is heading is not in its lockfiles |
| npm, never pnpm | npm primary, yarn secondary. Correct | Fine |

The lesson is in the third clause of the precedence rule (see `standards/prior-art/README.md`): prior art establishes what an org *does*, and cannot establish *why* or *where it is going*. Both require asking a person. An agent that mines repos and skips that conversation will confidently entrench the present.

## The one real correction

### npm primary, yarn secondary, pnpm not in use

Package managers split by family: **npm** across the Storyblok/ADAPT repos, **yarn 4.x** across the decoupled Drupal repos and `ccc-bulletin`, **pnpm** nowhere.

An earlier draft proposed pnpm for our own monorepo, justified partly by needing `overrides` for the Decanter/Tailwind clash. Decanter 8 removed that clash and the justification with it.

**Standard:** our repo uses npm. Recipes respect whatever a project already has and never convert it. Any advice touching dependency overrides must be manager-aware, since npm `overrides` and yarn `resolutions` behave differently.

## Versions: install latest, do not pin

The most important correction is a philosophy, not a fact. **Recipes name no versions.**

I had built a `constraints.yml` with allowed major ranges and a canary to flag when latest moved past them. That is a version-pinning scheme wearing a different hat, and it recreates exactly the rot that dropping starter packages was meant to avoid.

**Standard:** recipes install current releases and record what resolved. Constraints exist only where a version boundary is genuinely load-bearing, meaning getting it wrong produces a broken or non-compliant result. Across the whole `astro-static` recipe there is **exactly one**: Decanter 8 rather than 7, because it is a breaking architecture change and `npm i decanter` currently resolves to v7.

Everything else follows or does not matter. Tailwind 4 arrives transitively through Decanter. Node requirements come from whatever Astro currently needs. Astro majors are just latest.

Prefer expressing standards as **things to avoid**, which age far better than versions to require: no `@astrojs/tailwind`, no `tailwind.config.js`, no `output: 'hybrid'`. Those stay true across releases.

`reference-versions.yml` keeps a dated snapshot for the canary to diff against, and is explicitly advisory. Nothing installs from it.

## Accessibility: sa11y is for content authors

`sa11y` appears in five repos, and I read that as a developer tooling convention. It is not. **SWS uses it in Visual Editor overlays so content authors can spot accessibility problems while editing their own content.**

The dependency data supports the correction exactly, and I should have noticed. sa11y correlates **perfectly** with Storyblok across all 11 repos:

| Repo | Storyblok | sa11y |
|---|---|---|
| `adapt-stanford-homesite` | yes | yes |
| `adapt-online-giving` | yes | yes |
| `ood-giving-campaign` | yes | yes |
| `ood-stanford-tour` | yes | yes |
| `ccc-bulletin` | yes | yes |
| `adapt-directory` | no | no |
| `sws-astro` | no | no |
| 4 decoupled Drupal repos | no | no |

Five for five with Storyblok, six for six without. A perfect correlation with the CMS was the clue that it was a CMS-authoring tool, and I read the count instead of the pattern.

**Why this matters beyond a tooling label.** It fills a real gap that a build-time a11y gate cannot: everything axe checks in CI concerns the site as built, and says nothing about what an editor publishes next week. On a CMS-backed site most accessibility debt arrives *after* launch, through content. sa11y in the authoring overlay is the only control in the whole system that addresses it.

**Standard:**

- Build-time gate: Playwright plus axe. Covers roughly 30 percent of issues per ODA guidance.
- Authoring-time feedback: **sa11y in the Visual Editor overlay, on every CMS-backed project.** Belongs to `role-content-designer` as much as to `role-accessibility-lead`.
- Manual checklist: the remaining ~70 percent.
- Siteimprove: post-launch, its own criteria, registration required by MinWeb.

Note `ccc-bulletin` is on sa11y 5.x while the others are on 4.x, so check for a migration guide.

## Testing: Playwright forward, Cypress present

Cypress is configured in `adapt-stanford-homesite`, `adapt-directory`, and `ccc-bulletin`, with e2e and component testing. Playwright appears in none.

**Standard: new work uses Playwright**, per SWS direction and the wider market. Never convert an existing Cypress project, and expect to encounter Cypress when reading prior art. `ccc-bulletin` also runs BackstopJS for visual regression, which is the only instance and worth knowing about rather than requiring.

## Conventions confirmed as conventions

These held up, and unlike the sa11y case the purpose is unambiguous from usage.

### `cnbuilder` for conditional classes

`cnbuilder ^3.1.0`, the same version across seven repos: `sws-astro`, `adapt-stanford-homesite`, `adapt-online-giving`, `adapt-directory`, `ood-giving-campaign`, `ood-stanford-tour`, `ccc-bulletin`. The decoupled Drupal family uses `clsx` plus `tailwind-merge` instead. Both legitimate, split by family. New Astro and Storyblok work uses `cnbuilder`.

### Heroicons, and the FontAwesome exception

`@heroicons/react` is near-universal and matches Decanter's own recommendation. `adapt-stanford-homesite` uses **FontAwesome Pro** behind a licence-gated token with a `preinstall` check. Reasonable for the university homepage, bad to propagate: a unit site inheriting it gets an install failure and a licence nobody mentioned. Recipes use Heroicons.

### HashiCorp Vault for secrets

`netlify-plugin-vault-variables` across the ADAPT family, `node-vault` across the decoupled Drupal family. SWS does not keep production secrets in `.env` files. This means MinWeb's "no API keys in Git" requirement is already handled institutionally, and our secrets check is a backstop rather than the primary control.

### Netlify is the platform

`@netlify/functions`, `@netlify/blobs`, `@netlify/edge-functions`, `netlify-cli`, `@netlify/plugin-nextjs`, `@netlify/plugin-csp-nonce`. Vercel appears once, as `@vercel/speed-insights`. The hosting path is GitHub Pages then **Netlify**; Vercel is a swap that costs you the shared tooling.

### Decanter 8 arrives from the git branch

Both v8 consumers install from git, predating the npm publish:

```json
"decanter": "github:SU-SWS/decanter#v8"                    // sws-astro
"decanter": "https://github.com/SU-SWS/decanter.git#v8"    // ccc-bulletin
```

Recipes prefer npm since it is versioned and lockfile-friendly, and the `decanter.installed` check must accept both forms without flagging the git one.

### Two CMS paths, both current

**Storyblok** via `@storyblok/react`, with versions spread from 3.x in the older OOD sites to 6.x in `ccc-bulletin` and `adapt-online-giving`. Cite `ccc-bulletin` for current practice. **Decoupled Drupal** via `graphql-request` plus `graphql-codegen`, or `next-drupal` in `sulgryphon-nextjs`.

### Search: Algolia default, Coveo by context

Algolia with `react-instantsearch` across the decoupled Drupal family. Coveo only in `adapt-directory` for Stanford GSB, with a substantial CLI-driven org resource workflow. Confirms the earlier recommendation.

## The design system is not monolithic

`www.stanford.edu` does not consume Decanter. It is **its own design system, heavily derived from Decanter, and currently influencing Decanter 8.**

I had logged the missing `decanter` dependency as a gap to explain. It is an architectural fact, and it changes how the whole design layer should be described.

**Consequences:**

1. **The homesite is not a Decanter conformance reference.** Its brand furniture is authoritative, because brand is brand and this is the canonical site. Its tokens and CSS are a **parallel vocabulary**. Copying them into a Decanter 8 project yields something that looks approximately right and does not use the design system, which passes visual review and fails every token check. That failure is invisible in a screenshot, which is what makes it worth a standing warning.

2. **It is a preview of Decanter 8's direction.** Patterns proven on the homesite are feeding back into the system. `role-ux-designer` should read it as "where this is going," not "what to match today."

3. **"What does Stanford's design system say?" sometimes has two answers.** Decanter 8 says X, the homesite is piloting Y. A feedback loop from a flagship project into the design system is healthy and how these things should evolve, but it means there is no single instantaneous source of truth, and guidance should stop implying there is.

4. **It breaks the `era` model.** Era assumes a line from Decanter 6 to 7 to 8 where newer is better. The homesite is simultaneously ahead of Decanter 8 and incompatible with it. `prior-art/README.md` now tracks **lineage** (consumer, derived, upstream) alongside era.

**New open question:** if a unit site wants a pattern that exists on `www.stanford.edu` but not yet in Decanter 8, does it wait for the pattern to land, or adopt early and accept a parallel vocabulary? This will come up, and neither answer is obviously right.

## Copy-forking is the incumbent workflow

`cardinalsites-nextjs` and `csp-nextjs` are **intentional sibling instances**: two clients, one repo copied to create the other. I had flagged them as possible unmanaged divergence. They are neither a problem nor an accident.

This deserves more than a correction in a footnote, because **copy-forking a previous client site is the existing solution to the problem this project is trying to solve.** It is fast, it carries genuinely working code, and it preserves a hundred decisions no document ever captured. It is a good practice, and any tool that treats a near-duplicate repo as a defect has misread the shop.

What copy-forking cannot do is carry standards forward or tell you what has moved. A fork made 18 months ago silently inherits that era's Decanter, that era's accessibility target, and that era's dependency set, permanently and invisibly.

So the honest positioning is not "stop copy-forking." It is: **keep the reuse, add a way to know what changed.** A recipe is the diff a fork cannot give you. That framing is also better for adoption, since it starts from something the team already does well rather than asking them to abandon it.

Practical consequence: `relationship: sibling-instance` is a recognised, legitimate pattern in `repos.yml`. The agent reports it as context, never as drift.

## Observations worth acting on

**`react-cookiebot` in `summer-nextjs` is a client requirement, not a convention.** It is the only cookie-consent tooling in the set, and SWS confirms Stanford centrally licenses **no** banner service. That instance was required by the client for that site.

This is a useful example of clause 2 of the precedence rule failing safely. A single occurrence is not a repeated independent choice, so it never qualified as a convention. Had it appeared in five repos I would have had to ask *why* before concluding anything, which is exactly the sa11y lesson.

The resulting guidance, which generalises well beyond cookies: no banner is required, do not hand-roll one, and **do not name a vendor**. Route to the University Privacy Office. See "route, don't recommend" in the project plan: for anything with legal, policy, or procurement implications, name the responsible office rather than a product. SWS is not the university's privacy or procurement authority, and guidance that reads like an endorsement quietly implies it is.

**AI search is already in production.** `adapt-stanford-homesite` carries `@google-cloud/discoveryengine` and `@google/genai`. `role-discoverability` is a conversation with that team, not greenfield work.

**No house headless-component library.** `react-aria` and `react-stately` in `sulgryphon-nextjs`, `@base-ui/react` in the decoupled family, MUI in `ccc-bulletin` and `adapt-directory`, `@headlessui/react` in the ADAPT family. This is the layer where accessibility is usually won or lost, so it is worth asking whether there should be a house choice. `sulgryphon-nextjs` picking react-aria is the strongest a11y signal in the set.

**The decoupled Drupal family opts out of Turbopack** with `--webpack` across all four repos. Consistent enough to be deliberate. Ask why before recommending Turbopack.

**Node floors vary** from `>=20` to `>=24`, most on 22. Since recipes no longer pin, this only matters as a reason not to fail an existing project for its Node version.

## What this pass says about the method

The headline number is uncomfortable and worth keeping: **reading repos produced four proposed corrections and three were wrong.** The value was still real, because the review conversation those wrong proposals triggered produced better standards than either the repos or my reasoning alone. But the failure mode is now documented:

- Presence tells you **what**, never **why**. Confirm purpose before declaring a convention. The sa11y misread would have put a content-authoring tool into a CI pipeline where it does nothing useful, and left the actual post-launch content gap unaddressed.
- Current practice is not **intent**. Lockfiles are a record of decisions already made, and say nothing about direction. Playwright was invisible to the analysis precisely because the decision had not been executed yet.
- A version mismatch is often a **design smell**, not a decision to make. The right answer to "Astro 6 or 7" was to stop asking.

So prior art is a required input and an insufficient one. The recipe's step 0 stays, and it now ends with a human check rather than a conclusion.
