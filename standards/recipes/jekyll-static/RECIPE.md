# Recipe: jekyll-static

**Stub. Not written, not executed.** This placeholder exists because Jekyll is
already how a lot of Stanford sites get built, and an agent asked to work on one
should find an honest "not yet" here instead of inventing a recipe on the spot.

| | |
|---|---|
| Recipe ID | `jekyll-static` |
| Status | **Stub, 2026-09-30.** Never run end to end |
| Origin | `PROJECT-PLAN.md` section 13a |
| Acceptance | **None yet.** There is no `acceptance.yml`, so `sws check --recipe jekyll-static` exits with "No acceptance.yml" |
| Versions | None specified, as with every recipe |

## Why this recipe is coming

Jekyll is the generator GitHub Pages has always built natively, so it is what
people reach for when they want a site to "just work on Pages". Many Stanford
sites are already built this way, often from a theme, and often without the
Global Footer or Decanter.

## What the recipe will have to settle

These are open questions, not decisions. Anything stated here as fact is labelled.

1. **How Decanter gets in.** Decanter 8 is CSS-first on Tailwind 4, so it needs a
   CSS compile step that scans the site's templates, and Jekyll has none of its
   own. **There is no precompiled Decanter file and there will not be one.**
   Tailwind generates classes on demand, so a file holding every combination
   would be far too large. Confirmed with SWS 2026-09-30. The compile runs **on
   the author's machine**, so they can preview before shipping, using
   **Tailwind's standalone CLI**, which needs no Node. CI runs the same command
   to deploy. If the CLI cannot be installed, CI alone is the fallback, and the
   author loses the preview of new classes. Verified 2026-09-30: the standalone
   CLI resolves Decanter 8 and detects classes in `.liquid` files with no
   `@source` line. The full test table, the entry CSS, and the vendoring cost
   are in `html-static/RECIPE.md`, under "Compiling Decanter on the author's
   machine". For Jekyll specifically:
   - Run `tailwindcss --watch` alongside `jekyll serve`, writing into a folder
     Jekyll copies, such as `assets/css/`. Whether `jekyll serve --livereload`
     then reloads on the CSS change is **unverified**.
   - Tailwind skips gitignored paths, so keep `_site/` gitignored, which Jekyll
     projects normally do. Otherwise the built output is scanned as markup.
   - Ruby is still needed, for Jekyll. Node no longer is, for the CSS.

   **Not the Tailwind Play CDN**, which Tailwind says is not for production.
2. **Classic Pages build or Actions build.** Fact: Pages builds Jekyll
   natively with no workflow file. But that path runs no `sws a11y`, no
   `sws check`, and no secrets gate. The Actions path gives you all three. Our
   expectation is that this recipe uses Actions, as `astro-static` does, and
   says why.
3. **Fragments as includes.** The Identity Bar and Global Footer would become
   `_includes/identity-bar.html` and `_includes/global-footer.html`, rendered
   from `standards/fragments/*.yml`. **Do not type them from memory.** Read the
   fragment, or call `sws_footer_html` through the MCP server.
4. **Themes.** Most Jekyll sites start from a gem theme that ships its own CSS
   and footer. Taking Decanter alongside a theme is a swap point to document,
   not a failure.
5. **Toolchain.** Jekyll needs Ruby and Bundler, which `standards/stack/requirements.yml`
   does not cover today. The checks still need Node to run in CI.

## What already works, for a site built today

- **`sws check` already finds Jekyll output.** It auto-detects `_site/` along
  with `dist/`, `build/` and `out/`. The footer, Identity Bar, a11y, and SEO
  checks read built HTML, so they apply as they are.
- **Acceptance will probably `extends: astro-static`**, as `astro-ssr` and
  `next-ssr` do, with overrides for the `decanter.*` and `build.*` criteria,
  because those inspect a Node project. Which ones need overriding gets decided
  when the recipe is run, not before.

## What to do now, if someone asks for a Jekyll site

1. Say plainly that this recipe is a stub and has not been tested.
2. If they have no reason to prefer Jekyll, offer `astro-static`, which is
   tested and also deploys to GitHub Pages. Do not push: if they already know
   Jekyll, that is a good reason.
3. If they keep Jekyll, the policy furniture still applies in full: Identity
   Bar, the exact Global Footer, a named business owner and technical
   administrator, WCAG 2.1 AA. Take those from `standards/fragments/` and
   `standards/policy/`.
4. Run `sws check --recipe astro-static --dist _site` and expect the
   Node-specific criteria to fail or report `unknown`. Acknowledge them in
   `.sws/acknowledged.yml` with the reason "jekyll-static recipe not yet written".
   That is a supported action.
5. Record the choice under `divergences:` in `.sws/manifest.yml`: Jekyll, not
   a tested recipe. **Do not set `recipe: jekyll-static` yet.** `sws check`
   reads that field and exits, because there is no acceptance file to load.
