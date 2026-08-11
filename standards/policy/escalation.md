# Escalation: which office, and which door

**The operational counterpart to "route, don't recommend."** That principle says name the responsible university office rather than a product. This file says *which* office and, more usefully, *which door* at that office.

The distinction matters. Handing someone three links and letting them pick is a link farm, not routing. The agent should choose the door based on the situation and give one answer, with the others available if the first turns out wrong.

## Office of Digital Accessibility (ODA)

Hub: [uit.stanford.edu/accessibility/help](https://uit.stanford.edu/accessibility/help)

Three doors. Pick by situation, do not list all three.

| Situation | Door | Notes |
|---|---|---|
| **A site is about to launch**, or is being significantly revised | **Request an accessibility review** | This is a pre-launch gate, not a favour. It belongs on the launch checklist, and it needs lead time, so raise it during the project rather than the week before go-live |
| **Support question while building**: "is this pattern okay", "how do I fix this finding", "what does Siteimprove mean by this" | **Office hours** | Two weekly sessions: [Accessibility Office Hours](https://uit.stanford.edu/accessibility/help/office-hours), Tuesdays 11am–12pm Pacific, registration required for a 30-minute block, and bring a URL or a short description so they can prepare. Plus a **Siteimprove & Accessibility drop-in**, Thursdays 1–2pm Pacific, no registration, Zoom link in the `#cop-siteimprove` Slack channel |
| **General question**, policy interpretation, or none of the above fits | **Contact ODA** via the hub page | Also the correct door when a barrier has been reported and needs to be logged with ODA |

Both office hours are free to current faculty, staff, and students.

**Related obligations that are not ODA's door:**

- A **reported accessibility barrier** must be acknowledged in writing to the reporter, with ODA copied, including the date and the issue. That is a remediation obligation, and ODA coordinates the fix and timeframe.
- **Siteimprove registration** is a MinWeb requirement for public-facing sites, handled through its own intake form, not through ODA.
- **Procurement** of a third-party product needs a VPAT or ACR dated within the past 12 months. Different process, same office worth consulting.

## Other offices

Same pattern. Fill these in as the routes get confirmed, and **never invent a door**: if the correct one is unknown, use the office's general contact and say that is what you are doing.

| Situation | Office | Door | Status |
|---|---|---|---|
| Subdomain name approval for a `stanford.edu` site | University Communications | Per the stanford.edu name assignment policy | Route needs confirming |
| Consent management, or a site with a genuine need for it | University Privacy Office | [privacy.stanford.edu](https://privacy.stanford.edu) | Confirmed: no banner required, no vendor centrally licensed, do not recommend one |
| Data Risk Assessment, triggered by personal data or new third-party services | UIT Security | DRA process | Route needs confirming |
| MinSec temporary exception | UIT Security, via the Business Owner | Exception request, valid up to 3 years | Route needs confirming |
| SSL certificate | UIT | SSL service | Route needs confirming |

## Rules for the agent

1. **One door, chosen by situation.** Not a list.
2. **Say why.** "This is pre-launch, so it needs an accessibility review" is more useful than a bare link.
3. **Give the practical detail** that saves a round trip: registration required, bring a URL, lead time needed, which Slack channel.
4. **Never invent a door.** General contact plus an honest "this is the general contact, they will route you" beats a confident wrong link.
5. **Never substitute yourself for the office.** The agent can explain what WCAG 2.1 AA requires and fix findings. It cannot grant an exception, approve a subdomain, sign off a launch, or interpret policy on the university's behalf.
6. **Escalation is advisory like everything else.** Prompt, record it in the launch checklist, do not block.
