---
id: profiles
name: Stanford Profiles
source: https://cap.stanford.edu
platform: CAP
summary: Faculty and staff profiles from CAP, so people pages stay current without retyping.
provides: Name, title, photo, bio, appointments, and a link to the person's Stanford Profiles page.
auth: Expected to need issued credentials. Not yet confirmed.
status: stub
reviewed: 2026-09-30
---

# Connector: Stanford Profiles

**Stub. Not built, not tested.** Stanford Profiles is backed by CAP
(cap.stanford.edu), which has an API. A lab or department people page is the
most common thing on a Stanford site, and the most often out of date. Pulling
from Profiles keeps it current from the source people already maintain.

## Verified

Nothing yet beyond what SWS has reported: CAP has an API and Stanford sites
connect to it.

## Not yet known

- **How access is granted.** Expect issued credentials, requested from CAP's
  owners. **This is unconfirmed.** If credentials are needed, they go in Actions
  secrets, never in the repository or the build. A static site **cannot** call
  an authenticated API from the browser without publishing the credential,
  which is why the fetch has to happen at build time.
- **The endpoints, the fields, and how to select a group's members.**
- **Which fields are public.** Profiles content is about people. Publish only
  what the person has already made public on their Stanford Profile. If a field
  is not public there, it does not go on the site. If a site would show more
  than that, it is a privacy question, and the door is the University Privacy
  Office.
- **Photo alt text.** Whether the API supplies any. The person's name alone is
  usually not enough, and the checks will flag a missing alt.
- **Who owns the API, and the terms for depending on it.**

## Likely shape

Per `standards/connectors/README.md`: a scheduled Action authenticates with
secrets, fetches the group's profiles, writes `src/data/people.json` with the
public fields only, and commits it. Each person links to their Stanford
Profiles page.

This pairs with the **lab or research group** starter prompt. People pages
could come from Profiles instead of one hand-written file per person. Students
and visitors often have no profile, so expect to mix the two.

## What to do now

1. Say this connector is a stub and access has not been confirmed.
2. Do not scrape profile pages as a substitute.
3. Until access is confirmed, keep people as files in the repository and link
   each person to their Stanford Profile.
