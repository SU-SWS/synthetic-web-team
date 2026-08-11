#!/usr/bin/env node
// The install wizard.
//
// Commitments enforced here:
//   - Ask about the WORLD, derive the compliance tier. Nobody should read a
//     security matrix to start a website.
//   - Show every file before writing anything.
//   - Never block. If a step fails, hand over the recipe and let the agent do it.
//   - Emitted per-editor files are thin pointers, so nothing needs regenerating.

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { detect, deriveTier } from '../src/detect.mjs';
import { plan, write } from '../src/emit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    source: { type: 'string' },
    yes: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    editors: { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

const root = resolve(positionals[1] ?? '.');
const mode = positionals[0] === 'add' ? 'add' : 'new';

if (flags.help) {
  console.log(`
  create-web-team [add] [dir]

  Installs the Stanford Web Services agent team into a project.

  --source <dir>   Where the standards live (default: auto-detect)
  --editors <ids>  Comma-separated, skips detection. e.g. claude-code,cursor
  --yes            Accept defaults, no prompts. For CI and testing.
  --dry-run        Show what would be written, write nothing.
`);
  process.exit(0);
}

function findSource() {
  if (flags.source) return resolve(flags.source);
  for (const c of [resolve(HERE, '..', '..', '..'), process.cwd()]) {
    if (existsSync(join(c, 'AGENTS.md')) && existsSync(join(c, 'skills'))) return c;
  }
  return null;
}

const source = findSource();
if (!source) {
  console.error('Could not find the standards source. Pass --source <dir>.');
  process.exit(2);
}

const B = (s) => (process.stdout.isTTY ? `\x1b[1m${s}\x1b[0m` : s);
const D = (s) => (process.stdout.isTTY ? `\x1b[2m${s}\x1b[0m` : s);

// --- interview --------------------------------------------------------------

const DEFAULTS = {
  siteName: 'Example Unit', unit: 'Example Unit', purpose: 'Public information site',
  url: '', recipe: 'astro-static',
  businessOwnerName: '', businessOwnerEmail: '',
  techAdminName: '', techAdminEmail: '',
  collectsPersonalData: false, authenticates: false, payments: false, regulated: false,
};

async function interview() {
  if (flags.yes) return { ...DEFAULTS };

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (q, dflt = '') => {
    const a = (await rl.question(`  ${q}${dflt ? D(` (${dflt})`) : ''}: `)).trim();
    return a || dflt;
  };
  const yes = async (q, dflt = false) => {
    const a = (await rl.question(`  ${q} ${D(dflt ? '[Y/n]' : '[y/N]')}: `)).trim().toLowerCase();
    return a ? a.startsWith('y') : dflt;
  };

  const A = { ...DEFAULTS };
  console.log(`\n${B('Stanford Web Services')}  ${D('project setup')}\n`);

  console.log(D('  What is this site?'));
  A.siteName = await ask('Site name', A.siteName);
  A.unit = await ask('Stanford unit', A.siteName);
  A.purpose = await ask('One line: what should change because this site exists', A.purpose);
  A.url = await ask('Planned URL, if known', '');

  // The tier questions. Note none of them mention MinSec.
  console.log(`\n${D('  What does it handle? This sets the compliance requirements.')}`);
  A.collectsPersonalData = await yes('Will it collect or display information about individuals?');
  A.authenticates = await yes('Will people log in?');
  if (A.collectsPersonalData || A.authenticates) {
    A.payments = await yes('Will it take payments?');
    A.regulated = await yes('Will it handle health, financial, or export-controlled data?');
  }

  console.log(`\n${D('  Who owns it? MinWeb requires both to be identifiable.')}`);
  A.businessOwnerName = await ask('Business owner name', '');
  A.businessOwnerEmail = await ask('Business owner Stanford email', '');
  A.techAdminName = await ask('Technical administrator name', '');
  A.techAdminEmail = await ask('Technical administrator Stanford email', '');

  await rl.close();
  return A;
}

// --- run --------------------------------------------------------------------

const answers = await interview();
const tier = deriveTier(answers);

let editors = detect(root);
if (flags.editors) {
  const want = flags.editors.split(',').map((s) => s.trim());
  editors = editors.map((e) => ({ ...e, detected: want.includes(e.id) }));
}
let chosen = editors.filter((e) => e.detected);

if (!flags.yes && !flags.editors) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log(`\n${D('  Which AI tools do you use? Detected ones are pre-selected.')}`);
  editors.forEach((e, i) => {
    const mark = e.detected ? B('x') : ' ';
    console.log(`   ${String(i + 1).padStart(2)}. [${mark}] ${e.label}` +
      (e.evidence.length ? D(`  found ${e.evidence.join(', ')}`) : ''));
  });
  const a = (await rl.question(`\n  Numbers to toggle, or Enter to accept: `)).trim();
  await rl.close();
  for (const n of a.split(/[\s,]+/).filter(Boolean)) {
    const i = Number(n) - 1;
    if (editors[i]) editors[i].detected = !editors[i].detected;
  }
  chosen = editors.filter((e) => e.detected);
}

if (!chosen.length) {
  console.log(`\n  ${D('No editors selected. The universal core still works everywhere:')}`);
  console.log(`  ${D('AGENTS.md plus .agents/skills and .claude/skills.')}`);
}

// --- tier explanation, before the file list ---------------------------------

console.log(`\n  ${B('Compliance tier: ' + tier.tier.toUpperCase())}  ${D('because ' + tier.because)}`);
for (const a of tier.adds) console.log(`    ${D('·')} ${a}`);
if (tier.tier !== 'low') {
  console.log(`\n  ${B('This is above a basic static site.')} ${D('A Data Risk Assessment may be')}`);
  console.log(`  ${D('required before deploy. Route to UIT Security: standards/policy/escalation.md')}`);
}

// --- review, then write -----------------------------------------------------

const files = plan({ root, source, editors: chosen, answers, tier });

const skillCount = files.filter((f) => f.path.endsWith('SKILL.md')).length;
const stdCount = files.filter((f) => f.path.startsWith('standards/')).length;
const shown = files.filter((f) => !f.path.endsWith('SKILL.md') && !f.path.startsWith('standards/'));

console.log(`\n  ${B('Files to write')}  ${D(root)}\n`);
for (const f of shown) {
  console.log(`    ${f.path}${f.note ? D('  ' + f.note) : ''}`);
}
console.log(`    ${D(`+ ${skillCount} skill files across .agents/skills and .claude/skills`)}`);
console.log(`    ${D(`+ ${stdCount} files under standards/`)}`);

if (flags['dry-run']) {
  console.log(`\n  ${D('Dry run. Nothing written.')}\n`);
  process.exit(0);
}

if (!flags.yes) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const go = (await rl.question(`\n  Write these ${files.length} files? ${D('[Y/n]')}: `)).trim().toLowerCase();
  await rl.close();
  if (go && !go.startsWith('y')) { console.log('\n  Nothing written.\n'); process.exit(0); }
}

write(root, files);
console.log(`\n  ${B('Done.')} ${files.length} files written.\n`);

// --- what happens next ------------------------------------------------------

console.log(`  ${B('Next')}`);
if (mode === 'new') {
  console.log(`    1. Scaffold the site. Hand your agent standards/recipes/${answers.recipe}/RECIPE.md,`);
  console.log(`       ${D('or run the upstream scaffolder yourself: npm create astro@latest')}`);
  console.log(`    2. Check it:  npx sws doctor`);
} else {
  console.log(`    1. Check it:  npx sws doctor`);
}
console.log(`    3. Fill in the blanks in .sws/manifest.yml: owners, Siteimprove, ODA review.`);
console.log('');
console.log(`  ${D('Everything is advisory. The only thing that fails a build is a committed')}`);
console.log(`  ${D('credential. If something cannot be fixed now, record it in')}`);
console.log(`  ${D('.sws/acknowledged.yml with a reason and a review date.')}`);
console.log('');
