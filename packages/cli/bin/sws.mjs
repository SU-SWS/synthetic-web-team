#!/usr/bin/env node
// sws: advisory compliance checks for Stanford websites.
//
// Design commitments, enforced here rather than documented elsewhere:
//   - `doctor` ALWAYS exits 0. It is a conversation, not a gate.
//   - `check` exits non-zero ONLY for a blocking finding. Today that is exactly
//     one thing: committed secrets.
//   - A check that cannot run reports `unknown`, never `pass`.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import YAML from 'yaml';
import { ALL, findHtml } from '../src/checks.mjs';
import { runAxe, RESULTS_PATH as AXE_RESULTS_PATH } from '../src/axe.mjs';
import { runPerf, RESULTS_PATH as PERF_RESULTS_PATH } from '../src/perf.mjs';
import { runStates, RESULTS_PATH as STATE_RESULTS_PATH } from '../src/states.mjs';
import {
  score, renderTerminal, renderMarkdown, renderJson, group,
  renderPrComment, renderIssueBody, renderHtml, renderBadge,
} from '../src/report.mjs';
import * as history from '../src/history.mjs';
import * as gh from '../src/github.mjs';
// Sibling directory inside the same published package (@su-sws/sws), so this
// relative path resolves in the repository and in a tarball alike. One reader
// of the install record means the CLI and the wizard cannot disagree about what
// "installed" means.
import { readInstalled } from '../../create-web-team/src/emit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// `standards/` ships in the same package as this file (@su-sws/sws), so the
// relative walk below finds it in both the published layout and this
// repository. There used to be an `import('@su-sws/standards')` fallback here;
// consolidating content and tools into one package removed the need for it,
// along with the cross-package version skew it could produce.

const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    dist: { type: 'string' },
    standards: { type: 'string' },
    recipe: { type: 'string' },
    format: { type: 'string', default: 'terminal' },
    out: { type: 'string' },
    strict: { type: 'boolean', default: false },
    'no-summary': { type: 'boolean', default: false },
    'no-publish': { type: 'boolean', default: false },
    'html': { type: 'string' },
    'badge': { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

const cmd = positionals[0] ?? 'doctor';
const root = resolve(process.cwd());

// With --format json, stdout is exactly one JSON document. Every other line --
// the trend, publish confirmations, warnings -- goes to stderr.
//
// This was a real bug: the trend line was appended to stdout after the JSON, so
// `sws doctor --format json | jq` failed, and the MCP server's sws_check tool
// reported "output that is not JSON" while looking at valid JSON with a
// sentence stuck to the end of it. Machine-readable means machine-readable.
const note = (...a) => (flags.format === 'json' ? console.error(...a) : console.log(...a));

const USAGE = `
  sws <command>

  doctor            Friendly local report. Always exits 0.
  check             Full run for CI. Exits non-zero only on a blocking finding.
  a11y              Run axe over every built route, then measure hover and
                    focus states with a real mouse and a real Tab key. Writes
                    .sws/axe-results.json and .sws/state-results.json, which
                    check and doctor then read. Always exits 0.
                    Needs @playwright/test and @axe-core/playwright in THIS
                    project, plus: npx playwright install chromium
  perf              Measure the performance budget in a real browser. Writes
                    .sws/perf-results.json. Needs @playwright/test. Exits 0.
  prior-art scan    Index Stanford projects on this machine. Never transmitted.
  version

  --dist <dir>      Build output (default: auto-detect dist, _site, build, out)
  --standards <dir> Standards directory (default: auto-detect)
  --recipe <id>     Recipe id (default: from .sws/manifest.yml, else astro-static)
  --format          terminal | json | markdown
  --out <file>      Write the report to a file as well as stdout
  --strict          Treat every failure as blocking. Opt-in, off by default.
  --no-summary      Do not append to \$GITHUB_STEP_SUMMARY.
  --no-publish      Do not write the PR comment or the Site health issue.
  --html <file>     Also write a standalone HTML report.
  --badge <file>    Write a shields.io endpoint JSON for a README badge.

  In CI, check upserts ONE PR comment on a pull request, or ONE persistent
  "Site health" issue on a push to the default branch. Both are updated in
  place, never duplicated. Needs issues:write and pull-requests:write.
  Publishing never fails the build: a network or permission error is reported
  and the exit code is unaffected.

  In GitHub Actions the report is appended to the job summary automatically,
  unless --format markdown (you are handling output) or --no-summary. One
  invocation is enough; do not also redirect into the summary file.
`;

if (flags.help) { console.log(USAGE); process.exit(0); }

// Does this project look like it was installed by the wizard?
//
// A `.sws/manifest.yml` alone is NOT enough evidence, and assuming it was cost a
// false nag on this project's own docs site: `site/` is hand-built inside this
// repository and carries a manifest, but nothing was ever vendored into it. The
// advice "re-run the installer" would have written 81 files of skills and
// standards into a directory that wants none of them.
//
// The real signature of a wizard install is vendored content, so look for that.
function wizardInstalled(dir) {
  return existsSync(join(dir, 'AGENTS.md'))
    && (existsSync(join(dir, '.agents', 'skills')) || existsSync(join(dir, '.claude', 'skills')));
}

// --- locate things ----------------------------------------------------------

// A project normally vendors `standards/` (the wizard copies it in), so the
// local lookups come first and win. The last entry is the copy that ships
// alongside this CLI, which covers `npx @su-sws/sws sws doctor` in a project
// that never vendored them.
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
        // Declared debt reads differently from a missing prerequisite, and
        // conflating them was how `perf.budget` looked like a build problem for
        // weeks. Say "not built yet" plainly; the points stay withheld either way.
        : c.unimplemented
          ? `no check implemented yet, so its ${c.weight ?? 0} point(s) are withheld. ${
              String(c.unimplemented).trim().replace(/\s+/g, ' ')}`
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
  //
  // Only when the caller did NOT ask for markdown on stdout. Otherwise a
  // workflow doing `sws check --format markdown >> $GITHUB_STEP_SUMMARY` gets
  // the report twice from one invocation, and a workflow that also runs the
  // terminal format gets it three times. That happened on the first real run of
  // this project's own Pages workflow.
  //
  // `--no-summary` opts out entirely, for a caller that wants full control.
  const wantsSummary =
    process.env.GITHUB_STEP_SUMMARY && flags.format !== 'markdown' && !flags['no-summary'];
  if (wantsSummary) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, renderMarkdown(payload) + '\n', { flag: 'a' });
  }

  // --- trend, artifacts, publishing ----------------------------------------
  //
  // Two histories, deliberately not reconciled. The LOCAL one is a
  // per-developer convenience for `doctor`'s "since your last run"; the SHARED
  // one lives in the Site health issue body so the project trend is not
  // polluted by one person's local runs. See src/history.mjs.

  const ghCtx = gh.context();
  const entry = history.entryFor({
    score: sc.value, findings, sha: ghCtx?.sha, ref: ghCtx?.ref, runId: ghCtx?.runId,
  });

  // Local delta. Recorded for both commands, shown only by doctor: in CI the
  // shared trend is the meaningful one and two numbers would confuse.
  const localBefore = history.readLocal(root);
  history.appendLocal(root, entry);
  if (cmd === 'doctor') {
    const t = history.trend(sc.value, localBefore);
    if (t) {
      note(t.delta === 0
        ? `  Unchanged since your last local run.\n`
        : `  Score ${sc.value}, ${t.text} since your last local run.\n`);
    }
  }

  // Read the shared history BEFORE composing anything, because the trend line
  // has to compare against the previous run rather than this one.
  let existingIssue = null;
  let sharedHistory = [];
  const wantsPublish = ghCtx && ghCtx.token && !flags['no-publish'] && cmd === 'check';
  if (wantsPublish) {
    const found = await gh.findHealthIssue(ghCtx);
    if (found.error) console.error(`  note: could not read the Site health issue (${found.error})`);
    existingIssue = found.issue ?? null;
    sharedHistory = history.parseFromBody(existingIssue?.body);
  }

  const trend = history.trend(sc.value, sharedHistory.length ? sharedHistory : localBefore);
  const spark = history.sparkline([...sharedHistory, entry]);

  if (flags.html) {
    mkdirSync(dirname(resolve(flags.html)), { recursive: true });
    writeFileSync(resolve(flags.html), renderHtml(payload, { trend, spark, sha: ghCtx?.sha, runUrl: ghCtx?.runUrl }));
  }
  if (flags.badge) {
    mkdirSync(dirname(resolve(flags.badge)), { recursive: true });
    writeFileSync(resolve(flags.badge), renderBadge(sc) + '\n');
  }

  if (wantsPublish) {
    const isPr = Boolean(ghCtx.pr);
    if (isPr) {
      const r = await gh.upsertPrComment(ghCtx, renderPrComment(payload, { trend, runUrl: ghCtx.runUrl }));
      if (r.error) console.error(`  note: PR comment failed (${r.error})`);
      else if (r.action) note(`  PR comment ${r.action}: ${r.url}`);
    } else {
      const body = renderIssueBody(payload, {
        trend, spark, runUrl: ghCtx.runUrl, sha: ghCtx.sha,
      }) + '\n\n' + history.embedInBody([...sharedHistory, entry]);
      const r = await gh.upsertHealthIssue(ghCtx, body, existingIssue);
      if (r.error) console.error(`  note: Site health issue failed (${r.error})`);
      else if (r.action) note(`  Site health issue ${r.action}: ${r.url}`);
    }
  } else if (ghCtx && !ghCtx.token && cmd === 'check' && !flags['no-publish']) {
    console.error('  note: in CI without GITHUB_TOKEN, so no PR comment or issue was written.');
  }

  // --- is this project on stale standards? ---------------------------------
  //
  // A doctor NOTE, deliberately not a finding. Being behind is a maintenance
  // fact about the toolchain, not a compliance fact about the site, and scoring
  // it would mean a project loses points for something that has nothing to do
  // with whether it meets Stanford's requirements.
  //
  // The comparison is free because content and tools ship in ONE package
  // (@su-sws/sws), so the version of this CLI *is* the version of the standards
  // it carries. No network call, no registry lookup.
  if (cmd === 'doctor') {
    const installed = readInstalled(root);
    const mine = (() => {
      try { return JSON.parse(readFileSync(resolve(HERE, '..', '..', '..', 'package.json'), 'utf8')).version; }
      catch { return null; }
    })();
    if (installed?.version && mine && installed.version !== mine) {
      note(`  Standards in this project are v${installed.version}; this tool carries v${mine}.`);
      note(`  To update:  npx @su-sws/create-web-team add .`);
      note(`  ${'Content is rewritten, your .sws state is preserved, and files you edited'}`);
      note(`  are reported rather than overwritten.\n`);
    } else if (!installed && wizardInstalled(root)) {
      note(`  No .sws/installed.json, so an update cannot tell your edits from an old`);
      note(`  version. Re-run the installer once to create it.\n`);
    }
    return 0;                                           // never gates
  }
  if (blocking.length) return 1;
  if (flags.strict && findings.some((f) => f.state === 'fail')) return 1;
  return 0;
}

// --- a11y -------------------------------------------------------------------
// Separate command, not folded into `check`, for two reasons: `check` must stay
// fast and runnable without a browser, and CI wants axe as its own step so a
// browser download failure is legible instead of buried in a compliance report.
//
// Two measurements, one command and one browser launch: axe over every route,
// then the interactive-state audit. They belong together -- both need Chromium,
// both are accessibility, and a second command would be a second thing for CI
// and for people to forget. The state audit is what catches a hover or focus
// state that is only a colour change, which axe cannot see because it audits a
// static snapshot.
//
// Always exits 0. These are measurements, not gates: the resulting findings are
// scored by `check` like everything else.

async function a11y() {
  const dist = findDist();
  const html = dist ? findHtml(dist) : [];
  console.log(`  axe: ${html.length} route(s) from ${dist ? relative(root, dist) || '.' : 'no build output'}`);

  const r = await runAxe({ root, dist, html });

  if (r.status !== 'ok') {
    console.log(`\n  Did not complete: ${r.status}`);
    console.log(`  ${r.detail}`);
    console.log(`\n  Recorded in ${AXE_RESULTS_PATH}. This reports as \`unknown\`, never as a pass,`);
    console.log('  so the criterion withholds its points rather than flattering the score.');
    // Still attempt the state audit. It needs Playwright but NOT
    // @axe-core/playwright, so the commonest reason axe bails -- that one
    // package missing -- says nothing about whether states can be measured.
    // Returning here would have turned one missing dependency into four
    // unknowns instead of one.
    await states();
    return 0;
  }

  const v = r.totals.violations;
  console.log(`  axe ${r.versions.axe} on ${r.versions.browser}, tags: ${r.tags.join(', ')}`);
  if (!v) {
    console.log(`\n  0 violations across ${r.totals.routes} route(s).`);
    console.log('  That is a floor, not a conformance claim: automation covers roughly 30%');
    console.log('  of accessibility issues per ODA guidance. The manual checklist covers the rest.');
  } else {
    console.log(`\n  ${v} violation(s):\n`);
    for (const route of r.routes.filter((x) => x.counts?.violations)) {
      console.log(`  ${route.route}`);
      for (const x of route.violations) {
        console.log(`    ${x.impact ?? 'unknown'}  ${x.id}${x.nodeCount > 1 ? ` (${x.nodeCount} nodes)` : ''}  ${x.help}`);
        if (x.nodes[0]?.target) console.log(`      ${x.nodes[0].target}`);
        console.log(`      ${x.helpUrl}`);
      }
      console.log('');
    }
  }
  if (r.totals.incomplete) {
    console.log(`  ${r.totals.incomplete} incomplete result(s) need human review. axe could not decide;`);
    console.log('  these are not failures and are not scored. See the results file.');
  }
  console.log(`  Full detail: ${AXE_RESULTS_PATH}`);

  await states();
  return 0;
}

// --- interactive states -----------------------------------------------------
// Hover and focus, measured rather than inferred: real mouse, real Tab key,
// computed style diffed property by property. A change that is only a colour
// is a finding (SC 1.4.1 via G183); no change at all on focus is a finding
// (SC 2.4.7). Never gates, and reports `unknown` rather than `pass` when it
// could not measure.

async function states() {
  const dist = findDist();
  const html = dist ? findHtml(dist) : [];

  console.log('');
  console.log(`  states: hover and focus on ${html.length} route(s)`);

  const r = await runStates({ root, dist, html });

  if (r.status !== 'ok') {
    console.log(`\n  Did not complete: ${r.status}`);
    console.log(`  ${r.detail}`);
    console.log(`\n  Recorded in ${STATE_RESULTS_PATH}. Reports as \`unknown\`, never as a pass.`);
    return 0;
  }

  const t = r.totals;
  console.log(`  ${t.controls} distinct control shape(s), ${t.instances} instance(s)`);

  const flagged = r.routes.flatMap((x) => (x.findings ?? []).map((f) => ({ ...f, route: x.route })));
  if (!flagged.length) {
    console.log('\n  Every hover and focus state carries a cue that does not depend on colour.');
  } else {
    console.log(`\n  ${flagged.length} control shape(s) to fix:\n`);
    for (const f of flagged) {
      const what = f.verdict === 'no-change' ? 'no visible focus state' : `${f.state}: colour only`;
      console.log(`    ${what}  ${f.label ? `"${f.label}"` : f.target}${f.occurrences > 1 ? ` (${f.occurrences} instances)` : ''}`);
      console.log(`      ${f.route}  ${f.target}`);
      if (f.classes?.length) console.log(`      classes: ${f.classes.join(' ')}`);
      if (f.changed?.length) console.log(`      changed: ${f.changed.join(', ')}`);
      console.log(`      fix: ${f.graphic
        ? 'no text on this control, so an underline is not the fix -- add an outline, a border, or a shape change'
        : 'add or remove an underline (`hover:underline`, `focus-visible:underline`, or `hocus:underline`)'}`);
    }
    console.log('');
    console.log('  WCAG 2.1 SC 1.4.1 via technique G183: where colour identifies a control,');
    console.log('  hover AND focus each need a cue that does not depend on colour vision.');
  }

  if (t.inconclusive) {
    console.log(`\n  ${t.inconclusive} control(s) could not be hovered by a real mouse: covered by another`);
    console.log('  element, moving under the pointer, or not pointer-reachable at all, which is');
    console.log('  normal for a visually hidden skip link. Not counted either way -- the');
    console.log(`  inventory in ${STATE_RESULTS_PATH} says which, and why.`);
  }
  console.log(`\n  Full detail: ${STATE_RESULTS_PATH}`);
  return 0;
}

// --- perf -------------------------------------------------------------------
// Budgets first-party uncompressed bytes and request counts, not Lighthouse
// scores. See standards/stack/performance-budget.yml for why. Always exits 0.

async function perf() {
  const standards = findStandards();
  const dist = findDist();
  const html = dist ? findHtml(dist) : [];
  console.log(`  perf: ${html.length} route(s) from ${dist ? relative(root, dist) || '.' : 'no build output'}`);

  const r = await runPerf({ root, dist, html, standards, manifest: loadManifest() });

  if (r.status !== 'ok') {
    console.log(`\n  Did not complete: ${r.status}`);
    console.log(`  ${r.detail}`);
    console.log(`\n  Recorded in ${PERF_RESULTS_PATH}. Reports as \`unknown\`, never as a pass.`);
    return 0;
  }

  const L = r.budget.limits;
  console.log(`  budget v${r.budget.version}, measuring ${r.budget.measures}`);
  if (Object.keys(r.budget.overrides).length) {
    console.log(`  project override: ${JSON.stringify(r.budget.overrides)}`);
    if (r.budget.overrideReason) console.log(`    reason: ${r.budget.overrideReason.trim().split('\n')[0]}`);
  }
  console.log('');

  for (const route of r.routes) {
    const f = route.firstParty;
    const flag = r.breaches.some((b) => b.route === route.route) ? '!' : ' ';
    console.log(`  ${flag} ${route.route}  ${f.total_kb} KB / ${L.total_kb} KB, ${f.requests} req`);
    const parts = Object.entries(f.by_type_kb).filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`);
    if (parts.length) console.log(`      ${parts.join('  ')}`);
    if (route.timings_ms_unscored) {
      console.log(`      unscored: DCL ${route.timings_ms_unscored.domContentLoaded}ms, load ${route.timings_ms_unscored.load}ms`);
    }
  }

  if (r.breaches.length) {
    console.log(`\n  ${r.breaches.length} breach(es):`);
    for (const b of r.breaches) {
      console.log(`    ${b.route}  ${b.key.replace(/_kb$/, '')} ${b.actual} > ${b.limit}${b.overridden ? ' (overridden limit)' : ''}`);
    }
    console.log('\n  Usual wins: fewer and correctly sized images, fewer islands, no');
    console.log('  client-side framework for static content.');
  } else {
    console.log(`\n  Within budget on all ${r.totals.routes} route(s).`);
  }

  // Third party is reported, never scored. It is also a privacy signal.
  if (r.totals.third_party_origins) {
    console.log(`\n  ${r.totals.third_party_origins} third-party origin(s), ${r.totals.third_party_kb} KB, not counted against the budget:`);
    for (const o of r.thirdPartyOrigins) console.log(`    ${o}`);
    console.log('  These are a privacy surface as well as a performance cost: MinPriv treats');
    console.log('  a new third-party service as disclosable, and it can trigger a DRA.');
    console.log('  See standards/policy/privacy.md.');
  }
  console.log(`\n  Full measurement: ${PERF_RESULTS_PATH}`);
  return 0;
}

// --- dispatch ---------------------------------------------------------------

switch (cmd) {
  case 'doctor':
  case 'check':
    process.exit(await run());
    break;
  case 'a11y':
    process.exit(await a11y());
    break;
  case 'perf':
    process.exit(await perf());
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
