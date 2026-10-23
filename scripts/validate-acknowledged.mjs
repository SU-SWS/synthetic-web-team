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
  for (const path of ['**', '**/*', './', '*', '**/*.*', '*.*']) {
    const all = sws(repo({ 'a/x.js': `const secret = '${KEY}';\n`, 'y.js': `const secret = '${OTHER}';\n` }, [entry({ path })]));
    check(all.exit === 1 && /ignored/.test(all.secrets.detail), `path: '${path}' is ignored like a missing path`);
  }
  // A scoped glob still works.
  for (const path of ['**/*.js', 'a/**', 'a/']) {
    const scoped = sws(repo({ 'a/x.js': `const secret = '${KEY}';\n` }, [entry({ path })]));
    check(scoped.exit === 0 && !/ignored/.test(scoped.secrets.detail), `path: '${path}' is honoured`);
  }
}

scenario('line and sha256 narrow an entry; value is refused');
{
  const files = { 'config.js': `const a = { token: '${KEY}' };\nconst b = { token: '${OTHER}' };\n` };
  check(sws(repo(files, [entry({ path: 'config.js', line: 1 })])).exit === 1, 'line 1 accepted, line 2 still fails');
  check(sws(repo(files, [entry({ path: 'config.js', sha256: hash(KEY) })])).exit === 1, 'one sha256 accepted, the other still fails');
  check(sws(repo(files, [entry({ path: 'config.js', sha256: hash(KEY) }), entry({ path: 'config.js', sha256: hash(OTHER) })])).exit === 0,
    'both accepted by sha256: acknowledged');
  // value: would leave a plaintext copy in acknowledged.yml that, for the
  // generic pattern, nothing scans for. Refused, and the entry does not
  // quietly widen to the whole path either.
  const v = sws(repo(files, [entry({ path: 'config.js', value: KEY }), entry({ path: 'config.js', value: OTHER })]));
  check(v.exit === 1 && /`value:` would copy the matched text/.test(v.secrets.detail), 'value: entries are ignored, loudly, and fail closed');
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

  // A key without its footer is still the key.
  const body = PEM.split('\n').slice(1, -2).join('\n');
  const footless = `-----BEGIN ${'RSA PRIVATE'} KEY-----\n${body}\n`;
  check(sws(repo({ 'id_rsa': footless })).secrets.locations?.length === 1, 'a key with its footer line missing still fails');
  const yaml = `deploy:\n  key: |\n    -----BEGIN ${'PRIVATE'} KEY-----\n    ${body.replace(/\n/g, '\n    ')}\nother: 1\n`;
  check(sws(repo({ 'deploy.yml': yaml })).secrets.locations?.length === 1, 'and so does one in a YAML block with the footer dropped');
  const big = `-----BEGIN ${'PRIVATE'} KEY-----\n${'MIIEvQIBADANBgkqhkiG9w0BAQEFAASC\n'.repeat(400)}-----END ${'PRIVATE'} KEY-----\n`;
  check(sws(repo({ 'big.pem': big })).secrets.locations?.length === 1, 'a key longer than 10,000 characters still fails');

  // One block's footer is never another's: an example header must not take
  // the real key below it, footer and all.
  const example = `const example = '-----BEGIN ${'PRIVATE'} KEY-----';\n\n${PEM}`;
  const ex = sws(repo({ 'keys.js': example }, [entry({ path: 'keys.js', line: 1 })]));
  check(ex.exit === 1 && ex.secrets.detail.includes('keys.js:3'), 'accepting an example header leaves the real key after it failing');

  // Nothing between a BEGIN and an END string is hidden by them, whether the
  // text there is short (a placeholder span) or long enough to look like a
  // key: a key block is base64 and nothing else, and only an identical match
  // is folded.
  const head = `const pemHeader = '-----BEGIN ${'PRIVATE'} KEY-----';\n`;
  const foot = `const pemFooter = '-----END ${'PRIVATE'} KEY-----';\n`;
  const session = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0', 'c2lnbmF0dXJlMTIz'].join('.');
  for (const [name, between] of [
    ['a real credential', say('secret', OTHER)],
    ['a credential after a long line of prose', `const doc = '${'Explains how the PEM parser handles headers and footers. '.repeat(3)}';\n${say('secret', OTHER)}`],
    ['a token inside an object', `const apiConfig = { endpoint: 'https://api.example.com/v1', token: '${OTHER}' };\n`],
    ['a JWT inside an object', `const apiConfig = { endpoint: 'https://api.example.com/v1', session: '${session}' };\n`],
  ]) {
    const files = { 'src/pem.js': head + between + foot };
    const r = sws(repo(files));
    const inside = (r.secrets.locations ?? []).filter((l) => l.line > 1 && l.label !== 'private key').length;
    const accepted = sws(repo(files, [entry({ path: 'src/pem.js', line: 1 })]));
    check(inside >= 1 && accepted.exit === 1, `${name} between BEGIN and END strings is reported, and accepting the header line leaves it failing`);
  }
}

scenario('a prefix match never hides the rest of a value');
{
  // `AKIA...` is a prefix of the whole secret. Accepting the prefix by its
  // sha256 used to accept any value that started with it.
  const aws = ['AKIA', 'IOSFODNN7', 'EXAMPLE'].join('');
  const v1 = `${aws}-${['First', 'Value123456'].join('')}`;
  const v2 = `${aws}-${['Other', 'Value987654'].join('')}`;
  const accepted = [entry({ path: 'c.js', sha256: hash(aws) }), entry({ path: 'c.js', sha256: hash(v1) })];
  const before = sws(repo({ 'c.js': say('secret', v1) }, accepted));
  check(before.exit === 0, 'the prefix and the whole value both accepted: acknowledged');
  const after = sws(repo({ 'c.js': say('secret', v2) }, accepted));
  check(after.exit === 1 && after.secrets.detail.includes('c.js:1'), 'changing only the suffix leaves the check failing');
}

scenario('common key shapes are each one location');
{
  const b = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASC';
  const H = `-----BEGIN ${'PRIVATE'} KEY-----`;
  const F = `-----END ${'PRIVATE'} KEY-----`;
  const shapes = {
    'a PEM file': ['id.pem', `${H}\n${b}\n${b}\n${b}\n${F}\n`],
    'a service-account JSON key': ['sa.json', `{\n  "type": "service_account",\n  "private_key": "${H}\\n${b}\\n${b}\\n${b}\\n${F}\\n",\n  "client_email": "x@example.iam.gserviceaccount.com"\n}\n`],
    'a YAML block': ['deploy.yml', `key: |\n  ${H}\n  ${b}\n  ${b}\n  ${b}\n  ${F}\nnext: 1\n`],
    'a JS concatenation': ['k.js', `const k = '${H}\\n' +\n  '${b}\\n' +\n  '${b}\\n' +\n  '${b}\\n' +\n  '${F}\\n';\n`],
    'a Dockerfile continuation': ['Dockerfile', `ENV KEY="${H}\\\n${b}\\\n${b}\\\n${b}\\\n${F}"\n`],
    'a quoted .env value': ['.env', `KEY="${H}\\n${b}\\n${b}\\n${b}\\n${F}"\n`],
  };
  for (const [name, [file, text]] of Object.entries(shapes)) {
    const locs = sws(repo({ [file]: text })).secrets.locations ?? [];
    check(locs.length === 1 && locs[0].label === 'private key', `${name}: one private-key location (got ${locs.length})`);
  }
}

scenario('narrowing by sha256 keeps credential-shaped text out of acknowledged.yml');
{
  // A value: entry with an AWS-shaped string was itself a finding in this file;
  // value: is refused now, and the copy it wrote is still found.
  const aws = ['AKIA', 'IOSFODNN7', 'EXAMPLE'].join('');
  const byValue = sws(repo({ 'docs/aws.md': `Example key: ${aws}\n` }, [entry({ path: 'docs/aws.md', value: aws })]));
  check(byValue.exit === 1 && byValue.secrets.detail.includes('.sws/acknowledged.yml'),
    'a credential-shaped value: is refused, and the copy in acknowledged.yml is reported');
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
  check(pathMatches('test/**.json', 'test/fixture.json') && pathMatches('test/**.json', 'test/nested/fixture.json')
    && !pathMatches('test/**.json', 'other/x.json'), '`**` before a suffix matches file names at any depth, and only there');

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
