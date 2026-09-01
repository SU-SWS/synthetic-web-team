# Harvested patterns

Tier 1 of the lookup order in `sws-prior-art`. **Currently empty.**

That is the expected state, not a gap. Entries here are *harvested, never
authored*: when a role skill solves something and the user confirms it worked,
`sws harvest` offers to append an entry pointing at what was just written. A
pattern ledger that someone sat down and wrote in advance is a design document,
and it rots like one. This file grows as a byproduct of use, which is the only
model that survives a busy team.

So if you are here looking for prior art, skip to tier 2 and keep going:

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
