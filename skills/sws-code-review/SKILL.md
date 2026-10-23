---
name: sws-code-review
description: Review a pull request on a Stanford site as a second reviewer, alongside Copilot and before a person. Use when a pull request is opened or updated, when asked to review a diff or a branch, or when preparing a change for someone else to review. Reads the diff cold against SWS standards, posts findings as one comment-only review, and never blocks a merge.
---

# Code review, by an agent that did not write the change

Copilot reviews every pull request (see `sws-github`), but it does not know SWS
policy, and one automated reviewer is a single point of failure. This is the
second review: aware of the standards, independent of the author, and done
before a person spends time on the change.

## Independence is the point

An author reviewing their own change confirms what they meant to write. So:

- **If your tool can start a separate agent** (a subagent, a second session, a
  background task), have it do the review. Give it the pull request number,
  this skill, and where the standards are. **Do not give it your summary of the
  change, your reasoning, or the list of things you already checked.** It reads
  the diff cold, and its report comes back as findings, not as agreement.
- **If it cannot**, review after the work is finished, from the diff alone, as
  if a stranger wrote it. Say in the review body that the author reviewed their
  own change, so a person can weigh it accordingly.

Never present a self-review as an independent one.

## What to read

```bash
gh pr view <pr> --json title,baseRefName,headRefOid,files
gh pr diff <pr>
```

Read a changed file in full wherever the diff is not enough to judge it. Read
`AGENTS.md`, then `.sws/manifest.yml`, whose recorded divergences are decisions
rather than findings, and `.sws/acknowledged.yml`, whose accepted risks are not
new findings. Leave the pull request description for last, if at all: it is the
author's account of the change, and the diff is the change.

## What to look for, in this order

1. **Correctness.** A concrete input or state that gives a wrong result, a
   crash, or lost data. Name the scenario. "Might be fragile" is not a finding.
2. **The one blocking thing.** A credential in the diff. Say to rotate it first,
   then clean history, as `minweb.no-secrets` does. Everything else is advice.
3. **Page furniture.** The Global Footer typed by hand rather than taken from
   `standards/fragments/global-footer.yml`; anything above the Identity Bar
   except a skip link; the named owners no longer discoverable on the site.
4. **Accessibility the tools miss.** The list in `role-frontend-developer`: a
   `div` that should be a `button`, a removed focus outline, a hover or focus
   state that is only a colour change, a heading level chosen for its size, an
   image with no alt text or dimensions. Automated checks catch about 30
   percent of issues, so this is where much of the rest gets caught.
5. **Drift from the standards.** A hardcoded hex instead of a Decanter token,
   Decanter 7, a pinned version, a `tailwind.config.js`, a content backend, a
   blocking git or agent hook, a committed file that points into `.claude/`, or
   a departure from the recipe with no entry in `.sws/manifest.yml`.
6. **Tests.** New logic with nothing that would fail if it broke, or a test
   switched off with `.only`, `.skip` or `.fixme`.

Check the standards and prior art before calling something wrong: a choice
repeated across lineages is a convention. **Cite the standard for every policy
finding.** If you cannot cite one, it is a preference; leave it out or label it
as one.

**Keep it short.** Five real findings beat twenty nits. Skip style the linter
owns, and anything the author chose and recorded.

## Post it as one review that blocks nothing

One review with `"event": "COMMENT"`, never `REQUEST_CHANGES`. Pull requests are
never required here, and a review that holds up a merge is a gate. **Every
comment, and the review body, starts with `<!-- sws-code-review -->`.** That
marker is how the author's agent tells these threads from a person's, because
both are posted under the same account.

Write the file with your editor's file tool, not a shell heredoc: comment
bodies contain backticks, and an unquoted heredoc runs them as commands.

```json
{
  "commit_id": "<head sha you reviewed>",
  "event": "COMMENT",
  "body": "<!-- sws-code-review -->\nAgent review: 2 findings. Advisory; nothing here blocks the merge.",
  "comments": [
    {
      "path": "src/layouts/Base.astro",
      "line": 41,
      "side": "RIGHT",
      "body": "<!-- sws-code-review -->\n**Focus outline removed.** ..."
    }
  ]
}
```

```bash
gh api repos/<owner>/<repo>/pulls/<pr>/reviews --method POST --input review.json
```

`line` is a line number in the new version of the file, and it must fall inside
the diff, or GitHub rejects the whole review. A finding outside the diff goes in
the review body instead. Each comment says what is wrong, the scenario that
shows it, the standard it rests on, and the fix.

**No findings is a fine result.** Post the review body saying so and listing
what you checked, so the author and the person after them know it ran.

## Then the author deals with it

The author's agent works through these threads exactly as it does Copilot's,
per `sws-github`: fix it and reply with the commit, or reply with why it does
not apply, then resolve the thread. The reviewing agent does not resolve its own
threads. After fixes are pushed, review **only what changed**, at most twice.

## What this review is not

It is not approval. A person still reviews whatever they choose to, and a clean
agent review is no reason to skip them. It is not a compliance sign-off either:
`sws check` and the ODA accessibility review are separate, and no agent can
grant an exception (`standards/policy/escalation.md`).
