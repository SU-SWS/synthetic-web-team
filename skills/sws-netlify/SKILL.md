---
name: sws-netlify
description: Move a Stanford site from GitHub Pages to Netlify, or provision it there from the start, driven from the terminal where possible. Use when a project needs per-PR previews, response headers, real redirects, or a server runtime, and the unit has or wants a Netlify account.
---

# Get it onto Netlify

**This is a different shape of job from `sws-github`, and the difference is the
thing to get right.** `gh` can do the entire GitHub-side job headlessly: a PAT
or an OAuth grant is enough to create a repo, push, and flip on Pages. Netlify's
git-based continuous deployment instead needs the Netlify account to hold a
GitHub App authorization scoped to the repo, and granting that is an OAuth
consent screen in a browser — there is no API call that substitutes for it.
Say this up front rather than promising a fully scripted path and then hitting
a browser prompt partway through.

The exact commands, and what is verified versus reasoned, are in
`standards/hosting/netlify.yml` under `provisioning`. Read that; this file is
the order, the questions, and the judgment.

## First, ask

1. **"Do you already have a Netlify account, and is it a team or personal?"**
   Prefer a team. A site whose only deploy access belongs to one person breaks
   MinWeb's named-administrator requirement the day that person leaves — the
   same failure as a personal GitHub account in `sws-github`. If they have no
   team access, that is an access request for a team owner, not something to
   work around — route per `standards/policy/escalation.md`.
2. **"Does the repo already exist on GitHub?"** Netlify connects to a repo, it
   does not create one. If there is no repo yet, run `sws-github` first, or at
   least get the code pushed, before starting here.
3. **"Why Netlify and not Vercel?"** Read `standards/hosting/netlify.yml` and
   `standards/hosting/vercel.yml` together before answering for them. The right
   answer is almost always "the unit already administers one of these two" —
   ask rather than picking on shared-tooling grounds alone.

## Preflight

```bash
npx sws preflight        # then install what it names, then run it again
```

**The Netlify CLI is optional here**, unlike `gh` for GitHub Pages —
`standards/stack/requirements.yml` marks it `optional: true` because Netlify
deploys from its git integration, not from the CLI. Install it anyway for local
dev, environment variables, and verification; just do not treat its absence as
a blocker the way a missing `gh` is one.

`git` is still mandatory regardless of host, for the same reason as always: a
working tree has to exist and be pushed before any host can deploy it.

## Then run the steps in order

Follow `provisioning.steps` in `standards/hosting/netlify.yml`: `auth`,
`choose-team`, `create-and-connect`, `build-config`, `verify`.

**`create-and-connect` is the step that opens a browser**, and it is the one
honest limit in this whole skill. `netlify init`, run from inside the repo,
walks a new-or-existing-site choice, a team choice, and — the part that cannot
be scripted around — the GitHub App authorization, if the team has not already
granted it for this repo. Tell the person this is coming before running it,
the same way `sws-github` warns about the macOS Xcode Command Line Tools dialog
appearing unannounced. Once a team's GitHub App grant covers new repos in that
org, later projects on the same team skip the consent screen entirely.

**Config belongs in the repo, not the dashboard.** Commit `netlify.toml` for
build command, publish directory, and headers per
`standards/recipes/astro-ssr/RECIPE.md` step 8b, for the same reason secrets go
in Vault rather than a host UI: it survives a dashboard reorganisation and a
person leaving. Reserve `netlify env:set` for values that must not be
committed, and prefer `netlify-plugin-vault-variables` — the ADAPT/OOD family
convention — over hand-set dashboard values.

**Secrets do not live in `.env` in production.** If the unit's Vault access is
not yet set up, that is its own request to the Vault administrator, not
something this skill can provision.

## Never add branch protection or required status checks

Same rule as `sws-github`, for the same reason: many campus editors work through
the GitHub web UI, which is push-to-main by construction, and branch protection
quietly turns that into a pull-request requirement. Netlify's git integration
already deploys on push to `main`; keep any GitHub Actions workflow for checks
only, never as a deploy gate.

## Verify, then say what you have not done

```bash
netlify open
netlify api getSite --data '{"site_id": "<site-id>"}'
```

Unlike the GitHub Pages check, there is no single boolean here confirmed
against a live response — Netlify's automatic HTTPS is close to unconditional
for a Netlify-managed or correctly CNAMEd domain, but confirm the certificate
is actually live on first real use rather than assuming it.

**Provisioning is not launching.** Close by naming what remains, same list as
`sws-github` and with the same lead times:

- **The `stanford.edu` subdomain** — University Communications approves the name.
- **The ODA accessibility review** — a pre-launch gate; raise it now.
- **Siteimprove registration** — required for public sites, its own intake.
- **Business owner and technical administrator** in `.sws/manifest.yml`, both
  with valid Stanford affiliation.
- **MFA attested** on the Netlify team dashboard — an administrative login
  under MinWeb, and not on by default.

Record what you did in `.sws/manifest.yml` under `hosting`: `provider:
netlify`, the `production_url`, and the date MFA was confirmed.
