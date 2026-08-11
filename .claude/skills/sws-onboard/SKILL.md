---
name: sws-onboard
description: Orient yourself on a Stanford Web Services project before doing anything else. Use at the start of a session on an SWS project, when you find a .sws directory, or when you need to know what stack, compliance tier, and decisions a project already has.
---

# Orient before acting

Read `.sws/manifest.yml` first. It tells you what this project is, what was
already decided, and what you must not undo.

## What the manifest holds

```yaml
standards_version:  which version of the SWS standards generated this
recipe:             which recipe was followed, e.g. astro-static
tier:               low | moderate | high      compliance tier
editors:            which AI tools the wizard emitted config for
resolved:           what versions actually installed, recorded not enforced
owners:
  business:         name and Stanford email
  technical:        name and Stanford email
siteimprove:        registration recorded, or absent
prior_art:          what was reused, and from where
divergences:        deliberate departures from the recipe, with reasons
```

If there is no `.sws/` directory, this is not an SWS-managed project. Offer to
add the standards rather than assuming them, and do not restructure anything
without being asked.

## Then read, in this order

1. **`AGENTS.md`** at the repo root. The behavioral contract. Non-negotiables
   are there.
2. **`divergences`** in the manifest. Somebody already decided to leave the
   preferred path. Do not "fix" a recorded divergence back to the default; that
   is undoing a decision.
3. **`.sws/acknowledged.yml`**. Accepted risks with reasons and review dates. Do
   not re-raise an acknowledged finding as if it were new. If a `review_by` date
   has passed, that is worth mentioning once, kindly.
4. **The recipe** named in the manifest, at `standards/recipes/<id>/RECIPE.md`,
   plus its `acceptance.yml`, which is the definition of correct for this
   project.

## Tier changes the obligations

`tier` is derived from what the site handles, not from what the user knows about
MinSec. If the work you are about to do would change the tier, say so before
doing it, because the tier drives real requirements.

| Tier | Triggered by | Adds |
|---|---|---|
| `low` | Public information only | Patch cadence, monthly scanning, inventory, least-privilege admin |
| `moderate` | Personal data, authenticated users | Duo for all users and admins, centralised logging, secure SDLC, weekly backups, annual developer training |
| `high` | Regulated data, payments | Privileged access workstation, Data Risk Assessment before deploy, plus PCI, HIPAA, FISMA or export controls as applicable |

Adding a form that collects personal information, an authentication flow, or a
payment processor is a **tier change**, not a feature. Flag it, name the new
obligations, and point at the Data Risk Assessment process. Do not quietly
implement it.

## Report what you found

Keep it to a few lines. The person does not need their own project read back to
them.

```
This is <recipe> at <tier> tier, standards v<n>.
Stack resolved: <the two or three that matter>.
<n> recorded divergences: <one-line summary>.
<n> acknowledged findings, <n> past review date.
```

Then get on with the actual task.

## If the manifest is stale

`sws doctor` compares the recorded standards version against what is installed.
When it is behind, say so once and offer `sws update` to show what changed.
**Never update without being asked.** A project pinned to older standards may be
mid-review, or may have shipped and be under change control.
