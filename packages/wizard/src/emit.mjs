// File emission.
//
// Four rules that shape everything here:
//
// 1. Per-editor files are THIN POINTERS, never content copies. There is then no
//    place for content to diverge, and no reason to regenerate anything later.
// 2. Every emitted file is self-sufficient about being a pointer, because
//    precedence and merge order are not uniform across editors and layering
//    cannot be relied on.
// 3. AGENTS.md, CLAUDE.md and GEMINI.md are SHARED files. Next.js writes the
//    same ones, and a project has its own rules in them. So the contract is a
//    marked block merged into AGENTS.md, and CLAUDE.md only has to import it.
//    Replacing the whole file dropped a project's Next.js block and its own
//    rules, and reported that as `updated`.
// 4. Everything else this tool writes in a project lives under .sws/. The root
//    of a repository belongs to the team, and a `standards/` folder they did
//    not ask for, next to their own source, is clutter. Nothing is written into
//    .claude/ either: many teams git-ignore it, so a committed file that points
//    there works on one machine and breaks for everyone else.

import {
  existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync,
  lstatSync, realpathSync, readlinkSync, renameSync, rmSync, rmdirSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve, sep } from 'node:path';

// Where a project's vendored standards live.
export const STANDARDS_DIR = '.sws/standards';

// Layouts an earlier version wrote, and where those files live now. A re-run
// moves every file the install record lists; see migrate().
const MOVED = [['standards/', `${STANDARDS_DIR}/`]];

// The markers around the contract in AGENTS.md, in the shape Next.js uses for
// its own block, so the two sit in one file without either touching the other.
export const CONTRACT_BEGIN = '<!-- BEGIN:sws-agent-contract -->';
export const CONTRACT_END = '<!-- END:sws-agent-contract -->';

// The heading every version of the contract before the markers opened with.
// Finding it with no markers means an old copy sits in the file next to the
// project's own content, and nothing says where ours ends.
const LEGACY_CONTRACT_HEADING = '# Stanford Web Services: agent contract';

// CLAUDE.md and GEMINI.md: byte for byte what create-next-app writes, so the
// two tools stop rewriting each other's file.
export const IMPORT = '@AGENTS.md\n';

// The comment earlier versions wrote above the import, kept verbatim so a
// re-run can recognise it and take it out. It named .claude/skills/, which is a
// path in a directory many teams git-ignore, and the skills are not in the
// project any more anyway.
const LEGACY_POINTER_COMMENT = `<!--
  Stanford Web Services agent team.

  This file is a POINTER, not content. The behavioral contract is AGENTS.md,
  and the team is in .agents/skills/ and .claude/skills/.

  Editing this file will not change how the agent behaves. Edit AGENTS.md.
-->
`;

// The two paths skills are read from. Neither is read by every editor, so two
// copies is the floor rather than a design flaw -- see docs/skill-paths.md.
export const SKILL_TARGETS = ['.agents/skills', '.claude/skills'];

const skillNames = (source) => readdirSync(join(source, 'skills'))
  .filter((d) => existsSync(join(source, 'skills', d, 'SKILL.md')));

export function plan({ root, source, editors, answers, tier, scope = 'project' }) {
  const files = [];
  const add = (path, contents, note, opts = {}) => files.push({ path, contents, note, ...opts });

  // ---- user scope: the skills, and nothing else ---------------------------
  //
  // Paths stay RELATIVE. The only thing separating a user install from a project
  // one is the `root` they are written under -- a home directory or a repository
  // -- so every hash, verdict and record mechanism below serves both with no
  // second implementation.
  //
  // Nothing per-site is emitted here, because at this point there is no site.
  if (scope === 'user') {
    for (const target of SKILL_TARGETS) {
      for (const name of skillNames(source)) {
        add(`${target}/${name}/SKILL.md`,
          readFileSync(join(source, 'skills', name, 'SKILL.md'), 'utf8'), null);
      }
    }
    return files;
  }

  // ---- project scope: the contract, the standards, the per-site record ----
  //
  // NO SKILLS HERE. They install once into the person's tool instead, because
  // they are byte-identical in every repository and referencing them in place is
  // not available: most editors that read .agents/skills offer no configurable
  // path to redirect. See docs/skill-paths.md and docs/two-part-install.md.
  add('AGENTS.md', contract(source),
    'behavioral contract, between markers; the rest of the file is yours', {
      merge: 'block', markers: [CONTRACT_BEGIN, CONTRACT_END], legacyHeading: LEGACY_CONTRACT_HEADING,
      adds: 'the contract, between sws-agent-contract markers',
    });

  const skills = skillNames(source);

  // Standards, vendored so the project is self-contained and reviewable.
  const walk = (d, base) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p, `${base}/${n}`);
      else add(`${base}/${n}`, readFileSync(p, 'utf8'), null);
    }
  };
  walk(join(source, 'standards'), STANDARDS_DIR);

  // PROJECT STATE, NOT CONTENT. These two accumulate real answers, resolved
  // versions, recorded divergences, and accepted risks with review dates. They
  // are never overwritten once they exist.
  //
  // This was a data-loss bug, and an agent-shaped one: a re-run "to be sure the
  // install happened" replaced real business-owner and technical-administrator
  // emails with nulls. MinWeb requires both to be identifiable, so the wizard
  // was quietly undoing the one thing it exists to record. Everything else here
  // is content and is safe to rewrite.
  add('.sws/manifest.yml', manifestYaml({ answers, tier, editors, skills: skills.length }),
    'what this project is, and what was decided', { preserve: true });
  add('.sws/acknowledged.yml', ACKNOWLEDGED_TEMPLATE,
    'accepted risks, with reasons and review dates', { preserve: true });

  // ---- per editor, thin pointers only -------------------------------------
  //
  // A pointer names AGENTS.md and .sws/ and nothing else. Skills are installed
  // per machine, so a committed file has nothing true to say about where they
  // live, and the place it used to name was .claude/.
  //
  // Most of these are files a project may already have for its own reasons,
  // so they are ADDED TO, never written: see SHARED. Only the rules files under
  // our own name (.cursor/rules/sws.mdc, .devin/rules/sws.md) are whole files.
  for (const e of editors) {
    for (const f of e.emits) {
      if (files.some((x) => x.path === f)) continue;
      if (SHARED[f]) {
        const { contents, ...opts } = SHARED[f];
        add(f, contents, `for ${e.label}`, opts);
        continue;
      }
      const c = pointerFor(f);
      if (c !== null) add(f, c, `for ${e.label}`);
    }
  }

  return files;
}

// --- shared files, and what we add to each ---------------------------------

// The MCP server, wired up and nothing else.
//
// This used to emit an empty shell, on the reasoning that the wizard cannot
// know which servers a person is entitled to use. That still holds for third
// parties -- a wrong entry produces confusing tool failures -- but it does not
// hold for @su-sws/synthetic-web-team-mcp, which is ours, optional, and read-only apart from
// sws_scaffold (which itself defaults to a dry run).
//
// The server is a SECOND entry point, never a requirement: everything it
// exposes is also a file in .sws/standards/ that the agent can read directly.
// If the client cannot start it, nothing else stops working.
const SERVER_NAME = 'sws';
const SERVER = { command: 'npx', args: ['-y', '@su-sws/synthetic-web-team-mcp'] };

const MD_POINTER = ['<!-- BEGIN:sws-pointer -->', '<!-- END:sws-pointer -->'];
const TOML_POINTER = ['# BEGIN:sws-pointer', '# END:sws-pointer'];

// What every release before the markers wrote as the whole file, verbatim, so
// a re-run can find it inside a file that has grown around it and replace
// exactly that.
const OLD_COPILOT = `<!-- Pointer. The contract is AGENTS.md; skills are in .claude/skills/. -->

Follow the Stanford Web Services agent contract in \`AGENTS.md\` at the repository
root, and the standards in \`standards/\`.

Non-negotiables: WCAG 2.1 AA, the Global Footer is immutable
(\`standards/fragments/global-footer.yml\`), never commit credentials.
`;
const OLD_CODEX = `# Stanford Web Services. AGENTS.md and .agents/skills/ are read automatically.
#
# Optional: the SWS MCP server, a second entry point to the same standards.
# [mcp_servers.sws]
# command = "npx"
# args = ["-y", "@su-sws/synthetic-web-team-mcp"]
`;

function pointerBlock([begin, end], body, legacyText, { fences = true } = {}) {
  return {
    contents: `${begin}\n${body}\n${end}`, merge: 'block', markers: [begin, end], legacyText, fences,
    adds: 'a pointer to AGENTS.md, between sws-pointer markers',
  };
}

function mcpServer(key, entry, extra = {}) {
  return {
    contents: `${JSON.stringify({ [key]: { [SERVER_NAME]: entry } }, null, 2)}\n`,
    part: canonical(entry), merge: 'mcp', key, entry, ...extra,
    adds: 'the sws MCP server, next to yours',
  };
}

const SHARED = {
  // Only for the tools that do not read AGENTS.md themselves, and only the import.
  'CLAUDE.md': { contents: IMPORT, merge: 'import', adds: 'the line @AGENTS.md' },
  'GEMINI.md': { contents: IMPORT, merge: 'import', adds: 'the line @AGENTS.md' },

  // Also what Copilot code review reads on a pull request.
  '.github/copilot-instructions.md': pointerBlock(MD_POINTER, `Follow the Stanford Web Services agent contract in \`AGENTS.md\` at the repository
root, and the standards in \`.sws/standards/\`.

Non-negotiables: WCAG 2.1 AA, the Global Footer is immutable
(\`.sws/standards/fragments/global-footer.yml\`), never commit credentials.`, [OLD_COPILOT]),

  '.codex/config.toml': pointerBlock(TOML_POINTER, `# Stanford Web Services. Codex reads AGENTS.md automatically.
#
# Optional: the SWS MCP server, a second entry point to the same standards.
# [mcp_servers.sws]
# command = "npx"
# args = ["-y", "@su-sws/synthetic-web-team-mcp"]`, [OLD_CODEX], { fences: false }),

  '.mcp.json': mcpServer('mcpServers', SERVER),
  '.cursor/mcp.json': mcpServer('mcpServers', SERVER),
  '.agents/mcp_config.json': mcpServer('mcpServers', SERVER),
  // VS Code's key is `servers`. Earlier versions wrote `mcpServers` here, which
  // VS Code does not read, so that entry is moved across when it is ours.
  '.vscode/mcp.json': mcpServer('servers', { type: 'stdio', ...SERVER }, { legacyKey: 'mcpServers', legacyEntry: SERVER }),
};

// The contract as it ships: the marked block from this package's own AGENTS.md,
// markers included. Anything outside the markers there is about this repository
// and stays behind. Line endings are normalised so the hash is the same on
// every platform.
export function contract(source) {
  const text = lf(readFileSync(join(source, 'AGENTS.md'), 'utf8'));
  const found = findBlock(text);
  return found
    ? text.slice(found.start, found.end)
    : `${CONTRACT_BEGIN}\n${text.trimEnd()}\n${CONTRACT_END}`;
}

function pointerFor(path) {
  if (path === '.cursor/rules/sws.mdc') {
    // .mdc is mandatory here; a .md file is silently ignored by Cursor.
    return `---
description: Stanford Web Services standards
alwaysApply: true
---

Follow the agent contract in \`AGENTS.md\` at the repository root. Standards are
in \`.sws/standards/\`.

Non-negotiables: WCAG 2.1 AA, the Global Footer is immutable
(\`.sws/standards/fragments/global-footer.yml\`), never commit credentials.
`;
  }

  if (path === '.devin/rules/sws.md') {
    return `---
trigger: always_on
description: Stanford Web Services standards
---

Follow the agent contract in \`AGENTS.md\`. Standards are in \`.sws/standards/\`.
`;
  }
  return null;
}

function manifestYaml({ answers, tier, editors, skills }) {
  const q = (s) => (s ? JSON.stringify(String(s)) : 'null');
  return `# What this project is, and what was decided when it was set up.
# Read by sws-onboard and the sws CLI. Safe to edit by hand.

standards_version: 0.1.0
recipe: ${answers.recipe}
created: ${new Date().toISOString().slice(0, 10)}

# Compliance tier, DERIVED from what the site handles rather than chosen.
# Changing what the site does can change the tier. Adding a form that collects
# personal data, an authentication flow, or a payment processor is a TIER
# CHANGE, not a feature.
tier: ${tier.tier}
tier_because: ${q(tier.because)}

site:
  name: ${q(answers.siteName)}
  unit: ${q(answers.unit)}
  purpose: ${q(answers.purpose)}
  url: ${q(answers.url)}

# MinWeb requires both, discoverable on the site, with valid Stanford affiliation.
owners:
  business:
    name: ${q(answers.businessOwnerName)}
    email: ${q(answers.businessOwnerEmail)}
  technical:
    name: ${q(answers.techAdminName)}
    email: ${q(answers.techAdminEmail)}

# WHERE THIS SITE IS SERVED. SWS runs BOTH Netlify and Vercel, one per family,
# so neither is a divergence -- pick whichever the unit already administers.
# Profiles, with what each host does and does not cover:
# .sws/standards/hosting/. Leave provider null until the choice is made.
#
# Recording this matters more than it looks. Until 2026-09-03 this project
# believed Netlify was the only SWS host, because hosting was inferred from
# package.json and package.json does not record a deploy target.
hosting:
  provider: null          # github-pages | netlify | vercel
  production_url: null    # the approved Stanford subdomain, NOT a *.vercel.app
                          # or *.netlify.app preview domain
  dashboard_mfa: null     # set to the date MFA was confirmed on the host account.
                          # MinWeb's "MFA on all administrative logins" includes
                          # the hosting dashboard, which is the most-missed item.
  csp: false              # OPTIONAL and off by default. A CSP breaks pages at
                          # content-edit time, so if you enable it, record it in
                          # divergences and name who owns the breakage.

# Required for public-facing Stanford sites. Google Analytics is NOT required.
siteimprove:
  registered: null   # set to the date once the intake form is submitted

# Set by the ODA accessibility review, which is a pre-launch gate with a lead time.
accessibility:
  standard: WCAG 2.1 AA
  oda_review_requested: null

editors:
${editors.map((e) => `  - ${e.id}`).join('\n') || '  []'}

# Skills are installed at USER scope (~/.claude/skills, ~/.agents/skills), once
# per machine, not into this project. This is the count that was available when
# this project was set up, recorded as provenance -- it is not a count of files
# in this repository, and nothing reads it as one.
skills_available_at_install: ${skills}

# What actually resolved at install time. Recorded, never enforced: recipes
# install latest and pin nothing, so this is provenance rather than a gate.
resolved:
  node: ${q(process.versions.node)}

# Where content comes from. This package is scoped to static content authored in
# the repo: no CMS, not Storyblok, not decoupled Drupal. See .sws/standards/scope.md.
# A CMS is not a divergence you can record here -- it is out of scope, which is
# a different thing. If a project needs one, raise it rather than recording it.
content:
  source: repo
  cms: none

# What was reused from existing SWS work, so the next person can trace it.
prior_art: []

# Deliberate departures from the recipe. Each needs a reason. Silent divergence
# is the only kind that is a problem. See the sws-diverge skill.
divergences: []
`;
}

const ACKNOWLEDGED_TEMPLATE = `# Accepted risks.
#
# When a finding cannot be fixed now, record it here rather than ignoring it.
# It then moves out of the nag and into an "accepted risks" section of the
# report, and it still counts toward the score with the total annotated.
#
# This is the same shape a MinSec temporary exception takes, so the record is
# useful beyond this tool. Expired review dates resurface once.
#
# - check: a11y.contrast
#   path: src/components/Legacy.astro
#   reason: Vendor widget; contrast fix requested from vendor 2026-08-04
#   accepted_by: you@stanford.edu
#   date: 2026-08-11
#   review_by: 2026-11-10

[]
`;

/**
 * Write, and report what happened to each file.
 *
 * THIS IS ALSO THE UPDATE MECHANISM. There is no separate `sws update`: a
 * re-install IS the update, because the content is vendored into the project
 * rather than resolved at runtime. That only works safely if three things are
 * true, and each is a per-file verdict below.
 *
 *   preserved  Project state is never overwritten. `.sws/manifest.yml` and
 *              `.sws/acknowledged.yml` accumulate real owners, resolved
 *              versions, recorded divergences and accepted risks. An earlier
 *              version of this function replaced real business-owner emails
 *              with nulls on a re-run, which is the one thing the wizard exists
 *              to record.
 *
 *   conflict   A file the user EDITED is never silently overwritten. Detected by
 *              comparing against `.sws/installed.json`, a record of the hashes
 *              this tool last wrote. If the file on disk no longer matches that
 *              record, the edit was somebody's deliberate work, and an update
 *              that discards it is data loss with extra steps. Reported and
 *              skipped; `force` overrides.
 *
 *   orphan     A file that this tool wrote before and no longer ships is
 *              reported, NOT deleted. Deleting files in someone else's
 *              repository on the strength of a version bump is not a risk worth
 *              taking for tidiness.
 *
 * Two more for shared files, which hold the project's content as well as ours:
 *
 *   merged     Our part was added to a file that already had other content:
 *              the contract block appended to the project's own AGENTS.md, or
 *              the import added to its CLAUDE.md. Their content is untouched.
 *              For these files the record holds the hash of OUR part only.
 *
 *   moved      A file an earlier version wrote somewhere else, `standards/` at
 *              the root, now under .sws/. Listed separately in the result.
 *
 * Comparison is by content, never mtime: re-running the same version must be
 * `unchanged` even though the source files have newer timestamps.
 *
 * Never through a symbolic link. `CLAUDE.md -> AGENTS.md` is a common setup,
 * and writing the import through it would replace the contract with a line that
 * imports itself.
 */
export function write(root, files, { force = false, version = null, scope = 'project' } = {}) {
  const prev = readInstalled(root);
  let planned = new Set(files.map((f) => f.path));

  // Moves first, so the loop below finds each file where it lives now, with the
  // hash that tells an edit from an old version carried across with it.
  const { moved, carried, deferred } = scope === 'project'
    ? migrate(root, prev, planned, { force })
    : { moved: [], carried: {}, deferred: null };

  // A move that has to wait: this run updates the standards where they are.
  if (deferred) {
    files = files.map((f) => (f.path.startsWith(deferred.to)
      ? { ...f, path: deferred.from + f.path.slice(deferred.to.length) } : f));
    planned = new Set(files.map((f) => f.path));
  }
  const record = { ...carried, ...(prev?.files ?? {}) };

  const results = [];
  const nextHashes = {};
  const agents = join(root, 'AGENTS.md');

  for (const f of files) {
    const p = join(root, f.path);
    // For a shared file this is the hash of OUR part, which is what the record
    // keeps for it: the rest of the file is the project's.
    const newHash = hash(f.part ?? f.contents);
    const recorded = record[f.path];
    const st = lstatSync(p, { throwIfNoEntry: false });
    let status;
    let reason;
    let contents = f.contents;
    let target = p;

    if (!resolvesInside(root, p)) {
      // A parent directory that is a link out of the project. The checks below
      // look at the file itself; this one stops a write landing somewhere else
      // entirely, through `.sws/` or `.github/` linked to a shared folder.
      status = 'conflict';
      reason = 'outside';
    } else if (f.merge && f.path !== 'AGENTS.md' && sameFile(p, agents)) {
      // This file and AGENTS.md are one file, linked either way round, as with
      // CLAUDE.md or .github/copilot-instructions.md -> AGENTS.md. It already
      // holds the contract, and adding our part would put an import, or a
      // pointer to AGENTS.md, inside AGENTS.md itself.
      status = 'unchanged';
    } else if (st?.isSymbolicLink()) {
      // Never written through, with one exception: the contract, into a file
      // inside the project, as when AGENTS.md links to CLAUDE.md. A merge only
      // adds our part, so it lands in the file the tools read. Pointer blocks
      // and MCP configs never follow a link.
      const real = f.path === 'AGENTS.md' ? fileInside(root, p) : null;
      if (real) {
        const m = MERGE.block(readFileSync(real, 'utf8'), f, { recorded, force });
        ({ status, reason } = m);
        if (m.text !== undefined) contents = m.text;
        target = real;
      } else {
        status = 'conflict';
        reason = 'symlink';
      }
    } else if (f.merge) {
      const m = MERGE[f.merge](st ? readFileSync(p, 'utf8') : null, f, { recorded, force });
      ({ status, reason } = m);
      if (m.text !== undefined) contents = m.text;
    } else if (!st) {
      status = 'created';
    } else {
      const local = readFileSync(p, 'utf8');
      if (f.preserve) status = 'preserved';
      else if (local === f.contents) status = 'unchanged';
      else {
        // No record means we cannot tell an edit from an old version, so the
        // safe default is to update. Conflict detection needs evidence.
        const edited = recorded !== undefined && hash(local) !== recorded;
        status = edited && !force ? 'conflict' : 'updated';
      }
    }

    if (status === 'created' || status === 'updated' || status === 'merged') {
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(target, contents);
      nextHashes[f.path] = newHash;
    } else if (f.merge && status === 'unchanged') {
      // Our part, not the whole file: the rest belongs to the project.
      nextHashes[f.path] = newHash;
    } else if (status === 'conflict') {
      // Keep the hash of what we LAST WROTE, never what is on disk now.
      //
      // Recording the edited file as though we had written it made the conflict
      // disappear on the following run -- and the protection with it, so the run
      // after that reported `updated` and overwrote the edit. Verified before
      // this change: an edited 7356-byte skill came back as the canonical 7355
      // bytes on run three, silently. That contradicted this function's own
      // contract, which is that an edited file is never silently overwritten.
      //
      // So a conflict is sticky until the file matches what we ship again. That
      // is already how orphans behave a few lines below, for the same stated
      // reason: a one-shot warning is easy to miss, and an agent discards the
      // output entirely. It is also what makes `remove()` safe, since the record
      // stays a description of OUR content rather than drifting onto theirs.
      //
      // A conflict with no record behind it records nothing. A shared file can
      // conflict on its very first run (an MCP config with comments), and
      // recording what we WOULD have written read, on the next run, as proof
      // that we had written it and someone removed it, so the server was never
      // added once the comments were gone.
      if (recorded !== undefined) nextHashes[f.path] = recorded;
    } else {
      nextHashes[f.path] = existsSync(p) ? hash(readFileSync(p, 'utf8')) : newHash;
    }
    results.push({ path: f.path, status, ...(reason ? { reason } : {}) });
  }

  // A moved file's old path no longer exists, so it drops out of the record
  // here rather than reporting as an orphan.
  const orphans = Object.keys(prev?.files ?? {}).filter((x) => !planned.has(x) && existsSync(join(root, x)));

  // Keep orphans in the record while the file still exists, so they are reported
  // on EVERY run rather than once. A one-shot warning is easy to miss -- an agent
  // discards the output, a human scrolls past it -- and then a stale standard
  // sits in the project looking authoritative. Same instinct as resurfacing an
  // expired `review_by` date: the nag stops when the situation is resolved, not
  // when it has been seen once.
  for (const x of orphans) nextHashes[x] = prev.files[x];

  writeInstalled(root, { version, files: nextHashes, scope });

  const count = (s) => results.filter((r) => r.status === s).length;
  return {
    results,
    orphans,
    moved,
    deferred,
    previousVersion: prev?.version ?? null,
    created: count('created'),
    updated: count('updated'),
    unchanged: count('unchanged'),
    preserved: count('preserved'),
    merged: count('merged'),
    conflicts: results.filter((r) => r.status === 'conflict').map((r) => r.path),
  };
}

// What a re-run would move, or why it would wait, for a dry run, which writes
// nothing.
export function plannedMigration(root, files, { force = false } = {}) {
  const { moved, deferred } = migrate(root, readInstalled(root), new Set(files.map((f) => f.path)), { dryRun: true, force });
  return { moved, deferred };
}

/**
 * Move what an earlier version wrote to where this one writes it.
 *
 * Driven by the install record only, the same rule `remove()` follows: a
 * `standards/` folder with no record behind it may be the team's own, so it is
 * never touched. For each file the record lists under an old prefix:
 *
 *   - the record entry is carried to the new path, so an edit made before the
 *     move is still told apart from an old version after it
 *   - the file is RENAMED, never rewritten, so a local edit travels with it and
 *     reports as a conflict at its new path, as it would have at the old one
 *   - if the new path already exists (a move by hand, as in the first pilot),
 *     the old copy is deleted only when its hash proves it is ours and
 *     unedited; otherwise it stays and reports as an orphan
 *   - a file this version no longer ships is left where it is, an orphan like
 *     any other
 *
 * Emptied directories are pruned afterwards, so a `standards/` that held only
 * our files disappears and one that also holds the team's own survives.
 *
 * NOT WHILE THE PROJECT'S OWN CODE READS THE OLD PATH. The recipe tells a site
 * to generate its Global Footer from `standards/fragments/global-footer.yml`,
 * so moving the file out from under it fails that site's next build, and the
 * push after that deploys nothing. The sites this would break are exactly the
 * ones that followed the rule. So references are looked for first, and if any
 * turn up the whole move waits: this run keeps the standards current where they
 * are, and reports each reference so it can be pointed at .sws/standards/.
 * `force` moves them regardless.
 */
function migrate(root, prev, planned, { dryRun = false, force = false } = {}) {
  const pending = [];
  const carried = {};
  for (const [rel, recorded] of Object.entries(prev?.files ?? {})) {
    const rule = MOVED.find(([from]) => rel.startsWith(from));
    if (!rule) continue;
    const to = rule[1] + rel.slice(rule[0].length);
    if (!planned.has(to)) continue;
    carried[to] = recorded;
    if (existsSync(join(root, rel))) pending.push({ from: rel, to, recorded });
  }

  if (pending.length && !force) {
    const references = findReferences(root, pending, planned);
    if (references.length) {
      return { moved: [], carried: {}, deferred: { files: pending.length, from: MOVED[0][0], to: MOVED[0][1], references } };
    }
  }

  const moved = [];
  for (const { from, to, recorded } of pending) {
    const src = join(root, from);
    const dest = join(root, to);
    // Both ends must resolve inside the project, parents included. A
    // `standards/` replaced by a link to a shared folder would otherwise have
    // its files renamed out of that folder. Such a file is left where it is,
    // and reports as an orphan.
    if (!resolvesInside(root, src) || !resolvesInside(root, dest)) continue;
    if (existsSync(dest)) {
      if (hash(readFileSync(src, 'utf8')) !== recorded) continue;
      if (!dryRun) rmSync(src);
    } else if (!dryRun) {
      mkdirSync(dirname(dest), { recursive: true });
      renameSync(src, dest);
    }
    moved.push({ from, to });
  }
  if (!dryRun) pruneEmpty(root, moved.map((m) => m.from));
  return { moved, carried, deferred: null };
}

// Everything that could break when the files move, which is every text file
// except prose: a build can read the footer from a Python or shell step, a Ruby
// plugin or a Makefile as easily as from JavaScript, and the Jekyll and Quarto
// stubs describe exactly those routes. A README that still says `standards/` is
// out of date, which is worth fixing, but it fails no build. Binaries are
// skipped by extension, and by a NUL byte for anything the list misses.
const PROSE_FILES = /\.(md|markdown|txt|rst|adoc)$/i;
const BINARY_FILES = /\.(png|jpe?g|gif|webp|avif|ico|svgz|woff2?|ttf|otf|eot|pdf|zip|gz|tgz|mp3|mp4|webm|mov|wasm)$/i;
const SKIP_ANYWHERE = new Set(['node_modules', '.git', 'dist', 'build', 'out', '_site', '.next', '.astro',
  '.netlify', '.vercel', '.turbo', '.cache', 'coverage']);
const SKIP_AT_ROOT = new Set(['.sws', 'standards']);

function findReferences(root, pending, ours) {
  const re = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // The entries actually being moved, `fragments`, `policy`, `scope.md`...,
  // so an unrelated `standards/` path of the team's own does not count.
  const entries = [...new Set(pending.map((m) => m.from.split('/')[1]))].map(re).join('|');
  // Matched against the WHOLE file, so a call formatted across lines still
  // counts: `\s*` spans newlines. Each match is mapped back to the line it
  // starts on.
  const patterns = [
    // standards/fragments/..., ../standards/..., `${root}/standards/...`
    new RegExp(`(?<!\\.sws[\\\\/])(?<![\\w.-])standards[\\\\/](?:${entries})(?![\\w-])`, 'g'),
    // join('standards', 'fragments', ...), the way this package's own site does it
    new RegExp(`(?<!['"]\\.sws['"]\\s*,\\s*)['"]standards['"]\\s*,\\s*['"](?:${entries})['"\\\\/]`, 'g'),
    // sws check --standards standards
    /--standards[= ](?:\.\/)?standards(?![\w./-])/g,
  ];

  // A link into the files being moved, such as Jekyll's
  // `_data/global-footer.yml -> ../standards/fragments/global-footer.yml`, is
  // left dangling by the move. Read as text, so a link that is already dangling
  // still counts, and through realpath for one that goes via another link.
  const oldDir = pending[0].from.split('/')[0];
  const intoOld = (p) => {
    const under = (base, x) => x.startsWith(join(base, oldDir) + sep);
    try { if (under(root, resolve(dirname(p), readlinkSync(p)))) return true; } catch { /* unreadable */ }
    try { return under(realpathSync(root), realpathSync(p)); } catch { return false; }
  };

  const hits = [];
  (function walk(dir, rel) {
    for (const n of readdirSync(dir)) {
      if (SKIP_ANYWHERE.has(n) || (!rel && SKIP_AT_ROOT.has(n))) continue;
      const p = join(dir, n);
      const r = rel ? `${rel}/${n}` : n;
      const st = lstatSync(p, { throwIfNoEntry: false });
      if (!st) continue;
      if (st.isSymbolicLink()) {
        if (intoOld(p)) hits.push({ file: r, line: null, text: `-> ${readlinkSync(p)}` });
        continue;
      }
      if (st.isDirectory()) { walk(p, r); continue; }
      if (PROSE_FILES.test(n) || BINARY_FILES.test(n) || ours.has(r) || st.size > 512 * 1024) continue;
      const buf = readFileSync(p);
      if (buf.subarray(0, 8000).includes(0)) continue;
      const text = buf.toString('utf8');
      const lines = text.split('\n');
      const at = new Set();
      for (const x of patterns) {
        for (const m of text.matchAll(x)) at.add(text.slice(0, m.index).split('\n').length);
      }
      for (const n of [...at].sort((a, b) => a - b)) {
        hits.push({ file: r, line: n, text: lines[n - 1].trim().slice(0, 160) });
      }
    }
  })(root, '');
  return hits;
}

// --- shared files ------------------------------------------------------------
//
// Each merge takes the file as it is on disk (null if absent) and the planned
// entry, and returns a status plus the new text when there is something to
// write. Our part is upserted and nothing else in the file is touched. Text is
// worked on in LF and the file's own line endings are put back, so a CRLF
// checkout does not come back with every line changed.

const MERGE = { block: mergeBlock, import: mergeImport, mcp: mergeMcp };

// A marked block in a text file: the contract in AGENTS.md, the pointer in
// .github/copilot-instructions.md and .codex/config.toml.
function mergeBlock(local, f, { recorded, force }) {
  const block = f.contents;
  const [begin, end] = f.markers;
  if (local === null) return { status: 'created', text: `${block}\n` };
  const eol = eolOf(local);
  const text = lf(local);
  const out = (s, status) => ({ status, text: withEol(s, eol) });

  const found = findBlock(text, begin, end, { fences: f.fences !== false });
  if (found) {
    const current = text.slice(found.start, found.end);
    if (current === block) return { status: 'unchanged' };
    // Same evidence rule as every other file: an edit is only an edit if the
    // record says what we wrote and the block no longer matches it.
    if (recorded !== undefined && hash(current) !== recorded && !force) {
      return { status: 'conflict', reason: 'edited' };
    }
    return out(text.slice(0, found.start) + block + text.slice(found.end), 'updated');
  }

  // No markers, and the whole file is exactly what an earlier version wrote:
  // it was all ours, so it becomes the block.
  if (recorded !== undefined && hash(local) === recorded) return out(`${block}\n`, 'updated');

  // An earlier version's whole file, found verbatim inside one that has grown
  // around it. We know exactly where ours starts and ends, so it is replaced in
  // place and everything around it stays.
  for (const old of f.legacyText ?? []) {
    const i = text.indexOf(old);
    if (i !== -1) return out(`${text.slice(0, i)}${block}\n${text.slice(i + old.length)}`, 'updated');
  }

  // An old copy of the contract with no markers, next to other content, so
  // nothing says where ours ends. Never guessed without being told to: --force
  // replaces from the old heading to the next top-level heading or managed
  // block, or the end of the file, and keeps everything before it.
  const legacy = f.legacyHeading && findLegacySection(text, f.legacyHeading);
  if (legacy) {
    if (!force) return { status: 'conflict', reason: 'legacy-contract' };
    const after = text.slice(legacy.end);
    return out(`${text.slice(0, legacy.start)}${block}\n${after ? `\n${after}` : ''}`, 'updated');
  }

  // The project's own file. Ours goes after it, one blank line between, as
  // Next.js does with its block in AGENTS.md.
  const sep = text === '' || text.endsWith('\n') ? '\n' : '\n\n';
  return out(`${text}${sep}${block}\n`, text === '' ? 'updated' : 'merged');
}

// The sws server in an MCP config, next to whatever servers the project has.
//
// Their servers, their other keys and their indentation are kept. The JSON
// round-trip does normalise the rest of the layout, the same cost
// ensureDevDependency() takes with package.json, so a file that already has our
// entry is never rewritten just to reformat it.
//
// Two cases are deliberately left alone:
//   - a file that is not plain JSON. VS Code allows comments in mcp.json, and
//     parsing loosely then writing back would strip them. Reported, not merged.
//   - an sws entry, or the whole file, the project REMOVED after we added it.
//     The server is optional and the install says to remove it if unwanted,
//     so putting it back on every update would be the tool overruling a
//     decision. The first pilot deleted its .mcp.json; the next run made it
//     again. --force puts it back.
function mergeMcp(local, f, { recorded, force }) {
  if (local === null && recorded !== undefined && !force) return { status: 'unchanged', reason: 'removed' };
  if (local === null || local.trim() === '') {
    return { status: local === null ? 'created' : 'updated', text: f.contents };
  }
  if (local === f.contents) return { status: 'unchanged' };
  // Exactly what an earlier version wrote: all ours, so it takes today's shape.
  if (recorded !== undefined && hash(local) === recorded) return { status: 'updated', text: f.contents };

  let json;
  try { json = JSON.parse(local); } catch { return { status: 'conflict', reason: 'unparseable' }; }
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(json) || (json[f.key] !== undefined && !isObj(json[f.key]))) {
    return { status: 'conflict', reason: 'unparseable' };
  }

  // Our entry under the key an earlier version used, unedited: moved across.
  let moved = false;
  if (f.legacyKey && isObj(json[f.legacyKey]) && canonical(json[f.legacyKey][SERVER_NAME]) === canonical(f.legacyEntry)) {
    const { [SERVER_NAME]: _ours, ...rest } = json[f.legacyKey];
    json = { ...json };
    if (Object.keys(rest).length) json[f.legacyKey] = rest;
    else delete json[f.legacyKey];
    moved = true;
  }

  const servers = json[f.key] ?? {};
  const current = servers[SERVER_NAME];
  if (current !== undefined && canonical(current) === f.part && !moved) return { status: 'unchanged' };
  if (current === undefined && recorded !== undefined && !moved && !force) {
    return { status: 'unchanged', reason: 'removed' };
  }
  // An sws entry that differs from ours is the project's own (a pinned version,
  // a local path) unless the record proves it is an older entry of ours. In a
  // file that is theirs, keeping theirs is the safe default.
  if (current !== undefined && canonical(current) !== f.part && !force
    && !(recorded !== undefined && hash(canonical(current)) === recorded)) {
    return { status: 'conflict', reason: 'edited' };
  }

  const next = { ...json, [f.key]: { ...servers, [SERVER_NAME]: f.entry } };
  const indent = local.match(/\n([ \t]+)"/)?.[1] ?? '  ';
  const body = JSON.stringify(next, null, indent);
  const text = withEol(/\n\s*$/.test(lf(local)) ? `${body}\n` : body, eolOf(local));
  return { status: current === undefined && !moved ? 'merged' : 'updated', text };
}

// JSON with sorted keys, so an entry someone reformatted or reordered still
// compares equal to ours.
function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v !== null && typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

function mergeImport(local) {
  if (local === null) return { status: 'created', text: IMPORT };
  const eol = eolOf(local);
  let text = lf(local);

  const i = text.indexOf(LEGACY_POINTER_COMMENT);
  if (i !== -1) {
    text = text.slice(0, i) + text.slice(i + LEGACY_POINTER_COMMENT.length).replace(/^\n+/, '');
  }

  let status = 'updated';
  if (!/^@AGENTS\.md[ \t]*$/m.test(text)) {
    if (text.trim() === '') text = IMPORT;
    else {
      // Their own CLAUDE.md. The import is added and nothing else changes.
      text = `${text}${text.endsWith('\n') ? '' : '\n'}\n${IMPORT}`;
      status = 'merged';
    }
  }
  const next = withEol(text, eol);
  return next === local ? { status: 'unchanged' } : { status, text: next };
}

// A marker counts only on a line of its own. Prose that MENTIONS one, like a
// README sentence explaining the markers, is never mistaken for the block:
// treating it as one replaced part of that sentence with the contract.
//
// In Markdown, not inside a fenced code example either (``` or ~~~, closed by
// the same character at least as many times). An example of the markers in
// someone's AGENTS.md was otherwise taken for the real block, and the contract
// went inside the fence. TOML has no fences, so .codex/config.toml passes
// `fences: false` and every standalone line counts.
//
// Only a fence that CLOSES hides anything. A file that ends inside an open
// fence (a code sample missing its closing line) had our appended block read as
// part of that sample, so it was never found again and every run appended
// another copy. Our own block after an unmatched opener cannot be an example.
function findBlock(text, begin = CONTRACT_BEGIN, end = CONTRACT_END, { fences = true } = {}) {
  const lines = text.split(/(?<=\n)/);
  const bare = lines.map((l) => l.replace(/\n$/, ''));
  const hidden = new Set();
  if (fences) {
    let open = null;
    let inside = [];
    bare.forEach((b, i) => {
      const f = b.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (!open) {
        if (f) { open = f[1]; inside = [i]; }
      } else {
        inside.push(i);
        if (f && f[1][0] === open[0] && f[1].length >= open.length && f[2].trim() === '') {
          inside.forEach((x) => hidden.add(x));
          open = null;
        }
      }
    });
  }

  let offset = 0;
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!hidden.has(i)) {
      const t = bare[i].replace(/[ \t]+$/, '');
      if (start === -1 && t === begin) start = offset;
      else if (start !== -1 && t === end) return { start, end: offset + end.length };
    }
    offset += lines[i].length;
  }
  return null;
}

// From the old heading to the next H1 or `<!-- BEGIN:` block outside a code
// fence, or the end of the file. Offsets are into the LF text.
function findLegacySection(text, heading) {
  let offset = 0;
  let start = -1;
  let fence = false;
  for (const line of text.split(/(?<=\n)/)) {
    const bare = line.replace(/\n$/, '');
    if (/^\s*(```|~~~)/.test(bare)) fence = !fence;
    else if (!fence && start === -1 && bare === heading) start = offset;
    else if (!fence && start !== -1 && (/^# /.test(bare) || bare.startsWith('<!-- BEGIN:'))) {
      return { start, end: offset };
    }
    offset += line.length;
  }
  return start === -1 ? null : { start, end: text.length };
}

const eolOf = (s) => (/\r\n/.test(s) ? '\r\n' : '\n');
const lf = (s) => s.replace(/\r\n/g, '\n');
const withEol = (s, eol) => (eol === '\n' ? s : s.replace(/\n/g, eol));

function sameFile(a, b) {
  try { return realpathSync(a) === realpathSync(b); } catch { return false; }
}

// Whether a path's directory, or the nearest part of it that exists, resolves
// inside the project once every link along the way is followed. The file itself
// is judged separately, by the symlink handling in write().
function resolvesInside(root, p) {
  try {
    const base = realpathSync(root);
    let dir = dirname(p);
    while (!existsSync(dir) && dirname(dir) !== dir) dir = dirname(dir);
    const real = realpathSync(dir);
    return real === base || real.startsWith(base + sep);
  } catch {
    return false;
  }
}

// Where a link leads, if that is a regular file inside the project; null for
// anything else, including a dangling link or one that leaves the repository.
function fileInside(root, link) {
  try {
    const real = realpathSync(link);
    return real.startsWith(realpathSync(root) + sep) && statSync(real).isFile() ? real : null;
  } catch {
    return null;
  }
}

// Deepest first, so `.claude/skills/x` is emptied before `.claude/skills`.
// rmdirSync fails on a non-empty directory, which is exactly the guard wanted
// here, so the error is the check and is meant to be swallowed.
function pruneEmpty(root, rels) {
  const dirs = [...new Set(rels.map((rel) => dirname(join(root, rel))))]
    .sort((a, b) => b.split(sep).length - a.split(sep).length);
  for (const d of dirs) {
    let cur = d;
    while (cur.startsWith(root) && cur !== root) {
      try { rmdirSync(cur); } catch { break; }
      cur = dirname(cur);
    }
  }
}

// --- the install record ----------------------------------------------------
//
// Committed, not gitignored: it is a record of what this tool put in the
// repository, in the same spirit as a lockfile. Hashes are truncated because
// their only job is to answer "has this changed since we wrote it".

export const INSTALLED_PATH = join('.sws', 'installed.json');

const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 12);

export function readInstalled(root) {
  const p = join(root, INSTALLED_PATH);
  if (!existsSync(p)) return null;
  try {
    const j = JSON.parse(readFileSync(p, 'utf8'));
    return j && typeof j.files === 'object' ? j : null;
  } catch {
    // A corrupt record means we lose conflict detection for one run, which is
    // survivable. Silently starting over beats refusing to install.
    return null;
  }
}

function writeInstalled(root, { version, files, scope = 'project' }) {
  // The advice differs by scope, and getting it wrong matters: "commit this" is
  // right in a repository and nonsense in a home directory.
  const advice = scope === 'user'
    ? 'Do not delete while the skills are installed: `install --remove` reads this to '
      + 'know which files are ours, and without it an uninstall cannot tell your '
      + 'skills from ours and so removes nothing.'
    : 'Commit this. Safe to delete: you lose conflict detection until the next install.';

  mkdirSync(join(root, '.sws'), { recursive: true });
  writeFileSync(join(root, INSTALLED_PATH), `${JSON.stringify({
    _comment: 'Written by @su-sws/synthetic-web-team. Records what was installed so a '
      + `re-install can tell an update from a local edit. ${advice}`,
    tool: '@su-sws/synthetic-web-team',
    scope,
    version,
    at: new Date().toISOString(),
    files,
  }, null, 2)}\n`);
}

/**
 * Uninstall, driven entirely by the install record.
 *
 * WHY THE RECORD IS THE ONLY INPUT. A user-scope install writes into a home
 * directory that already holds other people's work -- 584 unrelated skills on
 * the machine this was developed on. Deleting `~/.claude/skills` wholesale, or
 * anything matched by pattern, would take those with it. So the ONLY files
 * eligible for removal are ones `.sws/installed.json` says we wrote, and the
 * hash has to still match.
 *
 * Three verdicts, mirroring the install:
 *
 *   removed   we wrote it, it is unchanged, it is gone
 *   kept      we wrote it and it was EDITED since. Their edit is their work, so
 *             it stays and is reported. `force` overrides.
 *   missing   already gone. Not an error; someone tidied up before us.
 *
 * Empty directories we created are pruned, deepest first, and only when empty
 * -- so a skills directory that still holds anything else survives.
 */
export function remove(root, { dryRun = false, force = false } = {}) {
  const prev = readInstalled(root);
  if (!prev) return { status: 'no-record', removed: [], kept: [], missing: [] };

  const removed = [];
  const kept = [];
  const missing = [];

  for (const [rel, recorded] of Object.entries(prev.files ?? {})) {
    const p = join(root, rel);
    if (!existsSync(p)) { missing.push(rel); continue; }
    if (!force && hash(readFileSync(p, 'utf8')) !== recorded) { kept.push(rel); continue; }
    if (!dryRun) rmSync(p);
    removed.push(rel);
  }

  if (!dryRun) {
    pruneEmpty(root, removed);

    // Keep a record only while something of ours is still on disk, so a second
    // run can still tell our files from theirs.
    const recordPath = join(root, INSTALLED_PATH);
    if (kept.length) {
      writeInstalled(root, {
        version: prev.version ?? null,
        scope: prev.scope ?? 'project',
        files: Object.fromEntries(kept.map((k) => [k, prev.files[k]])),
      });
    } else if (existsSync(recordPath)) {
      rmSync(recordPath);
      try { rmdirSync(join(root, '.sws')); } catch { /* other state lives there */ }
    }
  }

  return { status: 'ok', removed, kept, missing, scope: prev.scope ?? 'project' };
}

// --- the project's dependency on this package ------------------------------
//
// WHY THIS EXISTS. Every verify step this tool documents is spelled
// `npx sws ...`, and unscoped `sws` is an UNRELATED package on the public
// registry (sws@0.0.2, not ours). With no local dependency there is no
// node_modules/.bin/sws to shadow it, so `npx sws doctor` in a fresh project
// fetches a stranger's code. Declaring the dependency makes `npx sws` resolve
// locally, and it is also how `sws doctor` can tell that a project is behind.
//
// package.json is NOT ours, so this is a targeted merge and never a rewrite:
// one key added, the file's own indentation kept, an existing declaration left
// alone, and NO entry in installed.json -- a file the user edits constantly
// must not be under conflict detection.
//
// Caveat, stated because it is the one real cost: the JSON round-trip
// normalises formatting, so an unusual layout will reformat. This is the same
// thing `npm install --save` does to the same file.
export function ensureDevDependency(root, { name, range, dryRun = false } = {}) {
  const p = join(root, 'package.json');
  if (!existsSync(p)) return { status: 'no-package-json' };

  // No resolved version means no honest range to write. Writing `*` or a
  // dist-tag to dodge that is the placeholder problem this file avoids
  // everywhere else, so it reports instead.
  if (!range) return { status: 'skipped-unknown-version' };

  let raw;
  let json;
  try {
    raw = readFileSync(p, 'utf8');
    json = JSON.parse(raw);
    if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('not a JSON object');
  } catch (err) {
    return { status: 'unparseable', detail: err.message };
  }

  // An existing declaration wins, in either block. A pin someone chose is a
  // decision, and quietly "upgrading" it is the same data loss this module
  // guards against for .sws/manifest.yml.
  const existing = json.devDependencies?.[name] ?? json.dependencies?.[name];
  if (existing) return { status: 'present', range: existing };

  if (dryRun) return { status: 'would-add', range };

  const indent = raw.match(/\n(\s+)"/)?.[1] ?? '  ';
  json.devDependencies = Object.fromEntries(
    Object.entries({ ...(json.devDependencies ?? {}), [name]: range })
      .sort(([a], [b]) => a.localeCompare(b)));
  const out = JSON.stringify(json, null, indent);
  writeFileSync(p, raw.endsWith('\n') ? `${out}\n` : out);
  return { status: 'added', range };
}
