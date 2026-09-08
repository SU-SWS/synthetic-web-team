# Why skills exist at two paths

Short answer: **no single path is read by every editor, and we deliberately have
no compiler.** Two copies is the floor, not a design flaw.

## Who reads what

| Path | Read by |
|---|---|
| `.claude/skills/<name>/SKILL.md` | Claude Code, VS Code Copilot (default in `chat.agentSkillsLocations`), Cline |
| `.agents/skills/<name>/SKILL.md` | Codex CLI, Cursor, Gemini CLI, Zed, Antigravity, Cline |

Between them these cover every editor this project targets. Neither covers all of
them alone, and the tools that read `.agents/skills` mostly do not offer a
configurable path, so redirecting them to one location is not available.

**That last sentence is why skills are copied rather than referenced in place.**
There is no configurable path to point at an installed package for most of these
tools, so a copy on disk at a path they already read is the only mechanism
available.

### The same two paths, at user level

Both conventions are also used in the home directory, which is what makes a
once-per-machine install possible:

| Path | Scope |
|---|---|
| `~/.claude/skills/<name>/SKILL.md` | every project on the machine |
| `~/.agents/skills/<name>/SKILL.md` | every project on the machine |

**Partially verified, 2026-09-08.** Both directories existed on the development
machine with 584 unrelated skills in each, so the home-level convention is real
and in active use rather than assumed. What is *not* yet established per tool is
which of them each editor reads at user level — Claude Code reads
`~/.claude/skills`, and the rest is inference from the presence of `~/.cursor`,
`~/.codex` and `~/.gemini`. Finish that table before claiming coverage anywhere
user-facing. See `two-part-install.md`, Step 0.

The 584 foreign skills are also the reason the installer never touches a path it
did not write: see the install record rules below.

The alternative would be a compiler that emits per-editor formats from one
source, with a build step, generated files, and a CI drift gate. That was
considered and rejected: see the distribution decision in `PROJECT-PLAN.md`.
Copying a directory is a much smaller cost than owning a translation layer.

## Three situations, three different rules

### In this repo

`skills/` is the **source of truth**. It is the only copy in version control.

`.agents/skills/` and `.claude/skills/` exist locally so that an agent working on
this repo has the skills loaded, which is how we notice when one of them is
wrong. They are **gitignored, generated, and never edited**.

```bash
npm run sync-skills     # refresh both from skills/
```

Three copies in one repo would be the drift problem this project exists to
avoid. One source, two disposable copies.

### On a person's machine

`npx @su-sws/synthetic-web-team user` writes both directories under the home
directory. This is where skills live for a consumer, and it happens **once per
machine** rather than once per project.

Those files are ordinary Markdown that a Stanford developer can read, diff, and
edit by hand. An edit is reported as a conflict on every subsequent run and never
overwritten.

`~/.sws/installed.json` records a hash of every file written. It is what makes
two things possible: telling an edit from an old version, and uninstalling with
`user --remove` without touching the other 584 skills someone may have in there.

### In a consumer project

**No skills at all.** They are identical in every repository, so copying them
into each one was noise that then had to be kept in sync. A project gets
`AGENTS.md`, the vendored `standards/`, and the per-site record in `.sws/`.

If you find `.agents/skills/` or `.claude/skills/` inside a project, it predates
the two-part install. Nothing breaks — the editors still read them, and they take
precedence over the user-level copies in tools that layer — but those copies are
frozen, and the user-level ones are what an update touches.

## The invariant, and where it is actually enforced

The two directories must stay **identical**. If they diverge, Cursor and Claude
Code follow different instructions, which produces inconsistent output with no
obvious cause. Editing one and forgetting the other is the expected mistake.

Since the two-part install this is a **home directory** invariant, not a project
one — a project has no skill copies to diverge.

**Correction, 2026-09-08.** This section previously said "`sws doctor` compares
them and reports divergence as a finding." **It never did.** The CLI's only
reference to skills is `wizardInstalled()`, which tests whether either directory
exists. There was no comparison and no finding id.

The check was not written after the split either, for two reasons. It has no
project-level subject any more, so building it against project copies would ship
something obsolete on arrival. And `sws doctor` reports on the **site** — what is
in someone's home directory is a fact about their machine, which is the same
reason the standards-staleness nag is a note rather than a finding.

What covers the invariant today:

- `validate-emit.mjs` proves the **emitter** puts identical content at both paths,
  which is where divergence would originate.
- `~/.sws/installed.json` catches a hand-edited skill as a conflict on the next
  `user` run, and reports it on every run until it matches again.

If a standing check is still wanted it belongs in `sws preflight`, which is
already scoped to the machine rather than the site. Deferred until the per-tool
table above is finished, because if nothing reads `~/.agents/skills` then there
is only one copy and nothing to compare.

## Three checks, three different subjects

Easy to conflate, so worth naming. They do not overlap:

| Check | Runs | Subject |
|---|---|---|
| `sync-skills.mjs --check` | locally, via `npm run check` | the two **local** copies in this repo agree with `skills/`. Both are gitignored, so an absent copy is reported and skipped, not failed |
| `validate-emit.mjs` | CI, and `npm run validate` | the **wizard** puts every skill in `skills/` into both user-scope paths, byte-identical, with the paths agreeing — and that the two scopes stay disjoint, so no skill leaks back into a project |
| the install record | on every `user` run | a skill someone edited by hand is reported rather than overwritten |

CI runs `validate-emit.mjs` rather than the stale check, because the stale check
has no subject in a fresh checkout: the copies it compares are gitignored and
therefore never present. An emitter gap, by contrast, ships to every consumer
project and cannot be regenerated away there.

## If you only use one editor

Delete the other directory. Nothing depends on both existing, and one editor's
config is simpler and still correct. The installer writes both because it cannot
know what else you will open later — and at user level that is a safe bet to get
wrong in the generous direction, since the cost is 30 unread Markdown files.

A deleted directory comes back on the next `user` run, which will report it as
`created`. If that is not what you want, `user --remove` is the supported way
out.
