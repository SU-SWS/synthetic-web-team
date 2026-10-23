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
import { applyAcknowledgements, pathMatches, sha256 as hash } from '../packages/cli/src/acknowledged.mjs';

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
  check(/ignored: an entry for minweb\.no-secrets must name a file or directory/.test(r.secrets.detail), 'the report says why the entry did nothing');
  check(/warning: 1 acknowledgement\(s\) for minweb\.no-secrets ignored/.test(r.stderr), 'and so does stderr');

  // A path that names nothing is no path. '**' was the obvious thing to type
  // to make the warning above go away, and it reopened the original bug.
  for (const path of ['**', '**/*', './', '*']) {
    const all = sws(repo({ 'a/x.js': `const secret = '${KEY}';\n`, 'b/y.js': `const secret = '${OTHER}';\n` }, [entry({ path })]));
    check(all.exit === 1 && /ignored/.test(all.secrets.detail), `path: '${path}' is ignored like a missing path`);
  }
}

scenario('line, sha256 and value narrow an entry');
{
  const files = { 'config.js': `const a = { token: '${KEY}' };\nconst b = { token: '${OTHER}' };\n` };
  check(sws(repo(files, [entry({ path: 'config.js', line: 1 })])).exit === 1, 'line 1 accepted, line 2 still fails');
  check(sws(repo(files, [entry({ path: 'config.js', sha256: hash(KEY) })])).exit === 1, 'one sha256 accepted, the other still fails');
  check(sws(repo(files, [entry({ path: 'config.js', sha256: hash(KEY) }), entry({ path: 'config.js', sha256: hash(OTHER) })])).exit === 0,
    'both accepted by sha256: acknowledged');
  check(sws(repo(files, [entry({ path: 'config.js', value: KEY }), entry({ path: 'config.js', value: OTHER })])).exit === 0,
    'value works too, for text that is not credential-shaped');
  check(sws(repo(files, [entry({ path: 'config.js' })])).exit === 0, 'the whole file accepted: acknowledged');

  // Two values on ONE line are two locations. Folding by line meant accepting
  // one accepted both.
  const one = { 'config.js': `const a = { token: '${KEY}' }; const b = { token: '${OTHER}' };\n` };
  check(sws(repo(one)).secrets.locations.length === 2, 'two credentials on one line are two locations');
  check(sws(repo(one, [entry({ path: 'config.js', sha256: hash(KEY) })])).exit === 1, 'accepting one of them leaves the other failing');
}

scenario('a placeholder never hides a credential next to it');
{
  // The placeholder used to mark its line as seen, so the real one after it on
  // the same line was never looked at. A minified bundle is one long line.
  const line = `export const c = { ${say('token', ['your', 'access', 'token'].join('-')).trim()}, ${say('secret', OTHER).trim()} };\n`;
  const r = sws(repo({ 'config.js': line }));
  check(r.exit === 1 && r.secrets.locations?.length === 1, `a real credential after a placeholder on one line still fails (${r.secrets.state})`);
}

scenario('a whole private key or token is one value, and is told from another');
{
  const KEY_B = PEM.replace('MIIEvQIB', 'MIIEvQIC');
  const both = sws(repo({ 'keys/a.pem': PEM, 'keys/b.pem': KEY_B }, [entry({ path: 'keys/', sha256: hash(PEM.trimEnd()) })]));
  check(both.exit === 1 && both.secrets.detail.includes('keys/b.pem'),
    'two keys that differ after the header have different hashes, so accepting one leaves the other');

  const jwt = (sig) => ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0', sig].join('.');
  const t = sws(repo({ 'a.js': `const t = '${jwt('sigAAAAAAAAAAAA')}';\nconst u = '${jwt('sigBBBBBBBBBBBB')}';\n` },
    [entry({ path: 'a.js', sha256: hash(jwt('sigAAAAAAAAAAAA')) })]));
  check(t.exit === 1 && t.secrets.locations.length === 1, 'two JWTs that differ only in their signature are two values');
}

scenario('narrowing by sha256 keeps credential-shaped text out of acknowledged.yml');
{
  // A value: entry with an AWS-shaped string was itself a finding in this file.
  const aws = ['AKIA', 'IOSFODNN7', 'EXAMPLE'].join('');
  const byValue = sws(repo({ 'docs/aws.md': `Example key: ${aws}\n` }, [entry({ path: 'docs/aws.md', value: aws })]));
  check(byValue.exit === 1 && byValue.secrets.detail.includes('.sws/acknowledged.yml'),
    'value: with a credential-shaped string is found in acknowledged.yml in turn, and fails closed');
  const byHash = sws(repo({ 'docs/aws.md': `Example key: ${aws}\n` }, [entry({ path: 'docs/aws.md', sha256: hash(aws) })]));
  check(byHash.exit === 0 && byHash.secrets.state === 'acknowledged', 'sha256: accepts it, with nothing new to find');
}

scenario('every match is reported, and neither value nor hash is ever repeated');
{
  const r = sws(repo({ 'a.js': `token: '${KEY}'\nsecret: '${OTHER}'\n`, 'b.pem': PEM }));
  check(r.secrets.locations.length === 3, `every match, not the first per file (${r.secrets.locations.length} of 3)`);
  check(!r.stdout.includes(KEY) && !r.stdout.includes(OTHER), 'neither value appears anywhere in the report');
  check(!r.stdout.includes(hash(KEY)) && !r.stdout.includes(hash(KEY).slice(0, 12))
    && r.secrets.locations.every((l) => !('sha256' in l) && !('digest' in l)),
    'no hash of a value appears either: a hash of a weak password is a guess-checker');
}

scenario('files and keys the scan used to miss');
{
  const r = sws(repo({ 'docs/café.js': `const secret = '${KEY}';\n`, 'config.json': `{ "secret": "${OTHER}" }\n` }));
  const paths = (r.secrets.locations ?? []).map((l) => l.path).sort().join(', ');
  check(paths === 'config.json, docs/café.js', `a non-ASCII file name and a quoted JSON key are both scanned: got ${paths}`);
}

scenario('passphrases that only contain a telling word inside another word');
{
  const words = [['monkey', 'horse', 'battery', 'staple'], ['whiskey', 'tango', 'foxtrot'], ['secretary', 'desk', 'lamp', 'blue']];
  const r = sws(repo(Object.fromEntries(words.map((w, i) => [`p${i}.js`, say('password', w.join('-'))]))));
  check(r.secrets.locations?.length === 3, `monkey, whiskey and secretary are not "key" or "secret" (${r.secrets.locations?.length ?? 0} of 3)`);
}

scenario('sws digest prints the sha256 to narrow an entry, locally');
{
  const root = repo({ 'config.js': `const a = { token: '${KEY}' };\n` });
  const out = spawnSync('node', [CLI, 'digest', 'config.js:1'], { cwd: root, encoding: 'utf8' }).stdout;
  check(out.includes(`sha256: ${hash(KEY)}`) && !out.includes(KEY), 'it prints the hash of the value, and not the value');
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
