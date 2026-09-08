// File emission.
//
// Two rules that shape everything here:
//
// 1. Per-editor files are THIN POINTERS, never content copies. There is then no
//    place for content to diverge, and no reason to regenerate anything later.
// 2. Every emitted file is self-sufficient about being a pointer, because
//    precedence and merge order are not uniform across editors and layering
//    cannot be relied on.

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync, rmdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, sep } from 'node:path';

const POINTER = (target) => `<!--
  Stanford Web Services agent team.

  This file is a POINTER, not content. The behavioral contract is ${target},
  and the team is in .agents/skills/ and .claude/skills/.

  Editing this file will not change how the agent behaves. Edit ${target}.
-->

@${target}
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
  add('AGENTS.md', readFileSync(join(source, 'AGENTS.md'), 'utf8'),
    'behavioral contract, read by every tool');

  const skills = skillNames(source);

  // Standards, vendored so the project is self-contained and reviewable.
  const walk = (d, base) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p, `${base}/${n}`);
      else add(`${base}/${n}`, readFileSync(p, 'utf8'), null);
    }
  };
  walk(join(source, 'standards'), 'standards');

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
  for (const e of editors) {
    for (const f of e.emits) {
      if (files.some((x) => x.path === f)) continue;
      const c = pointerFor(f);
      if (c !== null) add(f, c, `for ${e.label}`);
    }
  }

  return files;
}

function pointerFor(path) {
  if (path === 'CLAUDE.md' || path === 'GEMINI.md') return POINTER('AGENTS.md');

  if (path === '.github/copilot-instructions.md') {
    return `<!-- Pointer. The contract is AGENTS.md; skills are in .claude/skills/. -->

Follow the Stanford Web Services agent contract in \`AGENTS.md\` at the repository
root, and the standards in \`standards/\`.

Non-negotiables: WCAG 2.1 AA, the Global Footer is immutable
(\`standards/fragments/global-footer.yml\`), never commit credentials.
`;
  }

  if (path === '.cursor/rules/sws.mdc') {
    // .mdc is mandatory here; a .md file is silently ignored by Cursor.
    return `---
description: Stanford Web Services standards
alwaysApply: true
---

Follow the agent contract in \`AGENTS.md\` at the repository root. Skills are in
\`.agents/skills/\`. Standards are in \`standards/\`.

Non-negotiables: WCAG 2.1 AA, the Global Footer is immutable
(\`standards/fragments/global-footer.yml\`), never commit credentials.
`;
  }

  if (path === '.devin/rules/sws.md') {
    return `---
trigger: always_on
description: Stanford Web Services standards
---

Follow the agent contract in \`AGENTS.md\`. Skills are in \`.agents/skills/\`.
`;
  }

  // MCP config: wire up OUR server and nothing else.
  //
  // This used to emit an empty shell, on the reasoning that the wizard cannot
  // know which servers a person is entitled to use. That still holds for third
  // parties -- a wrong entry produces confusing tool failures -- but it does not
  // hold for @su-sws/mcp, which is ours, optional, and read-only apart from
  // sws_scaffold (which itself defaults to a dry run).
  //
  // The server is a SECOND entry point, never a requirement: everything it
  // exposes is also a file in standards/ that the agent can read directly. If
  // the client cannot start it, nothing else stops working.
  if (path.endsWith('mcp.json') || path.endsWith('mcp_config.json')) {
    return JSON.stringify({
      mcpServers: {
        sws: {
          command: 'npx',
          args: ['-y', '@su-sws/mcp'],
        },
      },
    }, null, 2) + '\n';
  }
  if (path === '.codex/config.toml') {
    return '# Stanford Web Services. AGENTS.md and .agents/skills/ are read automatically.\n' +
           '#\n' +
           '# Optional: the SWS MCP server, a second entry point to the same standards.\n' +
           '# [mcp_servers.sws]\n' +
           '# command = "npx"\n' +
           '# args = ["-y", "@su-sws/mcp"]\n';
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
# standards/hosting/. Leave provider null until the choice is made.
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
# the repo: no CMS, not Storyblok, not decoupled Drupal. See standards/scope.md.
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
 * Comparison is by content, never mtime: re-running the same version must be
 * `unchanged` even though the source files have newer timestamps.
 */
export function write(root, files, { force = false, version = null, scope = 'project' } = {}) {
  const prev = readInstalled(root);
  const planned = new Set(files.map((f) => f.path));
  const results = [];
  const nextHashes = {};

  for (const f of files) {
    const p = join(root, f.path);
    const newHash = hash(f.contents);
    let status;

    if (!existsSync(p)) {
      status = 'created';
    } else {
      const local = readFileSync(p, 'utf8');
      if (f.preserve) status = 'preserved';
      else if (local === f.contents) status = 'unchanged';
      else {
        const recorded = prev?.files?.[f.path];
        // No record means we cannot tell an edit from an old version, so the
        // safe default is to update. Conflict detection needs evidence.
        const edited = recorded !== undefined && hash(local) !== recorded;
        status = edited && !force ? 'conflict' : 'updated';
      }
    }

    if (status === 'created' || status === 'updated') {
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, f.contents);
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
      nextHashes[f.path] = prev?.files?.[f.path] ?? newHash;
    } else {
      nextHashes[f.path] = existsSync(p) ? hash(readFileSync(p, 'utf8')) : newHash;
    }
    results.push({ path: f.path, status });
  }

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
    previousVersion: prev?.version ?? null,
    created: count('created'),
    updated: count('updated'),
    unchanged: count('unchanged'),
    preserved: count('preserved'),
    conflicts: results.filter((r) => r.status === 'conflict').map((r) => r.path),
  };
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
    ? 'Do not delete while the skills are installed: `user --remove` reads this to '
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
    // Deepest first, so `.claude/skills/x` is emptied before `.claude/skills`.
    // rmdirSync fails on a non-empty directory, which is exactly the guard
    // wanted here, so the error is the check and is meant to be swallowed.
    const dirs = [...new Set(removed.map((rel) => dirname(join(root, rel))))]
      .sort((a, b) => b.split(sep).length - a.split(sep).length);
    for (const d of dirs) {
      let cur = d;
      while (cur.startsWith(root) && cur !== root) {
        try { rmdirSync(cur); } catch { break; }
        cur = dirname(cur);
      }
    }

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
