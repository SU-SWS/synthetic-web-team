#!/usr/bin/env node
// Divergences that cover checks, against scratch repositories.
//
// The gap this guards: a divergence recorded in .sws/manifest.yml, as the
// contract asks, still left its finding under "Should fix" on every run, and
// the only way to quiet it was an accepted risk with a review date. A
// divergence's `checks:` now moves those findings to "Divergences". The cases
// that must not move matter as much: a requirement and the blocking check can
// never be diverged from. Everything runs through the real CLI.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import YAML from 'yaml';

const CLI = resolve('packages/cli/bin/sws.mjs');
const STANDARDS = resolve('standards');

let failures = 0;
let passes = 0;
const check = (cond, msg) => {
  if (cond) passes++;
  else { console.log(`::error::${msg}`); console.log(`FAIL  ${msg}`); failures++; }
};
const scenario = (name) => console.log(`\n${name}`);

// Assembled at run time, so this file is not a finding in this repository's
// own secrets check.
const KEY = ['Xk29dLq8', '3mZpQw01', 'vB7n'].join('');

const PKG = JSON.stringify({ dependencies: { next: '^16.0.0', '@fortawesome/pro-solid-svg-icons': '^7.0.0' } });

const scratch = [];
function repo(divergences, { files = {}, acknowledged } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'sws-div-'));
  scratch.push(root);
  const all = {
    'package.json': PKG,
    '.sws/manifest.yml': YAML.stringify({ recipe: 'next-ssr', divergences }),
    ...(acknowledged ? { '.sws/acknowledged.yml': YAML.stringify(acknowledged) } : {}),
    ...files,
  };
  for (const [rel, text] of Object.entries(all)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '-A'], { cwd: root });
  return root;
}

function sws(root, format = 'json') {
  const r = spawnSync('node', [CLI, 'check', '--format', format, '--no-publish', '--no-summary', '--standards', STANDARDS],
    { cwd: root, encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: '', GITHUB_STEP_SUMMARY: '' } });
  if (format !== 'json') return { exit: r.status, stdout: r.stdout, stderr: r.stderr };
  const report = JSON.parse(r.stdout);
  const find = (id) => report.findings.find((f) => f.id === id);
  return { exit: r.status, stderr: r.stderr, report, find };
}

const FA = 'security.no-fontawesome-pro';
const div = (extra) => ({
  from: 'next-ssr', changed: 'Font Awesome Pro icons, not Heroicons', reason: 'Licensed and managed (ADR 0013)',
  cost_accepted: 'A licence to renew', date: '2026-11-09', by: 'test@stanford.edu', ...extra,
});

scenario('a divergence naming a failing preference moves it to Divergences');
{
  const before = sws(repo([div({})]));
  check(before.find(FA).state === 'fail', 'without checks:, the finding still fails');

  const after = sws(repo([div({ checks: [FA] })]));
  const f = after.find(FA);
  check(f.state === 'diverged', `with checks:, the finding is diverged (got ${f.state})`);
  check(f.detail.includes('Font Awesome Pro icons, not Heroicons') && f.detail.includes('ADR 0013'),
    'the detail names the divergence and its reason');
  check(after.report.counts.diverged === 1 && after.report.score.diverged === 1, 'counts and score record it');
  check(after.report.score.earned === before.report.score.earned + f.weight, 'it earns its weight, like an accepted risk');

  const text = sws(repo([div({ checks: [FA] })]), 'terminal').stdout;
  check(/\n {2}Divergences\n {4}= security\.no-fontawesome-pro/.test(text), 'the terminal report lists it under Divergences');
  check(!/Should fix[\s\S]*no-fontawesome-pro[\s\S]*Divergences/.test(text), 'and not under Should fix');
  check(/includes 1 divergence/.test(text), 'the score line says what it includes');

  const md = sws(repo([div({ checks: [FA] })]), 'markdown').stdout;
  check(/<strong>Divergences<\/strong> \(1\)/.test(md), 'the markdown report has a Divergences section');
}

scenario('checks: as a single string works like a list of one');
{
  check(sws(repo([div({ checks: FA })])).find(FA).state === 'diverged', 'checks: <id> covers that check');
}

scenario('a divergence never covers a passing check or one it does not name');
{
  const r = sws(repo([div({ checks: ['next.no-tailwind-config'] })]));
  check(r.find('next.no-tailwind-config').state === 'pass', 'a passing check it names stays a pass');
  check(r.find(FA).state === 'fail', 'a failing check it does not name stays a fail');
}

scenario('a requirement cannot be diverged from');
{
  // minweb.siteimprove fails without a registration date in the manifest, and
  // its criterion carries the MinWeb policy.
  const r = sws(repo([div({ checks: ['minweb.siteimprove'] })]));
  const f = r.find('minweb.siteimprove');
  check(f.state === 'fail', `a MinWeb requirement stays failing (got ${f.state})`);
  check(/divergence ignored: it is a minweb requirement/.test(f.detail), 'the report says why the divergence did nothing');
  check(/acknowledged\.yml/.test(f.detail), 'and where a person can decline it instead');
  check(/warning: 1 divergence\(s\) naming minweb\.siteimprove ignored/.test(r.stderr), 'and so does stderr');
}

scenario('the blocking check cannot be diverged from');
{
  const r = sws(repo([div({ checks: ['minweb.no-secrets'] })], { files: { 'src/config.js': `const secret = '${KEY}';\n` } }));
  const f = r.find('minweb.no-secrets');
  check(r.exit === 1 && f.state === 'fail', `a committed credential still fails the build (exit ${r.exit}, ${f.state})`);
  check(/divergence ignored: it is the blocking check/.test(f.detail), 'the report says why');
}

scenario('an accepted risk is applied first, and stays an accepted risk');
{
  const acknowledged = [{ check: FA, reason: 'later', accepted_by: 'test@stanford.edu', date: '2026-11-09', review_by: '2027-01-01' }];
  const f = sws(repo([div({ checks: [FA] })], { acknowledged })).find(FA);
  check(f.state === 'acknowledged', `acknowledged wins over a divergence for the same check (got ${f.state})`);
}

for (const d of scratch) rmSync(d, { recursive: true, force: true });
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
