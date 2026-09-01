# Information architecture

Structure, naming, and findability. The layer where a site becomes usable or does
not, and where most of the damage is done by organising around the institution
rather than the reader.

## The org chart is not an IA

**The most common failure at a university:** navigation that mirrors internal
structure. Readers do not know which office owns the thing they need, and should
not have to.

Organise by **task and audience**, then let internal structure show up on an About
page where it belongs.

**The tell** is a top-level item that only makes sense to staff. If a prospective
student would not use the word, it is not a nav label.

## Navigation

**Depth over breadth, but not much depth.** Three levels is usually enough for a
unit site. A fourth level almost always means either two sites are wearing one
costume, or a section should be a landing page with real content rather than a
signpost.

**Label with the reader's words.** Test labels against what people search for, not
what the unit calls itself internally. "Giving" beats "Advancement." "Apply" beats
"Prospective Student Information."

**Seven is not a law.** The advice about seven items comes from working-memory
research that does not apply to a persistently visible menu. Use as many as the
content honestly needs — and if that number is large, the problem is the content
model rather than the menu.

**Cross-cutting content needs one home and many paths.** Pick a canonical
location, then link to it. Duplicating a page for two audiences means two pages
drifting apart, and it splits your search signal.

## URL design

**URLs are a permanent interface. Treat changing one as a migration.**

- **Lowercase, hyphenated, no file extensions.** `/graduate-programs`, not
  `/GraduatePrograms` or `/grad_programs.html`.
- **Short and stable over descriptive and brittle.** `/apply` outlives
  `/how-to-apply-for-autumn-2027-admission`.
- **No dates in paths** unless the content is genuinely archival. `/news/2026/`
  ages into a graveyard.
- **Mirror the IA, shallowly.** URL depth should not exceed nav depth.
- **Never encode the org chart.** `/offices/oue/ugadmit/apply` is the navigation
  mistake made permanent.
- **Pick a trailing-slash convention and hold it.** Astro's `trailingSlash`
  setting exists for this. Mixed conventions produce duplicate URLs.

## Subdomain naming, which is not yours to approve

Per the stanford.edu name assignment policy, a subdomain **must reflect the
recognised unit name** and is **approved by University Communications**. Vanity
URLs are not permitted for personal pages.

**This has a lead time and it fails projects that leave it late.** Raise it during
discovery, route per [`../policy/escalation.md`](../policy/escalation.md), and
record the approval date in `.sws/manifest.yml`.

You can advise on a name. You cannot approve one.

Also relevant: MinWeb covers Stanford-branded `.org` and `.com` sites too, so
moving off `stanford.edu` does not shed the standards. `sup.org` is the live
example. See [`../policy/minweb.md`](../policy/minweb.md).

## Taxonomy

**Only build one if something needs filtering or aggregating.** A taxonomy on a
twelve-page site is overhead pretending to be structure.

When you do:

- **Flat beats hierarchical** unless the hierarchy is genuinely meaningful.
- **Closed vocabularies for anything filtered.** Free tags produce
  "Undergraduate," "undergrad," and "Undergraduate " within a month.
- **One dimension per vocabulary.** Do not mix audience, topic, and format into
  one tag set.
- **Name the term as a reader would, not as a database would.**

## Migrations and redirects

Migrating an existing site is mostly redirect work, and skipping it is how a unit
loses years of accumulated search equity in an afternoon.

1. **Crawl the existing site** and export every URL with traffic. Siteimprove can
   help, and it is already required.
2. **Map old to new, one to one where possible.** A many-to-one map onto the
   homepage is not a redirect strategy, it is a way to hide the problem.
3. **301 for permanent moves.** Record the map as `redirects.csv` in the repo so
   it survives the person who made it.
4. **Keep an inventory of what you deliberately dropped**, with a reason. "This
   page had four visits in a year and its content is wrong" is a good reason and
   worth writing down.
5. **Check inbound links you do not control**: other Stanford sites, Wikipedia,
   syllabi, printed materials. Those cannot be updated, so those URLs must keep
   working.

**A hosting constraint that decides architecture:** GitHub Pages is static hosting
with no server-side redirect layer, so you get meta-refresh or JS shims, both
worse for accessibility and search. **If a migration involves substantial
redirects, that is a reason to deploy to Netlify.** Say so early rather than
discovering it at launch.

## Search, when the site needs it

**Below roughly fifty pages, good navigation beats search**, and search becomes a
crutch for bad IA. Above that, see [`discoverability.md`](discoverability.md) for
the Algolia and Coveo decision.

Either way, **design the empty state and the zero-results case**, because those
are where search actually gets judged.

## Prior art is unusually valuable here

IA is exactly what live exemplars are good for, because a rendered site shows the
structure that **survived launch**. `standards/prior-art/catalog.yml` has
seventeen, and the two large school sites are more instructive compared against
each other than read singly.

Remember the precedence rule: **borrow structure freely, never CSS or versions.**
See `standards/prior-art/README.md`.
