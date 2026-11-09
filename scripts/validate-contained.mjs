#!/usr/bin/env node
// The contained layout, against scratch repositories, through the real wizard.
//
// The gap this guards: `add .` always wrote outside .sws/ (a block in
// AGENTS.md, CLAUDE.md, MCP configs, editor pointers, package.json), so a team
// that keeps SWS separate from its own files could not run the update at all
// and had to install into a scratch copy and carry files back by hand.
// `--layout contained` writes nothing outside .sws/, and the install record
// remembers it, so a plain `add .` keeps it. The test that matters most is the
// byte-for-byte comparison of every file outside .sws/.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, relative } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const WIZARD = resolve('packages/wizard/bin/wizard.mjs');
const SOURCE = resolve('.');

let failures = 0;
let passes = 0;
const check = (cond, msg) => {
  if (cond) { passes++; console.log(`OK     ${msg}`); }
  else { console.log(`::error::${msg}`); console.log(`FAIL   ${msg}`); failures++; }
};
const scenario = (name) => console.log(`\n${name}`);

// A project with the files an install would otherwise touch.
const PROJECT = {
  'AGENTS.md': '# Our rules\n\nThese are the project\'s own.\n',
  'CLAUDE.md': '@AGENTS.md\n',
  '.mcp.json': `${JSON.stringify({ mcpServers: { other: { command: 'other' } } }, null, 2)}\n`,
  '.github/copilot-instructions.md': '# Copilot\n',
  'package.json': `${JSON.stringify({ name: 'site', devDependencies: { astro: '^5.0.0' } }, null, 2)}\n`,
};
const EDITORS = 'claude-code,copilot,codex,cursor';

const scratch = [];
function repo(files = PROJECT) {
  const root = mkdtempSync(join(tmpdir(), 'sws-contained-'));
  scratch.push(root);
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  execFileSync('git', ['init', '-q'], { cwd: root });
  return root;
}

function wizard(root, args) {
  const r = spawnSync('node', [WIZARD, 'add', '.', '--json', '--source', SOURCE, ...args], { cwd: root, encoding: 'utf8' });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* reported by the caller */ }
  return { exit: r.status, json, stderr: r.stderr };
}

// Every file outside .sws/ and .git/, with its contents.
function outside(root) {
  const out = {};
  (function walk(d) {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      const rel = relative(root, p);
      if (rel === '.git' || rel === '.sws') continue;
      if (statSync(p).isDirectory()) walk(p);
      else out[rel] = readFileSync(p, 'utf8');
    }
  })(root);
  return out;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const record = (root) => JSON.parse(readFileSync(join(root, '.sws', 'installed.json'), 'utf8'));

scenario('--layout contained writes nothing outside .sws/');
{
  const root = repo();
  const before = outside(root);
  const r = wizard(root, ['--layout', 'contained', '--editors', EDITORS]);
  check(r.exit === 0 && r.json, `exits 0 with a JSON result (exit ${r.exit})`);
  check(same(outside(root), before), 'every file outside .sws/ is byte-for-byte unchanged, and none is added');
  const contract = existsSync(join(root, '.sws/AGENTS.md')) ? readFileSync(join(root, '.sws/AGENTS.md'), 'utf8') : '';
  check(contract.startsWith('<!-- BEGIN:sws-agent-contract -->') && contract.trimEnd().endsWith('<!-- END:sws-agent-contract -->'),
    '.sws/AGENTS.md holds the contract between its markers');
  check(existsSync(join(root, '.sws/standards/fragments/global-footer.yml')) && existsSync(join(root, '.sws/manifest.yml')),
    'the standards and the manifest are in .sws/');
  const rec = record(root);
  check(rec.layout === 'contained', 'the install record says contained');
  check(Object.keys(rec.files).every((f) => f.startsWith('.sws/')), 'and lists only files under .sws/');
  check(r.json.layout === 'contained', 'the result says contained');
  check(r.json.dependency.status === 'not-added', `package.json is not given the dependency (${r.json.dependency.status})`);
  const kinds = r.json.next.map((n) => n.kind);
  check(r.json.next.find((n) => n.kind === 'read-contract')?.path === '.sws/AGENTS.md', 'next[] reads the contract at .sws/AGENTS.md');
  check(kinds.includes('point-to-contract'), 'next[] says to point the project\'s own files at it');
  check(!kinds.includes('optional-mcp'), 'next[] does not claim an MCP server was added');
  check(kinds.includes('add-dependency'), 'next[] says how to add the dependency, as a choice');
}

scenario('a plain re-run keeps the layout, and changes nothing');
{
  const root = repo();
  wizard(root, ['--layout', 'contained', '--editors', EDITORS]);
  const before = outside(root);
  const r = wizard(root, ['--editors', EDITORS]);
  check(r.json?.layout === 'contained', `add . with no --layout stays contained (got ${r.json?.layout})`);
  check(same(outside(root), before), 'and writes nothing outside .sws/');
  check(r.json.counts.created === 0 && r.json.counts.updated === 0 && r.json.counts.merged === 0,
    'and nothing inside it changes either');
  check(record(root).layout === 'contained', 'the record still says contained');
}

scenario('an existing dependency is left as it is');
{
  const pkg = `${JSON.stringify({ name: 'site', devDependencies: { '@su-sws/synthetic-web-team': '0.1.0' } }, null, 2)}\n`;
  const root = repo({ ...PROJECT, 'package.json': pkg });
  const r = wizard(root, ['--layout', 'contained', '--editors', EDITORS]);
  check(r.json.dependency.status === 'present' && r.json.dependency.range === '0.1.0', 'it is reported present, at its own pin');
  check(readFileSync(join(root, 'package.json'), 'utf8') === pkg, 'and package.json is untouched');
}

scenario('--layout root switches back, and says what it left behind');
{
  const root = repo();
  wizard(root, ['--layout', 'contained', '--editors', 'claude-code']);
  const r = wizard(root, ['--layout', 'root', '--editors', 'claude-code']);
  check(r.json?.layout === 'root', 'the result says root');
  check(readFileSync(join(root, 'AGENTS.md'), 'utf8').includes('<!-- BEGIN:sws-agent-contract -->'), 'the contract goes into AGENTS.md');
  check(record(root).layout === undefined, 'the record drops the layout, as for any root install');
  check(r.json.orphans.includes('.sws/AGENTS.md'), '.sws/AGENTS.md is reported, not deleted');
}

scenario('a root install is unchanged by all this');
{
  const root = repo();
  const r = wizard(root, ['--editors', 'claude-code']);
  check(r.json?.layout === 'root', 'with no --layout and no record, the layout is root');
  check(readFileSync(join(root, 'AGENTS.md'), 'utf8').includes('<!-- BEGIN:sws-agent-contract -->'), 'the contract is merged into AGENTS.md');
  check(!('layout' in record(root)), 'the record has no layout key');
  check(!existsSync(join(root, '.sws/AGENTS.md')), 'and there is no .sws/AGENTS.md');
}

scenario('a layout that does not exist is bad input');
{
  const r = wizard(repo(), ['--layout', 'inside']);
  check(r.exit === 2, `exit 2 (got ${r.exit})`);
  const home = mkdtempSync(join(tmpdir(), 'sws-home-'));
  scratch.push(home);
  const u = spawnSync('node', [WIZARD, 'install', home, '--layout', 'contained', '--json', '--source', SOURCE], { encoding: 'utf8' });
  check(u.status === 2, `--layout with install is bad input too (got ${u.status})`);
}

for (const d of scratch) rmSync(d, { recursive: true, force: true });
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
