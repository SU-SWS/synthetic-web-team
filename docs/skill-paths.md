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

The alternative would be a compiler that emits per-editor formats from one
source, with a build step, generated files, and a CI drift gate. That was
considered and rejected: see the distribution decision in `PROJECT-PLAN.md`.
Copying a directory is a much smaller cost than owning a translation layer.

## Two different situations, two different rules

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

### In a consumer project

There is **no `skills/` directory**. The wizard emits `.agents/skills/` and
`.claude/skills/` directly, and **both are committed**, because they are what the
editors read and there is no source to regenerate them from.

This is deliberate. After install, those files are ordinary Markdown that a
Stanford developer can read, diff, and edit by hand. There is no ongoing
regeneration relationship and nothing to keep in sync with an upstream build.

## The invariant, and the one check it needs

In a consumer project the two directories must stay **identical**. If they
diverge, that project's Cursor and Claude Code are following different
instructions, which is a confusing failure that produces inconsistent output with
no obvious cause.

So `sws doctor` compares them and reports divergence as a finding. It does **not**
auto-resolve, because it cannot know which side was edited on purpose. It says
which files differ and asks.

Editing one and forgetting the other is the expected mistake. That is the whole
reason the check exists.

## Three checks, three different subjects

Easy to conflate, so worth naming. They do not overlap:

| Check | Runs | Subject |
|---|---|---|
| `sync-skills.mjs --check` | locally, via `npm run check` | the two **local** copies in this repo agree with `skills/`. Both are gitignored, so an absent copy is reported and skipped, not failed |
| `validate-emit.mjs` | CI, and `npm run validate` | the **wizard** puts every skill in `skills/` into both consumer paths, byte-identical, with the paths agreeing |
| `sws doctor` | in a consumer project | the two **committed** directories there have not diverged |

CI runs `validate-emit.mjs` rather than the stale check, because the stale check
has no subject in a fresh checkout: the copies it compares are gitignored and
therefore never present. An emitter gap, by contrast, ships to every consumer
project and cannot be regenerated away there.

## If you only use one editor

Delete the other directory. Nothing depends on both existing, and a project with
one editor's config is simpler and still correct. The wizard emits both because it
cannot know who else will open the repo later, which for a Stanford site is
usually somebody.
