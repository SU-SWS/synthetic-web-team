# Recipe: quarto-static

**Stub. Not written, not executed.** A placeholder for research groups who already
write in Quarto and want the site to be another output of the same work.

| | |
|---|---|
| Recipe ID | `quarto-static` |
| Status | **Stub, 2026-09-30.** Never run end to end |
| Origin | `PROJECT-PLAN.md` section 13a |
| Acceptance | **None yet.** There is no `acceptance.yml`, so `sws check --recipe quarto-static` exits with "No acceptance.yml" |
| Versions | None specified, as with every recipe |

## Why this recipe is coming

Quarto is a scientific publishing system: Markdown and notebooks go in, a
website comes out. The audience is people who already have the content in
`.qmd` or `.ipynb` and would not otherwise build a website.

## What the recipe will have to settle

Open questions. Anything stated as fact is labelled.

1. **Quarto's own theme.** Fact: Quarto websites ship with Bootstrap-based
   themes by default. Decanter on top of Bootstrap means two resets and two
   type scales fighting each other. Whether Quarto's minimal or no-theme mode
   removes enough of that is **unverified**.
2. **How Decanter gets in.** Same problem as `jekyll-static`: Decanter 8 needs a
   Tailwind 4 compile that scans the site's markup, and Quarto does not run
   one. **There is no precompiled Decanter file and there will not be one**
   (confirmed with SWS 2026-09-30). The compile runs **on the author's
   machine**, so they can preview, using **Tailwind's standalone CLI**, which
   needs no Node. CI runs the same command to deploy, and is the fallback if
   the CLI cannot be installed. Verified 2026-09-30: the standalone CLI
   resolves Decanter 8 and picks up a class written as a fenced-div attribute
   in a `.qmd` file. Full detail in `html-static/RECIPE.md`, under "Compiling
   Decanter on the author's machine". Still open for Quarto:
   - Run `tailwindcss --watch` alongside `quarto preview`, and point `css:` in
     `_quarto.yml` at the output. Whether `quarto preview` reloads when that
     file changes is **unverified**.
   - Classes that Quarto adds itself appear only in the rendered HTML in
     `_site/`, not in the `.qmd` sources. Styling those means scanning
     `_site/`, which in turn means compiling after Quarto renders.

   Not the Tailwind Play CDN.
3. **Where the fragments go.** Quarto has its own page-footer option, but the
   Global Footer must match the fragment exactly and nothing else may go inside
   it. The likely route is an HTML include injected after the body, rendered
   from `standards/fragments/global-footer.yml`. **Unverified.** Unit links go
   in a local footer above it, never in Quarto's footer slot next to the
   Global Footer.
4. **Computed content.** Notebooks that run at render time can pull data from
   outside the repo. That collides with `standards/scope.md` the moment the
   data is page content rather than an analysis output. Settle where that line
   is before writing guidance that blurs it.
5. **Toolchain.** Quarto is its own binary, often with Python or R behind it.
   `standards/stack/requirements.yml` covers none of that today.

## What already works, for a site built today

- **`sws check` already finds Quarto output**, as long as it is written to
  `_site/`, which is the default for a Quarto website. The checks read built
  HTML, so the footer, Identity Bar, a11y, and SEO checks apply as they are.
- **Acceptance will probably `extends: astro-static`**, with overrides for the
  `decanter.*` and `build.*` criteria that inspect a Node project. That gets
  decided when the recipe is run.

## What to do now, if someone asks for a Quarto site

1. Say plainly that this recipe is a stub and has not been tested.
2. If the content is already in Quarto, staying in Quarto is reasonable. Do not
   steer them to Astro just because Astro has a recipe.
3. The policy furniture applies in full: Identity Bar, the exact Global Footer,
   a named business owner and technical administrator, WCAG 2.1 AA. Take those
   from `standards/fragments/` and `standards/policy/`, and do not type the
   footer from memory.
4. Run `sws check --recipe astro-static --dist _site` and acknowledge the
   Node-specific criteria in `.sws/acknowledged.yml` with the reason
   "quarto-static recipe not yet written".
5. Record the choice under `divergences:` in `.sws/manifest.yml`. **Do not set
   `recipe: quarto-static` yet.** `sws check` reads that field and exits.
