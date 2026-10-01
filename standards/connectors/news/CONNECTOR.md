---
id: news
name: Stanford News
source: https://news.stanford.edu
platform: Squiz Matrix
summary: Stanford Report stories about your unit, school, or topic, linked back to the original.
provides: Headline, summary, date, image, and a link to the canonical story.
auth: Unknown. To confirm with the site's owner.
status: stub
reviewed: 2026-09-30
---

# Connector: Stanford News

**Stub. Not built, not tested.** news.stanford.edu is built on Squiz Matrix and
exposes an API through the site itself. A unit that wants an "in the news"
section should pull from it rather than copying stories by hand.

## Verified

Nothing yet beyond what SWS has reported: the site runs on Squiz Matrix and has
an API built in.

## Not yet known

- **The endpoint, its parameters, and its response shape.** Do not guess them.
  Squiz Matrix builds APIs per site rather than offering one standard API, so
  general knowledge of Squiz will not tell you what this one does.
- **Whether it needs credentials.** If it does, they go in Actions secrets,
  never in the repository or the build.
- **How stories are tagged**, and so how a unit selects its own: by school,
  department, topic, or something else.
- **Image rights and alt text.** Whether a story's image may be reused on
  another site, and whether the API returns alt text with it. Without alt text,
  the image fails the site's accessibility checks.
- **Who owns the API, and whether sites may depend on it.**

## Likely shape

Per `standards/connectors/README.md`: a scheduled Action fetches recent stories
for the unit, writes `src/data/news.json`, and commits it. Show the headline, the
summary, and the date, and link every item to its story on news.stanford.edu.
Do not republish the full text.

## What to do now

1. Say this connector is a stub and the API has not been located.
2. Do not scrape the news site's HTML as a substitute. A scraper breaks without
   warning when the site's markup changes.
3. Until the API is confirmed, a short hand-maintained list of links in the
   repository is the honest fallback.
