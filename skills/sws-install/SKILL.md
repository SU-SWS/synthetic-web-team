---
name: sws-install
description: Install the Stanford Web Services standards into a specific project, once the skills are already installed in this tool. Use when someone wants to start a Stanford site in a repository, add the standards to an existing project, or asks why AGENTS.md and .sws are missing even though the sws-* skills are available.
---

# Install into a project

The install has two halves, and you are reading this because the first one is
done. The skills came from a **user-level install** into the person's tool, so
they are available in every project on this machine. Nothing per-site is
installed yet.

This skill does the second half: the per-project record.

```bash
npx @su-sws/synthetic-web-team init     # a new site, in an empty directory
npx @su-sws/synthetic-web-team add .    # a project that already exists
```

Run it in the repository root. **Pick deliberately:** `init` hands back a recipe
to follow afterwards, `add` assumes there is already a site and leaves the source
alone. There is no default — running with no command prints help and writes
nothing, so a wrong guess cannot put 46 files in the wrong directory.

Every flag is optional. With a terminal attached each one interviews the person;
without one it runs to completion and reports.

## Why two halves

Skills are identical in every repository, so copying them into each one is noise
that then has to be kept in sync. The per-site record is the opposite: named
business owner, named technical administrator, the compliance tier derived from
what *this* site handles, hosting provider, recorded divergences, accepted risks
with review dates. None of that is a property of a person or a machine.

So: knowledge installs once per tool, the record installs once per site.

## What the project install writes

| Path | What |
|---|---|
| `AGENTS.md` | The behavioral contract, between `sws-agent-contract` markers. An existing `AGENTS.md` keeps its content and gets the block added; a re-run replaces only the block. Repo-rooted on purpose, so a reviewer and CI can both see it |
| `.sws/standards/` | Vendored, because CI has no home directory to read. Skills cite them as `standards/<path>`, which means `.sws/standards/<path>` in a project |
| `.sws/manifest.yml` | What this project is and what was decided. **Never overwritten** on a re-run |
| `.sws/acknowledged.yml` | Accepted risks, with reasons and review dates. Never overwritten |
| `.sws/installed.json` | Hashes of what was written, so an update can tell a local edit from an old version. Commit it |
| Editor pointers | `CLAUDE.md` and `GEMINI.md` are exactly `@AGENTS.md`, as Next.js writes them; an existing one keeps its content and gets the line. `.github/copilot-instructions.md` and `.codex/config.toml` get a marked pointer added. `.cursor/rules/sws.mdc` and `.devin/rules/sws.md` are ours by name. All point at `AGENTS.md` and `.sws/`, never content copies |
| MCP configs | `.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json`, `.agents/mcp_config.json` get the `sws` server added next to the project's own. One the project removed is not put back. A file with comments is reported, not rewritten |

Nothing else goes at the root, and nothing goes in `.claude/`: many teams
git-ignore it, so a committed file pointing there breaks for everyone else.

**No skills.** If you find `.agents/skills/` or `.claude/skills/` inside a
project, it predates the two-part install. That is not a fault and nothing
breaks, but the copies there are frozen and the user-level ones are what update.

**A `standards/` folder at the root** is from an earlier version. The next
`add .` moves every file the install record lists into `.sws/standards/`, with
any local edit intact and still reported as a conflict, and says so in `moved`.
A file the record does not list is the team's, and stays. **If the project's
code or CI reads them at `standards/`**, as a generated footer does, the move
waits: `deferred` and an `update-references` step in `next[]` list each file
and line. Point those at `.sws/standards/` and re-run.

**A conflict on `AGENTS.md` with reason `legacy-contract`** means an older,
unmarked copy of the contract sits next to the project's own rules, so the
wizard cannot tell where it ends. Ask before touching it. Then delete that copy,
keeping their rules, and re-run; or `--force`, which replaces from its heading
to the next top-level heading.

## What to do with the result

Read the JSON, not the prose. Four fields matter:

- **`next[]`** — what to do next, as data. Each step names a path or command and
  a reason. Work through it in order.
- **`incomplete[]`** — manifest fields still holding placeholders. **Ask the
  person.** MinWeb requires a named business owner and technical administrator
  with real Stanford email addresses, so never invent one.
- **`counts`** — tells a fresh install from a no-op re-run. `merged` counts
  files that already had the project's own content, which is kept.
- **`dependency`** — whether `@su-sws/synthetic-web-team` reached the project's
  `devDependencies`. It has to, because unscoped `sws` on the public registry is
  an unrelated package and `npx sws` would otherwise run that instead of this
  CLI. Run `npm install` before verifying.

Then verify:

```bash
npx sws doctor --format json
```

## Re-running is the update

There is no separate update command. Content is rewritten from source, `.sws`
state is preserved, and a file the person edited is reported as a conflict and
left alone — on every run, not just the first. Pass `--force` only if they have
said they want their edits discarded.

If `sws doctor` says the project's standards version is behind the version this
tool carries, that is drift between the user-level install and what this project
recorded. It is a note, not a compliance finding: being behind is a maintenance
fact about the toolchain, not a fact about whether the site meets Stanford's
requirements.

## If the skills are missing on a new machine

The user-level half:

```bash
npx @su-sws/synthetic-web-team install
```

Writes the skills into `~/.claude/skills/` and `~/.agents/skills/` and nothing
else. Removable with `install --remove`, which deletes only what its own install
record lists, so unrelated skills in those directories are never touched.
