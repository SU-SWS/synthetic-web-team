#!/usr/bin/env node
// The published package, run from its own tarball.
//
// The bug this guards: `sws version` read packages/cli/package.json, which the
// package's `files` list leaves out, so it crashed in every install and passed
// in this repository, where the file exists. A check of the tarball's file
// list could not catch that: the command has to run from the tarball. So pack
// for real, unpack it somewhere this repository cannot be seen, and run the
// commands that read the package's own files.

import { mkdtempSync, rmSync, symlinkSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

let failures = 0;
let passes = 0;
const check = (cond, msg) => {
  if (cond) { passes++; console.log(`OK     ${msg}`); }
  else { console.log(`::error::${msg}`); console.log(`FAIL   ${msg}`); failures++; }
};

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const dir = mkdtempSync(join(tmpdir(), 'sws-packed-'));
try {
  execFileSync('npm', ['pack', '--silent', '--pack-destination', dir], { stdio: ['ignore', 'ignore', 'inherit'] });
  const tgz = readdirSync(dir).find((f) => f.endsWith('.tgz'));
  execFileSync('tar', ['xzf', join(dir, tgz), '-C', dir]);
  const pkg = join(dir, 'package');
  // The package's dependencies, as an install would provide them.
  symlinkSync(resolve('node_modules'), join(pkg, 'node_modules'), 'dir');

  const run = (bin, args, cwd = dir) => spawnSync('node', [join(pkg, bin), ...args], { cwd, encoding: 'utf8' });

  const v = run('packages/cli/bin/sws.mjs', ['version']);
  check(v.status === 0, `sws version exits 0 from the tarball (got ${v.status}${v.stderr ? `: ${v.stderr.split('\n')[0]}` : ''})`);
  check(v.stdout.trim() === version, `and prints the package version, ${version} (got "${v.stdout.trim()}")`);

  // No project standards here, so doctor has to find the copy bundled in the tarball.
  const empty = mkdtempSync(join(dir, 'site-'));
  const doctor = run('packages/cli/bin/sws.mjs', ['doctor', '--format', 'json', '--no-publish', '--no-summary'], empty);
  let report = null;
  try { report = JSON.parse(doctor.stdout); } catch { /* reported below */ }
  check(doctor.status === 0 && report?.findings?.length > 0,
    `sws doctor runs from the tarball on an empty folder, with the bundled standards (exit ${doctor.status}${report ? '' : ', no JSON report'})`);

  const wizard = run('packages/wizard/bin/wizard.mjs', []);
  check(wizard.status === 0 && /synthetic-web-team <install\|init\|add>/.test(wizard.stdout), 'the wizard with no job prints its usage');
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
