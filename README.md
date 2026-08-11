# Synthetic Web Team

**A portable agent team that reproduces Stanford Web Services practice inside whichever AI coding tool you already use.**

Open Claude Code, Cursor, VS Code, Codex, or Antigravity in a Stanford project and get the working knowledge of a full SWS web team: strategy, information architecture, content design, UX, front end, accessibility, discoverability, and delivery. The output is a Stanford site that is compliant by default and that you can actually maintain.

Everything here is Markdown, YAML, and a small CLI. **No application code, no starter templates, no design system fork.**

## Status

Early. The plan is complete and reviewed; the implementation is partway through.

| | |
|---|---|
| Project plan | Done. [`PROJECT-PLAN.md`](PROJECT-PLAN.md) |
| Standards (policy, patterns, prior art) | In progress, substantial |
| `astro-static` recipe | Written, and **executed end to end** against a real build |
| `next-netlify` recipe | Written, extends `astro-static`. Not yet executed end to end |
| Shared skills | 6 of 6 done |
| Role skills | **8 of 8 built, 11 of 11 stubs.** 25 skills total, all validated |
| Documentation site | **Working.** [`site/`](site/), built by our own recipe, scores 90/100 with zero failures |
| `sws` CLI | **Working.** `doctor` and `check` run 12 check modules against 63 criteria |
| Install wizard | **Working.** Editor detection, tier derivation, 68-file install |
| Recipe canary | Not started. Next piece, and it gates "install latest" being safe |
| MCP server | Not started |

End to end, verified: `create-web-team` installs, an agent follows the recipe, `sws check` reports **92/100 with zero automated failures**. The remaining 8 points are 7 findings that are honestly unautomatable (manual WCAG checklist, ODA review, subdomain approval, MFA attestation) plus axe, which needs a real browser and therefore reports `unknown` rather than pretending to pass.

**You can use it today by copying files by hand.** The wizard is what makes that pleasant, not what makes it work.

## Try it now

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
| [`standards/policy/`](standards/policy/) | Stanford requirements: MinSec, MinWeb, accessibility, privacy, brand, and which office to escalate to |
| [`standards/patterns/`](standards/patterns/) | How SWS actually builds, derived from reading 11 production repos |
| [`standards/recipes/`](standards/recipes/) | Build contracts with machine-checkable acceptance criteria |
| [`standards/fragments/`](standards/fragments/) | Byte-exact compliance content, like the Global Footer link set |
| [`standards/prior-art/`](standards/prior-art/) | Existing SWS work, with era, lineage, and judgment attached |
| [`packages/cli/`](packages/cli/) | The `sws` CLI. 10 check modules, terminal / JSON / markdown output |

## Five decisions that surprise people

**Recipes, not starter templates.** We do not ship or maintain application code. A recipe says what must be true and delegates boilerplate to the upstream scaffolder (`npm create astro@latest`), so you get current versions and we have nothing to keep updated. A template starts rotting the day it is committed and every consumer inherits the rot.

**Install latest. Pin nothing.** Recipes name no version numbers, with exactly one exception: Decanter 8 rather than 7, because they are architecturally different and getting it wrong fails silently. Standards are expressed as things to avoid, which age far better than versions to require.

**Advisory, not blocking.** Findings are reports, PR comments, and a visible score that trends. Exactly one thing fails a build: committed credentials, because that harm is irreversible. A tool that fails your build over a contrast ratio gets uninstalled by Friday, and then nothing is compliant.

**Push to `main` deploys.** Pull requests are first-class but never required, and nothing in the setup makes one mandatory. Many campus editors work through the GitHub web UI and will not open a pull request to fix a typo. With a CMS, git disappears entirely.

**Recipes extend each other.** `next-netlify` declares `extends: astro-static` and contains only its differences: three criteria that do not apply, two whose mechanism changes, and ten that are new. The 52 shared criteria live in one place, so they cannot drift between recipes. Two CI gates enforce the contract in both directions: every criterion maps to an implemented check or is marked manual, and every finding a check can emit has a criterion somewhere. The second gate exists because the first one missed a check that ran for days scoring nothing.

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
