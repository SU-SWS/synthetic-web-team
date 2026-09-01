# Forms

Where accessibility, usability, and privacy converge hardest. A form is also the
most common way a `low`-tier site quietly becomes a `moderate`-tier one.

## Before the markup: a form is a tier question

**Every field is a MinPriv question about why you need it.**

- **Ask for the minimum.** The field nobody can justify is the field to delete.
- **A transparency notice is required before collection**, saying what is
  collected, why, and what happens to it — in plain language, before the reader
  starts filling it in. See [`../policy/privacy.md`](../policy/privacy.md).
- **Collecting personal information moves the site to `moderate` tier**, which
  attaches Duo, centralised logging, secure SDLC, backups, and training. See
  [`../policy/minsec.md`](../policy/minsec.md).
- **A Data Risk Assessment** is required before deploy if personal information is
  collected or a third-party service is introduced. That includes a third-party
  form or survey tool.

So "add a contact form" is a scope conversation, not a component request. Say that
early, once, without lecturing.

## Labels

- **Visible labels, above the field.** **Placeholders are not labels** — they
  vanish on focus, fail contrast, and disappear for anyone who needs to check what
  they typed.
- Every input has a programmatically associated label. `<label for>` or wrapping.
- **Group related fields** with `fieldset` and `legend`. Radio groups and checkbox
  groups need this or the group's question is never announced.
- **Mark required fields in text**, not with a colour or a bare asterisk. "Email
  (required)" works for everyone.

## Errors

- **Inline, next to the field**, plus a **summary at the top for long forms**.
- **Say what went wrong and what to do.** "Invalid input" fails WCAG 3.3.3. "Enter
  a date as MM/DD/YYYY" passes and is kinder.
- **Errors must be announced**, not only shown. A visual-only error is invisible
  to a screen reader user.
- **Never validate on blur while someone is still typing.** Validate on submit, or
  on blur only after a field has been completed once.
- **Never clear what the user typed** on a failed submit.
- **Error recovery is a first-class requirement.** Can someone who makes a mistake
  fix it without starting over? This is on the manual checklist because automation
  cannot see it.

## Inputs

- Use the right `type` (`email`, `tel`, `url`, `date`) so mobile keyboards and
  browser validation help rather than fight.
- Set `autocomplete` attributes. This is WCAG 1.3.5 and it is nearly free.
- **Target size minimum 24 by 24 CSS pixels.** This is the one WCAG 2.2 criterion
  axe can actually check.
- Do not disable paste, especially on email and password fields.
- Do not rely on colour alone to convey required, invalid, or valid state.

## Structure and submission

- One `h1`, real headings, logical tab order matching visual order.
- Keep the submit button visible and its label specific: "Send message," not
  "Submit."
- Confirm success in text, on a page or region that gets announced. A form that
  silently succeeds gets submitted three times.
- Say what happens next and when. "We reply within two business days."

## Prior art, with a warning attached

**`adapt-online-giving` is the best Decanter form reference at SWS.** Transactional
form flows, real validation, real error states.

**The caveat is not optional:** it is high-risk-tier work with Stripe and
authentication, almost certainly Moderate-or-higher risk. **Borrow the interaction
patterns; never the data handling.** Do not treat its architecture as a template
for a `low`-risk static site.

Its era is `decanter-7`, so the CSS is a parallel vocabulary rather than a target.
See `standards/prior-art/catalog.yml` and the precedence rule in
`standards/prior-art/README.md`.

## Decanter: forms are opt-in in v8, and forgetting it fails silently

**If the site has a form, the entry CSS needs a second import:**

```css
@import 'decanter';
@import 'decanter/forms';
```

Without it you lose `.input`, `.select`, `.textarea`, `.checkbox`, `.radio`,
`.label`, `.legend`, `.fieldset` **and the global form-element reset**. Nothing
errors — the form just renders unstyled, so this reaches production with a green
build. It is the most likely v8 mistake on a Stanford unit site.

`decanter/forms` is **not standalone**: import it alongside `decanter` or
`decanter/minimal`, which supply the theme variables and root font size it needs.

In v7 these classes came with the base package, so a v7 project that gains a form
after upgrading will appear to work until someone looks at it.

**Do not install `@tailwindcss/forms` directly.** It is still a declared
dependency of Decanter 8 and still installs; only its *application* is gated
behind the entry point above. Read the shipped CSS at
`node_modules/decanter/src/css/forms.css` rather than guessing class names. See
[`decanter.md`](decanter.md).

## On a static site, where does the submission go

Worth deciding before designing the form, because it constrains everything above:

- **GitHub Pages has no server**, so a form needs a third-party endpoint, which is
  a DRA trigger and a third-party service.
- **Netlify Forms** or a function is the path once the site is on Netlify.
- **The cheapest compliant answer is often a `mailto:` link or a link to an
  existing central form**, and it is worth offering before building anything.
