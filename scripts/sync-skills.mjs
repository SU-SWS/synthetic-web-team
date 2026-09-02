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
  let materialized = 0;
  for (const t of TARGETS) {
    const got = manifest(t);
    // ABSENT IS NOT STALE, and this distinction is the whole point of the
    // check. In THIS repo both targets are gitignored (see .gitignore and
    // docs/skill-paths.md), so a fresh clone -- and every CI checkout -- simply
    // does not have them. Calling that drift made the CI gate red on every run
    // from the moment it was added, which is a broken gate, not a finding.
    //
    // Drift is when a copy EXISTS and disagrees with skills/. That is the
    // developer-machine failure this check is for: you edit skills/, forget to
    // re-sync, and your own agent then reads the old instructions.
    if (!got) {
      console.log(`ABSENT ${t} not materialized (run \`npm run sync-skills\` to load skills locally)`);
      continue;
    }
    materialized++;
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
  if (!materialized) {
    console.log(`\nNeither copy is materialized, so there was nothing to compare.`);
    console.log(`That is expected in a fresh checkout. The gate that CI runs on`);
    console.log(`the emitted paths is scripts/validate-emit.mjs.`);
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
