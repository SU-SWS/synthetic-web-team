#!/usr/bin/env node
// sws: advisory compliance checks for Stanford websites.
//
// Design commitments, enforced here rather than documented elsewhere:
//   - `doctor` ALWAYS exits 0. It is a conversation, not a gate.
//   - `check` exits non-zero ONLY for a blocking finding. Today that is exactly
//     one thing: committed secrets.
//   - A check that cannot run reports `unknown`, never `pass`.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import YAML from 'yaml';
import { ALL, findHtml } from '../src/checks.mjs';
import { score, renderTerminal, renderMarkdown, renderJson, group } from '../src/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    dist: { type: 'string' },
    standards: { type: 'string' },
    recipe: { type: 'string' },
    format: { type: 'string', default: 'terminal' },
    out: { type: 'string' },
    strict: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

const cmd = positionals[0] ?? 'doctor';
const root = resolve(process.cwd());

const USAGE = `
  sws <command>

  doctor            Friendly local report. Always exits 0.
  check             Full run for CI. Exits non-zero only on a blocking finding.
  prior-art scan    Index Stanford projects on this machine. Never transmitted.
  version

  --dist <dir>      Build output (default: auto-detect dist, _site, build, out)
  --standards <dir> Standards directory (default: auto-detect)
  --recipe <id>     Recipe id (default: from .sws/manifest.yml, else astro-static)
  --format          terminal | json | markdown
  --out <file>      Write the report to a file as well as stdout
  --strict          Treat every failure as blocking. Opt-in, off by default.
`;

if (flags.help) { console.log(USAGE); process.exit(0); }

// --- locate things ----------------------------------------------------------

function findStandards() {
  if (flags.standards) return resolve(flags.standards);
  for (const c of [
    join(root, 'standards'),
    join(root, '.sws', 'standards'),
    resolve(HERE, '..', '..', '..', 'standards'),
  ]) if (existsSync(c)) return c;
  return null;
}

function findDist() {
  if (flags.dist) return resolve(flags.dist);
  for (const c of ['dist', '_site', 'build', 'out']) {
    if (existsSync(join(root, c))) return join(root, c);
  }
  return join(root, 'dist');
}

function loadManifest() {
  const p = join(root, '.sws', 'manifest.yml');
  if (!existsSync(p)) return {};
  try { return YAML.parse(readFileSync(p, 'utf8')) || {}; } catch { return {}; }
}

function loadAcknowledged() {
  const p = join(root, '.sws', 'acknowledged.yml');
  if (!existsSync(p)) return [];
  try {
    const y = YAML.parse(readFileSync(p, 'utf8'));
    return Array.isArray(y) ? y : (y?.accepted ?? []);
  } catch { return []; }
}

// Recipes may `extends: <recipeId>`. Only differences live in the child, so the
// shared criteria cannot drift between recipes, which is the failure this whole
// project is organised against.
//
// Merge rules:
//   - parent criteria are inherited
//   - `overrides:` with `applies: false` REMOVES an inherited criterion
//   - any other `overrides:` entry patches the inherited one field by field
//   - `criteria:` in the child adds new ones, or replaces by id
function loadAcceptance(standards, recipeId, seen = new Set()) {
  const p = join(standards, 'recipes', recipeId, 'acceptance.yml');
  if (!existsSync(p)) return null;
  if (seen.has(recipeId)) {
    console.error(`Circular recipe extends chain at "${recipeId}".`);
    process.exit(2);
  }
  seen.add(recipeId);

  const own = YAML.parse(readFileSync(p, 'utf8')) || {};
  if (!own.extends) return { ...own, criteria: own.criteria ?? [] };

  const parent = loadAcceptance(standards, own.extends, seen);
  if (!parent) {
    console.error(`Recipe "${recipeId}" extends "${own.extends}", which was not found.`);
    process.exit(2);
  }

  const merged = new Map((parent.criteria ?? []).map((c) => [c.id, c]));
  for (const o of own.overrides ?? []) {
    if (!merged.has(o.id)) {
      console.error(`Warning: ${recipeId} overrides "${o.id}", which the parent does not define.`);
      continue;
    }
    if (o.applies === false) merged.delete(o.id);
    else merged.set(o.id, { ...merged.get(o.id), ...o });
  }
  for (const c of own.criteria ?? []) merged.set(c.id, c);

  return {
    ...parent, ...own,
    extends: own.extends,
    inherited_from: [own.extends, ...(parent.inherited_from ?? [])],
    criteria: [...merged.values()],
  };
}

// --- run --------------------------------------------------------------------

async function run() {
  const standards = findStandards();
  if (!standards) {
    console.error('Could not find a standards/ directory. Pass --standards <dir>.');
    process.exit(2);
  }

  const manifest = loadManifest();
  const recipeId = flags.recipe || manifest.recipe || 'astro-static';
  const acceptance = loadAcceptance(standards, recipeId);
  if (!acceptance) {
    console.error(`No acceptance.yml for recipe "${recipeId}" under ${standards}/recipes/.`);
    process.exit(2);
  }

  const dist = findDist();
  const html = findHtml(dist);
  const ctx = { root, dist, html, standards, manifest };

  // Run every check module once; they each return several findings.
  const raw = [];
  for (const [name, fn] of Object.entries(ALL)) {
    try {
      raw.push(...fn(ctx));
    } catch (err) {
      raw.push({ id: `${name}.internal-error`, state: 'unknown',
        detail: `check crashed: ${err.message}` });
    }
  }

  // Attach weights and severities from the criteria. A finding with no matching
  // criterion still reports, at weight 0, so a check is never silently dropped.
  const byId = new Map((acceptance.criteria || []).map((c) => [c.id, c]));
  const ack = loadAcknowledged();
  const now = new Date();

  const findings = raw.map((f) => {
    const c = byId.get(f.id) || {};
    const a = ack.find((x) => x.check === f.id);
    let state = f.state;
    let note;
    if (a && state === 'fail') {
      state = 'acknowledged';
      note = `accepted by ${a.accepted_by ?? 'unknown'}${a.reason ? `: ${a.reason}` : ''}`;
      if (a.review_by && new Date(a.review_by) < now) note += `  [review overdue since ${a.review_by}]`;
    }
    return {
      ...f, state,
      detail: note ? `${f.detail}  (${note})` : f.detail,
      weight: c.weight ?? 0,
      severity: c.severity ?? 'warn',
      blocking: f.blocking || c.severity === 'block',
      policy: c.policy ?? null,
    };
  });

  // Any criterion that produced NO finding is reported as `unknown`, never
  // silently dropped. A criterion absent from the report is invisible: the
  // reader cannot tell it passed, failed, or never ran. This bit us on a Next
  // project with no build output, where five inherited criteria vanished.
  for (const c of acceptance.criteria || []) {
    if (findings.some((f) => f.id === c.id)) continue;
    findings.push({
      id: c.id,
      state: 'unknown',
      detail: c.manual
        ? 'manual step, not automatable'
        : `no check produced a result. Usually means a prerequisite is missing: ${
            c.check === 'footer' || c.check === 'identity' || c.check === 'a11y' || c.check === 'seo'
              ? 'no build output, so run the build first'
              : c.check === 'decanter'
                ? 'dependencies are not installed'
                : 'see the recipe'}`,
      weight: c.weight ?? 0,
      severity: c.severity ?? 'info',
      blocking: false,
      policy: c.policy ?? null,
    });
  }

  // A criterion the recipe removed via `applies: false` should not appear at
  // all, even if its check still emits a finding.
  const declared = new Set((acceptance.criteria || []).map((c) => c.id));
  for (let i = findings.length - 1; i >= 0; i--) {
    const f = findings[i];
    if (!declared.has(f.id) && f.state === 'not_applicable') findings.splice(i, 1);
  }

  findings.sort((a, b) => a.id.localeCompare(b.id));
  const sc = score(findings);
  const blocking = findings.filter((f) => f.blocking && f.state === 'fail');

  const payload = { findings, sc, recipe: recipeId, blocking };
  const render = { json: renderJson, markdown: renderMarkdown, terminal: renderTerminal };
  const text = (render[flags.format] ?? renderTerminal)(payload);
  console.log(text);

  if (flags.out) {
    mkdirSync(dirname(resolve(flags.out)), { recursive: true });
    writeFileSync(resolve(flags.out), text);
  }

  // GitHub job summary, so a trunk push reports somewhere a human will look.
  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, renderMarkdown(payload) + '\n', { flag: 'a' });
  }

  if (cmd === 'doctor') return 0;                       // never gates
  if (blocking.length) return 1;
  if (flags.strict && findings.some((f) => f.state === 'fail')) return 1;
  return 0;
}

// --- dispatch ---------------------------------------------------------------

switch (cmd) {
  case 'doctor':
  case 'check':
    process.exit(await run());
    break;
  case 'prior-art':
    console.log('prior-art scan is not implemented yet. It will index Stanford');
    console.log('projects on this machine (metadata only) to .sws/prior-art.local.yml,');
    console.log('which is gitignored and never transmitted.');
    process.exit(0);
    break;
  case 'version':
    console.log(JSON.parse(readFileSync(join(HERE, '..', 'package.json'), 'utf8')).version);
    process.exit(0);
    break;
  default:
    console.log(USAGE);
    process.exit(cmd ? 2 : 0);
}
