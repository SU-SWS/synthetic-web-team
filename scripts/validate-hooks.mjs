#!/usr/bin/env node
// workflow.no-blocking-hooks, against scratch repositories.
//
// The finding is advice, weight 0, but advice that fires on a developer's own
// setup teaches people to ignore the report. So the cases that must stay quiet
// matter as much as the ones that must not: husky's own internals, an agent
// hook that cannot block, and a .claude/settings.json that git ignores.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { workflow } from '../packages/cli/src/checks.mjs';

let failures = 0;
const scratch = [];

function repo(layout, { git = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'sws-hooks-'));
  scratch.push(root);
  if (git) execFileSync('git', ['init', '-q'], { cwd: root });
  for (const [rel, text] of Object.entries(layout)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  return root;
}

function expect(name, layout, want, opts) {
  const f = workflow({ root: repo(layout, opts) }).find((x) => x.id === 'workflow.no-blocking-hooks');
  const got = f?.state;
  if (got === want) console.log(`OK     ${want.padEnd(4)}  ${name}`);
  else { console.log(`FAIL   ${name}: expected ${want}, got ${got}  ${f?.detail ?? ''}`); failures++; }
}

const settings = (hooks) => JSON.stringify({ hooks });

expect('no hooks at all', {}, 'pass');
expect('husky pre-commit', { '.husky/pre-commit': 'npx lint-staged\n' }, 'fail');
expect('husky internals only', { '.husky/_/h': '#!/bin/sh\n' }, 'pass');
expect('husky with only a README', { '.husky/README.md': '# hooks\n' }, 'pass');
expect('husky with a helper script and a post-merge hook', {
  '.husky/install.mjs': 'export {}\n', '.husky/post-merge': 'npm install\n',
}, 'pass');
expect('husky pre-push next to a README', { '.husky/README.md': '# hooks\n', '.husky/pre-push': 'npm test\n' }, 'fail');
expect('lefthook config', { 'lefthook.yml': 'pre-commit:\n  commands: {}\n' }, 'fail');
expect('pre-commit framework', { '.pre-commit-config.yaml': 'repos: []\n' }, 'fail');
expect('simple-git-hooks in package.json', { 'package.json': '{"simple-git-hooks":{"pre-commit":"npm test"}}' }, 'fail');
expect('Claude Code PreToolUse hook', { '.claude/settings.json': settings({ PreToolUse: [] }) }, 'fail');
expect('Claude Code Stop hook', { '.claude/settings.json': settings({ Stop: [] }) }, 'fail');
expect('Claude Code PostToolUse only, which cannot block', { '.claude/settings.json': settings({ PostToolUse: [] }) }, 'pass');
expect('PreToolUse in a git-ignored .claude/', {
  '.gitignore': '.claude\n', '.claude/settings.json': settings({ PreToolUse: [] }),
}, 'pass', { git: true });
expect('PreToolUse in a committed .claude/', { '.claude/settings.json': settings({ PreToolUse: [] }) }, 'fail', { git: true });

for (const d of scratch) rmSync(d, { recursive: true, force: true });
console.log(failures ? `\n${failures} failure(s)` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
