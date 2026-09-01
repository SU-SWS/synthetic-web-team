---
name: role-devops
description: Set up and run the delivery pipeline for a Stanford site. Use for repository setup, CI workflows, deployment, environment and secret handling, dependency updates, the test harness, and wiring the advisory compliance checks.
---

# Delivery and operations

Repository, CI, deployment, and the automated quality gates. See `sws-deploy` for
the deployment mechanics and launch checklist. This skill covers the pipeline
around it and the operational obligations after launch.

## Repository setup

Keep it boring and legible. Someone who is not a developer may need to edit a
page here.

- **`main` is the deploy branch.** No branch strategy to learn.
- **No branch protection, no required status checks, no protected environment
  beyond `github-pages`.** Each of those silently converts push-to-main into a
  pull-request requirement. If a project already has them, leave them and report;
  someone may have added them deliberately.
- **`.gitignore` covers `node_modules`, build output, `.sws/prior-art.local.yml`**
  (a local index that must never be committed) **and `.sws/axe-results.json`**
  (derived from a build; committing it lets a stale pass travel with the repo).
  Anchor the `.sws` patterns with `**/` if the site lives in a subdirectory — a
  leading-slash pattern only matches at the repo root, which bit this project.
- **Dependabot on**, grouped, weekly. This is part of the MinSec patch cadence
  rather than housekeeping.
- **A README that says what the site is, who owns it, and how to edit it.** For
  many Stanford repos the future maintainer is a person who has never used git.

## The workflow

One file. Triggers on push to `main`, on pull requests, and manually. Deploy is
gated to `main`; checks run on both.

```yaml
on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:
```

Full permissions block, Pages action versions, and the two gotchas
(`upload-pages-artifact@v4` excludes dotfiles; subpath deploys need `base`) are in
`sws-deploy`.

## The report has to reach a reader

This is the part that gets designed wrong. A report nobody sees is worse than no
report, because it implies oversight that is not happening.

| Trigger | Destination |
|---|---|
| Push to `main` | Job summary via `$GITHUB_STEP_SUMMARY`, plus one long-lived **"Site health" issue updated in place**, plus the HTML report as an artifact |
| Pull request | Annotations on changed lines, one collapsible comment with score and trend, plus the artifact |

The job summary needs no permissions and renders formatted markdown on the run
page. A single issue rewritten rather than duplicated is findable by someone who
has never opened the Actions tab, notifies watchers, and keeps history in its own
edit trail.

`sws check` does all of this itself when it detects Actions. Three things to get
right, each of which silently disables a destination:

1. **`issues: write` and `pull-requests: write`** in the workflow permissions.
2. **`GITHUB_TOKEN` in the step's `env`.** It is *not* in the environment by
   default. Without it the CLI skips publishing and says so on stdout.
3. **Only ONE workflow should publish** — the one that built the site. A second
   `sws check` running from the repository root has no build output, scores
   meaninglessly low, and will overwrite the real report. Pass `--no-publish`
   there. This project hit exactly that with its own secrets-gate job.

The score trend lives in the Site health issue body as an HTML comment, so it
needs no database, no artifact that can expire, and no committed file to
conflict. `--html` writes a standalone report for an artifact and `--badge`
writes shields.io endpoint JSON; put the badge inside the build output so it
deploys with the site.

## Everything is advisory except one thing

**The job succeeds regardless of findings.** A separate, small, fast secrets job
is the only one allowed to fail.

The secrets message must differ by context. On a pull request, blocking stops the
leak from landing. On a push to `main` the commit is already in the remote's
history, so blocking only prevents publishing the credential on a public website.
Still worth stopping, but say it in this order: **rotate the credential now**,
because blocking the deploy does not un-leak it, then clean the history, then
push again. "Secret detected" alone teaches nothing and gets worked around.

## Secrets do not live in `.env` in production

SWS uses HashiCorp Vault: `netlify-plugin-vault-variables` in the Storyblok
family, `node-vault` in the decoupled Drupal family. Follow that rather than
introducing a new pattern.

Consequence worth knowing: MinWeb's "no API keys in Git" requirement is largely
handled institutionally, which makes our secrets check a backstop rather than the
primary control. That is a good position to be in and it does not mean the check
is redundant.

## The test harness

**Playwright plus `@axe-core/playwright`** against every route in the built
output, asserting zero violations tagged `wcag2a`, `wcag2aa`, `wcag21a`,
`wcag21aa`.

The CLI ships this. Install the two packages plus a browser in the project, then
run it as its own CI step **after the build and before `sws check`**:

```bash
npm i -D @playwright/test @axe-core/playwright
npx playwright install chromium
sws a11y      # writes .sws/axe-results.json; always exits 0
sws perf      # writes .sws/perf-results.json; always exits 0
sws check     # reads both
```

**The performance budget is bytes, not Lighthouse.** `sws perf` measures
first-party uncompressed transfer bytes and request counts per route against
`standards/stack/performance-budget.yml`. A Lighthouse score moves ten points
between runs on a shared CI runner, and a self-moving number inside a trended
compliance score teaches people to ignore the score. Navigation timings are
recorded but never scored.

It also lists **third-party origins**, which is a privacy signal as much as a
performance one: MinPriv treats a new third-party service as disclosable. Any
limit can be overridden in `.sws/manifest.yml` under `performance_budget:` with
a reason, and the report says which limits were overridden.

`sws check` deliberately does not launch a browser, so it stays fast and
installable anywhere. Keep axe a separate step: a browser download failure is
legible on its own line and invisible inside a compliance report. Never commit
`.sws/axe-results.json` — results older than the build report as `unknown`.

Playwright is the forward default even though `adapt-stanford-homesite`,
`adapt-directory`, and `ccc-bulletin` all run Cypress with e2e and component
testing. **Never convert an existing Cypress suite** to match.

Two things the harness must get right:

1. **Report `unknown`, not `pass`, when a check cannot run.** axe needs a real
   browser. A harness that prints "0 violations" because axe failed to load is a
   report that lies, and this has actually happened here.
2. **No component workshop.** These sites have few components and one consumer.
   Vitest plus `axe-core` covers component-level assertions if a component set
   ever earns real reuse.

`ccc-bulletin` runs BackstopJS for visual regression, the only instance across
SWS. Worth knowing about, not worth requiring.

## Environments

Keep the matrix small. For a static site: local, preview, production. Note that
**GitHub Pages serves one site, so there are no per-PR previews** without
machinery we do not build. Netlify and Vercel give them free, which is a real
reason to move once review matters.

Record what actually resolved at install time in `.sws/manifest.yml`. Record, do
not enforce: recipes install latest and pin nothing, so the manifest is
provenance rather than a gate.

## After launch, which is also yours

MinSec applies to low-risk static sites too, and this is the part people assume
does not apply. The full cadence is in `standards/policy/minsec.md`; the short
version is patch high-severity within 7 days and others within 90, monthly
scanning, quarterly inventory, quarterly privilege review, and **MFA or
SSO-with-MFA on every administrative login** per
`standards/policy/minweb.md`.

Dependabot covers part of the patch cadence. The rest is a documented runbook and
a named human, and it lives at the infrastructure layer rather than in the repo.
Write the runbook; do not assume someone remembers.

**Secure sunset** gets forgotten and matters: remove DNS, revoke credentials,
archive or delete content, kill dangling CNAMEs. Ask the strategist for the
sunset plan on any campaign or event site.

## Artifacts

| Artifact | Path |
|---|---|
| Workflows | `.github/workflows/` |
| Deploy configuration | `netlify.toml` or equivalent |
| Environment matrix | `docs/ops/environments.md` |
| Operations runbook | `docs/ops/runbook.md` |
| Manifest | `.sws/manifest.yml` |

## A note on making git invisible

For units with non-technical editors, the two paths that work are the **GitHub
web UI** (edit, commit to `main`, site updates) and a **CMS** where publishing
fires a webhook and the editor never touches GitHub at all.

If the site has content editors who are not developers, raise the CMS path early.
It changes who can maintain the site, which outlasts every technical decision in
this document.
