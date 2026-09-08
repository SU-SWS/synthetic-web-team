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
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { detect, deriveTier } from '../src/detect.mjs';
import { plan, write, remove, ensureDevDependency } from '../src/emit.mjs';

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
    remove: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

// Three modes. `user` installs the skills into the person's tool and writes
// nothing per-site. `add` and `new` are the project install, unchanged.
//
// POSITIONALS ARE [mode, dir], AND A MISSING MODE USED TO BE SILENTLY COSTLY.
// `wizard.mjs /some/path` made the path the mode, fell through to 'new', left
// the directory undefined, and installed into the CURRENT directory instead --
// 46 files into the wrong repository, with an exit code of 0. That was already
// found once from the MCP side (see the note in packages/mcp/src/scaffold.mjs)
// and worked around there by always passing a mode; the wizard kept the trap.
// So an unrecognised first positional is now read as the directory, which is
// what anyone typing it meant.
// Each job is NAMED, and none of them is the default.
//
// `install` writes 60 files into a home directory; `init` and `add` write 46
// into whatever directory you are standing in. Picking one of those on the
// strength of a guess is not a defensible default, and guessing from the
// directory cannot work anyway: an empty directory is exactly the `init` case,
// so "empty means install into the editor" would hijack the commonest flow.
//
// `new` is a silent alias for `init`, kept because the MCP scaffolder passes a
// mode positional and muscle memory is cheap to honour.
const COMMANDS = new Map([
  ['install', 'user'],
  ['init', 'new'],
  ['initialize', 'new'],
  ['new', 'new'],
  ['add', 'add'],
]);
const cmdGiven = positionals[0] !== undefined && COMMANDS.has(positionals[0]);
const mode = cmdGiven ? COMMANDS.get(positionals[0]) : null;
const dirArg = cmdGiven ? positionals[1] : positionals[0];

// A user install targets the home directory. The optional directory overrides
// it, which exists so this can be exercised against a scratch directory rather
// than a real ~/.claude/skills -- there were 584 unrelated skills in the one on
// the machine this was written on, and none of them are ours to risk.
const root = mode === 'user'
  ? resolve(dirArg ?? homedir())
  : resolve(dirArg ?? '.');


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

const HELP = `
  synthetic-web-team <install|init|add> [dir]

  Installs the Stanford Web Services agent team. THREE JOBS, and no default --
  each writes to a different place, so it will not guess which you meant:

    install    once per machine, into your editor
    init       a new site, in an empty directory
    add        an existing project, in its root

  'install' writes the 30 skills into ~/.claude/skills and ~/.agents/skills and
  nothing else: no standards, no AGENTS.md, nothing per-site, because at that
  point there is no site. Undo it with 'install --remove'.

  'init' and 'add' write AGENTS.md, the standards, and the per-site record
  (owners, compliance tier, divergences, accepted risks) into one repository,
  and no skills, because those are installed once for every project. 'init'
  additionally hands back the recipe to follow to build the pages; 'add' assumes
  you already have a site and leaves your source alone.

  FOR AGENTS. Non-interactive is the first-class path. One command, no prompts,
  parseable output, stable exit codes:

    npx @su-sws/synthetic-web-team init --json --answers '{"siteName":"...","unit":"..."}'

  Non-interactive is the DEFAULT whenever stdin is not a TTY, so an agent cannot
  hang on a prompt. With --json, stdout is exactly one JSON document and all
  prose goes to stderr.

  Every flag is optional. With a TTY on both ends each job interviews you
  instead. Running with no job prints this text and writes nothing.

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
  --remove         Uninstall. Valid with 'install' only. Deletes just the files the
                   install record lists, so unrelated skills in your skills
                   directories are never touched, and a file you edited is kept
                   and reported rather than deleted.

  Answer keys: siteName, unit, purpose, url, recipe, businessOwnerName,
  businessOwnerEmail, techAdminName, techAdminEmail, and the booleans
  collectsPersonalData, authenticates, payments, regulated (these four derive
  the compliance tier).

  UPDATING. Re-running is the update, at either scope: content is rewritten from
  source, project state (.sws/manifest.yml, .sws/acknowledged.yml) is preserved,
  and any file you edited yourself is reported as a conflict and left alone on
  every run until it matches again. .sws/installed.json records what was written
  so an edit can be told from an old version. Pass --force to discard your edits.

  An editor install and a project install carry their own versions, so they can
  drift. 'sws doctor' reports the difference as a note rather than a finding:
  being behind is a maintenance fact about the toolchain, not a compliance fact
  about the site.

  Exit codes: 0 success or dry run, 2 bad input or no content found,
  3 nothing written because a human declined.
`;

if (flags.help) {
  console.log(HELP);
  process.exit(0);
}

// Where the content comes from, in order of specificity.
//
// The first entry is the important one: `AGENTS.md`, `skills/` and `standards/`
// ship in the same package as this file (@su-sws/synthetic-web-team), so walking up three
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

// The version of @su-sws/synthetic-web-team, which is the content version because content and
// tools ship in one package. Recorded in .sws/installed.json so `sws doctor` can
// say whether a project is behind.
const contentVersion = (() => {
  for (const c of [resolve(HERE, '..', '..', '..', 'package.json')]) {
    try { return JSON.parse(readFileSync(c, 'utf8')).version ?? null; } catch { /* next */ }
  }
  return null;
})();

// A null version is not fatal, but it must not be silent. It gets recorded in
// .sws/installed.json, and `sws doctor` compares that against its own version to
// tell a project it is behind -- so a null disables the staleness nag FOREVER,
// with nothing on screen to say so. Found by running this project's own install
// prompt against a partial checkout.
const versionWarning = contentVersion
  ? null
  : 'Could not determine the standards version, so .sws/installed.json will record null '
    + 'and `sws doctor` will never report this project as behind. This usually means an '
    + 'incomplete checkout: the package.json beside AGENTS.md is missing.';

if (versionWarning) console.error(`  warning: ${versionWarning}`);

// The project declares a dependency on this package so `npx sws` resolves to
// the CLI in node_modules/.bin. Unscoped `sws` on the public registry is
// SOMEBODY ELSE'S package, so without this declaration every verify step this
// tool prints would run unrelated code. The range follows the content version
// because the standards and the CLI ship together.
const DEP_NAME = '@su-sws/synthetic-web-team';
const depRange = contentVersion ? `^${contentVersion}` : null;
let depResult = { status: 'not-attempted' };

// No job named means no job done. This is the fix for a real hazard rather than
// pedantry: the previous default wrote 46 files into the current directory, and
// `wizard.mjs /some/path` silently did exactly that because the path was read as
// the mode. Now an unknown first argument says so and writes nothing.
if (!cmdGiven) {
  if (positionals[0] !== undefined) {
    die(2, `unknown command: ${positionals[0]}`,
      'Expected install (into your editor), init (a new site), or add (an existing project). '
      + 'A directory goes after the command, not before it.');
  }
  console.log(HELP);
  process.exit(0);
}

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

// --- user scope -------------------------------------------------------------
//
// Installs the skills into the person's tool, then stops. There is no site at
// this point, so there is no interview, no tier, no manifest and no dependency
// -- almost none of the project flow below applies, which is why this is its own
// path rather than a set of conditionals threaded through it.
if (mode === 'user') {
  const detected = detect(root).filter((e) => e.detected);

  if (flags.remove) {
    const r = remove(root, { dryRun: flags['dry-run'], force: flags.force });

    if (r.status === 'no-record') {
      say(`\n  ${B('Nothing to remove.')} ${D('No .sws/installed.json under ' + root + ',')}`);
      say(`  ${D('so there is no record of what was ours and nothing is safe to delete.')}\n`);
    } else {
      const verb = flags['dry-run'] ? 'Would remove' : 'Removed';
      say(`\n  ${B(verb + ' ' + r.removed.length + ' file(s).')}` +
        (r.missing.length ? D(`  ${r.missing.length} already gone.`) : ''));
      if (r.kept.length) {
        say(`\n  ${B('Kept because you edited them:')}`);
        for (const k of r.kept) say(`    ${k}`);
        say(`  ${D('Your edit is your work. Re-run with --force to delete these too.')}`);
      }
      say('');
    }

    if (flags.json) {
      console.log(JSON.stringify({
        ok: true, schema: 1, scope: 'user', mode: 'install --remove',
        tool: '@su-sws/synthetic-web-team', version: contentVersion,
        root, written: !flags['dry-run'], ...r,
      }, null, 2));
    }
    process.exit(0);
  }

  const userFiles = plan({ root, source, editors: [], answers: {}, tier: {}, scope: 'user' });

  say(`\n${B('Stanford Web Services')}  ${D('installing into your tools')}\n`);
  say(`  ${B('Files to write')}  ${D(root)}\n`);
  for (const target of [...new Set(userFiles.map((f) => f.path.split('/skills/')[0]))]) {
    const n = userFiles.filter((f) => f.path.startsWith(`${target}/`)).length;
    say(`    ${target}/skills/  ${D(`${n} skills`)}`);
  }
  say(`\n  ${D('Nothing per-site is written here. No standards, no AGENTS.md, no')}`);
  say(`  ${D('manifest — there is no project yet. Run this once per machine.')}`);

  // Only ever the skills we wrote. A home skills directory holds other people's
  // work, and the install record is what keeps the two apart.
  const userNext = [
    {
      kind: 'init-project', skill: 'sws-install',
      why: 'The second half of the install. Run it inside a repository to write AGENTS.md, the standards, and the per-site record. The skills you just installed are what know how to do it.',
    },
  ];
  if (detected.some((e) => e.id === 'claude-code')) {
    userNext.push({
      kind: 'optional-mcp', command: 'claude mcp add --scope user sws -- npx -y @su-sws/synthetic-web-team-mcp',
      why: 'Registers the standards as MCP tools for every project at once. Optional, never required: everything it exposes is also a file under standards/ once a project is initialised.',
    });
  } else {
    userNext.push({
      kind: 'optional-mcp', command: 'npx -y @su-sws/synthetic-web-team-mcp --help',
      why: 'An MCP server for these standards, which can be registered in your tool\'s user-level MCP config so it covers every project. Optional, never required. Paths differ per tool, so this does not guess at one.',
    });
  }

  const emitUserJson = (wr) => console.log(JSON.stringify({
    ok: true, schema: 1, scope: 'user', mode: 'install',
    tool: '@su-sws/synthetic-web-team',
    version: contentVersion,
    warnings: versionWarning ? [versionWarning] : [],
    root,
    source,
    written: Boolean(wr),
    editors: detected.map((e) => ({ id: e.id, label: e.label, evidence: e.evidence })),
    counts: {
      files: userFiles.length,
      ...(wr ? {
        created: wr.created, updated: wr.updated, unchanged: wr.unchanged,
        conflicts: wr.conflicts.length,
      } : {}),
    },
    files: wr ? wr.results : userFiles.map((x) => ({ path: x.path, status: 'planned' })),
    conflicts: wr?.conflicts ?? [],
    orphans: wr?.orphans ?? [],
    next: userNext,
    notes: [
      'Skills only. Nothing per-site is installed at user scope.',
      'Uninstall with `--remove`, which deletes only what the install record lists.',
    ],
  }, null, 2));

  if (flags['dry-run']) {
    say(`\n  ${D('Dry run. Nothing written.')}\n`);
    if (flags.json) emitUserJson(null);
    process.exit(0);
  }

  if (interactive) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const go = (await rl.question(`\n  Write these ${userFiles.length} files? ${D('[Y/n]')}: `)).trim().toLowerCase();
    await rl.close();
    if (go && !go.startsWith('y')) {
      say('\n  Nothing written.\n');
      process.exit(3);
    }
  }

  const wr = write(root, userFiles, { force: flags.force, version: contentVersion, scope: 'user' });

  if (wr.created === 0 && wr.updated === 0) {
    say(`\n  ${B('Already installed.')} ${wr.unchanged} skills, nothing to change.\n`);
  } else {
    const parts = [];
    if (wr.created) parts.push(`${wr.created} created`);
    if (wr.updated) parts.push(`${wr.updated} updated`);
    if (wr.unchanged) parts.push(`${wr.unchanged} unchanged`);
    if (wr.conflicts.length) parts.push(`${wr.conflicts.length} left alone`);
    say(`\n  ${B('Done.')} ${parts.join(', ')}.\n`);
  }

  if (wr.conflicts.length) {
    say(`  ${B('Left alone because you edited them:')}`);
    for (const c of wr.conflicts) say(`    ${c}`);
    say(`  ${D('Re-run with --force to take the new versions and discard your edits.')}`);
    say('');
  }

  say(`  ${B('Next')}`);
  say(`    1. Open a Stanford project and ask your agent to run the sws-install skill,`);
  say(`       ${D('or: npx @su-sws/synthetic-web-team init  (new site)  /  add .  (existing)')}`);
  say(`    2. ${D('Optional MCP server: ' + userNext[userNext.length - 1].command)}`);
  say('');
  say(`  ${D('To uninstall:  npx @su-sws/synthetic-web-team install --remove')}`);
  say(`  ${D('It removes only the files this install recorded, so anything else in')}`);
  say(`  ${D('your skills directories is untouched.')}`);
  say('');

  if (flags.json) emitUserJson(wr);
  process.exit(0);
}

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
      kind: 'optional-mcp', command: 'npx -y @su-sws/synthetic-web-team-mcp --help',
      why: 'An MCP server for these standards was added to your client config. It is a second entry point, never a requirement: sws_get_standard, sws_footer_html, sws_check, sws_decanter_token, sws_scaffold. Everything it exposes is also a file under standards/. Remove the entry if you do not want it.',
    });
  }
  // `npx sws` has to resolve to node_modules/.bin/sws. Unscoped `sws` on the
  // public registry is an unrelated package, so this step is what makes the
  // verify step below run OUR CLI rather than a stranger's.
  if (depResult.status === 'added' || depResult.status === 'present') {
    next.push({
      kind: 'install-dependencies', command: 'npm install',
      why: `${DEP_NAME} is declared in devDependencies. Installing puts the sws CLI in node_modules/.bin, so \`npx sws\` runs this package instead of the unrelated \`sws\` package on the public registry.`,
    });
  } else {
    next.push({
      kind: 'add-dependency', command: `npm install -D ${DEP_NAME}`,
      why: `Do this once the project has a package.json. Without the local dependency \`npx sws\` fetches the unrelated \`sws\` package from the public registry rather than this CLI.`,
    });
  }
  next.push({
    kind: 'verify', command: 'npx sws doctor --format json',
    why: 'Advisory compliance report. Exits 0 always. Run `sws a11y` and `sws perf` first if the site is built.',
  });

  console.log(JSON.stringify({
    ok: true,
    schema: 1,
    // Symmetrical with the user-scope document, and the value echoes the command
    // that was run rather than the internal mode name, so a caller can report
    // back what it did without a lookup table.
    scope: 'project',
    tool: '@su-sws/synthetic-web-team',
    version: contentVersion,
    warnings: versionWarning ? [versionWarning] : [],
    previousVersion: wr?.previousVersion ?? null,
    mode: mode === 'add' ? 'add' : 'init',
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
    dependency: { name: DEP_NAME, range: depRange, ...depResult },
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
  depResult = ensureDevDependency(root, { name: DEP_NAME, range: depRange, dryRun: true });
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
depResult = ensureDevDependency(root, { name: DEP_NAME, range: depRange });

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

// The dependency decides whether `npx sws` runs this CLI or an unrelated
// package of the same name off the public registry, so it is reported, never
// silent -- either way round.
if (depResult.status === 'added') {
  say(`  ${B('Added to package.json:')} ${DEP_NAME} ${depResult.range} ${D('(devDependencies)')}`);
  say(`  ${D('Run npm install and `npx sws` uses this CLI, not the unrelated `sws`')}`);
  say(`  ${D('package on the public registry.')}`);
  say('');
} else if (depResult.status === 'no-package-json') {
  say(`  ${B('No package.json here yet.')} ${D('Add ' + DEP_NAME + ' to')}`);
  say(`  ${D('devDependencies once the recipe creates one, so `npx sws` resolves locally')}`);
  say(`  ${D('rather than fetching the unrelated `sws` package from the registry.')}`);
  say('');
} else if (depResult.status === 'unparseable') {
  say(`  ${B('Could not read package.json:')} ${D(depResult.detail)}`);
  say(`  ${D('Left alone. Add ' + DEP_NAME + ' to devDependencies yourself.')}`);
  say('');
} else if (depResult.status === 'skipped-unknown-version') {
  say(`  ${B('No version to pin,')} ${D('so package.json was left alone. Add')}`);
  say(`  ${D(DEP_NAME + ' to devDependencies yourself.')}`);
  say('');
}

// --- what happens next ------------------------------------------------------

say(`  ${B('Next')}`);

// Counted rather than hardcoded. The literals used to run 1, 2, then 3 with no
// step 2 in `add` mode, and threading the dependency step through would have
// made that worse.
let stepNo = 0;
const step = () => ++stepNo;
if (mode === 'new') {
  say(`    ${step()}. Scaffold the site. Hand your agent standards/recipes/${answers.recipe}/RECIPE.md,`);
  say(`       ${D('or run the upstream scaffolder yourself: npm create astro@latest')}`);
}
if (depResult.status === 'added' || depResult.status === 'present') {
  say(`    ${step()}. Install dependencies:  npm install`);
} else {
  say(`    ${step()}. Add the CLI:  npm install -D ${DEP_NAME}`);
}
say(`    ${step()}. Check it:  npx sws doctor`);
say(`    ${step()}. Fill in the blanks in .sws/manifest.yml: owners, Siteimprove, ODA review.`);
say('');
say(`  ${D('Everything is advisory. The only thing that fails a build is a committed')}`);
say(`  ${D('credential. If something cannot be fixed now, record it in')}`);
say(`  ${D('.sws/acknowledged.yml with a reason and a review date.')}`);
say('');

if (flags.json) emitJson({ written: true, write: result });
