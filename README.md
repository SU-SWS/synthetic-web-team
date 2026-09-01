# Synthetic Web Team

[![Stanford compliance](https://img.shields.io/endpoint?url=https%3A%2F%2Fsu-sws.github.io%2Fsynthetic-web-team%2Fbadge.json)](https://su-sws.github.io/synthetic-web-team/)

**A portable agent team that reproduces Stanford Web Services practice inside whichever AI coding tool you already use.**

<sub>The badge reads its own score from `badge.json`, which the site deploys — no gist, no secret, no service beyond shields.io. It will show `inaccessible` until the first deploy publishes the file.</sub>

Open Claude Code, Cursor, VS Code, Codex, or Antigravity in a Stanford project and get the working knowledge of a full SWS web team: strategy, information architecture, content design, UX, front end, accessibility, discoverability, and delivery. The output is a Stanford site that is compliant by default and that you can actually maintain.

Everything here is Markdown, YAML, and a small CLI. **No application code, no starter templates, no design system fork.**

## Status

Early. The plan is complete and reviewed; the implementation is partway through.

| | |
|---|---|
| Project plan | Done. [`PROJECT-PLAN.md`](PROJECT-PLAN.md) |
| Standards (L0) | **Complete for v1.** 8 policy files, 7 patterns, prior art, 2 recipes, the footer fragment, reference versions |
| `astro-static` recipe | Written, and **executed end to end** against a real build |
| `next-netlify` recipe | Written, extends `astro-static`. Not yet executed end to end |
| Shared skills | 6 of 6 done |
| Role skills | **8 of 8 built, 11 of 11 stubs.** 25 skills total, all validated |
| Documentation site | **Working.** [`site/`](site/), built by our own recipe, scores 91/100 with zero failures |
| `sws` CLI | **Working.** `doctor` and `check` run 13 check modules against 63 criteria. `sws a11y` runs axe and `sws perf` measures a byte budget, both in real Chromium |
| Report delivery | **Working.** PR comment and a persistent "Site health" issue, both updated in place. Score trend, sparkline, HTML artifact, README badge |
| Install wizard | **Working, agent-first.** Non-interactive by default off a TTY, `--json` result with machine-readable next steps, `--answers` input, idempotent re-runs that preserve project state |
| Publishable packages | **Working, not yet published.** Two packages — `@su-sws/sws` and `@su-sws/mcp` — verified by installing the tarballs into a clean project with no repository present |
| Updates | **Working.** Re-install is the update: project state preserved, local edits reported as conflicts rather than overwritten, stale files reported not deleted, staleness nag in `sws doctor` |
| Recipe canary | **Deliberately deferred**, 2026-09-01. Not in production, so nobody is exposed to upstream drift yet. Revisit before the first pilot |
| Standards freshness CI | Planned, and the priority ahead of the canary. Keeps policy, prior art, and sourced facts from going stale |
| MCP server | **Working.** [`packages/mcp/`](packages/mcp/). 5 tools, 26 resources, verified over the real stdio protocol |

End to end, verified: `create-web-team` installs, an agent follows the recipe, then `npm run build && sws a11y && sws perf && sws check` reports **100/100 with zero automated failures** — 45 criteria passing, none to fix, 8 unchecked. axe runs in real Chromium against every built route and finds 0 violations at WCAG 2.1 AA; the byte budget passes at 42 KB of 800. **Every one of the 8 unchecked items is genuinely unautomatable** — the manual WCAG checklist, ODA review, subdomain approval, MFA attestation, the DRA question — and each says so with a reason rather than being quietly dropped.

**A green axe run is a floor, not a conformance claim.** It covers roughly 30 percent of accessibility issues per ODA guidance, and this project says so in the report itself.

## Install

**The primary caller is an agent, so that is the first-class path.** One command,
no prompts, one JSON document on stdout, stable exit codes:

```bash
npx @su-sws/create-web-team --json --answers '{
  "siteName": "Stanford Bioengineering",
  "unit": "Bioengineering",
  "purpose": "Help prospective graduate students apply",
  "url": "https://bioe.stanford.edu",
  "businessOwnerName": "...", "businessOwnerEmail": "...@stanford.edu",
  "techAdminName": "...",     "techAdminEmail": "...@stanford.edu",
  "collectsPersonalData": false, "authenticates": false
}'
```

**Non-interactive is the default whenever stdin is not a TTY**, so an agent
cannot hang on a prompt. With `--json`, stdout is exactly one JSON document and
every human-readable line goes to stderr.

Three fields in the result are the ones an agent should act on:

| Field | Why it matters |
|---|---|
| `next[]` | What to do next, **as data**: `read-contract`, `orient`, `follow-recipe`, `complete-manifest`, `verify`. Each has a path or command and a `why` |
| `incomplete[]` | Manifest fields that are still placeholders. **Ask the user for these; do not invent them** — MinWeb requires a named business owner and technical administrator with valid Stanford email |
| `counts` | `created` / `updated` / `unchanged` / `preserved`. A re-run reports `unchanged`, so "already installed" is a truthful answer rather than a second claim of success |

Exit codes: `0` success or dry run, `2` bad input or no content found, `3` a human
declined at the confirmation prompt.

Re-running is safe. `.sws/manifest.yml` and `.sws/acknowledged.yml` are project
state and are **preserved**, never overwritten — everything else is content and is
rewritten from source.

### Updating

**Re-running the installer *is* the update.** There is no separate `update`
command, because the content is vendored into your project rather than resolved
at runtime — so an update is a re-copy, and the only question is what it is
allowed to touch.

```bash
npx @su-sws/create-web-team add .
```

Three guarantees make that safe to run at any time:

| Verdict | What happens |
|---|---|
| `preserved` | `.sws/manifest.yml` and `.sws/acknowledged.yml` are **never** overwritten. They hold your owners, resolved versions, recorded divergences and accepted risks |
| `conflict` | A file **you edited** is reported and left alone. `--force` overrides |
| `orphan` | A file we shipped before and no longer do is **reported, not deleted**, every run until you remove it |

`.sws/installed.json` records the hash of everything written, which is what lets
an update tell a local edit from an old version. **Commit it.** Delete it and you
lose conflict detection until the next install.

`npx sws doctor` tells you when a project is behind: content and tools ship in
one package, so the CLI's version *is* the standards version — no network call.

### If you are a human

Same command without `--json`. It detects your editors, asks a handful of
questions, and shows you the file list before writing anything. `--dry-run`
reports what it would do and writes nothing; `--interactive` forces prompts even
without a TTY.

Nothing is published to npm yet. Until it is, install from a checkout — the
wizard finds its content beside itself or in the current directory:

```bash
git clone https://github.com/SU-SWS/synthetic-web-team
cd synthetic-web-team && npm install
cd /path/to/your/project
node /path/to/synthetic-web-team/packages/create-web-team/bin/create-web-team.mjs
```

Or copy the files by hand, which is all the wizard is really doing:

```bash
# From your project root
cp -r path/to/synthetic-web-team/AGENTS.md .
cp -r path/to/synthetic-web-team/standards .
mkdir -p .agents .claude
cp -r path/to/synthetic-web-team/skills .agents/skills
cp -r path/to/synthetic-web-team/skills .claude/skills
echo '@AGENTS.md' > CLAUDE.md
```

Those two skill paths between them are read natively by Claude Code, VS Code Copilot, Cursor, Codex CLI, Gemini CLI, Zed, Antigravity, and Cline. No build step, no compiler, no plugin to install.

Two copies because no single path is read by every editor, and we deliberately have no compiler. If you only use one editor, delete the other directory. See [`docs/skill-paths.md`](docs/skill-paths.md).

To start a new site, hand your agent [`standards/recipes/astro-static/RECIPE.md`](standards/recipes/astro-static/RECIPE.md) and ask it to follow it.

Then check it:

```bash
npm install --prefix packages/cli
node packages/cli/bin/sws.mjs doctor --standards standards
```

`doctor` always exits 0, so it is safe anywhere. `check` is the CI form and exits non-zero only on a blocking finding, which today means exactly one thing: committed credentials.

## What is in here

| Path | What it does |
|---|---|
| [`AGENTS.md`](AGENTS.md) | The behavioral contract. 100 lines, read by every tool |
| [`skills/`](skills/) | The team: 25 skills, each one `SKILL.md` with two frontmatter keys. 8 built roles, 11 honest stubs, 6 shared |
| [`standards/policy/`](standards/policy/) | Stanford requirements: MinSec, MinWeb, accessibility, privacy, brand, identity, procurement, escalation. Each file carries a `reviewed:` date |
| [`standards/patterns/`](standards/patterns/) | How SWS actually builds: Decanter, components, content, IA, forms, discoverability, plus conventions derived from reading 11 production repos |
| [`standards/stack/`](standards/stack/) | `reference-versions.yml`, a dated baseline. Advisory — nothing installs from it. Plus `performance-budget.yml`, the byte budget `sws perf` enforces |
| [`standards/recipes/`](standards/recipes/) | Build contracts with machine-checkable acceptance criteria |
| [`standards/fragments/`](standards/fragments/) | Byte-exact compliance content, like the Global Footer link set |
| [`standards/prior-art/`](standards/prior-art/) | Existing SWS work, with era, lineage, and judgment attached |
| [`packages/cli/`](packages/cli/) | The `sws` CLI. 13 check modules, axe and performance runners in real Chromium |
| [`packages/create-web-team/`](packages/create-web-team/) | The install wizard |
| [`packages/mcp/`](packages/mcp/) | `@su-sws/mcp`. The same standards as MCP tools and resources, for agents that prefer calling a tool to shelling out |

**Two published packages, not four.** `@su-sws/sws` ships the content, the CLI
and the wizard together — one version number, so the CLI always knows which
standards version it carries. `@su-sws/mcp` is separate only so CI does not
download an MCP SDK to run `sws check`. `packages/cli` and
`packages/create-web-team` are internal: they are published *inside*
`@su-sws/sws`, which is why there is no staging script and no empty-looking
package directory.

## Five decisions that surprise people

**Recipes, not starter templates.** We do not ship or maintain application code. A recipe says what must be true and delegates boilerplate to the upstream scaffolder (`npm create astro@latest`), so you get current versions and we have nothing to keep updated. A template starts rotting the day it is committed and every consumer inherits the rot.

**Install latest. Pin nothing.** Recipes name no version numbers, with exactly one exception: Decanter 8 rather than 7, because they are architecturally different and getting it wrong fails silently. Standards are expressed as things to avoid, which age far better than versions to require.

**Advisory, not blocking.** Findings are reports, PR comments, and a visible score that trends. Exactly one thing fails a build: committed credentials, because that harm is irreversible. A tool that fails your build over a contrast ratio gets uninstalled by Friday, and then nothing is compliant.

The report is designed to **find the reader** rather than expecting the reader to find CI. A push to `main` rewrites one long-lived "Site health" issue in place — findable by someone who has never opened the Actions tab, and it notifies watchers. A pull request gets one comment, also updated in place, because a new comment per push is noise people mute. The score trend lives in that issue's body as an HTML comment, which is why it needs no database, no artifact that expires, and no commit churn.

**Push to `main` deploys.** Pull requests are first-class but never required, and nothing in the setup makes one mandatory. Many campus editors work through the GitHub web UI and will not open a pull request to fix a typo. With a CMS, git disappears entirely.

**Recipes extend each other.** `next-netlify` declares `extends: astro-static` and contains only its differences: three criteria that do not apply, two whose mechanism changes, and ten that are new. The 52 shared criteria live in one place, so they cannot drift between recipes. Four CI gates enforce the contract in both directions: every criterion maps to a check, is marked manual, or declares `unimplemented:` with a reason; every finding a check can emit has a criterion somewhere; every criterion naming a check has a check that emits its id; and every `check:` names a module that exists. Each gate was added after the previous set missed something real — the last two because five criteria named checks that emitted nothing and one named a module that had never existed.

**Prior art is step zero.** SWS has built a lot of sites and most problems are solved. The agent checks existing work before inventing anything, under a rule with three clauses, the third of which is that prior art cannot tell you *why* a choice was made or *where* the team is going. Both need a person. That clause exists because ignoring it produced three wrong conclusions in an afternoon, [written up as a record of error](standards/patterns/sws-conventions.md).

## Compliance, concretely

Generated sites are built to satisfy Stanford's actual requirements rather than a generic checklist:

- **WCAG 2.1 AA**, with an honest statement that automation catches roughly 30 percent of issues per ODA guidance
- **Global Footer and Identity Bar** exactly as the Identity Guide requires, from a contract extracted from the upstream component
- **MinWeb**: named business owner and technical administrator, MFA on admin logins, HTTPS, no keys in Git, subdomain approved by University Communications
- **MinSec**, which applies to low-risk static sites too
- **Siteimprove** registration, which is required. Google Analytics is not
- **No cookie banner**, because none is required at Stanford

For anything with legal, policy, or procurement weight, this project names the responsible university office and the specific door to use rather than recommending a product. It will not grant an exception, approve a subdomain, sign off a launch, or interpret policy on the university's behalf.

## Who this is for

**SWS staff** are the primary audience. This encodes how we already work, including the parts that live only in people's heads.

**Stanford units** building their own sites are the close second. If you are a department with no web developer, consider [Stanford Sites](https://uit.stanford.edu/service/stanfordsites) first: it is free and already compliant. This project is for when you need something Stanford Sites cannot do.

**Other universities** are welcome. The architecture is not Stanford-specific; only `standards/policy/` and `standards/fragments/` are. Swap those and the rest works. If you do that, we would like to hear about it.

## Stack

Astro or Next, Tailwind 4 via [Decanter 8](https://github.com/SU-SWS/decanter), npm (yarn fine, never converted), Playwright plus axe, GitHub Pages then Netlify. Optional Storyblok. No component workshop, because these sites have few components and one consumer.

Divergence is supported and expected. Every recipe lists its swap points with the cost of each, and deliberate departures get recorded rather than argued about.

## Contributing

Standards changes need a reason and a date. If you correct something, say what was wrong and how you know, because the record of a mistake is usually more reusable than the fix.

Two rules with teeth:

1. **Never edit an `acceptance.yml` criterion or a fragment to make a project pass.** Fragments change when upstream changes.
2. **Every criterion must map to an implemented check.** A criterion with no check is a wish. Delete it or implement it.

## License

GPL-3.0-or-later, matching [Decanter](https://github.com/SU-SWS/decanter).

---

Maintained by [Stanford Web Services](https://uit.stanford.edu/sws).
