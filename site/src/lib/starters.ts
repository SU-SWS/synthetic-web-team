// ---------------------------------------------------------------------------
// Starter prompts: one per kind of site people actually build at Stanford.
//
// The install prompts on the home page answer "how do I get this into my
// project". These answer "what do I ask for once it is there": lab sites,
// seminar series, course sites, research data portals, maps with a directory,
// and sites that already exist and are missing the policy furniture. See
// PROJECT-PLAN.md section 13a.
//
// Every prompt is SETUP + BRIEF + CLOSE. Setup and close are shared so the
// safety properties cannot drift between prompts: never invent an owner email,
// content lives in the repo, run the checks, and say what is still manual.
// The brief is the only part that differs, and the [brackets] are the only
// part the reader is expected to edit.
//
// What a brief may promise is bounded by what is tested. astro-static is the
// one recipe that has been run end to end, so the new-site briefs use it. The
// Jekyll, Quarto and plain HTML recipes are stubs, and the prompt for them says
// so out loud rather than letting the agent improvise one.
// ---------------------------------------------------------------------------

const SKILLS = `This assumes the Stanford Web Services skills are installed in my editor. If
the sws-* skills are not available to you, run this first:

  npx @su-sws/synthetic-web-team install --json`;

// `init` is the command, not decoration: without it the wizard prints its help,
// writes nothing, and exits 0, which an agent reads as success.
const init = (purpose: string) => `Then, in the empty directory for the new site:

  npx @su-sws/synthetic-web-team init --json \\
    --answers '{"siteName":"...","unit":"...","purpose":"${purpose}"}'

If npx cannot reach the registry, use the repository instead:

  git clone --depth 1 https://github.com/SU-SWS/synthetic-web-team /tmp/swt
  node /tmp/swt/packages/wizard/bin/wizard.mjs init --json \\
    --answers '{"siteName":"...","unit":"...","purpose":"${purpose}"}'

Fill in siteName and unit from what I tell you, and ask me if they are not
obvious. Read AGENTS.md and follow it from now on. Work through "next" in
order. Ask me about every field in "incomplete": do not invent owner names or
email addresses, because MinWeb requires a real business owner and technical
administrator with Stanford addresses.`;

const CONTENT = `Keep the content in this repository as Markdown and YAML, so that a change
is a commit anyone can review. Do not pull it from a spreadsheet, a form, or a
hosted database. If something below seems to need one, stop and tell me what
standards/patterns/bolt-ons.md says before building it.`;

const CLOSE = `When the pages are built:

1. Run npm install and npm run build, then npx sws a11y, npx sws perf, and
   npx sws check.
2. Give me the score out of 100 and the three findings most worth fixing,
   one sentence each, naming the Stanford policy behind each.
3. Tell me what is still manual before launch: the accessibility review from
   the Office of Digital Accessibility, Siteimprove registration, and approval
   of the subdomain name by University Communications.

A passing run is a floor, not a conformance claim. Say so rather than calling
the site accessible.`;

const newSite = (purpose: string, opener: string, brief: string) =>
  [opener, SKILLS, init(purpose), brief, CONTENT, CLOSE].join('\n\n');

export interface Starter {
  id: string;
  title: string;
  /** One line, for the card on the home page. */
  summary: string;
  /** Who this is for, in the reader's terms. */
  goodFor: string;
  /** What the prompt makes the agent watch for. Shown beside it. */
  watch: string[];
  prompt: string;
  /** Recipe status the prompt relies on, so the page never overstates it. */
  status: 'tested' | 'stub';
}

export const starters: Starter[] = [
  {
    id: 'lab',
    title: 'Lab or research group',
    summary: 'People, research areas, and publications, one file per entry.',
    goodFor: 'A PI or lab manager who wants a site the lab can keep current by adding a file.',
    watch: [
      'Real alt text for every photo. The agent asks rather than writing "photo of person".',
      'Publications come from a list you supply, not from scraping a profile.',
      'Pulling publications automatically is a bolt-on, so it is raised before it is built.',
    ],
    status: 'tested',
    prompt: newSite(
      'Lab website',
      'Start a new website for my research lab, following Stanford Web Services standards.',
      `What I am building: a site for [lab name], a research group in [department],
led by [PI name].

Pages:
- Home: who we are and what we study, in two or three plain sentences
- Research: one page per research area, [list them]
- People: current members with role, photo, and a short bio; alumni listed
  separately
- Publications: newest first, each with a link to the paper
- Join us, and contact

One file per person and one per publication, so adding someone means adding
a file. Ask me for real alt text for each photo; do not write "photo of" plus
a name. I will give you the publication list as [BibTeX / a plain list]; do
not scrape it from a profile page.

Link each person to their Stanford Profiles page if they have one. The
Profiles connector in standards/connectors/profiles/ is a stub, so keep the
people as files for now rather than pulling from it.`,
    ),
  },
  {
    id: 'seminar',
    title: 'Seminar or talk series',
    summary: 'Upcoming and past talks, a calendar file, and speaker pages.',
    goodFor: 'A department or program coordinator running a recurring series.',
    watch: [
      'A static site decides what is "upcoming" at build time, so it schedules a daily rebuild.',
      'Recordings need captions. That is Stanford accessibility policy for new video.',
      'Registration collects personal data, which changes the compliance tier, so it is raised first.',
    ],
    status: 'tested',
    prompt: newSite(
      'Seminar series website',
      'Start a new website for a seminar series, following Stanford Web Services standards.',
      `What I am building: a site for [series name], run by [unit], meeting
[weekly / monthly] at [location].

Pages:
- Home: the next talk, prominently, then the rest of this term
- Past talks, newest first, with recordings where we have them
- One page per talk: speaker, title, abstract, date, time, location
- About the series, and how to join the mailing list

One file per talk. Generate an .ics calendar file at build time so people can
subscribe. If we already post talks to events.stanford.edu, tell me what the
Events connector in standards/connectors/events/ says. It is a stub, so do not
build against it without asking.

A static site works out "upcoming" when it is built, so a talk will still show
as upcoming after it happens until the next build. Set up a scheduled daily
rebuild in GitHub Actions; it needs no secrets.

Any recording we post needs captions. If I ask for registration, stop: a form
that collects names and emails changes the compliance tier, and I need to know
what that involves first.`,
    ),
  },
  {
    id: 'course',
    title: 'Course site',
    summary: 'Syllabus, weekly schedule, staff, and accessible materials.',
    goodFor: 'An instructor or TA who wants a public home for a course, outside the learning system.',
    watch: [
      'Readings and slides as HTML pages where possible, because PDFs are a common accessibility gap.',
      'Nothing about individual students on a public site.',
      'Captions on lecture video.',
    ],
    status: 'tested',
    prompt: newSite(
      'Course website',
      'Start a new website for a course, following Stanford Web Services standards.',
      `What I am building: a public site for [course number and title], taught in
[quarter and year] by [instructor].

Pages:
- Home: what the course is, who it is for, prerequisites, and when it meets
- Schedule: week by week, with the topic, readings, and anything due
- Syllabus and course policies
- Staff and office hours
- Materials: lecture notes and slides

Put lecture notes and readings on HTML pages where you can, rather than as
PDFs, because a PDF is much harder to make accessible. Any lecture video needs
captions.

Nothing about individual students goes on this site: no grades, no
submissions, no rosters. Those stay in the course's learning management
system. If I ask for something that would need them, tell me.`,
    ),
  },
  {
    id: 'data-portal',
    title: 'Research data portal',
    summary: 'A landing site for a dataset: what it is, how to get it, how to cite it.',
    goodFor: 'A research team publishing a dataset, a model, or a shared resource.',
    watch: [
      'The first question is whether the data is public. If not, the tier changes and a Data Risk Assessment may be needed.',
      'The site describes and links to the data. It does not host restricted data.',
      'An "ask the data with AI" feature is a third-party service, raised before it is built.',
    ],
    status: 'tested',
    prompt: newSite(
      'Research data portal',
      'Start a website for a research dataset, following Stanford Web Services standards.',
      `Before you run anything: ask me whether every part of this data is public.
If any of it is not, or it involves people, set "collectsPersonalData" or
"regulated" to true in the answers below from what I tell you. Never assume
false. Then tell me what the compliance tier means, and whether a Data Risk
Assessment is likely, before building anything.

What I am building: a site for [dataset or project name], from [lab or unit].

Pages:
- Home: what the data is, who made it, and what it is for, in plain language
- Access: how to download or request it, with the license
- Documentation: what is in it, how it was collected, known limitations
- How to cite it, with a copyable citation
- Team, funding, and contact

The site describes the data and links to it. Do not put restricted data in
this repository or in the build. Add Dataset structured data for search.

If I ask for a way to query the data with AI, stop and tell me what that
involves: it sends visitor input to a third-party service.`,
    ),
  },
  {
    id: 'map-directory',
    title: 'Map and directory',
    summary: 'A searchable list of places or resources, with an optional map.',
    goodFor: 'A program listing sites, partners, facilities, or resources across a region.',
    watch: [
      'The list is the content and the map is the enhancement, so everything on the map is reachable without it.',
      'Map tiles come from a third party, which is a privacy disclosure as well as a performance cost.',
      'Public submissions are a form, so they are raised before they are built.',
    ],
    status: 'tested',
    prompt: newSite(
      'Map and directory',
      'Start a new directory website with a map, following Stanford Web Services standards.',
      `What I am building: a directory of [what is listed] for [unit], with
[about how many] entries.

Pages:
- Home: what the directory is for, and a way to filter it by [category, region]
- The directory: a plain, filterable list of every entry, which works with no
  JavaScript
- One page per entry: name, description, address, contact, link
- The map, as an enhancement on top of the list

The list is the real content. Every entry on the map must also be in the list,
and the map must be operable from the keyboard or skippable. Keep the entries
in one YAML or JSON file.

The map tiles come from a third-party server. Tell me which one you pick and
why, and note that it is a privacy disclosure as well as a performance cost.
If I ask for a way for the public to submit entries, stop: that is a form that
collects personal data, and I need to know what that involves first.`,
    ),
  },
  {
    id: 'other-generator',
    title: 'Jekyll, Quarto, or plain HTML',
    summary: 'Stay with the tool you know. The recipes for these are stubs, and the prompt says so.',
    goodFor: 'Someone who already writes Jekyll or Quarto, or who does not want a build step at all.',
    watch: [
      'These recipes have not been run end to end. The agent tells you that before it starts.',
      'The Identity Bar and the exact Global Footer still apply in full.',
      'Decanter compiles on your machine with a single executable, so you can preview before you push. No Node needed.',
    ],
    status: 'stub',
    prompt: [
      'Start a new Stanford website using [Jekyll / Quarto / plain HTML with no build step], following Stanford Web Services standards.',
      SKILLS,
      init('Website'),
      `Do not follow the astro-static step in "next". The recipe for my generator
is standards/recipes/[jekyll-static / quarto-static / html-static]/RECIPE.md.
It is a stub. Read it, tell me plainly that it has not been tested end to end,
and follow its "What to do now" section. Do not set "recipe" in the manifest to
the stub's name: sws check would stop, because the stub has no acceptance file.

What I am building: [one or two sentences about the site and its pages].

The Identity Bar and the Global Footer must come from standards/fragments/,
exactly. Do not type them from memory. Unit links go in a local footer above
the Global Footer, never inside it.

If we use Decanter, compile it on my machine with Tailwind's standalone CLI,
as html-static/RECIPE.md describes under "Compiling Decanter on the author's
machine", so I can preview changes before I push. It needs no Node. Do not use
the Tailwind Play CDN. If the CLI cannot be installed here, say so, and compile
in GitHub Actions instead.`,
      CONTENT,
      `When the pages are built, run the checks against the built HTML with the
command the stub names, and record any criterion that does not apply to my
generator in .sws/acknowledged.yml with a reason and a review date. Then give
me the score, the three findings most worth fixing, and what is still manual
before launch.`,
    ].join('\n\n'),
  },
  {
    id: 'retrofit',
    title: 'Bring an existing site up to standard',
    summary: 'Add the Global Footer, Identity Bar, and named owners to a site that is already live.',
    goodFor: 'A site someone already built, with an AI tool or by hand, that is missing the Stanford furniture.',
    watch: [
      'Your generator, package manager, and host stay exactly as they are.',
      'Policy furniture first. Decanter is optional and comes last.',
      'Third-party services already on the site are listed for you, not removed.',
    ],
    status: 'stub',
    prompt: `Bring this existing Stanford website up to Stanford Web Services standards,
without rebuilding it.

${SKILLS}

Then, in the root of this repository:

  npx @su-sws/synthetic-web-team add . --json \\
    --answers '{"siteName":"...","unit":"..."}'

If npx cannot reach the registry:

  git clone --depth 1 https://github.com/SU-SWS/synthetic-web-team /tmp/swt
  node /tmp/swt/packages/wizard/bin/wizard.mjs add . --json \\
    --answers '{"siteName":"...","unit":"..."}'

Fill in siteName and unit from this repository. If anything comes back as a
conflict, list those files and stop. Read AGENTS.md and follow it from now on.
Ask me about every field in "incomplete" rather than inventing an owner name or
email.

Then follow standards/recipes/add-to-existing/RECIPE.md. It is a stub, so tell
me that, and keep to these rules:

- Do not change my generator, my package manager, or my host.
- Run sws check before changing anything, so I can see the starting score.
- Replace any hand-built Global Footer and Identity Bar with the ones from
  standards/fragments/, exactly. Unit links move to a local footer above it.
- Make the business owner and technical administrator visible on the site.
- Add the checks to CI on push to main. Do not make pull requests required.
- List any third-party services the site already uses, and what each one
  handles. Do not remove them; tell me what standards/patterns/bolt-ons.md
  says about each.
- Do not add Decanter unless I ask.

Finish by running sws check again and giving me the score before and after.`,
  },
];
