#!/usr/bin/env node
// Accepted risks, and the one check that blocks, against scratch repositories.
//
// The bug this guards: an acknowledgement matched on the check id alone, so
// accepting one false positive for minweb.no-secrets hid every real credential
// committed afterwards, in any file. The test that matters most is the first
// one below. Everything runs through the real CLI, because the exit code is
// what CI acts on.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import YAML from 'yaml';
import { applyAcknowledgements, pathMatches } from '../packages/cli/src/acknowledged.mjs';

const CLI = resolve('packages/cli/bin/sws.mjs');
const STANDARDS = resolve('standards');

let failures = 0;
let passes = 0;
const check = (cond, msg) => {
  if (cond) passes++;
  else { console.log(`::error::${msg}`); console.log(`FAIL  ${msg}`); failures++; }
};
const scenario = (name) => console.log(`\n${name}`);

// Every credential-shaped string here is assembled at run time, so this file is
// not itself a finding in this repository's own secrets check, placeholders
// included: the repo should not lean on the placeholder rules to stay green.
const KEY = ['Xk29dLq8', '3mZpQw01', 'vB7n'].join('');
const OTHER = ['Rt55uYw2', 'Lk09aQzx', 'P3m1'].join('');
const PEM = `-----BEGIN ${'PRIVATE'} KEY-----\n${'MIIEvQIBADANBgkqhkiG9w0BAQEFAASC'.repeat(3)}\n-----END ${'PRIVATE'} KEY-----\n`;
const say = (name, value) => `${name}: '${value}'\n`;

const scratch = [];
function repo(files, accepted) {
  const root = mkdtempSync(join(tmpdir(), 'sws-ack-'));
  scratch.push(root);
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  if (accepted) {
    mkdirSync(join(root, '.sws'), { recursive: true });
    writeFileSync(join(root, '.sws', 'acknowledged.yml'), YAML.stringify(accepted));
  }
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '-A'], { cwd: root });
  return root;
}

function sws(root) {
  const r = spawnSync('node', [CLI, 'check', '--format', 'json', '--no-publish', '--no-summary', '--standards', STANDARDS],
    { cwd: root, encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: '', GITHUB_STEP_SUMMARY: '' } });
  const report = JSON.parse(r.stdout);
  return { exit: r.status, stderr: r.stderr, stdout: r.stdout, secrets: report.findings.find((f) => f.id === 'minweb.no-secrets') };
}

const entry = (extra) => ({ check: 'minweb.no-secrets', reason: 'test', accepted_by: 'test@stanford.edu', date: '2026-10-23', review_by: '2027-01-01', ...extra });

scenario('accepting one path leaves the check failing on a new credential in another file');
{
  const accepted = [entry({ path: 'vendor/sdk/README.md' })];
  const before = sws(repo({ 'vendor/sdk/README.md': `token: '${KEY}'\n` }, accepted));
  check(before.exit === 0 && before.secrets.state === 'acknowledged', 'the accepted file alone: acknowledged, exit 0');

  const after = sws(repo({ 'vendor/sdk/README.md': `token: '${KEY}'\n`, 'src/config.js': `const secret = '${OTHER}';\n` }, accepted));
  check(after.exit === 1 && after.secrets.state === 'fail', `a credential in another file still fails the check (exit ${after.exit}, ${after.secrets.state})`);
  check(after.secrets.detail.includes('src/config.js:1') && !after.secrets.detail.includes('vendor/sdk/README.md'),
    'the report names the new file, not the accepted one');
  check(after.secrets.detail.includes('1 other match accepted'), 'and says what was accepted');
}

scenario('an entry for the blocking check with no path is ignored, loudly');
{
  const r = sws(repo({ 'src/config.js': `const secret = '${OTHER}';\n` }, [entry({})]));
  check(r.exit === 1 && r.secrets.state === 'fail', 'the check still fails');
  check(/ignored: an entry for minweb\.no-secrets must name a path/.test(r.secrets.detail), 'the report says why the entry did nothing');
  check(/warning: 1 acknowledgement\(s\) for minweb\.no-secrets ignored/.test(r.stderr), 'and so does stderr');
}

scenario('line and value narrow an entry');
{
  const files = { 'config.js': `const a = { token: '${KEY}' };\nconst b = { token: '${OTHER}' };\n` };
  check(sws(repo(files, [entry({ path: 'config.js', line: 1 })])).exit === 1, 'line 1 accepted, line 2 still fails');
  check(sws(repo(files, [entry({ path: 'config.js', value: KEY })])).exit === 1, 'one value accepted, the other still fails');
  check(sws(repo(files, [entry({ path: 'config.js', value: KEY }), entry({ path: 'config.js', value: OTHER })])).exit === 0,
    'both values accepted: acknowledged');
  check(sws(repo(files, [entry({ path: 'config.js' })])).exit === 0, 'the whole file accepted: acknowledged');
}

scenario('every match is reported, and no value is ever repeated');
{
  const r = sws(repo({ 'a.js': `token: '${KEY}'\nsecret: '${OTHER}'\n`, 'b.pem': PEM }));
  check(r.secrets.locations.length === 3, `every match, not the first per file (${r.secrets.locations.length} of 3)`);
  check(!r.stdout.includes(KEY) && !r.stdout.includes(OTHER), 'neither value appears anywhere in the report');
}

scenario('obvious placeholders are skipped, and said to be');
{
  const r = sws(repo({
    'vendor/README.md': say('accessToken', ['storyblok', 'user', 'access', 'token'].join('-')),
    'test/fixture.js': say('managementToken', ['management', 'token'].join('-'))
      + `const pem = '-----BEGIN ${'PRIVATE'} KEY-----\\nkey\\n-----END ${'PRIVATE'} KEY-----';\n`,
    'docs/ok.js': say('token', 'x'.repeat(16)),
  }));
  check(r.exit === 0 && r.secrets.state === 'pass', `the pilot's two false positives no longer block (${r.secrets.state})`);
  check(/4 placeholders skipped/.test(r.secrets.detail), 'and the report lists what it skipped');

  const real = sws(repo({ 'a.js': say('password', ['correct', 'horse', 'battery', 'staple'].join('-')), 'b.pem': PEM }));
  check(real.secrets.locations?.length === 2, 'a passphrase with no telling word, and a PEM with a real body, still count');
}

scenario('paths, globs and what a non-blocking entry covers');
{
  check(pathMatches('tests/fixtures/**', 'tests/fixtures/a/b.json') && !pathMatches('tests/fixtures/**', 'tests/other.json'),
    '`**` matches everything under a directory, and nothing outside it');
  check(pathMatches('**/README.md', 'README.md') && pathMatches('**/README.md', 'vendor/x/README.md'), '`**/` matches at any depth');
  check(pathMatches('src/*.ts', 'src/a.ts') && !pathMatches('src/*.ts', 'src/a/b.ts'), '`*` stays within one segment');
  check(pathMatches('vendor/', 'vendor/a/b.md') && pathMatches('./a.js', 'a.js'), 'a directory prefix, and a leading ./');

  const finding = { id: 'manifest.present', state: 'fail', detail: 'no manifest' };
  const a = applyAcknowledgements(finding, [{ check: 'manifest.present', accepted_by: 'x' }], { blocking: false });
  check(a.state === 'acknowledged', 'a non-blocking check is still accepted by id, as before');
  const b = applyAcknowledgements({ ...finding, id: 'x.block' }, [{ check: 'x.block', path: 'a.js' }], { blocking: true });
  check(b.state === 'fail', 'a blocking finding with no locations is never accepted: nothing to scope to');
}

for (const d of scratch) rmSync(d, { recursive: true, force: true });
console.log(`\n${passes} passed`);
console.log(failures ? `${failures} failure(s)` : 'All checks passed.');
process.exit(failures ? 1 : 0);
