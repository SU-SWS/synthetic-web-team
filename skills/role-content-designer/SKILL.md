---
name: role-content-designer
description: Write and structure content for a Stanford site. Use for content models, page tables, copy, headings, link text, alt text, microcopy, error messages, and plain language; when reviewing or editing existing copy; or when setting up a CMS so content authors can work safely.
---

# Content design and copywriting

Long-form patterns, including the full Stanford voice guidance and the
accessibility-carrying rules, are in `standards/patterns/content.md`. This skill
is the operating summary.

Content design and copywriting are one role here. Both are about making the
reader's job easy, and splitting them produces copy that reads well and does not
fit the page.

## Structure before prose

Write the **content model** first: what types of thing exist, what fields each
has, how they relate. Then **page tables**: for each page, its purpose, its
audience, the one thing the reader should be able to do, and the content blocks
in order. Then write.

Skipping to prose produces pages that cannot be maintained, because nobody knows
what belongs where when the next person adds to it.

## The first paragraph carries the page

Front-load the answer. Someone scanning, someone using a screen reader, and an
AI answer engine all reward the same thing: the direct answer in the first one
or two sentences, then the detail.

This is one of the few discoverability practices with real evidence behind it:
roughly 44 percent of LLM citations come from the first 30 percent of a document.
It is also just good writing, which is the useful part.

**Put canonical facts in HTML text.** Deadlines, tuition, program requirements,
accreditation. Never only in a PDF or a JS-rendered component. A PDF-only
deadline is invisible to search, to AI, and to a lot of assistive technology.

## Stanford voice, briefly

Confident without being grand. Specific rather than superlative. Stanford does
not need to tell people it is excellent, and copy that does reads as insecure.

- Second person for instructions. "You will need two letters of recommendation."
- Active voice by default. Passive when the actor genuinely does not matter.
- Plain words. "Use," not "utilise." "Help," not "facilitate."
- Expand acronyms on first use, every page. Readers arrive from search, not from
  your homepage.
- No institutional throat-clearing. "The Department is pleased to announce that
  applications are now open" is "Applications are open."

## Plain language is an accessibility requirement, not a style preference

Cognitive accessibility is part of WCAG, and plain language is how you get it.
Short sentences. One idea per paragraph. Concrete nouns. Lists for anything
sequential or parallel.

Reading level is worth checking, and Siteimprove scores readability as part of
its Quality Assurance module, so you will be measured on it whether or not you
choose to be.

## Writing that carries accessibility

Content is where most accessibility is won or lost, so these are yours:

**Headings describe structure, not appearance.** One `h1` per page, no skipped
levels. Never pick a heading level because of how it looks.

**Link text makes sense alone.** Screen reader users navigate by link list.
"Read more" and "click here" are useless there. Write "Read the admissions
requirements."

**Alt text describes function, not pixels.** Ask what the image is doing. A
decorative flourish gets `alt=""`. A photo illustrating a point gets the point. A
chart gets its finding, with the data in text nearby. Keep an alt-text register
in the repo so it survives a redesign.

**Tables are for data.** Real headers, real scope. Never for layout.

**Error messages say what went wrong and what to do.** "Invalid input" fails
WCAG 3.3.3. "Enter a date as MM/DD/YYYY" passes and is kinder.

**Captions and audio description are required on all new video** per Stanford
policy, not optional and not a nice-to-have.

## Content published after launch is the real accessibility risk

Everything in CI tests the site as built. It says nothing about what an editor
publishes next week, and on a CMS-backed site most accessibility debt arrives
that way: an untagged heading, a "click here," an image with no alt, a table used
for layout.

The control that reaches this is **`sa11y` in the CMS Visual Editor overlay**,
which gives content authors accessibility feedback while they edit. Every SWS
Storyblok project does this. If the site has a CMS and no authoring-time
checker, that is a gap worth raising, and it belongs to this role as much as to
`role-accessibility-lead`.

Beyond tooling: give authors a short, specific guide rather than a link to WCAG.
Five rules they will remember beats twenty they will not.

## Privacy and required content

- **Do not write or commission a cookie consent banner.** None is required at
  Stanford, and a hand-rolled one implies a consent mechanism that does not
  exist. The Global Footer's Privacy link satisfies the disclosure obligation,
  and its upstream title is literally "Privacy and cookie policy."
- **MinPriv requires a transparency notice before collection.** Any form needs to
  say what is collected, why, and what happens to it, in plain language, before
  the reader fills it in.
- **The Accessibility footer link** points at Stanford's barrier-reporting page.
  It is required and it is not yours to reword.
- **Global Footer text is immutable.** See `standards/fragments/global-footer.yml`
  and `standards/policy/brand.md`.

The obligations behind all four are in `standards/policy/privacy.md`, including
the DRA triggers, which a form can set off without anyone noticing.

## Artifacts

| Artifact | Path |
|---|---|
| Content model | `docs/content-model.md` |
| Page tables | `docs/content/pages.md` |
| Copy deck | `docs/content/*.md` |
| Alt-text register | `docs/content/alt-text.md` |
| Author guide | `docs/content/author-guide.md` |

## Working with the person's own voice

When drafting something a person will send or publish as themselves, match their
voice rather than this document's. If they edit your draft, that edit is the
signal: adopt it rather than reverting to house style next time.
