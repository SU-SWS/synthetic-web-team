# Two-part install: user scope and project scope

**Status:** built 2026-09-08. Two deviations from this plan and two bugs found
on the way, all recorded under [As built](#as-built). Not yet published.

Today one command writes **104 files into a project**, and 58 of them are skill
files that are byte-identical in every repo a person will ever work in. This
splits the install in two: the knowledge goes into the tool you use, once, and
only the per-site record goes into the repository.

*Counts in this document were measured before implementation, at 29 skills. The
`sws-install` skill was added during it, so the as-built numbers are 30 skills,
60 user-scope files and 46 project files.*

## The constraint that shapes everything

Skills reference standards by **repo-relative path** — 36 distinct paths across
30 skills, like `standards/policy/escalation.md`. So skills and standards cannot
simply be separated: a skill installed at user level that names
`standards/policy/escalation.md` needs that file to exist relative to the project
it is working in.

This is why the split below is not "knowledge up, record down". Standards are
knowledge and they stay project-level anyway, because moving them would break
every path reference in every skill. Making skills location-independent is a real
option, and it is deliberately out of scope here — see [Not doing](#not-doing).

## The scope split

| Artifact | Files | Scope | Why |
|---|---|---|---|
| 30 skills → `.claude/skills/`, `.agents/skills/` | 60 | **user** | Person-level knowledge, identical in every repo. The single biggest block of per-project noise |
| MCP server registration | ~4 | **user** | The server already resolves standards from the installed package and works with no project present |
| `standards/` | 36 | project | Skills reference these by relative path; CI reads them; a reviewer needs them in the diff |
| `AGENTS.md` | 1 | project | Repo-rooted convention by design. The contract a reviewer and a CI run must be able to see |
| `.sws/manifest.yml`, `.sws/acknowledged.yml` | 2 | project | Per-site record: named owners, derived tier, divergences, accepted risks with review dates |
| `.sws/installed.json` | 1 | project | Conflict detection for project files |
| Editor pointers (`CLAUDE.md`, `.cursor/rules/sws.mdc`, `.codex/config.toml`, `GEMINI.md`, `.devin/rules/sws.md`) | ~6 | project | They point at `AGENTS.md`, which is project-rooted |
| CI workflow | 1 | project | Runs `sws check` on push, where there is no home directory to read |

**Net effect: a project install drops from ~104 files to ~46.** The 60 skill
files stop being committed to every Stanford repo.

## Step 0: verify the user-level paths before writing any code

`docs/skill-paths.md` documents which tools read `.claude/skills/` and which read
`.agents/skills/` — but **every path in it is project-relative.** The user-level
equivalents are established for Claude Code, plausible for tools that have a home
directory (`~/.cursor`, `~/.codex`, `~/.gemini`), and **unverified for the
`.agents/skills` convention at home level**, which may simply not be read there.

Part 1's entire value proposition is coverage, so this gets verified rather than
assumed. For each of the eight supported tools, answer:

1. Does it read skills from a user-level directory, and exactly which path?
2. Does it have a user-level MCP config, at what path, in what shape?

**Deliverable:** a user-level column added to the table in `docs/skill-paths.md`,
with the same "verified, not assumed" standard the rest of this repo holds to.

**Two answers change the design if they come back negative:**

- If nothing reads `~/.agents/skills/`, then Cursor, Codex, Gemini CLI, Zed and
  Antigravity cannot be served at user level, and Part 1 is a Claude Code and
  Copilot feature. Still worth building, but the prompt on the website must say
  so rather than implying universal coverage.
- VS Code Copilot reads `.claude/skills/` as a **default in the configurable
  `chat.agentSkillsLocations` setting**. If that setting can name a user-level
  path in user `settings.json`, Copilot is reachable at user scope. If not, it is
  project-only. This is the one tool with no home directory in `detect.mjs`, so
  it is the one most likely to constrain the story.

## A note on two words

The **command** is `install`; the **scope** it writes to is called `user`, and
that is what the JSON `scope` field and `~/.sws/installed.json` report. They are
not in conflict: `install` says what the person is doing, `user` says where the
files land as against `project`. The scope vocabulary is kept because it is the
pair that makes `sws doctor`'s drift note legible.

## Part 1: user scope

```bash
npx @su-sws/synthetic-web-team install
```

Writes, into the home directory:

- `~/.claude/skills/<name>/SKILL.md` × 30
- `~/.agents/skills/<name>/SKILL.md` × 30 — pending Step 0
- MCP server registration in each detected user-level config
- `~/.sws/installed.json` — the user-scope conflict record, mirroring the
  project one

Writes **nothing** per-site: no standards, no `AGENTS.md`, no manifest. There is
no site yet.

Three rules carry over from the project installer, and one is new:

- **Idempotent.** A second run reports `unchanged`, not 30 duplicates.
- **Conflicts reported, not overwritten.** Same hash comparison, against
  `~/.sws/installed.json`.
- **Foreign skills are untouchable.** A home skills directory holds other
  people's work. Only paths this tool wrote are ever considered.
- **New: user-level configs are merged, never rewritten.** An MCP config in a
  home directory has other servers in it. The project installer can write
  `.mcp.json` wholesale because it created the file; at user level that is
  somebody's editor setup. Merge one key, leave the rest, and never reformat
  what we did not add.

### Uninstall

```bash
npx @su-sws/synthetic-web-team install --remove
```

Deletes **only** what `~/.sws/installed.json` records, which is why that record
exists. A skill the person wrote, a skill from somewhere else, and any MCP server
we did not add all survive. A file we wrote but they then edited is reported and
kept, not deleted — the same conflict rule as everywhere else, because their edit
is their work.

Reports what it removed, what it kept and why, and leaves `~/.sws/installed.json`
itself behind if anything was kept, so a second run still knows what is ours.

## Part 2: project scope

Two entry points, one implementation:

```bash
npx @su-sws/synthetic-web-team init     # a new site
npx @su-sws/synthetic-web-team add .   # an existing project
```

and a new skill, `sws-install`, so that the agent delivered by Part 1 can do the
project install itself. That is the self-bootstrapping property worth having:
Part 1 installs the thing that knows how to run Part 2, so the second step is a
sentence to an agent rather than a command a person has to find.

Behaviour is today's installer minus the skills — same interview, same tier
derivation, same `next[]`, same preserve/conflict/orphan verdicts.

## Where skills live, and what compares them

**Copied to the person's filesystem, not referenced in place.** The 30 skills are
written to `~/.claude/skills/` (and `~/.agents/skills/`, pending Step 0), not
left inside the installed package with editors pointed at it.

That is not a preference, it is a constraint this repo already researched.
`docs/skill-paths.md`: *"the tools that read `.agents/skills` mostly do not offer
a configurable path, so redirecting them to one location is not available."* Only
VS Code Copilot exposes a setting (`chat.agentSkillsLocations`). You cannot point
Claude Code, Cursor, Codex, Zed or Gemini CLI at an arbitrary directory, so there
is nothing to reference *with*. An `npx` cache path would be the wrong target
anyway — npm can clear it.

So the skills stop living in this repository from a consumer's point of view.
`skills/` here stays the source of truth; the user-level copies are what tools
read; and nothing in a consumer project holds a copy at all.

### `sws doctor` should compare nothing

Two independent reasons, either sufficient:

1. **No subject.** The divergence check `docs/skill-paths.md` describes compares
   the two *project* copies. After the split a project has none, so there is
   nothing to compare.
2. **Wrong scope.** `sws doctor` reports on the **site**. What is in a person's
   home directory is a fact about their machine, not about the site being
   audited. This repo already draws exactly that line: the staleness nag is a
   *note* rather than a finding, "because being behind is a maintenance fact
   about the toolchain, not a compliance fact about the site". A finding about
   `~/.claude` in a site compliance report is the same category error.

**The divergence risk is real but it is already covered.**
`~/.sws/installed.json` holds a hash of every skill we wrote, so if someone edits
one, the next `install` run reports it as a conflict instead of overwriting it. That
is the same information, delivered at the moment it can be acted on.

**If a standing check is still wanted, it belongs in `sws preflight`**, which is
already defined as "is the machine equipped to build and deploy this project?" —
machine scope, not site scope. It would compare the two home copies and report
divergence without scoring anything.

**And it may be moot.** The invariant exists only because there are two copies.
If Step 0 finds that nothing reads `~/.agents/skills/`, user scope has one copy
and there is nothing to compare. **Decide this after Step 0, not before.**

## Code changes

| File | Change |
|---|---|
| [emit.mjs](../packages/wizard/src/emit.mjs) | `plan()` takes a `scope` of `user` or `project` and returns only that scope's files. The shared `add()` helper and pointer generation stay as they are |
| [emit.mjs](../packages/wizard/src/emit.mjs) | `write()` takes the record path as an argument instead of assuming `.sws/installed.json` under the target root |
| [emit.mjs](../packages/wizard/src/emit.mjs) | New `mergeConfig()` for user-level JSON and TOML configs: add our key, preserve everything else, preserve indentation. Same shape as the `ensureDevDependency()` merge already there |
| [wizard.mjs](../packages/wizard/bin/wizard.mjs) | `user` positional mode alongside `add`. Help text, and a `scope` field in the JSON output |
| `skills/sws-install/SKILL.md` | New skill. Two frontmatter keys, same as its siblings |
| [validate-emit.mjs](../scripts/validate-emit.mjs) | Assert the two scopes are **disjoint** and that together they still cover every skill and every standards file. This is the gate that stops a file going to both places or neither |
| [docs/skill-paths.md](skill-paths.md) | User-level column from Step 0, and the consumer-project section rewritten — skills are no longer committed per project |
| [site/src/pages/index.astro](../site/src/pages/index.astro) | The install prompt becomes two: set up your tool once, then set up a project |

## The version-drift contract

Drift is accepted and recorded rather than prevented. Most of this already
exists.

- **`.sws/manifest.yml` has a `standards_version` field**, documented in
  `sws-onboard` as "which version of the SWS standards generated this". That is
  the record of what a site was measured against, and it needs no change.
- **`sws doctor` already nags.** [sws.mjs:405-431](../packages/cli/bin/sws.mjs#L405-L431)
  compares `.sws/installed.json`'s version against the CLI's own and prints a
  note — deliberately *not* a finding, because being behind is a maintenance fact
  about the toolchain, not a compliance fact about the site. After the split its
  meaning improves on its own: it becomes "your user-level install is newer than
  what this project recorded", which is precisely the drift signal wanted. **No
  new code.**
- **Registry-based nag-ware is deferred**, by request. When it lands it needs a
  network call, so it needs a cache, an opt-out, and it must stay a note rather
  than a finding — otherwise a site loses points because someone did not run an
  update, which is the "stick" this project explicitly avoids.

## Decisions taken

1. **Standards stay project-level.** Moving them breaks 36 path references in 30
   skills. Keeping them also preserves reviewability and lets CI run with no
   user-level install present.
2. **User-level configs are merged, never overwritten.** Writing to a home
   directory is a higher bar than writing to a project.
3. **`AGENTS.md` stays project-level.** Confirmed by the owner, 2026-09-08. It is
   a repo-rooted convention, it is what a PR reviewer reads, and CI has no home
   directory. The shape is: install the package into your tool once, then `init`
   the projects you want it in.
4. **Nothing is written to `~/.claude/CLAUDE.md`.** It is a person's global
   instruction file for all their work, not just Stanford's. The skills are
   discoverable without it.
5. **Skills are copied to the person's filesystem, not referenced in place.**
   Forced by the research already in `docs/skill-paths.md`: most tools that read
   `.agents/skills` offer no configurable path, so there is nothing to point at a
   package directory with. See [Where skills live](#where-skills-live-and-what-compares-them).
6. **`install --remove` ships with Part 1.** Confirmed by the owner, 2026-09-08.
   Writing 60 files into a home directory without a documented way out is bad
   manners, and having one makes Part 1 safe to try.
7. **Every job is named and there is no default.** Confirmed by the owner,
   2026-09-08. `install` writes 60 files to a home directory; `init` and `add`
   write 46 into the current one. Guessing between those is not a default, and
   guessing from the directory cannot work either, because an empty directory is
   exactly the `init` case. Running with no command prints help, writes nothing,
   and exits 0; an unrecognised first argument exits 2. This is also what
   permanently closes the "directory read as a mode" bug below, rather than
   merely making it less likely.
8. **`sws doctor` gains no skills comparison.** It has no project-level subject
   after the split, and home-directory state is not a property of the site being
   audited.

## Open questions

Both wait on Step 0 rather than on a decision.

1. **`~/.agents/skills/` — is it read by anything?** Determines whether Part 1
   serves six tools or two, and therefore what the website prompt may claim.
2. **Does Copilot's `chat.agentSkillsLocations` accept a user-level path?** If
   yes, the one tool with no home directory in `detect.mjs` is reachable at user
   scope after all.
3. **Does `sws preflight` get a skills-divergence check?** Only meaningful if the
   answer to (1) is yes, because the invariant exists solely because there are two
   copies. Decide after Step 0, not before.

## Not doing

- **Making skills location-independent** so standards could move to user level
  too. It means replacing 36 relative paths with logical ids resolved through
  `sws_get_standard` or the CLI, which creates a soft dependency on MCP — and
  this project is explicit that MCP is "a second entry point, never a
  requirement". Revisit if a 46-file project install still feels heavy.
- **Registry-based staleness checks.** Deferred by request, sketched above.
- **A per-editor skills compiler.** Already considered and rejected in
  `PROJECT-PLAN.md`; two copied directories beat owning a translation layer.

## Found while planning: a doc/reality gap

`docs/skill-paths.md` states: "So `sws doctor` compares them and reports
divergence as a finding." **That check does not exist.** The CLI's only reference
to skills is `wizardInstalled()` at
[sws.mjs:125](../packages/cli/bin/sws.mjs#L125), which just tests whether either
directory is present. There is no comparison and no finding id.

**Resolution: correct the doc, do not implement the check in `doctor`.** The
split removes its subject — a project will have no skill copies to compare — so
building it now would mean shipping a check that is obsolete on arrival. If the
invariant still needs guarding after Step 0, it guards the two *home* copies and
it lives in `sws preflight`, which is machine scope.

The `docs/skill-paths.md` rewrite is already on the change list above; this is one
more paragraph in it.

## As built

### Deviation 1: user-scope MCP registration is reported, not written

The plan said Part 1 would register the MCP server in each detected user-level
config. It does not. It emits the registration as a `next[]` step instead — the
exact `claude mcp add --scope user sws -- npx -y @su-sws/mcp` for Claude Code,
and the server command plus a pointer to the person's own config for anything
else.

**Why.** Step 0 has not run, so the user-level MCP config path is unverified for
every tool except Claude Code. Writing into somebody's editor state file at a
guessed path is the most invasive thing in this whole plan, and this repo's rule
for exactly this situation is *never invent a door*. The MCP server is also
optional by the project's own contract, so nothing is lost by asking.

Revisit once Step 0 fills in the table. `mergeConfig()` was therefore **not**
written either — there was no verified path to merge into, and unused merge
machinery would have been worse than none.

### Deviation 2: `sws preflight` gained no check

Left as open question 3, unchanged. It only becomes meaningful if
`~/.agents/skills` turns out to be read by something.

### Bug found: an edited file was overwritten on the third run

Pre-existing, in `write()`, and it defeated both the install contract and the new
uninstall. The conflict branch recorded *the hash of the edited file on disk* as
though we had written it, with the stated aim of not reporting the same conflict
forever. The effect was that the next run compared the edit against itself, found
no difference, and reported `updated` — overwriting it.

Verified before the fix: an edited 7356-byte skill came back as the canonical
7355 bytes on run three, silently, with `conflicts: 0`. That contradicted
`write()`'s own docstring, which promises that a file the user edited is never
silently overwritten.

Now the record keeps the hash of what we last wrote, so a conflict is **sticky**
until the file matches what we ship again. Verified after: the edit survives runs
two, three and four with `conflicts: 1` each time. This is also what makes
`install --remove` safe, since the record stays a description of our content rather
than drifting onto theirs.

### Bug found: a directory argument was read as a mode

Also pre-existing. Positionals are `[mode, dir]`, so
`wizard.mjs /path/to/project` made the path the mode, fell through to `new`, left
the directory undefined, and installed into the **current** directory — 46 files
into the wrong repository, exit code 0.

This had already been found once from the MCP side, where
`packages/mcp/src/scaffold.mjs` works around it by always passing a mode
explicitly; the wizard itself kept the trap. Found again here the hard way, by
writing 46 files into this repository during testing. An unrecognised first
positional is now read as the directory.

### Step 0 is partly answered

Both `~/.claude/skills/` and `~/.agents/skills/` exist on the development machine
with **584 unrelated skills in each**, so the home-level convention is real and
in active use rather than assumed. What remains unverified is which path each
individual tool reads at user level. Recorded in `skill-paths.md`.

Those 584 foreign skills are also why the "only touch what the record lists" rule
is load-bearing rather than theoretical.

## Acceptance criteria

**Part 1**

- On a machine with no Stanford project: after Part 1, an agent has all 30 skills
  and `sws_get_standard` answers with no project present.
- Run twice: the second run reports everything `unchanged`. No duplicates.
- Run against a home skills directory that already holds unrelated skills: those
  are untouched and unreported.
- Run against an existing user MCP config with other servers: every one survives,
  and the file is not reformatted beyond the added key.
- `install --remove` deletes only what the record lists.

**Part 2**

- In a fresh project after Part 1: ~46 files written, **zero** skill files.
- `.sws/manifest.yml` records `standards_version`.
- `sws check` passes in CI with **no user-level install present** — the project
  must be self-sufficient for its own compliance run.
- `sws doctor` prints the drift note when the user-level version and the recorded
  version differ, and stays silent when they match.

**Both**

- `validate-emit.mjs` fails if the two scopes overlap, or if any skill or
  standards file belongs to neither.
