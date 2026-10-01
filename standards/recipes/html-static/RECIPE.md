# Recipe: html-static

**Stub. Not written, not executed.** The plain HTML option: hand-written pages, no
generator, often no `package.json`. A common shape of Stanford site, and the one
with no recipe at all.

| | |
|---|---|
| Recipe ID | `html-static`, following the `<generator>-<mode>` naming the other recipes use |
| Status | **Stub, 2026-09-30.** Never run end to end |
| Origin | Already on the roadmap as a v2 item; see `PROJECT-PLAN.md` sections 13 and 13a |
| Acceptance | **None yet.** There is no `acceptance.yml`, so `sws check --recipe html-static` exits with "No acceptance.yml" |
| Versions | None specified, as with every recipe |

## Why this recipe is coming

An AI agent with no generator in front of it writes plain HTML happily, so
this population will grow.

It is also the honest answer for someone who will never run `npm`. The person
editing the site may be fine with HTML and lost with a build step.

## What the recipe will have to settle

Open questions. Anything stated as fact is labelled.

1. **How Decanter gets in without Node.** Decanter 8 is CSS-first on
   Tailwind 4, and Tailwind generates classes on demand from the markup it
   scans. **There is no precompiled file, and there will not be one**: a file
   holding every combination would be far too large to serve. Confirmed with
   SWS 2026-09-30. So a compile step that scans the site's HTML is always
   needed, and **it has to run on the author's machine**, so they can preview
   work in progress before it ships. Direction from SWS, 2026-09-30. See
   "Compiling Decanter on the author's machine" below. Not the Tailwind Play
   CDN, which Tailwind says is not for production.
2. **Full entry point, not `minimal`.** Already decided in section 3 of the
   plan: `decanter/minimal` is a lighter base reset for when something else
   owns base styles. On a plain HTML site nothing else does, so use the full
   entry point.
3. **Fragments on every page.** With no layout system, the Identity Bar and
   Global Footer are copied into every file, and copies drift. The footer check
   runs per page, which catches drift once it has happened. Whether the recipe
   should also suggest a tiny include step is open.
4. **Where the checks run.** The author may never install Node, but CI can.
   `sws check`, `sws a11y`, and the secrets gate run in GitHub Actions against
   the repository root. That is how the recipe keeps "no build step" for the
   author without giving up the checks.

## Compiling Decanter on the author's machine

**Primary path: Tailwind's standalone CLI.** It is a single executable with
Tailwind and its first-party plugins built in, so it needs no Node and no npm.

**Verified 2026-09-30** with the standalone `tailwindcss` v4.3.3 on macOS arm64
and `decanter@8.0.0-beta.2`, in a folder with no `package.json`:

| Test | Result |
|---|---|
| `@import 'decanter';` with Decanter unpacked into `node_modules/decanter/` | Resolves. No Node involved |
| `@import` of a copy in `vendor/decanter/` by relative path | Resolves |
| `decanter/forms`, which declares `@plugin '@tailwindcss/forms'` | Works. The plugin comes from the CLI itself, with nothing else installed |
| Classes in `.html`, Jekyll `.liquid`, and Quarto `.qmd` files | All detected, with no `@source` line |
| Arbitrary values, opacity modifiers, `md:` and `hover:` variants, `.button`, `type-2` | All generated |
| `--watch=always`: edit a page, then add a new file | Rebuilt in about 5 ms, both times |
| A `vendor/decanter/` folder without exclusion | **Scanned as markup.** 52 KB of CSS instead of 23 KB, from classes in Decanter's own docs. Fixed by `@source not` |

Published for macOS (arm64, x64), Linux (x64, arm64, and musl builds), and
Windows x64, with `sha256sums.txt` on each release. **Only macOS arm64 was run.**
Homebrew also packages `tailwindcss`. Whether that build includes the forms
plugin was not checked, and Homebrew is never worth installing just for this,
per `standards/stack/requirements.yml`.

### The shape it suggests

To be confirmed when the recipe is run:

1. **Get the CLI** from the latest Tailwind release for the platform, and check
   it against `sha256sums.txt`.
2. **Get Decanter 8 onto disk without npm.** Unpack the registry tarball for the
   current `decanter@beta` (later `latest`, once 8 is final) into
   `vendor/decanter/` and commit it, so a fresh clone needs only the CLI. If
   the author has Node anyway, `npm install decanter@beta` and a bare
   `@import 'decanter';` is simpler and is not a divergence.
3. **The entry CSS**, with paths relative to the CSS file:

   ```css
   @import '../vendor/decanter/src/css/index.css';
   /* Only if the site has forms. Form styles are opt-in in Decanter 8. */
   @import '../vendor/decanter/src/css/forms.css';
   /* Otherwise Decanter's own docs are scanned as if they were the site. */
   @source not '../vendor';
   ```

4. **Preview.** Run `tailwindcss -i css/site.css -o css/site.out.css --watch`
   and open the pages. Plain `--watch` stops when its terminal input closes,
   which is what happens when an agent runs it in the background, so an agent
   should use `--watch=always`.
5. **Ship.** CI runs the same command before deploying, so the CSS that ships
   always matches the HTML that ships. The output file can then be
   gitignored.

**The cost to name: a vendored Decanter is a frozen copy.** That cuts against
"install latest, pin nothing". Record the vendored version under `resolved:` in
`.sws/manifest.yml`, and re-fetch it to update. Whether `sws doctor` should
flag a vendored copy that has fallen behind is open.

**Fallback: compile in GitHub Actions only.** For a machine where the CLI cannot
be installed (locked down, or a platform with no published binary), CI compiles
on every push to `main`. The site still ships correctly. What the author loses
is the preview: a class used for the first time shows up only after pushing, and
GitHub Pages has no per-push preview URL. Say so rather than letting someone find
out.

## What already works, for a site built today

- **The built-HTML checks apply as they are.** Point `sws check --dist .` at
  the folder that holds the HTML. Footer, Identity Bar, a11y, and SEO checks
  read HTML and do not care how it was made.
- **Acceptance will probably `extends: astro-static`** with every `decanter.*`
  and `build.*` criterion that inspects a Node project overridden or reworked.
  With no `package.json`, more of the parent will need overriding than for
  Jekyll or Quarto.

## What to do now, if someone asks for a plain HTML site

1. Say plainly that this recipe is a stub and has not been tested.
2. Plain HTML is a legitimate choice, not a lesser one. Do not argue someone
   into Astro who has said they do not want a build step.
3. The policy furniture applies in full: Identity Bar, the exact Global Footer,
   a named business owner and technical administrator, WCAG 2.1 AA. Paste the
   fragments from `standards/fragments/` or `sws_footer_html`. Never type them
   from memory.
4. Run `sws check --recipe astro-static --dist .` and acknowledge the
   Node-specific criteria in `.sws/acknowledged.yml` with the reason
   "html-static recipe not yet written".
5. Record the choice under `divergences:` in `.sws/manifest.yml`. **Do not set
   `recipe: html-static` yet.** `sws check` reads that field and exits.
