---
name: sws-github
description: Put a Stanford site on GitHub and deploy it to GitHub Pages, driven from the terminal. Use when a project needs a git repo, a GitHub remote, an org to own it, or a Pages deployment; when someone asks how to publish or where the code should live; or when they have no GitHub account yet.
---

# Get it on GitHub, and deployed

**Do the work for them, starting from nothing.** Assume a new machine with
nothing installed. Once `git` and `gh` are in place, `gh` authenticates, creates
the repo, pushes, and turns Pages on, so almost nobody needs a web UI — do not
send them to one out of habit. The exact commands, and what is verified versus
not, are in `standards/hosting/github-pages.yml` under `provisioning`. Read
that; this file is the order, the questions, and the judgment.

## First, ask three questions

Ask them together, before running anything. The answers change the work.

1. **"Do you have a GitHub account?"** If yes, `gh auth login` is the whole
   story once `gh` is installed. If no, see below — account creation is the one
   step that genuinely needs a browser.
2. **"Which Stanford org should own this?"** Run `gh api user/orgs --jq '.[].login'`
   and show them what they already belong to. Do not guess.
3. **"What should the repo be called?"** Their call, not yours. Suggest the unit
   or site name; a repo name is not the subdomain and does not need approval.

**Prefer an org over a personal account, and say why.** A site whose only deploy
access belongs to one person breaks MinWeb's named-administrator requirement the
day that person graduates. This is the most common quiet failure in the whole
hosting story. If they have no org access, that is an access request needing an
org owner, not something to work around — route per
`standards/policy/escalation.md` and be honest that the GitHub route is not yet
a confirmed door.

## Preflight: assume the machine is bare

**Assume nothing is installed.** No `gh`, possibly no `git`, possibly no package
manager. Check, then install what is missing — do not send a new user on a
scavenger hunt.

```bash
git --version    # mandatory, no substitute
gh --version     # install if missing
gh auth status   # skip the login if already authed
```

Full cross-platform install ladder, including the no-package-manager path:
`standards/hosting/github-pages.yml`, under `provisioning.prerequisite`.

**Install `git` and `gh`. Not the MCP server** — and the reason matters, because
"an MCP server needs no install" is a fair argument that happens to be wrong
here. **You are installing `git` either way.** This task pushes a working tree:
`init`, commit, remote, push. The GitHub API can create a repo, write files, and
switch Pages on, but it cannot init a repo, commit locally, or push a tree. So
an MCP server cannot finish the job and the install was never avoidable. Once
`git` is going in, `gh` is one more binary that buys the OAuth device flow (no
raw token to mishandle, stored in the OS keychain), the git remote and
credential helper wired up in the same step, `gh api` for enabling Pages, and
`gh run watch` for verification.

Use the hosted MCP server only for an agent with **no shell at all**
(`claude mcp add --transport http github https://api.githubcopilot.com/mcp/`).
Note such an agent cannot run `git` either, so it can do the GitHub half and not
the local half. Never install both for one job — that is two auth systems.

**On macOS, `git --version` can itself trigger the Xcode Command Line Tools
dialog.** A person has to click that; an agent cannot. Say it is about to happen
rather than letting a box appear from nowhere.

**Do not install Homebrew just to get `gh`.** It is a very large dependency for
one binary. Every platform has a package-manager-free download from
`github.com/cli/cli/releases/latest`, and the zip and tarball forms need no
admin rights.

### If they have no account

Say plainly: **creating a GitHub account cannot be done from a CLI or an API.**
There is no signup endpoint, by design. That single step is `github.com/signup`
in a browser, then `gh auth login --web` takes over and you drive the rest. Do
not pretend to automate it, and never ask for their password.

### If nothing can be installed

On a locked-down machine that has `git` but cannot add `gh`: this project already
requires **Node** (`>=22.12.0`), and Node 18+ has a global `fetch`, so every
REST call in the runbook can be made from a few lines of Node with **no new
dependency**. Auth then needs a Personal Access Token, which is a credential —
pipe it in on stdin (`gh auth login --with-token < token.txt`, then delete the
file), never as a command argument or inline env var, because both land in shell
history and the process list.

**That token needs the `workflow` scope**, on top of the documented `repo` and
`read:org`. Pushing a `.github/workflows` file without it fails with *"refusing
to allow a Personal Access Token to create or update workflow"* — an error that
names the token rather than the missing scope, and costs an hour.
`gh auth refresh -s workflow` adds it.

While they are there: **turn on 2FA.** GitHub is an administrative login that can
trigger a deploy and read secrets, so MinWeb's "MFA on all administrative
logins" covers it. GitHub requires 2FA for contributors anyway.

## Then run the steps in order

Follow `provisioning.steps` in `standards/hosting/github-pages.yml`: `auth`,
`choose-owner`, `prep-workspace`, `create-and-push`, `enable-pages`, `workflow`,
`verify`. They are written to be idempotent, so a re-run is safe.

Three that deserve attention:

**Before the first commit, check for secrets.** Run `npx sws check` and look at
`minweb.no-secrets`. This is the only blocking finding in the system, and the
reason is that **pushing is the irreversible step**. If something is already
committed locally, rotate the credential first, then clean history, then push.
Blocking the deploy does not un-leak anything.

**`enable-pages` is the step everyone forgets**, including this project on its
own first run. Until Pages source is set to GitHub Actions, the deploy fails
with *"Branch main is not allowed to deploy to github-pages due to environment
protection rules."* That message points at protection rules, so people go and
fight the environment settings instead of switching the source. Set it from the
API and skip the whole detour.

**Never add branch protection or required status checks.** Push to `main`
deploys. Many campus editors work through the GitHub web UI, which is
push-to-main by construction, and they will not open a pull request to fix a
typo. Pull requests are first-class and never required. If a repo already has
protection, leave it — someone may have chosen it. Report, do not remove.

## The workflow

Take it from `standards/recipes/astro-static/RECIPE.md`, step 8. Do not
hand-write it. What matters:

- **Trigger on push, `pull_request`, and `workflow_dispatch`; gate only the
  deploy job.** A workflow that deploys only on merge locks out web-UI editors.
- **The permissions block needs `issues: write` and `pull-requests: write`** on
  top of the Pages ones. Drop them and the advisory report is generated and
  nobody ever sees it, which is worse than not running it.
- **`concurrency: {group: pages, cancel-in-progress: false}`.** Queue, do not
  skip, per GitHub's own Pages guidance.
- **Pages serves one site, so a pull request gets checks but no preview URL.**
  Say so, rather than letting someone expect previews. Wanting previews is a
  good reason to look at Netlify or Vercel — see `standards/hosting/`.

Two traps worth an afternoon each:

1. **`upload-pages-artifact` excludes dotfiles.** `CNAME` survives; `.well-known/`
   does not. Verify anything dot-prefixed reaches `dist`.
2. **A subpath deploy needs `base`** set in the framework config, or links work
   locally and break in production. `su-sws.github.io/<repo>/` is a subpath.

## Verify, then say what you have not done

```bash
gh run watch
gh api repos/<owner>/<repo>/pages --jq '{url: .html_url, https: .https_enforced, cname: .cname}'
```

`https_enforced: true` satisfies MinWeb's HTTPS requirement and is verifiable
rather than attested, which is rare and worth using. `cname: null` means the site
is still on a `github.io` URL — fine now, not at launch.

**Provisioning is not launching.** Close by naming what remains, because these
have lead times and none of them is yours to grant:

- **The `stanford.edu` subdomain** — University Communications approves the name.
- **The ODA accessibility review** — a pre-launch gate; raise it now, not the
  week before.
- **Siteimprove registration** — required for public sites, its own intake.
  Google Analytics is *not* required.
- **Business owner and technical administrator** in `.sws/manifest.yml`, both
  with valid Stanford affiliation.
- **MFA attested** on the account and on any org owner account.

Record what you did in `.sws/manifest.yml` under `hosting`: `provider:
github-pages`, the `production_url`, and the date MFA was confirmed. The next
person should not have to guess where the site lives.
