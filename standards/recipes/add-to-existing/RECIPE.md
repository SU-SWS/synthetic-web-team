# Recipe: add-to-existing

**Stub. Not written, not executed.** The retrofit recipe: bring an existing
Stanford site up to standard without rebuilding it. It is the agent-facing half of
the wizard's `add .` job. `add .` installs the contract, the standards, and the
manifest; this recipe is what the agent follows next.

| | |
|---|---|
| Recipe ID | `add-to-existing`, the retrofit recipe |
| Status | **Stub, 2026-09-30.** Never run end to end. Reserved in the section 5 layout of `PROJECT-PLAN.md` since the first draft |
| Origin | `PROJECT-PLAN.md` section 13a |
| Acceptance | **None, and possibly never in the usual form.** A retrofit inherits whatever generator the site already uses, so its criteria are the generator's recipe plus a before-and-after score |

## Why this recipe is coming

Plenty of Stanford sites already exist that were built outside a web team, often
with an AI coding tool. Many are static, many are on GitHub Pages, and many are
missing the policy furniture: no Global Footer, or a hand-built one, and no
Decanter. Getting those sites to standard reaches more people than any new-site
recipe, because the sites are already live.

## The principle the recipe has to keep

**The owner keeps their site.** A retrofit that rewrites someone's site into our
preferred stack is a rebuild, and they will rightly refuse it. So:

- **Never convert the generator, the package manager, or the host.** Jekyll stays
  Jekyll, yarn stays yarn, Netlify stays Netlify.
- **Policy furniture first, design system second.** Only a sliver of a site is
  governed by policy (`standards/policy/brand.md`). Decanter is the easiest
  compliant path, not a requirement. A Bootstrap site that gets the exact Global
  Footer and an Identity Bar is a success, not a partial one.
- **Record divergences, do not fix them.** Anything kept on purpose goes in
  `divergences:` with a reason.

## Likely order of work

A sketch to be tested in a pilot, not a procedure yet.

1. **Run `add .`** and fill in what the manifest lists in `incomplete[]`. Ask the
   user for the owner names and emails. Never invent an owner email.
2. **Baseline.** Run `sws check` before changing anything, so the owner can see
   the improvement.
3. **Global Footer and Identity Bar** from `standards/fragments/`, replacing any
   hand-built version. Unit links move to a local footer above it.
4. **Named business owner and technical administrator** visible on the site.
5. **Checks in CI**, push to `main`, never a required pull request.
6. **Then, optionally, Decanter**, using the matching generator recipe once one
   exists (`jekyll-static`, `quarto-static`, `html-static`, `astro-static`).

## Things a retrofit is likely to meet

Listed so the recipe covers them.

- **A repository on a personal GitHub account.** It disappears when the person
  leaves. Moving it to a Stanford org is an access request to that org's owners,
  per `standards/policy/escalation.md`. The agent does not do the move.
- **Tailwind's Play CDN in production.** Tailwind does not intend it for
  production use. A thing to avoid, in the house style.
- **Keys in browser code** for a hosted database. Any value in a static build is
  public, as `standards/hosting/github-pages.yml` already says. If that value
  matters, it is a secrets finding; route to UIT Security for anything beyond
  that.
- **Third-party services already live** with no review (forms, data, AI,
  analytics). See `standards/patterns/bolt-ons.md`. A retrofit surfaces them; it
  does not approve or remove them.
- **A hand-built footer that is close but not exact.** The footer check will say
  where it differs.

## What to do now

1. Say that this recipe is a stub.
2. Run `add .`, then follow steps 2 to 5 above, which need nothing new.
3. Run `sws check` with the recipe closest to the site's generator, and
   acknowledge criteria that do not apply in `.sws/acknowledged.yml`.
