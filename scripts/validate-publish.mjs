#!/usr/bin/env node
// Where `sws check` publishes, against a stand-in GitHub API.
//
// The gap this guards: the help said the Site health issue is written on a push
// to the default branch, but a push to ANY branch wrote it. A release or
// integration branch then overwrote the default branch's report and spliced its
// own score into the shared trend. The issue is now written only when the event
// payload names the default branch and the run is on it; everything else
// reports in the job summary, and says why. Everything runs through the real
// CLI, with GITHUB_API_URL pointed at a local server that records each request.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
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

const scratch = [];
function project() {
  const root = mkdtempSync(join(tmpdir(), 'sws-pub-'));
  scratch.push(root);
  const files = {
    'package.json': JSON.stringify({ dependencies: { next: '^16.0.0' } }),
    '.sws/manifest.yml': YAML.stringify({ recipe: 'next-ssr' }),
  };
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '-A'], { cwd: root });
  return root;
}

// The stand-in API: no existing issue or comment, and every write succeeds.
const requests = [];
const server = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    requests.push({ method: req.method, path: req.url.split('?')[0] });
    res.setHeader('content-type', 'application/json');
    if (req.method === 'GET') { res.end('[]'); return; }
    res.statusCode = 201;
    res.end(JSON.stringify({ html_url: 'https://github.example/stand-in', number: 1 }));
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const API = `http://127.0.0.1:${server.address().port}`;

// Run `sws check` as Actions would. Every GITHUB_* variable from the real
// environment is dropped first, so this script means the same thing in CI.
function sws(root, { event, payload, ref, refName, refType, args = [] }) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GITHUB_')));
  const summary = join(root, 'summary.md');
  writeFileSync(summary, '');
  Object.assign(env, {
    GITHUB_REPOSITORY: 'owner/site',
    GITHUB_TOKEN: 'stand-in-token',
    GITHUB_API_URL: API,
    GITHUB_SHA: 'abc1234',
    GITHUB_RUN_ID: '1',
    GITHUB_STEP_SUMMARY: summary,
    GITHUB_EVENT_NAME: event,
  });
  if (payload !== undefined) {
    const path = join(root, 'event.json');
    writeFileSync(path, JSON.stringify(payload));
    env.GITHUB_EVENT_PATH = path;
  }
  if (ref !== undefined) env.GITHUB_REF = ref;
  if (refName !== undefined) env.GITHUB_REF_NAME = refName;
  if (refType !== undefined) env.GITHUB_REF_TYPE = refType;

  requests.length = 0;
  return new Promise((done) => {
    const child = spawn('node', [CLI, 'check', '--format', 'terminal', '--standards', STANDARDS, ...args],
      { cwd: root, env });
    let out = '';
    child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { out += c; });
    child.on('close', () => {
      const writes = requests.filter((r) => r.method !== 'GET');
      done({ out, writes, all: [...requests], summary: readFileSync(summary, 'utf8') });
    });
  });
}

const repository = (default_branch) => ({ repository: { full_name: 'owner/site', default_branch } });
const ISSUE = '/repos/owner/site/issues';
const wroteIssue = (r) => r.writes.some((w) => w.path === ISSUE || /^\/repos\/owner\/site\/issues\/\d+$/.test(w.path));

try {
  scenario('a push to the default branch writes the Site health issue');
  {
    const r = await sws(project(), { event: 'push', payload: repository('main'), ref: 'refs/heads/main', refName: 'main' });
    check(r.writes.length === 1 && r.writes[0].method === 'POST' && r.writes[0].path === ISSUE,
      `push to main: one POST ${ISSUE}, got ${JSON.stringify(r.writes)}`);
    check(/Site health issue created/.test(r.out), 'push to main: says the issue was created');
  }

  scenario('a default branch other than main is honoured');
  {
    const r = await sws(project(), { event: 'push', payload: repository('dev'), ref: 'refs/heads/dev', refName: 'dev' });
    check(wroteIssue(r), `push to dev when dev is the default: writes the issue, got ${JSON.stringify(r.writes)}`);
  }

  scenario('a push to another branch reports in the job summary only');
  for (const branch of ['release/1.0', 'dev']) {
    const r = await sws(project(), { event: 'push', payload: repository('main'), ref: `refs/heads/${branch}`, refName: branch });
    check(r.writes.length === 0, `push to ${branch}: writes nothing to GitHub, got ${JSON.stringify(r.writes)}`);
    check(r.summary.includes(`${branch} is not the default branch (main)`),
      `push to ${branch}: the job summary says why the issue was not written`);
    check(r.summary.includes('Score'), `push to ${branch}: the job summary still has the report`);
  }

  scenario('only GITHUB_REF_NAME, as some runners set it');
  {
    const onDefault = await sws(project(), { event: 'push', payload: repository('main'), refName: 'main', refType: 'branch' });
    check(wroteIssue(onDefault), 'GITHUB_REF_NAME main, type branch: writes the issue');
    const other = await sws(project(), { event: 'push', payload: repository('main'), refName: 'dev', refType: 'branch' });
    check(other.writes.length === 0, 'GITHUB_REF_NAME dev, type branch: writes nothing');
    const tag = await sws(project(), { event: 'push', payload: repository('main'), refName: 'main', refType: 'tag' });
    check(tag.writes.length === 0, 'a tag named like the default branch: writes nothing');
  }

  scenario('a tag push writes nothing');
  {
    const r = await sws(project(), { event: 'push', payload: repository('main'), ref: 'refs/tags/v1.0.0', refName: 'v1.0.0' });
    check(r.writes.length === 0, `tag push: writes nothing, got ${JSON.stringify(r.writes)}`);
    check(r.summary.includes('not on a branch'), 'tag push: the job summary says why');
  }

  scenario('a workflow_dispatch on the default branch writes the issue');
  {
    const r = await sws(project(), { event: 'workflow_dispatch', payload: repository('main'), ref: 'refs/heads/main', refName: 'main' });
    check(wroteIssue(r), 'workflow_dispatch on main: writes the issue');
  }

  scenario('a pull request gets its comment, never the issue');
  {
    const payload = { ...repository('main'), number: 7, pull_request: { number: 7 } };
    const r = await sws(project(), { event: 'pull_request', payload, ref: 'refs/pull/7/merge', refName: '7/merge' });
    check(r.writes.length === 1 && r.writes[0].path === '/repos/owner/site/issues/7/comments',
      `pull request: one comment on #7, got ${JSON.stringify(r.writes)}`);
    check(r.all.some((q) => q.method === 'GET' && q.path === ISSUE),
      'pull request: still reads the Site health issue for the trend');
  }

  scenario('a pull request event with no number writes nothing');
  {
    const r = await sws(project(), { event: 'pull_request', payload: repository('main'), ref: 'refs/heads/main', refName: 'main' });
    check(r.writes.length === 0, `pull request without a number: writes nothing, got ${JSON.stringify(r.writes)}`);
  }

  scenario('no event payload: the default branch is unknown, so nothing is written');
  {
    const r = await sws(project(), { event: 'push', ref: 'refs/heads/main', refName: 'main' });
    check(r.writes.length === 0, `no GITHUB_EVENT_PATH: writes nothing, got ${JSON.stringify(r.writes)}`);
    check(r.summary.includes('default branch is not in the event payload'), 'no GITHUB_EVENT_PATH: the job summary says why');
  }

  scenario('a payload that does not name the default branch');
  {
    const r = await sws(project(), { event: 'schedule', payload: { schedule: '0 6 * * 1' }, ref: 'refs/heads/main', refName: 'main' });
    check(r.writes.length === 0, `no repository.default_branch: writes nothing, got ${JSON.stringify(r.writes)}`);
  }

  scenario('--no-publish still turns publishing off on the default branch');
  {
    const r = await sws(project(), { event: 'push', payload: repository('main'), ref: 'refs/heads/main', refName: 'main', args: ['--no-publish'] });
    check(r.all.length === 0, `--no-publish: no request at all, got ${JSON.stringify(r.all)}`);
    check(!r.summary.includes('Site health issue was written'), '--no-publish: no note about the issue in the summary');
  }
} finally {
  server.close();
  for (const d of scratch) rmSync(d, { recursive: true, force: true });
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
