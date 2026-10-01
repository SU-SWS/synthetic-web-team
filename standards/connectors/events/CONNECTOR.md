---
id: events
name: Stanford Events
source: https://events.stanford.edu
platform: Localist
summary: Upcoming events from the university calendar, filtered for your unit, series, or topic.
provides: Event title, dates, location, description, and a link to the canonical event page.
auth: None for public events. Verified 2026-09-30.
status: stub
reviewed: 2026-09-30
---

# Connector: Stanford Events

**Stub. Not built, not tested in a site.** The university calendar at
events.stanford.edu runs on Localist. A unit that already posts its events there
should not type them again into its own site.

## Verified

Checked on 2026-09-30 with a plain HTTPS request:

- `https://events.stanford.edu/api/2/events` returns JSON with **no
  authentication**.
- The response has three top-level keys: `events`, `page`, and `date`. Each item
  in `events` is wrapped in an `event` object with fields that include `id`,
  `title`, `url`, `first_date`, `last_date`, `location_name`, `room_number`,
  `status`, and `experience` (for example `inperson`).
- `pp` sets the page size. `page` reports `current`, `size`, `total`,
  `total_items`, `next_page`, and `previous_page`.
- The request accepted `days` and `keyword` parameters with a 200. **Whether
  they filter as expected was not checked.**

## Not yet known

- **How to select one unit's events.** Localist instances usually filter by
  group, department, or type. Which of those Stanford's instance uses, and the
  IDs, need confirming.
- **Who owns the calendar, and whether sites may depend on the API.** Ask
  before relying on it. If the owner is not known, use the general UIT contact.
- **Rate limits and terms of use.**
- **Whether descriptions are HTML, and how clean it is.** Imported HTML can
  bring headings out of order, missing alt text, or inline styles. Those would
  then fail the site's own checks.

## Likely shape

Per `standards/connectors/README.md`: a scheduled Action fetches upcoming events
for the unit, writes `src/data/events.json`, and commits it. Pages render from
that file and link every event to its `url` on events.stanford.edu.

This pairs with the **seminar series** starter prompt. A unit that posts talks
to the calendar could feed the site from it, instead of keeping one file per
talk.

## What to do now

1. Say this connector is a stub.
2. Use only the verified facts above. Do not invent filter parameters.
3. Fetch at build time or on a schedule, not in the browser, and do not use the
   Localist embed widget as a shortcut.
4. Record the dependency under `divergences:` in `.sws/manifest.yml`.
