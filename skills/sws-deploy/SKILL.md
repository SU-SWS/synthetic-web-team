---
name: sws-deploy
description: Deploy a Stanford site and run the pre-launch steps. Use when setting up CI or hosting, when moving from GitHub Pages to Netlify or Vercel, when asked how to publish or go live, or when a launch checklist is needed.
---

# Deploying, and going live

Two different jobs. Deployment is mechanical. Launch has steps no automation can
do, and those are where compliance actually lands.

## Push to main deploys. Pull requests never required.

Trigger on both and gate only the deploy:

```yaml
on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:
```

Deploy job: `if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'`

**Do not set up branch protection, required status checks, or a protected
environment beyond `github-pages`.** Each quietly converts push-to-main into a
pull-request requirement. Many campus editors work through the GitHub web UI,
which is push-to-main by construction, and they will not open a pull request to
fix a typo.

If a project already has branch protection, leave it. Someone may have added it
deliberately. Report, do not remove.

## GitHub Pages

**To provision a repo and turn Pages on, use the `sws-github` skill** — it drives
`gh` through auth, org choice, repo creation, push, and the Pages API, so almost
nobody needs a web UI.

Two jobs, first-party actions. As of 2026-09-03 this project's own live deploy
runs `configure-pages@v6`, `upload-pages-artifact@v5`, `deploy-pages@v4`.
Artifact actions v3 are no longer supported for Pages, and
`upload-pages-artifact@v4`+ needs `deploy-pages@v4` or newer. Check the release
pages rather than trusting this line.

```yaml
permissions:
  contents: read
  pages: write
  id-token: write
  issues: write          # the persistent Site health issue
  pull-requests: write   # PR comment when a PR fired
concurrency:
  group: pages
  cancel-in-progress: false
```

Drop `issues: write` or `pull-requests: write` and the advisory report is
produced and nobody sees it, which is worse than not running it.

Also set repo Settings → Pages → Source to **GitHub Actions**. Outside the
workflow, easy to forget.

**Two gotchas worth an afternoon each:**

1. **`upload-pages-artifact` excludes dotfiles.** If the build output needs
   `.well-known/` or similar, verify it survives or build the tar yourself.
2. **Subpath deploys need `base`** set in the framework config, or internal
   links work locally and break in production.

Pages serves **one site**, so a pull request gets checks but **no preview URL**.
Say so rather than letting someone expect previews.

## Moving off Pages: Netlify or Vercel

**SWS runs both, one per family**, and neither is the house default:

| Family | Host | Secrets |
|---|---|---|
| `storyblok-next-netlify` (ADAPT/OOD, 6 repos) | Netlify | `netlify-plugin-vault-variables` |
| `decoupled-drupal` (Cardinal Sites, 5 repos) | Vercel | `node-vault` |

**Start from where the unit already is.** If they have a Netlify or Vercel
account, people who can log into it, and a billing arrangement that works, that
is the right host — the shared-tooling argument is real but it is worth less than
an account someone already administers. Ask before recommending.

Full profiles, with the capability each host does and does not cover, are in
`standards/hosting/`. Read those rather than reasoning from vendor marketing.

Both give **per-PR preview URLs**, which is the actual reason to move off Pages
once review matters.

**Do not rank hosts, and do not introduce a third one on your own.** A new vendor
relationship is a procurement question with contractual consequences. State the
obligation, name the office, stop. See `standards/policy/procurement.md`.

**Secrets do not live in `.env` in production.** SWS uses HashiCorp Vault, via
`netlify-plugin-vault-variables` in the Storyblok family and `node-vault` in the
decoupled Drupal family. `node-vault` is the host-portable one: prefer it if you
might move hosts later.

## Making git disappear

For non-technical units this is the actual goal, and it decides **who can
maintain the site** — which matters more than any technical detail here.

**This package is scoped to static content authored in the repo, with no CMS**
(`standards/scope.md`). So there are two paths, and the CMS is not one of them
yet:

- **GitHub web UI editing.** Edit a Markdown file, commit to `main`, the site
  rebuilds. Already supported by the trigger above, and this is why nothing may
  make a pull request mandatory. A real answer for a unit with one or two people
  willing to edit Markdown.
- **Point them at Stanford Sites.** Free, already compliant, and someone else
  maintains it. The right referral for a unit that will maintain a site alone
  with no appetite for git. `astro-static` says this too.

**Raise it in discovery, not at launch.** If the unit genuinely needs a CMS, say
plainly that this package does not cover it yet rather than building half a
content backend to avoid the conversation. Eleven SWS repos are CMS-backed in
production, so the capability exists in the org — just not as a tested recipe
here.

## Pre-launch checklist

These are the steps no CI can perform. Work through them with the person and
record dates in `.sws/manifest.yml`.

| Step | Notes |
|---|---|
| **Subdomain approved by University Communications** | Must reflect the recognised unit name. Not optional, and not fast |
| **Business owner and technical administrator recorded** | Both with valid Stanford affiliation and email, discoverable on the site |
| **HTTPS with a live certificate** | MinWeb requirement |
| **ODA accessibility review requested** | Pre-launch gate needing lead time. Raise it during the project, not the week before |
| **Manual WCAG 2.1 AA checklist completed** | Covers the ~70 percent axe cannot see |
| **Siteimprove registration submitted** | Required for public-facing sites. Google Analytics is **not** required |
| **MFA or SSO-with-MFA on all admin logins** | MinWeb requirement |
| **Data Risk Assessment** | Only if the tier is above `low`, or third-party services or personal data were introduced |
| **Privacy and Security consult** | Recommended pre-launch at moderate tier and above |
| **`sws check` reviewed** | Fix or acknowledge. Nothing blocks except secrets |

Escalate each to the right office and the right door per
`standards/policy/escalation.md`. One door with a reason, not a list.

## Post-launch, which is not optional either

MinSec applies to low-risk static sites too. The cadence is in
`standards/policy/minsec.md`: 7 days for high-severity, 90 for the rest, monthly
scanning, quarterly inventory, quarterly privilege review. Dependabot covers part
of it. The rest is a documented runbook and a human, and it lives at the
infrastructure layer rather than in the repo.

Secure sunset matters and gets forgotten: when a site retires, remove DNS,
revoke credentials, archive or delete content, and kill dangling CNAMEs.
