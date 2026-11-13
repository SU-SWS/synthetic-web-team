# Harvested patterns

Tier 1 of the lookup order in `sws-prior-art`. The entries are at the end, under
[Entries](#entries).

It stays short on purpose. Entries here are *harvested, never authored*: when a role skill solves something and the user confirms it worked,
`sws harvest` offers to append an entry pointing at what was just written. A
pattern ledger that someone sat down and wrote in advance is a design document,
and it rots like one. This file grows as a byproduct of use, which is the only
model that survives a busy team.

So if nothing under Entries fits, go to tier 2 and keep going:

```
2. .sws/prior-art.local.yml     the user's own disk, free, private
3. standards/prior-art/repos.yml    11 inspected source repos
4. standards/prior-art/catalog.yml  17 live exemplars + tools
5. live GitHub org search       uncurated fallback
6. nothing found                say so plainly
```

`sws harvest` is not built yet. Until it is, add entries by hand using the
shape below, and keep them short: a pattern nobody reads is worse than a
pattern nobody wrote.

## Entry shape

Every entry carries the same three things the catalog requires, for the same
reason: without them a reader cannot tell whether the pattern is current.

```markdown
### <what problem this solves>

- **era**: decanter-8 | decanter-7 | decanter-6 | pre-decanter
- **from**: the repo, site, or `.sws` project it was harvested out of
- **confirmed**: YYYY-MM-DD, and by whom
- **use_for**: the shape of problem it answers
- **do_not_use_for**: what it will mislead you about

<Three to ten lines. What the decision was, and what it cost.>
```

## The precedence rule applies here with full force

These entries record **how we solved a shape of problem**. Standards say **what
to build it with**, and when the two disagree standards win. A harvested entry
is a snapshot of a decision already executed, so it cannot tell you why the
decision was made or where the team is heading. Both need a person. See
[`../README.md`](../README.md) for all three clauses.

An entry going stale is normal and is not a defect to fix on sight. Mark it
`cautionary` and say what moved, so the next reader learns the delta instead of
rediscovering it.

## Entries

### Letting a coding agent change a CMS space without losing editors' work

- **era**: decanter-8
- **from**: [adapt-saa-homesite](https://github.com/SU-SWS/adapt-saa-homesite), ref `dev` once
  SU-SWS/adapt-saa-homesite#54 merges: `.pipeline/skills/implement/storyblok-changes.md`
- **confirmed**: 2026-11-10, by Shea McKinney (SAA). Confirmed so far: the backup pulls and their
  diff, run against the live Storyblok space. The writes themselves haven't run on a ticket yet.
- **use_for**: an agent that adds bloks, fields, datasource entries or test content in the space
  editors use, with a way back
- **do_not_use_for**: a CMS recipe (`scope.md` keeps CMSs out of this package), or editorial
  content, which stays with editors

- Each write is one of three kinds:
  - **Add:** a new blok, an entry, or a test story.
  - **Change:** a field on an existing blok.
  - **Destructive:** deleting, renaming or retyping a field, publishing, or editing an editor's story.

  Approving the plan approves adds and changes. Each destructive write asks a person again, and only the main session makes it, never a subagent.
- Before touching anything that exists, the CMS's own CLI takes the backup
  (`storyblok components|datasources|stories pull --path <folder>`). Storyblok keeps no history of
  components or datasources, so the backup is the only way back for them. A restore pushes the
  folder back once a person says yes.
- The Management API's component and story updates replace the whole schema or content. Get it
  first, merge, and send all of it. Diffing a fresh pull against the backup shows exactly what a
  write changed, since two pulls in a row are identical.
- Test content stays a draft in one folder per ticket. Environments other than production read
  drafts, so tests and deploy previews see it and visitors never do.
- Cost: a schema change is live for every editor before the pull request merges, so the pull
  request lists every write. Restoring a story backed up with unpublished changes publishes them,
  unless its file is set to `"published": false` first.

### One CMS credential for an agent's MCP server and CLI, checked before work starts

- **era**: decanter-8
- **from**: [adapt-saa-homesite](https://github.com/SU-SWS/adapt-saa-homesite), ref `dev` once
  SU-SWS/adapt-saa-homesite#54 merges: `.pipeline/scripts/storyblok.mjs`,
  `.pipeline/scripts/storyblok-mcp-headers.mjs`
- **confirmed**: 2026-11-10, by Shea McKinney (SAA), against the live space with an expired token
  and then a valid one
- **use_for**: an agent that needs the Storyblok CLI and MCP in the same session
- **do_not_use_for**: CI credentials, which come from the host's secrets, not a developer's `.env`

- `storyblok login` is interactive, so an agent can't complete it. The CLI also signs in from
  `STORYBLOK_LOGIN`, `STORYBLOK_TOKEN` and `STORYBLOK_REGION`, so a small wrapper sets them from the
  same personal access token the MCP server uses.
- Claude Code removes credential-like variables from an MCP `headersHelper`'s environment, so the
  helper reads the token from `.env` on disk.
- `storyblok user` is the check: it exits 1 when the token is refused. The pipeline runs it
  before planning and asks the person, rather than failing partway through.
- Cost: a `STORYBLOK_TOKEN` in the shell outranks `.env`, and a changed shell variable reaches a
  session only after a restart.
