---
name: role-user-researcher
description: User research for a Stanford site. Use for research planning, usability testing, interviews, surveys, analytics interpretation, or deciding what evidence would settle a design disagreement. PARTIALLY IMPLEMENTED: lightweight research ships in role-ux-designer, the full discipline does not.
---

# User research

**Status: stub. Full role lands in v2.** The proportionate version ships today
inside `role-ux-designer`, which is where most SWS unit projects will and should
stop.

## The honest position

Most Stanford unit sites do not get a research budget, and pretending otherwise
produces research theatre: a survey nobody acts on, a persona document nobody
reads. The lightweight practices in `role-ux-designer` are genuinely most of the
available value.

What is worth doing on any project, however small:

- **Five minutes of task-based testing with two people** who are not on the
  project. Give them a real task, watch, do not help. This finds more than a
  heuristic review and costs almost nothing.
- **Read the existing site's analytics and internal search logs.** Free evidence
  about what people actually want, as opposed to what the unit thinks they want.
- **Ask the unit what people email and call them about.** Those questions are the
  site's real information architecture, and they are usually not what the
  navigation reflects.

## Stanford-specific considerations, which matter more than method

**Human subjects.** Formal research involving students, or anything generalisable
that will be published, may need IRB review. Usability testing of a website for
internal design purposes typically does not, but the line is not yours to draw.
Ask before assuming, and route it rather than deciding.

**Recruiting is the hard part.** Students, faculty, and prospective students are
each hard to reach for different reasons, and prospective students are close to
impossible for a department to recruit ethically.

**MinPriv applies to research data too.** A survey collecting anything personal
needs a transparency notice before collection, purpose limitation, and appropriate
storage. Introducing a third-party survey tool may trigger a Data Risk Assessment.
Route to the University Privacy Office.

**Compensation** has procurement and tax implications and is not something to
improvise.

## Audience ranking is the highest-value output

If this role does one thing on a Stanford project, it should be forcing a
**ranked** audience list. "Prospective students, current students, and faculty" is
three audiences with conflicting needs, and treating them as equals is the single
most reliable cause of an unusable homepage. Somebody has to be first.

That output does not need a research programme. It needs one conversation with the
unit and the discipline to write the answer down where the IA and content roles
will see it.

## Artifacts, when the full role exists

Research plan, findings with evidence rather than assertions, ranked audience
definitions, task inventory, and a usability test script, in `docs/research/`.

For now: use the lightweight practices, be honest about what they can and cannot
support, and never present two people's opinions as a finding.
