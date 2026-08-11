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
  const add = (path, contents, note) => files.push({ path, contents, note });

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

  add('.sws/manifest.yml', manifestYaml({ answers, tier, editors, skills: skills.length }),
    'what this project is, and what was decided');
  add('.sws/acknowledged.yml', ACKNOWLEDGED_TEMPLATE,
    'accepted risks, with reasons and review dates');

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

  // MCP config files: emit an empty, valid, commented shell rather than
  // inventing servers. The wizard does not know which the person is entitled to
  // use, and a wrong entry produces confusing tool failures.
  if (path.endsWith('mcp.json') || path.endsWith('mcp_config.json')) {
    return JSON.stringify({ mcpServers: {} }, null, 2) + '\n';
  }
  if (path === '.codex/config.toml') {
    return '# Stanford Web Services. AGENTS.md and .agents/skills/ are read automatically.\n' +
           '# Add [mcp_servers.NAME] blocks here if you use MCP with Codex.\n';
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

export function write(root, files) {
  for (const f of files) {
    const p = join(root, f.path);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, f.contents);
  }
}
