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

Two jobs, first-party actions: `configure-pages@v5`, `upload-pages-artifact@v4`,
`deploy-pages@v5`. Artifact actions v3 are no longer supported for Pages.

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

1. **`upload-pages-artifact@v4` excludes dotfiles.** If the build output needs
   `.well-known/` or similar, verify it survives or build the tar yourself.
2. **Subpath deploys need `base`** set in the framework config, or internal
   links work locally and break in production.

Pages serves **one site**, so a pull request gets checks but **no preview URL**.
Say so rather than letting someone expect previews.

## Moving to Netlify

Netlify is where SWS runs: functions, blobs, edge functions, the CSP nonce
plugin, and Vault-backed environment variables are all in production use. Vercel
appears once across eleven repos. Choosing Vercel means leaving the platform
every other SWS project uses, which costs you the shared tooling.

Netlify also gives per-PR preview URLs, which is the real reason to move once
review matters.

**Secrets do not live in `.env` in production.** SWS uses HashiCorp Vault, via
`netlify-plugin-vault-variables` in the Storyblok family and `node-vault` in the
decoupled Drupal family. Follow that rather than introducing a new pattern.

## Making git disappear

For non-technical units this is the actual goal, and there are two paths:

- **GitHub web UI editing.** Edit, commit to `main`, site updates. Already
  supported by the trigger above.
- **A CMS.** With Storyblok an editor never touches GitHub: publish fires a
  webhook, the build runs, the site deploys. Astro has no ISR primitive, so
  freshness comes from webhook-triggered rebuilds rather than in-framework
  revalidation.

If the site has content editors who are not developers, the CMS path is worth
raising early. It changes who can maintain the site, which matters more than any
technical detail here.

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

MinSec applies to low-risk static sites too: patch high-severity findings within
7 days and others within 90, monthly vulnerability scanning, quarterly inventory
with risk class, quarterly account and privilege review. Dependabot covers part
of the patch cadence. The rest is a documented runbook and a human, and it lives
at the infrastructure layer rather than in the repo.

Secure sunset matters and gets forgotten: when a site retires, remove DNS,
revoke credentials, archive or delete content, and kill dangling CNAMEs.
