---
policy: scope
title: What this package covers, and what it does not
reviewed: 2026-09-03
---

# Scope

**This package builds static Stanford sites with content authored in the
repository.** That is the whole scope. It is deliberately narrow, and narrowing
it is what makes the rest of the guidance honest: every claim here can be tested
against a real build, because there is nothing arriving after the build that we
cannot see.

## In scope

- **Static content**, authored in the repo as Markdown, MDX, or framework
  templates, and reviewed through git.
- **All three recipes.** `astro-static`, `astro-ssr`, and `next-ssr`. A server
  runtime is in scope for response headers, redirects, search, and forms.
  Content still comes from the repo.
- **All hosts in `standards/hosting/`.** GitHub Pages, Netlify, Vercel.

**Note that "static content" is about the content SOURCE, not the build output.**
`astro-ssr` and `next-ssr` render at request time and are fully in scope. What is
out of scope is content that arrives from somewhere other than the repo.

## Out of scope, for now

**No CMS attachments.** Not Storyblok, not decoupled Drupal, not any other
content backend. Concretely, that means this package does not currently ship:

| Deferred | Where it will come back |
|---|---|
| Storyblok integration and content modelling | A `*-storyblok` recipe overlay |
| Decoupled Drupal via GraphQL | A separate recipe; it is a different shape of project |
| `sa11y` in a Visual Editor overlay | Returns with the CMS that needs it |
| Webhook-triggered rebuilds on publish | Returns with the CMS that triggers them |
| A separate CSP for a Visual Editor route | Returns with the iframe that needs it |
| Preview and draft modes | Returns with the CMS that has drafts |

**"Out of scope" means we do not prescribe it. It does not mean it is
forbidden**, and it does not mean the existing SWS CMS work is wrong. Six SWS
repos run Storyblok and five run decoupled Drupal, all of them in production.
If a project needs a CMS, that is a legitimate project — this package just does
not have a tested recipe for it yet, and saying so is better than shipping
guidance nobody has run.

## Two consequences worth stating plainly

### 1. The post-launch accessibility gap mostly closes

This is the good news, and it is the strongest argument for the narrow scope.

`standards/patterns/content.md` used to say that content published after launch
is the real accessibility risk, because CI tests the site **as built** and says
nothing about what an editor publishes next week. On a CMS-backed site that is
true, and `sa11y` in the Visual Editor was the only control that reached it.

**With content in the repo, there is no "published next week" that bypasses the
build.** Every content change is a commit, every commit runs `sws a11y` and
`sws perf`, and an untagged heading or a missing `alt` is caught before it is
public. The control moved from an authoring-time overlay into CI, where it is
stronger.

Two things this does **not** fix, so do not overclaim:

- **Automated testing still catches roughly 30 percent of issues** per ODA
  guidance. A green axe run is a floor, not a conformance claim. That is
  unchanged and it is the more important limit.
- **Embedded third-party content** — a Qualtrics form, a YouTube player, a
  map — is still published outside the build, and its accessibility is still not
  yours to control. Raise it as a procurement question with a VPAT, per
  `standards/policy/procurement.md`.

### 2. "Making git disappear" now has one path, not two

For a non-technical unit this matters more than any technical detail here,
because it decides **who can maintain the site**.

Without a CMS, the options are:

- **GitHub web UI editing.** Edit a Markdown file, commit to `main`, the site
  rebuilds. This works today, it is why push-to-main must keep deploying, and it
  is why nothing should make a pull request mandatory. It is a real answer for a
  unit with one or two people willing to edit Markdown.
- **Point them at Stanford Sites.** Free, already compliant, and someone else
  maintains it. `astro-static` already says this, and it remains the right
  referral for a unit that will maintain a site alone with no appetite for git.

**Raise this during discovery, not at launch.** If the unit needs a CMS, say so
early and honestly: this package does not cover it yet. Do not build half a
content backend to avoid the conversation.

## Reading prior art under this scope

`standards/prior-art/` is a **factual record of what SWS has built**, and most of
it is CMS-backed. That record stays exactly as it is — it is not rewritten to
match the current scope, because it is evidence rather than instruction.

So when prior art shows you a Storyblok pattern:

- It is **still correct about what SWS did.**
- It is **not a recipe you should follow here**, because this package has no
  tested CMS path.
- Cite it for the **shape of the problem** — content modelling, IA, component
  composition — and not for the CMS wiring.

This is the ordinary precedence rule doing its job: prior art tells you how we
solved a shape of problem, standards tell you what to build it with, and when
they disagree, standards win.
