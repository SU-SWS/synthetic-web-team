# Content

Content design and copywriting are one discipline here. Both are about making the
reader's job easy, and splitting them produces copy that reads well and does not
fit the page.

## Structure before prose

1. **Content model** — what types of thing exist, what fields each has, how they
   relate.
2. **Page tables** — for each page: its purpose, its audience, the one thing the
   reader should be able to do, and the content blocks in order.
3. **Then write.**

Skipping to prose produces pages that cannot be maintained, because nobody knows
what belongs where when the next person adds to it.

## The first paragraph carries the page

**Front-load the answer.** Someone scanning, someone using a screen reader, and an
AI answer engine all reward the same thing: the direct answer in the first one or
two sentences, then the detail.

This is one of the few discoverability practices with real evidence behind it:
roughly 44 percent of LLM citations come from the first 30 percent of a document.
It is also just good writing, which is the useful part. See
[`discoverability.md`](discoverability.md).

**Put canonical facts in HTML text.** Deadlines, tuition, program requirements,
accreditation. **Never only in a PDF or a JS-rendered component.** A PDF-only
deadline is invisible to search, to AI, and to a lot of assistive technology.

## Stanford voice

Confident without being grand. Specific rather than superlative. **Stanford does
not need to tell people it is excellent, and copy that does reads as insecure.**

- **Second person** for instructions. "You will need two letters of
  recommendation."
- **Active voice** by default. Passive when the actor genuinely does not matter.
- **Plain words.** "Use," not "utilise." "Help," not "facilitate."
- **Expand acronyms on first use, every page.** Readers arrive from search, not
  from your homepage.
- **No institutional throat-clearing.** "The Department is pleased to announce
  that applications are now open" is "Applications are open."

## Plain language is an accessibility requirement, not a style preference

Cognitive accessibility is part of WCAG, and plain language is how you get it.
Short sentences. One idea per paragraph. Concrete nouns. Lists for anything
sequential or parallel.

Reading level is worth checking, and **Siteimprove scores readability** as part of
its Quality Assurance module, so it gets measured whether or not you choose to
measure it. See [`../policy/accessibility.md`](../policy/accessibility.md).

## Writing that carries accessibility

Most accessibility is won or lost in content, so these belong here rather than in
a developer's checklist:

**Headings describe structure, not appearance.** One `h1` per page, no skipped
levels. Never pick a heading level because of how it looks.

**Link text makes sense alone.** Screen reader users navigate by link list. "Read
more" and "click here" are useless there. Write "Read the admissions
requirements."

**Alt text describes function, not pixels.** Ask what the image is *doing*. A
decorative flourish gets `alt=""`. A photo illustrating a point gets the point. A
chart gets its finding, with the data in text nearby. Keep an **alt-text
register** in the repo so it survives a redesign.

**Tables are for data.** Real headers, real scope. Never for layout.

**Error messages say what went wrong and what to do.** "Invalid input" fails WCAG
3.3.3. "Enter a date as MM/DD/YYYY" passes and is kinder. See
[`forms.md`](forms.md).

**Captions and audio description are required on all new video** per Stanford
policy. Not optional, not a nice-to-have.

## Content published after launch is the real accessibility risk

Everything in CI tests the site **as built**. It says nothing about what an editor
publishes next week, and on a CMS-backed site most accessibility debt arrives
exactly that way: an untagged heading, a "click here," an image with no alt, a
table used for layout.

The only control that reaches this is **`sa11y` in the CMS Visual Editor
overlay**, which gives content authors feedback while they edit. Every SWS
Storyblok project does this. **If the site has a CMS and no authoring-time
checker, that is a gap worth raising.**

Beyond tooling: give authors a short, specific guide rather than a link to WCAG.
**Five rules they will remember beats twenty they will not.**

## Required content that is not yours to reword

- **Global Footer text is immutable.** `standards/fragments/global-footer.yml`,
  and see [`../policy/brand.md`](../policy/brand.md).
- **The Accessibility footer link** points at Stanford's barrier-reporting page.
- **No cookie consent banner is required**, because the Global Footer's Privacy
  link carries the disclosure. It is not forbidden either: if a unit wants one,
  that is their call and the copy is then yours to write. Do not tell them they
  cannot. See [`../policy/privacy.md`](../policy/privacy.md).
- **MinPriv requires a transparency notice before collection.** Any form says what
  is collected, why, and what happens to it, in plain language, before the reader
  fills it in.

## Working with a person's own voice

When drafting something a person will publish as themselves, match their voice
rather than this document's. **If they edit your draft, that edit is the signal:**
adopt it rather than reverting to house style next time.
