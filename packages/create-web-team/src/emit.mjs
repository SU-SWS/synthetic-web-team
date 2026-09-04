// File emission.
//
// Two rules that shape everything here:
//
// 1. Per-editor files are THIN POINTERS, never content copies. There is then no
//    place for content to diverge, and no reason to regenerate anything later.
// 2. Every emitted file is self-sufficient about being a pointer, because
//    precedence and merge order are not uniform across editors and layering
//    cannot be relied on.

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';

const POINTER = (target) => `<!--
  Stanford Web Services agent team.

  This file is a POINTER, not content. The behavioral contract is ${target},
  and the team is in .agents/skills/ and .claude/skills/.

  Editing this file will not change how the agent behaves. Edit ${target}.
-->

@${target}
`;

export function plan({ root, source, editors, answers, tier }) {
  const files = [];
  const add = (path, contents, note, opts = {}) => files.push({ path, contents, note, ...opts });

  // ---- universal core -----------------------------------------------------
  add('AGENTS.md', readFileSync(join(source, 'AGENTS.md'), 'utf8'),
    'behavioral contract, read by every tool');

  const skills = readdirSync(join(source, 'skills'))
    .filter((d) => existsSync(join(source, 'skills', d, 'SKILL.md')));
  for (const target of ['.agents/skills', '.claude/skills']) {
    for (const name of skills) {
      add(`${target}/${name}/SKILL.md`,
        readFileSync(join(source, 'skills', name, 'SKILL.md'), 'utf8'), null);
    }
  }

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

skills_installed: ${skills}

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
export function write(root, files, { force = false, version = null } = {}) {
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
      // Record what is actually on disk, so the next run compares against
      // reality and does not report the same conflict forever.
      nextHashes[f.path] = hash(readFileSync(p, 'utf8'));
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

  writeInstalled(root, { version, files: nextHashes });

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

function writeInstalled(root, { version, files }) {
  mkdirSync(join(root, '.sws'), { recursive: true });
  writeFileSync(join(root, INSTALLED_PATH), `${JSON.stringify({
    _comment: 'Written by @su-sws/create-web-team. Records what was installed so a '
      + 're-install can tell an update from a local edit. Commit this. Safe to delete: '
      + 'you lose conflict detection until the next install.',
    tool: '@su-sws/create-web-team',
    version,
    at: new Date().toISOString(),
    files,
  }, null, 2)}\n`);
}
