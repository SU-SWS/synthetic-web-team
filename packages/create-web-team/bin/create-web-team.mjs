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
    answers: { type: 'string' },
    json: { type: 'boolean', default: false },
    interactive: { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

const root = resolve(positionals[1] ?? '.');
const mode = positionals[0] === 'add' ? 'add' : 'new';

// ---------------------------------------------------------------------------
// AGENTS ARE THE PRIMARY CALLER, so non-interactive is the DEFAULT and prompting
// is the special case.
//
// This inverted after testing what an agent actually experiences. Prompts used
// to be gated on `!--yes` alone, which produced two failure modes and no useful
// output in either:
//
//   stdin closed          exit 13, no diagnostic
//   stdin an open pipe    HUNG FOREVER, which is the worst possible outcome for
//                         a caller that cannot answer and cannot see the prompt
//
// A robot has no TTY. So: prompt only when there is demonstrably a human on both
// ends, or when --interactive is passed explicitly. Everything else runs to
// completion and reports.
const hasHuman = Boolean(process.stdin.isTTY && process.stdout.isTTY);
const interactive = flags.interactive || (hasHuman && !flags.yes && !flags.json);

// With --json, stdout is a single JSON document and nothing else. Prose goes to
// stderr, so a caller can pipe stdout straight into a parser.
const say = (...a) => (flags.json ? console.error(...a) : console.log(...a));

if (flags.help) {
  console.log(`
  create-web-team [add] [dir]

  Installs the Stanford Web Services agent team into a project.

  FOR AGENTS. This is the first-class path. One command, no prompts, parseable
  output, stable exit codes:

    npx @su-sws/create-web-team --json --answers '{"siteName":"...","unit":"..."}'

  Non-interactive is the DEFAULT whenever stdin is not a TTY, so an agent cannot
  hang on a prompt. With --json, stdout is exactly one JSON document and all
  prose goes to stderr.

  --json           Emit one JSON document on stdout. Implies non-interactive.
  --answers <json> Answers as JSON, or a path to a .json file. Without this an
                   unattended run uses placeholder values, which then sit in
                   .sws/manifest.yml looking like real ones.
  --source <dir>   Where the standards live (default: auto-detect)
  --editors <ids>  Comma-separated, skips detection. e.g. claude-code,cursor
  --yes            Accept defaults, no prompts.
  --interactive    Force prompts even without a TTY.
  --force          Overwrite files you have edited locally. Off by default.
  --dry-run        Report what would be written, write nothing.

  Answer keys: siteName, unit, purpose, url, recipe, businessOwnerName,
  businessOwnerEmail, techAdminName, techAdminEmail, and the booleans
  collectsPersonalData, authenticates, payments, regulated (these four derive
  the compliance tier).

  UPDATING. Re-running is the update: content is rewritten from source, project
  state (.sws/manifest.yml, .sws/acknowledged.yml) is preserved, and any file you
  edited yourself is reported as a conflict and left alone. .sws/installed.json
  records what was written so an edit can be told from an old version. Pass
  --force to overwrite your edits.

  Exit codes: 0 success or dry run, 2 bad input or no content found,
  3 nothing written because a human declined.
`);
  process.exit(0);
}

// Where the content comes from, in order of specificity.
//
// The first entry is the important one: `AGENTS.md`, `skills/` and `standards/`
// ship in the same package as this file (@su-sws/sws), so walking up three
// directories finds them under `npx` exactly as it does in this repository.
// That is the whole reason content and tools are one package -- an earlier split
// needed a separate `@su-sws/standards` import here, and could skew versions.
function findSource() {
  const looksRight = (c) => c
    && existsSync(join(c, 'AGENTS.md'))
    && existsSync(join(c, 'skills'))
    && existsSync(join(c, 'standards'));

  // An explicit --source is still checked. Previously it was returned unchecked,
  // so a wrong path surfaced later as an unhandled ENOENT and exit 1 instead of
  // a structured error -- which for an agent is the difference between a fixable
  // message and a stack trace.
  if (flags.source) {
    const p = resolve(flags.source);
    return looksRight(p) ? p : { badSource: p };
  }

  // 1. the package this file ships in (also the repo root), 2. the cwd
  for (const c of [resolve(HERE, '..', '..', '..'), process.cwd()]) {
    if (looksRight(c)) return c;
  }
  return null;
}

// One exit path for failures, so a caller never has to parse prose to find out
// what went wrong.
function die(code, error, detail) {
  if (flags.json) {
    console.log(JSON.stringify({ ok: false, error, detail, root, mode }, null, 2));
  } else {
    console.error(`  ${error}`);
    if (detail) console.error(`  ${detail}`);
  }
  process.exit(code);
}

// ---- answers supplied up front, which is how an agent should do it ---------
//
// Without this an unattended run silently uses DEFAULTS, and "Example Unit"
// with empty owner emails lands in .sws/manifest.yml looking like a real
// answer. MinWeb requires both owners to be identifiable, so writing
// placeholders is worse than writing nothing.
function suppliedAnswers() {
  if (!flags.answers) return null;
  let raw = flags.answers;
  if (!raw.trimStart().startsWith('{')) {
    const p = resolve(raw);
    if (!existsSync(p)) die(2, `--answers file not found: ${p}`);
    raw = readFileSync(p, 'utf8');
  }
  try {
    const j = JSON.parse(raw);
    if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('not a JSON object');
    const known = new Set(Object.keys(DEFAULTS));
    const unknown = Object.keys(j).filter((k) => !known.has(k));
    if (unknown.length) {
      die(2, `--answers has unknown key(s): ${unknown.join(', ')}`,
        `Known keys: ${[...known].join(', ')}`);
    }
    return j;
  } catch (err) {
    die(2, `--answers is not valid JSON: ${err.message}`);
  }
}

// The version of @su-sws/sws, which is the content version because content and
// tools ship in one package. Recorded in .sws/installed.json so `sws doctor` can
// say whether a project is behind.
const contentVersion = (() => {
  for (const c of [resolve(HERE, '..', '..', '..', 'package.json')]) {
    try { return JSON.parse(readFileSync(c, 'utf8')).version ?? null; } catch { /* next */ }
  }
  return null;
})();

const source = findSource();
if (source?.badSource) {
  die(2, `--source is not a standards source: ${source.badSource}`,
    'Expected it to contain AGENTS.md, skills/ and standards/.');
}
if (!source) {
  die(2, 'Could not find the standards content.',
    'Expected it beside this tool, or in the current directory. Pass --source <dir>.');
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
  const supplied = suppliedAnswers();
  if (!interactive) return { ...DEFAULTS, ...(supplied ?? {}) };

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (q, dflt = '') => {
    const a = (await rl.question(`  ${q}${dflt ? D(` (${dflt})`) : ''}: `)).trim();
    return a || dflt;
  };
  const yes = async (q, dflt = false) => {
    const a = (await rl.question(`  ${q} ${D(dflt ? '[Y/n]' : '[y/N]')}: `)).trim().toLowerCase();
    return a ? a.startsWith('y') : dflt;
  };

  const A = { ...DEFAULTS, ...(supplied ?? {}) };
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

if (interactive && !flags.editors) {
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

// --- the machine-readable result --------------------------------------------
//
// One JSON document on stdout, defined once and used by both the dry-run and the
// real path so they cannot describe the same install differently.
//
// `next` is DATA, not prose. The caller of this tool is an agent whose whole
// reason for installing is to then act, and "Hand your agent
// standards/recipes/astro-static/RECIPE.md" is a sentence a robot has to parse
// out of decorated terminal output. Each step names a kind, a path or command,
// and why — so the agent can pick the one it is able to do.
//
// `incomplete` is the field that matters most. An unattended install writes
// placeholder owners into .sws/manifest.yml, and MinWeb requires both owners to
// be identifiable. Rather than pretend that is done, the result says which
// fields are still placeholders so the agent can ask its user.
function emitJson({ written, write: wr }) {
  const placeholder = [];
  if (!answers.businessOwnerEmail) placeholder.push('owners.business.email');
  if (!answers.businessOwnerName) placeholder.push('owners.business.name');
  if (!answers.techAdminEmail) placeholder.push('owners.technical.email');
  if (!answers.techAdminName) placeholder.push('owners.technical.name');
  if (answers.siteName === 'Example Unit') placeholder.push('site.name');
  if (!answers.url) placeholder.push('site.url');

  const next = [];
  next.push({
    kind: 'read-contract', path: 'AGENTS.md',
    why: 'The behavioral contract. Read it before doing anything else in this project.',
  });
  next.push({
    kind: 'orient', skill: 'sws-onboard',
    why: 'Reads .sws/manifest.yml and states the stack, tier, and decisions already made.',
  });
  if (mode === 'new') {
    next.push({
      kind: 'follow-recipe', path: `standards/recipes/${answers.recipe}/RECIPE.md`,
      why: 'The build contract, with acceptance criteria. Follow it rather than improvising.',
    });
  }
  if (placeholder.length) {
    next.push({
      kind: 'complete-manifest', path: '.sws/manifest.yml', fields: placeholder,
      why: 'These are placeholders, not answers. MinWeb requires a named business owner and technical administrator with valid Stanford email. Ask the user; do not invent them.',
    });
  }
  if (chosen.some((e) => e.emits.some((x) => x.endsWith('mcp.json')))) {
    next.push({
      kind: 'optional-mcp', command: 'npx -y @su-sws/mcp --help',
      why: 'An MCP server for these standards was added to your client config. It is a second entry point, never a requirement: sws_get_standard, sws_footer_html, sws_check, sws_decanter_token, sws_scaffold. Everything it exposes is also a file under standards/. Remove the entry if you do not want it.',
    });
  }
  next.push({
    kind: 'verify', command: 'npx sws doctor --format json',
    why: 'Advisory compliance report. Exits 0 always. Run `sws a11y` and `sws perf` first if the site is built.',
  });

  console.log(JSON.stringify({
    ok: true,
    schema: 1,
    tool: '@su-sws/create-web-team',
    version: contentVersion,
    previousVersion: wr?.previousVersion ?? null,
    mode,
    written,
    root,
    source,
    interactive,
    tier: { tier: tier.tier, because: tier.because, adds: tier.adds },
    answers,
    editors: chosen.map((e) => ({ id: e.id, label: e.label, emits: e.emits })),
    counts: {
      files: files.length,
      skills: skillCount,
      standards: stdCount,
      ...(wr ? {
        created: wr.created, updated: wr.updated, unchanged: wr.unchanged,
        preserved: wr.preserved, conflicts: wr.conflicts.length,
      } : {}),
    },
    files: wr ? wr.results : files.map((x) => ({ path: x.path, status: 'planned' })),
    incomplete: placeholder,
    conflicts: wr?.conflicts ?? [],
    orphans: wr?.orphans ?? [],
    next,
    notes: [
      'Everything is advisory except committed credentials, which are the one blocking check.',
      'Automated accessibility testing covers roughly 30 percent of issues per ODA guidance. A passing report is a floor, not a conformance claim.',
    ],
  }, null, 2));
}

// --- tier explanation, before the file list ---------------------------------

say(`\n  ${B('Compliance tier: ' + tier.tier.toUpperCase())}  ${D('because ' + tier.because)}`);
for (const a of tier.adds) say(`    ${D('·')} ${a}`);
if (tier.tier !== 'low') {
  say(`\n  ${B('This is above a basic static site.')} ${D('A Data Risk Assessment may be')}`);
  say(`  ${D('required before deploy. Route to UIT Security: standards/policy/escalation.md')}`);
}

// --- review, then write -----------------------------------------------------

const files = plan({ root, source, editors: chosen, answers, tier });

const skillCount = files.filter((f) => f.path.endsWith('SKILL.md')).length;
const stdCount = files.filter((f) => f.path.startsWith('standards/')).length;
const shown = files.filter((f) => !f.path.endsWith('SKILL.md') && !f.path.startsWith('standards/'));

say(`\n  ${B('Files to write')}  ${D(root)}\n`);
for (const f of shown) {
  say(`    ${f.path}${f.note ? D('  ' + f.note) : ''}`);
}
say(`    ${D(`+ ${skillCount} skill files across .agents/skills and .claude/skills`)}`);
say(`    ${D(`+ ${stdCount} files under standards/`)}`);

if (flags['dry-run']) {
  say(`\n  ${D('Dry run. Nothing written.')}\n`);
  if (flags.json) emitJson({ written: false, write: null });
  process.exit(0);
}

if (interactive) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const go = (await rl.question(`\n  Write these ${files.length} files? ${D('[Y/n]')}: `)).trim().toLowerCase();
  await rl.close();
  if (go && !go.startsWith('y')) {
    // Exit 3, not 0: a human declining is a different outcome from success, and
    // a caller should be able to tell them apart.
    say('\n  Nothing written.\n');
    process.exit(3);
  }
}

const result = write(root, files, { force: flags.force, version: contentVersion });

// Say what actually changed, not how many files were considered. On a re-run
// this reads "nothing to do", which is the truth and what a caller should
// report onward.
if (result.created === 0 && result.updated === 0) {
  say(`\n  ${B('Already installed.')} ${result.unchanged + result.preserved} files, nothing to change.\n`);
} else {
  const parts = [];
  if (result.created) parts.push(`${result.created} created`);
  if (result.updated) parts.push(`${result.updated} updated`);
  if (result.unchanged) parts.push(`${result.unchanged} unchanged`);
  if (result.preserved) parts.push(`${result.preserved} preserved`);
  if (result.conflicts.length) parts.push(`${result.conflicts.length} left alone`);
  say(`\n  ${B('Done.')} ${parts.join(', ')}.\n`);
}

// Conflicts and orphans, before the next steps: they need a decision.
if (result.conflicts.length) {
  say(`  ${B('Left alone because you edited them:')}`);
  for (const c of result.conflicts) say(`    ${c}`);
  say(`  ${D('Re-run with --force to take the new versions and discard your edits.')}`);
  say('');
}
if (result.orphans.length) {
  say(`  ${B('No longer shipped, still in your project:')}`);
  for (const o of result.orphans) say(`    ${o}`);
  say(`  ${D('Not deleted. Remove them yourself if you agree they are stale.')}`);
  say('');
}

// --- what happens next ------------------------------------------------------

say(`  ${B('Next')}`);
if (mode === 'new') {
  say(`    1. Scaffold the site. Hand your agent standards/recipes/${answers.recipe}/RECIPE.md,`);
  say(`       ${D('or run the upstream scaffolder yourself: npm create astro@latest')}`);
  say(`    2. Check it:  npx sws doctor`);
} else {
  say(`    1. Check it:  npx sws doctor`);
}
say(`    3. Fill in the blanks in .sws/manifest.yml: owners, Siteimprove, ODA review.`);
say('');
say(`  ${D('Everything is advisory. The only thing that fails a build is a committed')}`);
say(`  ${D('credential. If something cannot be fixed now, record it in')}`);
say(`  ${D('.sws/acknowledged.yml with a reason and a review date.')}`);
say('');

if (flags.json) emitJson({ written: true, write: result });
