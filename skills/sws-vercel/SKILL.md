---
name: sws-vercel
description: Move a Stanford site from GitHub Pages to Vercel, or provision it there from the start, driven from the terminal where possible. Use when a project wants Next.js features on release day, is a decoupled Drupal front end, or the unit has or wants a Vercel account.
---

# Get it onto Vercel

**Same shape of job as `sws-netlify`, and the same honest limit.** Vercel's
git-based continuous deployment runs through a GitHub App too, and installing
that app for an account or org the first time is a browser OAuth consent
screen — there is no API call that substitutes for it. `vercel git connect`
handles the case where the grant already exists; it does not remove the
first-time step. Say this up front rather than promising a fully scripted path.

The exact commands, and what is verified versus reasoned, are in
`standards/hosting/vercel.yml` under `provisioning`. Read that; this file is
the order, the questions, and the judgment.

## First, ask

1. **"Do you already have a Vercel account, and is it a team or personal?"**
   Prefer a team, for the same reason as every other host here: a site whose
   only deploy access belongs to one person breaks MinWeb's
   named-administrator requirement the day that person leaves. If they have no
   team access, that is an access request for a team owner, not something to
   work around — route per `standards/policy/escalation.md`.
2. **"Does the repo already exist on GitHub?"** Vercel connects to a repo, it
   does not create one. If there is no repo yet, run `sws-github` first, or at
   least get the code pushed, before starting here.
3. **"Why Vercel and not Netlify?"** Read `standards/hosting/vercel.yml` and
   `standards/hosting/netlify.yml` together before answering for them. The
   right answer is almost always "the unit already administers one of these
   two," and Next.js features landing here first is the other legitimate
   reason — ask rather than picking on shared-tooling grounds alone.

## Preflight

```bash
npx sws preflight        # then install what it names, then run it again
```

**The Vercel CLI is optional here**, same as Netlify's —
`standards/stack/requirements.yml` marks `vercel-cli` `optional: true` because
Vercel deploys from its git integration, not from the CLI. Install it anyway
for linking, environment variables, and verification; just do not treat its
absence as a blocker the way a missing `gh` is one.

`git` is still mandatory regardless of host, for the same reason as always.

## Then run the steps in order

Follow `provisioning.steps` in `standards/hosting/vercel.yml`: `auth`,
`choose-team`, `link-project`, `connect-repo`, `build-config`, `verify`.

**`link-project` is scriptable; `connect-repo` might not be, and that
difference is worth stating out loud.** `vercel link --yes --scope <team>`
accepts Vercel's detected framework defaults and creates a project without a
prompt. `vercel git connect` then wires that project to the GitHub repo — and
if this is the team's first repo on Vercel, it walks a GitHub App installation
that is an OAuth consent screen with no API substitute. Tell the person this
is coming before running it, the same way `sws-github` warns about the macOS
Xcode Command Line Tools dialog appearing unannounced. Once a team's GitHub
App grant covers new repos in that org, later projects on the same team skip
the consent screen entirely.

**Config belongs in the repo, not the dashboard.** Commit `vercel.json` for
headers, redirects, and build overrides per
`standards/recipes/astro-ssr/RECIPE.md` step 8b, for the same reason secrets
go in Vault rather than a host UI. Reserve `vercel env add` for values that
must not be committed, and prefer `node-vault` — the host-portable option and
the decoupled-drupal family convention — over hand-set dashboard values.

**Secrets do not live in `.env` in production.** If the unit's Vault access is
not yet set up, that is its own request to the Vault administrator, not
something this skill can provision.

**Watch for the `*.vercel.app` trap.** A project that never connects a custom
domain quietly ships on a preview-style URL. That is fine pre-launch and not
fine at launch — `standards/hosting/vercel.yml` names `press-nextjs`'s
`stanford-university-press.vercel.app` as the live example of this being
missed. Confirm the production domain before calling a project launched.

## Never add branch protection or required status checks

Same rule as `sws-github` and `sws-netlify`, for the same reason: many campus
editors work through the GitHub web UI, which is push-to-main by construction,
and branch protection quietly turns that into a pull-request requirement.
Vercel's git integration already deploys on push to `main`; keep any GitHub
Actions workflow for checks only, never as a deploy gate.

## Verify, then say what you have not done

```bash
vercel project ls
vercel inspect <deployment-url>
```

There is no single boolean confirmed here against a live API response the way
`gh api .../pages` returns `https_enforced`. Vercel's automatic HTTPS is close
to unconditional for a Vercel-managed or correctly CNAMEd custom domain, but
confirm the certificate is actually live on first real use rather than
assuming it, and confirm the production URL is a real subdomain rather than a
`*.vercel.app` preview domain.

**Provisioning is not launching.** Close by naming what remains, same list as
`sws-github` and `sws-netlify` and with the same lead times:

- **The `stanford.edu` subdomain** — University Communications approves the name.
- **The ODA accessibility review** — a pre-launch gate; raise it now.
- **Siteimprove registration** — required for public sites, its own intake.
- **Business owner and technical administrator** in `.sws/manifest.yml`, both
  with valid Stanford affiliation.
- **MFA attested** on the Vercel team dashboard — an administrative login
  under MinWeb, and not on by default.

Record what you did in `.sws/manifest.yml` under `hosting`: `provider:
vercel`, the `production_url`, and the date MFA was confirmed.
