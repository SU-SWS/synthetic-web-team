#!/usr/bin/env node
// Refresh the emitted skill copies from skills/, which is the source of truth
// in this repo. Both targets are gitignored here and regenerated on demand.
//
// In a CONSUMER project there is no skills/ source: the wizard emits both paths
// and both are committed. See docs/skill-paths.md.
//
// --check exits non-zero if the copies are stale, for CI.

import { readdirSync, readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = 'skills';
const TARGETS = ['.agents/skills', '.claude/skills'];
const checkOnly = process.argv.includes('--check');

if (!existsSync(SOURCE)) {
  console.error(`No ${SOURCE}/ directory. Run from the repo root.`);
  process.exit(1);
}

const manifest = (dir) => {
  if (!existsSync(dir)) return null;
  const out = {};
  for (const name of readdirSync(dir)) {
    const f = join(dir, name, 'SKILL.md');
    if (existsSync(f)) out[name] = readFileSync(f, 'utf8');
  }
  return out;
};

const src = manifest(SOURCE);
const names = Object.keys(src).sort();

if (checkOnly) {
  let stale = false;
  for (const t of TARGETS) {
    const got = manifest(t);
    if (!got) {
      console.log(`STALE  ${t} does not exist`);
      stale = true;
      continue;
    }
    const missing = names.filter((n) => !(n in got));
    const extra = Object.keys(got).filter((n) => !(n in src));
    const differ = names.filter((n) => n in got && got[n] !== src[n]);
    if (missing.length || extra.length || differ.length) {
      stale = true;
      if (missing.length) console.log(`STALE  ${t} missing: ${missing.join(', ')}`);
      if (extra.length) console.log(`STALE  ${t} orphaned: ${extra.join(', ')}`);
      if (differ.length) console.log(`STALE  ${t} differs: ${differ.join(', ')}`);
    } else {
      console.log(`OK     ${t} matches source (${names.length} skills)`);
    }
  }
  if (stale) {
    console.log('\nRun `npm run sync-skills` to refresh.');
    process.exit(1);
  }
  process.exit(0);
}

// Write file by file rather than copying directories. Slower and much more
// portable: directory copy hits permission and attribute problems on mounted
// and networked filesystems, and we only ever want SKILL.md anyway.
for (const t of TARGETS) {
  // Remove orphans first so a renamed or deleted skill does not linger.
  if (existsSync(t)) {
    for (const existing of readdirSync(t)) {
      if (!(existing in src)) {
        rmSync(join(t, existing), { recursive: true, force: true });
        console.log(`pruned ${join(t, existing)}`);
      }
    }
  }
  for (const name of names) {
    const dir = join(t, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), src[name]);
  }
  console.log(`wrote  ${t}  (${names.length} skills)`);
}
console.log(`\nSource of truth is ${SOURCE}/. Both copies are gitignored here.`);
